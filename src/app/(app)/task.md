# Tasks

## Phase 5: Fitur Tambahan & Laporan Lengkap
- [x] Integrate Swipe-to-Delete Sheets Dimension Call
  - [x] Add `deleteTransactionRow` method in `src/services/googleSheets.ts`
  - [x] Configure explicit `sheetId: 0` during spreadsheet creation properties for safe index matching
  - [x] Add original `rowIndex` tracking inside transaction parser in `src/stores/useSheetStore.ts`
  - [x] Register `deleteTransaction` Zustand action and refresh history on completion
- [x] Implement Transaction History Screen (Riwayat Transaksi)
  - [x] Create `src/app/(app)/(tabs)/history.tsx` tab screen
  - [x] Build collapsible filter panel (text search, date ranges, emoji category chips, payment methods)
  - [x] Implement FlatList pseudo-pagination with `onEndReached` callback for infinite scroll performance
  - [x] Wrap item cards in `Swipeable` from `react-native-gesture-handler` to reveal delete actions
  - [x] Integrate native confirm alerts and trigger sheet row deletion BatchUpdate calls
- [x] Implement Category Budgets Tracking Screen
  - [x] Create `src/stores/useBudgetStore.ts` store with SecureStore persistence and default values
  - [x] Update `src/app/(app)/(tabs)/reports.tsx` to list budget details
  - [x] Compute progress bar ratios (Spent / Budget) and colorize over-budget limit status to red
  - [x] Build Portal popup modal dialog to edit budget amounts dynamically
- [x] Implement Daily Logging Notifications Reminder
  - [x] Install `expo-notifications` native package
  - [x] Create `src/stores/useSettingsStore.ts` store to persist alarm toggles and target times
  - [x] Implement daily scheduling triggers using `expo-notifications` SchedulableTriggerInputTypes.DAILY
  - [x] Create settings configuration panel in `src/app/(app)/(tabs)/settings.tsx` with user profiles
  - [x] Wrap root layout stack in GestureHandlerRootView in `src/app/_layout.tsx` and register foreground handler behavior
- [x] Refactor Claude API to SumoPod AI API
  - [x] Refactor `src/services/aiParser.ts` for OpenAI-compatible chat completions
  - [x] Update key lookups and invocation in `src/components/VoiceInputSheet.tsx`
  - [x] Verify typecheck runs successfully (`npx tsc --noEmit`)
- [x] Refactor Google STT to Groq API (Whisper)
  - [x] Refactor `src/services/speechToText.ts` to call Groq's transcription endpoint using FormData
  - [x] Update key lookups in `src/components/VoiceInputSheet.tsx` for `EXPO_PUBLIC_GROQ_API_KEY`
  - [x] Update `.env` variables list
- [x] Fix cross-platform SecureStore Web incompatibility
  - [x] Create custom `src/utils/secureStore.ts` helper falling back to localStorage on Web
  - [x] Redirect all SecureStore imports across Zustand stores to use the new helper
  - [x] Delete unused template files `app-tabs.tsx` and `app-tabs.web.tsx` to fix routing errors
  - [x] Verify typecheck runs successfully (`npx tsc --noEmit`)

## Phase 6: UI/UX Refinement & Indonesian Localization
- [x] Set all page/modal background surfaces to clean `#FFFFFF`
- [x] Enhance card shadows (`shadowOpacity: 0.08`, `shadowRadius: 10`, `elevation: 3`) across all tabs/modals
- [x] Translate daily push notification reminder to Indonesian in `useSettingsStore.ts`
- [x] Translate microphone, file-not-found, and recording start errors to Indonesian in `VoiceInputSheet.tsx`
- [x] Fix budget category lookup bug by changing `DEFAULT_BUDGETS` keys to Indonesian in `useBudgetStore.ts`
- [x] Verify compile-time checks compile successfully via `npx tsc --noEmit`

## Phase 7: Inisialisasi Template & Deteksi Format Ganda
- [x] Update initializeHeaders in googleSheets.ts
- [x] Update useSheetStore.ts state, parseRows and fetchTransactions
- [x] Update Dashboard (index.tsx) with Sisa Anggaran card
- [x] Reposition and redesign filter button in history.tsx
- [x] Run typescript check to verify compile success

## Phase 8: Perombakan Total UI/UX Sesuai Template Premium Banking
- [x] Rebuild TabBar.tsx with dark theme and Ionicons
- [x] Overhaul index.tsx (Dashboard) to premium banking style
- [x] Cohesively style other pages (history, reports, settings, add-transaction)
- [x] Verify compiling and run typecheck
