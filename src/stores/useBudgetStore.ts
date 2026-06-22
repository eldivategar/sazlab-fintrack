import { create } from 'zustand';
import * as SecureStore from '../utils/secureStore';

const BUDGETS_KEY = 'fintrack_category_budgets';

export interface Budgets {
  [category: string]: number;
}

const DEFAULT_BUDGETS: Budgets = {
  'Makanan & Minuman': 2000000,
  'Transportasi': 500000,
  'Belanja': 1000000,
  'Tagihan & Utilitas': 1500000,
  'Hiburan': 500000,
  'Lainnya': 500000,
};

interface BudgetState {
  budgets: Budgets;
  loadBudgets: () => Promise<void>;
  updateBudget: (category: string, amount: number) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: DEFAULT_BUDGETS,

  loadBudgets: async () => {
    try {
      const stored = await SecureStore.getItemAsync(BUDGETS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all categories have a value
        set({ budgets: { ...DEFAULT_BUDGETS, ...parsed } });
      } else {
        set({ budgets: DEFAULT_BUDGETS });
      }
    } catch (error) {
      console.error('Failed to load budgets:', error);
      set({ budgets: DEFAULT_BUDGETS });
    }
  },

  updateBudget: async (category: string, amount: number) => {
    try {
      const { budgets } = get();
      const updated = { ...budgets, [category]: amount };
      set({ budgets: updated });
      await SecureStore.setItemAsync(BUDGETS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save budget:', error);
    }
  },
}));
