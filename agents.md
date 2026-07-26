# online-word-cloud（專案藍圖）

> 本檔為跨 Agent 通用的專案藍圖（AGENTS.md 開放標準）。任何 Agent 的每個 session 都應先讀本檔＋`handoff.md`。

## 專案簡介
提供即時協作的線上文字雲服務（Cloudify），使用者輸入段落或字詞後自動解析詞頻，並透過 Firebase Firestore 即時同步渲染在畫布上。

## 關鍵時程
- 2026-06-07：專案初始化與 GitHub Actions / GitHub Pages 上線部署
- 2026-07-26：安全性強化；因原始碼曾含明文管理密碼，捨棄 23 個 commit 的歷史重建 repo
- 2026-07-26：UI 與功能細節優化；新增 localhost 離線示範模式，解決本機連不到 Firebase 的開發困境

## 目標與路線圖
- [x] 階段一：建立線上文字雲核心 HTML/CSS/JS 功能與視覺美化
- [x] 階段二：串接 Firebase Firestore 即時同步與權限安全規則
- [x] 階段三：新增刪除單一字詞、不雅字詞敏感詞過濾功能
- [x] 階段四：安全性強化——雜湊式管理授權、規則欄位與數值界線、App Check、git 歷史重建
- [ ] 階段五：觀察 App Check 指標，確認多數請求已驗證後開啟 Firestore 強制執行
- [ ] 階段六：實測「一鍵刪除全部」完整流程（會真的清空資料，需挑時機）
- [x] 階段七：UI 與功能細節優化——固定配色、toast／確認框、排行榜全列、無障礙、桌機版滿版佈局
- [x] 階段八：新增 localhost 離線示範模式，讓 UI 迭代不必每次推上線
- [ ] 階段九：把階段七、八的改動推上 GitHub Pages，實測正式 Firebase 路徑（送出／刪除／批次清空）
- [ ] 階段十：UI 持續優化（例如敏感詞清單管理、匯出文字雲圖片）

## 資料夾結構
- `app.js`：核心邏輯與 Firestore 即時監聽/過濾處理
- `index.html`：網頁 UI 結構與響應式配置
- `index.css`：美化與主題樣式設計
- `firestore.rules`：Firestore 資料庫存取與格式驗證規則
- `tools/set-admin-password.mjs`：產生管理密碼與 SHA-256 雜湊
- `.firebaserc` / `firebase.json`：Firebase 專案配置
- `.github/workflows/deploy.yml`：GitHub Actions 部署腳本
- `agents.md`：專案藍圖（本檔）
- `handoff.md`：交接檔（每次收工必更新）

## 同步層級（本專案初始化至第 3 層級）

| 層級 | 平台 | 位置 | 讀取時機 |
|------|------|------|---------|
| L1 | 本地（GDrive） | `agents.md`＋`handoff.md` | 每個 session |
| L2 | GitHub | changyiwu/online-word-cloud | 指定時 |
| L3 | Obsidian | online-word-cloud/專案工作流程.md | 有需要時 |

## 工作約定
- 任何 Agent、任何電腦：**開工先讀 `handoff.md`，收工必更新 `handoff.md`**
- 修改共用檔案前先讀最新內容，避免覆蓋其他 Agent 的變更
- 所有回應與文件使用繁體中文；涉及檔案操作時回報完整產出位置
- Windows 指令優先使用 PowerShell 語法
- 修改前先確認計畫，優先保留原有資料結構
- 不把每日流水帳寫進本檔

## 安全與隱私

- 不要 commit API key、token、密碼或 Firebase Admin 憑證
- 兩個「可以公開」的例外，其餘一律不進 repo：
  - Firebase Web API key（識別碼，非憑證；仍須限制來源網域，目前已設 referrer 限制）
  - reCAPTCHA v3 **site key**（公開金鑰）——對應的 **secret key** 只填在 Firebase Console
- 管理密碼一律以 SHA-256 雜湊存於 Firestore `config/admin`，明文不進原始碼也不進資料庫
- 不要 commit NotebookLM 個人匯出清單或筆記本 ID 清單
- 不要自動納入無關的 Git 變更
- 不要儲存學生真名；正式資料只使用班級代號與座號
