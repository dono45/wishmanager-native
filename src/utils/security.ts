/**
 * 安全工具 - 密码哈希与验证
 * 使用 expo-crypto 进行 SHA-256 哈希 + 盐
 */

import * as Crypto from "expo-crypto";
import { logger } from "@/logger";

const SALT = "wishmanager_salt_2026";

// ============ 时间 Mock（调试专用）============
let _timeOffsetMs = 0;

/** 测试专用：快进时间（单位：毫秒） */
export function advanceTime(ms: number) {
  _timeOffsetMs += ms;
  logger.info("Time advanced", { offsetMs: _timeOffsetMs, days: Math.round(_timeOffsetMs / (24 * 60 * 60 * 1000)) });
}

/** 测试专用：重置时间 */
export function resetTime() {
  _timeOffsetMs = 0;
  logger.info("Time reset");
}

/** 获取当前时间戳（受 mock 控制） */
export function now(): number {
  return Date.now() + _timeOffsetMs;
}

// ===========================================

export async function hashPassword(password: string): Promise<string> {
  const salted = password + SALT;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salted
  );
  return hash;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// 生成唯一ID
let _nextId = now();
export function generateId(): number {
  return ++_nextId;
}

// 获取当前月份 YYYY-MM
export function getCurrentMonth(): string {
  const d = new Date(now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 获取今天的日期字符串 YYYY-MM-DD（本地时区）
export function getTodayStr(): string {
  const d = new Date(now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 获取今天本地时间 00:00:00 的 Unix 时间戳（秒）
export function getTodayStartTimestamp(): number {
  const d = new Date(now());
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000);
}

// 计算7天后的时间戳
export function getCoolingEndTime(): number {
  return Math.floor((now() + 7 * 24 * 60 * 60 * 1000) / 1000);
}

// 月份加减
export function addMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
