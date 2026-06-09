/**
 * 家长模式首页 - 4个Tab：预算设定、消费分析、急救包、账号
 */

import { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import {
  Text,
  Card,
  Button,


  TextInput,
  Dialog,
  Portal,
  ProgressBar,
  Chip,
  useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { logger } from "@/logger";
import { AuthService } from "@/services/authService";

const Tab = createBottomTabNavigator();

// ===== 预算设定 Tab =====
function BudgetTab() {
  const theme = useTheme();
  const budgetSetting = useAppStore((s) => s.budgetSetting);
  const loadBudgetSetting = useAppStore((s) => s.loadBudgetSetting);
  const [sliderValue, setSliderValue] = useState(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBudgetSetting();
  }, []);

  useEffect(() => {
    if (budgetSetting) setSliderValue(budgetSetting.monthlyBudget);
  }, [budgetSetting]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await AuthService.setBudget(sliderValue);
      loadBudgetSetting();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.tabContainer}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons name="cog" size={20} color={theme.colors.secondary} /> 基础月预算设定
          </Text>

          <Text variant="bodySmall" style={{ color: "#6b7280", textAlign: "center", marginBottom: 8 }}>每月基础预算</Text>

          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginVertical: 8 }}>
            <Button mode="outlined" compact onPress={() => setSliderValue(Math.max(0, sliderValue - 10))}>-10</Button>
            <Button mode="outlined" compact onPress={() => setSliderValue(Math.max(0, sliderValue - 1))}>-1</Button>
            <Text variant="titleMedium" style={{ minWidth: 60, textAlign: "center" }}>¥{sliderValue}</Text>
            <Button mode="outlined" compact onPress={() => setSliderValue(Math.min(1000, sliderValue + 1))}>+1</Button>
            <Button mode="outlined" compact onPress={() => setSliderValue(Math.min(1000, sliderValue + 10))}>+10</Button>
          </View>

          <TextInput
            mode="outlined"
            label="精确输入"
            value={String(sliderValue)}
            onChangeText={(v) => setSliderValue(parseInt(v) || 0)}
            keyboardType="numeric"
            style={{ marginTop: 12 }}
          />

          {budgetSetting?.newBudgetEffectiveMonth && (
            <Text style={{ color: "#d97706", marginTop: 8 }}>
              ⚠ 新预算将从 {budgetSetting.newBudgetEffectiveMonth} 月起生效
            </Text>
          )}

          <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={{ marginTop: 16 }}>
            保存设定
          </Button>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { backgroundColor: "#dbeafe" }]}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: "#1e40af", marginBottom: 8 }}>预算规则说明</Text>
          <Text variant="bodySmall" style={{ color: "#1e3a5f" }}>• 每月未花完的预算自动累积到下月</Text>
          <Text variant="bodySmall" style={{ color: "#1e3a5f" }}>• 冷静期结束且预算足够时自动购买</Text>
          <Text variant="bodySmall" style={{ color: "#1e3a5f" }}>• 超支部分将从下月预算扣除</Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

