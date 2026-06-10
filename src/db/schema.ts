import { now } from "@/utils/security";
/**
 * SQLite 数据库 Schema
 * - 完整的数据表定义
 * - 数据库初始化
 * - 版本迁移管理
 */

import * as SQLite from "expo-sqlite";
import { logger } from "@/logger";

export const DB_NAME = "wishmanager.db";

// 当前数据库版本号
export const CURRENT_DB_VERSION = 3;

// ============ 建表 SQL ============

const CREATE_TABLES_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  parent_password_hash TEXT NOT NULL,
  monthly_budget REAL DEFAULT 100,
  new_budget_effective_month TEXT,
  total_stars INTEGER DEFAULT 0,
  avatar TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 月度预算表
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  month TEXT NOT NULL,
  base_budget REAL NOT NULL DEFAULT 100,
  carried_over REAL NOT NULL DEFAULT 0,
  total_budget REAL NOT NULL,
  spent REAL NOT NULL DEFAULT 0,
  remaining REAL NOT NULL,
  UNIQUE(user_id, month)
);

-- 愿望表
CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  image_path TEXT,
  price REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  cooling_end_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'cooling' CHECK(status IN ('cooling','wanted','purchased','insufficient','expired','cancelled')),
  purchased_month TEXT,
  daily_confirmations TEXT DEFAULT '[]',
  child_notes TEXT
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('daily','weekly','special')),
  stars INTEGER NOT NULL DEFAULT 1,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  requires_parent_confirm INTEGER NOT NULL DEFAULT 0,
  parent_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  week_start TEXT
);

-- 成就表
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  achievement_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  max_progress INTEGER NOT NULL,
  unlocked_at INTEGER,
  UNIQUE(user_id, achievement_id)
);

-- 冲突记录表
CREATE TABLE IF NOT EXISTS crisis_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  location TEXT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  duration INTEGER,
  strategy TEXT,
  outcome TEXT CHECK(outcome IN ('success','partial','escalated')),
  child_reaction TEXT
);
`;

const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_wishes_status ON wishes(status);
CREATE INDEX IF NOT EXISTS idx_wishes_user_status ON wishes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wishes_cooling_end ON wishes(cooling_end_at);
CREATE INDEX IF NOT EXISTS idx_wishes_user_cooling ON wishes(user_id, cooling_end_at);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month ON monthly_budgets(month);
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_user_month ON monthly_budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_user_type ON tasks(user_id, type);
CREATE INDEX IF NOT EXISTS idx_achievements_id ON achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_achievement ON achievements(user_id, achievement_id);
CREATE INDEX IF NOT EXISTS idx_crisis_records_user ON crisis_records(user_id);
`;

// ============ 类型定义 ============

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  parentPasswordHash: string;
  monthlyBudget: number;
  newBudgetEffectiveMonth: string | null;
  totalStars: number;
  avatar: string | null;
  createdAt: number;
}

export interface MonthlyBudget {
  id: number;
  month: string;
  baseBudget: number;
  carriedOver: number;
  totalBudget: number;
  spent: number;
  remaining: number;
}

export interface Wish {
  id: number;
  name: string;
  imagePath: string | null;
  price: number;
  createdAt: number;
  coolingEndAt: number;
  status: "cooling" | "wanted" | "purchased" | "insufficient" | "expired" | "cancelled";
  purchasedMonth: string | null;
  dailyConfirmations: string; // JSON string[]
  childNotes: string | null;
}

export interface Task {
  id: number;
  title: string;
  type: "daily" | "weekly" | "special";
  stars: number;
  completed: number;
  completedAt: number | null;
  requiresParentConfirm: number;
  parentConfirmed: number;
  createdAt: number;
  weekStart: string | null;
}

export interface Achievement {
  id: number;
  achievementId: string;
  progress: number;
  maxProgress: number;
  unlockedAt: number | null;
}

export interface CrisisRecord {
  id: number;
  location: string | null;
  startedAt: number;
  resolvedAt: number | null;
  duration: number | null;
  strategy: string | null;
  outcome: "success" | "partial" | "escalated" | null;
  childReaction: string | null;
}

