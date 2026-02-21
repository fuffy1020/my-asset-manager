"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { DollarSign, PlusCircle, Loader2, Wallet, RefreshCw, Trash2, ClipboardList, LayoutList } from 'lucide-react';
import StockDonutChart from './components/StockDonutChart';
import TransactionHistory from './components/TransactionHistory';
import HoldingsManager from './components/HoldingsManager';
import type { Holding, Currency, AssetCategory, CashEntry } from './lib/types';

// --- 常數 ---
const EX_RATE = 31.5;
const DONUT_COLORS_TW = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
const DONUT_COLORS_US = ['#0066cc', '#60a5fa', '#34d399', '#86efac', '#a78bfa', '#f472b6'];

// --- Helpers ---
function computeHoldingStats(holdings: Holding[]) {
  let totalValue = 0;
  let totalCost = 0;
  const items = holdings.map((h) => {
    const mv = h.shares * h.currentPrice;
    const cost = h.shares * h.avgCost;
    totalValue += mv;
    totalCost += cost;
    return { ...h, marketValue: mv, cost };
  });
  const totalProfit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  return { items, totalValue, totalCost, totalProfit, profitPercent };
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} 小時 ${minutes} 分鐘前`;
  return `${minutes} 分鐘前`;
}

export default function AssetManager() {
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('TWD');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cashMessage, setCashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [priceStatus, setPriceStatus] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [holdingsMgrOpen, setHoldingsMgrOpen] = useState(false);

  // 表單狀態
  const [tradeForm, setTradeForm] = useState({
    ticker: '', name: '', category: 'tw_stock' as AssetCategory, price: '', currentPrice: '', shares: '',
  });
  const [cashForm, setCashForm] = useState({
    bankName: '', amount: '', currency: 'TWD' as Currency,
  });

  // --- 載入持股 ---
  const fetchHoldings = useCallback(async () => {
    try {
      const res = await fetch('/api/holdings');
      if (!res.ok) throw new Error('載入失敗');
      setHoldings(await res.json());
    } catch (err) {
      console.error('載入持股失敗:', err);
    }
  }, []);

  // --- 載入現金 ---
  const fetchCash = useCallback(async () => {
    try {
      const res = await fetch('/api/cash');
      if (!res.ok) throw new Error('載入失敗');
      setCashEntries(await res.json());
    } catch (err) {
      console.error('載入現金失敗:', err);
    }
  }, []);

  // --- 更新股價 ---
  const refreshPrices = useCallback(async () => {
    setPriceRefreshing(true);
    setPriceStatus({ text: '正在從 Yahoo Finance 檢查最新價格...', type: 'info' });
    try {
      const res = await fetch('/api/prices/refresh');
      const data = await res.json();
      if (data.skipped) {
        setPriceStatus({
          text: `⏳ ${data.message}（上次更新：${timeAgo(data.lastFetchedAt)}）`,
          type: 'info',
        });
      } else {
        setPriceStatus({
          text: `✅ ${data.message}`,
          type: data.errors?.length ? 'error' : 'success',
        });
        // 重新載入持股以反映新價格
        await fetchHoldings();
      }
    } catch {
      setPriceStatus({ text: '❌ 價格更新失敗', type: 'error' });
    } finally {
      setPriceRefreshing(false);
    }
  }, [fetchHoldings]);

  // --- 載入上次更新時間 ---
  const fetchPriceMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/prices/refresh-status');
      if (!res.ok) return;
      const data = await res.json();
      if (data.lastFetchedAt) {
        setPriceStatus({ text: `上次更新：${timeAgo(data.lastFetchedAt)}`, type: 'info' });
      }
    } catch { /* silent */ }
  }, []);

  // --- 初始載入（不自動爬蟲）---
  useEffect(() => {
    async function init() {
      await Promise.all([fetchHoldings(), fetchCash()]);
      setLoading(false);
      fetchPriceMeta();
    }
    init();
  }, [fetchHoldings, fetchCash, fetchPriceMeta]);

  // --- 計算 ---
  const twHoldings = useMemo(() => holdings.filter(h => h.category === 'tw_stock'), [holdings]);
  const usHoldings = useMemo(() => holdings.filter(h => h.category === 'us_stock'), [holdings]);
  const twStats = useMemo(() => computeHoldingStats(twHoldings), [twHoldings]);
  const usStats = useMemo(() => computeHoldingStats(usHoldings), [usHoldings]);

  const twPieData = twStats.items.map((h, i) => ({
    ticker: h.ticker,
    name: `${h.ticker} ${h.name}`, value: h.marketValue,
    color: DONUT_COLORS_TW[i % DONUT_COLORS_TW.length],
  }));
  const usPieData = usStats.items.map((h, i) => ({
    ticker: h.ticker,
    name: `${h.ticker} ${h.name}`, value: h.marketValue,
    color: DONUT_COLORS_US[i % DONUT_COLORS_US.length],
  }));

  // 現金統計
  const cashTWD = useMemo(() => cashEntries.filter(c => c.currency === 'TWD').reduce((s, c) => s + c.amount, 0), [cashEntries]);
  const cashUSD = useMemo(() => cashEntries.filter(c => c.currency === 'USD').reduce((s, c) => s + c.amount, 0), [cashEntries]);
  const totalCashInTWD = cashTWD + cashUSD * EX_RATE;

  // 總資產（以 TWD 計算）
  const totalAssetTWD = twStats.totalValue + usStats.totalValue * EX_RATE + totalCashInTWD;
  const totalAssetDisplay = displayCurrency === 'TWD' ? totalAssetTWD : totalAssetTWD / EX_RATE;

  // --- 歷史水位：用真實資料產生今日快照點 ---
  const todayLabel = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit' });
  const chartData = useMemo(() => {
    const twValueTWD = twStats.totalValue;           // 台股市值（TWD）
    const usValueTWD = usStats.totalValue * EX_RATE; // 美股市值換算 TWD
    const cashValueTWD = cashTWD + cashUSD * EX_RATE;
    const totalTWD = twValueTWD + usValueTWD + cashValueTWD;

    const point = displayCurrency === 'TWD'
      ? { date: todayLabel, total: totalTWD }
      : { date: todayLabel, total: totalTWD / EX_RATE };

    return [point];
  }, [twStats.totalValue, usStats.totalValue, cashTWD, cashUSD, displayCurrency, todayLabel]);

  // --- 記錄交易 ---
  const logTransaction = async (txn: {
    type: 'buy' | 'sell'; ticker: string; name: string;
    category: AssetCategory; shares: number; price: number; currency: Currency;
  }) => {
    try {
      await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...txn, date: new Date().toISOString() }),
      });
    } catch (err) {
      console.error('記錄交易失敗:', err);
    }
  };

  // --- 處理表單提交：股票 ---
  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const newHolding: Holding = {
      ticker: tradeForm.ticker.toUpperCase(), name: tradeForm.name,
      category: tradeForm.category, shares: parseFloat(tradeForm.shares),
      avgCost: parseFloat(tradeForm.price), currentPrice: parseFloat(tradeForm.currentPrice),
      currency: tradeForm.category === 'us_stock' ? 'USD' : 'TWD',
    };
    try {
      const res = await fetch('/api/holdings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHolding),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || '寫入失敗'); }
      // 記錄買進交易
      await logTransaction({
        type: 'buy', ticker: newHolding.ticker, name: newHolding.name,
        category: newHolding.category, shares: newHolding.shares,
        price: newHolding.avgCost, currency: newHolding.currency,
      });
      setMessage({ type: 'success', text: `✅ 已新增 ${newHolding.ticker} ${newHolding.name}` });
      setTradeForm({ ticker: '', name: '', category: 'tw_stock', price: '', currentPrice: '', shares: '' });
      await fetchHoldings();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : '寫入失敗'}` });
    } finally {
      setSubmitting(false);
    }
  };

  // --- 處理表單提交：現金 ---
  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashSubmitting(true);
    setCashMessage(null);
    try {
      const res = await fetch('/api/cash', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: cashForm.bankName,
          amount: parseFloat(cashForm.amount),
          currency: cashForm.currency,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || '寫入失敗'); }
      setCashMessage({ type: 'success', text: `✅ 已新增 ${cashForm.bankName} ${cashForm.currency} ${cashForm.amount}` });
      setCashForm({ bankName: '', amount: '', currency: 'TWD' });
      await fetchCash();
    } catch (err) {
      setCashMessage({ type: 'error', text: `❌ ${err instanceof Error ? err.message : '寫入失敗'}` });
    } finally {
      setCashSubmitting(false);
    }
  };

  // --- 刪除現金 ---
  const handleDeleteCash = async (id: string) => {
    try {
      const res = await fetch(`/api/cash?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('刪除失敗');
      await fetchCash();
    } catch (err) {
      console.error('刪除現金失敗:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-xl shadow-lg">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">個人資產管理中控台</h1>
            <p className="text-slate-400 mt-1">
              目前總資產: {displayCurrency === 'TWD' ? 'NT$' : 'US$'}{' '}
              {totalAssetDisplay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHoldingsMgrOpen(true)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <LayoutList size={16} />
              持股管理
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <ClipboardList size={16} />
              交易紀錄
            </button>
            <button
              onClick={refreshPrices}
              disabled={priceRefreshing}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw size={16} className={priceRefreshing ? 'animate-spin' : ''} />
              更新股價
            </button>
            <button
              onClick={() => setDisplayCurrency(prev => prev === 'TWD' ? 'USD' : 'TWD')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <DollarSign size={20} />
              切換為 {displayCurrency === 'TWD' ? '美金 (USD)' : '台幣 (TWD)'}計價
            </button>
          </div>
        </div>

        {/* 價格更新狀態 */}
        {priceStatus && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
            priceStatus.type === 'success' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' :
            priceStatus.type === 'error' ? 'bg-red-900/50 text-red-300 border border-red-700' :
            'bg-blue-900/50 text-blue-300 border border-blue-700'
          }`}>
            {priceRefreshing && <Loader2 size={14} className="inline animate-spin mr-2" />}
            {priceStatus.text}
          </div>
        )}

        {/* 資產歷史水位表 */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-6">資產歷史水位表 ({displayCurrency})</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '總資產']}
                />
                <Area type="monotone" dataKey="total" stroke="#10b981" fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-emerald-400" />
            <span className="ml-3 text-slate-400">載入資料中...</span>
          </div>
        ) : (
          <>
            {/* 台股 & 美股 Donut Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StockDonutChart
                title="台股"
                originalCurrency="TWD"
                displayCurrency={displayCurrency}
                exRate={EX_RATE}
                holdings={twPieData}
                totalValue={twStats.totalValue} totalCost={twStats.totalCost}
                totalProfit={twStats.totalProfit} profitPercent={twStats.profitPercent}
              />
              <StockDonutChart
                title="美股"
                originalCurrency="USD"
                displayCurrency={displayCurrency}
                exRate={EX_RATE}
                holdings={usPieData}
                totalValue={usStats.totalValue} totalCost={usStats.totalCost}
                totalProfit={usStats.totalProfit} profitPercent={usStats.profitPercent}
              />
            </div>

            {/* 現金總覽 */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Wallet size={22} className="text-amber-400" />
                現金部位
              </h2>

              {cashEntries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {cashEntries.map((entry) => (
                    <div key={entry.id} className="bg-slate-700/50 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="text-sm text-slate-400">{entry.bankName}</p>
                        <p className="text-lg font-bold text-white tabular-nums">
                          {entry.currency === 'TWD' ? 'NT$' : 'US$'}{' '}
                          {entry.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteCash(entry.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="刪除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 mb-6">尚無現金紀錄</p>
              )}

              {/* 現金合計 */}
              <div className="border-t border-slate-700 pt-4 mb-6 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">台幣現金合計</p>
                  <p className="text-lg font-bold text-white tabular-nums">NT$ {cashTWD.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">美金現金合計</p>
                  <p className="text-lg font-bold text-white tabular-nums">US$ {cashUSD.toLocaleString()}</p>
                </div>
              </div>

              {/* 新增現金表單 */}
              {cashMessage && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  cashMessage.type === 'success'
                    ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                    : 'bg-red-900/50 text-red-300 border border-red-700'
                }`}>
                  {cashMessage.text}
                </div>
              )}

              <form onSubmit={handleAddCash} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <input
                  type="text" placeholder="銀行名稱" required value={cashForm.bankName}
                  className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-amber-500 focus:outline-none"
                  onChange={e => setCashForm({ ...cashForm, bankName: e.target.value })}
                />
                <input
                  type="number" step="0.01" placeholder="金額" required value={cashForm.amount}
                  className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-amber-500 focus:outline-none"
                  onChange={e => setCashForm({ ...cashForm, amount: e.target.value })}
                />
                <select
                  value={cashForm.currency}
                  className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-amber-500 focus:outline-none"
                  onChange={e => setCashForm({ ...cashForm, currency: e.target.value as Currency })}
                >
                  <option value="TWD">TWD 台幣</option>
                  <option value="USD">USD 美金</option>
                </select>
                <button
                  type="submit" disabled={cashSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {cashSubmitting ? <><Loader2 size={18} className="animate-spin" />儲存中...</> : '新增現金'}
                </button>
              </form>
            </div>
          </>
        )}

        {/* 交易輸入區塊 */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <PlusCircle size={24} className="text-emerald-400" />
            新增股票交易
          </h2>

          {message && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAddTrade} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <select
              value={tradeForm.category}
              className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-emerald-500 focus:outline-none"
              onChange={e => setTradeForm({ ...tradeForm, category: e.target.value as AssetCategory })}
            >
              <option value="tw_stock">台股</option>
              <option value="us_stock">美股</option>
            </select>
            <input type="text"
              placeholder={tradeForm.category === 'us_stock' ? '代號 (e.g. AAPL)' : '代號 (如: 2330)'}
              required value={tradeForm.ticker}
              className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-emerald-500 focus:outline-none"
              onChange={e => setTradeForm({ ...tradeForm, ticker: e.target.value })} />
            <input type="text"
              placeholder={tradeForm.category === 'us_stock' ? '名稱 (e.g. Apple)' : '名稱 (如: 台積電)'}
              required value={tradeForm.name}
              className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-emerald-500 focus:outline-none"
              onChange={e => setTradeForm({ ...tradeForm, name: e.target.value })} />
            <input type="number" step="0.01" placeholder="成本價" required value={tradeForm.price}
              className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-emerald-500 focus:outline-none"
              onChange={e => setTradeForm({ ...tradeForm, price: e.target.value })} />
            <input type="number" step="0.01" placeholder="現價" required value={tradeForm.currentPrice}
              className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-emerald-500 focus:outline-none"
              onChange={e => setTradeForm({ ...tradeForm, currentPrice: e.target.value })} />
            <input type="number" step="0.01" placeholder="股數" required value={tradeForm.shares}
              className="bg-slate-700 rounded-lg p-3 text-white border border-slate-600 focus:border-emerald-500 focus:outline-none"
              onChange={e => setTradeForm({ ...tradeForm, shares: e.target.value })} />
            <button type="submit" disabled={submitting}
              className="md:col-span-3 lg:col-span-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" />儲存中...</> : '寫入紀錄'}
            </button>
          </form>
        </div>

      </div>

      {/* 交易紀錄面板 */}
      <TransactionHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} displayCurrency={displayCurrency} />

      {/* 持股管理面板 */}
      <HoldingsManager
        isOpen={holdingsMgrOpen}
        onClose={() => setHoldingsMgrOpen(false)}
        displayCurrency={displayCurrency}
        onRefresh={fetchHoldings}
      />
    </div>
  );
}