import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Card } from './srs';
import {
  Priority, buildExport, cardKey, clearCards, countDue, countNew,
  loadCards, nextCard, priorityOf, recordResult, today,
} from './srs';

/**
 * 간격 반복(SRS) 테스트.
 *
 * 이 파일이 지키는 것은 `due` 가 **언제나 유효한 날짜 문자열**이라는 것이다.
 * due 는 AsyncStorage 에 영구 저장되므로, 한 번 깨지면 앱을 다시 켜도
 * 낫지 않는다. 날짜 비교(`card.due <= now`)가 어긋나면 그 단어는
 * 영원히 안 나오거나 영원히 매일 나온다.
 */

/** YYYY-MM-DD 형태인가 — NaN 날짜를 잡는 자리 */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 오늘로부터 days 일 뒤를 테스트 쪽에서 독립적으로 계산한다 */
function expectedDue(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function card(partial: Partial<Card>): Card {
  return { streak: 0, due: today(), last: today(), ...partial };
}

describe('nextCard — 맞혔을 때 간격', () => {
  it('처음 맞히면 streak 1, 1일 뒤', () => {
    const next = nextCard(undefined, 'correct');
    expect(next.streak).toBe(1);
    expect(next.due).toBe(expectedDue(1));
  });

  it('streak 1 에서 또 맞히면 streak 2, 3일 뒤', () => {
    const next = nextCard(card({ streak: 1 }), 'correct');
    expect(next.streak).toBe(2);
    expect(next.due).toBe(expectedDue(3));
  });

  it('streak 2 에서 또 맞히면 streak 3, 7일 뒤', () => {
    const next = nextCard(card({ streak: 2 }), 'correct');
    expect(next.streak).toBe(3);
    expect(next.due).toBe(expectedDue(7));
  });

  it('INTERVALS(1·3·7·14·30·60) 를 순서대로 따라간다', () => {
    const intervals = [1, 3, 7, 14, 30, 60];
    intervals.forEach((days, i) => {
      // streak i 에서 맞히면 i+1 번째 간격을 쓴다
      const next = nextCard(card({ streak: i }), 'correct');
      expect(next.streak).toBe(i + 1);
      expect(next.due).toBe(expectedDue(days));
    });
  });

  it('간격표를 넘기면 마지막 값(60일)을 계속 쓴다', () => {
    expect(nextCard(card({ streak: 6 }), 'correct').due).toBe(expectedDue(60));
    expect(nextCard(card({ streak: 99 }), 'correct').due).toBe(expectedDue(60));
  });

  it('맞히면 last 가 오늘로 갱신된다', () => {
    expect(nextCard(undefined, 'correct').last).toBe(today());
  });
});

describe('nextCard — 틀렸을 때 / 비슷했을 때', () => {
  it('틀리면 streak 0 으로 돌아가고 1일 뒤', () => {
    const next = nextCard(card({ streak: 5 }), 'wrong');
    expect(next.streak).toBe(0);
    expect(next.due).toBe(expectedDue(1));
  });

  it('"비슷했어요"는 streak 을 올리지 않고 2일 뒤(CLOSE_INTERVAL)', () => {
    const next = nextCard(card({ streak: 3 }), 'close');
    expect(next.streak).toBe(0);
    expect(next.due).toBe(expectedDue(2));
  });

  it('close 는 wrong(1일)보다 길고 correct 첫 간격과 구분된다', () => {
    const closeDue = nextCard(undefined, 'close').due;
    const wrongDue = nextCard(undefined, 'wrong').due;
    expect(closeDue > wrongDue).toBe(true);
  });
});

/**
 * ★ 이 블록이 이 파일의 핵심.
 *
 * `INTERVALS[Math.min(streak - 1, …)]` 에 streak 0 이 들어가면
 * `INTERVALS[-1]` = undefined → `addDays(undefined)` → Invalid Date →
 * due 가 "NaN-NaN-NaN" 이 된다. 정상 흐름에서는 correct 일 때 streak 이
 * 항상 1 이상이라 안전하지만, **저장소에서 읽은 기록이 깨져 있으면**
 * 그 값이 그대로 들어온다 (`loadCards` 는 카드 하나하나를 검사하지 않는다).
 */
describe('nextCard — 깨진 기록이 들어와도 due 가 NaN 이 되지 않는다', () => {
  it('어떤 입력에서도 due 는 YYYY-MM-DD 형식이다', () => {
    const broken: unknown[] = [-1, -99, NaN, Infinity, '3', null, undefined, 1.5, {}];
    for (const streak of broken) {
      for (const grade of ['correct', 'close', 'wrong'] as const) {
        const next = nextCard({ streak } as unknown as Card, grade);
        expect(next.due).toMatch(YMD);
        expect(next.due).not.toContain('NaN');
      }
    }
  });

  it('음수 streak 이 와도 INTERVALS[-1] 로 떨어지지 않는다', () => {
    // 가드가 없으면 due 가 "NaN-NaN-NaN" 이 된다
    const next = nextCard({ streak: -1 } as unknown as Card, 'correct');
    expect(next.due).toBe(expectedDue(1));
    expect(next.streak).toBe(1);
  });

  it('NaN streak 은 0 으로 취급한다', () => {
    const next = nextCard({ streak: NaN } as unknown as Card, 'correct');
    expect(next.streak).toBe(1);
    expect(next.due).toBe(expectedDue(1));
  });

  it('문자열 streak 이 와도 숫자로 남는다 — "3"+1="31" 방지', () => {
    const next = nextCard({ streak: '3' } as unknown as Card, 'correct');
    expect(typeof next.streak).toBe('number');
    // 문자열 연결이 일어나면 streak 이 "31" 이 되고 간격이 60일로 튄다
    expect(next.streak).toBe(1);
    expect(next.due).toBe(expectedDue(1));
  });

  it('streak 은 항상 0 이상의 정수다', () => {
    for (const streak of [-5, NaN, 1.7, '2']) {
      const next = nextCard({ streak } as unknown as Card, 'correct');
      expect(Number.isInteger(next.streak)).toBe(true);
      expect(next.streak).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('priorityOf — 4분기', () => {
  const now = '2026-11-16';

  it('기록이 없으면 New', () => {
    expect(priorityOf(undefined, now)).toBe(Priority.New);
  });

  it('오늘 풀었고 streak 0 이면 Relearn — 오늘 틀린 것은 바로 다시', () => {
    expect(priorityOf({ streak: 0, due: '2026-11-17', last: now }, now)).toBe(
      Priority.Relearn,
    );
  });

  it('오늘 풀었고 맞혔으면 Later — 같은 날 반복은 의미가 없다', () => {
    expect(priorityOf({ streak: 2, due: '2026-11-19', last: now }, now)).toBe(
      Priority.Later,
    );
  });

  it('due 가 지났으면 Due', () => {
    expect(priorityOf({ streak: 1, due: '2026-11-15', last: '2026-11-14' }, now)).toBe(
      Priority.Due,
    );
  });

  it('due 가 오늘이면 Due — 경계 포함', () => {
    expect(priorityOf({ streak: 1, due: now, last: '2026-11-15' }, now)).toBe(
      Priority.Due,
    );
  });

  it('due 가 아직 안 왔으면 Later', () => {
    expect(priorityOf({ streak: 3, due: '2026-11-20', last: '2026-11-13' }, now)).toBe(
      Priority.Later,
    );
  });

  it('네 분기가 서로 다른 값이다 — 정렬 묶음이 섞이면 출제 순서가 깨진다', () => {
    const all = [Priority.Relearn, Priority.Due, Priority.New, Priority.Later];
    expect(new Set(all).size).toBe(4);
    expect(all).toEqual([0, 1, 2, 3]);
  });
});

/* ────────────────────────────────────────────────────────────────
 * 저장 구조 (v2) 와 마이그레이션
 * ──────────────────────────────────────────────────────────────── */

const V1_KEY = 'srs-v1';
const V2_KEY = 'srs-v2';

/** 테스트마다 저장소와 모듈 캐시를 비운다 — cache 가 테스트 사이에 샌다 */
async function reset(): Promise<void> {
  await AsyncStorage.clear();
  await clearCards();   // 모듈 안의 cache 를 null 로 되돌린다
}

/** v2 저장 내용을 날것으로 읽는다 */
async function readRaw(): Promise<unknown> {
  const raw = await AsyncStorage.getItem(V2_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('cardKey — 덱을 구분한다', () => {
  it('덱이 다르면 키가 다르다', () => {
    expect(cardKey('it-terms', 'Rollback')).not.toBe(cardKey('it-words', 'Rollback'));
  });

  it('`덱:단어` 형식이다', () => {
    expect(cardKey('it-terms', 'Rollback')).toBe('it-terms:Rollback');
  });

  /**
   * 정규화하지 않기로 한 결정을 고정한다. 소문자로 낮추면
   * `Rollback`(IT 용어)과 `rollback`(영단어)의 키가 덱 접두사만 다른
   * 상태가 되는데, 그건 이미 덱이 갈라 주므로 정규화는 손실만 남는다.
   */
  it('대소문자를 보존한다 — 덱 데이터의 word 를 그대로 쓴다', () => {
    expect(cardKey('it-terms', 'Rollback')).toBe('it-terms:Rollback');
    expect(cardKey('it-words', 'rollback')).toBe('it-words:rollback');
  });
});

describe('저장 구조 — 데이터 안에 version 이 있다', () => {
  beforeEach(reset);

  it('저장하면 { version: 2, cards } 모양이 된다', async () => {
    await recordResult('it-terms', 'LLM', 'correct');
    const stored = await readRaw() as { version: number; cards: Record<string, Card> };
    expect(stored.version).toBe(2);
    expect(stored.cards['it-terms:LLM'].streak).toBe(1);
  });

  it('이미 v2 인 데이터를 다시 읽어도 멀쩡하다', async () => {
    const cards = { 'it-terms:LLM': { streak: 2, due: '2099-01-01', last: '2026-01-01' } };
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({ version: 2, cards }));

    const loaded = await loadCards();
    expect(loaded['it-terms:LLM']).toEqual(cards['it-terms:LLM']);
  });

  it('v2 를 읽고 다시 저장해도 version 이 유지된다', async () => {
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({
      version: 2,
      cards: { 'it-terms:LLM': { streak: 2, due: '2099-01-01', last: '2026-01-01' } },
    }));
    await recordResult('it-terms', 'Agent', 'correct');

    const stored = await readRaw() as { version: number; cards: Record<string, Card> };
    expect(stored.version).toBe(2);
    // 기존 카드가 남아 있어야 한다 — 읽은 걸 덮어쓰면 진도가 날아간다
    expect(stored.cards['it-terms:LLM'].streak).toBe(2);
    expect(stored.cards['it-terms:Agent'].streak).toBe(1);
  });

  it('모르는 상위 버전이 와도 버리지 않고 읽을 수 있는 만큼 읽는다', async () => {
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({
      version: 99,
      cards: { 'it-terms:LLM': { streak: 4, due: '2099-01-01', last: '2026-01-01' } },
    }));
    const loaded = await loadCards();
    expect(loaded['it-terms:LLM'].streak).toBe(4);
  });

  it('깨진 JSON 이면 빈 기록으로 시작하고 터지지 않는다', async () => {
    await AsyncStorage.setItem(V2_KEY, '{not json');
    await expect(loadCards()).resolves.toEqual({});
  });

  it('due 가 깨진 카드도 읽은 뒤 유효한 날짜를 가진다', async () => {
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({
      version: 2,
      cards: {
        'it-terms:LLM': { streak: 3, due: 'NaN-NaN-NaN', last: 'NaN-NaN-NaN' },
        'it-terms:Agent': { streak: 2 },
      },
    }));
    const loaded = await loadCards();
    expect(loaded['it-terms:LLM'].due).toMatch(YMD);
    expect(loaded['it-terms:Agent'].due).toMatch(YMD);
    // streak 는 지켜져야 한다 — 날짜가 깨졌다고 진도를 깎지 않는다
    expect(loaded['it-terms:LLM'].streak).toBe(3);
  });
});

describe('마이그레이션 — v1 평면 구조를 v2 로 옮긴다', () => {
  beforeEach(reset);

  it('v1 기록이 덱 접두사가 붙은 키로 옮겨진다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      LLM: { streak: 3, due: '2099-01-01', last: '2026-01-01' },
    }));

    const loaded = await loadCards();
    expect(loaded['it-terms:LLM']).toEqual({
      streak: 3, due: '2099-01-01', last: '2026-01-01',
    });
    // 옛 평면 키는 남지 않는다
    expect(loaded.LLM).toBeUndefined();
  });

  /**
   * 일괄 `it-terms:` 접두사가 아니라 **실제로 어느 덱에 있는지 찾아서**
   * 귀속시킨다. 영단어 덱에만 있는 단어가 it-terms 로 들어가면
   * 그 진도는 영구히 안 보인다.
   */
  it('영단어 덱에만 있는 단어는 it-words 로 귀속된다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      deprecated: { streak: 2, due: '2099-01-01', last: '2026-01-01' },
    }));

    const loaded = await loadCards();
    expect(loaded['it-words:deprecated']?.streak).toBe(2);
    expect(loaded['it-terms:deprecated']).toBeUndefined();
  });

  it('두 덱에 다 있으면 it-terms 를 먼저 쓴다 — 424개로 압도적이다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      Rollback: { streak: 5, due: '2099-01-01', last: '2026-01-01' },
    }));

    const loaded = await loadCards();
    expect(loaded['it-terms:Rollback']?.streak).toBe(5);
  });

  it('어느 덱에도 없는 옛 단어는 버리지 않고 it-terms 로 둔다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      '존재하지않는단어XYZ': { streak: 1, due: '2099-01-01', last: '2026-01-01' },
    }));

    const loaded = await loadCards();
    expect(loaded['it-terms:존재하지않는단어XYZ']?.streak).toBe(1);
  });

  it('옮긴 뒤 v2 키에 저장되고 v1 키는 지워진다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      LLM: { streak: 3, due: '2099-01-01', last: '2026-01-01' },
    }));
    await loadCards();

    expect(await AsyncStorage.getItem(V1_KEY)).toBeNull();
    const stored = await readRaw() as { version: number; cards: Record<string, Card> };
    expect(stored.version).toBe(2);
    expect(stored.cards['it-terms:LLM'].streak).toBe(3);
  });

  it('마이그레이션은 한 번만 돈다 — 두 번째 읽기는 v2 를 쓴다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      LLM: { streak: 3, due: '2099-01-01', last: '2026-01-01' },
    }));
    await loadCards();

    // v1 이 지워졌으니, 캐시를 비우고 다시 읽어도 v2 에서 와야 한다
    await clearCards();
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({
      version: 2,
      cards: { 'it-terms:LLM': { streak: 3, due: '2099-01-01', last: '2026-01-01' } },
    }));
    const again = await loadCards();
    expect(again['it-terms:LLM'].streak).toBe(3);
    expect(Object.keys(again)).toHaveLength(1);
  });

  it('v2 가 이미 있으면 v1 을 보지 않는다 — 새 진도를 덮지 않는다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      LLM: { streak: 1, due: '2000-01-01', last: '2000-01-01' },
    }));
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({
      version: 2,
      cards: { 'it-terms:LLM': { streak: 6, due: '2099-01-01', last: '2026-11-01' } },
    }));

    const loaded = await loadCards();
    expect(loaded['it-terms:LLM'].streak).toBe(6);
  });

  /**
   * 손상된 v1 레코드. `safeStreak` 가 다루던 값들이 마이그레이션을
   * 거쳐도 due 가 NaN 이 되지 않아야 한다 — 한 번 NaN 이 되면
   * 저장소에 그대로 굳어 앱을 다시 켜도 낫지 않는다.
   */
  it('손상된 v1 레코드가 마이그레이션을 거쳐도 안전하다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      a: { streak: -1, due: '2099-01-01', last: '2026-01-01' },
      b: { streak: '3', due: '2099-01-01', last: '2026-01-01' },
      c: { streak: null, due: 'NaN-NaN-NaN', last: 'NaN-NaN-NaN' },
      d: { streak: 1.7, due: '2099-01-01', last: '2026-01-01' },
      e: {},
      f: null,
      g: 'not an object',
      h: 42,
    }));

    const loaded = await loadCards();
    for (const [key, card] of Object.entries(loaded)) {
      expect(card.due).toMatch(YMD);
      expect(card.due).not.toContain('NaN');
      expect(card.last).toMatch(YMD);
      expect(Number.isInteger(card.streak)).toBe(true);
      expect(card.streak).toBeGreaterThanOrEqual(0);
      expect(key.startsWith('it-terms:') || key.startsWith('it-words:')).toBe(true);
    }
    // 객체가 아닌 레코드는 버린다 — 카드로 만들 수가 없다
    expect(loaded['it-terms:f']).toBeUndefined();
    expect(loaded['it-terms:g']).toBeUndefined();
    expect(loaded['it-terms:h']).toBeUndefined();
    // 숫자가 아닌 streak("3")은 0 으로 떨어뜨린다 — safeStreak 와 같은 규칙이다.
    // 문자열을 숫자로 고쳐 주면 "3"+1="31" 같은 경로를 되살릴 여지가 생긴다.
    expect(loaded['it-terms:b'].streak).toBe(0);
    // 소수는 내림해서 살린다
    expect(loaded['it-terms:d'].streak).toBe(1);
    // 음수는 0 으로
    expect(loaded['it-terms:a'].streak).toBe(0);
  });

  it('마이그레이션한 기록이 그대로 복습 대상으로 잡힌다', async () => {
    // due 가 지났고 오늘 안 풀었다 → Due
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      LLM: { streak: 1, due: '2000-01-01', last: '2000-01-01' },
      Agent: { streak: 1, due: '2000-01-01', last: '2000-01-01' },
    }));

    const cards = await loadCards();
    expect(countDue(cards, 'it-terms', ['LLM', 'Agent'])).toBe(2);
    expect(countNew(cards, 'it-terms', ['LLM', 'Agent'])).toBe(0);
  });
});

