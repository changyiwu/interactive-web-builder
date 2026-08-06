---
name: poll-page
description: |
  產生一份可獨立部署的「即時投票網頁」：給定題目與選項，聽眾用手機開頁面投票，票數透過 Firebase Firestore 即時同步，同步畫成統計圖表（圓餅圖／長條圖／折線圖／雷達圖，現場可切換）。

  一頁可放多題，每題各自一張卡與一張圖表。一人一題一票，改投票是覆寫自己那份、再按一次可收回，天然防灌票。附網址 QR Code；頁面右上角有管理者登入，講者登入後才會出現「重置全部票數」。

  每產生一份就給它一個 pollId，資料落在 `polls/<pollId>/votes/` 各自的子集合，多份投票共用同一個 Firebase 專案但互不干擾，新增時不必改安全規則。

  典型用法是搭配簡報：投影片放一張 QR Code 連到這個頁面，聽眾掃碼投票，講者投影即時圖表。

  當使用者說「做一個投票網頁」「幫我做即時投票」「簡報要放投票讓學生掃 QR」「課堂即時民調」「做一個問卷投票頁看即時圓餅圖」「投票結果要有統計圖表」，或要求任何觀眾即時選擇→匯集成圖表的頁面時，使用此技能。

  不要用於：需要複選、開放式問答、記名問卷或計分測驗的情境。（簡報內嵌的小型投票元件已於 2026-08-05 從 html-slide-builder 移除，統一改用本技能產生獨立頁。）
---

# 即時投票網頁產生器

參數 → 產生單檔 HTML → 本機預覽 → 放進目標 repo 部署 → 簡報加一頁 QR

產出物是**一個 `.html` 檔**，不依賴任何建置流程，丟進任何靜態網站空間（GitHub Pages 最常用）就能跑。

想要的是「聽眾輸入字詞、匯集成文字雲」而不是投票，改用 `word-cloud-page` 技能。

---

## 0. 前置條件（整個 Firebase 專案只需做一次，別重複做）

**任何一項沒到位，產出的頁面都會卡在「連線驗證中…」**：

| 項目 | 怎麼確認 | 沒到位的處理 |
|------|---------|-------------|
| 安全規則已含 `match /polls/{pollId}/votes/{ballot}` | 讀 `interactive-web-builder/firestore.rules` 或 Firebase Console → Firestore → 規則 | 見 `references/firestore-setup.md`，補上並部署 |
| 安全規則的 `/admin_auth/` 寫入條件已含 `== get(config/admin).data.passwordHash` | 同上 | 沒有這一段，**管理者登入會一律成功**（連錯的密碼也是），只是登入後重置票數會失敗。見 `references/firestore-setup.md` |
| Firebase 專案已啟用匿名登入 | Console → Authentication → Sign-in method → Anonymous | 開啟它 |
| 部署網域已註冊在 reCAPTCHA／App Check／API key referrer | 部署到 `changyiwu.github.io` 就已經涵蓋 | 換新網域見 `references/firestore-setup.md` |

---

## 1. 蒐集參數

| 參數 | 說明 | 範例 |
|------|------|------|
| `POLL_ID` | 這份投票的資料夾名，決定資料存哪。只能英數／底線／連字號，最長 40 字。**不同場次要用不同 id，否則票數會累加在一起** | `ai_workshop_1104` |
| `PAGE_TITLE` | 頁面標題 | `課後回饋投票` |
| `INTRO` | 一句話說明，給聽眾看 | `請針對下面兩題各投一票，結果會即時更新。` |
| `QUESTIONS` | 題目陣列，見下方格式 | — |
| 輸出位置 | 檔案要放進哪個 repo 的哪個路徑 | `html-slide-builder/output/ai_workshop/poll.html` |

### QUESTIONS 格式

替換 `{{QUESTIONS_JSON}}` 的是一段 **JS 陣列字面值**（不是 JSON 字串）：

```js
[
  { id: 'q1', title: '你覺得這堂課最大的收穫是什麼？', chart: 'pie',
    options: [
      { id: 'a', label: '學會用 AI 備課' },
      { id: 'b', label: '知道怎麼設計互動' },
      { id: 'c', label: '認識了新工具' }
    ] },
  { id: 'q2', title: '下次想加強哪個主題？', chart: 'bar',
    options: [
      { id: 'a', label: '出題與評量' },
      { id: 'b', label: '簡報製作' }
    ] }
]
```

