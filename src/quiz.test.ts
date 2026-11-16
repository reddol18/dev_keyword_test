import { buildQuiz as rawBuildQuiz, hintOf, quizPhase, shouldKeepGrade } from './quiz';
import type { Cards } from './srs';
import { cardKey, today } from './srs';
import type { Question, QuizMode, Word } from './types';
import { ALL_MODES, isChoiceMode } from './types';

/**
 * 테스트용 덱 이름. 카드 키가 `덱:단어` 라서 기록을 만들 때도
 * 조회할 때도 같은 덱 이름을 써야 한다.
 */
const DECK = 'test-deck';

/** deckId 를 매번 쓰지 않도록 감싼다. 기본은 빈 기록. */
function buildQuiz(
  pool: Word[],
  modes: QuizMode[],
  count: number,
  cards: Cards = {},
  deckId: string = DECK,
): Question[] {
  return rawBuildQuiz(pool, modes, count, cards, deckId);
}

/** 테스트 덱 기준으로 카드 키를 만든다 */
function key(word: string): string {
  return cardKey(DECK, word);
}

/**
 * 출제 테스트.
 *
 * 가장 중요한 건 **객관식에서 `choices[answerIndex]` 가 실제 정답인지**다.
 * 이게 어긋나면 "정답이 보기에 없음" 또는 "보기 둘 다 정답"이 되고,
 * 화면은 멀쩡해 보이는데 채점만 틀린다. 눈으로는 안 잡힌다.
 */

/** N개짜리 가짜 덱. 뜻이 겹치지 않게 만든다 */
function pool(n: number): Word[] {
  return Array.from({ length: n }, (_, i) => ({
    word: `Term${i}`,
    meanings: [`뜻${i}`, `Meaning ${i}`],
    partOfSpeech: i % 3 === 0 ? '기초' : '아키텍처',
    level: ((i % 3) + 1) as 1 | 2 | 3,
    near: [],
    aliases: [`Term${i}`],
    confusable: [],
  }));
}

const TYPE_MODE: QuizMode[] = ['type-term-to-meaning'];
const CHOICE_MODES: QuizMode[] = ['choice-term-to-meaning', 'choice-meaning-to-term'];

