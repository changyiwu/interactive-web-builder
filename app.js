import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, doc, query, limit, writeBatch, increment, serverTimestamp, onSnapshot, getDocs, deleteDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-check.js';

// App state variables
let firebaseApp = null;
let db = null;
let auth = null;
let unsubscribe = null;
let currentList = [];
let currentUserWords = new Set();
let myUid = null;
let dataReady = false;

// Firestore allows at most 500 operations per batch
const BATCH_LIMIT = 500;

// DOM Elements
const textForm = document.getElementById('text-form');
const textInput = document.getElementById('text-input');
const inputHint = document.getElementById('input-hint');
const submitBtn = document.getElementById('submit-btn');
const wordList = document.getElementById('word-list');
const wordSummary = document.getElementById('word-summary');

const connectionStatus = document.getElementById('connection-status');
const welcomeOverlay = document.getElementById('welcome-overlay');
const emptyCloudHint = document.getElementById('empty-cloud-hint');
const cloudCanvas = document.getElementById('word-cloud-canvas');
const demoBanner = document.getElementById('demo-banner');

// Admin verification modal
const adminModal = document.getElementById('admin-modal');
const adminForm = document.getElementById('admin-form');
const adminPassword = document.getElementById('admin-password');
const adminError = document.getElementById('admin-error');
const adminSubmit = document.getElementById('admin-submit');
const adminCancel = document.getElementById('admin-cancel');

// Generic confirmation dialog
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

const toastContainer = document.getElementById('toast-container');

// Theme Color Palettes for Word Cloud
const themeColors = [
  '#8b5cf6', // Violet
  '#a78bfa', // Light violet
  '#ec4899', // Pink
  '#f472b6', // Light pink
  '#06b6d4', // Cyan
  '#22d3ee', // Light cyan
  '#3b82f6', // Blue
  '#60a5fa'  // Light blue
];

// reCAPTCHA v3 site key for App Check. This is the public key — the matching
// secret key belongs only in the Firebase console, never in this repo.
const RECAPTCHA_SITE_KEY = '6LfHM2UtAAAAAFg3pFgvRtMiUXNfLvWC1ny3C0bj';

// 只在正式網域啟用。本機以 file:// 或 localhost 開啟時 reCAPTCHA 換不到有效 token，
// 跳過初始化才不會擋住開發。此處必須與 reCAPTCHA 主控台註冊的網域一致；
// 日後若換網域（例如自訂網域），這裡與 reCAPTCHA 設定要同步更新，否則正式站會拿不到 token。
const APP_CHECK_HOSTS = ['changyiwu.github.io'];

// 本機開發時 Firebase 完全連不上（API key 的 referrer 限制擋掉 localhost），
// 所以改跑純前端的離線示範模式，讓 UI 調整不必每次都推上線才看得到。
// 正式網域不在這份清單裡，線上行為完全不受影響。
const DEMO_HOSTS = ['localhost', '127.0.0.1', ''];
const DEMO_MODE = DEMO_HOSTS.includes(location.hostname);
const DEMO_UID = 'demo-me';
const DEMO_OTHER_UID = 'demo-other';
const DEMO_ADMIN_PASSWORD = 'demo';

const defaultConfig = {
  projectId: "word-cloud-c0bfe",
  appId: "1:728868598304:web:889ed446abe3ec7a178245",
  storageBucket: "word-cloud-c0bfe.firebasestorage.app",
  apiKey: "AIzaSyBSOlD-jYf8xDMbwEtbWEvpRiMd95CAS9I",
  authDomain: "word-cloud-c0bfe.firebaseapp.com",
  messagingSenderId: "728868598304"
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  adjustCanvasSize();
  window.addEventListener('resize', debounce(adjustCanvasSize, 150));
  updateInputHint();

  if (DEMO_MODE) {
    initDemoMode();
    return;
  }

  // Initialize with defaultConfig
  initFirebase(defaultConfig);
});

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Toast notifications, so the polished UI never has to fall back to alert()
function showToast(message, type = 'info', duration = 3600) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // prefers-reduced-motion disables the animation, so animationend never fires
    setTimeout(() => toast.remove(), 600);
  }, duration);
}

