import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { PriceMeta } from '@/app/lib/types';

const META_FILE = path.join(process.cwd(), 'data', 'price_meta.json');

// 只讀取上次更新時間，不做任何爬蟲
export async function GET() {
  try {
    const raw = await fs.readFile(META_FILE, 'utf-8');
    const meta = JSON.parse(raw) as PriceMeta;
    return NextResponse.json(meta);
  } catch {
    return NextResponse.json({ lastFetchedAt: null });
  }
}
