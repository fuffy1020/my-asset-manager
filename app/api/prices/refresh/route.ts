import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Holding, PriceMeta } from '@/app/lib/types';

const HOLDINGS_FILE = path.join(process.cwd(), 'data', 'holdings.json');
const META_FILE = path.join(process.cwd(), 'data', 'price_meta.json');
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 小時

async function readMeta(): Promise<PriceMeta> {
  try {
    const raw = await fs.readFile(META_FILE, 'utf-8');
    return JSON.parse(raw) as PriceMeta;
  } catch {
    return { lastFetchedAt: null };
  }
}

async function writeMeta(meta: PriceMeta): Promise<void> {
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

async function readHoldings(): Promise<Holding[]> {
  try {
    const raw = await fs.readFile(HOLDINGS_FILE, 'utf-8');
    return JSON.parse(raw) as Holding[];
  } catch {
    return [];
  }
}

async function writeHoldings(holdings: Holding[]): Promise<void> {
  await fs.writeFile(HOLDINGS_FILE, JSON.stringify(holdings, null, 2), 'utf-8');
}

// 將 ticker 轉為 Yahoo Finance 格式
function toYahooSymbol(ticker: string, category: string): string {
  if (category === 'tw_stock') {
    return `${ticker}.TW`;
  }
  return ticker;
}

export async function GET() {
  try {
    const meta = await readMeta();

    // 檢查 cooldown
    if (meta.lastFetchedAt) {
      const lastFetched = new Date(meta.lastFetchedAt).getTime();
      const now = Date.now();
      if (now - lastFetched < COOLDOWN_MS) {
        const hoursAgo = Math.round((now - lastFetched) / (60 * 60 * 1000) * 10) / 10;
        return NextResponse.json({
          skipped: true,
          lastFetchedAt: meta.lastFetchedAt,
          message: `距離上次更新僅 ${hoursAgo} 小時，未滿 24 小時，跳過更新`,
        });
      }
    }

    // yahoo-finance2 v3: 需要 class 實例化
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance();

    const holdings = await readHoldings();
    if (holdings.length === 0) {
      return NextResponse.json({ skipped: true, message: '沒有持股資料' });
    }

    const updated: { ticker: string; oldPrice: number; newPrice: number }[] = [];
    const errors: { ticker: string; error: string }[] = [];

    // 逐一抓取價格
    for (const holding of holdings) {
      const symbol = toYahooSymbol(holding.ticker, holding.category);
      try {
        const quote = await yf.quote(symbol);
        const price = (quote as Record<string, unknown>)?.regularMarketPrice;
        if (price && typeof price === 'number') {
          const oldPrice = holding.currentPrice;
          holding.currentPrice = price;
          updated.push({ ticker: holding.ticker, oldPrice, newPrice: price });
        } else {
          errors.push({ ticker: holding.ticker, error: '無法取得價格資料' });
        }
      } catch (err) {
        errors.push({
          ticker: holding.ticker,
          error: err instanceof Error ? err.message : '未知錯誤',
        });
      }
    }

    // 寫回更新後的持股
    if (updated.length > 0) {
      await writeHoldings(holdings);
    }

    // 只有在至少一檔成功時才更新 lastFetchedAt
    const now = new Date().toISOString();
    if (updated.length > 0) {
      await writeMeta({ lastFetchedAt: now });
    }

    return NextResponse.json({
      skipped: false,
      lastFetchedAt: updated.length > 0 ? now : meta.lastFetchedAt,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: `已更新 ${updated.length} 檔股票價格${errors.length > 0 ? ` (${errors.length} 檔失敗)` : ''}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `價格更新失敗: ${err instanceof Error ? err.message : '未知錯誤'}` },
      { status: 500 }
    );
  }
}
