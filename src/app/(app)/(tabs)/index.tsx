import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useSheetStore } from '../../../stores/useSheetStore';
import { useUIStore } from '../../../stores/useUIStore';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTransition from '../../../components/ScreenTransition';
import AnimatedCard from '../../../components/AnimatedCard';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { setVoiceSheetVisible } = useUIStore();
  const segments = useSegments() as any;
  const isFocused = !segments.includes('history') && !segments.includes('reports') && !segments.includes('settings');
  const [avatarError, setAvatarError] = useState(false);
  
  const { 
    spreadsheetId, 
    status, 
    error, 
    transactions, 
    isLoadingTransactions, 
    initializeSheet,
    fetchTransactions,
    isTemplateFormat,
    totalBudget,
    budgetPaylater,
    sisaBudgetCash,
    sisaBudgetPaylater,
    totalBudgetCash,
    totalSisaSaldo,
  } = useSheetStore();

  useEffect(() => {
    if (token && status === 'idle') {
      initializeSheet(token);
    }
  }, [token, status]);

  const handleRefresh = async () => {
    if (token) {
      await fetchTransactions(token);
    }
  };

  // Helper to format Rupiah output
  const formatRupiah = (num: number) => {
    const isNegative = num < 0;
    const absNum = Math.abs(num);
    const formatted = absNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNegative ? '-' : ''}Rp ${formatted}`;
  };

  // Helper to parse and translate category name cleanly
  const cleanCategory = (cat: string) => {
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
      'Hadiah': 'Hadiah'
    };
    return mapping[clean] || clean;
  };

  // Helper to get category emoji
  const getCategoryEmoji = (cat: string) => {
    const clean = cleanCategory(cat).toLowerCase();
    if (clean.includes('food') || clean.includes('beverage') || clean.includes('makan') || clean.includes('minum')) return '🍕';
    if (clean.includes('transport') || clean.includes('mobil') || clean.includes('motor')) return '🚗';
    if (clean.includes('shop') || clean.includes('belanja')) return '🛍️';
    if (clean.includes('bill') || clean.includes('util') || clean.includes('tagihan') || clean.includes('listrik') || clean.includes('air')) return '💡';
    if (clean.includes('entertain') || clean.includes('hiburan') || clean.includes('bioskop') || clean.includes('nonton')) return '🎬';
    if (clean.includes('salary') || clean.includes('gaji')) return '💼';
    if (clean.includes('invest') || clean.includes('saham') || clean.includes('reksa')) return '📈';
    if (clean.includes('side') || clean.includes('sampingan') || clean.includes('freelance')) return '🚀';
    if (clean.includes('gift') || clean.includes('hadiah') || clean.includes('kado')) return '🎁';
    if (clean.includes('cash') || clean.includes('tunai') || clean.includes('dompet')) return '💵';
    return '💰';
  };

  // Dynamic time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Selamat Pagi 👋';
    if (hour >= 11 && hour < 15) return 'Selamat Siang 👋';
    if (hour >= 15 && hour < 18) return 'Selamat Sore 👋';
    return 'Selamat Malam 👋';
  };

  // Group transactions by Date (Hari Ini, Kemarin, Lebih Lampau)
  const groupTransactions = (txList: any[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const todayTx: any[] = [];
    const yesterdayTx: any[] = [];
    const olderTx: any[] = [];

    txList.forEach(tx => {
      if (tx.tanggal === todayStr) {
        todayTx.push(tx);
      } else if (tx.tanggal === yesterdayStr) {
        yesterdayTx.push(tx);
      } else {
        olderTx.push(tx);
      }
    });

    return { todayTx, yesterdayTx, olderTx };
  };

  // Calculate monthly aggregates
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const thisMonthTransactions = transactions.filter(tx => {
    const parts = tx.tanggal.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    return year === currentYear && month === currentMonth;
  });

  let totalIncome = 0;
  let totalExpense = 0;

  thisMonthTransactions.forEach(tx => {
    if (tx.kategori.startsWith('Pemasukan:')) {
      totalIncome += tx.nominal;
    } else if (tx.kategori.startsWith('Pengeluaran:')) {
      totalExpense += tx.nominal;
    }
  });

  if (status === 'initializing') {
    return (
      <View style={styles.loadingOverlay}>
        <StatusBar style="dark" />
        <AnimatedCard index={0} style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#FF90BB" />
          <Text style={styles.loadingTitle}>Menghubungkan Database</Text>
          <Text style={styles.loadingSubtitle}>Menyiapkan Spreadsheet 'SiPaling Hemat Data' Anda...</Text>
        </AnimatedCard>
      </View>
    );
  }

  // Get latest 3 transactions for dashboard
  const latestTransactions = transactions.slice(0, 3);
  const { todayTx, yesterdayTx, olderTx } = groupTransactions(latestTransactions);

  // Budget Ratios & Limits
  const cashLimit = totalBudgetCash !== null ? totalBudgetCash : 4000000;
  const cashRemaining = sisaBudgetCash !== null ? sisaBudgetCash : 4000000;
  const cashSpent = cashLimit - cashRemaining;

  const paylaterLimit = budgetPaylater !== null ? budgetPaylater : 2500000;
  const paylaterRemaining = sisaBudgetPaylater !== null ? sisaBudgetPaylater : 2500000;
  const paylaterSpent = paylaterLimit - paylaterRemaining;

  // Dynamic Financial Insight Engine
  const getInsight = () => {
    if (thisMonthTransactions.length === 0) {
      return {
        icon: '🌱',
        title: 'Belum ada aktivitas bulan ini',
        description: 'Mulai catat transaksi pertama untuk mendapatkan insight keuangan.',
      };
    }

    const expensesByCategory: { [key: string]: number } = {};
    let totalExpenseThisMonth = 0;
    
    thisMonthTransactions.forEach(tx => {
      if (tx.kategori.startsWith('Pengeluaran:')) {
        const cat = cleanCategory(tx.kategori);
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + tx.nominal;
        totalExpenseThisMonth += tx.nominal;
      }
    });

    if (totalExpenseThisMonth === 0) {
      return {
        icon: '📈',
        title: 'Keuangan Produktif!',
        description: 'Belum ada pengeluaran tercatat bulan ini. Tabungan Anda tumbuh aman!',
      };
    }

    // Find highest expense category
    let highestCategory = '';
    let highestAmount = 0;
    Object.entries(expensesByCategory).forEach(([cat, amt]) => {
      if (amt > highestAmount) {
        highestAmount = amt;
        highestCategory = cat;
      }
    });

    // Check budget stress levels
    if (isTemplateFormat) {
      const cashSpentRatio = cashLimit > 0 ? (cashSpent / cashLimit) : 0;
      const paylaterSpentRatio = paylaterLimit > 0 ? (paylaterSpent / paylaterLimit) : 0;

      if (cashSpentRatio > 0.9) {
        return {
          icon: '⚠️',
          title: 'Anggaran Tunai Kritis!',
          description: `Penggunaan Saldo Tunai Anda mencapai ${(cashSpentRatio * 100).toFixed(0)}%. Harap hemat pengeluaran.`,
        };
      }
      if (paylaterSpentRatio > 0.9) {
        return {
          icon: '⚠️',
          title: 'Tagihan Paylater Menumpuk!',
          description: `Penggunaan Paylater Anda mencapai ${(paylaterSpentRatio * 100).toFixed(0)}%. Batasi transaksi kredit.`,
        };
      }
    }

    const getCatEmoji = (cat: string) => {
      const c = cat.toLowerCase();
      if (c.includes('makan') || c.includes('minum')) return '🍕';
      if (c.includes('transport')) return '🚗';
      if (c.includes('belanja')) return '🛍️';
      if (c.includes('tagihan')) return '💡';
      if (c.includes('hiburan')) return '🎬';
      return '💰';
    };

    return {
      icon: getCatEmoji(highestCategory),
      title: `Fokus Pengeluaran: ${highestCategory}`,
      description: `Anda menghabiskan ${formatRupiah(highestAmount)} untuk ${highestCategory} bulan ini.`,
    };
  };

  const insight = getInsight();

  const renderTransactionItem = (tx: any, idx: number) => {
    const isIncome = tx.kategori.startsWith('Pemasukan:');
    return (
      <AnimatedCard
        key={tx.id}
        index={idx}
        triggerKey={String(isFocused)}
        style={styles.transactionCard}
      >
        <View style={styles.cardLeft}>
          <View style={[
            styles.iconCircle, 
            { backgroundColor: isIncome ? '#FFF8E1' : '#FFF0F5' }
          ]}>
            <Text style={styles.categoryEmoji}>{getCategoryEmoji(tx.kategori)}</Text>
          </View>
          <View style={styles.textDetails}>
            <Text style={styles.itemTitle} numberOfLines={1}>{tx.keterangan}</Text>
            <View style={styles.rowTags}>
              <Text style={styles.itemCategory}>{cleanCategory(tx.kategori)}</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.itemDate}>{tx.tanggal}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.cardRight}>
          <Text style={[
            styles.itemAmount, 
            { color: isIncome ? '#8ACCD5' : '#FF90BB' }
          ]}>
            {`${isIncome ? '+' : '-'}${formatRupiah(tx.nominal)}`}
          </Text>
          <View style={[
            styles.payMethodTag, 
            { backgroundColor: tx.pembayaran === 'Paylater' ? '#FFEBF0' : '#E6F7F9' }
          ]}>
            <Text style={[
              styles.payMethodText,
              { color: tx.pembayaran === 'Paylater' ? '#FF90BB' : '#8ACCD5' }
            ]}>
              {tx.pembayaran === 'Cash' ? 'Tunai' : tx.pembayaran}
            </Text>
          </View>
        </View>
      </AnimatedCard>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScreenTransition triggerKey={String(isFocused)} style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={isLoadingTransactions} 
              onRefresh={handleRefresh}
              colors={['#FF90BB']}
              tintColor="#FF90BB"
            />
          }
        >
          {/* Section 0: Greeting Header */}
          <AnimatedCard index={0} triggerKey={String(isFocused)}>
            <View style={styles.header}>
              <View style={styles.profileRow}>
                {user?.picture && !avatarError ? (
                  <Avatar.Image 
                    size={48} 
                    source={{ uri: user.picture }} 
                    style={styles.avatar}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <Avatar.Text 
                    size={48} 
                    label={user?.name?.slice(0, 2).toUpperCase() || 'FT'} 
                    style={[styles.avatar, { backgroundColor: '#FF90BB' }]} 
                    labelStyle={{ fontFamily: 'Poppins_600SemiBold', color: '#FFFFFF' }} 
                  />
                )}
                <Text style={styles.nameText} numberOfLines={1}>{user?.name || 'User SiPaling Hemat'}</Text>
              </View>

              <View style={styles.headerButtons}>
                <Pressable 
                  onPress={() => router.push('/(app)/(tabs)/settings')}
                  style={({ pressed }) => [styles.roundButton, pressed && styles.buttonPressed]}
                >
                  <Ionicons name="settings-outline" size={20} color="#FF90BB" />
                </Pressable>
                <Pressable 
                  style={({ pressed }) => [styles.roundButton, pressed && styles.buttonPressed]}
                >
                  <Ionicons name="notifications-outline" size={20} color="#8ACCD5" />
                </Pressable>
              </View>
            </View>
          </AnimatedCard>

          {/* Section 1: Hero Balance Card */}
          <AnimatedCard index={1} triggerKey={String(isFocused)} style={styles.cardPadding}>
            <LinearGradient
              colors={['#FF90BB', '#FFC1DA', '#8ACCD5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroGreeting}>{getGreeting()}</Text>
              <Text style={styles.heroLabel}>Total Saldo / Anggaran</Text>
              <Text style={styles.heroAmount}>
                {formatRupiah(totalSisaSaldo !== null ? totalSisaSaldo : (totalBudget || 6500000))}
              </Text>

              <View style={styles.heroGrid}>
                <View style={styles.heroGridItem}>
                  <Text style={styles.heroGridLabel}>Cash (Tunai)</Text>
                  <Text style={styles.heroGridValue}>
                    {formatRupiah(sisaBudgetCash !== null ? sisaBudgetCash : 4000000)}
                  </Text>
                </View>
                <View style={styles.heroGridDivider} />
                <View style={styles.heroGridItem}>
                  <Text style={styles.heroGridLabel}>Paylater</Text>
                  <Text style={styles.heroGridValue}>
                    {formatRupiah(sisaBudgetPaylater !== null ? sisaBudgetPaylater : 2500000)}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </AnimatedCard>

          {/* Section 2: Monthly Summary */}
          <AnimatedCard index={2} triggerKey={String(isFocused)}>
            <View style={styles.summarySection}>
              {/* Income Summary Card */}
              <View style={styles.summaryCard}>
                <View style={[styles.summaryIconContainer, { backgroundColor: '#E6F7F9' }]}>
                  <Ionicons name="arrow-down-outline" size={16} color="#8ACCD5" />
                </View>
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Pemasukan Bulan Ini</Text>
                  <Text style={styles.summaryAmount}>{formatRupiah(totalIncome)}</Text>
                </View>
              </View>

              {/* Expense Summary Card */}
              <View style={[styles.summaryCard, { borderColor: 'rgba(255, 144, 187, 0.3)' }]}>
                <View style={[styles.summaryIconContainer, { backgroundColor: '#FFF0F5' }]}>
                  <Ionicons name="arrow-up-outline" size={16} color="#FF90BB" />
                </View>
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Pengeluaran Bulan Ini</Text>
                  <Text style={styles.summaryAmount}>{formatRupiah(totalExpense)}</Text>
                </View>
              </View>
            </View>
          </AnimatedCard>

          {/* Section 3: Quick Actions */}
          <AnimatedCard index={3} triggerKey={String(isFocused)}>
            <View style={styles.quickActions}>
              <Pressable 
                onPress={() => router.push('/(app)/add-transaction')}
                style={({ pressed }) => [styles.actionCard, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#FFF0F5' }]}>
                  <Ionicons name="add" size={24} color="#FF90BB" />
                </View>
                <Text style={styles.actionTitle}>Catat Manual</Text>
              </Pressable>

              <Pressable 
                onPress={() => setVoiceSheetVisible(true)}
                style={({ pressed }) => [styles.actionCard, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: '#E6F7F9' }]}>
                  <Ionicons name="mic" size={24} color="#8ACCD5" />
                </View>
                <Text style={styles.actionTitle}>Input Suara AI</Text>
              </Pressable>
            </View>
          </AnimatedCard>

          {/* Section 4: Financial Insight Section */}
          <AnimatedCard index={4} triggerKey={String(isFocused)}>
            <View style={styles.insightCard}>
              <View style={[styles.insightIconBox, { backgroundColor: insight.icon === '⚠️' ? '#FFEBF0' : '#FFF8E1' }]}>
                <Text style={styles.insightIcon}>{insight.icon}</Text>
              </View>
              <View style={styles.insightTextBox}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDesc}>{insight.description}</Text>
              </View>
            </View>
          </AnimatedCard>

          {/* Section 5: Recent Transactions */}
          <AnimatedCard index={5} triggerKey={String(isFocused)} style={{ flex: 1 }}>
            <View style={styles.operationsSection}>
              <View style={styles.dragHandle} />
              
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
                <Pressable onPress={() => router.push('/(app)/(tabs)/history')}>
                  <Text style={styles.viewAllText}>Lihat Semua</Text>
                </Pressable>
              </View>

              {latestTransactions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🧾</Text>
                  <Text style={styles.emptyText}>Belum ada transaksi tercatat.</Text>
                  <Text style={styles.emptySubtext}>Gunakan Catat Manual atau Input Suara untuk menambah transaksi.</Text>
                  <Pressable 
                    onPress={() => router.push('/(app)/add-transaction')}
                    style={styles.emptyButton}
                  >
                    <Text style={styles.emptyButtonText}>+ Tambah Transaksi</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.transactionsList}>
                  {/* Today Section */}
                  {todayTx.length > 0 && (
                    <View style={styles.dateGroup}>
                      <Text style={styles.dateHeader}>Hari Ini</Text>
                      <View style={styles.groupItems}>
                        {todayTx.map((tx, idx) => renderTransactionItem(tx, idx))}
                      </View>
                    </View>
                  )}

                  {/* Yesterday Section */}
                  {yesterdayTx.length > 0 && (
                    <View style={[styles.dateGroup, { marginTop: 16 }]}>
                      <Text style={styles.dateHeader}>Kemarin</Text>
                      <View style={styles.groupItems}>
                        {yesterdayTx.map((tx, idx) => renderTransactionItem(tx, idx))}
                      </View>
                    </View>
                  )}

                  {/* Older Section */}
                  {olderTx.length > 0 && (
                    <View style={[styles.dateGroup, { marginTop: 16 }]}>
                      <Text style={styles.dateHeader}>Lebih Lampau</Text>
                      <View style={styles.groupItems}>
                        {olderTx.map((tx, idx) => renderTransactionItem(tx, idx))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </AnimatedCard>
        </ScrollView>
      </ScreenTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean White background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  avatar: {
    shadowColor: '#FF90BB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  nameText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roundButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: '#FFF0F5',
  },
  cardPadding: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#FF90BB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroGreeting: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  heroLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  heroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
  },
  heroGridItem: {
    flex: 1,
  },
  heroGridDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  heroGridLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  heroGridValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
    marginTop: 2,
  },
  summarySection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(138, 204, 213, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 9,
    color: '#6B7280',
  },
  summaryAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: '#111827',
    marginTop: 1,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#111827',
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 144, 187, 0.15)',
    shadowColor: '#FF90BB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  insightIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightIcon: {
    fontSize: 20,
  },
  insightTextBox: {
    flex: 1,
  },
  insightTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#111827',
  },
  insightDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  operationsSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
    flex: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 8,
  },
  dragHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#111827',
  },
  viewAllText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#FF90BB',
  },
  transactionsList: {
    width: '100%',
  },
  dateGroup: {
    width: '100%',
  },
  dateHeader: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  groupItems: {
    gap: 10,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F9F9F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  textDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#111827',
  },
  rowTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  itemCategory: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: '#6B7280',
  },
  dot: {
    fontSize: 10,
    color: '#9CA3AF',
    marginHorizontal: 4,
  },
  itemDate: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: '#6B7280',
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  itemAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    marginBottom: 2,
  },
  payMethodTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  payMethodText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 8,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    width: '100%',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#111827',
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
  emptyButton: {
    marginTop: 12,
    backgroundColor: '#FF90BB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#FF90BB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  loadingTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
