# Firestore 設定與安全規則（poll-page）

本檔是「資料庫這一側」的唯一參考。頁面產生流程見 `../SKILL.md`。

## 共用的 Firebase 專案

| 項目 | 值 |
|------|-----|
| 專案 ID | `word-cloud-c0bfe` |
| 匿名登入 | 必須啟用（Authentication → Sign-in method → Anonymous） |
| App Check | Cloud Firestore **已開啟 Enforce** |
| reCAPTCHA v3 site key | `6LfHM2UtAAAAAFg3pFgvRtMiUXNfLvWC1ny3C0bj`（公開金鑰，可進原始碼） |
| 已註冊網域 | `changyiwu.github.io` |

同一個專案目前有兩組互相隔離的資料，**規則彼此都不能互刪**：

```
clouds/<cloudId>/words/<uid>_<詞>      ← word-cloud-page 技能產生的文字雲頁
polls/<pollId>/votes/<uid>_<題號>      ← 本技能產生的投票頁 ★
```

已刪除、不要救回來的歷史路徑（在舊文件或舊簡報看到不代表還要用）：

- `words/<uid>_<詞>`：Cloudify 文字雲正式站的頂層集合，站與集合已於 2026-08-05 一起刪除，功能由 word-cloud-page 技能取代
- `decks/<slug>/votes/`：html-slide-builder 簡報內嵌投票用的，該功能已整組移除、規則也已刪除。本技能的 `/polls/` 與它的差別在於 delete 允許 `isAdmin()`，講者才能一鍵重置票數

## 為什麼是子集合，不是「每份新開一個 collection」

安全規則的路徑片段**只能是完整字面值或完整萬用字元**，寫不出 `match /{pollId}_votes/{doc}`。若每份投票開一個 top-level collection，就得每產生一份都改 `firestore.rules` 再部署一次——漏改的症狀是**寫入被預設拒絕**，錯誤訊息看起來卻像密碼或登入問題。

改成 `polls/{pollId}/votes/{ballot}` 後，一條規則涵蓋所有投票，**新增一份完全不必碰資料庫設定**。

## 必須部署的規則

依賴同檔案裡的 `isSignedIn()` 與 `isAdmin()` 兩個共用函式（定義見 `interactive-web-builder/firestore.rules`）：

```js
match /polls/{pollId}/votes/{ballot} {
  allow read: if isSignedIn();

  allow create, update: if isSignedIn()
    && pollId.matches('^[a-zA-Z0-9_-]{1,40}$')
    && request.resource.data.keys().hasOnly(['question', 'option', 'uid', 'updated_at'])
    && request.resource.data.question is string
    && request.resource.data.question.size() > 0
    && request.resource.data.question.size() <= 40
    && request.resource.data.option is string
    && request.resource.data.option.size() > 0
    && request.resource.data.option.size() <= 40
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.updated_at == request.time
    && request.resource.data.uid + '_' + request.resource.data.question == ballot;

  // 一般聽眾只能收回自己那票；「一鍵重置投票」需通過 isAdmin() 的雜湊比對
  allow delete: if isSignedIn()
    && (resource.data.uid == request.auth.uid || isAdmin());
}
```

規則要點：

- **文件 ID 固定為 `<uid>_<題號>`**，且規則驗證 `uid + '_' + question == ballot`。一人一題只會有一份文件，改投票是覆寫自己那份——**灌票、改別人的票在規則層就不可能**，也不會有多人搶寫同一份文件的熱點（單一文件持續寫入建議上限約每秒 1 次）。
- **`hasOnly()` 與長度上限是防灌爆的關鍵**——沒有它，任何人都能往單份文件塞到 1 MiB 上限。題目 id 與選項 id 的 40 字上限與頁面設定必須一致。
- `updated_at == request.time` 逼前端用 `serverTimestamp()`，客戶端無法偽造時間。
- **管理密碼是整個專案共用的一組**（`config/admin`），一組密碼可以重置任何一份投票。要換密碼跑 `interactive-web-builder/tools/set-admin-password.mjs`，把輸出的雜湊填進 `config/admin.passwordHash`。

部署方式（在 `interactive-web-builder` 專案目錄）：

```bash
firebase deploy --only firestore:rules
```

部署會**覆蓋整份規則**，所以改動前一定先讀最新的 `firestore.rules`，不要只貼上這一段。

## App Check：換網域要同步改四處

Enforce 已開啟，**任何前端要讀寫這個專案，都必須先 `initializeAppCheck()` 換到 token，而且要在 `getFirestore()`／`getAuth()` 之前**，否則最早幾個請求不帶 token 會被擋。症狀是全部 `PERMISSION_DENIED`——判斷方式是**規則在 Playground 測起來 allow、實際請求卻回 403**。

部署到新網域時這四處要一起改，漏改會**靜默失敗**：

1. 頁面裡的 `APP_CHECK_HOSTS`
2. reCAPTCHA 主控台的網域清單
3. Firebase Console → App Check 的設定
4. Firebase API key 的 referrer 限制（GCP Console）

部署在 `changyiwu.github.io` 底下的任何 repo 都共用同一組設定，不必逐一註冊。

## 已知風險（已接受，不是待辦）

- **管理密碼沒有速率限制**：規則做不到節流，任何人都能匿名登入後反覆嘗試刪除來猜密碼。根治要把權限判定移到 Cloud Functions（需 Blaze 方案）。
- **匿名登入擋不住有心人重複投票**：清掉瀏覽器資料或換裝置就是新的 uid。這是課堂民調工具，不是選舉系統。
- **票數任何人都讀得到**（`allow read: if isSignedIn()`），這是即時圖表的必要條件。不要用它問敏感問題，也不要在選項裡放學生真名。

## 查資料與重置的手動方式

- 看某份投票的資料：Firebase Console → Firestore → `polls` → `<pollId>` → `votes`
- 清空：頁面上的「一鍵重置投票」（只清該 `pollId` 底下的票，不影響其他投票），或在 Console 刪整個 `votes` 子集合

