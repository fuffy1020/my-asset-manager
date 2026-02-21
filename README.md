# 個人資產管理中控台

本地部署的個人資產管理工具，使用 Next.js 開發。可追蹤台股/美股持倉、銀行現金，並自動從 Yahoo Finance 抓取最新收盤價（24 小時 cooldown）。

## 功能特色

- 📊 **雙 Donut Chart** — 台股/美股持倉比例、報酬率即時顯示
- 💰 **現金管理** — 多帳戶、多幣別現金，自動換算計入總資產
- 📈 **自動更新股價** — 開啟時自動爬取 Yahoo Finance，24 小時內只爬一次
- 🗃️ **本地 JSON 儲存** — 所有資料存在 `data/` 目錄，可讀可改可備份
- 📋 **交易紀錄** — 每次買進/賣出自動記錄，可在 slide-in 面板查閱
- 🗑️ **賣出標的** — Donut Chart legend hover 出現刪除鈕，confirm 後移除

## 移植到新裝置

```bash
git clone https://github.com/your-username/my-asset-manager.git
cd my-asset-manager
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可。

> `data/holdings.json`、`data/cash.json`、`data/transactions.json` 都會一起 clone 下來，資料完整。

## 資料結構

```
data/
├── holdings.json      ← 股票持倉（台股/美股）
├── cash.json          ← 銀行現金
├── transactions.json  ← 交易歷史紀錄
└── price_meta.json    ← 上次更新股價時間（24h cooldown 用）
```

## 技術棧

| 層   | 技術                            |
| ---- | ------------------------------- |
| 框架 | Next.js 16 (App Router)         |
| UI   | React + Tailwind CSS + Recharts |
| 儲存 | 本地 JSON 檔案 (`fs/promises`)  |
| 股價 | `yahoo-finance2` v3             |

## 開發指令

```bash
npm run dev   # 開發模式（http://localhost:3000）
npm run build # 建置
npm run lint  # Lint 檢查
```
