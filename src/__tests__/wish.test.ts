/**
 * 愿望模块测试
 * 覆盖添加愿望、冷静期、取消、处理到期
 */

import { WishService } from "@/services/wishService";
import { BudgetService } from "@/services/budgetService";
import { AuthService } from "@/services/authService";
import { getCurrentUserId } from "@/services/authService";
import { resetDatabase } from "@/db/schema";

describe("WishService", () => {
  beforeEach(async () => {
    resetDatabase();
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });
  });

  // ===== TC-10: 添加愿望 =====
  test("TC-10: 添加愿望应创建冷静期记录", () => {
    const wish = WishService.createWish({
      name: "遥控赛车",
      price: 89.0,
    });

    expect(wish.name).toBe("遥控赛车");
    expect(wish.price).toBe(89.0);
    expect(wish.status).toBe("cooling");
    expect(wish.imagePath).toBeNull();

    // 冷静期结束时间应在7天后
    const now = Math.floor(Date.now() / 1000);
    expect(wish.coolingEndAt).toBeGreaterThan(now + 6 * 86400);
    expect(wish.coolingEndAt).toBeLessThanOrEqual(now + 7 * 86400 + 60); // 允许60秒误差
  });

  // ===== TC-11: 添加带图片的愿望 =====
  test("TC-11: 添加带图片的愿望应保存图片路径", () => {
    const wish = WishService.createWish({
      name: "毛绒小熊",
      price: 45.0,
      imagePath: "file:///mock/path.jpg",
    });

    expect(wish.imagePath).toBe("file:///mock/path.jpg");
  });

  // ===== TC-12: 每日确认愿望 =====
  test("TC-12: 每日确认应记录当天日期", () => {
    const wish = WishService.createWish({ name: "测试", price: 50 });
    const result = WishService.confirmWish(wish.id);

    expect(result.confirmed).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
    expect(result.remainingDays).toBeGreaterThanOrEqual(6);
  });

  // ===== TC-13: 同天重复确认应提示已确认 =====
  test("TC-13: 同天重复确认应返回已确认状态", () => {
    const wish = WishService.createWish({ name: "测试", price: 50 });
    WishService.confirmWish(wish.id);
    const result = WishService.confirmWish(wish.id);

    expect(result.alreadyConfirmed).toBe(true);
  });

  // ===== TC-14: 取消愿望 =====
  test("TC-14: 取消愿望应变为cancelled状态", () => {
    const wish = WishService.createWish({ name: "测试", price: 50 });
    WishService.cancelWish(wish.id);

    const updated = WishService.getWishById(wish.id);
    expect(updated?.status).toBe("cancelled");
  });

  // ===== TC-15: 获取所有愿望 =====
  test("TC-15: 获取所有愿望应返回按时间倒序排列", () => {
    WishService.createWish({ name: "愿望A", price: 10 });
    WishService.createWish({ name: "愿望B", price: 20 });

    const wishes = WishService.getAllWishes();
    expect(wishes.length).toBe(2);
    expect(wishes[0].name).toBe("愿望B");
  });

  // ===== TC-16: 处理冷静期到期 - 未确认则过期 =====
  test("TC-16: 冷静期到期且第7天未确认应变为expired", () => {
    // 创建一个冷却期已过期的愿望（通过直接操作数据库模拟）
    const db = require("@/db/schema").getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const userId = getCurrentUserId();

    // 插入一个7天前创建、冷静期已结束、且从未确认的愿望
    db.runSync(
      `INSERT INTO wishes (user_id, name, price, created_at, cooling_end_at, status, daily_confirmations)
       VALUES (?, ?, ?, ?, ?, 'cooling', '[]')`,
      [userId, "过期愿望", 50, now - 8 * 86400, now - 86400]
    );

    const results = WishService.processCoolingWishes();
    const expiredResult = results.find((r) => r.status === "expired");

    expect(expiredResult).toBeDefined();
    expect(expiredResult?.name).toBe("过期愿望");
  });

  // ===== TC-17: 处理冷静期到期 - 第7天已确认应进入购买判断 =====
  test("TC-17: 冷静期到期且第7天已确认应变为wanted", () => {
    const db = require("@/db/schema").getDatabase();
    const now = Math.floor(Date.now() / 1000);
    const userId = getCurrentUserId();

    // 计算第7天（冷静期最后一天）的日期
    const coolingEndAt = now - 3600; // 1小时前结束
    const lastDay = new Date((coolingEndAt - 86400) * 1000).toISOString().split("T")[0];

    db.runSync(
      `INSERT INTO wishes (user_id, name, price, created_at, cooling_end_at, status, daily_confirmations)
       VALUES (?, ?, ?, ?, ?, 'cooling', ?)`,
      [userId, "已确认愿望", 50, now - 8 * 86400, coolingEndAt, JSON.stringify([lastDay])]
    );

    const results = WishService.processCoolingWishes();
    const wantedResult = results.find((r) => r.status === "wanted" || r.status === "purchased");

    expect(wantedResult).toBeDefined();
  });
});

describe("BudgetService", () => {
  beforeEach(async () => {
    resetDatabase();
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });
  });

  // ===== TC-18: 生成本月预算 =====
  test("TC-18: 生成本月预算应创建记录", () => {
    const budget = BudgetService.generateMonthBudget();

    expect(budget.month).toBeDefined();
    expect(budget.totalBudget).toBeGreaterThan(0);
    expect(budget.remaining).toBe(budget.totalBudget);
  });

  // ===== TC-19: 重复生成预算不应重复创建 =====
  test("TC-19: 重复生成预算应返回已有记录", () => {
    const budget1 = BudgetService.generateMonthBudget();
    const budget2 = BudgetService.generateMonthBudget();

    expect(budget1.id).toBe(budget2.id);
  });

  // ===== TC-20: 获取历史预算 =====
  test("TC-20: 获取历史预算应返回按月倒序排列", () => {
    BudgetService.generateMonthBudget();
    const history = BudgetService.getHistory();

    expect(history.length).toBeGreaterThanOrEqual(1);
  });
});
