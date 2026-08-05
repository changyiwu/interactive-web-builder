---
name: word-cloud-page
description: |
  產生一份可獨立部署的「即時協作文字雲網頁」：觀眾用手機開頁面輸入一整段話，系統自動斷詞、累計詞頻，透過 Firebase Firestore 即時同步渲染成文字雲，並附排行榜、刪除自己的字詞、管理員一鍵清空、不雅字詞過濾、網址 QR Code。

  每產生一份就給它一個 cloudId，資料落在 `clouds/<cloudId>/words/` 各自的子集合，多份文字雲共用同一個 Firebase 專案但完全互不干擾，新增時不必改安全規則、不必重新部署資料庫設定。

  典型用法是搭配簡報：在投影片放一張 QR Code 連到這個頁面，聽眾掃碼輸入，講者投影文字雲。

  當使用者說「做一個文字雲網頁」「幫我生一份即時文字雲」「簡報要放文字雲讓學生掃 QR 輸入」「課堂互動文字雲」「詞頻收集頁面」「幫這份簡報加一個文字雲頁」，或要求任何觀眾即時輸入→匯集成文字雲的頁面時，使用此技能。

  不要用於：只想在投影片內嵌一個小型文字雲元件（那是 html-slide-builder 技能 references/firebase-config.md 的區塊 B，一句話一個詞、不離開簡報）；也不要用於離線的靜態文字雲圖片。
---

# 即時協作文字雲網頁產生器

參數 → 產生單檔 HTML → 本機預覽 → 放進目標 repo 部署 → 簡報加一頁 QR

產出物是**一個 `.html` 檔**，不依賴任何建置流程，丟進任何靜態網站空間（GitHub Pages 最常用）就能跑。

---

## 0. 前置條件（整個 Firebase 專案只需做一次，別重複做）

動手前先確認這三件事，**任何一項沒到位，產出的頁面都會卡在「連線驗證中…」**：

| 項目 | 怎麼確認 | 沒到位的處理 |
|------|---------|-------------|
| 安全規則已含 `match /clouds/{cloudId}/words/{word}` | 讀 `online-word-cloud/firestore.rules` 或 Firebase Console → Firestore → 規則 | 見 `references/firestore-setup.md`，補上並部署 |
| Firebase 專案已啟用匿名登入 | Console → Authentication → Sign-in method → Anonymous | 開啟它 |
| 部署網域已註冊在 reCAPTCHA／App Check／API key referrer | 部署到 `changyiwu.github.io` 就已經涵蓋，不必再設 | 換新網域見 `references/firestore-setup.md` 的「換網域要改四處」 |

---

## 1. 蒐集參數

問使用者（或從上下文推斷）以下四項，**不要自己瞎猜 cloudId**：

| 參數 | 說明 | 範例 |
|------|------|------|
| `CLOUD_ID` | 這份文字雲的資料夾名，決定資料存哪。只能英數／底線／連字號，最長 40 字，**不同場次要不同 id，否則資料會混在一起** | `ai_workshop_1104` |
| `PAGE_TITLE` | 頁面標題，瀏覽器分頁與左上角都用它 | `AI 教學工作坊` |
| `PROMPT` | 給觀眾看的一句提問或說明 | `聽完這段，你想到哪些關鍵字？` |
| 輸出位置 | 檔案要放進哪個 repo 的哪個路徑 | `html-slide-builder/output/ai_workshop/wordcloud.html` |

`CLOUD_ID` 命名建議：`<主題>_<場次或日期>`。同一份簡報要收集兩題，就開兩個 id（`xxx_q1`、`xxx_q2`），各自一頁。

---

## 2. 產生頁面

複製本技能的 `assets/word-cloud-page.html` 到目標位置，取代三個占位符：

- `{{CLOUD_ID}}`
- `{{PAGE_TITLE}}`（出現兩次：`<title>` 與左上角）
- `{{PROMPT}}`

PowerShell：

```powershell
$src = Get-Content "<技能目錄>/assets/word-cloud-page.html" -Raw
$out = $src.Replace('{{CLOUD_ID}}','ai_workshop_1104').Replace('{{PAGE_TITLE}}','AI 教學工作坊').Replace('{{PROMPT}}','聽完這段，你想到哪些關鍵字？')
Set-Content -Path "<目標路徑>/wordcloud.html" -Value $out -Encoding utf8NoBOM
```

取代完**一定要檢查檔案裡沒有殘留的 `{{`**。Firebase 設定、reCAPTCHA site key、敏感詞清單都已內建在模板裡，正常情況不必改。

---

## 3. 本機預覽

檔案所在資料夾起一個 http server（**不要用 `file://` 雙擊開**，字型與 CDN 會被擋，也拿不到 `crypto.subtle`）：

```bash
python -m http.server 5173
```

`localhost` 會自動進**離線示範模式**：顯示假資料、橫幅寫著「離線示範模式」、管理密碼固定 `demo`，所有操作只存在那個分頁裡，**不會碰到正式資料庫**。這是刻意的——本機連不到 Firebase 是 API key referrer 限制的正常結果，不要為了本機方便去 GCP Console 放寬它。

