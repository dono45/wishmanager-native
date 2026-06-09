/**
 * 全局应用状态管理 - Zustand
 */

import { create } from "zustand";
import type { Wish, MonthlyBudget, Task, CrisisRecord } from "@/db/schema";
import type { BudgetWithPurchases } from "@/services/budgetService";
import { WishService } from "@/services/wishService";
import { BudgetService } from "@/services/budgetService";
import { TaskService } from "@/services/taskService";
import { CrisisService } from "@/services/crisisService";
import { AuthService } from "@/services/authService";

interface AppState {
  // 模式
  appMode: "kid" | "parent";
  setAppMode: (mode: "kid" | "parent") => void;

  // 数据
  wishes: Wish[];
  currentBudget: BudgetWithPurchases | null;
  tasks: Task[];
  starCount: number;
  crisisRecords: CrisisRecord[];
  budgetHistory: MonthlyBudget[];
  budgetSetting: { monthlyBudget: number; newBudgetEffectiveMonth: string | null } | null;
  isLoading: boolean;

  // Actions
  loadAll: () => void;
  loadWishes: () => void;
  loadBudget: (month?: string) => void;
  loadTasks: () => void;
  loadCrisisRecords: () => void;
  loadBudgetHistory: () => void;
  loadBudgetSetting: () => void;

  // Mutations
  createWish: (input: { name: string; price: number; imagePath?: string }) => void;
  confirmWish: (id: number) => { remainingDays: number; alreadyConfirmed: boolean };
  cancelWish: (id: number) => void;
  processCooling: () => void;
  completeTask: (id: number) => void;
  createCrisisRecord: (input: Parameters<typeof CrisisService.createRecord>[0]) => void;
  generateBudget: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  appMode: "kid",
  wishes: [],
  currentBudget: null,
  tasks: [],
  starCount: 0,
  crisisRecords: [],
  budgetHistory: [],
  budgetSetting: null,
  isLoading: false,

  setAppMode: (mode) => set({ appMode: mode }),

  loadAll: () => {
    const state = get();
    state.loadWishes();
    state.loadBudget();
    state.loadTasks();
    state.loadCrisisRecords();
    state.loadBudgetHistory();
    state.loadBudgetSetting();
  },

  loadWishes: () => {
    const wishes = WishService.getAllWishes();
    set({ wishes });
  },

  loadBudget: (month?) => {
    if (month) {
      const budget = BudgetService.getBudgetByMonth(month);
      set({ currentBudget: budget });
    } else {
      const budget = BudgetService.getCurrentBudget();
      set({ currentBudget: budget });
    }
  },

  loadTasks: () => {
    const { tasks, totalStars } = TaskService.loadTasksWithReset();
    set({ tasks, starCount: totalStars });
  },

  loadCrisisRecords: () => {
    const crisisRecords = CrisisService.getAllRecords();
    set({ crisisRecords });
  },

  loadBudgetHistory: () => {
    const budgetHistory = BudgetService.getHistory();
    set({ budgetHistory });
  },

  loadBudgetSetting: () => {
    AuthService.getBudget().then((setting) => {
      set({ budgetSetting: setting });
    }).catch(() => {});
  },

  createWish: (input) => {
    WishService.createWish(input);
    get().loadWishes();
  },

  confirmWish: (id) => {
    const result = WishService.confirmWish(id);
    get().loadWishes();
    return { remainingDays: result.remainingDays, alreadyConfirmed: result.alreadyConfirmed };
  },

  cancelWish: (id) => {
    WishService.cancelWish(id);
    get().loadWishes();
  },

  processCooling: () => {
    WishService.processCoolingWishes();
    get().loadWishes();
    get().loadBudget();
  },

  completeTask: (id) => {
    TaskService.completeTask(id);
    get().loadTasks();
  },

  createCrisisRecord: (input) => {
    CrisisService.createRecord(input);
    get().loadCrisisRecords();
  },

  generateBudget: () => {
    BudgetService.generateMonthBudget();
    get().loadBudget();
    get().loadBudgetHistory();
  },
}));
