import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 간격 반복(SRS) 기록.
 *
 * 단어마다 "다음에 보여줄 날짜"를 들고 있다. 맞히면 간격이 길어지고
 * 틀리면 하루로 돌아간다. 잊을 때쯤 다시 보여주는 게 목적이다.
 *
 * 이전 구조(daily-correct-v1)는 오늘 맞힌 횟수만 세고 날짜가 바뀌면
 * 통째로 버렸다. 그래서 어제 뭘 외웠는지가 남지 않았다.
 */

const KEY = 'srs-v1';
/** 옛 기록. 하루치뿐이라 옮기지 않고 지우기만 한다. */
const OLD_KEY = 'daily-correct-v1';

/**
 * 맞힌 횟수(streak)별 다음 간격(일).
 * streak 가 배열보다 커지면 마지막 값(60일)을 계속 쓴다.
 */
const INTERVALS = [1, 3, 7, 14, 30, 60];

/**
 * "비슷했어요"일 때의 간격(일).
 *
 * 뜻은 통했지만 정확히는 모르는 상태다. streak 를 올리지 않되
 * 틀린 것(1일)보다는 조금 길게 둔다. 내일 또 물으면 같은 답을
 * 또 쓸 가능성이 높아 배우는 게 없다.
 */
const CLOSE_INTERVAL = 2;

export type Card = {
  /** 연속으로 맞힌 횟수. 틀리면 0으로 돌아간다 */
  streak: number;
  /** 다음에 출제할 날짜 YYYY-MM-DD */
  due: string;
  /** 마지막으로 푼 날 YYYY-MM-DD */
  last: string;
};

type Stored = Record<string, Card>;

/** 기기 로컬 날짜. UTC를 쓰면 한국에서 오전 9시에 날짜가 바뀐다. */
export function today(): string {
  return ymd(new Date());
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 오늘로부터 days 일 뒤의 날짜.
 *
 * Date 에 일수를 더하는 방식이라 월말·윤년·서머타임을 JS 가 알아서 넘긴다.
 * 문자열을 직접 더하면 1월 31일 + 1일 같은 데서 깨진다.
 */
function addDays(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);   // 서머타임 경계에서 날짜가 밀리지 않게 정오 기준
  d.setDate(d.getDate() + days);
  return ymd(d);
}

let cache: Stored | null = null;

/** 전체 기록을 읽는다. 실패하면 빈 기록으로 시작한다(학습을 막지 않는다). */
export async function loadCards(): Promise<Stored> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed && typeof parsed === 'object') {
        cache = parsed;
        return cache;
      }
    }
  } catch (e) {
    console.warn('[srs] 읽기 실패, 빈 기록으로 시작:', e);
  }
  cache = {};
  // 옛 키는 더 쓰지 않는다. 남겨두면 저장소만 차지한다.
  AsyncStorage.removeItem(OLD_KEY).catch(() => {});
  return cache;
}

async function save(): Promise<void> {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[srs] 저장 실패:', e);
  }
}

/**
 * 한 문제를 푼 결과로 다음 카드 상태를 계산한다. 저장은 하지 않는다.
 * 순수 함수라 테스트하기 쉽고, 화면에서도 같은 결과를 바로 쓸 수 있다.
 */
export function nextCard(
  prev: Card | undefined,
  grade: 'correct' | 'close' | 'wrong',
): Card {
  const streak = grade === 'correct' ? (prev?.streak ?? 0) + 1 : 0;
  const days =
    grade === 'correct'
      ? INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)]
      : grade === 'close'
        ? CLOSE_INTERVAL
        : 1;
  return { streak, due: addDays(days), last: today() };
}

/**
 * 한 문제를 푼 결과를 기록한다. 저장 실패는 학습을 막지 않으므로 삼킨다.
 * 갱신된 카드를 돌려주므로 호출부가 같은 계산을 다시 할 필요가 없다.
 */
export async function recordResult(
  word: string,
  grade: 'correct' | 'close' | 'wrong',
): Promise<Card> {
  const cards = await loadCards();
  const card = nextCard(cards[word], grade);
  cards[word] = card;
  await save();
  return card;
}

/** 기록 전체 삭제 (디버그·초기화용) */
export async function clearCards(): Promise<void> {
  cache = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn('[srs] 삭제 실패:', e);
  }
}

/* ────────────────────────────────────────────────────────────────
 * 출제 우선순위
 * ──────────────────────────────────────────────────────────────── */

/** 출제 우선순위. 숫자가 작을수록 먼저 낸다. */
export const enum Priority {
  /** 오늘 틀린 것 — 바로 다시 봐야 한다 */
  Relearn = 0,
  /** 복습할 때가 된 것 — 잊기 직전이라 가장 급하다 */
  Due = 1,
  /** 아직 한 번도 안 본 것 */
  New = 2,
  /** 아직 볼 때가 아닌 것 — 자리가 남을 때만 */
  Later = 3,
}

/**
 * 단어 하나의 출제 우선순위를 본다.
 *
 * 오늘 이미 **맞힌** 단어는 Later 로 내린다. 같은 날 같은 단어가 반복되면
 * 간격 반복의 의미가 없다 — 이전 구조의 "오늘 2번 맞히면 1/4" 가
 * 하던 일을 여기서 대신한다.
 *
 * 다만 오늘 **틀린** 단어는 Relearn 으로 맨 앞에 둔다. 틀린 것을 다음 날까지
 * 못 보게 막으면 '다시 풀기'로 오답을 복습하는 흐름이 끊긴다.
 * due 는 이미 내일로 잡혀 있어 내일도 다시 나온다.
 */
export function priorityOf(card: Card | undefined, now: string): Priority {
  if (!card) return Priority.New;
  if (card.last === now) {
    // streak 0 = 오늘 틀렸거나 "비슷했어요"였다는 뜻
    return card.streak === 0 ? Priority.Relearn : Priority.Later;
  }
  return card.due <= now ? Priority.Due : Priority.Later;
}

/**
 * 지금 풀 거리가 되는 단어 수. 화면에 "오늘 복습 N개"를 띄울 때 쓴다.
 * 복습할 때가 된 것과 오늘 틀린 것을 함께 센다 — 둘 다 지금 봐야 할 것이다.
 */
export function countDue(cards: Stored, words: string[]): number {
  const now = today();
  let n = 0;
  for (const w of words) {
    const p = priorityOf(cards[w], now);
    if (p === Priority.Due || p === Priority.Relearn) n++;
  }
  return n;
}

/** 아직 한 번도 안 본 단어 수 */
export function countNew(cards: Stored, words: string[]): number {
  let n = 0;
  for (const w of words) if (!cards[w]) n++;
  return n;
}