// ---------------------------------------------------------------------------
// Modal accessibility: Esc to dismiss, focus trap, focus restore
// ---------------------------------------------------------------------------

let activeModal = null;

function getFocusable(root) {
  const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(selector));
}

function openModal(overlay, initialFocus, onDismiss) {
  activeModal = { overlay, previousFocus: document.activeElement, onDismiss };
  overlay.classList.remove('hidden');
  const target = initialFocus || getFocusable(overlay)[0];
  if (target) target.focus();
}

function closeModal() {
  if (!activeModal) return;
  const { overlay, previousFocus } = activeModal;
  activeModal = null;
  overlay.classList.add('hidden');
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
}

document.addEventListener('keydown', (e) => {
  if (!activeModal) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    activeModal.onDismiss();
    return;
  }

  if (e.key !== 'Tab') return;

  // Keep keyboard focus inside the dialog
  const items = getFocusable(activeModal.overlay);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

// Promise-based replacement for window.confirm, styled like the rest of the app
function askConfirm({ title, message, confirmText = '確定' }) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOk.querySelector('span').textContent = confirmText;

    const settle = (result) => {
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onBackdrop);
      closeModal();
      resolve(result);
    };
    const onOk = () => settle(true);
    const onCancel = () => settle(false);
    const onBackdrop = (e) => {
      if (e.target === confirmModal) settle(false);
    };

    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdrop);

    openModal(confirmModal, confirmCancel, onCancel);
  });
}

// ---------------------------------------------------------------------------
// Canvas & word cloud rendering
// ---------------------------------------------------------------------------

// Resize canvas for high DPI displays
function adjustCanvasSize() {
  const container = cloudCanvas.parentElement;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  cloudCanvas.width = rect.width * dpr;
  cloudCanvas.height = rect.height * dpr;
  cloudCanvas.style.width = `${rect.width}px`;
  cloudCanvas.style.height = `${rect.height}px`;

  if (currentList.length > 0) {
    renderWordCloud();
  }
}

// Show/Hide setup overlay
function showOverlay(show) {
  if (show) {
    welcomeOverlay.classList.remove('hidden');
  } else {
    welcomeOverlay.classList.add('hidden');
  }
  updateEmptyHint();
}

// The "還沒有任何字詞" hint only makes sense once data has actually arrived —
// before that the connection overlay is the right thing to show.
function updateEmptyHint() {
  const show = dataReady && currentList.length === 0;
  emptyCloudHint.classList.toggle('hidden', !show);
}

// Update connection status UI
function updateConnectionStatus(connected, message = '') {
  if (connected) {
    connectionStatus.classList.remove('offline');
    connectionStatus.classList.add('online');
    connectionStatus.querySelector('.status-text').textContent = message || '已安全連線';
  } else {
    connectionStatus.classList.remove('online');
    connectionStatus.classList.add('offline');
    connectionStatus.querySelector('.status-text').textContent = message || '未連接 Firebase';
  }
}

// Same word always gets the same colour, otherwise every sync would reshuffle
// the whole canvas and make the cloud flicker while a class is using it.
function colorForWord(word) {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
  }
  return themeColors[hash % themeColors.length];
}

// Render Word Cloud using WordCloud2.js
function renderWordCloud() {
  const ctx = cloudCanvas.getContext('2d');
  ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);

  if (currentList.length === 0) {
    return;
  }

  // Calculate relative scaling factor based on max frequency
  const maxFreq = currentList[0][1];
  const dpr = window.devicePixelRatio || 1;
  const baseWeight = Math.min(cloudCanvas.width, cloudCanvas.height) / 12;

  WordCloud(cloudCanvas, {
    list: currentList,
    gridSize: Math.round(16 * dpr),
    weightFactor: function (size) {
      if (maxFreq <= 1) {
        return Math.max(16 * dpr, baseWeight * dpr);
      }
      const logMax = Math.log2(maxFreq);
      const factor = logMax > 0 ? (Math.log2(size) / logMax) : 1;
      // Logarithmic scaling for better visualization of frequency disparity
      return Math.max(12 * dpr, factor * baseWeight * dpr);
    },
    fontFamily: '"Outfit", "Noto Sans TC", sans-serif',
    color: function (word) {
      return colorForWord(word);
    },
    // Without this WordCloud2 shuffles the list on every draw, so unchanged
    // words would jump to a different spot each time someone adds a word
    shuffle: false,
    rotateRatio: 0.3,
    rotationSteps: 2,
    backgroundColor: 'transparent',
    minSize: 10 * dpr,
    drawOutOfBound: false
  });
}

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

