# Cloudify - 協作線上文字雲 ☁️

Cloudify 是一個即時協作的線上文字雲 Web 應用程式。使用者可以輸入整段文字或多個字詞，系統會自動拆解進行詞頻分析，並透過 Firebase Firestore 即時同步，在所有連接的瀏覽器上呈現動態更新的文字雲畫布。

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
6. 修改 [app.js](file:///c:/Users/chang/我的雲端硬碟/agents/antigravity/online-word-cloud/app.js) 中的 `defaultConfig` 為您專屬的 Firebase 設定物件：
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

- 設定檔位於：[.github/workflows/deploy.yml](file:///c:/Users/chang/我的雲端硬碟/agents/antigravity/online-word-cloud/.github/workflows/deploy.yml)
- 每次將代碼推送到 `main` 分支時，GitHub Actions 會自動建置並部署至您的 GitHub Pages。
- **重要提醒**：請確認您 GitHub 倉庫的設定中，**Settings > Pages > Build and deployment > Source** 已被設定為 **GitHub Actions**。

## 📝 專案結構

```text
online-word-cloud/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 部署工作流
├── index.html              # 主頁面結構
├── index.css               # 毛玻璃與響應式 CSS 樣式
├── app.js                  # 文字解析、Firebase 連接與 WordCloud 渲染邏輯
├── tools/
│   └── set-admin-password.mjs  # 產生管理密碼與 SHA-256 雜湊
├── firebase.json           # Firebase 專案設定檔
├── firestore.rules         # Firestore 安全規則
├── .gitignore              # Git 忽略清單
├── agents.md               # 專案藍圖（跨 Agent 開發規範）
└── handoff.md              # 交接檔
```

## 🔒 授權條款

本專案採用 MIT 授權條款。詳細資訊請參閱專案授權聲明。
