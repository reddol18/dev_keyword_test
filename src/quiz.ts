import type { Question, QuizMode, Word } from './types';
import { isChoiceMode } from './types';
import { buildChoices } from './choices';
import { shuffle } from './grading';

/** 오늘 이만큼 맞힌 단어부터 덜 나오게 한다 */
const MASTERED_AT = 2;
/** 그 단어가 뽑힐 상대 확률. 1/4 — 빼지는 않되 확실히 덜 나온다. */
const MASTERED_WEIGHT = 0.25;

/**
 * 가중치를 반영해 count개를 중복 없이 뽑는다.
 *
 * 오늘 여러 번 맞힌 단어는 가중치가 낮아 덜 뽑히지만 0은 아니다.
 * 뽑을 수 있는 수가 count보다 적으면 있는 만큼만 돌려준다.
 */
function weightedPick(
  pool: Word[],
  count: number,
  correctToday: Record<string, number>,
): Word[] {
  const rest = pool.map((w) => ({
    w,
    weight: (correctToday[w.word] ?? 0) >= MASTERED_AT ? MASTERED_WEIGHT : 1,
  }));
  const out: Word[] = [];
  const n = Math.min(count, rest.length);

  for (let k = 0; k < n; k++) {
    const total = rest.reduce((s, r) => s + r.weight, 0);
    let t = Math.random() * total;
    let idx = rest.length - 1;          // 부동소수 오차로 끝까지 못 가는 경우 대비
    for (let i = 0; i < rest.length; i++) {
      t -= rest[i].weight;
      if (t <= 0) { idx = i; break; }
    }
    out.push(rest[idx].w);
    rest.splice(idx, 1);                // 같은 단어가 두 번 나오지 않게 뺀다
  }
  return out;
}

/**
 * 출제할 문제 목록을 만든다.
 *
 * modes 가 여러 개면 문제마다 번갈아 섞는다. 한 방식으로만 계속 나오면
 * 답하는 요령이 생겨서 실제로 외웠는지 확인이 안 된다.
 *
 * correctToday 를 주면 오늘 2번 이상 맞힌 단어의 출제 확률을 1/4로 낮춘다.
 * 안 주면 기존대로 고르게 섞는다.
 */
export function buildQuiz(
  pool: Word[],
  modes: QuizMode[],
  count: number,
  correctToday: Record<string, number> = {},
): Question[] {
  if (pool.length === 0 || modes.length === 0) return [];

  const picked = weightedPick(pool, count, correctToday);
  const modeBag = shuffle(modes);

  return picked.map((word, i) => {
    const mode = modeBag[i % modeBag.length];
    const prompt =
      mode === 'type-meaning-to-term' || mode === 'choice-meaning-to-term'
        ? word.meanings[0]
        : word.word;

    if (!isChoiceMode(mode)) {
      return { word, mode, prompt };
    }
    const { choices, answerIndex } = buildChoices(word, pool, mode);
    return { word, mode, prompt, choices, answerIndex };
  });
}

/** 지문 위에 붙일 짧은 안내 — 무엇을 답해야 하는지 */
export function hintOf(mode: QuizMode): string {
  switch (mode) {
    case 'type-term-to-meaning':
      return '뜻을 입력하세요';
    case 'type-meaning-to-term':
      return '용어를 입력하세요';
    case 'choice-term-to-meaning':
      return '알맞은 뜻을 고르세요';
    case 'choice-meaning-to-term':
      return '알맞은 용어를 고르세요';
  }
}
