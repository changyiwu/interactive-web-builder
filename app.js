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

// Firestore allows at most 500 operations per batch
const BATCH_LIMIT = 500;

// DOM Elements
const textForm = document.getElementById('text-form');
const textInput = document.getElementById('text-input');
const wordList = document.getElementById('word-list');

const connectionStatus = document.getElementById('connection-status');
const welcomeOverlay = document.getElementById('welcome-overlay');
const cloudCanvas = document.getElementById('word-cloud-canvas');

// Admin verification modal
const adminModal = document.getElementById('admin-modal');
const adminForm = document.getElementById('admin-form');
const adminPassword = document.getElementById('admin-password');
const adminError = document.getElementById('admin-error');
const adminSubmit = document.getElementById('admin-submit');
const adminCancel = document.getElementById('admin-cancel');

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
  window.addEventListener('resize', adjustCanvasSize);
  
  // Initialize with defaultConfig
  initFirebase(defaultConfig);
});

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

// Attest that requests really originate from this site. Skipped while the site key
// is unset, so the app keeps working before App Check is configured.
function setupAppCheck(app) {
  if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === 'REPLACE_WITH_SITE_KEY') {
    console.warn('App Check 未啟用：RECAPTCHA_SITE_KEY 尚未填入。');
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
    const mergedMap = {};
    currentUserWords.clear();

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.text && data.count) {
        mergedMap[data.text] = (mergedMap[data.text] || 0) + data.count;

        // Track which words belong to the current user
        if (data.uid === myUid) {
          currentUserWords.add(data.text);
        }
      }
    });

    // Convert merged map to list array
    const list = Object.entries(mergedMap);

    // Sort list by frequency descending
    list.sort((a, b) => b[1] - a[1]);
    currentList = list;

    updateRankingUI(list);
    renderWordCloud();
    updateConnectionStatus(true, '同步中 (安全連線)');
    showOverlay(false);
  }, (error) => {
    console.error('Firestore connection error:', error);
    updateConnectionStatus(false, '資料庫存取被拒');
    showOverlay(true);
  });
}

// Render Word Cloud using WordCloud2.js
function renderWordCloud() {
  if (currentList.length === 0) {
    // Clear canvas
    const ctx = cloudCanvas.getContext('2d');
    ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
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
    color: function () {
      return themeColors[Math.floor(Math.random() * themeColors.length)];
    },
    rotateRatio: 0.3,
    rotationSteps: 2,
    backgroundColor: 'transparent',
    minSize: 10 * dpr,
    drawOutOfBound: false
  });
}

// Update Top Words List in left panel
function updateRankingUI(list) {
  wordList.innerHTML = '';
  
  if (list.length === 0) {
    wordList.innerHTML = '<li class="empty-state">尚未有資料</li>';
    return;
  }
  
  // Display top 10 words
  const topWords = list.slice(0, 10);
  topWords.forEach(([text, count]) => {
    const li = document.createElement('li');
    const escapedText = escapeHtml(text);
    const hasDeleteBtn = currentUserWords.has(text);
    
    li.innerHTML = `
      <span class="rank-word">${escapedText}</span>
      <div class="rank-action-wrapper">
        <span class="rank-count">${count} 次</span>
        ${hasDeleteBtn ? `
        <button class="delete-btn" data-word="${escapedText}" title="刪除字詞">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
        ` : ''}
      </div>
    `;
    wordList.appendChild(li);
  });
}

// Common sensitive/inappropriate words for filtration (can be easily customized)
const SENSITIVE_WORDS = new Set([
  '幹', '操', '靠', '機車', '垃圾', '白痴', '智障', '賤', '混蛋',
  'fuck', 'shit', 'bitch', 'asshole'
]);

// Keep in sync with the text length limit in firestore.rules
const MAX_WORD_LENGTH = 100;

// Parse text into word frequency map
function parseText(text) {
  const cleanText = text.replace(/[\s,，.。!！?？;；:：()（）"'"“‘’”\[\]{}【】、\-—]+/g, ' ');
  const tokens = cleanText.split(' ');
  const freqMap = {};
  
  tokens.forEach(token => {
    const word = token.trim();
    const isCN = isChinese(word);
    const minLength = isCN ? 1 : 2; // Allow single character words for Chinese
    
    // Overlong tokens are rejected by firestore.rules, so drop them here for a cleaner error path
    if (word.length >= minLength && word.length <= MAX_WORD_LENGTH) {
      // Normalize to lowercase for English
      const key = isCN ? word : word.toLowerCase();
      
      // Filter out sensitive/inappropriate words
      if (SENSITIVE_WORDS.has(key)) {
        return;
      }
      
      freqMap[key] = (freqMap[key] || 0) + 1;
    }
  });
  
  return freqMap;
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

// Text form submission (Insert to Firestore)
textForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!db || !auth || !auth.currentUser) {
    alert('資料庫連線尚未建立或驗證失敗，無法送出！');
    return;
  }
  
  const text = textInput.value;
  if (!text.trim()) return;
  
  const freqMap = parseText(text);
  if (Object.keys(freqMap).length === 0) {
    alert('未偵測到有效長度字詞，請輸入更多內容。');
    return;
  }
  
  try {
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
    
    textInput.value = '';
    await batch.commit();
  } catch (error) {
    console.error('Failed to commit batch write:', error);
    alert('寫入資料庫失敗，請確認安全規則：' + error.message);
  }
});

// Delete individual word from Firestore
wordList.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.delete-btn');
  if (!deleteBtn) return;
  
  const word = deleteBtn.getAttribute('data-word');
  if (!word) return;
  
  if (!db || !auth || !auth.currentUser) {
    alert('資料庫連線尚未建立，無法刪除！');
    return;
  }
  
  if (!confirm(`您確定要刪除「${word}」這個字詞嗎？`)) {
    return;
  }
  
  try {
    const docRef = doc(db, 'words', `${myUid}_${word}`);
    await deleteDoc(docRef);
    console.log(`Successfully deleted word: ${word}`);
  } catch (error) {
    console.error('Failed to delete word:', error);
    alert('刪除失敗：' + error.message);
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
    adminModal.classList.remove('hidden');
    adminPassword.focus();
  } else {
    adminModal.classList.add('hidden');
    // Never keep the credential in the DOM after the dialog closes
    adminPassword.value = '';
  }
}

function setAdminBusy(busy) {
  adminSubmit.disabled = busy;
  adminCancel.disabled = busy;
  adminSubmit.querySelector('span').textContent = busy ? '清除中...' : '確認刪除全部';
}

clearAllBtn.addEventListener('click', () => {
  if (!db || !auth || !auth.currentUser) {
    alert('資料庫連線尚未建立或驗證失敗，無法操作！');
    return;
  }
  showAdminModal(true);
});

adminCancel.addEventListener('click', () => showAdminModal(false));

adminModal.addEventListener('click', (e) => {
  // Click on the backdrop closes the dialog, unless a delete is in flight
  if (e.target === adminModal && !adminSubmit.disabled) {
    showAdminModal(false);
  }
});

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = adminPassword.value.trim();
  if (!password) return;

  adminError.classList.add('hidden');
  setAdminBusy(true);

  try {
    const deleted = await runAdminBulkDelete(password);
    showAdminModal(false);
    alert(deleted === 0 ? '資料庫中目前無任何字詞資料。' : `已清除 ${deleted} 筆字詞資料！`);
  } catch (error) {
    console.error('Failed to clear database:', error);
    adminError.textContent = describeAdminError(error);
    adminError.classList.remove('hidden');
    adminPassword.value = '';
    adminPassword.focus();
  } finally {
    setAdminBusy(false);
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

