import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Switch,
  Pressable,
  Linking,
  Clipboard,
  Alert,
  Image,
  useWindowDimensions,
} from "react-native";
import {
  Text,
  Avatar,
  Portal,
  Modal,
  TextInput,
  Button,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSheetStore } from "../../../stores/useSheetStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { StatusBar } from "expo-status-bar";
import { useSegments } from "expo-router";
import ScreenTransition from "../../../components/ScreenTransition";
import AnimatedCard from "../../../components/AnimatedCard";
import { Ionicons } from "@expo/vector-icons";
import GoogleLogo from "../../../components/GoogleLogo";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

interface BudgetBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (cash: number, paylater: number) => Promise<void>;
  initialCash: string;
  initialPaylater: string;
}

function BudgetBottomSheet({
  visible,
  onDismiss,
  onSave,
  initialCash,
  initialPaylater,
}: BudgetBottomSheetProps) {
  const [cashInput, setCashInput] = useState(initialCash);
  const [paylaterInput, setPaylaterInput] = useState(initialPaylater);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCashInput(initialCash);
      setPaylaterInput(initialPaylater);
      setErrorMsg(null);
    }
  }, [visible, initialCash, initialPaylater]);

  const animatedValue = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      animatedValue.value = withSpring(1, {
        damping: 20,
        stiffness: 180,
        mass: 0.8,
      });
    } else {
      animatedValue.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible]);

  const handleSave = async () => {
    const cash = parseInt(cashInput, 10);
    const paylater = paylaterInput ? parseInt(paylaterInput, 10) : 0;
    
    if (isNaN(cash) || cash < 0) {
      setErrorMsg("Budget tunai harus berupa angka positif.");
      return;
    }
    if (isNaN(paylater) || paylater < 0) {
      setErrorMsg("Budget paylater harus berupa angka positif.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(cash, paylater);
      onDismiss();
    } catch (err) {
      setErrorMsg("Gagal menyimpan budget.");
    } finally {
      setIsSaving(false);
    }
  };

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
  }));

  const screenHeight = useWindowDimensions().height;
  const sheetAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: (1 - animatedValue.value) * screenHeight }],
    };
  });

  if (!shouldRender) return null;

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !isSaving && onDismiss()} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheetContainer, sheetAnimatedStyle]}>
          <View style={styles.sheetIndicator} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Atur Anggaran</Text>
            <Pressable onPress={() => !isSaving && onDismiss()} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#1E293B" />
            </Pressable>
          </View>

          <Text style={styles.sheetSubtitle}>
            Tentukan limit anggaran bulananmu.
          </Text>

          {errorMsg && <Text style={styles.modalError}>{errorMsg}</Text>}

          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={styles.timeInputLabel}>Budget Tunai</Text>
            <TextInput
              mode="outlined"
              value={cashInput}
              onChangeText={setCashInput}
              keyboardType="numeric"
              style={{ backgroundColor: '#FFFFFF', marginTop: 8 }}
              activeOutlineColor="#FF90BB"
              outlineColor="#CBD5E1"
              outlineStyle={{ borderRadius: 12 }}
              left={<TextInput.Affix text="Rp " />}
            />
          </View>

          <View style={{ width: '100%', marginBottom: 24 }}>
            <Text style={styles.timeInputLabel}>Budget Paylater (Opsional)</Text>
            <TextInput
              mode="outlined"
              value={paylaterInput}
              onChangeText={setPaylaterInput}
              keyboardType="numeric"
              style={{ backgroundColor: '#FFFFFF', marginTop: 8 }}
              activeOutlineColor="#FF90BB"
              outlineColor="#CBD5E1"
              outlineStyle={{ borderRadius: 12 }}
              left={<TextInput.Affix text="Rp " />}
              placeholder="0"
            />
          </View>

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => onDismiss()}
              style={[styles.modalCancel, { borderColor: "#CBD5E1" }]}
              textColor="#64748B"
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.modalSave}
              textColor="#FFFFFF"
              loading={isSaving}
              disabled={isSaving}
            >
              Simpan
            </Button>
          </View>
        </Animated.View>
      </View>
    </Portal>
  );
}

