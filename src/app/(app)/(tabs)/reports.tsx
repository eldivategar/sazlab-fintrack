import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Pressable, RefreshControl, Dimensions } from 'react-native';
import { Text, Portal, Modal, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useSheetStore } from '../../../stores/useSheetStore';
import { useBudgetStore } from '../../../stores/useBudgetStore';
import { PieChart } from 'react-native-gifted-charts';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import ScreenTransition from '../../../components/ScreenTransition';
import AnimatedCard from '../../../components/AnimatedCard';

const CATEGORY_COLORS: { [key: string]: string } = {
  'Makanan & Minuman': '#FF90BB', // Bubblegum Pink
  'Transportasi': '#8ACCD5', // Sky Teal
  'Belanja': '#FFC1DA', // Blush Pink
  'Tagihan & Utilitas': '#64748B', // Slate Grey
  'Hiburan': '#F59E0B', // Amber Gold
  'Lainnya': '#10B981', // Emerald Green
};

const DEFAULT_COLORS = ['#FF90BB', '#8ACCD5', '#FFC1DA', '#64748B', '#F59E0B', '#10B981'];
const EXPENSE_CATEGORIES = ['Makanan & Minuman', 'Transportasi', 'Belanja', 'Tagihan & Utilitas', 'Hiburan', 'Lainnya'];

