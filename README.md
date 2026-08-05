# interactive-web-builder ☁️📊

聽眾即時互動網頁的**技能倉庫**。給定參數就產生一份可獨立部署的單檔 HTML，讓其他專案（例如 `html-slide-builder` 的簡報）放一張 QR Code 連過去，聽眾用手機參與、講者投影結果。

| 技能 | 產出 | 資料位置 |
|------|------|---------|
| `word-cloud-page` | 即時文字雲頁（自動斷詞、詞頻、排行榜、管理員清空） | `clouds/<cloudId>/words/` |
| `poll-page` | 即時投票頁（圓餅／甜甜圈／長條／累積趨勢圖表） | `polls/<pollId>/votes/` |

兩者共用同一個 Firebase 專案與同一份 `firestore.rules`，各走各的路徑，互不干擾；**每產生一份頁面就給一個 id，新增時不必改規則、不必重新部署**。

產出的互動頁放在**呼叫端專案的資料夾**，本 repo 只留模板。根目錄的 `wordcloud.html`／`poll.html` 是這個 repo 自己的示範頁：

- <https://changyiwu.github.io/interactive-web-builder/wordcloud.html>
- <https://changyiwu.github.io/interactive-web-builder/poll.html>

> 2026-08-05 起，原本的 Cloudify 文字雲正式站（`index.html`／`app.js`）已刪除——`word-cloud-page` 技能能開無限份彼此隔離的文字雲，單一固定站沒有存在必要。

## ✨ 產出頁面的特色

- **即時同步**：Firestore 實時監聽，任何人的輸入或投票會在所有裝置上瞬間更新。
- **自動詞頻分析**：中英文自動斷詞計數，中文允許單字、英文大小寫正規化，含不雅字詞過濾。
- **統計圖表**：投票頁用 Chart.js 畫圓餅／甜甜圈／長條／累積趨勢，現場可切換。
- **精美視覺**：Outfit ＋ Noto Sans TC，漸層配色與深色毛玻璃（Glassmorphism）風格，桌機／平板／手機三段式版面。
- **安全連線**：匿名登入 ＋ App Check（reCAPTCHA v3）＋ 嚴格的 Firestore 安全規則；管理操作只送 SHA-256 雜湊。
- **自動部署**：GitHub Actions，push 到 `main` 就部署到 GitHub Pages。

## 🛠️ 技術棧

