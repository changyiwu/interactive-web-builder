# Firestore 設定與安全規則（word-cloud-page）

本檔是「資料庫這一側」的唯一參考。頁面產生流程見 `../SKILL.md`。

## 共用的 Firebase 專案

| 項目 | 值 |
|------|-----|
| 專案 ID | `word-cloud-c0bfe` |
| 匿名登入 | 必須啟用（Authentication → Sign-in method → Anonymous） |
| App Check | Cloud Firestore **已開啟 Enforce** |
| reCAPTCHA v3 site key | `6LfHM2UtAAAAAFg3pFgvRtMiUXNfLvWC1ny3C0bj`（公開金鑰，可進原始碼） |
| 已註冊網域 | `changyiwu.github.io` |

同一個專案目前有兩組互相隔離的資料：

```
clouds/<cloudId>/words/<uid>_<詞>      ← 本技能產生的文字雲頁 ★
polls/<pollId>/votes/<uid>_<題號>      ← poll-page 技能產生的投票頁
```

**這兩條規則都不能互刪。**

已刪除、不要救回來的歷史路徑（在舊文件或舊簡報看到不代表還要用）：

- `words/<uid>_<詞>`：Cloudify 文字雲正式站的頂層集合，站與集合已於 2026-08-05 一起刪除，功能由本技能取代
- `decks/<slug>/...`：簡報內嵌互動元件用的，該功能已整組移除、規則也已刪除

## 為什麼是子集合，不是「每份新開一個 collection」

安全規則的路徑片段**只能是完整字面值或完整萬用字元**，寫不出 `match /{cloudId}_words/{doc}` 這種部分比對。若真的每份文字雲開一個 top-level collection，就得每產生一份都回頭改 `firestore.rules` 再部署一次——而漏改的症狀是**寫入被預設拒絕**，且錯誤訊息看起來像密碼或登入問題。

改成 `clouds/{cloudId}/words/{word}` 子集合後，一條規則涵蓋所有文字雲，**新增一份完全不必碰資料庫設定**。

## 必須部署的規則

以下區塊必須存在於 `firestore.rules`（本技能的來源專案 `interactive-web-builder` 已含）。它依賴同檔案裡的 `isSignedIn()` 與 `isAdmin()` 兩個共用函式：

```js
// 管理者授權：比對使用者臨時憑證與 config/admin 的密碼雜湊。
// 前端只送 SHA-256 雜湊，明文不離開瀏覽器；config 前端完全不可讀寫，
// 只有規則內部的 get() 能取用（get() 不受 read 規則限制）。
function isAdmin() {
  return exists(/databases/$(database)/documents/admin_auth/$(request.auth.uid))
    && get(/databases/$(database)/documents/admin_auth/$(request.auth.uid)).data.passwordHash
       == get(/databases/$(database)/documents/config/admin).data.passwordHash;
}

match /clouds/{cloudId}/words/{word} {
  allow read: if isSignedIn();

  allow create, update: if isSignedIn()
    && cloudId.matches('^[a-zA-Z0-9_-]{1,40}$')
    && request.resource.data.keys().hasOnly(['text', 'count', 'timestamp', 'uid'])
    && request.resource.data.text is string
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 100
    && request.resource.data.count is int
    && request.resource.data.count > 0
    && request.resource.data.count <= 1000
    && request.resource.data.timestamp == request.time
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.uid + '_' + request.resource.data.text == word;

  allow delete: if isSignedIn()
    && (resource.data.uid == request.auth.uid || isAdmin());
}
```

規則要點：

- **`hasOnly()` 與長度上限是防灌爆的關鍵**——沒有它，任何人都能往單份文件塞到 1 MiB 上限。改任一邊都要同步改頁面裡的 `MAX_WORD_LENGTH`（100）。
- **文件 ID 固定為 `<uid>_<詞>`**，且規則會驗證 `uid + '_' + text == word`。同一人重複送同一個詞只會累加自己那份，「改別人的資料」在規則層就不可能。
- `timestamp == request.time` 逼前端用 `serverTimestamp()`，客戶端無法偽造時間。
- **管理密碼是整個專案共用的一組**（`config/admin`），一組密碼可以清空任何一份文字雲。要換密碼跑 `interactive-web-builder/tools/set-admin-password.mjs`，把輸出的雜湊填進 `config/admin.passwordHash`。

部署方式（在 `interactive-web-builder` 專案目錄）：

```bash
firebase deploy --only firestore:rules
```

部署會**覆蓋整份規則**，所以改動前一定先讀最新的 `firestore.rules`，不要只貼上這一段。

## App Check：換網域要同步改四處

Enforce 已開啟，**任何前端要讀寫這個專案，都必須先 `initializeAppCheck()` 換到 token，而且要在 `getFirestore()`／`getAuth()` 之前**，否則最早幾個請求不帶 token 會被擋。症狀是全部 `PERMISSION_DENIED`，很容易誤判成安全規則的問題——判斷方式是**規則在 Playground 測起來 allow、實際請求卻回 403**。

部署到新網域時，這四處要一起改，漏改會**靜默失敗**：

1. 頁面裡的 `APP_CHECK_HOSTS`
2. reCAPTCHA 主控台的網域清單
3. Firebase Console → App Check 的設定
4. Firebase API key 的 referrer 限制（GCP Console）

部署在 `changyiwu.github.io` 底下的任何 repo 都共用同一組設定，不必逐一註冊。

## 已知風險（已接受，不是待辦）

- **管理密碼沒有速率限制**：安全規則做不到節流，任何人都能匿名登入後反覆嘗試刪除來猜密碼。根治要把權限判定移到 Cloud Functions（需 Blaze 方案）。現行做法只是提高成本，不是消除弱點。
- **同一份文字雲的資料任何人都讀得到**（`allow read: if isSignedIn()`）。這是即時協作的必要條件，不要放敏感內容；也不要在文字雲頁收集學生真名。

## 查資料與清資料的手動方式

- 看某份文字雲的資料：Firebase Console → Firestore → `clouds` → `<cloudId>` → `words`
- 整份刪掉：Console 裡刪 `clouds/<cloudId>` 這個文件的子集合，或在頁面上用「一鍵刪除全部」（會清空該 `cloudId` 底下的 `words`，不影響其他文字雲）

