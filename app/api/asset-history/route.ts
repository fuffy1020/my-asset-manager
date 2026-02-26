import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { AssetSnapshot } from '@/app/lib/types';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'asset_history.json');

async function readHistory(): Promise<AssetSnapshot[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as AssetSnapshot[];
  } catch {
    return [];
  }
}

async function writeHistory(data: AssetSnapshot[]): Promise<void> {
  await fs.writeFile(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET — 取得所有歷史快照（按日期排序）
export async function GET() {
  const history = await readHistory();
  history.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json(history);
}

// POST — 寫入今日快照（同日覆蓋）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AssetSnapshot;

    if (!body.date || body.totalTWD === undefined) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    const history = await readHistory();

    // 同日覆蓋
    const existingIndex = history.findIndex(s => s.date === body.date);
    if (existingIndex >= 0) {
      history[existingIndex] = body;
    } else {
      history.push(body);
    }

    // 依日期排序後寫入
    history.sort((a, b) => a.date.localeCompare(b.date));
    await writeHistory(history);

    return NextResponse.json({ success: true, snapshot: body });
  } catch {
    return NextResponse.json({ error: '寫入失敗' }, { status: 500 });
  }
}