describe('덱 분리 — 같은 단어가 덱마다 독립적으로 기록된다', () => {
  beforeEach(reset);

  /**
   * ★ 이슈 #17 의 재현 시나리오.
   *
   * 두 덱에 겹치는 단어 4건(`Rollback`, `Incident`, `Postmortem`, `Legacy`).
   * 실제 데이터는 대소문자가 달라서(`Rollback` / `rollback`) 지금 당장
   * 충돌하지는 않지만, 덱을 추가하면 정확히 겹치는 것이 생긴다.
   * 그래서 **대소문자가 같을 때도** 갈리는지를 본다.
   */
  it('같은 철자라도 덱이 다르면 기록이 갈린다', async () => {
    await recordResult('it-terms', 'Rollback', 'correct');

    const cards = await loadCards();
    // it-terms 쪽만 기록이 있다
    expect(cards['it-terms:Rollback'].streak).toBe(1);
    expect(cards['it-words:Rollback']).toBeUndefined();

    // 영단어 덱에서는 아직 처음 보는 단어다
    expect(countNew(cards, 'it-words', ['Rollback'])).toBe(1);
    expect(countNew(cards, 'it-terms', ['Rollback'])).toBe(0);
  });

  it('한 덱에서 틀려도 다른 덱의 streak 가 깎이지 않는다', async () => {
    await recordResult('it-terms', 'Incident', 'correct');
    await recordResult('it-terms', 'Incident', 'correct');
    await recordResult('it-words', 'Incident', 'wrong');

    const cards = await loadCards();
    expect(cards['it-terms:Incident'].streak).toBe(2);
    expect(cards['it-words:Incident'].streak).toBe(0);
  });

  it('겹치는 4건 전부가 덱마다 독립적이다', async () => {
    const shared = ['Rollback', 'Incident', 'Postmortem', 'Legacy'];
    for (const w of shared) await recordResult('it-terms', w, 'correct');

    const cards = await loadCards();
    // it-terms 는 전부 기록됐고, it-words 는 하나도 기록되지 않았다
    expect(countNew(cards, 'it-terms', shared)).toBe(0);
    expect(countNew(cards, 'it-words', shared)).toBe(shared.length);
  });

  it('countDue 도 덱을 구분한다', async () => {
    await AsyncStorage.setItem(V2_KEY, JSON.stringify({
      version: 2,
      cards: {
        // it-terms 쪽만 복습할 때가 됐다
        'it-terms:Rollback': { streak: 1, due: '2000-01-01', last: '2000-01-01' },
        'it-words:Rollback': { streak: 1, due: '2099-01-01', last: '2026-11-01' },
      },
    }));

    const cards = await loadCards();
    expect(countDue(cards, 'it-terms', ['Rollback'])).toBe(1);
    expect(countDue(cards, 'it-words', ['Rollback'])).toBe(0);
  });
});

