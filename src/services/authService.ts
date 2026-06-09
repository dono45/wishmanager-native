/**
 * 认证服务
 */

import { getDatabase, type User } from "@/db/schema";
import { hashPassword, verifyPassword, now } from "@/utils/security";
import * as SecureStore from "expo-secure-store";
import { logger } from "@/logger";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

export interface RegisterInput {
  username: string;
  password: string;
  parentPassword: string;
}

export interface LoginResult {
  user: Omit<User, "passwordHash" | "parentPasswordHash">;
}

function dbRowToUser(row: any): LoginResult["user"] {
  return {
    id: row.id,
    username: row.username,
    monthlyBudget: row.monthly_budget ?? 30,
    newBudgetEffectiveMonth: row.new_budget_effective_month ?? null,
    createdAt: row.created_at,
    totalStars: row.total_stars ?? 0,
    avatar: row.avatar ?? null,
  };
}

export const AuthService = {
  // 注册
  async register(input: RegisterInput): Promise<LoginResult> {
    const db = getDatabase();
    logger.info("Registering user", { username: input.username });

    // 检查用户名是否已存在
    const existing = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE username = ?",
      [input.username]
    );
    if (existing && existing.count > 0) {
      throw new Error("用户名已存在");
    }

    const passwordHash = await hashPassword(input.password);
    const parentPasswordHash = await hashPassword(input.parentPassword);

    const result = db.runSync(
      `INSERT INTO users (username, password_hash, parent_password_hash, monthly_budget, total_stars)
       VALUES (?, ?, ?, ?, ?)`,
      [input.username, passwordHash, parentPasswordHash, 30, 0]
    );

    const userId = result.lastInsertRowId;
    const user: LoginResult["user"] = {
      id: Number(userId),
      username: input.username,
      monthlyBudget: 30,
      newBudgetEffectiveMonth: null,
      createdAt: Math.floor(now() / 1000),
      totalStars: 0,
      avatar: null,
    };

    // 保存登录状态
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));

    logger.info("User registered", { userId: user.id });
    return { user };
  },

  // 登录
  async login(username: string, password: string): Promise<LoginResult> {
    const db = getDatabase();
    logger.info("Logging in", { username });

    const row = db.getFirstSync<User>(
      "SELECT id, username, password_hash as passwordHash, parent_password_hash as parentPasswordHash, monthly_budget as monthlyBudget, new_budget_effective_month as newBudgetEffectiveMonth, total_stars as totalStars, avatar, created_at as createdAt FROM users WHERE username = ?",
      [username]
    );
    if (!row) {
      throw new Error("用户名或密码错误");
    }

    const valid = await verifyPassword(password, row.passwordHash);
    if (!valid) {
      throw new Error("用户名或密码错误");
    }

    const user = dbRowToUser(row);
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));
    logger.info("User logged in", { userId: user.id });
    return { user };
  },

  // 验证家长密码
  async verifyParentPassword(parentPassword: string): Promise<boolean> {
    const db = getDatabase();
    const user = await this.getCurrentUser();
    if (!user) return false;

    const row = db.getFirstSync<{ parent_password_hash: string }>(
      "SELECT parent_password_hash FROM users WHERE id = ?",
      [user.id]
    );
    if (!row) return false;

    return verifyPassword(parentPassword, row.parent_password_hash);
  },

  // 获取当前登录用户
  async getCurrentUser(): Promise<LoginResult["user"] | null> {
    try {
      const json = await SecureStore.getItemAsync(AUTH_USER_KEY);
      if (!json) return null;
      const parsed = JSON.parse(json);
      return {
        ...parsed,
        totalStars: parsed.totalStars ?? 0,
        avatar: parsed.avatar ?? null,
      };
    } catch {
      return null;
    }
  },

  // 退出登录
  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(AUTH_USER_KEY);
    logger.info("User logged out");
  },

  // 修改登录密码
  async updatePassword(
    parentPassword: string,
    newPassword: string
  ): Promise<void> {
    const valid = await this.verifyParentPassword(parentPassword);
    if (!valid) throw new Error("家长密码错误");

    const user = await this.getCurrentUser();
    if (!user) throw new Error("未登录");

    const hash = await hashPassword(newPassword);
    const db = getDatabase();
    db.runSync("UPDATE users SET password_hash = ? WHERE id = ?", [
      hash,
      user.id,
    ]);
    logger.info("Password updated", { userId: user.id });
  },

  // 修改家长密码
  async updateParentPassword(
    oldParentPassword: string,
    newParentPassword: string
  ): Promise<void> {
    const db = getDatabase();
    const user = await this.getCurrentUser();
    if (!user) throw new Error("未登录");

    const row = db.getFirstSync<{ parent_password_hash: string }>(
      "SELECT parent_password_hash FROM users WHERE id = ?",
      [user.id]
    );
    if (!row) throw new Error("用户不存在");

    const valid = await verifyPassword(
      oldParentPassword,
      row.parent_password_hash
    );
    if (!valid) throw new Error("原家长密码错误");

    const hash = await hashPassword(newParentPassword);
    db.runSync("UPDATE users SET parent_password_hash = ? WHERE id = ?", [
      hash,
      user.id,
    ]);
    logger.info("Parent password updated", { userId: user.id });
  },

  // 获取预算设定
  async getBudget(): Promise<{
    monthlyBudget: number;
    newBudgetEffectiveMonth: string | null;
  }> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("未登录");

    const db = getDatabase();
    const row = db.getFirstSync<{
      monthly_budget: number;
      new_budget_effective_month: string | null;
    }>("SELECT monthly_budget, new_budget_effective_month FROM users WHERE id = ?", [
      user.id,
    ]);

    return {
      monthlyBudget: row?.monthly_budget ?? 30,
      newBudgetEffectiveMonth: row?.new_budget_effective_month ?? null,
    };
  },

  // 设置预算
  async setBudget(monthlyBudget: number): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("未登录");

    const db = getDatabase();
    // 新预算下月生效
    const now = new Date();
    const nextMonth = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`;

    db.runSync(
      "UPDATE users SET monthly_budget = ?, new_budget_effective_month = ? WHERE id = ?",
      [monthlyBudget, nextMonth, user.id]
    );

    // 更新内存中的用户数据
    const updated = { ...user, monthlyBudget, newBudgetEffectiveMonth: nextMonth };
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(updated));

    logger.info("Budget set", { userId: user.id, monthlyBudget, effectiveMonth: nextMonth });
  },

  // 更新用户资料（用户名/头像）
  async updateProfile(updates: { username?: string; avatar?: string }): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("未登录");

    const db = getDatabase();

    if (updates.username !== undefined) {
      // 检查新用户名是否已被其他用户使用
      const existing = db.getFirstSync<{ count: number }>(
        "SELECT COUNT(*) as count FROM users WHERE username = ? AND id != ?",
        [updates.username, user.id]
      );
      if (existing && existing.count > 0) {
        throw new Error("用户名已存在");
      }
      db.runSync("UPDATE users SET username = ? WHERE id = ?", [updates.username, user.id]);
    }

    if (updates.avatar !== undefined) {
      db.runSync("UPDATE users SET avatar = ? WHERE id = ?", [updates.avatar, user.id]);
    }

    // 更新 SecureStore
    const updated = { ...user, ...updates };
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(updated));
    logger.info("Profile updated", { userId: user.id, updates });
  },
};