describe('buildQuiz — 개수와 중복', () => {
  it('요청한 개수만큼 낸다', () => {
    expect(buildQuiz(pool(50), TYPE_MODE, 10)).toHaveLength(10);
  });

  it('같은 단어를 두 번 내지 않는다', () => {
    const quiz = buildQuiz(pool(50), TYPE_MODE, 20);
    const words = quiz.map((q) => q.word.word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('pool 이 count 보다 적으면 있는 만큼만 낸다', () => {
    expect(buildQuiz(pool(3), TYPE_MODE, 10)).toHaveLength(3);
    expect(buildQuiz(pool(1), TYPE_MODE, 10)).toHaveLength(1);
  });

  it('pool 이 비면 빈 배열', () => {
    expect(buildQuiz([], TYPE_MODE, 10)).toEqual([]);
  });

  it('modes 가 비면 빈 배열', () => {
    expect(buildQuiz(pool(10), [], 10)).toEqual([]);
  });

  it('count 가 0 이면 빈 배열', () => {
    expect(buildQuiz(pool(10), TYPE_MODE, 0)).toEqual([]);
  });

  it('덱 전체를 요청해도 중복 없이 전부 낸다', () => {
    const deck = pool(12);
    const quiz = buildQuiz(deck, TYPE_MODE, 12);
    expect(quiz).toHaveLength(12);
    expect(new Set(quiz.map((q) => q.word.word)).size).toBe(12);
  });
});

describe('buildQuiz — 출제 방식', () => {
  it('주어진 방식만 쓴다', () => {
    const quiz = buildQuiz(pool(30), TYPE_MODE, 10);
    expect(quiz.every((q) => q.mode === 'type-term-to-meaning')).toBe(true);
  });

  it('용어→뜻 방향은 용어를 지문으로 쓴다', () => {
    const quiz = buildQuiz(pool(30), ['type-term-to-meaning'], 5);
    expect(quiz.every((q) => q.prompt === q.word.word)).toBe(true);
  });

  it('뜻→용어 방향은 첫 뜻을 지문으로 쓴다', () => {
    const quiz = buildQuiz(pool(30), ['type-meaning-to-term'], 5);
    expect(quiz.every((q) => q.prompt === q.word.meanings[0])).toBe(true);
  });

  it('주관식에는 보기가 붙지 않는다', () => {
    const quiz = buildQuiz(pool(30), TYPE_MODE, 5);
    expect(quiz.every((q) => q.choices === undefined)).toBe(true);
    expect(quiz.every((q) => q.answerIndex === undefined)).toBe(true);
  });

  it('방식이 여러 개면 한 가지로 쏠리지 않는다', () => {
    const quiz = buildQuiz(pool(40), ALL_MODES, 20);
    expect(new Set(quiz.map((q) => q.mode)).size).toBeGreaterThan(1);
  });
});

/**
 * ★ 이 블록이 이 파일의 핵심.
 *
 * `answerIndex` 가 `choices` 안의 정답 위치를 정확히 가리켜야 한다.
 * `buildChoices` 는 보기를 섞은 뒤 `indexOf` 로 위치를 다시 찾는데,
 * 정답과 같은 문자열이 보기에 또 들어가면 그 자리가 어긋난다.
 */
describe('buildQuiz — 객관식 보기 (choices[answerIndex] 가 정답인가)', () => {
  it('용어→뜻: choices[answerIndex] 가 정답의 첫 뜻이다', () => {
    const quiz = buildQuiz(pool(40), ['choice-term-to-meaning'], 20);
    expect(quiz).toHaveLength(20);
    for (const q of quiz) {
      expect(q.choices).toBeDefined();
      expect(q.answerIndex).toBeDefined();
      expect(q.choices![q.answerIndex!]).toBe(q.word.meanings[0]);
    }
  });

  it('뜻→용어: choices[answerIndex] 가 정답 용어다', () => {
    const quiz = buildQuiz(pool(40), ['choice-meaning-to-term'], 20);
    for (const q of quiz) {
      expect(q.choices![q.answerIndex!]).toBe(q.word.word);
    }
  });

  it('answerIndex 가 보기 범위 안이다 — -1(정답이 보기에 없음)이 아니다', () => {
    const quiz = buildQuiz(pool(40), CHOICE_MODES, 20);
    for (const q of quiz) {
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(q.choices!.length);
    }
  });

  it('보기에 같은 문자열이 두 번 들어가지 않는다 — 정답이 둘이 되면 안 된다', () => {
    const quiz = buildQuiz(pool(40), CHOICE_MODES, 20);
    for (const q of quiz) {
      expect(new Set(q.choices!).size).toBe(q.choices!.length);
    }
  });

  it('보기가 2개 이상이다 — 고를 수 있어야 문제가 성립한다', () => {
    const quiz = buildQuiz(pool(40), CHOICE_MODES, 20);
    for (const q of quiz) {
      expect(q.choices!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('덱이 작아도(3개) 정답 위치가 맞다', () => {
    const quiz = buildQuiz(pool(3), CHOICE_MODES, 3);
    for (const q of quiz) {
      const expected = q.mode === 'choice-meaning-to-term'
        ? q.word.word
        : q.word.meanings[0];
      expect(q.choices![q.answerIndex!]).toBe(expected);
    }
  });

  it('덱에 단어가 1개뿐이면 보기는 정답 하나뿐이고 위치는 0', () => {
    const quiz = buildQuiz(pool(1), ['choice-term-to-meaning'], 1);
    expect(quiz).toHaveLength(1);
    expect(quiz[0].choices).toHaveLength(1);
    expect(quiz[0].answerIndex).toBe(0);
  });

  it('여러 번 돌려도 정답 위치가 항상 맞다 — 섞기가 끼어 있어 반복이 필요하다', () => {
    for (let i = 0; i < 30; i++) {
      for (const q of buildQuiz(pool(25), CHOICE_MODES, 10)) {
        const expected = q.mode === 'choice-meaning-to-term'
          ? q.word.word
          : q.word.meanings[0];
        expect(q.choices![q.answerIndex!]).toBe(expected);
      }
    }
  });
});

/**
 * MIN_NEW — 복습이 자리를 다 차지해 새 단어가 안 들어오는 것을 막는다.
 * 이 자리를 떼어 두지 않으면 덱을 한 바퀴 도는 데 몇 배가 걸린다.
 */
describe('buildQuiz — MIN_NEW 가 새 단어 자리를 확보한다', () => {
  const now = today();

  /** 전부 '오늘 맞혀서 Later' 인 기록 — 새 단어 자리가 없으면 0개가 된다 */
  function allLater(words: Word[]): Cards {
    const cards: Cards = {};
    for (const w of words) {
      cards[key(w.word)] = { streak: 3, due: '2099-01-01', last: now };
    }
    return cards;
  }

  it('복습 대상이 요청 수보다 많아도 새 단어가 최소 2개 들어간다', () => {
    const deck = pool(40);
    // 앞 30개는 이미 본 것(Later), 뒤 10개는 처음 보는 것
    const seen = deck.slice(0, 30);
    const cards = allLater(seen);

    const quiz = buildQuiz(deck, TYPE_MODE, 10, cards);
    expect(quiz).toHaveLength(10);
    const fresh = quiz.filter((q) => !cards[key(q.word.word)]);
    expect(fresh.length).toBeGreaterThanOrEqual(2);
  });

  it('복습 대상이 Due 로 가득해도 새 단어 자리가 남는다', () => {
    const deck = pool(40);
    const cards: Cards = {};
    for (const w of deck.slice(0, 30)) {
      // due 가 지났고 오늘 안 풀었다 → Due
      cards[key(w.word)] = { streak: 1, due: '2000-01-01', last: '2000-01-01' };
    }

    const quiz = buildQuiz(deck, TYPE_MODE, 10, cards);
    const fresh = quiz.filter((q) => !cards[key(q.word.word)]);
    expect(fresh.length).toBeGreaterThanOrEqual(2);
  });

  it('새 단어가 없으면 그만큼 복습이 더 들어간다 — 개수가 줄지 않는다', () => {
    const deck = pool(20);
    const quiz = buildQuiz(deck, TYPE_MODE, 10, allLater(deck));
    expect(quiz).toHaveLength(10);
  });

  it('count 가 MIN_NEW 보다 작으면 count 를 넘지 않는다', () => {
    const deck = pool(40);
    const cards = allLater(deck.slice(0, 30));
    expect(buildQuiz(deck, TYPE_MODE, 1, cards)).toHaveLength(1);
  });
});

describe('buildQuiz — 간격 반복 순서', () => {
  const now = today();

  it('오늘 틀린 것(Relearn)을 먼저 낸다', () => {
    const deck = pool(40);
    const cards: Cards = {};
    // Term0 만 오늘 틀렸다
    cards[key('Term0')] = { streak: 0, due: '2099-01-01', last: now };
    // 나머지는 아직 볼 때가 아니다
    for (const w of deck.slice(1)) {
      cards[key(w.word)] = { streak: 3, due: '2099-01-01', last: now };
    }

    const quiz = buildQuiz(deck, TYPE_MODE, 5, cards);
    expect(quiz.map((q) => q.word.word)).toContain('Term0');
  });

  it('밀린 복습(due 가 오래된 것)을 먼저 낸다', () => {
    const deck = pool(40);
    const cards: Cards = {};
    for (const w of deck) {
      cards[key(w.word)] = { streak: 1, due: '2026-11-15', last: '2026-11-10' };
    }
    // Term7 이 가장 오래 밀렸다
    cards[key('Term7')] = { streak: 1, due: '2000-01-01', last: '2000-01-01' };

    const quiz = buildQuiz(deck, TYPE_MODE, 5, cards);
    expect(quiz.map((q) => q.word.word)).toContain('Term7');
  });

  it('cards 를 안 주면 전부 처음 보는 것으로 취급한다', () => {
    expect(buildQuiz(pool(30), TYPE_MODE, 10)).toHaveLength(10);
  });

  /**
   * 다른 덱의 기록이 이 덱의 출제를 흔들면 안 된다.
   * 키에 덱이 없던 구조에서는 `Term0` 하나로 두 덱이 같은 칸을 썼다.
   */
  it('다른 덱 기록은 이 덱 출제에 영향을 주지 않는다', () => {
    const deck = pool(5);
    const other: Cards = {};
    // 다른 덱에서 전부 '오늘 맞힘(Later)' 으로 기록돼 있다
    for (const w of deck) {
      other[cardKey('other-deck', w.word)] = {
        streak: 3, due: '2099-01-01', last: now,
      };
    }

    // 이 덱에는 기록이 없으므로 5개 전부 처음 보는 것으로 나와야 한다
    const quiz = buildQuiz(deck, TYPE_MODE, 5, other);
    expect(quiz).toHaveLength(5);
  });
});

/**
 * ★ 이슈 #26 — 빈 배열이 나오는 조건을 못박는다.
 *
 * 화면은 "0개"를 "아직 안 만들어짐"과 구분해야 하는데, 그 전에 **언제 0개가
 * 되는지**가 고정돼 있어야 한다. 조건이 늘어나면(= 여기서 실패하면)
 * `QuizScreen` 의 `empty` 안내 문구가 그 경우에도 맞는지 다시 봐야 한다.
 */
describe('buildQuiz — 빈 배열이 나오는 조건은 셋뿐이다', () => {
  const now = today();

  it('pool·modes·count 셋 중 하나라도 비면 빈 배열', () => {
    expect(buildQuiz([], TYPE_MODE, 10)).toEqual([]);
    expect(buildQuiz(pool(10), [], 10)).toEqual([]);
    expect(buildQuiz(pool(10), TYPE_MODE, 0)).toEqual([]);
  });

  it('count 가 음수여도 빈 배열 — 터지지 않는다', () => {
    expect(buildQuiz(pool(10), TYPE_MODE, -1)).toEqual([]);
  });

  it('세 조건이 다 만족되면 절대 비지 않는다', () => {
    expect(buildQuiz(pool(1), TYPE_MODE, 1).length).toBeGreaterThan(0);
    expect(buildQuiz(pool(1), TYPE_MODE, 30).length).toBeGreaterThan(0);
    expect(buildQuiz(pool(40), ALL_MODES, 1).length).toBeGreaterThan(0);
  });

  /**
   * SRS 기록으로는 pool 이 줄지 않는다.
   *
   * `srsPick` 은 pool 의 단어를 4개 그룹에 빠짐없이 담고 `Priority.Later`
   * 까지 출제 후보로 쓴다. 그래서 "덱을 다 외워서 낼 게 없어지는" 경로는
   * **없다** — 이슈 #26 에서 처음 의심했던 재현 조건이 이 테스트로 닫힌다.
   * 여기가 깨지면 '다시 풀기'가 빈 시험을 만들 수 있게 된다는 뜻이다.
   */
  it('덱을 전부 오늘 맞혀 둬도(Later) 빈 배열이 되지 않는다', () => {
    const deck = pool(20);
    const cards: Cards = {};
    for (const w of deck) {
      cards[key(w.word)] = { streak: 6, due: '2099-12-31', last: now };
    }
    expect(buildQuiz(deck, TYPE_MODE, 10, cards)).toHaveLength(10);
  });

  it('덱이 count 보다 작고 전부 Later 여도 있는 만큼은 낸다', () => {
    const deck = pool(3);
    const cards: Cards = {};
    for (const w of deck) {
      cards[key(w.word)] = { streak: 6, due: '2099-12-31', last: now };
    }
    expect(buildQuiz(deck, TYPE_MODE, 10, cards)).toHaveLength(3);
  });
});

/**
 * ★ 이슈 #26 — 로딩과 빈 결과를 가른다.
 *
 * 개수만 보면 둘 다 0개라 구분되지 않고, 그 상태로는 "만들었는데 0개"가
 * 영구히 '준비 중' 으로 굳는다. 기다릴 비동기 작업이 없어 저절로 안 풀린다.
 */
describe('quizPhase', () => {
  it('아직 만들지 않았으면 loading — 개수와 무관하다', () => {
    expect(quizPhase(false, 0, 0)).toBe('loading');
    // 만들기 전이라면 개수가 뭐로 들어와도 loading 이다
    expect(quizPhase(false, 10, 0)).toBe('loading');
    expect(quizPhase(false, 10, 10)).toBe('loading');
  });

  it('만들었는데 0개면 empty — loading 이 아니다 (이 버그의 핵심)', () => {
    expect(quizPhase(true, 0, 0)).toBe('empty');
  });

  it('0개일 때 index 가 무엇이든 empty 로 남는다 — finished 로 새지 않는다', () => {
    expect(quizPhase(true, 0, 0)).toBe('empty');
    expect(quizPhase(true, 0, 1)).toBe('empty');
    expect(quizPhase(true, 0, 99)).toBe('empty');
  });

  it('풀 문제가 남았으면 asking', () => {
    expect(quizPhase(true, 10, 0)).toBe('asking');
    expect(quizPhase(true, 10, 9)).toBe('asking');
    expect(quizPhase(true, 1, 0)).toBe('asking');
  });

  it('마지막 문제를 넘기면 finished', () => {
    expect(quizPhase(true, 10, 10)).toBe('finished');
    expect(quizPhase(true, 1, 1)).toBe('finished');
  });

  it('index 가 총 개수를 넘어가도 finished', () => {
    expect(quizPhase(true, 10, 11)).toBe('finished');
  });

  /**
   * 첫 진입의 짧은 공백. 기록을 읽는 동안 index 와 total 이 둘 다 0 인데,
   * 여기서 finished/empty 로 판정하면 결과 화면이나 안내가 번쩍 지나간다.
   */
  it('첫 진입 → 출제 흐름에서 결과 화면이 먼저 번쩍이지 않는다', () => {
    expect(quizPhase(false, 0, 0)).toBe('loading');   // 기록 읽는 중
    expect(quizPhase(true, 10, 0)).toBe('asking');    // 출제됨
  });

  /** 다시 풀기: 0개가 돌아오면 멈추지 말고 empty 로 알려야 한다 */
  it('다시 풀기에서 0개가 나오면 empty 로 간다', () => {
    expect(quizPhase(true, 10, 10)).toBe('finished'); // 결과 화면
    expect(quizPhase(true, 0, 0)).toBe('empty');      // 다시 풀기 → 낼 게 없음
  });
});

/**
 * 비동기 채점이 끝났을 때 그 결과를 기록해도 되는가 (이슈 #22).
 *
 * 버리는 쪽이 안전한 판정이다. 잘못 기록하면 답한 적 없는 문제가 오답으로
 * 남고 SRS 복습 주기까지 당겨지는데, 버리면 사용자가 한 번 더 답하면 된다.
 */
describe('shouldKeepGrade', () => {
  it('자리가 그대로면 기록한다 — 정상 경로', () => {
    expect(shouldKeepGrade({ epoch: 0, index: 0 }, { epoch: 0, index: 0 })).toBe(true);
    expect(shouldKeepGrade({ epoch: 2, index: 7 }, { epoch: 2, index: 7 })).toBe(true);
  });

  it('채점 중 다음 문제로 넘어갔으면 버린다', () => {
    expect(shouldKeepGrade({ epoch: 0, index: 3 }, { epoch: 0, index: 4 })).toBe(false);
  });

  it('채점 중 이전 문제로 돌아갔어도 버린다 — 방향을 가리지 않는다', () => {
    expect(shouldKeepGrade({ epoch: 0, index: 3 }, { epoch: 0, index: 2 })).toBe(false);
  });

  /**
   * 이게 index 만으로는 못 잡는 경우다. '다시 풀기' 는 index 를 0 으로
   * 되돌리므로, 1번 문제를 채점하는 중에 다시 풀기를 누르면 index 가
   * 양쪽 다 0 이어서 "안 바뀌었다" 가 된다. epoch 가 그걸 가른다.
   */
  it('다시 풀기로 회차가 바뀌면 index 가 같아도 버린다', () => {
    expect(shouldKeepGrade({ epoch: 0, index: 0 }, { epoch: 1, index: 0 })).toBe(false);
  });

  it('회차와 문제 번호가 둘 다 바뀌었으면 당연히 버린다', () => {
    expect(shouldKeepGrade({ epoch: 0, index: 5 }, { epoch: 1, index: 0 })).toBe(false);
  });
});

describe('hintOf', () => {
  it('네 방식 모두 안내 문구가 있다', () => {
    for (const mode of ALL_MODES) {
      expect(hintOf(mode)).toBeTruthy();
    }
  });

  it('주관식과 객관식의 안내가 다르다 — 입력인지 선택인지 알려야 한다', () => {
    expect(hintOf('type-term-to-meaning')).not.toBe(hintOf('choice-term-to-meaning'));
  });

  it('객관식 안내는 "고르세요", 주관식은 "입력하세요"', () => {
    for (const mode of ALL_MODES) {
      expect(hintOf(mode)).toContain(isChoiceMode(mode) ? '고르세요' : '입력하세요');
    }
  });
});
