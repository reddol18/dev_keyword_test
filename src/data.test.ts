import itTerms from '../data/it_terms.json';
import itWords from '../data/it_words.json';
import { normalizeTerm } from './grading';
import type { Word } from './types';

/**
 * 단어 데이터 품질 테스트.
 *
 * `data/build_it_terms.py` 가 생성 시점에 assert 로 지키는 규칙들을
 * CI 에서도 지킨다. 생성기를 안 돌리고 JSON 을 손으로 고치는 일이 있어서
 * (오타 수정·뜻 추가) 그때 규칙이 조용히 깨질 수 있다.
 *
 * 깨지면 나타나는 증상:
 *   meanings 빈 배열   → 출제 화면에서 지문이 undefined
 *   word 중복          → 같은 문제가 한 회차에 두 번 나오고 SRS 기록이 겹친다
 *   첫 뜻 중복         → 객관식에서 정답이 둘이 된다
 *   confusable 오타    → 오답 보기가 안 만들어지고 조용히 ④ 아무거나로 떨어진다
 */

const DECKS: { name: string; words: Word[] }[] = [
  { name: 'it_terms', words: itTerms as Word[] },
  { name: 'it_words', words: itWords as Word[] },
];

describe.each(DECKS)('$name 덱', ({ words }) => {
  it('비어 있지 않다', () => {
    expect(words.length).toBeGreaterThan(0);
  });

  it('모든 단어가 word 를 가진다', () => {
    const bad = words.filter((w) => typeof w.word !== 'string' || !w.word.trim());
    expect(bad.map((w) => JSON.stringify(w))).toEqual([]);
  });

  it('모든 단어가 뜻을 최소 1개 가진다', () => {
    const bad = words.filter(
      (w) => !Array.isArray(w.meanings) || w.meanings.length < 1,
    );
    expect(bad.map((w) => w.word)).toEqual([]);
  });

  it('뜻에 빈 문자열이 없다 — 보기에 빈칸이 뜬다', () => {
    const bad = words.filter((w) =>
      w.meanings.some((m) => typeof m !== 'string' || !m.trim()),
    );
    expect(bad.map((w) => w.word)).toEqual([]);
  });

  it('partOfSpeech(분야)가 빈 문자열이 아니다 — 목록 화면이 묶이지 않는다', () => {
    const bad = words.filter(
      (w) => typeof w.partOfSpeech !== 'string' || !w.partOfSpeech.trim(),
    );
    expect(bad.map((w) => w.word)).toEqual([]);
  });

  it('덱 안에 word 중복이 없다 — SRS 기록이 겹친다', () => {
    const seen = new Map<string, number>();
    for (const w of words) {
      seen.set(w.word, (seen.get(w.word) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([w]) => w);
    expect(dups).toEqual([]);
  });

  it('표기만 다른 중복도 없다 — SLA 와 S.L.A 가 따로 있으면 안 된다', () => {
    const seen = new Map<string, string[]>();
    for (const w of words) {
      const key = normalizeTerm(w.word);
      seen.set(key, [...(seen.get(key) ?? []), w.word]);
    }
    const dups = [...seen.values()].filter((v) => v.length > 1);
    expect(dups).toEqual([]);
  });

  /** 생성기 684-690행의 "첫 뜻 중복" assert 와 같은 규칙 */
  it('첫 뜻이 겹치지 않는다 — 객관식에서 정답이 둘이 된다', () => {
    const seen = new Map<string, string[]>();
    for (const w of words) {
      const key = w.meanings[0]?.trim();
      if (!key) continue;
      seen.set(key, [...(seen.get(key) ?? []), w.word]);
    }
    const dups = [...seen.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([meaning, ws]) => `${meaning}: ${ws.join(' / ')}`);
    expect(dups).toEqual([]);
  });

  it('confusable 이 자기 자신을 가리키지 않는다 — 정답이 오답 보기로 들어간다', () => {
    const bad: string[] = [];
    for (const w of words) {
      if ((w.confusable ?? []).some((c) => normalizeTerm(c) === normalizeTerm(w.word))) {
        bad.push(w.word);
      }
    }
    expect(bad).toEqual([]);
  });

  it('aliases 가 있으면 용어 자체를 포함한다 — 채점에서 정답을 놓친다', () => {
    const bad = words
      .filter((w) => (w.aliases ?? []).length > 0)
      .filter(
        (w) => !w.aliases!.some((a) => normalizeTerm(a) === normalizeTerm(w.word)),
      );
    expect(bad.map((w) => w.word)).toEqual([]);
  });

  it('level 은 1/2/3 중 하나다 — 난이도 필터에서 빠진다', () => {
    const bad = words.filter((w) => w.level != null && ![1, 2, 3].includes(w.level));
    expect(bad.map((w) => w.word)).toEqual([]);
  });

  it('near·aliases·confusable 이 배열이다 — 문자열로 들어오면 글자 단위로 순회한다', () => {
    const bad = words.filter(
      (w) =>
        (w.near != null && !Array.isArray(w.near)) ||
        (w.aliases != null && !Array.isArray(w.aliases)) ||
        (w.confusable != null && !Array.isArray(w.confusable)),
    );
    expect(bad.map((w) => w.word)).toEqual([]);
  });
});

/**
 * `confusable` 의 뜻이 덱마다 다르다 — 섞으면 안 된다.
 *
 * it_terms : **덱 안의 다른 용어 이름**이다. 생성기가 CONFUSABLE 묶음을
 *            풀어서 넣고 `assert not miss` 로 지킨다 (build_it_terms.py:694-696).
 *            이름이 틀리면 `buildChoices` ① 단계가 조용히 비고 ②로 떨어진다.
 * it_words : 덱에 없는 **유의어 문자열**이 대부분이다 (240개 중 155개).
 *            `choices.ts:104` 가 뜻→용어 방향에서 그 문자열을 보기로 그냥 쓴다.
 *            그래서 "덱에 있어야 한다"를 여기에 적용하면 안 된다.
 */
describe('confusable — 덱별 규칙', () => {
  it('it_terms: confusable 이 전부 덱 안의 실제 용어다', () => {
    const words = itTerms as Word[];
    const known = new Set(words.map((w) => normalizeTerm(w.word)));
    const missing: string[] = [];
    for (const w of words) {
      for (const c of w.confusable ?? []) {
        if (!known.has(normalizeTerm(c))) missing.push(`${w.word} → ${c}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('it_words: confusable 이 비어 있지 않다 — 객관식 오답 1순위가 사라진다', () => {
    const words = itWords as Word[];
    const empty = words.filter((w) => (w.confusable ?? []).length === 0);
    expect(empty.map((w) => w.word)).toEqual([]);
  });
});

describe('덱 전체', () => {
  it('덱마다 분야가 하나 이상이다', () => {
    for (const { words } of DECKS) {
      expect(new Set(words.map((w) => w.partOfSpeech)).size).toBeGreaterThan(0);
    }
  });

  /**
   * 덱 간 word 중복은 **알려진 사실**이다.
   * Rollback / Incident / Postmortem / Legacy 4건이 두 덱에 함께 있다.
   * 덱은 따로 출제되고 SRS 기록도 덱별로 쓰이므로 지금은 문제가 아니다.
   * 저장 구조를 바꿀 때 다룬다
   * — https://github.com/reddol18/dev_keyword_test/issues/17
   *
   * 이 테스트는 "4건을 막는" 게 아니라 **그 수가 늘지 않게 지킨다**.
   * 늘어나면 위 이슈에서 옮길 대상이 바뀐다는 뜻이다.
   */
  it('덱 간 word 중복은 알려진 4건 그대로다', () => {
    const [terms, wordsDeck] = DECKS;
    const inTerms = new Set(terms.words.map((w) => normalizeTerm(w.word)));
    // 두 덱의 대소문자 표기가 달라서(it_terms "Rollback" / it_words "rollback")
    // 정규화한 값으로 비교한다.
    const overlap = wordsDeck.words
      .map((w) => normalizeTerm(w.word))
      .filter((w) => inTerms.has(w))
      .sort();

    expect(overlap).toEqual(['incident', 'legacy', 'postmortem', 'rollback']);
  });
});