// ============ 数据库单例 ============

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    logger.debug("SQLite database opened", { name: DB_NAME });
  }
  return db;
}

// ============ 初始化与迁移 ============

export function initDatabase(): SQLite.SQLiteDatabase {
  const database = getDatabase();

  // 检查版本
  const versionRow = database.getFirstSync<{ version: number }>(
    "PRAGMA user_version"
  );
  const currentVersion = versionRow?.version ?? 0;
  logger.info(`Database version: ${currentVersion}, target: ${CURRENT_DB_VERSION}`);

  if (currentVersion < CURRENT_DB_VERSION) {
    logger.info("Running database migration...");
    migrate(database, currentVersion);
  }

  return database;
}

function migrate(database: SQLite.SQLiteDatabase, fromVersion: number) {
  database.withTransactionSync(() => {
    // v0 -> v1: 初始建表
    if (fromVersion < 1) {
      logger.info("Migrating v0 -> v1: Creating initial tables");
      database.execSync(CREATE_TABLES_SQL);
      database.execSync(CREATE_INDEXES_SQL);

      database.execSync(`PRAGMA user_version = 1`);
      logger.info("Migration v0 -> v1 complete");
    }

    // v1 -> v2: 添加 total_stars 和 avatar 到 users 表，修正默认预算，清理重复任务
    if (fromVersion < 2) {
      logger.info("Migrating v1 -> v2: Adding total_stars and avatar to users");

      // 先检查列是否已存在（避免重复添加导致崩溃）
      const totalStarsCol = database.getFirstSync<{ count: number }>(
        "SELECT COUNT(*) as count FROM pragma_table_info('users') WHERE name = 'total_stars'"
      );
      if (!totalStarsCol || totalStarsCol.count === 0) {
        database.execSync(`ALTER TABLE users ADD COLUMN total_stars INTEGER DEFAULT 0;`);
      }

      const avatarCol = database.getFirstSync<{ count: number }>(
        "SELECT COUNT(*) as count FROM pragma_table_info('users') WHERE name = 'avatar'"
      );
      if (!avatarCol || avatarCol.count === 0) {
        database.execSync(`ALTER TABLE users ADD COLUMN avatar TEXT;`);
      }

      // 将旧默认预算100更新为30
      database.execSync(`UPDATE users SET monthly_budget = 30 WHERE monthly_budget = 100 OR monthly_budget IS NULL;`);

      // 初始化现有用户的 total_stars
      database.execSync(`
        UPDATE users SET total_stars = (
          SELECT COALESCE(SUM(stars), 0)
          FROM tasks
          WHERE completed = 1 AND (requires_parent_confirm = 0 OR parent_confirmed = 1)
        )
      `);

      // 清理旧任务并重新初始化（去重）
      database.execSync(`DELETE FROM tasks;`);

      database.execSync(`PRAGMA user_version = 2`);
      logger.info("Migration v1 -> v2 complete");
    }

    // v2 -> v3: 添加 user_id 数据隔离
    if (fromVersion < 3) {
      logger.info("Migrating v2 -> v3: Adding user_id isolation");

      const firstUserId = database.getFirstSync<{ id: number }>(
        "SELECT id FROM users ORDER BY id LIMIT 1"
      )?.id ?? null;

      if (firstUserId !== null) {
        // 为现有表添加 user_id 并归属给第一个用户
        database.execSync(`ALTER TABLE wishes ADD COLUMN user_id INTEGER;`);
        database.execSync(`UPDATE wishes SET user_id = ${firstUserId};`);

        database.execSync(`ALTER TABLE tasks ADD COLUMN user_id INTEGER;`);
        database.execSync(`UPDATE tasks SET user_id = ${firstUserId};`);

        database.execSync(`ALTER TABLE crisis_records ADD COLUMN user_id INTEGER;`);
        database.execSync(`UPDATE crisis_records SET user_id = ${firstUserId};`);

        // 重建月度预算表（添加 user_id，修改 UNIQUE）
        database.execSync(`
          CREATE TABLE monthly_budgets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            month TEXT NOT NULL,
            base_budget REAL NOT NULL DEFAULT 100,
            carried_over REAL NOT NULL DEFAULT 0,
            total_budget REAL NOT NULL,
            spent REAL NOT NULL DEFAULT 0,
            remaining REAL NOT NULL,
            UNIQUE(user_id, month)
          );
        `);
        database.execSync(`
          INSERT INTO monthly_budgets_new (id, user_id, month, base_budget, carried_over, total_budget, spent, remaining)
          SELECT id, ${firstUserId}, month, base_budget, carried_over, total_budget, spent, remaining FROM monthly_budgets;
        `);
        database.execSync(`DROP TABLE monthly_budgets;`);
        database.execSync(`ALTER TABLE monthly_budgets_new RENAME TO monthly_budgets;`);

        // 重建成就表（添加 user_id，修改 UNIQUE）
        database.execSync(`
          CREATE TABLE achievements_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            achievement_id TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            max_progress INTEGER NOT NULL,
            unlocked_at INTEGER,
            UNIQUE(user_id, achievement_id)
          );
        `);
        database.execSync(`
          INSERT INTO achievements_new (id, user_id, achievement_id, progress, max_progress, unlocked_at)
          SELECT id, ${firstUserId}, achievement_id, progress, max_progress, unlocked_at FROM achievements;
        `);
        database.execSync(`DROP TABLE achievements;`);
        database.execSync(`ALTER TABLE achievements_new RENAME TO achievements;`);
      }

      database.execSync(`PRAGMA user_version = 3`);
      logger.info("Migration v2 -> v3 complete");
    }
  });
}

