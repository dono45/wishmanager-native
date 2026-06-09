/**
 * 成就定义 - 静态配置
 */

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // MaterialCommunityIcons name
  maxProgress: number;
}

export const ACHIEVEMENT_DEFS: Record<string, AchievementDefinition> = {
  cooling_master: {
    id: "cooling_master",
    name: "冷静小达人",
    description: "完成3次冷静期后仍想要并成功购买",
    icon: "medal",
    maxProgress: 3,
  },
  saving_expert: {
    id: "saving_expert",
    name: "储蓄小能手",
    description: "单月剩余预算>30%",
    icon: "piggy-bank",
    maxProgress: 1,
  },
  spending_pro: {
    id: "spending_pro",
    name: "消费小专家",
    description: "连续3个月未超支",
    icon: "trophy",
    maxProgress: 3,
  },
  delay_master: {
    id: "delay_master",
    name: "延迟满足大师",
    description: "累计放弃5个预算不足物品，选择等待",
    icon: "diamond-stone",
    maxProgress: 5,
  },
  sharing_star: {
    id: "sharing_star",
    name: "分享之星",
    description: "使用星星兑换家庭特权",
    icon: "handshake",
    maxProgress: 1,
  },
  emotion_warrior: {
    id: "emotion_warrior",
    name: "情绪小勇士",
    description: "本周任务中完成商场不哭闹",
    icon: "lion",
    maxProgress: 1,
  },
};

export function getAchievementDef(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFS[id];
}

export function getAllAchievementDefs(): AchievementDefinition[] {
  return Object.values(ACHIEVEMENT_DEFS);
}