// Initialize Firebase & Anonymous Auth
async function initFirebase(config) {
  try {
    detachWordsListener();

    firebaseApp = initializeApp(config);

    // Must run before any Firebase service is touched, otherwise the first
    // requests go out without an App Check token
    setupAppCheck(firebaseApp);

    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);

    updateConnectionStatus(false, '連線安全驗證中...');

    await signInAsAnonymousUser();
    attachWordsListener();

  } catch (error) {
    console.error('Firebase Auth/Init error:', error);
    updateConnectionStatus(false, '驗證失敗，請啟用匿名登入');
    showOverlay(true);
  }
}

// Attest that requests really originate from this site. Skipped when the site key is
// unset or when running outside the registered hosts, so local development still works.
function setupAppCheck(app) {
  if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === 'REPLACE_WITH_SITE_KEY') {
    console.warn('App Check 未啟用：RECAPTCHA_SITE_KEY 尚未填入。');
    return;
  }

  if (!APP_CHECK_HOSTS.includes(location.hostname)) {
    console.warn(`App Check 未啟用：${location.hostname || 'file://'} 不在 APP_CHECK_HOSTS 清單中（本機開發為正常現象）。`);
    return;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
  console.log('App Check enabled.');
}

// Sign in anonymously and remember the resulting UID
async function signInAsAnonymousUser() {
  const userCredential = await signInAnonymously(auth);
  myUid = userCredential.user.uid;
  console.log('Firebase Anonymous Auth Success. UID:', myUid);
}

function detachWordsListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

// Setup real-time listener for Firestore words collection
function attachWordsListener() {
  detachWordsListener();

  const wordsCollection = collection(db, 'words');
  unsubscribe = onSnapshot(wordsCollection, (snapshot) => {
    const docs = [];
    snapshot.forEach(docSnap => docs.push(docSnap.data()));

    applyWordDocs(docs);
    updateConnectionStatus(true, '同步中 (安全連線)');
    showOverlay(false);
  }, (error) => {
    console.error('Firestore connection error:', error);
    updateConnectionStatus(false, '資料庫存取被拒');
    showOverlay(true);
  });
}

// Shared by the Firestore listener and the offline demo store
function applyWordDocs(docs) {
  const mergedMap = {};
  currentUserWords.clear();

  docs.forEach((data) => {
    if (data.text && data.count) {
      mergedMap[data.text] = (mergedMap[data.text] || 0) + data.count;

      // Track which words belong to the current user
      if (data.uid === myUid) {
        currentUserWords.add(data.text);
      }
    }
  });

  // Convert merged map to a list sorted by frequency descending
  const list = Object.entries(mergedMap);
  list.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
  currentList = list;
  dataReady = true;

  updateRankingUI(list);
  renderWordCloud();
  updateEmptyHint();
}

// ---------------------------------------------------------------------------
// Offline demo store (localhost only)
// ---------------------------------------------------------------------------

// key -> { text, count, uid }, mirroring the shape of a Firestore `words` document
const demoDocs = new Map();

function initDemoMode() {
  myUid = DEMO_UID;

  const seed = [
    ['創意', 9, DEMO_OTHER_UID],
    ['合作', 7, DEMO_OTHER_UID],
    ['表達', 5, DEMO_OTHER_UID],
    ['觀察', 4, DEMO_UID],
    ['提問', 3, DEMO_OTHER_UID],
    ['實驗', 3, DEMO_UID],
    ['耐心', 2, DEMO_OTHER_UID],
    ['分享', 2, DEMO_UID],
    ['專注', 1, DEMO_OTHER_UID],
    ['勇氣', 1, DEMO_UID]
  ];
  seed.forEach(([text, count, uid]) => {
    demoDocs.set(`${uid}_${text}`, { text, count, uid });
  });

  demoBanner.classList.remove('hidden');
  updateConnectionStatus(true, '離線示範模式（假資料）');
  showOverlay(false);
  demoEmit();

  console.info(`離線示範模式已啟用（${location.hostname || 'file://'}）。管理密碼為「${DEMO_ADMIN_PASSWORD}」，資料只存在這個分頁裡。`);
}