describe('clearCards', () => {
  beforeEach(reset);

  it('지우면 v1 키도 함께 지워진다 — 다음 읽기에 진도가 되살아나면 안 된다', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({
      LLM: { streak: 3, due: '2099-01-01', last: '2026-01-01' },
    }));
    await recordResult('it-terms', 'Agent', 'correct');

    await clearCards();
    expect(await AsyncStorage.getItem(V1_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(V2_KEY)).toBeNull();
    await expect(loadCards()).resolves.toEqual({});
  });
});

/**
 * 내보내기.
 *
 * 내보낸 JSON 은 사용자가 가진 **마지막 사본**이 될 수 있다. 그래서
 * 이 파일이 지키는 것은 두 가지다 — (1) 저장 구조 v2 와 같은 모양이라
 * 나중에 가져오기를 붙일 때 그대로 읽힌다, (2) 기록이 비었거나 깨져 있어도
 * 터지지 않고 유효한 JSON 이 나온다.
 */
describe('buildExport', () => {
  const sample: Record<string, Card> = {
    'it-terms:LLM': { streak: 3, due: '2099-01-01', last: '2026-01-01' },
    'it-words:rollback': { streak: 0, due: '2026-11-17', last: '2026-11-16' },
  };

  it('v2 구조(version·cards)를 그대로 유지한다', () => {
    const parsed = JSON.parse(buildExport(sample));
    expect(parsed.version).toBe(2);
    expect(parsed.cards).toEqual(sample);
  });

  it('덱별 카드 키(덱:단어)가 보존된다', () => {
    const parsed = JSON.parse(buildExport(sample));
    // 키가 뭉개지면 두 덱의 같은 단어가 한 칸으로 합쳐진다
    expect(Object.keys(parsed.cards).sort())
      .toEqual(['it-terms:LLM', 'it-words:rollback']);
  });

  it('빈 기록이어도 유효한 JSON 을 만든다', () => {
    const parsed = JSON.parse(buildExport({}));
    expect(parsed.version).toBe(2);
    expect(parsed.cards).toEqual({});
  });

  it('내보낸 시각과 앱 표시를 담는다 — 사본이 여러 개 쌓일 때 구분용', () => {
    const at = new Date('2026-11-16T01:02:03.000Z');
    const parsed = JSON.parse(buildExport(sample, at));
    expect(parsed.exportedAt).toBe('2026-11-16T01:02:03.000Z');
    expect(parsed.app).toBe('wordbook');
  });

  it('깨진 카드는 걸러서 내보낸다 — 백업이 같이 깨지면 복구할 게 없다', () => {
    const broken = {
      'it-terms:A': { streak: 'x', due: 'nope', last: 1 },
      'it-terms:B': null,
    } as unknown as Record<string, Card>;
    const parsed = JSON.parse(buildExport(broken));
    // B 는 카드가 아니라 버리고, A 는 날짜를 오늘로 되살린다
    expect(parsed.cards['it-terms:B']).toBeUndefined();
    expect(parsed.cards['it-terms:A'].streak).toBe(0);
    expect(parsed.cards['it-terms:A'].due).toMatch(YMD);
    expect(parsed.cards['it-terms:A'].last).toMatch(YMD);
  });

  it('내보낸 JSON 을 저장소에 그대로 넣으면 loadCards 가 읽는다', async () => {
    await reset();
    // 가져오기를 나중에 붙일 수 있다는 전제를 여기서 못 박는다
    await AsyncStorage.setItem(V2_KEY, buildExport(sample));
    await expect(loadCards()).resolves.toEqual(sample);
  });
});

describe('today', () => {
  it('YYYY-MM-DD 형식이다', () => {
    expect(today()).toMatch(YMD);
  });

  it('UTC 가 아니라 기기 로컬 날짜다 — 한국에서 오전 9시에 날짜가 바뀌면 안 된다', () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    expect(today()).toBe(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  });
});
