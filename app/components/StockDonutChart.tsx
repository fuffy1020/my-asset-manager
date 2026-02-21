"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface HoldingData {
  ticker: string;
  name: string;
  value: number;        // 原始幣別的市價
  color: string;
}

interface StockDonutChartProps {
  title: string;
  originalCurrency: 'TWD' | 'USD'; // 資料原始幣別
  displayCurrency: 'TWD' | 'USD';  // 目前顯示幣別
  exRate: number;                   // 1 USD = exRate TWD
  holdings: HoldingData[];
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  profitPercent: number;
}

export default function StockDonutChart({
  title,
  originalCurrency,
  displayCurrency,
  exRate,
  holdings,
  totalValue,
  totalCost,
  totalProfit,
  profitPercent,
}: StockDonutChartProps) {
  const totalForPercent = holdings.reduce((sum, h) => sum + h.value, 0);

  // 如果顯示幣別與原始幣別不同，進行換算
  const factor =
    originalCurrency === displayCurrency ? 1 :
    originalCurrency === 'USD' && displayCurrency === 'TWD' ? exRate :
    1 / exRate;

  const displayValue = totalValue * factor;
  const displayCost  = totalCost  * factor;
  const displayProfit = totalProfit * factor;
  const currencySymbol = displayCurrency === 'TWD' ? 'NT$' : 'US$';

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-2">
        <h2 className="text-lg font-semibold text-slate-200 tracking-wide">
          庫存現值比例
          <span className="text-slate-500 mx-2">|</span>
          <span className="text-emerald-400 font-bold">{title}</span>
        </h2>
      </div>

      {/* Chart + Legend */}
      <div className="flex items-center px-6 py-4 gap-4">
        {/* Donut Chart */}
        <div className="relative" style={{ width: 180, height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={holdings}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {holdings.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-slate-400 font-medium">{displayCurrency}</span>
            <span className="text-xl font-bold text-white leading-tight">
              {displayValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
            </span>
            <span
              className={`text-sm font-semibold ${
                profitPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              ({profitPercent >= 0 ? '+' : ''}
              {profitPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Legend — sorted by % desc, aligned with grid */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {[...holdings]
            .sort((a, b) => b.value - a.value)
            .map((h, i) => {
              const pct = totalForPercent > 0 ? ((h.value / totalForPercent) * 100).toFixed(1) : '0.0';
              return (
                <div key={i} className="grid items-center gap-x-2 group"
                  style={{ gridTemplateColumns: '12px 44px 1fr auto' }}>
                  {/* dot */}
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: h.color }}
                  />
                  {/* pct — right-aligned in fixed column */}
                  <span className="text-sm text-slate-200 font-medium tabular-nums text-right">
                    {pct}%
                  </span>
                  {/* name */}
                  <span className="text-sm text-slate-300 truncate">{h.name}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Footer: Cost & Profit */}
      <div className="border-t border-slate-700 grid grid-cols-2 divide-x divide-slate-700">
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">總成本 ({displayCurrency})</p>
          <p className="text-lg font-bold text-white tabular-nums">
            {currencySymbol} {displayCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">帳面獲利 ({displayCurrency})</p>
          <p
            className={`text-lg font-bold tabular-nums ${
              displayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {displayProfit >= 0 ? '+' : ''}
            {currencySymbol} {Math.abs(displayProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </div>
  );
}