- **前端核心**：單檔 HTML5 ＋ JavaScript（ES Modules，Firebase SDK 動態載入）
- **樣式設計**：Vanilla CSS（毛玻璃風格、響應式佈局）
- **文字雲渲染**：[WordCloud2.js](https://github.com/timdream/wordcloud2.js)
- **圖表**：[Chart.js](https://www.chartjs.org/)
- **後端資料庫**：Firebase Auth（匿名登入）＆ Firebase Firestore

## 🚀 快速開始

### 1. 產生一份互動頁

依 `skills/word-cloud-page/SKILL.md` 或 `skills/poll-page/SKILL.md` 的流程：複製 `assets/` 下的單檔模板到目標位置，取代占位符（`CLOUD_ID`／`POLL_ID`、標題、提問、選項），部署後把網址做成 QR Code。

### 2. 本地預覽

單檔 HTML 內含 ES Modules，**必須用本地 Web 伺服器開啟**，不要 `file://` 雙擊：

```bash
python -m http.server 5173
```

#### 離線示範模式（localhost 自動啟用）

Firebase API key 設了 referrer 限制，**本機一定連不到 Firebase**
（會看到 `auth/requests-from-referer-...-are-blocked`）。因此在 `localhost`、
`127.0.0.1` 或 `file://` 開啟時，頁面會跳過 Firebase 初始化，改用一份存在
記憶體裡的假資料，讓版面調整不必每次都推上線才看得到效果。

- 判斷依據為頁面裡的 `DEMO_HOSTS`，正式網域不在清單內，**線上行為完全不受影響**
- 所有新增／刪除／投票只存在當前分頁，重新整理就還原成種子資料
- 此模式下管理密碼固定為 `demo`（方便同時測成功與失敗兩條路徑）
- 頁面上方會有一條琥珀色橫幅標示目前是示範模式

真正要驗證 Firestore 同步、安全規則或 App Check，仍然只能推上 GitHub Pages 實測。

### 2. Firebase 雲端設定步驟

若要使用自訂的 Firebase 專案，請遵循以下設定：

1. 前往 [Firebase 控制台](https://console.firebase.google.com/)，建立一個新專案。
2. 在專案中啟用 **Firestore Database**，並選擇合適的地區。
3. 前往 **Build > Authentication > Sign-in method**，啟用 **Anonymous (匿名登入)**。
4. 部署專案目錄下的 `firestore.rules`（內容以該檔為準，勿另行貼上簡化版）：
   ```bash
   firebase deploy --only firestore:rules
   ```
5. 建立一個 Web 應用程式並複製 Firebase SDK 設定物件。
6. 換掉**兩個技能模板**（`skills/*/assets/*.html`）裡的 `FIREBASE_CONFIG`；已經產生出去的頁面各自帶一份，也要一起換：
   ```javascript
   const FIREBASE_CONFIG = {
     projectId: "YOUR_PROJECT_ID",
     appId: "YOUR_APP_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     messagingSenderId: "YOUR_SENDER_ID"
   };
   ```

### 3. 管理密碼設定

「一鍵刪除全部」與「一鍵重置投票」需要管理密碼。安全規則只比對 SHA-256 雜湊，
Firestore 內不儲存明文，前端也只送出雜湊。

```bash
node tools/set-admin-password.mjs
```

腳本會產生一組 24 字元隨機密碼並印出雜湊值。接著到
Firebase Console → Firestore Database → `config` → `admin`：

1. 新增字串欄位 `passwordHash`，值填入腳本輸出的 64 位十六進位字串
2. 確認文件內沒有任何明文 `password` 欄位

若要沿用既有密碼，改成 `node tools/set-admin-password.mjs "你的密碼"` 只算雜湊。
明文密碼請存進密碼管理器，**不要 commit 進 repo**。

> 為什麼要用長隨機密碼：安全規則沒有速率限制，任何人都能匿名登入後反覆嘗試
> 刪除操作來試密碼。密碼長度就是這道防線的強度，短密碼會被腳本在數分鐘內試出來。
> 要根治需要把權限判定移到 Cloud Functions（需啟用 Blaze 方案）。

### 4. App Check（reCAPTCHA v3）

每個互動頁裡的 `RECAPTCHA_SITE_KEY` 為 reCAPTCHA v3 網站金鑰（**公開金鑰，可 commit**，
目前是 `6LfHM2Ut…`）。對應的 secret key 只填在 Firebase Console → App Check，**不可進入 repo**。

App Check 只在 `APP_CHECK_HOSTS` 列出的網域啟用（目前為 `changyiwu.github.io`）。
本機以 `file://` 或 localhost 開啟時會自動跳過初始化，開發不受影響。

⚠️ 換網域時要同時更新三個地方，否則線上會拿不到 token：
技能模板（與已產生的頁面）裡的 `APP_CHECK_HOSTS`、reCAPTCHA 主控台的網域清單、
Firebase Console 的 App Check 設定。

開啟強制執行（Enforcement）前，請先在 Console 觀察 App Check 指標，確認已驗證
請求佔絕大多數，否則會立刻讓所有使用者無法讀寫。

### 5. 自動部署至 GitHub Pages

本專案使用 GitHub Actions 進行持續整合與部署。

- 設定檔位於：[.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- 每次將代碼推送到 `main` 分支時，GitHub Actions 會自動建置並部署至您的 GitHub Pages。
- **重要提醒**：請確認您 GitHub 倉庫的設定中，**Settings > Pages > Build and deployment > Source** 已被設定為 **GitHub Actions**。

## 📝 專案結構

```text
interactive-web-builder/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 部署工作流
├── wordcloud.html          # 示範頁：由 word-cloud-page 技能產生
├── poll.html               # 示範頁：由 poll-page 技能產生
├── skills/
│   ├── word-cloud-page/    # 技能：產生獨立的即時文字雲頁
│   │   ├── SKILL.md
│   │   ├── assets/word-cloud-page.html      # 單檔模板
│   │   └── references/firestore-setup.md
│   └── poll-page/          # 技能：產生獨立的即時投票頁（含統計圖表）
│       ├── SKILL.md
│       ├── assets/poll-page.html            # 單檔模板
│       └── references/firestore-setup.md
├── tools/
│   └── set-admin-password.mjs  # 產生管理密碼與 SHA-256 雜湊
├── firebase.json           # Firebase 專案設定檔
├── firestore.rules         # Firestore 安全規則（clouds／polls 兩條路徑的正本）
├── .gitignore              # Git 忽略清單
├── agents.md               # 專案藍圖（跨 Agent 開發規範）
└── handoff.md              # 交接檔
```

## 🔒 授權條款

本專案採用 MIT 授權條款。詳細資訊請參閱專案授權聲明。
