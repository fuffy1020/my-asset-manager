"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Trash2 } from 'lucide-react';

interface HoldingData {
  ticker: string;
  name: string;
  value: number;
  color: string;
}

interface StockDonutChartProps {
  title: string;
  currencyLabel: string;
  holdings: HoldingData[];
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  profitPercent: number;
  onDelete?: (ticker: string) => void;
}

export default function StockDonutChart({
  title,
  currencyLabel,
  holdings,
  totalValue,
  totalCost,
  totalProfit,
  profitPercent,
  onDelete,
}: StockDonutChartProps) {
  const totalForPercent = holdings.reduce((sum, h) => sum + h.value, 0);

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
            <span className="text-xs text-slate-400 font-medium">{currencyLabel}</span>
            <span className="text-xl font-bold text-white leading-tight">
              {totalValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
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

        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          {holdings.map((h, i) => {
            const pct = totalForPercent > 0 ? ((h.value / totalForPercent) * 100).toFixed(1) : '0.0';
            return (
              <div key={i} className="flex items-center gap-3 group">
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: h.color }}
                />
                <span className="text-sm text-slate-200 font-medium tabular-nums">
                  {pct}%
                </span>
                <span className="text-sm text-slate-300 truncate flex-1">{h.name}</span>
                {onDelete && (
                  <button
                    onClick={() => onDelete(h.ticker)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-0.5"
                    title={`賣出 ${h.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: Cost & Profit */}
      <div className="border-t border-slate-700 grid grid-cols-2 divide-x divide-slate-700">
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">總成本</p>
          <p className="text-lg font-bold text-white tabular-nums">
            {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">帳面獲利</p>
          <p
            className={`text-lg font-bold tabular-nums ${
              totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {totalProfit >= 0 ? '+' : ''}
            {totalProfit.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
