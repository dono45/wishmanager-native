/**
 * 预算服务
 */

import { getDatabase, type MonthlyBudget } from "@/db/schema";
import { getCurrentMonth } from "@/utils/security";
import { getCurrentUserId } from "@/services/authService";
import { logger } from "@/logger";

export interface BudgetWithPurchases extends MonthlyBudget {
  purchasedItems: Array<{
    id: number;
    name: string;
    price: number;
    imagePath: string | null;
  }>;
}

function assertLoggedIn(): number {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("未登录");
  return userId;
}

export const BudgetService = {
  // 获取当前月预算
  getCurrentBudget(): BudgetWithPurchases | null {
    const month = getCurrentMonth();
    return this.getBudgetByMonth(month);
  },

  // 获取指定月预算
  getBudgetByMonth(month: string): BudgetWithPurchases | null {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const budget = db.getFirstSync<MonthlyBudget>(
      "SELECT id, month, base_budget as baseBudget, carried_over as carriedOver, total_budget as totalBudget, spent, remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [month, userId]
    );
    if (!budget) return null;

    // 获取该月已购买物品
    const purchasedItems = db.getAllSync<{
      id: number;
      name: string;
      price: number;
      image_path: string | null;
    }>(
      "SELECT id, name, price, image_path FROM wishes WHERE status = 'purchased' AND purchased_month = ? AND user_id = ?",
      [month, userId]
    );

    return {
      ...budget,
      purchasedItems: purchasedItems.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        imagePath: p.image_path,
      })),
    };
  },

  // 获取历史预算
  getHistory(): MonthlyBudget[] {
    const userId = assertLoggedIn();
    const db = getDatabase();
    return db.getAllSync<MonthlyBudget>(
      "SELECT id, month, base_budget as baseBudget, carried_over as carriedOver, total_budget as totalBudget, spent, remaining FROM monthly_budgets WHERE user_id = ? ORDER BY month DESC",
      [userId]
    );
  },

  // 生成本月预算（如果不存在则创建）
  generateMonthBudget(): MonthlyBudget {
    const userId = assertLoggedIn();
    const db = getDatabase();
    const month = getCurrentMonth();

    // 检查是否已存在
    const existing = db.getFirstSync<MonthlyBudget>(
      "SELECT id, month, base_budget as baseBudget, carried_over as carriedOver, total_budget as totalBudget, spent, remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [month, userId]
    );
    if (existing) return existing;

    // 获取用户设定的基础预算
    const userRow = db.getFirstSync<{ monthly_budget: number }>(
      "SELECT monthly_budget FROM users WHERE id = ?",
      [userId]
    );
    const baseBudget = userRow?.monthly_budget ?? 30;

    // 计算上月滚存（含超支扣除）
    const lastMonth = this.getPrevMonth(month);
    const lastBudget = db.getFirstSync<MonthlyBudget>(
      "SELECT id, month, base_budget as baseBudget, carried_over as carriedOver, total_budget as totalBudget, spent, remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [lastMonth, userId]
    );
    const carriedOver = lastBudget ? lastBudget.remaining : 0;
    const totalBudget = Math.max(0, baseBudget + carriedOver);

    db.runSync(
      `INSERT INTO monthly_budgets (user_id, month, base_budget, carried_over, total_budget, remaining)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, month, baseBudget, carriedOver, totalBudget, totalBudget]
    );

    const budget = db.getFirstSync<MonthlyBudget>(
      "SELECT id, month, base_budget as baseBudget, carried_over as carriedOver, total_budget as totalBudget, spent, remaining FROM monthly_budgets WHERE month = ? AND user_id = ?",
      [month, userId]
    );
    if (!budget) throw new Error("生成预算失败");

    logger.info("Month budget generated", { month, baseBudget, carriedOver, totalBudget });
    return budget;
  },

  // 获取上一个月
  getPrevMonth(month: string): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },

  // 获取下一个月
  getNextMonth(month: string): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },
};
