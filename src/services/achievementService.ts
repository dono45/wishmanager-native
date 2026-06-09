import { now } from "@/utils/security";
/**
 * 成就服务
 */

import { getDatabase, type Achievement } from "@/db/schema";
import { ACHIEVEMENT_DEFS } from "@/data/achievements";
import { logger } from "@/logger";

export interface AchievementWithMeta extends Achievement {
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export const AchievementService = {
  // 获取所有成就
  getAllAchievements(): AchievementWithMeta[] {
    const db = getDatabase();
    const rows = db.getAllSync<Achievement>("SELECT id, achievement_id as achievementId, progress, max_progress as maxProgress, unlocked_at as unlockedAt FROM achievements");

    return rows.map((row) => {
      const def = ACHIEVEMENT_DEFS[row.achievementId];
      return {
        ...row,
        name: def?.name ?? row.achievementId,
        description: def?.description ?? "",
        icon: def?.icon ?? "trophy",
        unlocked: row.unlockedAt !== null && row.unlockedAt !== undefined,
      };
    });
  },

  // 增加成就进度
  incrementProgress(achievementId: string, amount: number = 1): void {
    const db = getDatabase();
    const ach = db.getFirstSync<Achievement>(
      "SELECT id, achievement_id as achievementId, progress, max_progress as maxProgress, unlocked_at as unlockedAt FROM achievements WHERE achievement_id = ?",
      [achievementId]
    );
    if (!ach) return;
    if (ach.unlockedAt) return; // 已解锁

    const newProgress = Math.min(ach.progress + amount, ach.maxProgress);
    if (newProgress >= ach.maxProgress) {
      // 解锁成就
      db.runSync(
        "UPDATE achievements SET progress = ?, unlocked_at = ? WHERE achievement_id = ?",
        [newProgress, Math.floor(now() / 1000), achievementId]
      );
      logger.info("Achievement unlocked!", { achievementId, name: ACHIEVEMENT_DEFS[achievementId]?.name });
    } else {
      db.runSync(
        "UPDATE achievements SET progress = ? WHERE achievement_id = ?",
        [newProgress, achievementId]
      );
    }
  },

  // 检查储蓄成就
  checkSavingAchievement(remainingPercent: number): void {
    if (remainingPercent > 30) {
      this.incrementProgress("saving_expert", 1);
    }
  },

  // 检查冷静期成就
  checkCoolingAchievement(): void {
    this.incrementProgress("cooling_master", 1);
  },
};
