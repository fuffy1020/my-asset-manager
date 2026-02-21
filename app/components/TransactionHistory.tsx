"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { X, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import type { Transaction, Currency } from '../lib/types';

const EX_RATE = 31.5;

interface TransactionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  displayCurrency: Currency;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }) + ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'tw_stock': return '台股';
    case 'us_stock': return '美股';
    default: return cat;
  }
}

// 將交易金額統一換算到 displayCurrency
function convertPrice(price: number, fromCurrency: Currency, toCurrency: Currency): number {
  if (fromCurrency === toCurrency) return price;
  if (fromCurrency === 'USD' && toCurrency === 'TWD') return price * EX_RATE;
  if (fromCurrency === 'TWD' && toCurrency === 'USD') return price / EX_RATE;
  return price;
}

export default function TransactionHistory({ isOpen, onClose, displayCurrency }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('載入失敗');
      setTransactions(await res.json());
    } catch (err) {
      console.error('載入交易紀錄失敗:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchTransactions();
  }, [isOpen, fetchTransactions]);

  // 按日期分組
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, txn) => {
    const dateKey = new Date(txn.date).toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(txn);
    return acc;
  }, {});

  const currencySymbol = displayCurrency === 'TWD' ? 'NT$' : 'US$';

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-slate-800 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">交易紀錄</h2>
            <p className="text-xs text-slate-500 mt-0.5">金額統一以 {displayCurrency} 顯示（匯率 1 USD = {EX_RATE} TWD）</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-emerald-400" />
              <span className="ml-3 text-slate-400">載入中...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 text-lg">尚無交易紀錄</p>
              <p className="text-slate-600 text-sm mt-2">買進或賣出股票後，紀錄將自動出現在這裡</p>
            </div>
          ) : (
            Object.entries(grouped).map(([dateKey, txns]) => (
              <div key={dateKey}>
                {/* 日期標題 */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-semibold text-slate-400">{dateKey}</span>
                  <div className="flex-1 border-t border-slate-700" />
                </div>

                {/* 交易清單 */}
                <div className="space-y-2">
                  {txns.map((txn) => {
                    const displayPrice = convertPrice(txn.price, txn.currency, displayCurrency);
                    const displayTotal = displayPrice * txn.shares;
                    const isConverted = txn.currency !== displayCurrency;

                    return (
                      <div
                        key={txn.id}
                        className="bg-slate-700/50 rounded-lg p-4 flex items-center gap-4"
                      >
                        {/* 買/賣 icon */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          txn.type === 'buy'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {txn.type === 'buy'
                            ? <TrendingUp size={18} />
                            : <TrendingDown size={18} />
                          }
                        </div>

                        {/* 內容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              txn.type === 'buy'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {txn.type === 'buy' ? '買進' : '賣出'}
                            </span>
                            <span className="text-xs text-slate-500">{categoryLabel(txn.category)}</span>
                          </div>
                          <p className="text-white font-semibold mt-1 truncate">
                            {txn.ticker} {txn.name}
                          </p>
                          {txn.note && (
                            <p className="text-xs text-slate-500 mt-1 truncate">{txn.note}</p>
                          )}
                        </div>

                        {/* 數量 & 價格（統一幣別） */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-white tabular-nums">
                            {txn.shares} 股
                          </p>
                          <p className="text-sm font-semibold text-slate-200 tabular-nums">
                            {currencySymbol} {displayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            @ {currencySymbol} {displayPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            {isConverted && <span className="text-slate-600 ml-1">(換算)</span>}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDate(txn.date).split(' ')[1]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