export function seedAchievements(database: SQLite.SQLiteDatabase, userId: number) {
  const achievements = [
    { id: "cooling_master", maxProgress: 3 },
    { id: "saving_expert", maxProgress: 1 },
    { id: "spending_pro", maxProgress: 3 },
    { id: "delay_master", maxProgress: 5 },
    { id: "sharing_star", maxProgress: 1 },
    { id: "emotion_warrior", maxProgress: 1 },
  ];
  for (const a of achievements) {
    database.runSync(
      `INSERT OR IGNORE INTO achievements (user_id, achievement_id, max_progress) VALUES (?, ?, ?)`,
      [userId, a.id, a.maxProgress]
    );
  }
  logger.info("Seeded achievements", { count: achievements.length, userId });
}

export function seedDefaultTasks(database: SQLite.SQLiteDatabase, userId: number) {
  const currentTime = Math.floor(now() / 1000);
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;

  const tasks = [
    { title: "自己收拾玩具", type: "daily", stars: 1, completed: 0 },
    { title: "按时刷牙", type: "daily", stars: 1, completed: 0 },
    { title: "阅读20分钟", type: "daily", stars: 2, completed: 0 },
    { title: "帮忙做家务", type: "weekly", stars: 3, completed: 0, requires_parent_confirm: 1 },
    { title: "在商场不哭闹", type: "special", stars: 5, completed: 0, requires_parent_confirm: 1 },
  ];

  for (const t of tasks) {
    database.runSync(
      `INSERT INTO tasks (user_id, title, type, stars, completed, requires_parent_confirm, week_start) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, t.title, t.type, t.stars, t.completed, t.requires_parent_confirm || 0, weekStartStr]
    );
  }
  logger.info("Seeded default tasks", { count: tasks.length, userId });
}

// ============ 重置数据库（测试用） ============

export function resetDatabase() {
  const database = getDatabase();
  database.withTransactionSync(() => {
    database.execSync(`
      DELETE FROM users;
      DELETE FROM monthly_budgets;
      DELETE FROM wishes;
      DELETE FROM tasks;
      DELETE FROM achievements;
      DELETE FROM crisis_records;
    `);
    // 重置自增ID
    database.execSync(`
      DELETE FROM sqlite_sequence WHERE name IN ('users','monthly_budgets','wishes','tasks','achievements','crisis_records');
    `);
  });
  logger.info("Database reset complete");
}
