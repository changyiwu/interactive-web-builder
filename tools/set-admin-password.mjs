#!/usr/bin/env node
/**
 * 產生管理密碼並輸出對應的 SHA-256 雜湊。
 *
 * 用法：
 *   node tools/set-admin-password.mjs             產生新的 24 字元隨機密碼
 *   node tools/set-admin-password.mjs "自訂密碼"    對既有密碼計算雜湊
 *
 * 安全規則只比對雜湊，Firestore 內不存明文。請把輸出的 passwordHash 貼到
 * config/admin，明文密碼存進密碼管理器 —— 不要 commit、不要貼進聊天視窗。
 */

import { randomBytes, createHash } from 'node:crypto';

// 排除容易看錯的 l / I / O / 0 / 1，共 57 個字元
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 24;

function generatePassword() {
  // 以拒絕取樣避免取模造成的分布偏差
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const out = [];

  while (out.length < LENGTH) {
    for (const byte of randomBytes(LENGTH * 2)) {
      if (byte >= limit) continue;
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === LENGTH) break;
    }
  }

  return out.join('');
}

const supplied = process.argv[2];
const password = supplied ? supplied.trim() : generatePassword();
const passwordHash = createHash('sha256').update(password, 'utf8').digest('hex');

console.log('');

if (!supplied) {
  console.log('新的管理密碼（請立刻存進密碼管理器，關掉視窗就找不回來）：');
  console.log(`  ${password}`);
  console.log('');
}

console.log('passwordHash：');
console.log(`  ${passwordHash}`);
console.log('');
console.log('設定步驟 — Firebase Console → Firestore Database → config → admin：');
console.log('  1. 新增字串欄位 passwordHash，值填入上面那串 64 位十六進位');
console.log('  2. 確認文件內沒有任何明文 password 欄位');
console.log('');
