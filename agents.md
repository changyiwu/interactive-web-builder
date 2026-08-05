# interactive-web-builder（專案藍圖）

> 本檔為跨 Agent 通用的專案藍圖（AGENTS.md 開放標準）。任何 Agent 的每個 session 都應先讀本檔＋`handoff.md`。
>
> 本專案原名 `online-word-cloud`，2026-08-05 因範圍擴大為「聽眾即時互動網頁的製作」而更名。

## 專案簡介
製作聽眾即時互動網頁的**技能倉庫**。核心是 `skills/` 底下兩個跨專案技能：`word-cloud-page`（文字雲頁）與 `poll-page`（投票頁＋統計圖表），給定參數就產生一份可獨立部署的單檔 HTML，供其他專案（例如 `html-slide-builder` 的簡報）放 QR Code 連過去。

**產出的互動頁放在呼叫端專案的資料夾**，本 repo 只留模板；根目錄的 `wordcloud.html`／`poll.html` 是本 repo 自己的示範／測試頁，不是給別人複製的正本。

`firestore.rules` 是所有互動頁共用的安全規則正本（Firebase 專案 `word-cloud-c0bfe`），兩條路徑各走各的。

> **2026-08-05：原本的 Cloudify 文字雲正式站（`index.html`／`index.css`／`app.js`／`assets/`）已整組刪除，`words` 集合也已清空刪除。**功能完全被 `word-cloud-page` 技能取代——後者能開無限份、彼此隔離，正式站那份單一固定的文字雲沒有存在必要。不要把它救回來。

## 關鍵時程
- 2026-06-07：專案初始化與 GitHub Actions / GitHub Pages 上線部署
- 2026-07-26：安全性強化；因原始碼曾含明文管理密碼，捨棄 23 個 commit 的歷史重建 repo
- 2026-07-26：UI 與功能細節優化；新增 localhost 離線示範模式，解決本機連不到 Firebase 的開發困境
- 2026-08-05：`firestore.rules` 新增 `/decks/` 區塊，把 Firebase 專案分享給 `html-slide-builder` 的簡報互動元件使用
- 2026-08-05：Cloud Firestore 開啟 App Check 強制執行；Metrics 顯示 92% verified（38 筆中 3 筆 invalid 為自動化瀏覽器所致）
- 2026-08-05：本專案的文字雲頁流程封裝成 `word-cloud-page` 技能，供其他專案產生獨立部署的文字雲頁；`firestore.rules` 新增 `/clouds/{cloudId}/words/` 區塊
- 2026-08-05：新增 `poll-page` 技能（即時投票頁＋Chart.js 統計圖表）；`firestore.rules` 新增 `/polls/{pollId}/votes/` 區塊；技能改放在 `skills/<技能名>/`
- 2026-08-05：`html-slide-builder` 移除簡報內嵌的文字雲與投票，改呼叫本專案技能；`/decks/` 兩條規則隨之刪除；專案由 `online-word-cloud` 更名為 `interactive-web-builder`
- 2026-08-05：刪除 Cloudify 文字雲正式站與 `words` 集合（38 筆），改由技能產生的獨立互動頁取代；根目錄放兩份示範頁 `wordcloud.html`／`poll.html`

