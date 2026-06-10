/**
 * 愿望服务
 */

import { getDatabase, type Wish } from "@/db/schema";
import { getTodayStr, getCoolingEndTime, getTodayStartTimestamp, now } from "@/utils/security";
import { getCurrentUserId } from "@/services/authService";
import { logger } from "@/logger";

export interface CreateWishInput {
  name: string;
  price: number;
  imagePath?: string;
}

function assertLoggedIn(): number {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("未登录");
  return userId;
}

function getLocalDateStr(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const WishService = {
  // 获取所有愿望
  getAllWishes(): Wish[] {
    const userId = assertLoggedIn();
    const db = getDatabase();
    return db.getAllSync<Wish>(
      "SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
  },

  // 按状态获取愿望
  getWishesByStatus(status: Wish["status"]): Wish[] {
    const userId = assertLoggedIn();
    const db = getDatabase();
    return db.getAllSync<Wish>(
      "SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE status = ? AND user_id = ? ORDER BY created_at DESC",
      [status, userId]
    );
  },

  // 创建愿望（进入冷静期，若预算不足直接设为 insufficient）
  createWish(input: CreateWishInput): Wish {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const coolingEndAt = getCoolingEndTime();

    // 检查当月预算
    const currentMonth = `${new Date(now()).getFullYear()}-${String(new Date(now()).getMonth() + 1).padStart(2, "0")}`;
    const budget = db.getFirstSync<{ remaining: number }>(
      "SELECT remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [currentMonth, userId]
    );
    const status = budget && budget.remaining >= input.price ? "cooling" : "insufficient";

    const result = db.runSync(
      `INSERT INTO wishes (user_id, name, image_path, price, cooling_end_at, status, daily_confirmations)
       VALUES (?, ?, ?, ?, ?, ?, '[]')`,
      [userId, input.name, input.imagePath ?? null, input.price, coolingEndAt, status]
    );

    const id = result.lastInsertRowId;
    const wish = db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ? AND user_id = ?", [id, userId]);
    if (!wish) throw new Error("创建愿望失败");

    logger.info("Wish created", { id, name: input.name, price: input.price, status });
    return wish;
  },

  // 预算不足时恢复为冷静期（预算够了再试）
  restoreWishToCooling(id: number): { restored: boolean; message: string } {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const wish = db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ? AND user_id = ?", [id, userId]);
    if (!wish || wish.status !== "insufficient") {
      throw new Error("愿望不在预算不足状态");
    }

    const currentMonth = `${new Date(now()).getFullYear()}-${String(new Date(now()).getMonth() + 1).padStart(2, "0")}`;
    const budget = db.getFirstSync<{ remaining: number }>(
      "SELECT remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [currentMonth, userId]
    );

    if (!budget || budget.remaining < wish.price) {
      return { restored: false, message: "预算还是不够哦，再等一等吧~ 下个月可能会有惊喜！" };
    }

    // 恢复为 cooling，重新计算7天冷静期
    const newCoolingEndAt = getCoolingEndTime();
    db.runSync(
      "UPDATE wishes SET status = 'cooling', cooling_end_at = ?, daily_confirmations = '[]' WHERE id = ? AND user_id = ?",
      [newCoolingEndAt, id, userId]
    );

    logger.info("Wish restored to cooling", { id, name: wish.name });
    return { restored: true, message: `太棒了！预算够了，${wish.name} 开始7天冷静期吧~` };
  },

  // 每日确认（"我还想要"）
  confirmWish(id: number): { confirmed: boolean; alreadyConfirmed: boolean; remainingDays: number; totalConfirmations: number } {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const wish = db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ? AND user_id = ?", [id, userId]);
    if (!wish || wish.status !== "cooling") {
      throw new Error("愿望不在冷静期");
    }

    const confirmations: string[] = JSON.parse(wish.dailyConfirmations || "[]");
    const today = getTodayStr();

    if (confirmations.includes(today)) {
      const remainingDays = Math.max(
        0,
        Math.ceil((wish.coolingEndAt * 1000 - now()) / (1000 * 60 * 60 * 24))
      );
      return { confirmed: true, alreadyConfirmed: true, remainingDays, totalConfirmations: confirmations.length };
    }

    confirmations.push(today);
    db.runSync(
      "UPDATE wishes SET daily_confirmations = ? WHERE id = ? AND user_id = ?",
      [JSON.stringify(confirmations), id, userId]
    );

    const remainingDays = Math.max(
      0,
      Math.ceil((wish.coolingEndAt * 1000 - now()) / (1000 * 60 * 60 * 24))
    );
    logger.info("Wish confirmed", { id, day: confirmations.length, remainingDays });
    return { confirmed: true, alreadyConfirmed: false, remainingDays, totalConfirmations: confirmations.length };
  },

  // 取消愿望（"不想要了"）
  cancelWish(id: number): void {
    const userId = assertLoggedIn();
    const db = getDatabase();
    // 把 cooling_end_at 更新为当前时间，作为取消时间记录
    db.runSync(
      "UPDATE wishes SET status = 'cancelled', cooling_end_at = ? WHERE id = ? AND user_id = ?",
      [Math.floor(now() / 1000), id, userId]
    );
    logger.info("Wish cancelled", { id });
  },

  // 处理冷静期到期（核心逻辑）
  processCoolingWishes(): Array<{ id: number; name: string; status: string; message?: string }> {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const currentTime = Math.floor(now() / 1000);
    const results: Array<{ id: number; name: string; status: string; message?: string }> = [];

    const coolingWishes = db.getAllSync<Wish>(
      "SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE status = 'cooling' AND cooling_end_at <= ? AND user_id = ?",
      [currentTime, userId]
    );

    for (const wish of coolingWishes) {
      const confirmations: string[] = JSON.parse(wish.dailyConfirmations || "[]");

      // 计算冷静期最后一天日期 = coolingEndAt 前一天（本地时区）
      const lastDayStr = getLocalDateStr(wish.coolingEndAt - 24 * 60 * 60);

      // 第7天必须确认，否则视为放弃
      if (confirmations.length === 0 || !confirmations.includes(lastDayStr)) {
        db.runSync("UPDATE wishes SET status = 'expired' WHERE id = ? AND user_id = ?", [wish.id, userId]);
        results.push({
          id: wish.id,
          name: wish.name,
          status: "expired",
          message: "冷静期最后一天未确认，视为放弃",
        });
        logger.info("Wish expired (not confirmed on last day)", { id: wish.id, name: wish.name });
      } else {
        // 第7天已确认，进入购买判断
        db.runSync("UPDATE wishes SET status = 'wanted' WHERE id = ? AND user_id = ?", [wish.id, userId]);

        // 检查预算
        const _now = new Date(now());
        const currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
        const budget = db.getFirstSync<{ remaining: number }>(
          "SELECT remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
          [currentMonth, userId]
        );

        if (budget && budget.remaining >= wish.price) {
          // 预算充足，自动购买
          const newRemaining = budget.remaining - wish.price;
          db.runSync(
            "UPDATE monthly_budgets SET spent = spent + ?, remaining = ? WHERE month = ? AND user_id = ?",
            [wish.price, newRemaining, currentMonth, userId]
          );
          db.runSync(
            "UPDATE wishes SET status = 'purchased', purchased_month = ? WHERE id = ? AND user_id = ?",
            [currentMonth, wish.id, userId]
          );
          results.push({
            id: wish.id,
            name: wish.name,
            status: "purchased",
            message: "你的等待值得！已自动购买",
          });
          logger.info("Wish purchased", { id: wish.id, name: wish.name, price: wish.price });
        } else {
          // 预算不足
          db.runSync("UPDATE wishes SET status = 'insufficient' WHERE id = ? AND user_id = ?", [wish.id, userId]);
          results.push({
            id: wish.id,
            name: wish.name,
            status: "insufficient",
            message: `预算还差￥${(wish.price - (budget?.remaining ?? 0)).toFixed(2)}，下月再来吧`,
          });
          logger.info("Wish insufficient budget", { id: wish.id, name: wish.name });
        }
      }
    }

    return results;
  },

  // 手动触发单个愿望的购买判断（只处理当前点击的愿望，不影响其他）
  purchaseSingleWish(id: number): { status: string; message: string } {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const wish = db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ? AND user_id = ?", [id, userId]);
    if (!wish || wish.status !== "cooling") {
      throw new Error("愿望不在冷静期");
    }

    // 检查预算
    const _now = new Date(now());
    const currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}`;
    const budget = db.getFirstSync<{ remaining: number }>(
      "SELECT remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [currentMonth, userId]
    );

    if (budget && budget.remaining >= wish.price) {
      // 预算充足，购买
      const newRemaining = budget.remaining - wish.price;
      db.runSync(
        "UPDATE monthly_budgets SET spent = spent + ?, remaining = ? WHERE month = ? AND user_id = ?",
        [wish.price, newRemaining, currentMonth, userId]
      );
      db.runSync(
        "UPDATE wishes SET status = 'purchased', purchased_month = ? WHERE id = ? AND user_id = ?",
        [currentMonth, wish.id, userId]
      );
      logger.info("Wish purchased (manual)", { id: wish.id, name: wish.name, price: wish.price });
      return { status: "purchased", message: `太棒了！${wish.name} 已购买！` };
    } else {
      // 预算不足
      db.runSync("UPDATE wishes SET status = 'insufficient' WHERE id = ? AND user_id = ?", [wish.id, userId]);
      logger.info("Wish insufficient budget (manual)", { id: wish.id, name: wish.name });
      return { status: "insufficient", message: `${wish.name} 预算不够，下月再来吧~` };
    }
  },

  // 获取愿望（by ID）
  getWishById(id: number): Wish | null {
    const userId = assertLoggedIn();
    const db = getDatabase();
    return db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ? AND user_id = ?", [id, userId]) ?? null;
  },
};