規則（違反會被 Firestore 安全規則擋下或造成資料互相覆蓋）：

- **`id` 一旦發出去就不要再改**，改了等於換一題，舊票會對不上
- 題目 `id` 在同一頁不可重複，長度 ≤ 40；選項 `id` 長度 ≤ 40
- `id` 建議用 `q1`／`a` 這種短代號；**題目與選項的文字放 `title`／`label`，長度不限**（它們只存在 HTML 裡，不進資料庫）
- `chart` 是**預設**圖表：`pie`｜`bar`｜`line`｜`radar`；頁面上四種隨時可切換
- 一題建議 2–6 個選項；超過 8 個顏色會開始重複

---

## 2. 產生頁面

複製本技能的 `assets/poll-page.html` 到目標位置，取代四個占位符：`{{POLL_ID}}`、`{{PAGE_TITLE}}`、`{{INTRO}}`、`{{QUESTIONS_JSON}}`。

```powershell
$q = @'
[
  { id: 'q1', title: '你覺得這堂課最大的收穫是什麼？', chart: 'pie',
    options: [ { id: 'a', label: '學會用 AI 備課' }, { id: 'b', label: '知道怎麼設計互動' } ] }
]
'@
$src = Get-Content "<技能目錄>/assets/poll-page.html" -Raw
$out = $src.Replace('{{POLL_ID}}','ai_workshop_1104').
            Replace('{{PAGE_TITLE}}','課後回饋投票').
            Replace('{{INTRO}}','請針對下面各題投票，結果會即時更新。').
            Replace('{{QUESTIONS_JSON}}', $q)
Set-Content -Path "<目標路徑>/poll.html" -Value $out -Encoding utf8NoBOM
```

取代完**一定要檢查檔案裡沒有殘留的 `{{`**。Firebase 設定與 reCAPTCHA site key 都已內建在模板裡，正常情況不必改。

---

## 3. 本機預覽

檔案所在資料夾起一個 http server（**不要用 `file://` 雙擊開**）：

```bash
python -m http.server 5173
```

`localhost` 會自動進**離線示範模式**：自動塞一批假票讓四種圖表都有東西可看，管理密碼固定 `demo`，所有操作只存在那個分頁裡，**不會碰到正式資料庫**。

預覽時檢查：題目與選項文字正確、投票後百分比與圖表更新、四種圖表都切得動、再按一次可收回、右上角「管理者登入」輸入 `demo` 後才出現「重置全部票數」。

> 本機 `python -m http.server` 不送 Cache-Control，改了檔案沒反應時先硬重新整理。

---

## 4. 部署

commit 進目標 repo 並 push，等 GitHub Pages 部署完成，取得正式網址。

⚠️ **正式站不要用瀏覽器自動化工具驗證**（Browser pane、Playwright 等）。這些 client 的 reCAPTCHA v3 分數極低，App Check 換 token 會回 403，接著 Firestore 一律 `permission-denied`、畫面卡在「連線驗證中…」——**那是 App Check 正常運作，不是頁面壞掉**。要驗證請使用者本人用一般瀏覽器開。

---

## 5. 在簡報加一頁 QR Code

```html
<!-- head 加這行（若簡報已經有就不要重複） -->
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

<section id="slide-poll-qr">
  <h2>來投個票 📊</h2>
  <p style="font-size:0.5em; color:#94a3b8;">拿手機掃描，結果會即時出現在畫面上</p>
  <div id="poll-qr" style="width:300px; margin:0.6em auto; padding:16px; background:#fff; border-radius:16px;"></div>
  <p style="font-size:0.38em; color:#666; word-break:break-all;" id="poll-qr-url"></p>
</section>

<script>
  // 白底留白就是 QR 的靜空區，掃描器需要它才認得出邊界
  (function () {
    const POLL_URL = 'https://changyiwu.github.io/<repo>/poll.html';
    const box = document.getElementById('poll-qr');
    document.getElementById('poll-qr-url').textContent = POLL_URL;
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof QRCode === 'undefined' || !box) return;
      new QRCode(box, { text: POLL_URL, width: 268, height: 268, correctLevel: QRCode.CorrectLevel.M });
    });
  })();
</script>
```

