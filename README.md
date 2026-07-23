# 💳 FinTrack — Mobile Finance Tracking & AI Assistant

**FinTrack** adalah aplikasi pelacak & manajemen keuangan pribadi berbasis mobile yang modern, intuitif, dan cerdas. Aplikasi ini dirancang untuk memudahkan pencatatan keuangan harian, analisis anggaran, serta integrasi langsung dengan **Google Sheets** sebagai database transaksi pribadi pengguna, dilengkapi dengan **AI Assistant (Groq API)** untuk pencatatan otomatis via teks & suara.

---

## 📑 Daftar Isi

- [🎯 Tujuan & Arti Aplikasi](#-tujuan--arti-aplikasi)
- [✨ Fitur Utama](#-fitur-utama)
- [🛠️ Tech Stack & Dependensi](#️-tech-stack--dependensi)
- [🏗️ Arsitektur & Struktur Folder](#️-arsitektur--struktur-folder)
- [⚙️ Konfigurasi Environment (`.env`)](#%EF%B8%8F-konfigurasi-environment-env)
- [🚀 Cara Menjalankan Project](#-cara-menjalankan-project)
- [📦 Panduan Build APK / Native](#-panduan-build-apk--native)
- [🤝 Panduan Kontribusi](#-panduan-kontribusi)

---

## 🎯 Tujuan & Arti Aplikasi

Banyak orang kesulitan mencatat keuangan karena proses input manual yang rumit dan kekhawatiran privasi data keuangan di server pihak ketiga.  
FinTrack hadir menyelesaikan masalah tersebut dengan:
1. **Kemudahan Input**: Mencatat transaksi secara instan menggunakan perintah suara (voice) atau teks alami dengan bantuan AI.
2. **Kepemilikan Data**: Menyimpan data transaksi langsung di Google Sheets milik pengguna sendiri.
3. **Analisis Visual**: Menampilkan grafik pengeluaran & anggaran yang jernih dan menarik.

---

## ✨ Fitur Utama

- 📊 **Dashboard & Chart**: Ringkasan saldo, pemasukan, pengeluaran, dan grafik analisis mingguan/bulanan.
- 🤖 **AI Voice & Text Input**: Catat transaksi otomatis lewat pesan teks alami atau rekaman suara.
- 🟢 **Google Sheets Sync**: Sinkronisasi dua arah untuk membaca dan menulis transaksi langsung ke spreadsheet pengguna.
- 📋 **Riwayat & Filter**: Pencarian transaksi, filter berdasarkan tanggal/kategori, dan ekspor data.
- 🎯 **Budgeting**: Pengaturan batas anggaran per kategori dengan indikator kemajuan.
- 🔒 **Otentikasi Aman**: Log in menggunakan akun Google.
- 🎨 **UI Dynamic & Glassmorphism**: Tampilan modern, responsif, dan interaktif.

---

## 🛠️ Tech Stack & Dependensi

| Kategori | Teknologi / Library |
| :--- | :--- |
| **Framework Utama** | [Expo SDK 56](https://expo.dev) + [React Native 0.85](https://reactnative.dev) |
| **Routing** | [Expo Router v56](https://docs.expo.dev/router/introduction/) (File-based routing) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) |
| **UI Component & Styling** | React Native Paper, React Native Reanimated, Moti, Expo Blur / Glass Effect |
| **Visualisasi Data** | React Native Gifted Charts, React Native SVG |
| **Layanan AI & Voice** | Groq API (LLM) & Audio Recording |
| **Database / Integrasi** | Google Sheets API & Auth Session |

---

## 🏗️ Arsitektur & Struktur Folder

Proyek ini menggunakan pola arsitektur **Feature-based & Layered Architecture** yang bersih dan terisolasi.

```text
fintrack/
├── app.json                # Konfigurasi aplikasi Expo
├── babel.config.js         # Konfigurasi Babel (Expo & Reanimated plugin)
├── metro.config.js         # Konfigurasi bundler Metro
├── package.json            # Manifest dependensi & script npm
├── src/
│   ├── app/                # Route & Halaman Aplikasi (Expo Router)
│   │   ├── _layout.tsx     # Root Layout (Provider, Navigation Container)
│   │   ├── (auth)/         # Group route untuk halaman Autentikasi (Login)
│   │   └── (app)/          # Group route untuk halaman Utama (Terproteksi)
│   │       ├── (tabs)/     # Tab Navigation (Dashboard, History, Reports, Settings)
│   │       └── add-transaction.tsx  # Halaman Tambah Transaksi / AI Input
│   ├── components/         # Komponen UI Reusable (Card, Modal, Chart, Input)
│   ├── constants/          # Konfigurasi konstanta (Warna, Kategori, Theme)
│   ├── hooks/              # Custom React Hooks
│   ├── screens/            # Layar aplikasi komputasi / UI per halaman
│   ├── services/           # Service layer untuk API eksternal
│   │   ├── aiContextBuilder.ts # Menyusun konteks transaksi untuk AI
│   │   ├── aiParser.ts         # Parser respons AI ke format transaksi
│   │   ├── googleSheets.ts     # Integrasi Google Sheets API
│   │   ├── groqService.ts      # Client API Groq (LLM)
│   │   └── speechToText.ts     # Pengolahan audio ke teks
│   ├── stores/             # Global State Management (Zustand)
│   │   ├── useAiChatStore.ts   # State percakapan AI
│   │   ├── useAuthStore.ts     # State autentikasi pengguna
│   │   ├── useBudgetStore.ts   # State anggaran
│   │   ├── useSettingsStore.ts # State pengaturan aplikasi
│   │   ├── useSheetStore.ts    # State data transaksi Google Sheets
│   │   └── useUIStore.ts       # State modal & komponen UI
│   └── utils/              # Helper utility functions (Format mata uang, tanggal)
```

---

## ⚙️ Konfigurasi Environment (`.env`)

Buat file `.env` di root folder aplikasi dengan menyalin dari `.env.example`:

```bash
cp .env.example .env
```

Isi variabel environment berikut sesuai konfigurasi Anda:

```env
# Groq AI Service API Key
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key_here

# Google OAuth & Sheets Configuration
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## 🚀 Cara Menjalankan Project

### 1. Prasyarat
- Node.js (v18+ direkomendasikan)
- Aplikasi **Expo Go** di HP (Android/iOS) atau Emulator/Simulator.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Jalankan Development Server
```bash
npm start
```
Atau khusus platform:
```bash
npm run android   # Untuk Android Emulator / Device via USB
npm run ios       # Untuk iOS Simulator (macOS saja)
npm run web       # Untuk menjalankan versi Web
```

---

## 📦 Panduan Build APK / Native

Untuk membuat build release Android (APK):
```bash
npm run build:apk:android
```
*Script ini akan menjalankan prebuild Expo dan melakukan kompilasi Gradle ke file APK Release.*

---

## 🤝 Panduan Kontribusi

Ingin menambahkan fitur atau memperbaiki bug? Kami sangat menyambut kontribusi Anda!

1. **Fork** repositori ini.
2. Buat branch fitur baru (`git checkout -b feature/FiturBaru`).
3. Pastikan kode mengikuti struktur di folder `src/` (Komponen di `src/components`, State di `src/stores`, Service API di `src/services`).
4. Commit perubahan Anda (`git commit -m 'feat: menambahkan fitur X'`).
5. Push ke branch Anda (`git push origin feature/FiturBaru`).
6. Buat **Pull Request** baru.

---

### 📄 Lisensi

Proyek ini dilindungi di bawah lisensi [MIT](LICENSE).

---
🤖 *Maintained & Built with Gemini AI Agent*
