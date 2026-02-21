"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { X, Loader2, TrendingDown, Pencil, Check, XCircle } from 'lucide-react';
import type { Holding, Currency } from '../lib/types';

const EX_RATE = 31.5;

interface HoldingsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  displayCurrency: Currency;
  onRefresh: () => void; // 通知父組件重新載入持股
}

interface SellForm {
  shares: string;
  price: string;
}

interface EditForm {
  shares: string;
  avgCost: string;
}

export default function HoldingsManager({
  isOpen, onClose, displayCurrency, onRefresh,
}: HoldingsManagerProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTicker, setActionTicker] = useState<string | null>(null);
  const [mode, setMode] = useState<'sell' | 'edit' | null>(null);
  const [sellForm, setSellForm] = useState<SellForm>({ shares: '', price: '' });
  const [editForm, setEditForm] = useState<EditForm>({ shares: '', avgCost: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/holdings');
      setHoldings(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) fetch_(); }, [isOpen, fetch_]);

  // --- 開啟賣出 ---
  function openSell(h: Holding) {
    setActionTicker(h.ticker);
    setMode('sell');
    setSellForm({ shares: String(h.shares), price: String(h.currentPrice) });
    setMsg(null);
  }

  // --- 開啟編輯 ---
  function openEdit(h: Holding) {
    setActionTicker(h.ticker);
    setMode('edit');
    setEditForm({ shares: String(h.shares), avgCost: String(h.avgCost) });
    setMsg(null);
  }

  function cancel() { setActionTicker(null); setMode(null); }

  // --- 執行賣出 ---
  async function confirmSell(holding: Holding) {
    const sellShares = parseFloat(sellForm.shares);
    const sellPrice = parseFloat(sellForm.price);
    if (isNaN(sellShares) || sellShares <= 0 || isNaN(sellPrice) || sellPrice <= 0) {
      setMsg({ text: '請輸入有效的股數和價格', ok: false }); return;
    }
    if (sellShares > holding.shares) {
      setMsg({ text: `超過持有股數 (${holding.shares} 股)`, ok: false }); return;
    }
    setSaving(true);
    try {
      const remaining = holding.shares - sellShares;
      if (remaining === 0) {
        // 全部賣出 → DELETE
        await fetch(`/api/holdings?ticker=${holding.ticker}`, { method: 'DELETE' });
      } else {
        // 部分賣出 → PUT 更新股數
        await fetch('/api/holdings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: holding.ticker, shares: remaining }),
        });
      }
      // 記錄賣出交易
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sell', ticker: holding.ticker, name: holding.name,
          category: holding.category, shares: sellShares,
          price: sellPrice, currency: holding.currency,
          date: new Date().toISOString(),
        }),
      });
      const label = `${holding.ticker} ${holding.name}`;
      setMsg({ text: `✅ 已賣出 ${sellShares} 股 ${label}`, ok: true });
      cancel();
      await fetch_();
      onRefresh();
    } catch {
      setMsg({ text: '❌ 操作失敗', ok: false });
    } finally {
      setSaving(false);
    }
  }

  // --- 執行編輯 ---
  async function confirmEdit(holding: Holding) {
    const newShares = parseFloat(editForm.shares);
    const newCost = parseFloat(editForm.avgCost);
    if (isNaN(newShares) || newShares <= 0 || isNaN(newCost) || newCost <= 0) {
      setMsg({ text: '請輸入有效的數值', ok: false }); return;
    }
    setSaving(true);
    try {
      await fetch('/api/holdings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: holding.ticker, shares: newShares, avgCost: newCost }),
      });
      setMsg({ text: `✅ 已更新 ${holding.ticker} ${holding.name}`, ok: true });
      cancel();
      await fetch_();
      onRefresh();
    } catch {
      setMsg({ text: '❌ 更新失敗', ok: false });
    } finally {
      setSaving(false);
    }
  }

  const currSym = displayCurrency === 'TWD' ? 'NT$' : 'US$';

  function displayPrice(h: Holding, price: number) {
    if (h.currency === displayCurrency) return price;
    return h.currency === 'USD' ? price * EX_RATE : price / EX_RATE;
  }

  if (!isOpen) return null;

  const grouped: Record<string, Holding[]> = {
    '台股': holdings.filter(h => h.category === 'tw_stock'),
    '美股': holdings.filter(h => h.category === 'us_stock'),
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-slate-800 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">持股管理</h2>
            <p className="text-xs text-slate-500 mt-0.5">可部分賣出或調整持股資訊</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={22} /></button>
        </div>

        {/* Message */}
        {msg && (
          <div className={`mx-5 mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
            msg.ok ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                   : 'bg-red-900/50 text-red-300 border border-red-700'
          }`}>
            {msg.text}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-emerald-400" />
            </div>
          ) : (
            Object.entries(grouped).map(([label, list]) => list.length === 0 ? null : (
              <div key={label}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-slate-400">{label}</span>
                  <div className="flex-1 border-t border-slate-700" />
                </div>
                <div className="space-y-2">
                  {list.map(h => {
                    const isSelling = actionTicker === h.ticker && mode === 'sell';
                    const isEditing = actionTicker === h.ticker && mode === 'edit';
                    const mv = displayPrice(h, h.shares * h.currentPrice);
                    const cost = displayPrice(h, h.shares * h.avgCost);
                    const profit = mv - cost;

                    return (
                      <div key={h.ticker} className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                        {/* 主行 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white">{h.ticker}</span>
                            <span className="text-slate-400 text-sm ml-2">{h.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => isEditing ? cancel() : openEdit(h)}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                isEditing ? 'bg-slate-600 text-slate-300' : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                              }`}
                            >
                              <Pencil size={12} /> 編輯
                            </button>
                            <button
                              onClick={() => isSelling ? cancel() : openSell(h)}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                                isSelling ? 'bg-red-900/60 text-red-300' : 'bg-red-900/40 hover:bg-red-900/70 text-red-400'
                              }`}
                            >
                              <TrendingDown size={12} /> 賣出
                            </button>
                          </div>
                        </div>

                        {/* 持股數據 */}
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-slate-500">持股</p>
                            <p className="text-white font-semibold">{h.shares} 股</p>
                          </div>
                          <div>
                            <p className="text-slate-500">成本均價</p>
                            <p className="text-white font-semibold tabular-nums">{displayPrice(h, h.avgCost).toLocaleString(undefined, {maximumFractionDigits: 1})}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">現價</p>
                            <p className="text-white font-semibold tabular-nums">{displayPrice(h, h.currentPrice).toLocaleString(undefined, {maximumFractionDigits: 1})}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">損益 ({displayCurrency})</p>
                            <p className={`font-bold tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {profit >= 0 ? '+' : ''}{currSym} {Math.abs(profit).toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </p>
                          </div>
                        </div>

                        {/* 賣出表單 */}
                        {isSelling && (
                          <div className="border-t border-slate-600 pt-3 space-y-2">
                            <p className="text-xs text-red-400 font-semibold">賣出操作（最多 {h.shares} 股）</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">賣出股數</label>
                                <input type="number" min="0.001" max={h.shares} step="0.001"
                                  value={sellForm.shares}
                                  onChange={e => setSellForm(f => ({ ...f, shares: e.target.value }))}
                                  className="w-full bg-slate-600 rounded px-3 py-2 text-sm text-white border border-slate-500 focus:border-red-400 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">賣出價格 ({h.currency})</label>
                                <input type="number" min="0" step="0.01"
                                  value={sellForm.price}
                                  onChange={e => setSellForm(f => ({ ...f, price: e.target.value }))}
                                  className="w-full bg-slate-600 rounded px-3 py-2 text-sm text-white border border-slate-500 focus:border-red-400 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={cancel} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md">
                                <XCircle size={12} /> 取消
                              </button>
                              <button onClick={() => confirmSell(h)} disabled={saving}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md font-semibold">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                確認賣出
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 編輯表單 */}
                        {isEditing && (
                          <div className="border-t border-slate-600 pt-3 space-y-2">
                            <p className="text-xs text-blue-400 font-semibold">編輯持股資訊</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">持股股數</label>
                                <input type="number" min="0.001" step="0.001"
                                  value={editForm.shares}
                                  onChange={e => setEditForm(f => ({ ...f, shares: e.target.value }))}
                                  className="w-full bg-slate-600 rounded px-3 py-2 text-sm text-white border border-slate-500 focus:border-blue-400 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 block mb-1">平均成本 ({h.currency})</label>
                                <input type="number" min="0" step="0.01"
                                  value={editForm.avgCost}
                                  onChange={e => setEditForm(f => ({ ...f, avgCost: e.target.value }))}
                                  className="w-full bg-slate-600 rounded px-3 py-2 text-sm text-white border border-slate-500 focus:border-blue-400 focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={cancel} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md">
                                <XCircle size={12} /> 取消
                              </button>
                              <button onClick={() => confirmEdit(h)} disabled={saving}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md font-semibold">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                儲存
                              </button>
                            </div>
                          </div>
                        )}
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
