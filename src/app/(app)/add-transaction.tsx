import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSheetStore } from '../../stores/useSheetStore';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const EXPENSE_CATEGORIES = [
  { name: 'Makanan & Minuman', emoji: '🍕' },
  { name: 'Transportasi', emoji: '🚗' },
  { name: 'Belanja', emoji: '🛍️' },
  { name: 'Tagihan & Utilitas', emoji: '💡' },
  { name: 'Hiburan', emoji: '🎬' },
  { name: 'Lainnya', emoji: '📦' },
];

const INCOME_CATEGORIES = [
  { name: 'Gaji', emoji: '💼' },
  { name: 'Investasi', emoji: '📈' },
  { name: 'Sampingan', emoji: '🚀' },
  { name: 'Hadiah', emoji: '🎁' },
  { name: 'Lainnya', emoji: '💰' },
];

export default function AddTransactionScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { addTransaction } = useSheetStore();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const [type, setType] = useState<'Pengeluaran' | 'Pemasukan'>('Pengeluaran');
  const [nominal, setNominal] = useState('');
  const [rawNominal, setRawNominal] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].name);
  const [pembayaran, setPembayaran] = useState('Cash');
  const [catatan, setCatatan] = useState('');
  const [tanggal, setTanggal] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual formatting helper to format digits to Indonesian Rupiah representation
  const formatRupiah = (digits: string) => {
    if (!digits) return '';
    const formatted = Number(digits).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `Rp ${formatted}`;
  };

  const handleNominalChange = (text: string) => {
    // Keep only numbers
    const cleanNumbers = text.replace(/[^0-9]/g, '');
    setRawNominal(cleanNumbers);
    setNominal(formatRupiah(cleanNumbers));
  };

  const handleTypeChange = (newType: 'Pengeluaran' | 'Pemasukan') => {
    setType(newType);
    // Automatically switch categories to match type
    const defaultCategory = newType === 'Pengeluaran' ? EXPENSE_CATEGORIES[0].name : INCOME_CATEGORIES[0].name;
    setCategory(defaultCategory);
  };

  const handleSubmit = async () => {
    setErrorMsg(null);

    // Form Validations
    if (!rawNominal || Number(rawNominal) <= 0) {
      setErrorMsg('Nominal harus lebih besar dari Rp 0.');
      return;
    }
    if (!keterangan.trim()) {
      setErrorMsg('Deskripsi / Item wajib diisi.');
      return;
    }
    if (!tanggal.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      setErrorMsg('Tanggal wajib diisi dengan format YYYY-MM-DD.');
      return;
    }

    if (!token) {
      setErrorMsg('Sesi login kedaluwarsa. Silakan masuk kembali.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction(token, {
        tanggal,
        kategori: `${type === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran'}: ${category}`,
        keterangan: keterangan.trim(),
        nominal: Number(rawNominal),
        pembayaran,
        catatan: catatan.trim(),
        sumberInput: 'Manual',
      });

      // Navigate back on success
      handleBack();
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      setErrorMsg(err.message || 'Gagal terhubung ke Google Sheets.');
      setIsSubmitting(false);
    }
  };

  const categories = type === 'Pengeluaran' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Custom Premium Header */}
        <View style={styles.header}>
          <Pressable 
            onPress={handleBack} 
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="arrow-back" size={22} color="#1E293B" />
          </Pressable>
          <Text style={styles.headerTitle}>Tambah Transaksi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {errorMsg && (
            <MotiView 
              from={{ opacity: 0, translateY: -10 }} 
              animate={{ opacity: 1, translateY: 0 }}
              style={styles.errorBox}
            >
              <Text style={styles.errorText}>{errorMsg}</Text>
            </MotiView>
          )}

          {/* Transaction Type Selector (Side-by-Side Toggle) */}
          <View style={styles.typeToggleContainer}>
            <Pressable 
              onPress={() => handleTypeChange('Pengeluaran')}
              style={[
                styles.typeToggleBtn, 
                type === 'Pengeluaran' && styles.typeToggleActiveExpense
              ]}
            >
              <Text style={[
                styles.typeToggleText, 
                type === 'Pengeluaran' && styles.typeToggleActiveText
              ]}>
                Pengeluaran
              </Text>
            </Pressable>
            <Pressable 
              onPress={() => handleTypeChange('Pemasukan')}
              style={[
                styles.typeToggleBtn, 
                type === 'Pemasukan' && styles.typeToggleActiveIncome
              ]}
            >
              <Text style={[
                styles.typeToggleText, 
                type === 'Pemasukan' && styles.typeToggleActiveText
              ]}>
                Pemasukan
              </Text>
            </Pressable>
          </View>

          {/* Premium Large Nominal Input */}
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400 }}
            style={styles.nominalContainer}
          >
            <Text style={styles.inputLabel}>Jumlah Nominal</Text>
            <TextInput
              mode="flat"
              placeholder="Rp 0"
              keyboardType="numeric"
              value={nominal}
              onChangeText={handleNominalChange}
              style={styles.nominalInput}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              placeholderTextColor="#94A3B8"
            />
          </MotiView>

          {/* Form Fields */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={styles.formCard}
          >
            {/* Description/Item */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Deskripsi / Item</Text>
              <TextInput
                mode="outlined"
                placeholder="misal: Belanja bulanan atau Gaji"
                value={keterangan}
                onChangeText={setKeterangan}
                outlineColor="#E2E8F0"
                activeOutlineColor="#FF90BB"
                style={styles.textInput}
                outlineStyle={{ borderRadius: 12 }}
              />
            </View>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Tanggal (YYYY-MM-DD)</Text>
              <TextInput
                mode="outlined"
                placeholder="YYYY-MM-DD"
                value={tanggal}
                onChangeText={setTanggal}
                outlineColor="#E2E8F0"
                activeOutlineColor="#FF90BB"
                style={styles.textInput}
                outlineStyle={{ borderRadius: 12 }}
              />
            </View>

            {/* Category Chips Scroll */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Kategori</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {categories.map((cat) => {
                  const isSelected = category === cat.name;
                  return (
                    <Pressable
                      key={cat.name}
                      onPress={() => setCategory(cat.name)}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected
                      ]}
                    >
                      <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                      <Text style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected
                      ]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Payment Method Toggle (Cash / Paylater) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Metode Pembayaran</Text>
              <View style={styles.paymentContainer}>
                <Pressable
                  onPress={() => setPembayaran('Cash')}
                  style={[
                    styles.paymentOption,
                    pembayaran === 'Cash' && styles.paymentOptionSelected
                  ]}
                >
                  <Ionicons 
                    name="cash-outline" 
                    size={18} 
                    color={pembayaran === 'Cash' ? '#2563EB' : '#64748B'} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[
                    styles.paymentText,
                    pembayaran === 'Cash' && styles.paymentTextSelected
                  ]}>
                    Tunai / Debit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPembayaran('Paylater')}
                  style={[
                    styles.paymentOption,
                    pembayaran === 'Paylater' && styles.paymentOptionSelected
                  ]}
                >
                  <Ionicons 
                    name="card-outline" 
                    size={18} 
                    color={pembayaran === 'Paylater' ? '#8ACCD5' : '#64748B'} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[
                    styles.paymentText,
                    pembayaran === 'Paylater' && styles.paymentTextSelected
                  ]}>
                    Paylater
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Catatan (Optional Notes) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Catatan (Opsional)</Text>
              <TextInput
                mode="outlined"
                placeholder="Tambah catatan tambahan..."
                value={catatan}
                onChangeText={setCatatan}
                multiline
                numberOfLines={3}
                outlineColor="#E2E8F0"
                activeOutlineColor="#FF90BB"
                style={[styles.textInput, styles.textArea]}
                outlineStyle={{ borderRadius: 12 }}
              />
            </View>
          </MotiView>

          {/* Submit Action */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 200 }}
            style={styles.actionContainer}
          >
            {isSubmitting ? (
              <View style={styles.submittingContainer}>
                <ActivityIndicator size="large" color="#FF90BB" />
                <Text style={styles.submittingText}>Mencatat transaksi ke Google Sheets...</Text>
              </View>
            ) : (
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.saveButton}
                labelStyle={styles.saveButtonLabel}
                contentStyle={styles.saveButtonContent}
              >
                Simpan Transaksi
              </Button>
            )}
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9', // Premium light-gray theme background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0,
    backgroundColor: '#F9F9F9', // Premium light-gray theme background
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#1E293B',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
  },
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  typeToggleActiveExpense: {
    backgroundColor: '#FF90BB', // Bubblegum Pink for expense
  },
  typeToggleActiveIncome: {
    backgroundColor: '#8ACCD5', // Sky Teal for income
  },
  typeToggleText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#64748B',
  },
  typeToggleActiveText: {
    color: '#FFFFFF',
  },
  nominalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6', // border-gray-100
  },
  inputLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  nominalInput: {
    width: '100%',
    backgroundColor: 'transparent',
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
    textAlign: 'center',
    height: 60,
    color: '#1E293B',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#F3F4F6', // border-gray-100
  },
  inputGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#1E293B',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
  },
  categoryScroll: {
    paddingVertical: 4,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: '#FFC1DA', // Blush Pink background
    borderColor: '#FF90BB', // Bubblegum Pink border
  },
  chipEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  chipText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#64748B',
  },
  chipTextSelected: {
    color: '#1E293B',
  },
  paymentContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  paymentOptionSelected: {
    backgroundColor: '#E6F4F8',
    borderColor: '#8ACCD5', // Sky Teal border
  },
  paymentIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  paymentText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#64748B',
  },
  paymentTextSelected: {
    color: '#1E293B',
  },
  actionContainer: {
    alignItems: 'center',
  },
  saveButton: {
    width: '100%',
    backgroundColor: '#FF90BB', // Bubblegum Pink
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  saveButtonLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  submittingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittingText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },
});
