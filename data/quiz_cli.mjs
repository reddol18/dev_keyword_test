#!/usr/bin/env node
/**
 * 터미널 단어 시험 — 앱 빌드 없이 바로 외울 때 쓴다.
 *
 *   node data/quiz_cli.mjs                     IT 용어, 전체, 10문제
 *   node data/quiz_cli.mjs --level 3           면접 우선만
 *   node data/quiz_cli.mjs --deck words        IT 문서 영단어
 *   node data/quiz_cli.mjs --field 보안 -n 20  분야 지정, 20문제
 *   node data/quiz_cli.mjs --mode m2t          뜻→용어만 (t2m / m2t / both)
 *
 * 앱과 같은 데이터를 쓰지만 채점은 규칙 기반이다.
 * 온디바이스 모델은 RN 전용이라 여기선 안 돈다.
 */
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const deckName = opt('--deck', 'terms');
const file = deckName === 'words' ? 'it_words.json' : 'it_terms.json';
const all = JSON.parse(readFileSync(join(HERE, file), 'utf8'));

const level = opt('--level', null);
const field = opt('--field', null);
const count = parseInt(opt('-n', opt('--count', '10')), 10);
const mode = opt('--mode', 'both');

let pool = all;
if (level) pool = pool.filter((w) => String(w.level) === String(level));
if (field) pool = pool.filter((w) => w.partOfSpeech.includes(field));

if (pool.length === 0) {
  console.log('조건에 맞는 단어가 없습니다.');
  console.log('  레벨:', [...new Set(all.map((w) => w.level))].sort().join(', '));
  console.log('  분야:', [...new Set(all.map((w) => w.partOfSpeech))].join(', '));
  process.exit(1);
}

const norm = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
const normTerm = (t) => t.trim().toLowerCase().replace(/[\s\-_/.]/g, '');

const ENDINGS = ['하였다','되었다','시키다','하다','되다','가다','오다','지다','이다','시다',
  '스럽다','롭다','답다','하는','되는','하던','되던','하기','되기','함','됨','기',
  '한','된','는','은','을','인','다'];
function stem(t) {
  const s = norm(t);
  if (!/[가-힣]/.test(s)) return s;
  for (const e of ENDINGS) {
    if (s.length > e.length && s.endsWith(e)) {
      const c = s.slice(0, -e.length);
      if (c.length >= 2) return c;
    }
  }
  return s;
}

/** 용어→뜻 채점 */
function gradeMeaning(input, w) {
  const a = norm(input);
  if (!a) return 'wrong';
  if (w.meanings.some((m) => norm(m) === a)) return 'correct';
  if (w.meanings.some((m) => stem(m) === stem(a))) return 'correct';
  const near = w.near ?? [];
  if (near.some((n) => norm(n) === a || stem(n) === stem(a))) return 'close';
  const as = stem(a);
  if (as.length >= 2 && w.meanings.some((m) => {
    const b = stem(m);
    return b.length >= 2 && (as.includes(b) || b.includes(as));
  })) return 'close';
  return 'wrong';
}

/** 뜻→용어 채점 */
function gradeTerm(input, w) {
  const a = normTerm(input);
  if (!a) return 'wrong';
  const acc = w.aliases ?? [w.word];
  if (acc.some((x) => normTerm(x) === a)) return 'correct';
  if (normTerm(w.word) === a) return 'correct';
  if ((w.confusable ?? []).some((c) => normTerm(c) === a)) return 'close';
  return 'wrong';
}

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', DIM = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';

console.log(`\n${B}${deckName === 'words' ? 'IT 문서 영단어' : 'IT 개발 용어'}${X}  ${picked.length}문제` +
  `${level ? `  레벨 ${level}` : ''}${field ? `  ${field}` : ''}\n`);

let score = 0;
const missed = [];

for (const [i, w] of picked.entries()) {
  const askTerm = mode === 'm2t' || (mode === 'both' && Math.random() < 0.5);
  const prompt = askTerm ? w.meanings[0] : w.word;
  const label = askTerm ? '용어' : '뜻';

  console.log(`${DIM}${i + 1}/${picked.length}  ${w.partOfSpeech}${w.level ? ` · L${w.level}` : ''}${X}`);
  console.log(`${B}${prompt}${X}`);
  const ans = await ask(`${label}> `);

  const g = askTerm ? gradeTerm(ans, w) : gradeMeaning(ans, w);
  if (g === 'correct') { score++; console.log(`${G}○ 정답${X}`); }
  else if (g === 'close') { console.log(`${Y}△ 비슷했어요 — 정확한 답은 아닙니다${X}`); missed.push({ w, ans, g }); }
  else { console.log(`${R}✗ 오답${X}`); missed.push({ w, ans, g }); }

  console.log(`   ${w.word}  ${DIM}${w.meanings.join(' · ')}${X}\n`);
}

console.log(`${B}결과  ${score}/${picked.length}${X}\n`);
if (missed.length) {
  console.log('틀린 것');
  for (const { w, ans, g } of missed) {
    const mark = g === 'close' ? `${Y}△${X}` : `${R}✗${X}`;
    console.log(`  ${mark} ${B}${w.word}${X}  ${DIM}내 답: ${ans || '(빈칸)'}${X}`);
    console.log(`     ${w.meanings.join(' · ')}`);
  }
  console.log('');
}
rl.close();