export default function SettingsScreen() {
  const { user, token, logout } = useAuthStore();
  const { spreadsheetId, totalBudgetCash, budgetPaylater, updateStoreBudgets, resetAllData } = useSheetStore();
  const segments = useSegments() as any;
  const isFocused = segments.includes("settings");
  const {
    reminderEnabled,
    reminderHour,
    reminderMinute,
    loadSettings,
    updateReminder,
  } = useSettingsStore();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
  const [hourInput, setHourInput] = useState("20");
  const [minuteInput, setMinuteInput] = useState("00");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
  const [cashBudgetInput, setCashBudgetInput] = useState("");
  const [paylaterBudgetInput, setPaylaterBudgetInput] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggleReminder = async (val: boolean) => {
    await updateReminder(val, reminderHour, reminderMinute);
  };

  const handleOpenTimeModal = () => {
    setHourInput(String(reminderHour).padStart(2, "0"));
    setMinuteInput(String(reminderMinute).padStart(2, "0"));
    setErrorMsg(null);
    setIsTimeModalVisible(true);
  };

  const handleSaveTime = async () => {
    const hr = parseInt(hourInput, 10);
    const min = parseInt(minuteInput, 10);

    if (isNaN(hr) || hr < 0 || hr > 23) {
      setErrorMsg("Jam harus di antara 0 dan 23.");
      return;
    }
    if (isNaN(min) || min < 0 || min > 59) {
      setErrorMsg("Menit harus di antara 0 dan 59.");
      return;
    }

    await updateReminder(reminderEnabled, hr, min);
    setIsTimeModalVisible(false);
  };

  const handleOpenBudgetModal = () => {
    setCashBudgetInput(totalBudgetCash !== null ? String(totalBudgetCash) : "0");
    setPaylaterBudgetInput(budgetPaylater !== null ? String(budgetPaylater) : "");
    setErrorMsg(null);
    setIsBudgetModalVisible(true);
  };

  const handleSaveBudget = async (cash: number, paylater: number) => {
    if (token) {
      await updateStoreBudgets(token, cash, paylater);
    }
  };

  const handleOpenResetModal = () => {
    setIsResetModalVisible(true);
  };

  const handleConfirmReset = async () => {
    setIsResettingData(true);
    try {
      if (token) {
        await resetAllData(token);
      }
      setIsResetModalVisible(false);
      Alert.alert("Sukses", "Seluruh data telah di-reset dan dimulai dari awal.");
    } catch (err) {
      Alert.alert("Error", "Gagal melakukan reset data.");
    } finally {
      setIsResettingData(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <ScreenTransition triggerKey={String(isFocused)} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom > 0 ? insets.bottom + 110 : 130 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <AnimatedCard
            index={0}
            triggerKey={String(isFocused)}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>Pengaturan</Text>
            <Text style={styles.headerSubtitle}>
              Sesuaikan notifikasi dan koneksi database
            </Text>
          </AnimatedCard>

          {/* Profile Header Card */}
          <AnimatedCard
            index={1}
            triggerKey={String(isFocused)}
            style={styles.profileCard}
          >
            <View style={styles.profileLeft}>
              {user?.picture ? (
                <Avatar.Image
                  size={56}
                  source={{ uri: user.picture }}
                  style={styles.avatar}
                />
              ) : (
                <Avatar.Text
                  size={56}
                  label={user?.name?.slice(0, 2).toUpperCase() || "FT"}
                  style={[styles.avatar, { backgroundColor: "#FF90BB" }]}
                  labelStyle={{
                    fontFamily: "Poppins_600SemiBold",
                    color: "#FFFFFF",
                  }}
                />
              )}
              <View
                style={[
                  styles.profileTextContainer,
                  { marginRight: width < 375 ? 0 : 90 },
                ]}
              >
                <Text style={styles.userName}>
                  {user?.name || "User SiPaling Hemat"}
                </Text>
                <Text style={styles.userEmail}>
                  {user?.email || "user@example.com"}
                </Text>

                <View style={styles.googleBadge}>
                  <GoogleLogo size={10} style={{ marginRight: 6 }} />
                  <Text style={styles.googleBadgeText}>
                    Terhubung dengan Google
                  </Text>
                </View>
              </View>
            </View>

            {width >= 375 && (
              <Image
                source={require("../../../../assets/images/settings-illustration-nobg.png")}
                style={styles.illustration}
                resizeMode="contain"
              />
            )}
          </AnimatedCard>

          {/* Notification Settings */}
          <AnimatedCard
            index={2}
            triggerKey={String(isFocused)}
            style={styles.settingsSection}
          >
            <Text style={styles.sectionTitle}>Pengingat Harian</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View
                  style={[styles.iconCircle, { backgroundColor: "#FFEBF0" }]}
                >
                  <Ionicons name="notifications" size={20} color="#FF90BB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Notifikasi Harian</Text>
                  <Text style={styles.settingDesc}>
                    Terima pengingat harian untuk mencatat keuangan Anda
                  </Text>
                </View>
                <Switch
                  value={reminderEnabled}
                  onValueChange={handleToggleReminder}
                  trackColor={{ false: "#CBD5E1", true: "#FFC1DA" }}
                  thumbColor={reminderEnabled ? "#FF90BB" : "#F1F5F9"}
                />
              </View>

              {reminderEnabled && (
                <Pressable
                  onPress={handleOpenTimeModal}
                  style={({ pressed }) => [
                    styles.timePickerRow,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.timeLabel}>Waktu Pengingat</Text>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeBadgeText}>
                      {String(reminderHour).padStart(2, "0")}:
                      {String(reminderMinute).padStart(2, "0")}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>

            {reminderEnabled && (
              <View style={styles.greenBanner}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#10B981"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.greenBannerText}>
                  Pengingat Harian aktif • Anda akan menerima notifikasi setiap
                  hari
                </Text>
                <View style={styles.dotPattern}>
                  <View style={styles.patternRow}>
                    <View style={styles.patternDot} />
                    <View style={styles.patternDot} />
                  </View>
                  <View style={styles.patternRow}>
                    <View style={styles.patternDot} />
                    <View style={styles.patternDot} />
                  </View>
                </View>
              </View>
            )}
          </AnimatedCard>

          {/* Budget Settings */}
          <AnimatedCard
            index={2.5}
            triggerKey={String(isFocused)}
            style={styles.settingsSection}
          >
            <Text style={styles.sectionTitle}>Anggaran Bulanan</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View
                  style={[styles.iconCircle, { backgroundColor: "#E6F7F9" }]}
                >
                  <Ionicons name="wallet" size={20} color="#8ACCD5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Atur Anggaran</Text>
                  <Text style={styles.settingDesc}>
                    Atur limit budget bulananmu
                  </Text>
                </View>
                <Pressable
                  onPress={handleOpenBudgetModal}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    pressed && { backgroundColor: "#F0FDFA" },
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color="#8ACCD5"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.outlineBtnText}>Ubah</Text>
                </Pressable>
              </View>

              <View style={styles.timePickerRow}>
                <Text style={styles.timeLabel}>Budget Tunai</Text>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>
                    Rp {totalBudgetCash?.toLocaleString('id-ID') || '0'}
                  </Text>
                </View>
              </View>

              <View style={styles.timePickerRow}>
                <Text style={styles.timeLabel}>Budget Paylater</Text>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>
                    Rp {budgetPaylater ? budgetPaylater.toLocaleString('id-ID') : '0'}
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedCard>

          {/* Database Settings */}
          <AnimatedCard
            index={3}
            triggerKey={String(isFocused)}
            style={styles.settingsSection}
          >
            <Text style={styles.sectionTitle}>Database (Google Sheets)</Text>
            <View style={styles.settingsCard}>
              <View
                style={[
                  styles.databaseRow,
                  {
                    flexDirection: width < 375 ? "column" : "row",
                    alignItems: width < 375 ? "flex-start" : "center",
                    gap: width < 375 ? 12 : 0,
                  },
                ]}
              >
                <View style={styles.databaseInfo}>
                  <Text style={styles.infoLabel}>Nama Spreadsheet</Text>
                  <Text style={styles.infoValue}>SiPaling Hemat Data</Text>
                </View>
                {spreadsheetId ? (
                  <Pressable
                    onPress={() => {
                      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
                      Linking.openURL(url).catch((err) =>
                        console.error("Failed to open spreadsheet:", err),
                      );
                    }}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                      pressed && { backgroundColor: "#F0FDFA" },
                    ]}
                  >
                    <Ionicons
                      name="open-outline"
                      size={14}
                      color="#8ACCD5"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.outlineBtnText}>Buka Spreadsheet</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.divider} />

              <View style={styles.databaseRow}>
                <View
                  style={[styles.databaseInfo, { flex: 1, marginRight: 12 }]}
                >
                  <Text style={styles.infoLabel}>ID Spreadsheet</Text>
                  <Text
                    style={styles.infoValue}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {spreadsheetId || "Belum diinisialisasi"}
                  </Text>
                </View>
                {spreadsheetId ? (
                  <Pressable
                    onPress={() => {
                      Clipboard.setString(spreadsheetId);
                      Alert.alert(
                        "ID Tersalin",
                        "ID Spreadsheet telah disalin ke clipboard.",
                      );
                    }}
                    style={({ pressed }) => [
                      styles.copyBtn,
                      pressed && { backgroundColor: "#F1F5F9" },
                    ]}
                  >
                    <Ionicons name="copy-outline" size={14} color="#64748B" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.blueBanner}>
              <Ionicons
                name="information-circle"
                size={18}
                color="#2563EB"
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1, zIndex: 2 }}>
                <Text style={styles.blueBannerTitle}>
                  Data keuangan Anda disimpan aman di Google Sheets.
                </Text>
                <Text style={styles.blueBannerDesc}>
                  Pastikan ID Spreadsheet tidak dibagikan ke sembarang orang.
                </Text>
              </View>
              {width >= 375 && (
                <View style={styles.shieldBackground}>
                  <Ionicons name="shield-checkmark" size={48} color="#2563EB" />
                </View>
              )}
            </View>
          </AnimatedCard>

          {/* Danger Zone */}
          <AnimatedCard
            index={4}
            triggerKey={String(isFocused)}
            style={styles.settingsSection}
          >
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Zona Bahaya</Text>
            <View style={[styles.settingsCard, { borderColor: '#FEE2E2', borderWidth: 1 }]}>
              <View style={styles.settingRow}>
                <View
                  style={[styles.iconCircle, { backgroundColor: "#FEF2F2" }]}
                >
                  <Ionicons name="warning" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: '#B91C1C' }]}>Reset Data</Text>
                  <Text style={styles.settingDesc}>
                    Hapus seluruh data transaksi dan mulai dari awal
                  </Text>
                </View>
                <Pressable
                  onPress={handleOpenResetModal}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    { borderColor: '#EF4444' },
                    pressed && { backgroundColor: "#FEF2F2" },
                  ]}
                >
                  <Text style={[styles.outlineBtnText, { color: '#EF4444' }]}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </AnimatedCard>

          {/* App Info & Sign Out */}
          <AnimatedCard
            index={5}
            triggerKey={String(isFocused)}
            style={styles.bottomSection}
          >
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && { opacity: 0.95 },
              ]}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.signOutButtonText}>Keluar</Text>
            </Pressable>
            <Text style={styles.appVersion}>SiPaling Hemat v1.0.0</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
              <Text style={[styles.thankYouText, { marginTop: 0 }]}>Made with </Text>
              <Text style={{ fontSize: 10 }}>❤️</Text>
              <Text style={[styles.thankYouText, { marginTop: 0 }]}> by Sazlab</Text>
            </View>
          </AnimatedCard>
        </ScrollView>
      </ScreenTransition>

      {/* Time Picker Modal */}
      <Portal>
        <Modal
          visible={isTimeModalVisible}
          onDismiss={() => setIsTimeModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Atur Waktu Pengingat</Text>
          <Text style={styles.modalSubtitle}>
            Konfigurasikan waktu untuk pengingat pencatatan harian
          </Text>

          {errorMsg && <Text style={styles.modalError}>{errorMsg}</Text>}

          <View style={styles.timeInputsRow}>
            <View style={styles.timeInputCol}>
              <Text style={styles.timeInputLabel}>Jam (0-23)</Text>
              <TextInput
                mode="outlined"
                value={hourInput}
                onChangeText={setHourInput}
                keyboardType="numeric"
                style={styles.timeTextInput}
                maxLength={2}
                activeOutlineColor="#FF90BB"
                outlineColor="#CBD5E1"
                outlineStyle={{ borderRadius: 12 }}
              />
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeInputCol}>
              <Text style={styles.timeInputLabel}>Menit (0-59)</Text>
              <TextInput
                mode="outlined"
                value={minuteInput}
                onChangeText={setMinuteInput}
                keyboardType="numeric"
                style={styles.timeTextInput}
                maxLength={2}
                activeOutlineColor="#FF90BB"
                outlineColor="#CBD5E1"
                outlineStyle={{ borderRadius: 12 }}
              />
            </View>
          </View>

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setIsTimeModalVisible(false)}
              style={[styles.modalCancel, { borderColor: "#CBD5E1" }]}
              textColor="#64748B"
            >
              Batal
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveTime}
              style={styles.modalSave}
              textColor="#FFFFFF"
            >
              Simpan
            </Button>
          </View>
        </Modal>

        <BudgetBottomSheet
          visible={isBudgetModalVisible}
          onDismiss={() => setIsBudgetModalVisible(false)}
          onSave={handleSaveBudget}
          initialCash={totalBudgetCash !== null ? String(totalBudgetCash) : "0"}
          initialPaylater={budgetPaylater !== null ? String(budgetPaylater) : ""}
        />

        {/* Reset Confirmation Modal */}
        <Modal
          visible={isResetModalVisible}
          onDismiss={() => !isResettingData && setIsResetModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2', width: 56, height: 56, borderRadius: 28, marginBottom: 16 }]}>
            <Ionicons name="warning" size={28} color="#EF4444" />
          </View>
          <Text style={[styles.modalTitle, { color: '#B91C1C' }]}>Reset Seluruh Data?</Text>
          <Text style={styles.modalSubtitle}>
            Tindakan ini akan menghapus semua riwayat transaksi Anda secara permanen dan mereset budget. Apakah Anda yakin ingin memulai dari awal?
          </Text>

          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setIsResetModalVisible(false)}
              style={[styles.modalCancel, { borderColor: "#CBD5E1" }]}
              textColor="#64748B"
              disabled={isResettingData}
            >
              Batal
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmReset}
              style={[styles.modalSave, { backgroundColor: '#EF4444' }]}
              textColor="#FFFFFF"
              loading={isResettingData}
              disabled={isResettingData}
            >
              Reset Data
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // slate-50 background for clean, modern premium aesthetics
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: "#1E293B",
  },
  headerSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#FF90BB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  profileLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  avatar: {
    marginRight: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  userName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#1E293B",
  },
  userEmail: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  googleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  googleBadgeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: "#64748B",
  },
  illustration: {
    width: 140,
    height: 120,
    position: "absolute",
    right: -10,
    // bottom: -10,
    zIndex: 1,
    opacity: 0.95,
  },
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: "#1E293B",
    marginBottom: 12,
    paddingLeft: 4,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#1E293B",
  },
  settingDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    paddingRight: 8,
    lineHeight: 16,
  },
  timePickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  timeLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#1E293B",
  },
  timeBadge: {
    backgroundColor: "#FFEBEF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF90BB",
  },
  timeBadgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "#FF90BB",
  },
  greenBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5", // Emerald 50
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0", // Emerald 200
    position: "relative",
    overflow: "hidden",
  },
  greenBannerText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#065F46", // Emerald 800
    flex: 1,
  },
  dotPattern: {
    position: "absolute",
    right: 12,
    top: 14,
    opacity: 0.15,
    flexDirection: "column",
    gap: 4,
  },
  patternRow: {
    flexDirection: "row",
    gap: 4,
  },
  patternDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#059669",
  },
  databaseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  databaseInfo: {
    paddingVertical: 2,
  },
  infoLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#94A3B8", // Slate 400
  },
  infoValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: "#1E293B",
    marginTop: 4,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#8ACCD5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  outlineBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: "#8ACCD5",
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },
  blueBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF", // Blue 50
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE", // Blue 200
    position: "relative",
    overflow: "hidden",
  },
  blueBannerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
    color: "#1D4ED8", // Blue 700
  },
  blueBannerDesc: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#1D4ED8",
    opacity: 0.8,
    marginTop: 2,
  },
  shieldBackground: {
    position: "absolute",
    right: 8,
    // bottom: -6,
    opacity: 0.08,
  },
  bottomSection: {
    alignItems: "center",
    marginTop: 16,
    paddingBottom: 20,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF90BB",
    borderRadius: 14,
    width: "100%",
    paddingVertical: 14,
    shadowColor: "#FF90BB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  signOutButtonText: {
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
    fontSize: 15,
  },
  appVersion: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 16,
  },
  thankYouText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    margin: 24,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#1E293B",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  modalError: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: "#EF4444",
    marginBottom: 12,
  },
  timeInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  timeInputCol: {
    alignItems: "center",
    width: 80,
  },
  timeInputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: "#64748B",
    marginBottom: 6,
  },
  timeTextInput: {
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    fontSize: 18,
    width: "100%",
  },
  timeSeparator: {
    fontFamily: "Poppins_700Bold",
    fontSize: 28,
    color: "#1E293B",
    marginHorizontal: 12,
    marginTop: 14,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  modalSave: {
    flex: 1,
    backgroundColor: "#FF90BB",
    borderRadius: 12,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 20,
  },
  sheetIndicator: {
    width: 48,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: "#1E293B",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#64748B",
    marginBottom: 20,
    lineHeight: 18,
  },
});
