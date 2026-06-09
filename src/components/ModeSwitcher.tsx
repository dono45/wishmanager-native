/**
 * 模式切换器 - 儿童/家长模式切换
 */

import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Dialog, Portal, TextInput, Text, useTheme } from "react-native-paper";
import { useAppStore } from "@/stores/appStore";
import { AuthService } from "@/services/authService";
import { logger } from "@/logger";

export default function ModeSwitcher() {
  const theme = useTheme();
  const appMode = useAppStore((s) => s.appMode);
  const setAppMode = useAppStore((s) => s.setAppMode);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [parentPassword, setParentPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSwitchToParent = async () => {
    setError("");
    if (!parentPassword) {
      setError("请输入家长密码");
      return;
    }
    setVerifying(true);
    try {
      const valid = await AuthService.verifyParentPassword(parentPassword);
      if (valid) {
        setAppMode("parent");
        setDialogVisible(false);
        setParentPassword("");
        logger.info("Switched to parent mode");
      } else {
        setError("家长密码错误");
      }
    } catch (e: any) {
      setError(e.message || "验证失败");
    } finally {
      setVerifying(false);
    }
  };

  const handleSwitchToKid = () => {
    setAppMode("kid");
    logger.info("Switched to kid mode");
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.colors.primaryContainer }]}>
        {appMode === "kid" ? (
          <Button
            mode="contained-tonal"
            icon="shield-account"
            onPress={() => {
              setDialogVisible(true);
              setError("");
              setParentPassword("");
            }}
            textColor={theme.colors.primary}
            compact
          >
            家长模式
          </Button>
        ) : (
          <Button
            mode="contained-tonal"
            icon="arrow-left"
            onPress={handleSwitchToKid}
            textColor={theme.colors.secondary}
            compact
          >
            返回儿童模式
          </Button>
        )}
      </View>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>进入家长模式</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.hint}>
              请输入家长密码验证身份
            </Text>
            <TextInput
              mode="outlined"
              label="家长密码"
              secureTextEntry
              value={parentPassword}
              onChangeText={setParentPassword}
              error={!!error}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>取消</Button>
            <Button onPress={handleSwitchToParent} loading={verifying} disabled={verifying}>
              确认
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  hint: {
    marginBottom: 12,
    color: "#666",
  },
  input: {
    marginBottom: 8,
  },
  error: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
});
