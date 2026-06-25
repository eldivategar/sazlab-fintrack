import { create } from 'zustand';
import * as SecureStore from '../utils/secureStore';
import { 
  searchSpreadsheet, 
  createSpreadsheet, 
  initializeHeaders,
  appendTransactionRow,
  getTransactionRows,
  deleteTransactionRow,
  updateBudgets,
  clearAllTransactions,
  GoogleApiError 
} from '../services/googleSheets';
import { useAuthStore } from './useAuthStore';

const SHEET_ID_KEY = 'fintrack_spreadsheet_id';

export interface TransactionInput {
  tanggal: string;
  kategori: string;
  keterangan: string;
  nominal: number;
  pembayaran: string;
  catatan?: string;
  sumberInput: 'Manual' | 'Voice';
}

export interface Transaction {
  id: string;
  tanggal: string;
  kategori: string;
  keterangan: string;
  nominal: number;
  pembayaran: string;
  catatan: string;
  sumberInput: string;
  rowIndex: number;
}

interface SheetState {
  spreadsheetId: string | null;
  status: 'idle' | 'initializing' | 'ready' | 'error';
  error: string | null;
  transactions: Transaction[];
  isLoadingTransactions: boolean;
  totalBudget: number | null;
  budgetPaylater: number | null;
  sisaBudgetCash: number | null;
  sisaBudgetPaylater: number | null;
  totalBudgetCash: number | null;
  totalSisaSaldo: number | null;
  isTemplateFormat: boolean;
  isNewTemplate: boolean;
  initializeSheet: (token: string, isRetry?: boolean) => Promise<void>;
  fetchTransactions: (token: string, isRetry?: boolean) => Promise<void>;
  addTransaction: (token: string, transaction: TransactionInput, isRetry?: boolean) => Promise<void>;
  deleteTransaction: (token: string, sheetRowIndex: number, isRetry?: boolean) => Promise<void>;
  updateStoreBudgets: (token: string, cashBudget: number, paylaterBudget: number, isRetry?: boolean) => Promise<void>;
  resetAllData: (token: string, isRetry?: boolean) => Promise<void>;
  reset: () => void;
}

const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const beforeComma = val.split(',')[0];
    const cleanBeforeComma = beforeComma.replace(/[^0-9-]/g, '');
    return Number(cleanBeforeComma) || 0;
  }
  return Number(val) || 0;
};

const parseRows = (rows: any[][], isTemplateFormat: boolean, isNewTemplate: boolean): Transaction[] => {
  const offset = isTemplateFormat ? (isNewTemplate ? 6 : 5) : 0;
  const transactionRows = rows.slice(offset);
  const startRowOffset = isTemplateFormat ? (isNewTemplate ? 8 : 7) : 2;
  
  return transactionRows.map((row, idx) => ({
    id: `row-${idx}`,
    tanggal: row[0] || '',
    kategori: row[1] || '',
    keterangan: row[2] || '',
    nominal: parseNumber(row[3]),
    pembayaran: row[4] || '',
    catatan: row[5] || '',
    sumberInput: row[6] || '',
    rowIndex: idx + startRowOffset,
  }));
};

