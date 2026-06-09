/**
 * 登录/注册页面
 */

import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  TextInput,
  Button,
  Text,
  Card,
  Avatar,
  HelperText,
  useTheme,
  ActivityIndicator,
} from "react-native-paper";
import { useAuthStore } from "@/stores/authStore";
import { logger } from "@/logger";

export default function AuthScreen() {
  const theme = useTheme();
  const { login, register } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [confirmParentPassword, setConfirmParentPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!username.trim()) { setError("请输入用户名"); return; }
    if (!password || password.length < 6) { setError("密码至少6位"); return; }

    if (isRegister) {
      if (!parentPassword || parentPassword.length < 6) { setError("家长密码至少6位"); return; }
      if (parentPassword !== confirmParentPassword) { setError("两次输入的家长密码不一致"); return; }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(username.trim(), password, parentPassword);
        logger.info("Registered and logged in", { username });
      } else {
        await login(username.trim(), password);
        logger.info("Logged in", { username });
      }
    } catch (e: any) {
      setError(e.message || "操作失败");
      logger.error("Auth error", { message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Avatar.Icon
              size={80}
              icon="piggy-bank"
              style={{ backgroundColor: theme.colors.primary }}
              color="#fff"
            />
            <Text variant="headlineMedium" style={styles.title}>
              小管家
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              儿童财商与愿望管理工具
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              mode="outlined"
              label="用户名"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              disabled={loading}
              style={styles.input}
            />

            <TextInput
              mode="outlined"
              label="登录密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              disabled={loading}
              style={styles.input}
            />

            {isRegister && (
              <>
                <TextInput
                  mode="outlined"
                  label="家长密码"
                  value={parentPassword}
                  onChangeText={setParentPassword}
                  secureTextEntry
                  disabled={loading}
                  style={styles.input}
                />
                <HelperText type="info" visible={true}>
                  家长密码用于进入家长模式，请妥善保管
                </HelperText>
                <TextInput
                  mode="outlined"
                  label="确认家长密码"
                  value={confirmParentPassword}
                  onChangeText={setConfirmParentPassword}
                  secureTextEntry
                  disabled={loading}
                  style={styles.input}
                />
              </>
            )}

            {error ? (
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              contentStyle={{ height: 48 }}
            >
              {loading ? "处理中..." : isRegister ? "注册" : "登录"}
            </Button>

            <Button
              mode="text"
              onPress={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              disabled={loading}
              style={styles.switchButton}
            >
              {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#fffbeb",
  },
  card: {
    borderRadius: 16,
    elevation: 4,
  },
  content: {
    paddingVertical: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    marginTop: 12,
    fontWeight: "bold",
    color: "#d97706",
  },
  subtitle: {
    color: "#9ca3af",
    marginTop: 4,
  },
  form: {
    gap: 4,
  },
  input: {
    marginBottom: 4,
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 8,
  },
  switchButton: {
    marginTop: 8,
  },
});