講者要投影即時圖表時，**另開一個瀏覽器分頁打開同一個網址**即可（結果一律即時顯示，不必登入或切換模式）。

---

## 6. 驗收與交付

1. 正式網址
2. `POLL_ID` 與各題的 `id`（之後查資料或重置要用）
3. 資料位置：`polls/<POLL_ID>/votes/`
4. 管理密碼由誰保管（右上角「管理者登入」用；密碼是整個 Firebase 專案共用的那一組）。提醒講者：**重置票數前要先登入，離開前記得登出**（關掉分頁或重新整理也會自動失效）
5. ⚠️ 提醒：正式站請本人用一般瀏覽器實測投一票

---

## 產出頁面已有的功能（不必再自己加）

- 一頁多題，每題一張卡：左邊投票、右邊即時圖表
- 四種圖表現場切換：圓餅圖、長條圖、折線圖、雷達圖（橫軸一律是選項，四種共用同一組顏色）
- 選項按鈕上直接顯示票數、百分比與進度條
- 一人一題一票；改投票覆寫自己那份；**再按一次已選的選項可收回**
- **管理者登入**（右上角，未登入時只有一個登入按鈕，看不到重置入口）
- 管理模式下才出現「重置全部票數」，按下去還要再確認一次
- 密碼以 SHA-256 雜湊比對，明文不離開瀏覽器；憑證只在登入期間存在，登出或重新整理即失效
- 網址 QR Code（可複製網址、下載帶白邊的 PNG）
- 離線示範模式、連線狀態指示、toast 提示、Esc 關閉對話框與焦點鎖定
- 桌機／平板／手機三段式版面

## 這份頁面**做不到**的事（先講清楚，不要硬改）

- **複選**：安全規則的一份票據只存一個 `option`，文件 ID 綁死 `<uid>_<題號>`。要複選得改資料模型與規則，不是改頁面就好
- **記名／限制身分**：用的是匿名登入，同一個人換瀏覽器就是另一個人。不適合需要「一人只能投一次且擋得住有心人」的正式選舉
- **時間軸／投票歷史**：一人一題只有一份文件，改投票就是覆寫，只留最後一次的時間。因此畫不出「票數隨時間累積」的趨勢圖，四種圖表的橫軸一律是選項
- **問答／填空**：那是 `word-cloud-page` 技能的守備範圍

---

## 疑難排解

| 症狀 | 原因 | 處理 |
|------|------|------|
| 正式站卡在「連線驗證中…」 | ①用自動化瀏覽器開 ②網域沒註冊 App Check ③匿名登入沒開 | 先排除①（換一般瀏覽器）；再看 Console 的 App Check 警告 |
| 投票時 `permission-denied` | 規則沒有 `/polls/` 區塊，或 `POLL_ID`／題目 id 不合法 | id 需符合 `^[a-zA-Z0-9_-]{1,40}$`，題目與選項 id 皆 ≤ 40 字 |
| 票投得下去但圖表空白 | Chart.js 的 CDN 被擋 | 選項按鈕上的票數與百分比仍正常；換網路或把 Chart.js 下載成本地檔 |
| 本機打不到資料庫 | API key 的 referrer 限制擋掉 localhost | 正常現象，本機本來就跑離線示範模式 |
| 兩場的票混在一起 | 用了同一個 `POLL_ID` | 各自換一個 id 重新產生，或登入後用「重置全部票數」清空 |
| 輸入錯的密碼也能登入，但重置失敗 | 線上規則還是舊版（`/admin_auth/` 沒比對 `config/admin`） | 部署新版 `firestore.rules` |
| 改了題目文字後票數看起來怪 | 只改 `title`／`label` 沒關係；**改了 `id` 就等於換一題** | 要沿用舊票就把 id 改回來；要重新開始就換 id 或重置 |

規則全文、路徑設計理由、App Check 換網域要改哪四處、已知風險：見 `references/firestore-setup.md`。


