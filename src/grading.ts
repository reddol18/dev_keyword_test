import type { Grade, QuizMode, Word } from './types';
import { isModelReady, maxSimilarity } from './embedding';

/**
 * 유사도 임계값 — 실측으로 정했다.
 *
 * 모델(ko-sroberta)은 활용형에 강하다:
 *   조심스럽게 ↔ 조심스러운  0.92
 *   여행가다   ↔ 여행하다    0.88
 * 반면 반의어를 잘 구분하지 못한다:
 *   기억하다 ↔ 잊다  0.65   (반대말인데 높다)
 *   빌려주다 ↔ 빌리다 0.70
 * 그래서 CORRECT를 0.85로 높게 잡아 활용형만 통과시키고,
 * 0.70~0.85는 판단을 보류해 "비슷했어요"로 돌린다.
 */
const SIM_CORRECT = 0.85;
const SIM_CLOSE = 0.70;

/**
 * 채점용 기본 정규화.
 * - 앞뒤 공백 제거 / 내부 연속 공백을 하나로
 * - 영문은 소문자로 (키보드 자동 대문자 입력 방지)
 */
export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 한국어 어미를 떼어 어간만 남긴다.
 *   여행하다 / 여행가다 / 여행 → 모두 "여행"
 *
 * 긴 어미부터 검사한다. "-하다"를 "-다"보다 먼저 떼지 않으면
 * "여행하다" → "여행하"가 되어 "여행"과 어긋난다.
 */
const ENDINGS = [
  '하였다', '되었다', '시키다',
  '하다', '되다', '가다', '오다', '지다', '이다', '시다',
  '스럽다', '롭다', '답다',
  '하는', '되는', '하던', '되던',
  '하기', '되기', '함', '됨', '기',
  '한', '된', '는', '은', '을', '인',
  '다',
];

export function stem(text: string): string {
  const s = normalize(text);
  if (!/[가-힣]/.test(s)) return s;   // 한글이 없으면 대상 아님

  for (const ending of ENDINGS) {
    if (s.length > ending.length && s.endsWith(ending)) {
      const cut = s.slice(0, -ending.length);
      if (cut.length >= 2) return cut;   // 너무 짧게 깎이면 원본 유지
    }
  }
  return s;
}

/** 정답 판정: 정확 일치 또는 어간 일치 */
function isExact(answer: string, word: Word): boolean {
  if (word.meanings.some((m) => normalize(m) === answer)) return true;
  const answerStem = stem(answer);
  return word.meanings.some((m) => stem(m) === answerStem);
}

/**
 * "비슷하다" 판정.
 *
 * 지금은 규칙 기반이다. 나중에 온디바이스 임베딩 모델을 붙이면
 * 이 함수만 교체하면 된다 — 호출부는 바뀌지 않는다.
 *
 * 1) 데이터에 명시된 유의어 (near 필드)
 * 2) 어간이 서로를 포함하는 경우 ("놓다" ↔ "내려놓다")
 */
function isClose(answer: string, word: Word): boolean {
  const near = (word as Word & { near?: string[] }).near ?? [];
  if (near.some((n) => normalize(n) === answer || stem(n) === stem(answer))) {
    return true;
  }

  const a = stem(answer);
  if (a.length < 2) return false;
  return word.meanings.some((m) => {
    const b = stem(m);
    if (b.length < 2) return false;
    return a.includes(b) || b.includes(a);
  });
}

/**
 * 3단계 채점 (규칙 기반).
 * 모델이 준비되기 전이나 추론 실패 시 쓰인다.
 */
export function grade(input: string, word: Word): Grade {
  const answer = normalize(input);
  if (!answer) return 'wrong';
  if (isExact(answer, word)) return 'correct';
  if (isClose(answer, word)) return 'close';
  return 'wrong';
}

