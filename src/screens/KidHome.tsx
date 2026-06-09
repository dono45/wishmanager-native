/**
 * 儿童模式首页 - 4个Tab：愿望、储蓄罐、任务、我的
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import {
  Text,
  Card,
  Button,
  ProgressBar,
  Dialog,
  Portal,
  TextInput,
  useTheme,
  Chip,
} from "react-native-paper";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { AuthService } from "@/services/authService";
import * as ImagePicker from "expo-image-picker";
import { getCurrentMonth, advanceTime, resetTime, now } from "@/utils/security";
import { logger } from "@/logger";

const Tab = createBottomTabNavigator();
const SCREEN_WIDTH = Dimensions.get("window").width;

// ===== 鼓励弹框 =====
function EncourageDialog({
  visible,
  onDismiss,
  type,
  remainingDays,
}: {
  visible: boolean;
  onDismiss: () => void;
  type: "confirm" | "giveup";
  remainingDays: number;
}) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.encourageDialog}>
        <Dialog.Content style={styles.encourageContent}>
          {type === "confirm" ? (
            <>
              <Text style={styles.encourageEmoji}>💪</Text>
              <Text variant="titleLarge" style={styles.encourageTitle}>
                加油哦！
              </Text>
              <Text variant="bodyMedium" style={styles.encourageText}>
                再坚持{" "}
                <Text style={styles.encourageHighlight}>{remainingDays}</Text>{" "}
                天就可以得到啦！
              </Text>
              <Text variant="bodySmall" style={styles.encourageSub}>
                你真的很棒！
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.encourageEmoji}>🌟</Text>
              <Text variant="titleLarge" style={[styles.encourageTitle, { color: "#3b82f6" }]}>
                你真棒！
              </Text>
              <Text variant="bodyMedium" style={styles.encourageText}>
                学会取舍是很厉害的本领！
              </Text>
              <Text variant="bodySmall" style={styles.encourageSub}>
                不是每个东西都必须拥有，你长大了！
              </Text>
            </>
          )}
          <Button mode="contained" onPress={onDismiss} style={styles.encourageButton}>
            {type === "confirm" ? "好的，我会坚持的！" : "谢谢鼓励！"}
          </Button>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

// ===== 侧边栏筛选 =====
const FILTER_OPTIONS = [
  { key: null, label: "当前愿望", icon: "clock-outline", color: "#d97706" },
  { key: "cooling", label: "冷静中", icon: "snowflake", color: "#3b82f6" },
  { key: "wanted", label: "待购买", icon: "cart-outline", color: "#22c55e" },
  { key: "insufficient", label: "预算不足", icon: "cash-remove", color: "#ef4444" },
  { key: "purchased", label: "已购买", icon: "check-circle-outline", color: "#22c55e" },
  { key: "expired", label: "已过期", icon: "timer-off-outline", color: "#6b7280" },
  { key: "cancelled", label: "已取消", icon: "close-circle-outline", color: "#6b7280" },
];

function WishSidebar({
  visible,
  onClose,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: -SCREEN_WIDTH * 0.75, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]} pointerEvents={visible ? "auto" : "none"}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)", opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: SCREEN_WIDTH * 0.75,
          backgroundColor: "#fff",
          transform: [{ translateX: slideAnim }],
          paddingTop: 48,
          paddingHorizontal: 20,
          shadowColor: "#000",
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <Text variant="titleLarge" style={{ fontWeight: "bold", marginBottom: 24 }}>愿望筛选</Text>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key ?? "default"}
            onPress={() => { onSelect(opt.key); onClose(); }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderRadius: 12,
              marginBottom: 8,
              backgroundColor: selected === opt.key ? opt.color + "15" : "transparent",
            }}
          >
            <MaterialCommunityIcons name={opt.icon as any} size={22} color={selected === opt.key ? opt.color : "#9ca3af"} />
            <Text style={{ fontSize: 16, fontWeight: selected === opt.key ? "600" : "400", color: selected === opt.key ? opt.color : "#374151" }}>
              {opt.label}
            </Text>
            {selected === opt.key && (
              <MaterialCommunityIcons name="check" size={18} color={opt.color} style={{ marginLeft: "auto" }} />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

// ===== 愿望清单 Tab =====
function WishesTab() {
  const theme = useTheme();
  const wishes = useAppStore((s) => s.wishes);
  const loadWishes = useAppStore((s) => s.loadWishes);
  const createWish = useAppStore((s) => s.createWish);
  const confirmWish = useAppStore((s) => s.confirmWish);
  const cancelWish = useAppStore((s) => s.cancelWish);
  const restoreWishToCooling = useAppStore((s) => s.restoreWishToCooling);
  const purchaseSingleWish = useAppStore((s) => s.purchaseSingleWish);
  const processCooling = useAppStore((s) => s.processCooling);

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const [dialogVisible, setDialogVisible] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [encourage, setEncourage] = useState<{ visible: boolean; type: "confirm" | "giveup"; remainingDays: number }>({
    visible: false, type: "confirm", remainingDays: 0,
  });

  // 自动处理到期冷静期，无需手动点击
  useEffect(() => {
    processCooling();
    loadWishes();
  }, []);

  // 1小时轮询 + 切换回本Tab立即刷新
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, [])
  );

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleAddWish = () => {
    if (!name.trim() || !price) return;
    createWish({ name: name.trim(), price: parseFloat(price), imagePath: imageUri ?? undefined });
    setDialogVisible(false);
    setName("");
    setPrice("");
    setImageUri(null);
  };

  const handleConfirm = (wish: (typeof wishes)[0]) => {
    try {
      // 预算不足状态：点击"我还想要"触发预算检查
      if (wish.status === "insufficient") {
        const result = restoreWishToCooling(wish.id);
        if (result.restored) {
          Alert.alert("✨ 预算够了！", result.message);
        } else {
          Alert.alert("💡 再等等吧", result.message);
        }
        return;
      }

      // 冷静期已结束（如 advanceTime 后），直接触发购买判断，不再走每日确认
      if (wish.status === "cooling" && wish.coolingEndAt * 1000 <= now()) {
        const result = purchaseSingleWish(wish.id);
        if (result.status === "purchased") {
          Alert.alert("🎉 购买成功！", result.message);
        } else if (result.status === "insufficient") {
          Alert.alert("😢 预算不足", result.message);
        }
        return;
      }

      // cooling 状态：每日确认
      const result = confirmWish(wish.id);
      if (result.alreadyConfirmed) {
        Alert.alert("提示", "今天已经确认过了哦！");
        return;
      }

      // 第7天确认且冷静期已结束，立即触发购买判断
      const isLastDay = result.totalConfirmations >= 7;
      const isCoolingEnded = wish.coolingEndAt * 1000 <= now();
      if (isLastDay && isCoolingEnded) {
        const purchaseResult = purchaseSingleWish(wish.id);
        if (purchaseResult.status === "purchased") {
          Alert.alert("🎉 购买成功！", purchaseResult.message);
        } else if (purchaseResult.status === "insufficient") {
          Alert.alert("😢 预算不足", purchaseResult.message);
        }
        return;
      }

      setEncourage({ visible: true, type: "confirm", remainingDays: result.remainingDays });
    } catch (e: any) {
      Alert.alert("错误", e.message);
    }
  };

  const handleGiveUp = (wish: (typeof wishes)[0]) => {
    Alert.alert("确认", "确定不想要了吗？", [
      { text: "再想想", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: () => {
          cancelWish(wish.id);
          setEncourage({ visible: true, type: "giveup", remainingDays: 0 });
        },
      },
    ]);
  };

  const activeStatuses = ["cooling", "wanted", "insufficient"];
  const completedStatuses = ["purchased", "expired", "cancelled"];

  const defaultWishes = wishes.filter((w) => activeStatuses.includes(w.status));
  const completedWishes = wishes.filter((w) => completedStatuses.includes(w.status));

  const displayedWishes = filter
    ? wishes.filter((w) => w.status === filter)
    : defaultWishes;

  // 已完成分区只在默认视图（filter === null）下显示
  const showCompletedSection = filter === null && completedWishes.length > 0;

  const statusMood: Record<string, { emoji: string; message: string }> = {
    purchased: { emoji: "😆", message: "太棒了！愿望达成啦！" },
    expired: { emoji: "😴", message: "没关系，下次再看看~" },
    cancelled: { emoji: "👋", message: "你真棒！学会取舍了！" },
  };

  const formatDate = (ts: number | undefined | null) => {
    if (!ts || isNaN(ts)) return "未知日期";
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return "未知日期";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getStatusLabel = (wish: (typeof wishes)[0]) => {
    if (wish.status === "cooling") {
      const rd = Math.max(0, Math.ceil((wish.coolingEndAt * 1000 - now()) / (1000 * 60 * 60 * 24)));
      return `冷静期·剩${rd}天`;
    }
    if (wish.status === "wanted") return "待购买";
    if (wish.status === "insufficient") return "预算不足";
    if (wish.status === "purchased") return "已购买";
    if (wish.status === "expired") return "已过期";
    if (wish.status === "cancelled") return "已取消";
    return wish.status;
  };

  const getStatusChipColors = (status: string) => {
    switch (status) {
      case "cooling": return { bg: "#fef3c7", text: "#d97706" };
      case "wanted": return { bg: "#dbeafe", text: "#3b82f6" };
      case "insufficient": return { bg: "#fee2e2", text: "#ef4444" };
      case "purchased": return { bg: "#f0fdf4", text: "#22c55e" };
      case "expired": return { bg: "#f3f4f6", text: "#6b7280" };
      case "cancelled": return { bg: "#f3f4f6", text: "#6b7280" };
      default: return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  const getCompletedDate = (wish: (typeof wishes)[0]) => {
    if (wish.status === "purchased") {
      return `完成于 ${formatDate(wish.coolingEndAt)}`;
    }
    if (wish.status === "expired") {
      return `过期于 ${formatDate(wish.coolingEndAt)}`;
    }
    if (wish.status === "cancelled") {
      return `取消于 ${formatDate(wish.coolingEndAt)}`;
    }
    return "";
  };

  return (
    <View style={{ flex: 1 }}>
      <WishSidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} selected={filter} onSelect={setFilter} />

      {/* 固定标题栏（绝对定位，确保卡片永远滑不到它上面） */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity onPress={() => setSidebarVisible(true)} style={styles.headerBtn}>
          <MaterialCommunityIcons name="menu" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text variant="titleLarge" style={styles.headerTitle}>我的愿望清单</Text>
        <TouchableOpacity onPress={() => setDialogVisible(true)} style={styles.headerBtn}>
          <MaterialCommunityIcons name="plus-circle" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ScrollView 内容区域，顶部留出标题栏高度 */}
      <ScrollView style={{ flex: 1, backgroundColor: "#fffbeb" }} contentContainerStyle={{ padding: 16, paddingTop: 64 }}>
        {/* Wishes List */}
        {displayedWishes.map((wish) => {
          const confirmations: string[] = JSON.parse(wish.dailyConfirmations || "[]");
          const isCompleted = completedStatuses.includes(wish.status);
          const chipColors = getStatusChipColors(wish.status);
          const completedDate = getCompletedDate(wish);

          return (
            <Card key={wish.id} style={[styles.wishCard, isCompleted && { backgroundColor: "#f9fafb" }]}>
              <Card.Content style={{ paddingBottom: 12 }}>
                {/* 信息行：文字 + 图片 */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.wishHeader}>
                      <Text variant="titleMedium" style={{ flexShrink: 1 }} numberOfLines={1}>{wish.name}</Text>
                      <Chip compact style={{ backgroundColor: chipColors.bg }} textStyle={{ color: chipColors.text }}>
                        {getStatusLabel(wish)}
                      </Chip>
                    </View>
                    <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: "bold", marginTop: 4 }}>
                      ¥{wish.price}
                    </Text>
                    {isCompleted && (
                      <Text variant="bodySmall" style={{ color: "#9ca3af", marginTop: 2 }}>
                        {completedDate}
                      </Text>
                    )}
                    {wish.status === "insufficient" && (
                      <Text style={{ color: "#f59e0b", marginTop: 4 }}>
                        💡 当月预算不够哦，先存一存，下个月再看看吧~
                      </Text>
                    )}
                  </View>
                  {wish.imagePath && (
                    <Image source={{ uri: wish.imagePath }} style={styles.wishThumb} />
                  )}
                </View>

                {/* 操作区：cooling / insufficient 状态按钮 */}
                {(wish.status === "cooling" || wish.status === "insufficient") && (
                  <View style={{ marginTop: 12 }}>
                    {wish.status === "cooling" && (
                      <>
                        <ProgressBar
                          progress={confirmations.length / 7}
                          color={theme.colors.primary}
                          style={{ height: 8, borderRadius: 4 }}
                        />
                        <Text variant="bodySmall" style={{ marginTop: 4, color: "#6b7280" }}>
                          已确认 {confirmations.length}/7 天
                        </Text>
                      </>
                    )}
                    {wish.status === "insufficient" && (
                      <Text variant="bodySmall" style={{ marginTop: 4, color: "#9ca3af" }}>
                        预算够了就可以开始7天冷静期啦
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <Button
                        mode="contained"
                        icon="thumb-up"
                        onPress={() => handleConfirm(wish)}
                        style={{ flex: 1, backgroundColor: "#22c55e" }}
                      >
                        我还想要
                      </Button>
                      <Button
                        mode="outlined"
                        icon="thumb-down"
                        onPress={() => handleGiveUp(wish)}
                        style={{ flex: 1 }}
                      >
                        不想要了
                      </Button>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}

        {displayedWishes.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="gift-outline" size={48} color="#d1d5db" />
            <Text style={{ color: "#9ca3af", marginTop: 8 }}>
              {filter ? "该分类下没有愿望" : "还没有愿望，点击添加吧！"}
            </Text>
          </View>
        )}

        {/* Completed Section - 只在默认视图显示 */}
        {showCompletedSection && (
          <View style={{ marginTop: 16 }}>
            <Text variant="titleMedium" style={{ marginBottom: 8, color: "#6b7280" }}>
              已完成 ({completedWishes.length})
            </Text>
            {completedWishes.map((wish) => {
              const mood = statusMood[wish.status] || statusMood.expired;
              const completedDate = getCompletedDate(wish);

              return (
                <Card key={wish.id} style={[styles.wishCard, { backgroundColor: "#f9fafb" }]}>
                  <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ fontSize: 28 }}>{mood.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium">{wish.name}</Text>
                      <Text variant="bodySmall" style={{ color: "#6b7280" }}>¥{wish.price}</Text>
                      <Text variant="bodySmall" style={{ color: "#9ca3af", marginTop: 2 }}>
                        {completedDate}
                      </Text>
                    </View>
                    {wish.imagePath && (
                      <Image source={{ uri: wish.imagePath }} style={styles.wishThumb} />
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Wish Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>添加新愿望</Dialog.Title>
          <Dialog.Content>
            <Button mode="outlined" icon="camera" onPress={handlePickImage} style={{ marginBottom: 12 }}>
              {imageUri ? "更换照片" : "添加照片"}
            </Button>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={{ width: "100%", height: 120, borderRadius: 8, marginBottom: 12 }} />
            )}
            <TextInput mode="outlined" label="物品名称" value={name} onChangeText={setName} style={{ marginBottom: 8 }} />
            <TextInput mode="outlined" label="价格 (¥)" value={price} onChangeText={setPrice} keyboardType="numeric" />
            <Text variant="bodySmall" style={{ marginTop: 8, color: "#d97706" }}>
              ⭐ 添加后将进入7天冷静期
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>取消</Button>
            <Button onPress={handleAddWish} disabled={!name.trim() || !price}>添加</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <EncourageDialog
        visible={encourage.visible}
        onDismiss={() => setEncourage((p) => ({ ...p, visible: false }))}
        type={encourage.type}
        remainingDays={encourage.remainingDays}
      />
    </View>
  );
}

// ===== 储蓄罐 Tab =====
function SavingsTab() {
  const theme = useTheme();
  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(now());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const currentBudget = useAppStore((s) => s.currentBudget);
  const loadBudget = useAppStore((s) => s.loadBudget);
  const generateBudget = useAppStore((s) => s.generateBudget);

  useEffect(() => {
    loadBudget(displayMonth);
  }, [displayMonth]);

  const budget = currentBudget;
  const total = budget?.totalBudget ?? 0;
  const spent = budget?.spent ?? 0;
  const remaining = budget?.remaining ?? 0;
  const percentage = total > 0 ? Math.max(0, remaining / total) : 0;
  const isOverBudget = remaining < 0;

  const goPrevMonth = () => {
    const [y, m] = displayMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setDisplayMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const goNextMonth = () => {
    const [y, m] = displayMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setDisplayMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const isCurrentMonth = displayMonth === getCurrentMonth();

  return (
    <ScrollView style={styles.tabContainer}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goPrevMonth} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#6b7280" />
        </TouchableOpacity>
        <Text variant="titleMedium" style={styles.monthText}>
          {displayMonth.split("-")[0]}年{parseInt(displayMonth.split("-")[1])}月
        </Text>
        <TouchableOpacity onPress={goNextMonth} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="chevron-right" size={28} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {!budget ? (
        <View style={styles.emptyState}>
          <Text style={{ color: "#6b7280", marginBottom: 12 }}>还没有预算记录</Text>
          {isCurrentMonth ? (
            <Button mode="contained" onPress={generateBudget}>生成本月预算</Button>
          ) : (
            <Text style={{ color: "#9ca3af" }}>该月份暂无预算</Text>
          )}
        </View>
      ) : (
        <>
          <View style={styles.circleContainer}>
            <View style={{ position: "relative", width: 180, height: 180 }}>
              <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
                <Text variant="displaySmall" style={{ fontWeight: "bold", color: isOverBudget ? "#ef4444" : "#22c55e" }}>
                  {isOverBudget ? "超支" : `${Math.round(percentage * 100)}%`}
                </Text>
                <Text variant="bodySmall" style={{ color: "#6b7280" }}>剩余</Text>
              </View>
            </View>
          </View>

          <Card style={styles.detailCard}>
            <Card.Content>
              <View style={styles.detailRow}>
                <Text style={{ color: "#6b7280" }}>基础预算</Text>
                <Text style={{ fontWeight: "600" }}>¥{budget.baseBudget}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: "#6b7280" }}>上月滚存</Text>
                <Text style={{ fontWeight: "600", color: "#3b82f6" }}>+¥{budget.carriedOver}</Text>
              </View>
              <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4 }]}>
                <Text style={{ fontWeight: "600" }}>总预算</Text>
                <Text variant="titleMedium" style={{ fontWeight: "bold" }}>¥{Number(total).toFixed(2)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: "#6b7280" }}>已花费</Text>
                <Text style={{ fontWeight: "600", color: "#f59e0b" }}>¥{Number(spent).toFixed(2)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ fontWeight: "600" }}>剩余</Text>
                <Text variant="titleMedium" style={{ fontWeight: "bold", color: isOverBudget ? "#ef4444" : "#22c55e" }}>
                  ¥{Number(remaining).toFixed(2)}
                </Text>
              </View>
              {isOverBudget && (
                <Text style={{ color: "#ef4444", marginTop: 8 }}>本月已超支，下月预算将减少</Text>
              )}
            </Card.Content>
          </Card>

          {budget.purchasedItems && budget.purchasedItems.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text variant="titleMedium" style={{ marginBottom: 8 }}>已购买</Text>
              {budget.purchasedItems.map((item) => (
                <Card key={item.id} style={{ marginBottom: 8, backgroundColor: "#f0fdf4" }}>
                  <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {item.imagePath && (
                      <Image source={{ uri: item.imagePath }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "600" }}>{item.name}</Text>
                      <Text style={{ color: "#22c55e" }}>¥{item.price}</Text>
                    </View>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#22c55e" />
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ===== 任务 Tab =====
function TasksTab() {
  const tasks = useAppStore((s) => s.tasks);
  const starCount = useAppStore((s) => s.starCount);
  const loadTasks = useAppStore((s) => s.loadTasks);
  const completeTask = useAppStore((s) => s.completeTask);

  useEffect(() => { loadTasks(); }, []);

  const daily = tasks.filter((t) => t.type === "daily");
  const weekly = tasks.filter((t) => t.type === "weekly");
  const special = tasks.filter((t) => t.type === "special");

  const TaskGroup = ({ title, items }: { title: string; items: typeof tasks }) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: "600" }}>{title}</Text>
        {items.map((task) => (
          <Card key={task.id} style={[styles.taskCard, task.completed ? { opacity: 0.6 } : {}]}>
            <Card.Content style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <MaterialCommunityIcons
                name={task.completed ? "check-circle" : "checkbox-blank-circle-outline"}
                size={24}
                color={task.completed ? "#22c55e" : "#f59e0b"}
              />
              <View style={{ flex: 1 }}>
                <Text style={task.completed ? { textDecorationLine: "line-through", color: "#9ca3af" } : {}}>
                  {task.title}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MaterialCommunityIcons name="star" size={14} color="#f59e0b" />
                  <Text variant="bodySmall" style={{ color: "#f59e0b" }}>+{task.stars}</Text>
                  {task.requiresParentConfirm === 1 && (
                    <Text variant="bodySmall" style={{ color: "#3b82f6" }}>(需家长确认)</Text>
                  )}
                </View>
              </View>
              {!task.completed && (
                <Button mode="outlined" compact onPress={() => completeTask(task.id)}>
                  完成
                </Button>
              )}
            </Card.Content>
          </Card>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.tabContainer}>
      <View style={styles.starBanner}>
        <MaterialCommunityIcons name="star" size={32} color="#fff" />
        <Text variant="displaySmall" style={{ color: "#fff", fontWeight: "bold" }}>{starCount}</Text>
        <Text style={{ color: "#fff", opacity: 0.9 }}>当前星星数</Text>
      </View>

      <TaskGroup title="每日任务" items={daily} />
      <TaskGroup title="每周任务" items={weekly} />
      <TaskGroup title="特殊任务" items={special} />

      <Card style={{ backgroundColor: "#f3e8ff", marginTop: 8 }}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: "#7c3aed", marginBottom: 8 }}>星星兑换特权</Text>
          <Text variant="bodySmall" style={{ color: "#7c3aed" }}>5⭐ = 决定周末活动</Text>
          <Text variant="bodySmall" style={{ color: "#7c3aed" }}>10⭐ = 晚睡30分钟</Text>
          <Text variant="bodySmall" style={{ color: "#7c3aed" }}>15⭐ = 选择晚餐菜单</Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

// ===== 我的 Tab =====
function MyTab() {
  const theme = useTheme();
  const { user, logout, refreshUser } = useAuthStore();
  const setAppMode = useAppStore((s) => s.setAppMode);
  const starCount = useAppStore((s) => s.starCount);
  const loadTasks = useAppStore((s) => s.loadTasks);

  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState(user?.username ?? "");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  // 家长密码弹框
  const [parentPwDialog, setParentPwDialog] = useState(false);
  const [parentPassword, setParentPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => { loadTasks(); }, []);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        await AuthService.updateProfile({ avatar: result.assets[0].uri });
        await refreshUser();
      } catch (e: any) {
        Alert.alert("错误", e.message || "更换头像失败");
      }
    }
  };

  const handleSaveName = async () => {
    setEditError("");
    if (!newName.trim()) { setEditError("用户名不能为空"); return; }
    setSaving(true);
    try {
      await AuthService.updateProfile({ username: newName.trim() });
      await refreshUser();
      setEditNameVisible(false);
    } catch (e: any) {
      setEditError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToParent = async () => {
    setPwError("");
    if (!parentPassword) { setPwError("请输入家长密码"); return; }
    setVerifying(true);
    try {
      const valid = await AuthService.verifyParentPassword(parentPassword);
      if (valid) {
        setAppMode("parent");
        setParentPwDialog(false);
        setParentPassword("");
        logger.info("Switched to parent mode");
      } else {
        setPwError("家长密码错误");
      }
    } catch (e: any) {
      setPwError(e.message || "验证失败");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("确认退出", "确定要退出登录吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => logout() },
    ]);
  };

  // 调试时间面板
  const [simDate, setSimDate] = useState(new Date(now()));
  const refreshSimDate = () => setSimDate(new Date(now()));

  const DevPanel = () => (
    <Card style={{ marginTop: 16, backgroundColor: "#1f2937", borderRadius: 12 }}>
      <Card.Content>
        <Text variant="titleSmall" style={{ color: "#fbbf24", marginBottom: 8 }}>🛠 调试时间面板</Text>
        <Text style={{ color: "#e5e7eb", marginBottom: 12 }}>
          模拟时间: {simDate.toLocaleString("zh-CN")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button mode="contained" compact buttonColor="#f59e0b" onPress={() => { advanceTime(1 * 24 * 60 * 60 * 1000); refreshSimDate(); }}>
            +1天
          </Button>
          <Button mode="contained" compact buttonColor="#f59e0b" onPress={() => { advanceTime(7 * 24 * 60 * 60 * 1000); refreshSimDate(); }}>
            +7天
          </Button>
          <Button mode="contained" compact buttonColor="#f59e0b" onPress={() => { advanceTime(30 * 24 * 60 * 60 * 1000); refreshSimDate(); }}>
            +30天
          </Button>
          <Button mode="outlined" compact textColor="#ef4444" onPress={() => { resetTime(); refreshSimDate(); }}>
            重置
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.tabContainer}>
      <Card style={{ marginBottom: 16, borderRadius: 16 }}>
        <Card.Content style={{ alignItems: "center", paddingVertical: 24 }}>
          <View style={{ position: "relative" }}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            ) : (
              <MaterialCommunityIcons name="account-circle" size={100} color={theme.colors.primary} />
            )}
            <Button
              mode="contained"
              compact
              icon="camera"
              onPress={handlePickAvatar}
              style={{ position: "absolute", bottom: -4, right: -4, borderRadius: 20 }}
              labelStyle={{ fontSize: 10 }}
            >
              更换
            </Button>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 }}>
            <Text variant="titleLarge" style={{ fontWeight: "bold" }}>
              {user?.username ?? "小朋友"}
            </Text>
            <TouchableOpacity onPress={() => { setNewName(user?.username ?? ""); setEditNameVisible(true); setEditError(""); }} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="pencil" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 }}>
            <MaterialCommunityIcons name="star" size={20} color="#f59e0b" />
            <Text variant="titleMedium" style={{ color: "#f59e0b", fontWeight: "bold" }}>{starCount} 颗星星</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Card.Content style={{ gap: 8 }}>
          <Button mode="outlined" icon="shield-account" onPress={() => { setParentPwDialog(true); setParentPassword(""); setPwError(""); }}>
            家长模式
          </Button>
          <Button mode="outlined" icon="logout" textColor="#ef4444" onPress={handleLogout}>
            退出登录
          </Button>
        </Card.Content>
      </Card>

      {true && <DevPanel />}

      {/* Edit Name Dialog */}
      <Portal>
        <Dialog visible={editNameVisible} onDismiss={() => setEditNameVisible(false)}>
          <Dialog.Title>修改昵称</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="新昵称" value={newName} onChangeText={setNewName} error={!!editError} />
            {editError ? <Text style={{ color: "#ef4444", marginTop: 8 }}>{editError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditNameVisible(false)}>取消</Button>
            <Button onPress={handleSaveName} loading={saving} disabled={saving}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Parent Password Dialog */}
      <Portal>
        <Dialog visible={parentPwDialog} onDismiss={() => setParentPwDialog(false)}>
          <Dialog.Title>进入家长模式</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 12, color: "#666" }}>
              请输入家长密码验证身份
            </Text>
            <TextInput
              mode="outlined"
              label="家长密码"
              secureTextEntry
              value={parentPassword}
              onChangeText={setParentPassword}
              error={!!pwError}
            />
            {pwError ? <Text style={{ color: "#ef4444", marginTop: 8 }}>{pwError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setParentPwDialog(false)}>取消</Button>
            <Button onPress={handleSwitchToParent} loading={verifying} disabled={verifying}>确认</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

// ===== Tab Navigator =====
export default function KidHome() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = "help-circle";
          if (route.name === "Wishes") iconName = focused ? "gift" : "gift-outline";
          else if (route.name === "Savings") iconName = focused ? "piggy-bank" : "piggy-bank-outline";
          else if (route.name === "Tasks") iconName = focused ? "star" : "star-outline";
          else if (route.name === "My") iconName = focused ? "account" : "account-outline";
          return <MaterialCommunityIcons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#d97706",
        tabBarInactiveTintColor: "#9ca3af",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Wishes" component={WishesTab} options={{ tabBarLabel: "愿望" }} />
      <Tab.Screen name="Savings" component={SavingsTab} options={{ tabBarLabel: "储蓄罐" }} />
      <Tab.Screen name="Tasks" component={TasksTab} options={{ tabBarLabel: "任务" }} />
      <Tab.Screen name="My" component={MyTab} options={{ tabBarLabel: "我的" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabContainer: { flex: 1, padding: 16, backgroundColor: "#fffbeb" },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fffbeb",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    zIndex: 20,
  },
  headerBtn: { padding: 4, width: 40, alignItems: "center" },
  headerTitle: { fontWeight: "bold", color: "#1f2937", textAlign: "center", flex: 1 },
  wishCard: { marginBottom: 12, borderRadius: 12 },
  wishThumb: { width: 72, height: 72, borderRadius: 10 },
  wishHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  emptyState: { alignItems: "center", marginTop: 48 },
  encourageDialog: { borderRadius: 16 },
  encourageContent: { alignItems: "center", paddingVertical: 16 },
  encourageEmoji: { fontSize: 56, marginBottom: 8 },
  encourageTitle: { color: "#d97706", fontWeight: "bold", marginBottom: 8 },
  encourageText: { textAlign: "center", color: "#4b5563" },
  encourageHighlight: { fontWeight: "bold", color: "#d97706", fontSize: 24 },
  encourageSub: { color: "#9ca3af", marginTop: 4, marginBottom: 16 },
  encourageButton: { width: "100%" },
  monthNav: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  monthText: { minWidth: 120, textAlign: "center", fontWeight: "600" },
  circleContainer: { alignItems: "center", marginVertical: 16 },
  detailCard: { borderRadius: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  starBanner: { backgroundColor: "#f59e0b", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  taskCard: { marginBottom: 8, borderRadius: 10 },
});
