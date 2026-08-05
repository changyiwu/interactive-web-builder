# interactive-web-builder ☁️📊

聽眾即時互動網頁的製作專案。包含兩個部分：

1. **Cloudify 文字雲正式站**（本 repo 根目錄）——即時協作的線上文字雲。使用者輸入整段文字或多個字詞，系統自動拆解進行詞頻分析，透過 Firebase Firestore 即時同步，在所有連接的瀏覽器上呈現動態更新的文字雲畫布。
2. **兩個可跨專案使用的技能**（`skills/`）——給定參數就產生一份可獨立部署的互動網頁，讓其他專案（例如 `html-slide-builder` 的簡報）放一張 QR Code 連過去：

| 技能 | 產出 | 資料位置 |
|------|------|---------|
| `word-cloud-page` | 即時文字雲頁（斷詞、詞頻、排行榜、管理員清空） | `clouds/<cloudId>/words/` |
| `poll-page` | 即時投票頁（圓餅／甜甜圈／長條／累積趨勢圖表） | `polls/<pollId>/votes/` |

三者共用同一個 Firebase 專案與同一份 `firestore.rules`，各走各的路徑，互不干擾。產出的互動頁放在**呼叫端專案的資料夾**，本 repo 只留模板。

## ✨ 特色功能

- **即時同步**：利用 Firebase Firestore 的實時監聽 (Real-time Listeners)，多位使用者輸入的字句會在所有裝置上瞬間同步。
- **自動詞頻分析**：自動解析中文/英文詞彙並計算詞頻，支援中文單字過濾與英文大小寫標準化。
- **精美視覺效果**：整合 `WordCloud2.js` 庫，搭配 Outfit 與 Noto Sans TC 字型，採用精心調配的漸層配色與深色毛玻璃 (Glassmorphism) 風格。
- **安全連線**：使用 Firebase 匿名登入 (Anonymous Auth) 機制，並搭配嚴格的 Firestore 安全規則確保資料寫入權限。
- **自動部署**：整合 GitHub Actions，每次 push 到 `main` 分支時自動部署最新版本至 GitHub Pages。

## 🛠️ 技術棧

- **前端核心**：HTML5, JavaScript (ES6 Modules)
- **樣式設計**：Vanilla CSS (毛玻璃風格、響應式佈局)
- **文字雲渲染**：[WordCloud2.js](https://github.com/timdream/wordcloud2.js)
- **後端資料庫**：Firebase Auth (匿名登入) & Firebase Firestore

## 🚀 快速開始

### 1. 本地開發執行

本專案為純前端靜態網頁，內含原生 ES Modules，因此**必須使用本地 Web 伺服器開啟**。

推薦使用 VS Code 的 **Live Server** 套件，或是使用 Node.js 的 `serve`、`http-server`：

```bash
# 使用 npx 啟動臨時 Web 伺服器
npx http-server
```

打開瀏覽器前往提示的網址（通常為 `http://localhost:8080`）即可看到應用程式。

#### 離線示範模式（localhost 自動啟用）

正式站的 Firebase API key 設了 referrer 限制，**本機一定連不到 Firebase**
（會看到 `auth/requests-from-referer-...-are-blocked`）。因此在 `localhost`、
`127.0.0.1` 或 `file://` 開啟時，`app.js` 會跳過 Firebase 初始化，改用一份存在
記憶體裡的假資料，讓 UI 調整不必每次都推上線才看得到效果。

- 判斷依據為 `app.js` 的 `DEMO_HOSTS`，正式網域不在清單內，**線上行為完全不受影響**
- 所有新增／刪除只存在當前分頁，重新整理就還原成種子資料
- 此模式下「一鍵刪除全部」的管理密碼固定為 `demo`（方便同時測成功與失敗兩條路徑）
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
6. 修改 [app.js](app.js) 中的 `defaultConfig` 為您專屬的 Firebase 設定物件（`skills/` 底下兩個模板的 `FIREBASE_CONFIG` 也要一起換）：
   ```javascript
   const defaultConfig = {
     projectId: "YOUR_PROJECT_ID",
     appId: "YOUR_APP_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     messagingSenderId: "YOUR_SENDER_ID"
   };
   ```

### 3. 管理密碼設定

「一鍵刪除全部」需要管理密碼。安全規則只比對 SHA-256 雜湊，Firestore 內不儲存明文，
前端也只送出雜湊。

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

`app.js` 的 `RECAPTCHA_SITE_KEY` 為 reCAPTCHA v3 網站金鑰（公開金鑰，可 commit）。
對應的 secret key 只填在 Firebase Console → App Check，**不可進入 repo**。

App Check 只在 `APP_CHECK_HOSTS` 列出的網域啟用（目前為 `changyiwu.github.io`）。
本機以 `file://` 或 localhost 開啟時會自動跳過初始化，開發不受影響。

⚠️ 換網域時要同時更新三個地方，否則正式站會拿不到 token：
`app.js` 的 `APP_CHECK_HOSTS`、reCAPTCHA 主控台的網域清單、Firebase Console 的 App Check 設定。

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
├── index.html              # 文字雲正式站：主頁面結構
├── index.css               # 毛玻璃與響應式 CSS 樣式
├── app.js                  # 文字解析、Firebase 連接與 WordCloud 渲染邏輯
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
├── firestore.rules         # Firestore 安全規則（三條路徑的正本）
├── .gitignore              # Git 忽略清單
├── agents.md               # 專案藍圖（跨 Agent 開發規範）
└── handoff.md              # 交接檔
```

## 🔒 授權條款

本專案採用 MIT 授權條款。詳細資訊請參閱專案授權聲明。
