/**
 * 认证状态管理 - Zustand
 */

import { create } from "zustand";
import { AuthService, type LoginResult } from "@/services/authService";
import { logger } from "@/logger";

interface AuthState {
  user: LoginResult["user"] | null;
  isLoading: boolean;
  isLoggedIn: boolean;

  // Actions
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, parentPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,

  init: async () => {
    try {
      const user = await AuthService.getCurrentUser();
      set({ user, isLoggedIn: !!user, isLoading: false });
      logger.info("Auth initialized", { loggedIn: !!user });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  login: async (username, password) => {
    const result = await AuthService.login(username, password);
    set({ user: result.user, isLoggedIn: true });
  },

  register: async (username, password, parentPassword) => {
    const result = await AuthService.register({ username, password, parentPassword });
    set({ user: result.user, isLoggedIn: true });
  },

  logout: async () => {
    await AuthService.logout();
    set({ user: null, isLoggedIn: false });
  },

  refreshUser: async () => {
    try {
      const user = await AuthService.getCurrentUser();
      set({ user, isLoggedIn: !!user });
    } catch (e) {
      logger.error("Failed to refresh user", { error: String(e) });
    }
  },
}));