預覽時檢查：標題／提問文字正確、送出後排行榜與文字雲更新、「網址 QR Code」開得起來。

> 本機 `python -m http.server` 不送 Cache-Control，改了檔案沒反應時先硬重新整理，別誤判成程式沒生效。

---

## 4. 部署

把檔案 commit 進目標 repo 並 push，等 GitHub Pages 部署完成，取得正式網址，例如
`https://changyiwu.github.io/<repo>/<path>/wordcloud.html`。

⚠️ **正式站不要用瀏覽器自動化工具驗證**（Browser pane、Playwright 等）。這些 client 的 reCAPTCHA v3 分數極低，App Check 換 token 會回 403，接著 Firestore 一律 `permission-denied`、畫面卡在「連線驗證中…」——**那是 App Check 正常運作，不是頁面壞掉**。要驗證正式站，請使用者本人用一般瀏覽器開，或看 Firebase Console → App Check → Metrics 的 verified 比例。

---

## 5. 在簡報加一頁 QR Code

給 reveal.js 簡報用的投影片。把 `WORDCLOUD_URL` 換成第 4 步拿到的正式網址：

```html
<!-- head 加這行（若簡報已經有就不要重複） -->
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

<section id="slide-wordcloud-qr">
  <h2>一起來玩文字雲 ☁️</h2>
  <p style="font-size:0.5em; color:#94a3b8;">拿手機掃描，輸入你想到的關鍵字</p>
  <div id="wc-qr" style="width:300px; margin:0.6em auto; padding:16px; background:#fff; border-radius:16px;"></div>
  <p style="font-size:0.38em; color:#666; word-break:break-all;" id="wc-qr-url"></p>
</section>

<script>
  // 白底留白就是 QR 的靜空區，掃描器需要它才認得出邊界
  (function () {
    const WORDCLOUD_URL = 'https://changyiwu.github.io/<repo>/wordcloud.html';
    const box = document.getElementById('wc-qr');
    document.getElementById('wc-qr-url').textContent = WORDCLOUD_URL;
    // qrcode.min.js 是 defer，等 DOM 完成後再產生
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof QRCode === 'undefined' || !box) return;
      new QRCode(box, { text: WORDCLOUD_URL, width: 268, height: 268, correctLevel: QRCode.CorrectLevel.M });
    });
  })();
</script>
```

投影片也可以只放一行短網址，但**現場掃 QR 的轉換率遠高於要聽眾手打網址**，預設放 QR。

不要把文字雲頁 iframe 進投影片：聽眾的輸入需要各自的手機，講者投影只需要看結果，兩者放在一起反而會讓聽眾誤以為要在投影幕上打字。

---

## 6. 驗收與交付

交付給使用者時，同時給這五項：

1. 正式網址
2. `CLOUD_ID`（之後要清資料或查資料得用它）
3. 資料位置：`clouds/<CLOUD_ID>/words/`
4. 管理密碼由誰保管（清空全部要用；密碼是整個 Firebase 專案共用的那一組）
5. ⚠️ 提醒：正式站請本人用一般瀏覽器實測一次送出

---

## 產出頁面已有的功能（不必再自己加）

- 一整段話自動斷詞（中文單字起算、英文兩字母起算）、詞頻累計
- 即時同步（Firestore `onSnapshot`），同一個詞固定顏色不閃爍
- 熱門字詞排行榜（列出全部、自己捲動）
- 刪除自己送出的字詞（只有自己的那幾筆會出現垃圾桶圖示）
- 管理員一鍵刪除全部（SHA-256 雜湊比對，明文密碼不離開瀏覽器）
- 不雅字詞過濾、單詞長度上限 100 字
- 網址 QR Code（可複製網址、下載帶白邊的 PNG）
- 離線示範模式、連線狀態指示、toast 提示、Esc 關閉對話框與焦點鎖定
- 桌機／平板／手機三段式版面

要改文案、配色、敏感詞清單，直接改產出的那份 HTML；**不要改技能裡的模板**，除非是要讓所有未來的文字雲都跟著變。

---

## 疑難排解

| 症狀 | 原因 | 處理 |
|------|------|------|
| 正式站卡在「連線驗證中…」 | ①用自動化瀏覽器開 ②網域沒註冊 App Check ③匿名登入沒開 | 先排除①（換一般瀏覽器）；再看 Console 的 App Check 警告 |
| 送出時 `permission-denied` | 安全規則沒有 `/clouds/` 區塊，或 `CLOUD_ID` 含非法字元 | 檢查 id 是否符合 `^[a-zA-Z0-9_-]{1,40}$`；規則見 references |
| 本機打不到資料庫 | API key 的 referrer 限制擋掉 localhost | 正常現象，本機本來就跑離線示範模式 |
| 文字雲空白但排行榜有資料 | wordcloud2 的 CDN 被擋 | 換網路，或把 wordcloud2 下載成本地檔 |
| 兩份文字雲資料混在一起 | 用了同一個 `CLOUD_ID` | 各自換一個 id 重新產生 |

規則全文、路徑設計理由、App Check 換網域要改哪四處、已知風險：見 `references/firestore-setup.md`。
