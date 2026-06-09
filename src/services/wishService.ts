/**
 * 愿望服务
 */

import { getDatabase, type Wish } from "@/db/schema";
import { getTodayStr, getCoolingEndTime, getTodayStartTimestamp, now } from "@/utils/security";
import { logger } from "@/logger";

export interface CreateWishInput {
  name: string;
  price: number;
  imagePath?: string;
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
    const db = getDatabase();
    return db.getAllSync<Wish>(
      "SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes ORDER BY created_at DESC"
    );
  },

  // 按状态获取愿望
  getWishesByStatus(status: Wish["status"]): Wish[] {
    const db = getDatabase();
    return db.getAllSync<Wish>(
      "SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE status = ? ORDER BY created_at DESC",
      [status]
    );
  },

  // 创建愿望（进入冷静期）
  createWish(input: CreateWishInput): Wish {
    const db = getDatabase();
    const coolingEndAt = getCoolingEndTime();

    const result = db.runSync(
      `INSERT INTO wishes (name, image_path, price, cooling_end_at, status, daily_confirmations)
       VALUES (?, ?, ?, ?, 'cooling', '[]')`,
      [input.name, input.imagePath ?? null, input.price, coolingEndAt]
    );

    const id = result.lastInsertRowId;
    const wish = db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ?", [id]);
    if (!wish) throw new Error("创建愿望失败");

    logger.info("Wish created", { id, name: input.name, price: input.price });
    return wish;
  },

  // 每日确认（"我还想要"）
  confirmWish(id: number): { confirmed: boolean; alreadyConfirmed: boolean; remainingDays: number } {
    const db = getDatabase();
    const wish = db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ?", [id]);
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
      return { confirmed: true, alreadyConfirmed: true, remainingDays };
    }

    confirmations.push(today);
    db.runSync(
      "UPDATE wishes SET daily_confirmations = ? WHERE id = ?",
      [JSON.stringify(confirmations), id]
    );

    const remainingDays = Math.max(
      0,
      Math.ceil((wish.coolingEndAt * 1000 - now()) / (1000 * 60 * 60 * 24))
    );
    logger.info("Wish confirmed", { id, day: confirmations.length, remainingDays });
    return { confirmed: true, alreadyConfirmed: false, remainingDays };
  },

  // 取消愿望（"不想要了"）
  cancelWish(id: number): void {
    const db = getDatabase();
    db.runSync(
      "UPDATE wishes SET status = 'cancelled' WHERE id = ?",
      [id]
    );
    logger.info("Wish cancelled", { id });
  },

  // 处理冷静期到期（核心逻辑）
  processCoolingWishes(): Array<{ id: number; name: string; status: string; message?: string }> {
    const db = getDatabase();
    const currentTime = Math.floor(now() / 1000);
    const results: Array<{ id: number; name: string; status: string; message?: string }> = [];

    const coolingWishes = db.getAllSync<Wish>(
      "SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE status = 'cooling' AND cooling_end_at <= ?",
      [currentTime]
    );

    for (const wish of coolingWishes) {
      const confirmations: string[] = JSON.parse(wish.dailyConfirmations || "[]");

      // 计算冷静期最后一天日期 = coolingEndAt 前一天（本地时区）
      const lastDayStr = getLocalDateStr(wish.coolingEndAt - 24 * 60 * 60);

      // 第7天必须确认，否则视为放弃
      if (confirmations.length === 0 || !confirmations.includes(lastDayStr)) {
        db.runSync("UPDATE wishes SET status = 'expired' WHERE id = ?", [wish.id]);
        results.push({
          id: wish.id,
          name: wish.name,
          status: "expired",
          message: "冷静期最后一天未确认，视为放弃",
        });
        logger.info("Wish expired (not confirmed on last day)", { id: wish.id, name: wish.name });
      } else {
        // 第7天已确认，进入购买判断
        db.runSync("UPDATE wishes SET status = 'wanted' WHERE id = ?", [wish.id]);

        // 检查预算
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const budget = db.getFirstSync<{ remaining: number }>(
          "SELECT remaining FROM monthly_budgets WHERE month = ?",
          [currentMonth]
        );

        if (budget && budget.remaining >= wish.price) {
          // 预算充足，自动购买
          const newRemaining = budget.remaining - wish.price;
          db.runSync(
            "UPDATE monthly_budgets SET spent = spent + ?, remaining = ? WHERE month = ?",
            [wish.price, newRemaining, currentMonth]
          );
          db.runSync(
            "UPDATE wishes SET status = 'purchased', purchased_month = ? WHERE id = ?",
            [currentMonth, wish.id]
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
          db.runSync("UPDATE wishes SET status = 'insufficient' WHERE id = ?", [wish.id]);
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

  // 获取愿望（by ID）
  getWishById(id: number): Wish | null {
    const db = getDatabase();
    return db.getFirstSync<Wish>("SELECT id, name, image_path as imagePath, price, created_at as createdAt, cooling_end_at as coolingEndAt, status, purchased_month as purchasedMonth, daily_confirmations as dailyConfirmations, child_notes as childNotes FROM wishes WHERE id = ?", [id]) ?? null;
  },
};
