import { now } from "@/utils/security";
/**
 * 急救包服务
 */

import { getDatabase, type CrisisRecord } from "@/db/schema";
import { logger } from "@/logger";

export interface CreateCrisisInput {
  location?: string;
  strategy?: string;
  outcome: "success" | "partial" | "escalated";
  duration?: number;
  childReaction?: string;
}

export const CrisisService = {
  // 获取所有记录
  getAllRecords(): CrisisRecord[] {
    const db = getDatabase();
    return db.getAllSync<CrisisRecord>(
      "SELECT id, location, started_at as startedAt, resolved_at as resolvedAt, duration, strategy, outcome, child_reaction as childReaction FROM crisis_records ORDER BY started_at DESC"
    );
  },

  // 创建记录
  createRecord(input: CreateCrisisInput): CrisisRecord {
    const db = getDatabase();
    const currentTime = Math.floor(now() / 1000);
    const result = db.runSync(
      `INSERT INTO crisis_records (location, strategy, outcome, duration, child_reaction, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.location ?? null,
        input.strategy ?? null,
        input.outcome,
        input.duration ?? null,
        input.childReaction ?? null,
        currentTime,
      ]
    );

    const record = db.getFirstSync<CrisisRecord>(
      "SELECT id, location, started_at as startedAt, resolved_at as resolvedAt, duration, strategy, outcome, child_reaction as childReaction FROM crisis_records WHERE id = ?",
      [result.lastInsertRowId]
    );
    if (!record) throw new Error("创建记录失败");
    logger.info("Crisis record created", { id: record.id });
    return record;
  },
};
