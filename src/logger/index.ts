/**
 * 日志系统
 * - 四级日志：debug / info / warn / error
 * - 开发环境终端输出
 * - 生产环境写入文件（通过 expo-file-system）
 */

import * as FileSystem from "expo-file-system";

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const __DEV__ = process.env.NODE_ENV !== "production";

let logFilePath = "";

async function initLogFile() {
  if (__DEV__) return;
  // @ts-ignore
    const dir = FileSystem.documentDirectory + "logs";
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  logFilePath = dir + "/app.log";
}

initLogFile().catch(() => {});

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function writeToFile(level: LogLevel, message: string) {
  if (__DEV__ || !logFilePath) return;
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}\n`;
  try {
    await FileSystem.writeAsStringAsync(logFilePath, line, { encoding: FileSystem.EncodingType.UTF8, append: true });
  } catch {
    // ignore
  }
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = (__DEV__ ? "debug" : "info") as LogLevel;
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog("debug")) return;
    const extra = meta ? " " + JSON.stringify(meta) : "";
    console.log(`[${timestamp()}] [DBG]`, msg + extra);
    writeToFile("debug", msg + extra);
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog("info")) return;
    const extra = meta ? " " + JSON.stringify(meta) : "";
    console.log(`[${timestamp()}] [INF]`, msg + extra);
    writeToFile("info", msg + extra);
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog("warn")) return;
    const extra = meta ? " " + JSON.stringify(meta) : "";
    console.warn(`[${timestamp()}] [WRN]`, msg + extra);
    writeToFile("warn", msg + extra);
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog("error")) return;
    const extra = meta ? " " + JSON.stringify(meta) : "";
    console.error(`[${timestamp()}] [ERR]`, msg + extra);
    writeToFile("error", msg + extra);
  },
};

export default logger;
