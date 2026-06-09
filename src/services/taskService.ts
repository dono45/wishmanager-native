/**
 * 任务服务
 */

import { getDatabase, type Task } from "@/db/schema";
import { getTodayStartTimestamp, now } from "@/utils/security";
import { logger } from "@/logger";

export const TaskService = {
  // 获取所有任务
  getAllTasks(): Task[] {
    const db = getDatabase();
    return db.getAllSync<Task>("SELECT id, title, type, stars, completed, completed_at as completedAt, requires_parent_confirm as requiresParentConfirm, parent_confirmed as parentConfirmed, created_at as createdAt, week_start as weekStart FROM tasks ORDER BY created_at DESC");
  },

  // 加载任务并自动重置每日任务
  loadTasksWithReset(): { tasks: Task[]; totalStars: number } {
    const db = getDatabase();
    const todayStart = getTodayStartTimestamp();

    // 重置昨日及之前完成的每日任务
    db.runSync(
      `UPDATE tasks SET completed = 0, completed_at = NULL, parent_confirmed = 0
       WHERE type = 'daily' AND completed = 1 AND (completed_at IS NULL OR completed_at < ?)`,
      [todayStart]
    );

    const tasks = this.getAllTasks();
    const totalStars = this.getStarCount().totalStars;
    return { tasks, totalStars };
  },

  // 完成任务
  completeTask(id: number): Task {
    const db = getDatabase();
    const task = db.getFirstSync<Task>("SELECT id, title, type, stars, completed, completed_at as completedAt, requires_parent_confirm as requiresParentConfirm, parent_confirmed as parentConfirmed, created_at as createdAt, week_start as weekStart FROM tasks WHERE id = ?", [id]);
    if (!task) throw new Error("任务不存在");
    if (task.completed === 1) throw new Error("任务已完成");

    const currentTime = Math.floor(now() / 1000);
    db.runSync(
      `UPDATE tasks SET completed = 1, completed_at = ?, parent_confirmed = CASE WHEN requires_parent_confirm = 1 THEN 0 ELSE 1 END
       WHERE id = ?`,
      [currentTime, id]
    );

    // 累计星星到用户总星星数
    const user = db.getFirstSync<{ id: number }>("SELECT id FROM users LIMIT 1");
    if (user) {
      db.runSync(
        "UPDATE users SET total_stars = COALESCE(total_stars, 0) + ? WHERE id = ?",
        [task.stars, user.id]
      );
    }

    const updatedTask = db.getFirstSync<Task>("SELECT id, title, type, stars, completed, completed_at as completedAt, requires_parent_confirm as requiresParentConfirm, parent_confirmed as parentConfirmed, created_at as createdAt, week_start as weekStart FROM tasks WHERE id = ?", [id]);
    if (!updatedTask) throw new Error("任务不存在");
    logger.info("Task completed", { id });
    return updatedTask;
  },

  // 家长确认任务
  parentConfirmTask(id: number): void {
    const db = getDatabase();
    db.runSync(
      "UPDATE tasks SET parent_confirmed = 1 WHERE id = ?",
      [id]
    );
    logger.info("Task parent confirmed", { id });
  },

  // 获取星星总数（从用户表读取累计值）
  getStarCount(): { totalStars: number } {
    const db = getDatabase();
    const row = db.getFirstSync<{ total_stars: number }>(
      "SELECT COALESCE(total_stars, 0) as total_stars FROM users LIMIT 1"
    );
    return { totalStars: row?.total_stars ?? 0 };
  },
};
