export type Word = {
  /** 문제로 나오는 쪽 — 용어 또는 영단어 */
  word: string;
  /** 정답으로 인정할 뜻. IT 용어는 [한국어 뜻, 영문 풀네임] 형태다 */
  meanings: string[];
  /** IT 덱에서는 품사가 아니라 분야로 쓴다 (기초, 보안·권한, …) */
  partOfSpeech: string;

  /** 비슷하게 답해도 "비슷했어요"로 쳐 줄 표현 */
  near?: string[];
  /** 1 기초 / 2 일반 / 3 우선 */
  level?: 1 | 2 | 3;
  /** 뜻→용어 방향 채점에서 정답으로 인정할 표기 (LB, 로드밸런서, …) */
  aliases?: string[];
  /** 헷갈리는 용어 — 객관식 오답 보기의 1순위 후보 */
  confusable?: string[];
};

/**
 * 채점 등급.
 * - correct : 정답
 * - close   : 오답이지만 의미가 가깝다. 점수는 안 준다.
 * - wrong   : 오답
 *
 * close를 둔 이유: "place → 위치하다"처럼 이해는 맞는데 번역이
 * 정확하지 않은 경우가 있다. 그냥 틀렸다고만 하면 학생이 자기 답이
 * 왜 아닌지 모른다. 점수는 주지 않되 "비슷했어요"를 보여준다.
 */
export type Grade = 'correct' | 'close' | 'wrong';

/**
 * 출제 방식 4종.
 *   term→meaning : 용어를 보여주고 뜻을 묻는다
 *   meaning→term : 뜻을 보여주고 용어를 묻는다 (면접에서 안 떠오르는 방향)
 *   typing       : 주관식
 *   choice       : 객관식
 */
export type QuizMode =
  | 'type-term-to-meaning'
  | 'type-meaning-to-term'
  | 'choice-term-to-meaning'
  | 'choice-meaning-to-term';

export const ALL_MODES: QuizMode[] = [
  'type-term-to-meaning',
  'type-meaning-to-term',
  'choice-term-to-meaning',
  'choice-meaning-to-term',
];

export const MODE_LABEL: Record<QuizMode, string> = {
  'type-term-to-meaning': '주관식 · 용어→뜻',
  'type-meaning-to-term': '주관식 · 뜻→용어',
  'choice-term-to-meaning': '객관식 · 용어→뜻',
  'choice-meaning-to-term': '객관식 · 뜻→용어',
};

export function isChoiceMode(mode: QuizMode): boolean {
  return mode.startsWith('choice-');
}

/** 한 문제. 출제 방식에 따라 지문과 정답이 달라진다. */
export type Question = {
  word: Word;
  mode: QuizMode;
  /** 화면 위에 크게 보여줄 지문 (용어 또는 뜻) */
  prompt: string;
  /** 객관식일 때만 — 정답 1개를 포함해 섞인 보기 */
  choices?: string[];
  /** 객관식일 때만 — choices 안에서 정답의 위치 */
  answerIndex?: number;
};

/** 한 문제에 대한 채점 결과 (오답노트에 그대로 쓰인다) */
export type Answer = {
  word: Word;
  mode: QuizMode;
  /** 사용자가 실제로 입력하거나 선택한 원문 — 정규화 전 값을 보관한다 */
  input: string;
  grade: Grade;
};