## 目標與路線圖
- [x] 階段一：建立線上文字雲核心 HTML/CSS/JS 功能與視覺美化
- [x] 階段二：串接 Firebase Firestore 即時同步與權限安全規則
- [x] 階段三：新增刪除單一字詞、不雅字詞敏感詞過濾功能
- [x] 階段四：安全性強化——雜湊式管理授權、規則欄位與數值界線、App Check、git 歷史重建
- [x] 階段五：觀察 App Check 指標，確認多數請求已驗證後開啟 Firestore 強制執行
- ~~階段六：實測「一鍵刪除全部」完整流程~~（正式站已刪除，作廢；技能頁的同名功能改在階段十三驗證）
- [x] 階段七：UI 與功能細節優化——固定配色、toast／確認框、排行榜全列、無障礙、桌機版滿版佈局
- [x] 階段八：新增 localhost 離線示範模式，讓 UI 迭代不必每次推上線
- ~~階段九：把階段七、八的改動推上 GitHub Pages 實測正式路徑~~（正式站已刪除，作廢；那些 UI 改動已隨技能模板延續）
- ~~階段十：正式站 UI 持續優化~~（正式站已刪除，作廢；要優化改動技能模板）
- [x] 階段十一：把文字雲頁流程封裝成 `word-cloud-page` 技能，資料改走 `clouds/{cloudId}/words/` 子集合，一份規則涵蓋所有新產生的文字雲
- [x] 階段十二：新增 `poll-page` 技能（`polls/{pollId}/votes/`），投票頁附即時圓餅／甜甜圈／長條／累積趨勢圖表
- [ ] 階段十三：兩個技能的正式 Firebase 路徑實測（產生第一份文字雲頁與投票頁，由使用者本人在一般瀏覽器操作）

## 資料夾結構
- `firestore.rules`：Firestore 資料庫存取與格式驗證規則（所有互動頁共用的正本）
- `wordcloud.html` / `poll.html`：本 repo 的示範／測試頁，由兩個技能產生
  （`demo_cloud_20260805`／`demo_poll_20260805`）；要改請改技能模板再重新產生
- `tools/set-admin-password.mjs`：產生管理密碼與 SHA-256 雜湊
- `skills/word-cloud-page/`：文字雲頁技能原始檔（`SKILL.md`、`assets/word-cloud-page.html` 單檔模板、`references/firestore-setup.md`）
- `skills/poll-page/`：投票頁技能原始檔（同樣結構，模板為 `assets/poll-page.html`）
- `.firebaserc` / `firebase.json`：Firebase 專案配置
- `.github/workflows/deploy.yml`：GitHub Actions 部署腳本
- `agents.md`：專案藍圖（本檔）
- `handoff.md`：交接檔（每次收工必更新）

## 同步層級（本專案初始化至第 3 層級）

| 層級 | 平台 | 位置 | 讀取時機 |
|------|------|------|---------|
| L1 | 本地（GDrive） | `agents.md`＋`handoff.md` | 每個 session |
| L2 | GitHub | changyiwu/interactive-web-builder | 指定時 |
| L3 | Obsidian | interactive-web-builder/專案工作流程.md | 有需要時 |

## 三個檔案的職責（依「時效性」分家，不是依「詳細程度」）

| 檔案 | 時效 | 寫入方式 | 放什麼 |
|------|------|---------|--------|
| `handoff.md` | **只對下一個 session 有效**，過期即丟 | 每次收工整份重寫 | 做到哪、下一步、**這次**的暫時 workaround |
| `agents.md`（本檔） | **長期有效**，每個 session 都適用 | 只有規則本身變了才改 | 目標、路線圖、常設規則、結構 |
| Obsidian／`git log` | **歷史**：發生過什麼、為什麼 | 只增不刪 | 決策紀錄、踩坑完整版、逐次進度 |

驗收標準：**`handoff.md` 整份刪掉，不應損失任何長期資訊**——會的話代表該升級進本檔卻沒升級。

**本檔不要出現的東西**：❌ `## 最近進度`／逐次工作紀錄、❌ 決策理由與踩坑完整版。歷史寫 L3 筆記的〈🗓️ 最近更動紀錄〉〈🧠 決策紀錄〉〈🕳️ 踩坑筆記〉；踩過的坑只把**結論**收斂成一條祈使句寫進〈工作約定〉，原因留 L3。

## 專案專屬規則