function demoEmit() {
  applyWordDocs(Array.from(demoDocs.values()));
}

function demoAddWords(freqMap) {
  for (const [word, count] of Object.entries(freqMap)) {
    const key = `${DEMO_UID}_${word}`;
    const existing = demoDocs.get(key);
    demoDocs.set(key, { text: word, count: (existing ? existing.count : 0) + count, uid: DEMO_UID });
  }
  demoEmit();
}

function demoDeleteWord(word) {
  demoDocs.delete(`${DEMO_UID}_${word}`);
  demoEmit();
}

function demoClearAll(password) {
  if (password !== DEMO_ADMIN_PASSWORD) {
    const error = new Error('密碼錯誤');
    error.code = 'permission-denied';
    throw error;
  }
  const deleted = demoDocs.size;
  demoDocs.clear();
  demoEmit();
  return deleted;
}

// ---------------------------------------------------------------------------
// Ranking list
// ---------------------------------------------------------------------------

const DELETE_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`;

// Update the ranking list and the summary chip in the card header
function updateRankingUI(list) {
  wordList.innerHTML = '';

  if (list.length === 0) {
    wordList.innerHTML = '<li class="empty-state">尚未有資料</li>';
    wordSummary.textContent = '尚無資料';
    return;
  }

  // 標題列在 380px 寬的側欄裡，摘要太長會換行、把清單可視高度吃掉
  const totalCount = list.reduce((sum, [, count]) => sum + count, 0);
  wordSummary.textContent = `${list.length} 詞 / ${totalCount} 次`;

  const fragment = document.createDocumentFragment();
  list.forEach(([text, count], index) => {
    const li = document.createElement('li');
    if (index < 3) li.classList.add('top-rank');

    const escapedText = escapeHtml(text);
    const hasDeleteBtn = currentUserWords.has(text);

    li.innerHTML = `
      <div class="rank-label">
        <span class="rank-index">${index + 1}</span>
        <span class="rank-word">${escapedText}</span>
      </div>
      <div class="rank-action-wrapper">
        <span class="rank-count">${count} 次</span>
        ${hasDeleteBtn ? `
        <button class="delete-btn" data-word="${escapedText}" title="刪除「${escapedText}」" aria-label="刪除字詞 ${escapedText}">
          ${DELETE_ICON_SVG}
        </button>
        ` : ''}
      </div>
    `;
    fragment.appendChild(li);
  });
  wordList.appendChild(fragment);
}

// ---------------------------------------------------------------------------
// Text parsing
// ---------------------------------------------------------------------------

// Common sensitive/inappropriate words for filtration (can be easily customized)
const SENSITIVE_WORDS = new Set([
  '幹', '操', '靠', '機車', '垃圾', '白痴', '智障', '賤', '混蛋',
  'fuck', 'shit', 'bitch', 'asshole'
]);

// Keep in sync with the text length limit in firestore.rules
const MAX_WORD_LENGTH = 100;

// Parse text into a word frequency map, reporting what got dropped so the UI
// can tell the user instead of silently swallowing their input
function parseText(text) {
  const cleanText = text.replace(/[\s,，.。!！?？;；:：()（）"'"“‘’”\[\]{}【】、\-—]+/g, ' ');
  const tokens = cleanText.split(' ');
  const freqMap = {};
  const blocked = new Set();
  const tooLong = new Set();

  tokens.forEach(token => {
    const word = token.trim();
    if (!word) return;

    const isCN = isChinese(word);
    const minLength = isCN ? 1 : 2; // Allow single character words for Chinese
    if (word.length < minLength) return;

    // Normalize to lowercase for English
    const key = isCN ? word : word.toLowerCase();

    // Overlong tokens are rejected by firestore.rules, so drop them here for a cleaner error path
    if (word.length > MAX_WORD_LENGTH) {
      tooLong.add(key);
      return;
    }

    // Filter out sensitive/inappropriate words
    if (SENSITIVE_WORDS.has(key)) {
      blocked.add(key);
      return;
    }

    freqMap[key] = (freqMap[key] || 0) + 1;
  });

  return { freqMap, blockedCount: blocked.size, tooLongCount: tooLong.size };
}

function isChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str);
}

function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function (s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
}

// Live feedback while typing: how many words will be added, and what will be dropped
function updateInputHint() {
  const text = textInput.value;

  if (!text.trim()) {
    inputHint.textContent = `用空白、逗號或標點分隔；單一字詞最多 ${MAX_WORD_LENGTH} 字。`;
    inputHint.classList.remove('warn');
    return;
  }

  const { freqMap, blockedCount, tooLongCount } = parseText(text);
  const wordCount = Object.keys(freqMap).length;
  const notes = [];

  if (blockedCount > 0) notes.push(`${blockedCount} 個不雅字詞會被過濾`);
  if (tooLongCount > 0) notes.push(`${tooLongCount} 個超過 ${MAX_WORD_LENGTH} 字會被略過`);

  inputHint.textContent = notes.length > 0
    ? `將新增 ${wordCount} 個字詞（${notes.join('、')}）`
    : `將新增 ${wordCount} 個字詞`;
  inputHint.classList.toggle('warn', notes.length > 0);
}

textInput.addEventListener('input', debounce(updateInputHint, 200));

// ---------------------------------------------------------------------------
// Actions: add / delete / bulk delete
// ---------------------------------------------------------------------------

function isReady() {
  return DEMO_MODE || !!(db && auth && auth.currentUser);
}

function setSubmitBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.querySelector('span').textContent = busy ? '送出中...' : '送出並更新文字雲';
}

// Text form submission (Insert to Firestore)
textForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (submitBtn.disabled) return;

  if (!isReady()) {
    showToast('資料庫連線尚未建立或驗證失敗，無法送出。', 'error');
    return;
  }

  const text = textInput.value;
  if (!text.trim()) return;

  const { freqMap, blockedCount, tooLongCount } = parseText(text);
  if (Object.keys(freqMap).length === 0) {
    if (blockedCount > 0) {
      showToast('輸入的字詞都被不雅字詞過濾擋下了，請換個說法。', 'warn');
    } else {
      showToast('未偵測到有效長度字詞，請輸入更多內容。', 'warn');
    }
    return;
  }

  setSubmitBusy(true);
  try {
    if (DEMO_MODE) {
      demoAddWords(freqMap);
    } else {
      const batch = writeBatch(db);
      for (const [word, count] of Object.entries(freqMap)) {
        const docRef = doc(collection(db, 'words'), `${myUid}_${word}`);
        batch.set(docRef, {
          text: word,
          count: increment(count),
          timestamp: serverTimestamp(),
          uid: myUid
        }, { merge: true });
      }
      await batch.commit();
    }

    // Only clear on success, so a failed write never loses what the user typed
    textInput.value = '';
    updateInputHint();

    const added = Object.keys(freqMap).length;
    const notes = [];
    if (blockedCount > 0) notes.push(`${blockedCount} 個不雅字詞已過濾`);
    if (tooLongCount > 0) notes.push(`${tooLongCount} 個超過 ${MAX_WORD_LENGTH} 字已略過`);

    showToast(
      notes.length > 0 ? `已新增 ${added} 個字詞（${notes.join('、')}）` : `已新增 ${added} 個字詞`,
      notes.length > 0 ? 'warn' : 'success'
    );
  } catch (error) {
    console.error('Failed to commit batch write:', error);
    showToast('寫入資料庫失敗，請確認安全規則：' + error.message, 'error', 6000);
  } finally {
    setSubmitBusy(false);
  }
});

// Delete individual word from Firestore
wordList.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.delete-btn');
  if (!deleteBtn || deleteBtn.disabled) return;

  const word = deleteBtn.getAttribute('data-word');
  if (!word) return;

  if (!isReady()) {
    showToast('資料庫連線尚未建立，無法刪除。', 'error');
    return;
  }

  const confirmed = await askConfirm({
    title: '刪除字詞',
    message: `確定要刪除「${word}」嗎？這會移除你為這個字詞累計的所有次數。`,
    confirmText: '刪除'
  });
  if (!confirmed) return;

  try {
    if (DEMO_MODE) {
      demoDeleteWord(word);
    } else {
      const docRef = doc(db, 'words', `${myUid}_${word}`);
      await deleteDoc(docRef);
    }
    showToast(`已刪除「${word}」`, 'success');
  } catch (error) {
    console.error('Failed to delete word:', error);
    showToast('刪除失敗：' + error.message, 'error', 6000);
  }
});

// Bulk delete all words. Only the SHA-256 hash of the admin password leaves the
// browser; firestore.rules compares it against config/admin, which the client cannot read.
const clearAllBtn = document.getElementById('clear-all-btn');

function showAdminModal(show) {
  if (show) {
    adminError.classList.add('hidden');
    adminError.textContent = '';
    adminPassword.value = '';
    openModal(adminModal, adminPassword, dismissAdminModal);
  } else {
    closeModal();
    // Never keep the credential in the DOM after the dialog closes
    adminPassword.value = '';
  }
}

function dismissAdminModal() {
  // A delete in flight must not be interrupted
  if (adminSubmit.disabled) return;
  showAdminModal(false);
}

function setAdminBusy(busy) {
  adminSubmit.disabled = busy;
  adminCancel.disabled = busy;
  adminSubmit.querySelector('span').textContent = busy ? '清除中...' : '確認刪除全部';
}

clearAllBtn.addEventListener('click', () => {
  if (!isReady()) {
    showToast('資料庫連線尚未建立或驗證失敗，無法操作。', 'error');
    return;
  }
  showAdminModal(true);
});

adminCancel.addEventListener('click', dismissAdminModal);

adminModal.addEventListener('click', (e) => {
  // Click on the backdrop closes the dialog, unless a delete is in flight
  if (e.target === adminModal) dismissAdminModal();
});

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = adminPassword.value.trim();
  if (!password) return;

  adminError.classList.add('hidden');
  setAdminBusy(true);

  try {
    const deleted = DEMO_MODE
      ? demoClearAll(password)
      : await runAdminBulkDelete(password);

    setAdminBusy(false);
    showAdminModal(false);
    showToast(
      deleted === 0 ? '資料庫中目前無任何字詞資料。' : `已清除 ${deleted} 筆字詞資料`,
      'success'
    );
  } catch (error) {
    console.error('Failed to clear database:', error);
    setAdminBusy(false);
    adminError.textContent = describeAdminError(error);
    adminError.classList.remove('hidden');
    adminPassword.value = '';
    adminPassword.focus();
  }
});

async function runAdminBulkDelete(password) {
  const tempAuthRef = doc(db, 'admin_auth', myUid);

  try {
    // Only the hash is written; the plaintext never leaves the browser and the
    // database never stores it either
    await setDoc(tempAuthRef, { passwordHash: await sha256Hex(password) });

    let deleted = 0;

    // Delete in chunks: a Firestore batch accepts at most BATCH_LIMIT operations
    while (true) {
      const snapshot = await getDocs(query(collection(db, 'words'), limit(BATCH_LIMIT)));
      if (snapshot.empty) break;

      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();

      deleted += snapshot.size;
      if (snapshot.size < BATCH_LIMIT) break;
    }

    return deleted;
  } finally {
    // Drop the temporary credential no matter what happened
    try {
      await deleteDoc(tempAuthRef);
    } catch (cleanupError) {
      console.error('Error cleaning up temp auth document: ', cleanupError);
    }
  }
}

// SHA-256 hex digest; crypto.subtle is only available in a secure context (HTTPS or localhost)
async function sha256Hex(text) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('目前不是安全連線環境（需要 HTTPS），無法計算密碼雜湊');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function describeAdminError(error) {
  if (error && error.code === 'permission-denied') {
    return '密碼錯誤。';
  }
  return '清除失敗：' + (error && error.message ? error.message : '未知錯誤');
}
