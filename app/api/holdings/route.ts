import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Holding } from '@/app/lib/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'holdings.json');

async function readHoldings(): Promise<Holding[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Holding[];
  } catch {
    // 如果檔案不存在，回傳空陣列並建立檔案
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
    return [];
  }
}

async function writeHoldings(holdings: Holding[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(holdings, null, 2), 'utf-8');
}

// GET — 取得所有持股
export async function GET() {
  const holdings = await readHoldings();
  return NextResponse.json(holdings);
}

// POST — 新增持股（如果同 ticker 已存在，合併計算平均成本）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Holding;

    // 基本驗證
    if (!body.ticker || !body.name || !body.category || !body.shares || !body.avgCost || !body.currentPrice) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const holdings = await readHoldings();
    const existingIndex = holdings.findIndex(
      h => h.ticker === body.ticker && h.category === body.category
    );

    if (existingIndex >= 0) {
      // 同一標的：合併股數，重新計算加權平均成本
      const existing = holdings[existingIndex];
      const totalShares = existing.shares + body.shares;
      const weightedCost =
        (existing.shares * existing.avgCost + body.shares * body.avgCost) / totalShares;
      holdings[existingIndex] = {
        ...existing,
        shares: totalShares,
        avgCost: Math.round(weightedCost * 100) / 100,
        currentPrice: body.currentPrice, // 以新輸入的現價更新
      };
    } else {
      holdings.push(body);
    }

    await writeHoldings(holdings);
    return NextResponse.json({ success: true, data: holdings });
  } catch {
    return NextResponse.json({ error: '寫入失敗' }, { status: 500 });
  }
}

// PUT — 更新指定 ticker 的現價或其他欄位
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Holding> & { ticker: string };

    if (!body.ticker) {
      return NextResponse.json({ error: '缺少 ticker' }, { status: 400 });
    }

    const holdings = await readHoldings();
    const index = holdings.findIndex(h => h.ticker === body.ticker);

    if (index === -1) {
      return NextResponse.json({ error: `找不到 ${body.ticker}` }, { status: 404 });
    }

    // 只更新有傳入的欄位
    holdings[index] = { ...holdings[index], ...body };
    await writeHoldings(holdings);
    return NextResponse.json({ success: true, data: holdings });
  } catch {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

// DELETE — 刪除指定 ticker 的持股
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ error: '缺少 ticker 參數' }, { status: 400 });
    }

    const holdings = await readHoldings();
    const filtered = holdings.filter(h => h.ticker !== ticker);

    if (filtered.length === holdings.length) {
      return NextResponse.json({ error: `找不到 ${ticker}` }, { status: 404 });
    }

    await writeHoldings(filtered);
    return NextResponse.json({ success: true, data: filtered });
  } catch {
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
