import type { Card } from './srs';
import { Priority, nextCard, priorityOf, today } from './srs';

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
