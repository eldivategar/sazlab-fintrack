import React, { useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput as RNTextInput,
  Dimensions,
  Modal as RNModal,
} from "react-native";
import { Text, Portal } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSheetStore, Transaction } from "../../../stores/useSheetStore";
import { StatusBar } from "expo-status-bar";
import {
  Swipeable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useSegments, useRouter } from "expo-router";
import { MotiView } from "moti";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import ScreenTransition from "../../../components/ScreenTransition";
import AnimatedCard from "../../../components/AnimatedCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary: "#FF90BB",
  secondary: "#FFC1DA",
  surface: "#F8F8E1",
  accent: "#8ACCD5",
  bg: "#F9F9F9",
  white: "#FFFFFF",
  text: "#1E293B",
  subtext: "#64748B",
  border: "#F3F4F6",
  incomeGreen: "#10B981",
  expenseRed: "#EF4444",
};

type QuickFilter = "all" | "today" | "thisWeek" | "thisMonth";

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "today", label: "Hari Ini" },
  { id: "thisWeek", label: "Minggu Ini" },
  { id: "thisMonth", label: "Bulan Ini" },
];

const CATEGORIES = [
  "Semua",
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan & Utilitas",
  "Hiburan",
  "Gaji",
  "Investasi",
  "Sampingan",
  "Hadiah",
  "Lainnya",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (num: number) => {
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const formatted = absNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${isNegative ? "-" : ""}Rp ${formatted}`;
};

const cleanCategory = (cat: string) => {
  const clean = cat.replace(/^(Pemasukan|Pengeluaran):\s*/, "").trim();
  const mapping: { [key: string]: string } = {
    "Food & Beverage": "Makanan & Minuman",
    Transportation: "Transportasi",
    Shopping: "Belanja",
    "Bills & Utilities": "Tagihan & Utilitas",
    Entertainment: "Hiburan",
    Others: "Lainnya",
    Salary: "Gaji",
    Investment: "Investasi",
    "Side Hustle": "Sampingan",
    Gift: "Hadiah",
  };
  return mapping[clean] || clean;
};

const getCategoryEmoji = (cat: string) => {
  const clean = cleanCategory(cat).toLowerCase();
  if (clean.includes("makan") || clean.includes("minum") || clean.includes("food") || clean.includes("beverage")) return "🍕";
  if (clean.includes("transport") || clean.includes("mobil") || clean.includes("motor")) return "🚗";
  if (clean.includes("shop") || clean.includes("belanja")) return "🛍️";
  if (clean.includes("bill") || clean.includes("util") || clean.includes("tagihan") || clean.includes("listrik")) return "💡";
  if (clean.includes("entertain") || clean.includes("hiburan") || clean.includes("bioskop")) return "🎬";
  if (clean.includes("salary") || clean.includes("gaji")) return "💼";
  if (clean.includes("invest") || clean.includes("saham")) return "📈";
  if (clean.includes("side") || clean.includes("sampingan") || clean.includes("freelance")) return "🚀";
  if (clean.includes("gift") || clean.includes("hadiah")) return "🎁";
  return "💰";
};

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const getDateRangeForFilter = (filter: QuickFilter): { start: string; end: string } | null => {
  const now = new Date();
  if (filter === "all") return null;
  if (filter === "today") {
    const today = toDateStr(now);
    return { start: today, end: today };
  }
  if (filter === "thisWeek") {
    const day = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day);
    return { start: toDateStr(startOfWeek), end: toDateStr(now) };
  }
  if (filter === "thisMonth") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toDateStr(startOfMonth), end: toDateStr(now) };
  }
  return null;
};

const formatDateGroupLabel = (dateStr: string) => {
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Hari Ini";
  if (dateStr === yesterday) return "Kemarin";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return dateStr;
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ transactions }: { transactions: Transaction[] }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthlyTransactions = transactions.filter((tx) =>
    tx.tanggal.startsWith(currentMonth)
  );

  const totalExpense = monthlyTransactions
    .filter((tx) => tx.kategori.startsWith("Pengeluaran:"))
    .reduce((sum, tx) => sum + tx.nominal, 0);

  const totalIncome = monthlyTransactions
    .filter((tx) => tx.kategori.startsWith("Pemasukan:"))
    .reduce((sum, tx) => sum + tx.nominal, 0);

  const count = monthlyTransactions.length;

  return (
    <AnimatedCard index={0} style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryIconWrap}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.white} />
        </View>
        <Text style={styles.summaryLabel}>Total Bulan Ini</Text>
        <View style={styles.summaryCountBadge}>
          <Text style={styles.summaryCountText}>{count} transaksi</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: "#FFC1DA" }]} />
          <View>
            <Text style={styles.summaryAmountLabel}>Pengeluaran</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.expenseRed }]}>
              {formatRupiah(totalExpense)}
            </Text>
          </View>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: COLORS.accent }]} />
          <View>
            <Text style={styles.summaryAmountLabel}>Pemasukan</Text>
            <Text style={[styles.summaryAmount, { color: COLORS.incomeGreen }]}>
              {formatRupiah(totalIncome)}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedCard>
  );
}

function SearchBar({
  search,
  setSearch,
  onFilterPress,
  filterActive,
}: {
  search: string;
  setSearch: (v: string) => void;
  onFilterPress: () => void;
  filterActive: boolean;
}) {
  return (
    <AnimatedCard index={1} style={styles.searchBarWrap}>
      <View style={styles.searchBarInner}>
        <Ionicons name="search-outline" size={18} color={COLORS.subtext} style={styles.searchIcon} />
        <RNTextInput
          style={styles.searchInput}
          placeholder="Cari transaksi..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color="#94A3B8" />
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={onFilterPress}
        style={[
          styles.filterBtn,
          filterActive && { backgroundColor: COLORS.secondary },
        ]}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={filterActive ? COLORS.white : COLORS.subtext}
        />
      </Pressable>
    </AnimatedCard>
  );
}

function QuickFilterChips({
  active,
  onSelect,
}: {
  active: QuickFilter;
  onSelect: (id: QuickFilter) => void;
}) {
  return (
    <AnimatedCard index={2}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {QUICK_FILTERS.map((f) => {
          const isActive = active === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => onSelect(f.id)}
              style={[
                styles.chip,
                isActive ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? COLORS.white : COLORS.accent },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </AnimatedCard>
  );
}

function EmptyState({ onAddPress }: { onAddPress: () => void }) {
  return (
    <AnimatedCard index={3} style={styles.emptyWrapper}>
      {/* Decorative circles */}
      <View style={styles.emptyDecoTop} />
      <View style={styles.emptyDecoBottom} />

      <View style={styles.emptyIconArea}>
        <View style={styles.emptyIconCircleOuter}>
          <View style={styles.emptyIconCircleInner}>
            <Ionicons name="receipt-outline" size={44} color={COLORS.primary} />
          </View>
        </View>
        {/* Floating accent dots */}
        <View style={[styles.floatDot, { top: 4, right: 20, backgroundColor: COLORS.accent }]} />
        <View style={[styles.floatDot, { bottom: 8, left: 24, backgroundColor: COLORS.secondary, width: 10, height: 10 }]} />
        <View style={[styles.floatDot, { top: 20, left: 10, backgroundColor: COLORS.primary, width: 6, height: 6, opacity: 0.5 }]} />
      </View>

      <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
      <Text style={styles.emptyDesc}>
        Mulai catat pemasukan dan{"\n"}pengeluaran pertamamu.
      </Text>

      <Pressable
        onPress={onAddPress}
        style={({ pressed }) => [
          styles.emptyCtaBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
        <Text style={styles.emptyCtaText}>Tambah Transaksi</Text>
      </Pressable>
    </AnimatedCard>
  );
}

// ─── Helpers for Custom Calendar ──────────────────────────────────────────────

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const WEEKDAYS = ["S", "S", "R", "K", "J", "S", "M"];

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  
  // getDay() is 0 for Sunday, 1 for Monday, etc.
  let firstDayIndex = date.getDay() - 1;
  if (firstDayIndex < 0) firstDayIndex = 6; // Sunday becomes 6 (last day of week)

  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }

  const totalDays = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }

  return days;
};

const formatDateToYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateFriendly = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

// ─── Filter Sheet Component ───────────────────────────────────────────────────

interface FilterBottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  startDate: string;
  endDate: string;
  selectedCategory: string;
  selectedPayment: string;
  onApply: (filters: {
    startDate: string;
    endDate: string;
    selectedCategory: string;
    selectedPayment: string;
  }) => void;
  onReset: () => void;
}

const CATEGORY_CHIPS = ["Semua", "Makanan", "Transportasi", "Belanja", "Hiburan", "Tagihan"];
const PAYMENT_CHIPS = ["Semua", "Tunai", "Transfer", "Paylater", "E-Wallet"];

const CATEGORY_MAP: { [key: string]: string } = {
  "Semua": "Semua",
  "Makanan": "Makanan & Minuman",
  "Transportasi": "Transportasi",
  "Belanja": "Belanja",
  "Hiburan": "Hiburan",
  "Tagihan": "Tagihan & Utilitas",
};

const PAYMENT_MAP: { [key: string]: string } = {
  "Semua": "All",
  "Tunai": "Cash",
  "Transfer": "Transfer",
  "Paylater": "Paylater",
  "E-Wallet": "E-Wallet",
};

function DateButton({ label, value, onPress, onClear }: any) {
  return (
    <View style={styles.datePickerBtnWrap}>
      <Text style={styles.datePickerBtnLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.datePickerBtn}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.subtext} style={{ marginRight: 6 }} />
        <Text style={[styles.datePickerBtnText, value ? styles.datePickerBtnTextSelected : styles.datePickerBtnTextPlaceholder]}>
          {value ? formatDateFriendly(value) : label === "Mulai" ? "Pilih tanggal mulai" : "Pilih tanggal selesai"}
        </Text>
        {value ? (
          <Pressable onPress={onClear} style={styles.datePickerBtnClear}>
            <Ionicons name="close-circle" size={16} color={COLORS.subtext} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

function FilterBottomSheet({
  visible,
  onDismiss,
  startDate,
  endDate,
  selectedCategory,
  selectedPayment,
  onApply,
  onReset,
}: FilterBottomSheetProps) {
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [tempCategory, setTempCategory] = useState(selectedCategory);
  const [tempPayment, setTempPayment] = useState(selectedPayment);

  useEffect(() => {
    if (visible) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      setTempCategory(selectedCategory);
      setTempPayment(selectedPayment);
    }
  }, [visible, startDate, endDate, selectedCategory, selectedPayment]);

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

  // Calendar Modal targets
  const [calendarTarget, setCalendarTarget] = useState<"start" | "end" | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleDaySelect = (dayStr: string) => {
    if (calendarTarget === "start") {
      setTempStartDate(dayStr);
    } else {
      setTempEndDate(dayStr);
    }
    setCalendarTarget(null);
  };

  const handleApply = () => {
    onApply({
      startDate: tempStartDate,
      endDate: tempEndDate,
      selectedCategory: tempCategory,
      selectedPayment: tempPayment,
    });
  };

  const handleReset = () => {
    setTempStartDate("");
    setTempEndDate("");
    setTempCategory("Semua");
    setTempPayment("All");
    onReset();
  };

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animatedValue.value,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const screenHeight = Dimensions.get("window").height;
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
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheetContainer, sheetAnimatedStyle]}>
          <View style={styles.sheetIndicator} />
          
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter Transaksi</Text>
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </Pressable>
          </View>

          {/* Rentang Tanggal */}
          <Text style={styles.sheetSectionTitle}>Rentang Tanggal</Text>
          <View style={styles.datePickerRow}>
            <DateButton
              label="Mulai"
              value={tempStartDate}
              onPress={() => {
                setCalendarTarget("start");
                if (tempStartDate) {
                  const [y, m] = tempStartDate.split("-").map(Number);
                  setCalMonth(m - 1);
                  setCalYear(y);
                } else {
                  setCalMonth(new Date().getMonth());
                  setCalYear(new Date().getFullYear());
                }
              }}
              onClear={() => setTempStartDate("")}
            />
            <DateButton
              label="Selesai"
              value={tempEndDate}
              onPress={() => {
                setCalendarTarget("end");
                if (tempEndDate) {
                  const [y, m] = tempEndDate.split("-").map(Number);
                  setCalMonth(m - 1);
                  setCalYear(y);
                } else {
                  setCalMonth(new Date().getMonth());
                  setCalYear(new Date().getFullYear());
                }
              }}
              onClear={() => setTempEndDate("")}
            />
          </View>

          {/* Kategori */}
          <Text style={styles.sheetSectionTitle}>Kategori</Text>
          <View style={styles.chipsScrollWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sheetChipsScroll}
              contentContainerStyle={styles.sheetChipsContent}
            >
              {CATEGORY_CHIPS.map((chip) => {
                const mappedCat = CATEGORY_MAP[chip] || chip;
                const isActive = tempCategory === mappedCat;
                return (
                  <Pressable
                    key={chip}
                    onPress={() => setTempCategory(mappedCat)}
                    style={[
                      styles.sheetChip,
                      isActive ? styles.sheetChipActive : styles.sheetChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sheetChipText,
                        isActive ? styles.sheetChipTextActive : styles.sheetChipTextInactive,
                      ]}
                    >
                      {chip}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Metode Pembayaran */}
          <Text style={styles.sheetSectionTitle}>Metode Pembayaran</Text>
          <View style={styles.chipsScrollWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sheetChipsScroll}
              contentContainerStyle={styles.sheetChipsContent}
            >
              {PAYMENT_CHIPS.map((chip) => {
                const mappedPay = PAYMENT_MAP[chip] || chip;
                const isActive = tempPayment === mappedPay;
                return (
                  <Pressable
                    key={chip}
                    onPress={() => setTempPayment(mappedPay)}
                    style={[
                      styles.sheetChip,
                      isActive ? styles.sheetChipActive : styles.sheetChipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sheetChipText,
                        isActive ? styles.sheetChipTextActive : styles.sheetChipTextInactive,
                      ]}
                    >
                      {chip}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Buttons */}
          <View style={styles.sheetButtonsRow}>
            <Pressable onPress={handleReset} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
            <Pressable onPress={handleApply} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Terapkan Filter</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Date Selection Custom Calendar Dialog */}
        {calendarTarget !== null ? (
          <Portal>
            <View style={styles.calModalOverlay}>
              <Pressable style={styles.calModalBackdrop} onPress={() => setCalendarTarget(null)} />
              <View style={styles.calModalContent}>
                <View style={styles.calHeader}>
                  <Pressable onPress={prevMonth} style={styles.calNavBtn}>
                    <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                  </Pressable>
                  <Text style={styles.calMonthText}>
                    {MONTH_NAMES[calMonth]} {calYear}
                  </Text>
                  <Pressable onPress={nextMonth} style={styles.calNavBtn}>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                  </Pressable>
                </View>

                <View style={styles.calWeekdays}>
                  {WEEKDAYS.map((w, i) => (
                    <Text key={`${w}-${i}`} style={styles.calWeekdayText}>
                      {w}
                    </Text>
                  ))}
                </View>

                <View style={styles.calGrid}>
                  {getDaysInMonth(calYear, calMonth).map((day, idx) => {
                    if (day === null) {
                      return <View key={`empty-${idx}`} style={styles.calDayEmpty} />;
                    }
                    const dayStr = formatDateToYMD(day);
                    const isSelected = calendarTarget === "start" ? tempStartDate === dayStr : tempEndDate === dayStr;
                    return (
                      <Pressable
                        key={dayStr}
                        onPress={() => handleDaySelect(dayStr)}
                        style={[
                          styles.calDayBtn,
                          isSelected && styles.calDayBtnSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayText,
                            isSelected && styles.calDayTextSelected,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Portal>
        ) : null}
      </View>
    </Portal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { transactions, isLoadingTransactions, fetchTransactions, deleteTransaction } = useSheetStore();
  const segments = useSegments() as any;
  const isFocused = segments.includes("history");

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedPayment, setSelectedPayment] = useState<string>("All");
  const [showAdvFilter, setShowAdvFilter] = useState(false);
  const [pageLimit, setPageLimit] = useState(15);

  const handleRefresh = async () => {
    if (token) await fetchTransactions(token);
  };

  const confirmDelete = (item: Transaction) => {
    Alert.alert(
      "Hapus Transaksi",
      `Apakah Anda yakin ingin menghapus "${item.keterangan}"?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            if (token) {
              try {
                await deleteTransaction(token, item.rowIndex);
                Alert.alert("Sukses", "Transaksi berhasil dihapus.");
              } catch {
                Alert.alert("Error", "Gagal menghapus transaksi.");
              }
            }
          },
        },
      ]
    );
  };

  // Apply all filters
  const filteredTransactions = useMemo(() => {
    const dateRange = getDateRangeForFilter(quickFilter);
    const activeStart = dateRange?.start ?? startDate;
    const activeEnd = dateRange?.end ?? endDate;

    return transactions.filter((tx) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!tx.keterangan.toLowerCase().includes(q) && !tx.catatan.toLowerCase().includes(q)) return false;
      }
      if (selectedCategory !== "Semua") {
        if (cleanCategory(tx.kategori).toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }
      if (selectedPayment !== "All") {
        if (tx.pembayaran.toLowerCase() !== selectedPayment.toLowerCase()) return false;
      }
      if (activeStart && tx.tanggal < activeStart) return false;
      if (activeEnd && tx.tanggal > activeEnd) return false;
      return true;
    });
  }, [transactions, search, quickFilter, selectedCategory, selectedPayment, startDate, endDate]);

  const paginatedTransactions = useMemo(() => filteredTransactions.slice(0, pageLimit), [filteredTransactions, pageLimit]);

  // Group by date
  type GroupedSection = { dateStr: string; data: Transaction[] };
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of paginatedTransactions) {
      const d = tx.tanggal;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(tx);
    }
    // Sort descending by date
    const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    return sorted.map(([dateStr, data]) => ({ dateStr, data })) as GroupedSection[];
  }, [paginatedTransactions]);

  const loadMore = () => {
    if (pageLimit < filteredTransactions.length) setPageLimit((p) => p + 15);
  };

  const isFilterActive = startDate !== "" || endDate !== "" || selectedCategory !== "Semua" || selectedPayment !== "All";
  const trigKey = String(isFocused);

  // ── Swipeable row ──
  const renderRightActions = (item: Transaction, swRef: any) => (
    <Pressable
      onPress={() => { swRef?.close(); confirmDelete(item); }}
      style={styles.deleteAction}
    >
      <Ionicons name="trash-outline" size={20} color="#FFFFFF" style={{ marginBottom: 2 }} />
      <Text style={styles.deleteActionText}>Hapus</Text>
    </Pressable>
  );

  const renderTransactionItem = (item: Transaction, idx: number) => {
    const isIncome = item.kategori.startsWith("Pemasukan:");
    let swRef: any = null;
    return (
      <Swipeable
        key={item.id}
        ref={(r) => { swRef = r; }}
        renderRightActions={() => renderRightActions(item, swRef)}
        friction={2}
        rightThreshold={40}
      >
        <AnimatedCard index={idx} stepMs={40} triggerKey={trigKey}>
          <View style={styles.transactionCard}>
            <View style={styles.cardLeft}>
              <View style={[styles.iconContainer, { backgroundColor: isIncome ? "#E6F4F8" : "#FFEBEF" }]}>
                <Text style={styles.categoryIcon}>{getCategoryEmoji(item.kategori)}</Text>
              </View>
              <View style={styles.textDetails}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.keterangan}</Text>
                <View style={styles.rowTags}>
                  <Text style={styles.itemCategory}>{cleanCategory(item.kategori)}</Text>
                  <Text style={styles.dot}>•</Text>
                  <View style={[styles.payMethodTag, { backgroundColor: item.pembayaran === "Paylater" ? "#FFE4E6" : "#F1F5F9" }]}>
                    <Text style={[styles.payMethodText, { color: item.pembayaran === "Paylater" ? "#E11D48" : "#64748B" }]}>
                      {item.pembayaran === "Cash" ? "Tunai" : item.pembayaran}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={[styles.itemAmount, { color: isIncome ? COLORS.incomeGreen : COLORS.expenseRed }]}>
              {`${isIncome ? "+" : "-"}${formatRupiah(item.nominal)}`}
            </Text>
          </View>
        </AnimatedCard>
      </Swipeable>
    );
  };

  let itemIdx = 0;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenTransition triggerKey={trigKey} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
          <StatusBar style="dark" />

          {/* Header */}
          <AnimatedCard index={0} triggerKey={trigKey}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
                <Text style={styles.headerSubtitle}>
                  {filteredTransactions.length} catatan ditemukan
                </Text>
              </View>
              <Pressable onPress={handleRefresh} style={styles.refreshBtn}>
                <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
              </Pressable>
            </View>
          </AnimatedCard>

          <FlatList
            data={grouped}
            keyExtractor={(item) => item.dateStr}
            refreshing={isLoadingTransactions}
            onRefresh={handleRefresh}
            onEndReached={loadMore}
            onEndReachedThreshold={0.2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                {/* Summary Card */}
                <SummaryCard transactions={transactions} />

                {/* Search Bar */}
                <SearchBar
                  search={search}
                  setSearch={(v) => { setSearch(v); setPageLimit(15); }}
                  onFilterPress={() => setShowAdvFilter((p) => !p)}
                  filterActive={isFilterActive}
                />

                {/* Quick Filter Chips */}
                <QuickFilterChips
                  active={quickFilter}
                  onSelect={(id) => { setQuickFilter(id); setPageLimit(15); }}
                />
              </View>
            }
            renderItem={({ item: section }) => (
              <View style={styles.groupSection}>
                {/* Date group header */}
                <View style={styles.groupHeader}>
                  <View style={styles.groupDividerLine} />
                  <View style={styles.groupLabelWrap}>
                    <Ionicons name="time-outline" size={13} color={COLORS.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.groupLabel}>{formatDateGroupLabel(section.dateStr)}</Text>
                  </View>
                  <View style={styles.groupDividerLine} />
                </View>
                {/* Transactions for this date */}
                {section.data.map((tx) => renderTransactionItem(tx, itemIdx++))}
              </View>
            )}
            ListEmptyComponent={
              isLoadingTransactions ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Memuat transaksi...</Text>
                </View>
              ) : (
                <EmptyState onAddPress={() => router.push("/(app)/add-transaction" as any)} />
              )
            }
            ListFooterComponent={
              pageLimit < filteredTransactions.length ? (
                <View style={styles.loaderRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loaderText}>Memuat lebih banyak...</Text>
                </View>
              ) : (
                <View style={{ height: 16 }} />
              )
            }
          />

          <FilterBottomSheet
            visible={showAdvFilter}
            onDismiss={() => setShowAdvFilter(false)}
            startDate={startDate}
            endDate={endDate}
            selectedCategory={selectedCategory}
            selectedPayment={selectedPayment}
            onApply={(filters) => {
              setStartDate(filters.startDate);
              setEndDate(filters.endDate);
              setSelectedCategory(filters.selectedCategory);
              setSelectedPayment(filters.selectedPayment);
              setQuickFilter("all");
              setPageLimit(15);
              setShowAdvFilter(false);
            }}
            onReset={() => {
              setStartDate("");
              setEndDate("");
              setSelectedCategory("Semua");
              setSelectedPayment("All");
              setQuickFilter("all");
              setPageLimit(15);
              setShowAdvFilter(false);
            }}
          />
        </SafeAreaView>
      </ScreenTransition>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: COLORS.text,
  },
  headerSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.subtext,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Summary Card ──
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  summaryLabel: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
  },
  summaryCountBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  summaryCountText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.subtext,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryAmountLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.subtext,
  },
  summaryAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  summarySep: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },

  // ── Search Bar ──
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 12,
    gap: 10,
  },
  searchBarInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Quick Filter Chips ──
  chipsScroll: {
    marginBottom: 8,
  },
  chipsContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  chipInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.accent,
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },

  // ── Advanced Filter Panel ──
  advFilterPanel: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 8,
  },
  advFilterContent: {
    padding: 20,
  },
  advFilterLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  payBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  payBtnActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  payBtnInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  payBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },

  // ── List ──
  listContent: {
    paddingBottom: 120,
  },

  // ── Date Group ──
  groupSection: {
    marginBottom: 4,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginVertical: 10,
  },
  groupDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  groupLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  groupLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.accent,
  },

  // ── Transaction Card ──
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  textDetails: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.text,
  },
  rowTags: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 6,
  },
  itemCategory: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: COLORS.subtext,
  },
  dot: {
    fontSize: 11,
    color: "#94A3B8",
  },
  payMethodTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payMethodText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
  },
  itemAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    marginLeft: 8,
  },

  // ── Swipe delete ──
  deleteAction: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    width: 82,
    borderRadius: 16,
    marginLeft: 8,
    marginBottom: 10,
    marginRight: 24,
  },
  deleteActionText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },

  // ── Loading ──
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.subtext,
    marginTop: 12,
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  loaderText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: COLORS.subtext,
  },

  // ── Empty State ──
  emptyWrapper: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyDecoTop: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.secondary,
    opacity: 0.25,
  },
  emptyDecoBottom: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accent,
    opacity: 0.15,
  },
  emptyIconArea: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyIconCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.secondary,
    opacity: 0.45,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIconCircleInner: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  floatDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: COLORS.subtext,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  emptyCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyCtaText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.white,
  },

  // ── Bottom Sheet Filter ──
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 34,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: COLORS.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetSectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 8,
  },
  datePickerRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  datePickerBtnWrap: {
    flex: 1,
  },
  datePickerBtnLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: COLORS.subtext,
    marginBottom: 6,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  datePickerBtnText: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  datePickerBtnTextPlaceholder: {
    color: "#94A3B8",
  },
  datePickerBtnTextSelected: {
    color: COLORS.text,
  },
  datePickerBtnClear: {
    padding: 2,
    marginLeft: 4,
  },
  chipsScrollWrap: {
    marginBottom: 20,
  },
  sheetChipsScroll: {
    marginHorizontal: -24,
  },
  sheetChipsContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  sheetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  sheetChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  sheetChipInactive: {
    backgroundColor: "#F1F5F9",
    borderColor: "transparent",
  },
  sheetChipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  sheetChipTextActive: {
    color: COLORS.white,
  },
  sheetChipTextInactive: {
    color: COLORS.subtext,
  },
  sheetButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    width: "100%",
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.accent,
  },
  applyBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.white,
  },

  // ── Custom Calendar Dialog ──
  calModalOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  calModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  calModalContent: {
    width: "85%",
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calNavBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  calMonthText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: COLORS.text,
  },
  calWeekdays: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calWeekdayText: {
    width: 32,
    textAlign: "center",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: COLORS.accent,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calDayEmpty: {
    width: "14.28%",
    aspectRatio: 1,
  },
  calDayBtn: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    marginVertical: 2,
  },
  calDayBtnSelected: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  calDayText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: COLORS.text,
  },
  calDayTextSelected: {
    color: COLORS.primary,
    fontFamily: "Poppins_700Bold",
  },
});
