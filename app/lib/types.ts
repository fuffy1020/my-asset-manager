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
