export type Word = {
  word: string;
  meanings: string[];
  partOfSpeech: string;
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

/** 한 문제에 대한 채점 결과 (오답노트에 그대로 쓰인다) */
export type Answer = {
  word: Word;
  /** 사용자가 실제로 입력한 원문 — 정규화 전 값을 보관한다 */
  input: string;
  grade: Grade;
};