export default function ReportsScreen() {
  const { token } = useAuthStore();
  const { transactions, isLoadingTransactions, fetchTransactions } = useSheetStore();
  const { budgets, loadBudgets, updateBudget } = useBudgetStore();
  const segments = useSegments() as any;
  const isFocused = segments.includes('reports');

  // Modal State for Editing Budget
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [budgetValue, setBudgetValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleRefresh = async () => {
    if (token) {
      await fetchTransactions(token);
    }
  };

  const handleOpenEdit = (cat: string) => {
    setActiveCategory(cat);
    setBudgetValue(budgets[cat]?.toString() || '0');
    setErrorMsg(null);
    setIsEditModalVisible(true);
  };

  const handleSaveBudget = async () => {
    const amount = Number(budgetValue.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount < 0) {
      setErrorMsg('Silakan masukkan jumlah nominal yang valid.');
      return;
    }
    await updateBudget(activeCategory, amount);
    setIsEditModalVisible(false);
  };

  // Helper to format Rupiah output
  const formatRupiah = (num: number) => {
    const isNegative = num < 0;
    const absNum = Math.abs(num);
    const formatted = absNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNegative ? '-' : ''}Rp ${formatted}`;
  };

  // Helper to parse and translate category name cleanly
  const translateCategory = (cat: string) => {
    const clean = cat.replace(/^(Pemasukan|Pengeluaran):\s*/, '').trim();
    const mapping: { [key: string]: string } = {
      'Food & Beverage': 'Makanan & Minuman',
      'Transportation': 'Transportasi',
      'Shopping': 'Belanja',
      'Bills & Utilities': 'Tagihan & Utilitas',
      'Entertainment': 'Hiburan',
      'Others': 'Lainnya',
      'Salary': 'Gaji',
      'Investment': 'Investasi',
      'Side Hustle': 'Sampingan',
      'Gift': 'Hadiah'
    };
    return mapping[clean] || clean;
  };

  // Filter current month expenses
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  const expenseTransactions = transactions.filter(tx => {
    const isExpense = tx.kategori.startsWith('Pengeluaran:');
    const parts = tx.tanggal.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Convert 1-indexed to 0-indexed
    return isExpense && year === currentYear && month === currentMonth;
  });

  // Calculate totals and group by category
  const categoryTotals: { [key: string]: number } = {};
  let totalExpenses = 0;

  expenseTransactions.forEach(tx => {
    const cleanCat = translateCategory(tx.kategori);
    categoryTotals[cleanCat] = (categoryTotals[cleanCat] || 0) + tx.nominal;
    totalExpenses += tx.nominal;
  });

  // Create chart data
  let colorIdx = 0;
  const chartData = Object.keys(categoryTotals).map(catName => {
    const value = categoryTotals[catName];
    const color = CATEGORY_COLORS[catName] || DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length];
    return {
      value,
      color,
      text: catName,
    };
  });

  const hasExpenses = chartData.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScreenTransition triggerKey={String(isFocused)} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={isLoadingTransactions} 
              onRefresh={handleRefresh}
              colors={['#FF90BB']}
              tintColor="#FF90BB"
            />
          }
        >
          <AnimatedCard index={0} triggerKey={String(isFocused)} style={styles.header}>
            <Text style={styles.headerTitle}>Laporan Keuangan</Text>
            <Text style={styles.headerSubtitle}>Analisis pengeluaran & anggaran bulan ini</Text>
          </AnimatedCard>

          {/* Donut Chart Visual Section */}
          <AnimatedCard index={1} triggerKey={String(isFocused)} style={styles.chartCard}>
          <Text style={styles.chartCardTitle}>Rincian Pengeluaran</Text>
          
          {isLoadingTransactions && chartData.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF90BB" />
              <Text style={styles.loadingText}>Mengambil catatan transaksi...</Text>
            </View>
          ) : !hasExpenses ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="pie-chart-outline" size={40} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Tidak ada data pengeluaran</Text>
              <Text style={styles.emptyDesc}>
                Belum ada catatan pengeluaran di bulan ini.
              </Text>
            </View>
          ) : (
            <View style={styles.chartWrapper}>
              <PieChart
                donut
                data={chartData}
                radius={90}
                innerRadius={60}
                innerCircleColor="#FFFFFF"
                centerLabelComponent={() => {
                  return (
                    <View style={styles.centerLabel}>
                      <Text style={styles.centerLabelAmount} numberOfLines={1}>
                        {formatRupiah(totalExpenses)}
                      </Text>
                      <Text style={styles.centerLabelTitle}>Total Pengeluaran</Text>
                    </View>
                  );
                }}
              />
            </View>
          )}
          </AnimatedCard>

          {/* Budget Progress Bars & Legends */}
          <AnimatedCard index={2} triggerKey={String(isFocused)} style={styles.budgetCard}>
          <Text style={styles.budgetCardTitle}>Anggaran Kategori</Text>
          <View style={styles.budgetList}>
            {EXPENSE_CATEGORIES.map((catName) => {
              const spent = categoryTotals[catName] || 0;
              const budget = budgets[catName] || 0;
              const ratio = budget > 0 ? Math.min(1.0, spent / budget) : 0;
              const isOverBudget = spent > budget;
              const progressColor = isOverBudget ? '#EF4444' : CATEGORY_COLORS[catName] || '#FF90BB';

              return (
                <View key={catName} style={styles.budgetItem}>
                  <View style={styles.budgetTopRow}>
                    <View style={styles.budgetLabelLeft}>
                      <View style={[styles.colorChip, { backgroundColor: CATEGORY_COLORS[catName] }]} />
                      <Text style={styles.categoryName}>{catName}</Text>
                    </View>
                    <Pressable 
                      onPress={() => handleOpenEdit(catName)}
                      style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Ionicons name="pencil-outline" size={14} color="#64748B" />
                    </Pressable>
                  </View>

                  <View style={styles.budgetProgressContainer}>
                    <View style={styles.progressBarBackground}>
                      <View style={[
                        styles.progressBarFill, 
                        { width: `${ratio * 100}%`, backgroundColor: progressColor }
                      ]} />
                    </View>
                  </View>

                  <View style={styles.budgetBottomRow}>
                    <Text style={styles.spentText}>
                      {formatRupiah(spent)} terpakai
                    </Text>
                    <Text style={[styles.budgetText, isOverBudget && styles.overBudgetText]}>
                      dari {formatRupiah(budget)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          </AnimatedCard>

        </ScrollView>
      </ScreenTransition>

      {/* Portal Budget Edit Modal */}
      <Portal>
        <Modal
          visible={isEditModalVisible}
          onDismiss={() => setIsEditModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Atur Batas Anggaran</Text>
          <Text style={styles.modalSubtitle}>Sesuaikan batas anggaran bulanan untuk: {activeCategory}</Text>
          
          {errorMsg && (
            <Text style={styles.modalError}>{errorMsg}</Text>
          )}

          <TextInput
            mode="outlined"
            placeholder="Rp 0"
            keyboardType="numeric"
            value={formatRupiah(Number(budgetValue.replace(/[^0-9]/g, '')))}
            onChangeText={(text) => setBudgetValue(text.replace(/[^0-9]/g, ''))}
            style={styles.modalInput}
            outlineStyle={{ borderRadius: 12 }}
            activeOutlineColor="#FF90BB"
          />

          <View style={styles.modalButtons}>
            <Button 
              mode="outlined" 
              onPress={() => setIsEditModalVisible(false)} 
              style={[styles.modalCancel, { borderColor: '#CBD5E1' }]}
              textColor="#64748B"
            >
              Batal
            </Button>
            <Button 
              mode="contained" 
              onPress={handleSaveBudget} 
              style={styles.modalSave}
              textColor="#FFFFFF"
            >
              Simpan
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
    backgroundColor: '#F9F9F9', // Premium light-gray theme background
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 110, // Avoid overlapping the tab bar
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 24,
    color: '#1E293B',
  },
  headerSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6', // border-gray-100
    alignItems: 'center',
    marginBottom: 24,
  },
  chartCardTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chartWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 180,
    width: '100%',
  },
  centerLabel: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
  },
  centerLabelAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#1E293B',
    textAlign: 'center',
  },
  centerLabelTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6', // border-gray-100
  },
  budgetCardTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 20,
  },
  budgetList: {
    gap: 20,
  },
  budgetItem: {
    width: '100%',
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorChip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  categoryName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#1E293B',
  },
  editBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtnIcon: {
    fontSize: 12,
  },
  budgetProgressContainer: {
    width: '100%',
    height: 8,
    marginBottom: 6,
  },
  progressBarBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spentText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: '#1E293B',
  },
  budgetText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#64748B',
  },
  overBudgetText: {
    color: '#EF4444',
    fontFamily: 'Poppins_600SemiBold',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#64748B',
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    width: '100%',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#1E293B',
  },
  emptyDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    margin: 24,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#1E293B',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  modalError: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 12,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  modalSave: {
    flex: 1,
    backgroundColor: '#FF90BB',
    borderRadius: 12,
  },
});
