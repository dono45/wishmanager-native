import { now } from "@/utils/security";
/**
 * 急救包服务
 */

import { getDatabase, type CrisisRecord } from "@/db/schema";
import { getCurrentUserId } from "@/services/authService";
import { logger } from "@/logger";

export interface CreateCrisisInput {
  location?: string;
  strategy?: string;
  outcome: "success" | "partial" | "escalated";
  duration?: number;
  childReaction?: string;
}

function assertLoggedIn(): number {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("未登录");
  return userId;
}

export const CrisisService = {
  // 获取所有记录
  getAllRecords(): CrisisRecord[] {
    const userId = assertLoggedIn();
    const db = getDatabase();
    return db.getAllSync<CrisisRecord>(
      "SELECT id, location, started_at as startedAt, resolved_at as resolvedAt, duration, strategy, outcome, child_reaction as childReaction FROM crisis_records WHERE user_id = ? ORDER BY started_at DESC",
      [userId]
    );
  },

  // 创建记录
  createRecord(input: CreateCrisisInput): CrisisRecord {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const currentTime = Math.floor(now() / 1000);
    const result = db.runSync(
      `INSERT INTO crisis_records (user_id, location, strategy, outcome, duration, child_reaction, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        input.location ?? null,
        input.strategy ?? null,
        input.outcome,
        input.duration ?? null,
        input.childReaction ?? null,
        currentTime,
      ]
    );

    const record = db.getFirstSync<CrisisRecord>(
      "SELECT id, location, started_at as startedAt, resolved_at as resolvedAt, duration, strategy, outcome, child_reaction as childReaction FROM crisis_records WHERE id = ? AND user_id = ?",
      [result.lastInsertRowId, userId]
    );
    if (!record) throw new Error("创建记录失败");
    logger.info("Crisis record created", { id: record.id });
    return record;
  },
};