- **離線示範模式的判斷依據是各頁面裡的 `DEMO_HOSTS`**（`localhost`／`127.0.0.1`／`file://`）；正式網域不在清單內，線上行為不受影響。此模式下管理密碼固定為 `demo`。要在本機測真實 Firebase，得先解除 API key 的 referrer 限制，再把 host 從 `DEMO_HOSTS` 拿掉
- **本機 `python -m http.server` 沒送 Cache-Control**，瀏覽器會拿舊的 HTML。改完沒反應時先用 `fetch(url, {cache:'reload'})` 或硬重新整理，**別誤判成程式沒生效**
- **文字雲頁桌機版（≥901px）用 `height: 100vh` 把佈局框在視窗內**，排行榜靠自己的捲軸。改左欄內容（例如加高 textarea）會直接壓縮排行榜可視高度，動之前先確認 `.stat-container` 沒被壓到 0。視窗矮於 800px 時整頁小幅捲動，是刻意的降級
- **App Check 的 Enforce 已於 Cloud Firestore 開啟**：任何前端要讀寫這個 Firebase 專案，都必須先 `initializeAppCheck()` 換到 token，**而且要在 `getFirestore()`／`getAuth()` 之前**，否則最早幾個請求不帶 token 會被擋。症狀是全部 `PERMISSION_DENIED`，很容易誤判成安全規則的問題——判斷方式是規則在 Playground 測起來 allow、實際請求卻回 403。site key 與網域見技能模板裡的 `RECAPTCHA_SITE_KEY`／`APP_CHECK_HOSTS`
- **不要用瀏覽器工具驗證線上的互動頁，會誤判成故障。**Browser pane／Playwright 等自動化瀏覽器的 reCAPTCHA v3 分數極低，App Check 換 token 會被回 **403**，接著 Firestore 一律 `permission-denied`、畫面卡在「連線驗證中…」。**那是 Enforce 正常運作，不是線上壞掉**——它擋的就是這種 client。判斷正式站健康與否**只看 Firebase Console → App Check → Metrics**：verified 占絕大多數即正常（少數 invalid 通常就是自己剛才那幾次自動化載入）。真要用自動化瀏覽器驗證，得先在 Console 註冊 debug token，那等於發永久通行證，僅限開發環境
- **管理密碼的暴力破解問題沒有根治**：安全規則沒有速率限制，任何人都能匿名登入後反覆嘗試刪除來猜密碼。根治要把權限判定移到 Cloud Functions（需 Blaze 方案）。現行做法只是提高成本，不是消除弱點——**這是已知且接受的風險**
- **換網域時要同步更新四處**：技能模板（與已產生的頁面）裡的 `APP_CHECK_HOSTS`、reCAPTCHA 主控台網域清單、Firebase Console 的 App Check 設定、Firebase API key 的 referrer 限制。漏改會**靜默失敗**（未 Enforce 時完全無感）
- GitHub Pages 設定為 `build_type: workflow`（與 `deploy.yml` 一致）；`.claude/launch.json` 是本機預覽設定（`python -m http.server 5173`），目前在版控內，不需要可 `git rm --cached`
- **`/decks/{slug}/...` 兩條規則已於 2026-08-05 刪除**（`html-slide-builder` 的簡報內嵌互動元件已整組移除，改呼叫本專案技能）。**不要因為在舊文件或舊簡報看到 `decks/` 就把規則加回來**——那些是歷史殘留，正確做法是改用 `clouds/` 或 `polls/` 的獨立互動頁
- **⚠️ `firestore.rules` 的 `/clouds/{cloudId}/words/` 與 `/polls/{pollId}/votes/` 兩個區塊是 `skills/` 底下兩個技能的生命線，不要刪。**技能每產生一份頁面就給一個 id，資料落在對應子集合；一條規則涵蓋全部，所以新增頁面不必改規則、不必再部署。刪掉會讓**所有已經發出去的文字雲頁／投票頁同時靜默失效**。規則裡的欄位規格（`hasOnly`、長度與次數上限）與 `skills/*/assets/*.html` 的對應常數必須一致，改一邊就要改另一邊
- **技能模板與本專案的 `index.html`／`app.js` 是各自獨立的程式碼**，只是同源。本站修 bug 不會自動流到技能模板，反之亦然；改動若屬於「兩邊都該有」的性質（例如安全性修正），要明確地各改一次。技能改完別忘了跑 `/sync-skills` 才會更新到各 agent 的全域技能目錄

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
