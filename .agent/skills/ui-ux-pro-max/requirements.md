# FinTrack - Project Requirements & AI Agent Rules

## 1. Project Overview
FinTrack adalah aplikasi manajemen keuangan pribadi berbasis mobile (Android) yang memungkinkan pencatatan transaksi via teks maupun suara (AI parsing), menggunakan Google Spreadsheet sebagai backend/database.

## 2. Tech Stack & Architecture
- **Framework:** Expo SDK (React Native) - Strictly NO bare React Native workflow.
- **Language:** TypeScript (Strict Mode).
- **Routing:** Expo Router (File-based routing).
- **State Management:** Zustand.
- **Animations:** React Native Reanimated 3 + Moti.
- **UI Components:** React Native Paper + Custom Components.
- **Authentication:** Google OAuth 2.0 via `expo-auth-session`.
- **Backend/DB:** Google Sheets API v4 (REST endpoint via HTTP requests).
- **AI/Parsing:** Claude API (Anthropic) untuk ekstraksi teks ke JSON.
- **Local Storage:** `expo-secure-store` (untuk access token & kredensial).
- **Charts:** Victory Native atau Gifted Charts.

## 3. Core Principles & Constraints (CRITICAL FOR AI AGENT)
- **No Traditional Database:** Jangan gunakan Firebase, Supabase, SQLite, atau backend kustom. SEMUA operasi CRUD harus dilakukan ke Google Sheets milik pengguna menggunakan HTTP REST (`https://sheets.googleapis.com/v4/spreadsheets/...`).
- **Authorization:** Selalu gunakan Bearer Token dari Google Sign-In untuk request ke Google Sheets API.
- **UI First:** Aplikasi harus terasa modern, gunakan animasi `shared element transitions` antar halaman dan `staggered fade-in/slide-up` untuk kemunculan list/kartu.
- **Environment Variables:** Semua API Keys (Google OAuth Client ID, Claude API Key) HARUS ditempatkan di file `.env` dan diakses menggunakan `expo-constants` atau `process.env`.

## 4. UI/UX Design System
### Color Palette
- Action/CTA (Bubblegum Pink): `#FF90BB`
- Card/Hover (Blush Pink): `#FFC1DA`
- Surface/Background (Cream): `#F8F8E1`
- Accent/Info (Sky Teal): `#8ACCD5`
- Text Colors: Dark Slate / Blackish untuk teks utama demi aksesibilitas.

### Typography
- Gunakan `Poppins` (via `expo-font` / Google Fonts).
- Headings: Poppins Bold (24-32px).
- Subheadings: Poppins SemiBold (16-20px).
- Body: Poppins Regular (14px).
- Amount/Numbers: Poppins Bold (18-28px).

## 5. Google Sheets Column Structure
Saat aplikasi menginisialisasi atau membaca data, format kolom yang berlaku adalah:
`A: Tanggal | B: Kategori | C: Keterangan/Item | D: Nominal | E: Pembayaran (Cash/Paylater) | F: Catatan | G: Sumber Input (Manual/Voice)`

## 6. AI Agent Guidelines (How to code)
- Jangan menulis blok kode dalam jumlah masif sekaligus. Kerjakan fitur per komponen secara modular.
- Pastikan import komponen pihak ketiga kompatibel dengan versi Expo SDK terbaru.
- Ekstrak *styling* (StyleSheet) di luar komponen render untuk optimasi memori.
- Gunakan fungsionalitas `try/catch` untuk semua asynchronous calls (API Sheets & Auth).
- Jika kamu kebingunan saat sedang mengerjakan sesuatu, akses dokumen FinTrack_PRD_FRD_v1.0.docx yang ada di root folder projek agar kamu tau apa yang sedang kita buat. Semua yang kamu perlukan ada di dokumen ini.