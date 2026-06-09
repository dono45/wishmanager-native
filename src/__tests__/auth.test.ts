/**
 * 认证模块测试
 * 覆盖注册、登录、家长密码验证
 */

import { AuthService } from "@/services/authService";
import { resetDatabase } from "@/db/schema";

describe("AuthService", () => {
  beforeEach(() => {
    resetDatabase();
  });

  // ===== TC-01: 正常注册 =====
  test("TC-01: 正常注册应成功并返回用户信息", async () => {
    const result = await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    expect(result.user).toBeDefined();
    expect(result.user.username).toBe("testuser");
    expect(result.user.id).toBeGreaterThan(0);
    expect(result.user.monthlyBudget).toBe(30);
  });

  // ===== TC-02: 注册重复用户名应失败 =====
  test("TC-02: 注册重复用户名应报错", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    await expect(
      AuthService.register({
        username: "testuser",
        password: "otherpass",
        parentPassword: "other123",
      })
    ).rejects.toThrow("用户名已存在");
  });

  // ===== TC-03: 正常登录 =====
  test("TC-03: 正常登录应成功", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    const result = await AuthService.login("testuser", "testpass");
    expect(result.user.username).toBe("testuser");
  });

  // ===== TC-04: 错误密码登录应失败 =====
  test("TC-04: 错误密码登录应报错", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    await expect(AuthService.login("testuser", "wrongpass")).rejects.toThrow("用户名或密码错误");
  });

  // ===== TC-05: 不存在的用户登录应失败 =====
  test("TC-05: 不存在的用户登录应报错", async () => {
    await expect(AuthService.login("nonexist", "pass")).rejects.toThrow("用户名或密码错误");
  });

  // ===== TC-06: 验证家长密码 =====
  test("TC-06: 正确家长密码验证应通过", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    const valid = await AuthService.verifyParentPassword("parent123");
    expect(valid).toBe(true);
  });

  // ===== TC-07: 错误家长密码验证应失败 =====
  test("TC-07: 错误家长密码验证应失败", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    const valid = await AuthService.verifyParentPassword("wrong");
    expect(valid).toBe(false);
  });

  // ===== TC-08: 修改登录密码 =====
  test("TC-08: 使用正确家长密码修改登录密码应成功", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    await AuthService.updatePassword("parent123", "newpass123");

    // 用新密码登录
    const result = await AuthService.login("testuser", "newpass123");
    expect(result.user.username).toBe("testuser");
  });

  // ===== TC-09: 用错误家长密码修改登录密码应失败 =====
  test("TC-09: 用错误家长密码修改登录密码应报错", async () => {
    await AuthService.register({
      username: "testuser",
      password: "testpass",
      parentPassword: "parent123",
    });

    await expect(AuthService.updatePassword("wrong", "newpass")).rejects.toThrow("家长密码错误");
  });
});