/**
 * 3단계 채점 (모델 포함).
 *
 * 순서가 중요하다:
 *  1) 어간 일치 → 정답. 모델보다 확실하다.
 *     ("연습하다"↔"연습"은 모델이 0.45로 떨어뜨리지만 같은 말이다)
 *  2) near 목록 → 비슷함. 데이터로 명시한 것이라 신뢰한다.
 *     ("위치하다"↔"두다"는 모델이 0.33이지만 유의어다)
 *  3) 위에서 안 걸리면 모델 유사도로 판정한다.
 *     여기서 모델이 잡는 건 주로 우리가 예상 못 한 활용형이다.
 */
export async function gradeAsync(input: string, word: Word): Promise<Grade> {
  const answer = normalize(input);
  if (!answer) return 'wrong';

  if (isExact(answer, word)) return 'correct';
  if (isClose(answer, word)) return 'close';
  if (!isModelReady()) return 'wrong';

  try {
    const sim = await maxSimilarity(answer, word.meanings);
    if (sim >= SIM_CORRECT) return 'correct';
    if (sim >= SIM_CLOSE) return 'close';
    return 'wrong';
  } catch {
    return 'wrong';   // 추론 실패 시 규칙 기반 결과를 따른다
  }
}

/** 기존 호출부 호환용 — 정답일 때만 true */
export function isCorrect(input: string, word: Word): boolean {
  return grade(input, word) === 'correct';
}

/* ────────────────────────────────────────────────────────────────
 * 뜻 → 용어 방향 채점
 *
 * 이쪽은 영문 약어가 정답이라 한국어 어간 처리가 무의미하다.
 * "Load balancing" 을 물으면 LB / 로드밸런서 / load-balancer 처럼
 * 표기만 다른 답이 들어온다. 그래서 표기 차이를 지우고 비교한다.
 * ──────────────────────────────────────────────────────────────── */

/**
 * 용어 표기 정규화.
 * 소문자로 내리고 공백·하이픈·슬래시·점을 모두 지운다.
 *   "Load-Balancer" / "load balancer" / "LOADBALANCER" → "loadbalancer"
 *   "S.L.A" / "SLA" → "sla"
 */
export function normalizeTerm(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/.]/g, '');
}

/**
 * 뜻→용어 채점.
 *
 * aliases 에 맞으면 정답. 데이터가 인정 범위를 직접 들고 있으므로
 * 모델을 쓰지 않는다 — 용어는 "비슷한 철자"가 곧 다른 용어라서
 * 유사도로 봐주면 오히려 틀린 답을 통과시킨다. (SLA ↔ SLO)
 *
 * confusable 에 든 답은 "비슷했어요"로 돌린다. 헷갈릴 만해서
 * 일부러 넣어 둔 목록이니, 틀렸다고만 하는 것보다 도움이 된다.
 */
export function gradeTerm(input: string, word: Word): Grade {
  const answer = normalizeTerm(input);
  if (!answer) return 'wrong';

  const accepted = word.aliases ?? [word.word];
  if (accepted.some((a) => normalizeTerm(a) === answer)) return 'correct';

  // 용어 자체도 항상 인정 (aliases 가 비어 있는 덱 대비)
  if (normalizeTerm(word.word) === answer) return 'correct';

  const confusable = word.confusable ?? [];
  if (confusable.some((c) => normalizeTerm(c) === answer)) return 'close';

  return 'wrong';
}

/** 출제 방식에 맞는 채점기를 고른다. 객관식은 보기 문자열을 그대로 받는다. */
export async function gradeByMode(
  input: string,
  word: Word,
  mode: QuizMode,
): Promise<Grade> {
  switch (mode) {
    case 'type-term-to-meaning':
      return gradeAsync(input, word);
    case 'type-meaning-to-term':
      return gradeTerm(input, word);
    case 'choice-term-to-meaning':
      // 보기에서 고른 문자열이 정답 뜻과 같은지만 본다
      return word.meanings.some((m) => normalize(m) === normalize(input))
        ? 'correct'
        : 'wrong';
    case 'choice-meaning-to-term':
      return normalizeTerm(word.word) === normalizeTerm(input)
        ? 'correct'
        : 'wrong';
  }
}

/** 배열을 섞는다 (Fisher-Yates). 원본은 건드리지 않는다. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
