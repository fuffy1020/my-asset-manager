import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { CashEntry } from '@/app/lib/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'cash.json');

async function readCash(): Promise<CashEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as CashEntry[];
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
    return [];
  }
}

async function writeCash(entries: CashEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

// GET — 取得所有現金紀錄
export async function GET() {
  const entries = await readCash();
  return NextResponse.json(entries);
}

// POST — 新增現金紀錄
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<CashEntry, 'id'>;

    if (!body.bankName || body.amount === undefined || !body.currency) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const entries = await readCash();
    const newEntry: CashEntry = {
      id: `cash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bankName: body.bankName,
      amount: body.amount,
      currency: body.currency,
    };

    entries.push(newEntry);
    await writeCash(entries);
    return NextResponse.json({ success: true, data: entries });
  } catch {
    return NextResponse.json({ error: '寫入失敗' }, { status: 500 });
  }
}

// PUT — 更新現金金額
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as { id: string; amount?: number; bankName?: string };

    if (!body.id) {
      return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    }

    const entries = await readCash();
    const index = entries.findIndex(e => e.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: '找不到該筆現金紀錄' }, { status: 404 });
    }

    if (body.amount !== undefined) entries[index].amount = body.amount;
    if (body.bankName) entries[index].bankName = body.bankName;

    await writeCash(entries);
    return NextResponse.json({ success: true, data: entries });
  } catch {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

// DELETE — 刪除現金紀錄
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id 參數' }, { status: 400 });
    }

    const entries = await readCash();
    const filtered = entries.filter(e => e.id !== id);

    if (filtered.length === entries.length) {
      return NextResponse.json({ error: '找不到該筆現金紀錄' }, { status: 404 });
    }

    await writeCash(filtered);
    return NextResponse.json({ success: true, data: filtered });
  } catch {
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