export const useSheetStore = create<SheetState>((set, get) => ({
  spreadsheetId: null,
  status: 'idle',
  error: null,
  transactions: [],
  isLoadingTransactions: false,
  totalBudget: null,
  budgetPaylater: null,
  sisaBudgetCash: null,
  sisaBudgetPaylater: null,
  totalBudgetCash: null,
  totalSisaSaldo: null,
  isTemplateFormat: false,
  isNewTemplate: false,

  initializeSheet: async (token: string, isRetry?: boolean) => {
    set({ status: 'initializing', error: null });
    try {
      // 1. Get cached ID from SecureStore
      const cachedId = await SecureStore.getItemAsync(SHEET_ID_KEY);
      
      // 2. Search for spreadsheets named 'SiPaling Hemat Data'
      const query = encodeURIComponent("name = 'SiPaling Hemat Data' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
      
      const searchRes = await fetch(searchUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!searchRes.ok) {
        if (searchRes.status === 401) {
          throw new GoogleApiError('UNAUTHORIZED', 401);
        }
        const errText = await searchRes.text();
        throw new GoogleApiError(`Failed to search spreadsheet: ${errText}`, searchRes.status);
      }
      
      const searchData = await searchRes.json();
      const files = searchData.files || [];
      
      let activeSheetId = null;
      
      if (files.length > 0) {
        // If cachedId is still in the found files list, use it to maintain pinning.
        // Otherwise, fall back to the first found file.
        const hasCached = files.some((f: any) => f.id === cachedId);
        if (cachedId && hasCached) {
          activeSheetId = cachedId;
        } else {
          activeSheetId = files[0].id;
          await SecureStore.setItemAsync(SHEET_ID_KEY, activeSheetId);
        }
      } else {
        // 3. Create a new spreadsheet if not found
        console.log('No spreadsheet found. Creating a new one...');
        const newSheetId = await createSpreadsheet(token);
        
        // Initialize header row
        await initializeHeaders(token, newSheetId);
        activeSheetId = newSheetId;
        await SecureStore.setItemAsync(SHEET_ID_KEY, activeSheetId);
      }

      // Update state and load transactions
      if (activeSheetId) {
        set({ spreadsheetId: activeSheetId, status: 'ready' });
        await get().fetchTransactions(token);
      }
    } catch (err: any) {
      console.error('Failed to initialize Google Sheet:', err);
      
      if (err instanceof GoogleApiError && err.status === 401 && !isRetry) {
        const newToken = await useAuthStore.getState().refreshToken();
        if (newToken) {
          return get().initializeSheet(newToken, true);
        }
        set({ status: 'error', error: 'Session expired. Please log in again.' });
        await useAuthStore.getState().logout();
      } else {
        set({ status: 'error', error: err.message || 'Failed to initialize database.' });
      }
    }
  },

  fetchTransactions: async (token: string, isRetry?: boolean) => {
    const { spreadsheetId } = get();
    if (!spreadsheetId) return;

    set({ isLoadingTransactions: true });
    try {
      const rows = await getTransactionRows(token, spreadsheetId);
      const isTemplateFormat = rows.length > 0 && rows[0] && (
        rows[0][2] === 'Total Budget Cash' || 
        rows[0][2] === 'Total Budget'
      );
      
      let totalBudgetCash = null;
      let totalBudgetPaylater = null;
      let sisaBudgetCash = null;
      let sisaBudgetPaylater = null;
      let totalSisaSaldo = null;
      let isNewTemplate = false;

      if (isTemplateFormat) {
        isNewTemplate = rows[0] && rows[0][2] === 'Total Budget Cash';
        if (isNewTemplate) {
          totalBudgetCash = parseNumber(rows[0][3]); // Row 2 Col D
          totalBudgetPaylater = parseNumber(rows[1][3]); // Row 3 Col D
          sisaBudgetCash = parseNumber(rows[2][3]); // Row 4 Col D
          sisaBudgetPaylater = parseNumber(rows[3][3]); // Row 5 Col D
          totalSisaSaldo = parseNumber(rows[4][3]); // Row 6 Col D
        } else {
          // Old template compatibility
          const oldTotalBudget = parseNumber(rows[0][3]);
          totalBudgetPaylater = parseNumber(rows[1][3]);
          totalBudgetCash = oldTotalBudget - totalBudgetPaylater;
          sisaBudgetCash = parseNumber(rows[2][3]);
          sisaBudgetPaylater = parseNumber(rows[3][3]);
          totalSisaSaldo = sisaBudgetCash + sisaBudgetPaylater;
        }
      }

      const parsed = parseRows(rows, isTemplateFormat, isNewTemplate);
      // Sort transactions from newest to oldest (since they are appended at the bottom, reverse them!)
      set({ 
        transactions: parsed.reverse(), 
        isLoadingTransactions: false,
        isTemplateFormat,
        isNewTemplate,
        totalBudget: totalSisaSaldo !== null ? totalSisaSaldo : (isTemplateFormat ? totalBudgetCash! + totalBudgetPaylater! : null),
        budgetPaylater: totalBudgetPaylater,
        sisaBudgetCash,
        sisaBudgetPaylater,
        totalBudgetCash,
        totalSisaSaldo,
      });
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      if (err instanceof GoogleApiError && err.status === 401 && !isRetry) {
        const newToken = await useAuthStore.getState().refreshToken();
        if (newToken) {
          return get().fetchTransactions(newToken, true);
        }
        await useAuthStore.getState().logout();
      }
      set({ isLoadingTransactions: false, status: 'error', error: err.message });
    }
  },

  addTransaction: async (token: string, transaction: TransactionInput, isRetry?: boolean) => {
    const { spreadsheetId, isTemplateFormat, isNewTemplate } = get();
    if (!spreadsheetId) {
      throw new Error('Database is not initialized.');
    }

    try {
      const row = [
        transaction.tanggal,
        transaction.kategori,
        transaction.keterangan,
        transaction.nominal,
        transaction.pembayaran,
        transaction.catatan || '',
        transaction.sumberInput,
      ];
      
      let range = 'Transaksi!A2';
      if (isTemplateFormat) {
        range = isNewTemplate ? 'Transaksi!A8' : 'Transaksi!A7';
      }
      
      await appendTransactionRow(token, spreadsheetId, row, range);
      
      // Refresh transactions list
      await get().fetchTransactions(token);
    } catch (err: any) {
      console.error('Failed to add transaction:', err);
      if (err instanceof GoogleApiError && err.status === 401 && !isRetry) {
        const newToken = await useAuthStore.getState().refreshToken();
        if (newToken) {
          return get().addTransaction(newToken, transaction, true);
        }
        await useAuthStore.getState().logout();
      }
      throw err;
    }
  },

  deleteTransaction: async (token: string, sheetRowIndex: number, isRetry?: boolean) => {
    const { spreadsheetId } = get();
    if (!spreadsheetId) {
      throw new Error('Database is not initialized.');
    }

    try {
      await deleteTransactionRow(token, spreadsheetId, sheetRowIndex);
      await get().fetchTransactions(token);
    } catch (err: any) {
      console.error('Failed to delete transaction:', err);
      if (err instanceof GoogleApiError && err.status === 401 && !isRetry) {
        const newToken = await useAuthStore.getState().refreshToken();
        if (newToken) {
          return get().deleteTransaction(newToken, sheetRowIndex, true);
        }
        await useAuthStore.getState().logout();
      }
      throw err;
    }
  },

  updateStoreBudgets: async (token: string, cashBudget: number, paylaterBudget: number, isRetry?: boolean) => {
    const { spreadsheetId } = get();
    if (!spreadsheetId) {
      throw new Error('Database is not initialized.');
    }

    try {
      await updateBudgets(token, spreadsheetId, cashBudget, paylaterBudget);
      // Refresh transactions to re-calculate Sisa Saldo automatically using Google Sheets logic
      await get().fetchTransactions(token);
    } catch (err: any) {
      console.error('Failed to update budgets:', err);
      if (err instanceof GoogleApiError && err.status === 401 && !isRetry) {
        const newToken = await useAuthStore.getState().refreshToken();
        if (newToken) {
          return get().updateStoreBudgets(newToken, cashBudget, paylaterBudget, true);
        }
        await useAuthStore.getState().logout();
      }
      throw err;
    }
  },

  resetAllData: async (token: string, isRetry?: boolean) => {
    const { spreadsheetId, isNewTemplate } = get();
    if (!spreadsheetId) {
      throw new Error('Database is not initialized.');
    }

    try {
      await clearAllTransactions(token, spreadsheetId, isNewTemplate);
      // Refresh transactions after clear
      await get().fetchTransactions(token);
    } catch (err: any) {
      console.error('Failed to reset data:', err);
      if (err instanceof GoogleApiError && err.status === 401 && !isRetry) {
        const newToken = await useAuthStore.getState().refreshToken();
        if (newToken) {
          return get().resetAllData(newToken, true);
        }
        await useAuthStore.getState().logout();
      }
      throw err;
    }
  },

  reset: () => {
    set({ 
      spreadsheetId: null, 
      status: 'idle', 
      error: null, 
      transactions: [], 
      isLoadingTransactions: false,
      totalBudget: null,
      budgetPaylater: null,
      sisaBudgetCash: null,
      sisaBudgetPaylater: null,
      totalBudgetCash: null,
      totalSisaSaldo: null,
      isTemplateFormat: false,
      isNewTemplate: false,
    });
  },
}));
