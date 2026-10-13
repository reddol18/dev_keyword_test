import type { QuizMode, Word } from './types';
import { normalize, normalizeTerm, shuffle } from './grading';

const CHOICE_COUNT = 4;   // 정답 1 + 오답 3

/**
 * 오답 보기를 고른다.
 *
 * 우선순위 (총괄 지시):
 *   ① confusable — 일부러 정리해 둔 헷갈리는 용어
 *   ② 같은 분야 + 뜻이 비슷한 것
 *   ③ 같은 레벨
 *   ④ 그래도 모자라면 아무거나
 *
 * ②의 "뜻 유사도"는 임베딩 대신 글자 기반으로 잰다. 이유:
 * 문제마다 모델을 돌리면 보기 하나 만드는 데 수십 ms가 붙고,
 * 207개 전체를 미리 계산해 캐시하면 앱 시작이 느려진다.
 * 보기 선정은 "그럴듯하면" 되는 일이라 정밀도가 덜 중요하다.
 * 채점은 지금도 모델이 한다 — 거기는 정확도가 중요하니까.
 */

/** 두 문자열의 글자 단위 자카드 유사도 (0~1) */
function charSimilarity(a: string, b: string): number {
  const sa = new Set(normalize(a).replace(/\s/g, ''));
  const sb = new Set(normalize(b).replace(/\s/g, ''));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const ch of sa) if (sb.has(ch)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** 약어처럼 보이는가 — 대문자·숫자로만 이뤄진 짧은 말 */
function looksLikeAbbrev(term: string): boolean {
  return /^[A-Z0-9][A-Z0-9./-]{1,7}$/.test(term.trim());
}

/**
 * 이 후보를 오답으로 써도 되는가.
 *
 * 정답과 사실상 같은 말이면 안 된다. 보기가 둘 다 맞아 버리면
 * 문제 자체가 깨진다. answer 의 near·aliases·meanings 에 든 표현,
 * 그리고 정답 문자열과 표기만 다른 것을 전부 막는다.
 */
function isSafeDistractor(
  candidateText: string,
  answer: Word,
  mode: QuizMode,
): boolean {
  const term = mode === 'choice-meaning-to-term';
  const norm = term ? normalizeTerm : normalize;
  const c = norm(candidateText);
  if (!c) return false;

  const banned = [
    ...(answer.aliases ?? []),
    ...(answer.near ?? []),
    ...answer.meanings,
    answer.word,
  ];
  return !banned.some((b) => norm(b) === c);
}

/** 후보 Word 에서 보기로 쓸 문자열을 꺼낸다 */
function textOf(w: Word, mode: QuizMode): string {
  return mode === 'choice-meaning-to-term' ? w.word : w.meanings[0];
}

/**
 * 객관식 보기를 만든다. 정답 1개 + 오답 3개를 섞어 돌려준다.
 * 오답이 3개까지 안 모이면 모인 만큼만 쓴다 (보기 수가 줄 뿐 문제는 성립한다).
 */
export function buildChoices(
  answer: Word,
  pool: Word[],
  mode: QuizMode,
): { choices: string[]; answerIndex: number } {
  const answerText = textOf(answer, mode);
  const picked: string[] = [];
  const seen = new Set<string>([
    mode === 'choice-meaning-to-term'
      ? normalizeTerm(answerText)
      : normalize(answerText),
  ]);
  const norm = mode === 'choice-meaning-to-term' ? normalizeTerm : normalize;

  const take = (text: string) => {
    const key = norm(text);
    if (seen.has(key)) return;
    if (!isSafeDistractor(text, answer, mode)) return;
    seen.add(key);
    picked.push(text);
  };

  const others = pool.filter((w) => w.word !== answer.word);

  // ① confusable — 이름으로 덱에서 실제 단어를 찾아 쓴다.
  //    덱에 없는 이름이면 그 문자열 자체를 보기로 쓴다 (뜻→용어 방향일 때만).
  for (const name of answer.confusable ?? []) {
    if (picked.length >= CHOICE_COUNT - 1) break;
    const found = others.find(
      (w) => normalizeTerm(w.word) === normalizeTerm(name),
    );
    if (found) take(textOf(found, mode));
    else if (mode === 'choice-meaning-to-term') take(name);
  }

  // ② 같은 분야에서 뜻이 비슷한 것
  if (picked.length < CHOICE_COUNT - 1) {
    const sameField = others
      .filter((w) => w.partOfSpeech === answer.partOfSpeech)
      .map((w) => ({
        w,
        score:
          charSimilarity(w.meanings[0], answer.meanings[0]) +
          // 뜻→용어 객관식은 보기 형태도 맞춘다. 약어 문제에 긴 단어가
          // 섞이면 정답이 눈에 띄어 문제가 쉬워진다.
          (mode === 'choice-meaning-to-term' &&
          looksLikeAbbrev(w.word) === looksLikeAbbrev(answer.word)
            ? 0.5
            : 0),
      }))
      .sort((a, b) => b.score - a.score);
    for (const { w } of sameField) {
      if (picked.length >= CHOICE_COUNT - 1) break;
      take(textOf(w, mode));
    }
  }

  // ③ 같은 레벨
  if (picked.length < CHOICE_COUNT - 1 && answer.level != null) {
    for (const w of shuffle(others.filter((x) => x.level === answer.level))) {
      if (picked.length >= CHOICE_COUNT - 1) break;
      take(textOf(w, mode));
    }
  }

  // ④ 마지막 수단
  if (picked.length < CHOICE_COUNT - 1) {
    for (const w of shuffle(others)) {
      if (picked.length >= CHOICE_COUNT - 1) break;
      take(textOf(w, mode));
    }
  }

  const choices = shuffle([answerText, ...picked]);
  return { choices, answerIndex: choices.indexOf(answerText) };
}
