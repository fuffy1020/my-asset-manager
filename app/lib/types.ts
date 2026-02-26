export type Currency = 'TWD' | 'USD';
export type AssetCategory = 'tw_stock' | 'us_stock' | 'cash';

export interface Holding {
  ticker: string;
  name: string;
  category: AssetCategory;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currency: Currency;
}

export interface CashEntry {
  id: string;
  bankName: string;
  amount: number;
  currency: Currency;
}

export interface PriceMeta {
  lastFetchedAt: string | null;
}

export type TransactionType = 'buy' | 'sell';

export interface Transaction {
  id: string;
  type: TransactionType;
  ticker: string;
  name: string;
  category: AssetCategory;
  shares: number;
  price: number;
  currency: Currency;
  date: string;       // ISO string
  note?: string;
}

export interface AssetSnapshot {
  date: string;        // YYYY-MM-DD
  twStockTWD: number;  // 台股市值 (TWD)
  usStockTWD: number;  // 美股市值 (換算 TWD)
  cashTWD: number;     // 現金 (換算 TWD)
  totalTWD: number;    // 總資產 (TWD)
}
