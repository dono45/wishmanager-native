import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { initDatabase } from "@/db/schema";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore } from "@/stores/appStore";
import { logger } from "@/logger";
import AuthScreen from "@/screens/AuthScreen";
import KidHome from "@/screens/KidHome";
import ParentHome from "@/screens/ParentHome";

// 自定义主题 - 暖色调，适合儿童
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#f59e0b",
    primaryContainer: "#fef3c7",
    secondary: "#3b82f6",
    secondaryContainer: "#dbeafe",
    tertiary: "#10b981",
    surface: "#ffffff",
    background: "#fffbeb",
    error: "#ef4444",
  },
};

export default function App() {
  const { isLoggedIn, isLoading, init } = useAuthStore();
  const appMode = useAppStore((s) => s.appMode);

  useEffect(() => {
    logger.info("App starting...");
    // 初始化数据库
    initDatabase();
    // 初始化认证状态
    init();
  }, []);

  if (isLoading) {
    return (
      <PaperProvider theme={theme}>
        <StatusBar style="auto" />
      </PaperProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <StatusBar style="auto" />
          {!isLoggedIn ? (
            <AuthScreen />
          ) : (
            <SafeAreaView style={{ flex: 1 }}>
              {appMode === "kid" ? <KidHome /> : <ParentHome />}
            </SafeAreaView>
          )}
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
