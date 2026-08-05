# online-word-cloud（專案藍圖）

> 本檔為跨 Agent 通用的專案藍圖（AGENTS.md 開放標準）。任何 Agent 的每個 session 都應先讀本檔＋`handoff.md`。

## 專案簡介
提供即時協作的線上文字雲服務（Cloudify），使用者輸入段落或字詞後自動解析詞頻，並透過 Firebase Firestore 即時同步渲染在畫布上。

## 關鍵時程
- 2026-06-07：專案初始化與 GitHub Actions / GitHub Pages 上線部署
- 2026-07-26：安全性強化；因原始碼曾含明文管理密碼，捨棄 23 個 commit 的歷史重建 repo
- 2026-07-26：UI 與功能細節優化；新增 localhost 離線示範模式，解決本機連不到 Firebase 的開發困境
- 2026-08-05：`firestore.rules` 新增 `/decks/` 區塊，把 Firebase 專案分享給 `html-slide-builder` 的簡報互動元件使用
- 2026-08-05：Cloud Firestore 開啟 App Check 強制執行；Metrics 顯示 92% verified（38 筆中 3 筆 invalid 為自動化瀏覽器所致）

## 目標與路線圖
- [x] 階段一：建立線上文字雲核心 HTML/CSS/JS 功能與視覺美化
- [x] 階段二：串接 Firebase Firestore 即時同步與權限安全規則
- [x] 階段三：新增刪除單一字詞、不雅字詞敏感詞過濾功能
- [x] 階段四：安全性強化——雜湊式管理授權、規則欄位與數值界線、App Check、git 歷史重建
- [x] 階段五：觀察 App Check 指標，確認多數請求已驗證後開啟 Firestore 強制執行
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

## 三個檔案的職責（依「時效性」分家，不是依「詳細程度」）

| 檔案 | 時效 | 寫入方式 | 放什麼 |
|------|------|---------|--------|
| `handoff.md` | **只對下一個 session 有效**，過期即丟 | 每次收工整份重寫 | 做到哪、下一步、**這次**的暫時 workaround |
| `agents.md`（本檔） | **長期有效**，每個 session 都適用 | 只有規則本身變了才改 | 目標、路線圖、常設規則、結構 |
| Obsidian／`git log` | **歷史**：發生過什麼、為什麼 | 只增不刪 | 決策紀錄、踩坑完整版、逐次進度 |

驗收標準：**`handoff.md` 整份刪掉，不應損失任何長期資訊**——會的話代表該升級進本檔卻沒升級。

**本檔不要出現的東西**：❌ `## 最近進度`／逐次工作紀錄、❌ 決策理由與踩坑完整版。歷史寫 L3 筆記的〈🗓️ 最近更動紀錄〉〈🧠 決策紀錄〉〈🕳️ 踩坑筆記〉；踩過的坑只把**結論**收斂成一條祈使句寫進〈工作約定〉，原因留 L3。

## 專案專屬規則

- **離線示範模式的判斷依據是 `app.js` 的 `DEMO_HOSTS`**（`localhost`／`127.0.0.1`／`file://`）；正式網域不在清單內，線上行為不受影響。此模式下管理密碼固定為 `demo`。要在本機測真實 Firebase，得先解除 API key 的 referrer 限制，再把 host 從 `DEMO_HOSTS` 拿掉
- **本機 `python -m http.server` 沒送 Cache-Control**，瀏覽器會拿舊的 `app.js`／`index.css`。改完沒反應時先用 `fetch(url, {cache:'reload'})` 或硬重新整理，**別誤判成程式沒生效**
- **桌機版（≥901px）用 `height: 100vh` 把佈局框在視窗內**，排行榜靠自己的捲軸。改左欄內容（例如加高 textarea）會直接壓縮排行榜可視高度，動之前先確認 `.stat-container` 沒被壓到 0。視窗矮於 800px 時整頁小幅捲動，是刻意的降級
- **App Check 的 Enforce 已於 Cloud Firestore 開啟**：任何前端要讀寫這個 Firebase 專案，都必須先 `initializeAppCheck()` 換到 token，**而且要在 `getFirestore()`／`getAuth()` 之前**，否則最早幾個請求不帶 token 會被擋。症狀是全部 `PERMISSION_DENIED`，很容易誤判成安全規則的問題——判斷方式是規則在 Playground 測起來 allow、實際請求卻回 403。site key 與網域見 `app.js` 的 `RECAPTCHA_SITE_KEY`／`APP_CHECK_HOSTS`
- **不要用瀏覽器工具驗證正式站，會誤判成故障。**Browser pane／Playwright 等自動化瀏覽器的 reCAPTCHA v3 分數極低，App Check 換 token 會被回 **403**，接著 Firestore 一律 `permission-denied`、畫面卡在「連線驗證中…」。**那是 Enforce 正常運作，不是線上壞掉**——它擋的就是這種 client。判斷正式站健康與否**只看 Firebase Console → App Check → Metrics**：verified 占絕大多數即正常（少數 invalid 通常就是自己剛才那幾次自動化載入）。真要用自動化瀏覽器驗證，得先在 Console 註冊 debug token，那等於發永久通行證，僅限開發環境
- **管理密碼的暴力破解問題沒有根治**：安全規則沒有速率限制，任何人都能匿名登入後反覆嘗試刪除來猜密碼。根治要把權限判定移到 Cloud Functions（需 Blaze 方案）。現行做法只是提高成本，不是消除弱點——**這是已知且接受的風險**
- **換網域時要同步更新四處**：`app.js` 的 `APP_CHECK_HOSTS`、reCAPTCHA 主控台網域清單、Firebase Console 的 App Check 設定、Firebase API key 的 referrer 限制。漏改會**靜默失敗**（未 Enforce 時完全無感）
- GitHub Pages 設定為 `build_type: workflow`（與 `deploy.yml` 一致）；`.claude/launch.json` 是本機預覽設定（`python -m http.server 5173`），目前在版控內，不需要可 `git rm --cached`
- **⚠️ `firestore.rules` 裡的 `/decks/{slug}/...` 兩個 match 區塊不是孤兒規則，不要刪。**它們是 `html-slide-builder` 專案（`我的雲端硬碟/agents/html-slide-builder`）的簡報互動元件在用的——本專案與它共用同一個 Firebase 專案 `word-cloud-c0bfe`，各走各的路徑，`/decks/` 與 `/words/` 完全隔離。刪掉會讓所有簡報的文字雲與投票**靜默失效**（寫入被 Firestore 預設拒絕）。同理，改動 `/decks/` 的欄位或長度上限時，要同步改對方 `skill/references/firebase-config.md` 的程式碼

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
