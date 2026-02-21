import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Transaction } from '@/app/lib/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'transactions.json');

async function readTransactions(): Promise<Transaction[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Transaction[];
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
    return [];
  }
}

async function writeTransactions(txns: Transaction[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(txns, null, 2), 'utf-8');
}

// GET — 取得所有交易紀錄（最新的排在前面）
export async function GET() {
  const txns = await readTransactions();
  txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return NextResponse.json(txns);
}

// POST — 新增交易紀錄
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Omit<Transaction, 'id'>;

    if (!body.type || !body.ticker || !body.name || !body.shares || !body.price || !body.currency) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const txns = await readTransactions();
    const newTxn: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: body.type,
      ticker: body.ticker,
      name: body.name,
      category: body.category,
      shares: body.shares,
      price: body.price,
      currency: body.currency,
      date: body.date || new Date().toISOString(),
      note: body.note,
    };

    txns.push(newTxn);
    await writeTransactions(txns);
    return NextResponse.json({ success: true, data: newTxn });
  } catch {
    return NextResponse.json({ error: '寫入失敗' }, { status: 500 });
  }
}
