import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Holding, PriceMeta } from '@/app/lib/types';

const HOLDINGS_FILE = path.join(process.cwd(), 'data', 'holdings.json');
const META_FILE = path.join(process.cwd(), 'data', 'price_meta.json');

// TWSE（上市）& TPEX（上櫃）API
const TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';

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

// 抓台股收盤價：先查 TWSE（上市），查不到再查 TPEX（上櫃）
async function fetchTwPriceMap(): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  // TWSE 上市
  try {
    const res = await fetch(TWSE_URL, { cache: 'no-store' });
    const data = await res.json() as Array<{ Code: string; ClosingPrice: string }>;
    for (const row of data) {
      const price = parseFloat(row.ClosingPrice.replace(/,/g, ''));
      if (!isNaN(price)) priceMap.set(row.Code, price);
    }
  } catch (e) {
    console.error('TWSE fetch error:', e);
  }

  // TPEX 上櫃（補充 TWSE 沒有的）
  try {
    const res = await fetch(TPEX_URL, { cache: 'no-store' });
    const data = await res.json() as Array<{ SecuritiesCompanyCode: string; Close: string }>;
    for (const row of data) {
      if (!priceMap.has(row.SecuritiesCompanyCode)) {
        const price = parseFloat(row.Close.replace(/,/g, ''));
        if (!isNaN(price)) priceMap.set(row.SecuritiesCompanyCode, price);
      }
    }
  } catch (e) {
    console.error('TPEX fetch error:', e);
  }

  return priceMap;
}

export async function GET() {
  try {
    const holdings = await readHoldings();
    if (holdings.length === 0) {
      return NextResponse.json({ skipped: true, message: '沒有持股資料' });
    }

    const twHoldings = holdings.filter(h => h.category === 'tw_stock');
    const usHoldings = holdings.filter(h => h.category === 'us_stock');

    const updated: { ticker: string; oldPrice: number; newPrice: number }[] = [];
    const errors: { ticker: string; error: string }[] = [];

    // ---- 台股：一次抓 TWSE + TPEX 全量，再 lookup ----
    if (twHoldings.length > 0) {
      const twPriceMap = await fetchTwPriceMap();
      for (const holding of twHoldings) {
        const price = twPriceMap.get(holding.ticker);
        if (price !== undefined) {
          const oldPrice = holding.currentPrice;
          holding.currentPrice = price;
          updated.push({ ticker: holding.ticker, oldPrice, newPrice: price });
        } else {
          errors.push({ ticker: holding.ticker, error: '查無收盤價（可能是興櫃或未上市）' });
        }
      }
    }

    // ---- 美股：Yahoo Finance ----
    if (usHoldings.length > 0) {
      const YahooFinance = (await import('yahoo-finance2')).default;
      const yf = new YahooFinance();

      for (const holding of usHoldings) {
        try {
          const quote = await yf.quote(holding.ticker);
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
    }

    // 寫回更新後的持股
    if (updated.length > 0) {
      await writeHoldings(holdings);
    }

    const now = new Date().toISOString();
    if (updated.length > 0) {
      await writeMeta({ lastFetchedAt: now });
    }

    return NextResponse.json({
      skipped: false,
      lastFetchedAt: updated.length > 0 ? now : null,
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