// ===== 消费分析 Tab =====
function AnalyticsTab() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const budgetHistory = useAppStore((s) => s.budgetHistory);
  const wishes = useAppStore((s) => s.wishes);
  const loadBudgetHistory = useAppStore((s) => s.loadBudgetHistory);
  const loadWishes = useAppStore((s) => s.loadWishes);

  useEffect(() => {
    loadBudgetHistory();
    loadWishes();
  }, []);

  const yearHistory = budgetHistory.filter((h) => h.month.startsWith(String(selectedYear)));
  const yearWishes = wishes.filter((w) => new Date(w.createdAt * 1000).getFullYear() === selectedYear);

  const totalWishes = yearWishes.length;
  const coolingCount = yearWishes.filter((w) => w.status === "cooling").length;
  const purchasedCount = yearWishes.filter((w) => w.status === "purchased").length;
  const cancelledCount = yearWishes.filter((w) => ["cancelled", "expired"].includes(w.status)).length;

  const monthWishStats: Record<string, { total: number; cooling: number; purchased: number; cancelled: number }> = {};
  yearHistory.forEach((h) => {
    monthWishStats[h.month] = { total: 0, cooling: 0, purchased: 0, cancelled: 0 };
  });
  yearWishes.forEach((w) => {
    const month = w.purchasedMonth || `${new Date(w.createdAt * 1000).getFullYear()}-${String(new Date(w.createdAt * 1000).getMonth() + 1).padStart(2, "0")}`;
    if (!monthWishStats[month]) monthWishStats[month] = { total: 0, cooling: 0, purchased: 0, cancelled: 0 };
    monthWishStats[month].total++;
    if (w.status === "cooling") monthWishStats[month].cooling++;
    else if (w.status === "purchased") monthWishStats[month].purchased++;
    else if (["cancelled", "expired"].includes(w.status)) monthWishStats[month].cancelled++;
  });

  return (
    <ScrollView style={styles.tabContainer}>
      {/* Year Navigation */}
      <View style={styles.yearNav}>
        <TouchableOpacity onPress={() => setSelectedYear((y) => y - 1)} style={{ padding: 8 }}><MaterialCommunityIcons name="chevron-left" size={28} color="#6b7280" /></TouchableOpacity>
        <Text variant="titleLarge" style={{ fontWeight: "bold", minWidth: 100, textAlign: "center" }}>{selectedYear}年</Text>
        <TouchableOpacity onPress={() => setSelectedYear((y) => y + 1)} style={{ padding: 8 }}><MaterialCommunityIcons name="chevron-right" size={28} color="#6b7280" /></TouchableOpacity>
      </View>

      {/* Stats */}
      <Card style={[styles.card, { backgroundColor: "#eff6ff" }]}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: "#3b82f6", textAlign: "center", marginBottom: 12 }}>
            {selectedYear}年愿望统计
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <View style={{ alignItems: "center" }}>
              <Text variant="titleLarge" style={{ fontWeight: "bold", color: "#3b82f6" }}>{totalWishes}</Text>
              <Text variant="bodySmall" style={{ color: "#6b7280" }}>总愿望</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text variant="titleLarge" style={{ fontWeight: "bold", color: "#d97706" }}>{coolingCount}</Text>
              <Text variant="bodySmall" style={{ color: "#6b7280" }}>冷静中</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text variant="titleLarge" style={{ fontWeight: "bold", color: "#22c55e" }}>{purchasedCount}</Text>
              <Text variant="bodySmall" style={{ color: "#6b7280" }}>已购买</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text variant="titleLarge" style={{ fontWeight: "bold", color: "#6b7280" }}>{cancelledCount}</Text>
              <Text variant="bodySmall" style={{ color: "#6b7280" }}>已取消</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Monthly Detail */}
      <Text variant="titleMedium" style={{ marginTop: 16, marginBottom: 8, fontWeight: "600" }}>月度明细</Text>
      {yearHistory.map((h) => {
        const total = Number(h.totalBudget);
        const spent = Number(h.spent);
        const pct = total > 0 ? (spent / total) * 100 : 0;
        const stats = monthWishStats[h.month] || { total: 0, cooling: 0, purchased: 0, cancelled: 0 };

        return (
          <Card key={h.id} style={[styles.card, { marginBottom: 8 }]}>
            <Card.Content>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text variant="titleMedium" style={{ fontWeight: "bold" }}>{parseInt(h.month.split("-")[1])}月</Text>
                <Text style={{ color: "#6b7280" }}>¥{spent.toFixed(0)} / ¥{total.toFixed(0)}</Text>
              </View>
              <ProgressBar progress={pct / 100} color="#3b82f6" style={{ height: 8, borderRadius: 4, marginBottom: 4 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text variant="bodySmall" style={{ color: "#9ca3af" }}>基础 ¥{h.baseBudget}</Text>
                <Text variant="bodySmall" style={{ color: "#9ca3af" }}>滚存 ¥{h.carriedOver}</Text>
              </View>
              {stats.total > 0 && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
                  <View style={[styles.statBox, { backgroundColor: "#fef3c7" }]}>
                    <Text style={{ fontWeight: "bold", color: "#d97706" }}>{stats.cooling}</Text>
                    <Text variant="bodySmall" style={{ color: "#d97706" }}>冷静中</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: "#f0fdf4" }]}>
                    <Text style={{ fontWeight: "bold", color: "#22c55e" }}>{stats.purchased}</Text>
                    <Text variant="bodySmall" style={{ color: "#22c55e" }}>已购买</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: "#f9fafb" }]}>
                    <Text style={{ fontWeight: "bold", color: "#6b7280" }}>{stats.cancelled}</Text>
                    <Text variant="bodySmall" style={{ color: "#6b7280" }}>已取消</Text>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        );
      })}

      {yearHistory.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="chart-bar" size={48} color="#d1d5db" />
          <Text style={{ color: "#9ca3af", marginTop: 8 }}>暂无消费数据</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ===== 急救包 Tab =====
function CrisisTab() {
  const crisisRecords = useAppStore((s) => s.crisisRecords);
  const loadCrisisRecords = useAppStore((s) => s.loadCrisisRecords);
  const createCrisisRecord = useAppStore((s) => s.createCrisisRecord);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [location, setLocation] = useState("");
  const [strategy, setStrategy] = useState("");
  const [outcome, setOutcome] = useState<"success" | "partial" | "escalated">("success");
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    loadCrisisRecords();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive) {
      interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSave = () => {
    createCrisisRecord({ location, strategy, outcome, duration: Math.floor(elapsedSeconds / 60) });
    setDialogVisible(false);
    setLocation("");
    setStrategy("");
    setElapsedSeconds(0);
    setTimerActive(false);
  };

  const steps = [
    { step: 1, title: "自我稳定", desc: "先做3次深呼吸，保持冷静", icon: "timer", color: "#99f6e4" },
    { step: 2, title: "连接孩子", desc: "蹲下来，看着孩子的眼睛说：\"我理解你很想要这个\"", icon: "message-text", color: "#bfdbfe" },
    { step: 3, title: "引入规则", desc: "打开App，拍照添加到愿望清单，启动冷静期", icon: "camera", color: "#fde68a" },
    { step: 4, title: "转移注意力", desc: "引导孩子看任务或成就，转移对玩具的关注", icon: "sparkles", color: "#e9d5ff" },
  ];

  return (
    <ScrollView style={styles.tabContainer}>
      {/* Timer */}
      <Card style={{ backgroundColor: "#14b8a6", marginBottom: 16, borderRadius: 12 }}>
        <Card.Content style={{ alignItems: "center" }}>
          <Text variant="titleMedium" style={{ color: "#fff", marginBottom: 8 }}>家长冷静呼吸</Text>
          <Text style={{ color: "#fff", opacity: 0.8, marginBottom: 12 }}>深呼吸，保持冷静，你是孩子的榜样</Text>
          <Text style={{ fontSize: 48, fontWeight: "bold", color: "#fff", fontFamily: "monospace" }}>
            {formatTime(elapsedSeconds)}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {!timerActive ? (
              <Button mode="contained" buttonColor="#fff" textColor="#14b8a6" onPress={() => setTimerActive(true)} icon="play">
                开始计时
              </Button>
            ) : (
              <Button mode="contained" buttonColor="#fff" textColor="#14b8a6" onPress={() => setTimerActive(false)} icon="pause">
                暂停
              </Button>
            )}
            <Button mode="outlined" textColor="#fff" onPress={() => { setTimerActive(false); setElapsedSeconds(0); }}>
              重置
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Steps */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 12 }}>
            <MaterialCommunityIcons name="heart" size={20} color="#ef4444" /> 应对步骤
          </Text>
          {steps.map((s) => (
            <View key={s.step} style={[styles.stepItem, { backgroundColor: s.color + "40" }]}>
              <View style={[styles.stepBadge, { backgroundColor: s.color }]}>
                <MaterialCommunityIcons name={s.icon as any} size={16} color="#1f2937" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Chip compact>{s.step}</Chip>
                  <Text style={{ fontWeight: "600" }}>{s.title}</Text>
                </View>
                <Text variant="bodySmall" style={{ color: "#6b7280", marginTop: 2 }}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Record Button */}
      <Button mode="contained" buttonColor="#ef4444" onPress={() => setDialogVisible(true)} style={{ marginTop: 16 }} icon="heart">
        记录本次冲突处理
      </Button>

      {/* Records */}
      {crisisRecords.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>历史记录</Text>
          {crisisRecords.map((record) => (
            <Card key={record.id} style={[styles.card, { marginBottom: 6 }]}>
              <Card.Content>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialCommunityIcons
                      name={record.outcome === "success" ? "check-circle" : "alert-circle"}
                      size={20}
                      color={record.outcome === "success" ? "#22c55e" : record.outcome === "partial" ? "#f59e0b" : "#ef4444"}
                    />
                    <Text style={{ color: "#4b5563" }}>{record.location || "未记录地点"}</Text>
                  </View>
                  <Chip
                    compact
                    style={{
                      backgroundColor:
                        record.outcome === "success" ? "#f0fdf4" :
                        record.outcome === "partial" ? "#fef3c7" : "#fee2e2",
                    }}
                    textStyle={{
                      color:
                        record.outcome === "success" ? "#22c55e" :
                        record.outcome === "partial" ? "#d97706" : "#ef4444",
                    }}
                  >
                    {record.outcome === "success" ? "成功" : record.outcome === "partial" ? "部分成功" : "升级"}
                  </Chip>
                </View>
                {record.strategy && <Text variant="bodySmall" style={{ color: "#6b7280", marginTop: 4 }}>策略: {record.strategy}</Text>}
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Record Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>记录冲突处理</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="地点" value={location} onChangeText={setLocation} placeholder="商场/超市/餐厅" style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="使用的策略" value={strategy} onChangeText={setStrategy} placeholder="深呼吸、转移注意力等" style={{ marginBottom: 8 }} />
            <Text variant="bodyMedium" style={{ marginBottom: 4 }}>处理结果</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {(["success", "partial", "escalated"] as const).map((o) => (
                <Button
                  key={o}
                  mode={outcome === o ? "contained" : "outlined"}
                  onPress={() => setOutcome(o)}
                  compact
                  buttonColor={outcome === o ? "#22c55e" : undefined}
                >
                  {o === "success" ? "成功" : o === "partial" ? "部分成功" : "升级"}
                </Button>
              ))}
            </View>
            {elapsedSeconds > 0 && <Text style={{ color: "#6b7280" }}>用时: {formatTime(elapsedSeconds)}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>取消</Button>
            <Button onPress={handleSave}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

// ===== 账号 Tab =====
function AccountTab() {
  const { user, logout } = useAuthStore();
  const setAppMode = useAppStore((s) => s.setAppMode);
  const [pwDialog, setPwDialog] = useState(false);
  const [ppDialog, setPpDialog] = useState(false);
  const [parentPassword, setParentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setParentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleUpdatePassword = async () => {
    setError("");
    if (newPassword.length < 6) { setError("新密码至少6位"); return; }
    if (newPassword !== confirmPassword) { setError("两次输入不一致"); return; }
    setLoading(true);
    try {
      await AuthService.updatePassword(parentPassword, newPassword);
      setPwDialog(false);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateParentPassword = async () => {
    setError("");
    if (newPassword.length < 6) { setError("新密码至少6位"); return; }
    if (newPassword !== confirmPassword) { setError("两次输入不一致"); return; }
    setLoading(true);
    try {
      await AuthService.updateParentPassword(parentPassword, newPassword);
      setPpDialog(false);
      resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.tabContainer}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 16 }}>
            <MaterialCommunityIcons name="lock" size={20} color="#3b82f6" /> 账号信息
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
            <Text style={{ color: "#6b7280" }}>用户名</Text>
            <Text style={{ fontWeight: "600" }}>{user?.username}</Text>
          </View>

          <Button mode="outlined" icon="key" onPress={() => { resetForm(); setPwDialog(true); }} style={{ marginTop: 12 }}>
            修改登录密码
          </Button>
          <Button mode="outlined" icon="shield-key" onPress={() => { resetForm(); setPpDialog(true); }} style={{ marginTop: 8 }}>
            修改家长密码
          </Button>
          <Button mode="outlined" icon="arrow-left" onPress={() => setAppMode("kid")} style={{ marginTop: 12 }}>
            返回儿童模式
          </Button>
          <Button mode="contained" buttonColor="#ef4444" icon="logout" onPress={() => logout()} style={{ marginTop: 16 }}>
            退出登录
          </Button>
        </Card.Content>
      </Card>

      {/* Update Password Dialog */}
      <Portal>
        <Dialog visible={pwDialog} onDismiss={() => setPwDialog(false)}>
          <Dialog.Title>修改登录密码</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="家长密码验证" secureTextEntry value={parentPassword} onChangeText={setParentPassword} style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="新登录密码" secureTextEntry value={newPassword} onChangeText={setNewPassword} style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="确认新密码" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
            {error ? <Text style={{ color: "#ef4444", marginTop: 8 }}>{error}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPwDialog(false)}>取消</Button>
            <Button onPress={handleUpdatePassword} loading={loading} disabled={loading}>确认</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Update Parent Password Dialog */}
      <Portal>
        <Dialog visible={ppDialog} onDismiss={() => setPpDialog(false)}>
          <Dialog.Title>修改家长密码</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="原家长密码" secureTextEntry value={parentPassword} onChangeText={setParentPassword} style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="新家长密码" secureTextEntry value={newPassword} onChangeText={setNewPassword} style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="确认新密码" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
            {error ? <Text style={{ color: "#ef4444", marginTop: 8 }}>{error}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPpDialog(false)}>取消</Button>
            <Button onPress={handleUpdateParentPassword} loading={loading} disabled={loading}>确认</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

// ===== Tab Navigator =====
export default function ParentHome() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = "help-circle";
          if (route.name === "Budget") iconName = focused ? "cog" : "cog-outline";
          else if (route.name === "Analytics") iconName = focused ? "chart-bar" : "chart-bar";
          else if (route.name === "Crisis") iconName = focused ? "heart" : "heart-outline";
          else if (route.name === "Account") iconName = focused ? "lock" : "lock-outline";
          return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#9ca3af",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Budget" component={BudgetTab} options={{ tabBarLabel: "预算设定" }} />
      <Tab.Screen name="Analytics" component={AnalyticsTab} options={{ tabBarLabel: "消费分析" }} />
      <Tab.Screen name="Crisis" component={CrisisTab} options={{ tabBarLabel: "急救包" }} />
      <Tab.Screen name="Account" component={AccountTab} options={{ tabBarLabel: "账号" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabContainer: { flex: 1, padding: 16, backgroundColor: "#eff6ff" },
  card: { marginBottom: 12, borderRadius: 12 },
  emptyState: { alignItems: "center", marginTop: 48 },
  yearNav: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  statBox: { flex: 1, alignItems: "center", padding: 8, borderRadius: 8 },
  stepItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 8, marginBottom: 8 },
  stepBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
});
