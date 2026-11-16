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

const KEY = 'srs-v2';
/** v1 기록. 덱 구분이 없는 평면 구조라 읽어서 옮긴다(§migrateV1). */
const V1_KEY = 'srs-v1';
/** 옛 기록. 하루치뿐이라 옮기지 않고 지우기만 한다. */
const OLD_KEY = 'daily-correct-v1';

/**
 * 저장 구조의 현재 버전.
 *
 * 키 이름(`srs-v2`)에만 버전이 있으면 읽는 쪽이 데이터 모양을 확인할 수
 * 없다. `Card` 에 필드를 추가하는 순간 기존 데이터에는 그 필드가 없는데
 * `loadCards` 가 그대로 통과시켜서, `priorityOf` 의 `card.due <= now` 가
 * undefined 비교로 전부 false 가 되고 복습이 조용히 멈춘다.
 * 데이터 안에 버전을 넣어 두면 그때 분기할 자리가 생긴다.
 */
const VERSION = 2;

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

/**
 * 카드 묶음. 키는 `cardKey(deckId, word)` 가 만든 `덱:단어` 다.
 *
 * 단어만 키로 쓰면 두 덱의 같은 단어가 같은 칸을 쓴다. 지금 두 덱에서
 * 대소문자만 다른 단어가 4건(`Rollback`/`rollback`, `Incident`,
 * `Postmortem`, `Legacy`) 있고, 덱이 늘어나면 정확히 겹치는 것도 생긴다.
 */
export type Cards = Record<string, Card>;

/** 디스크에 올라가는 모양. `version` 이 데이터 안에 있다. */
type StoredV2 = { version: 2; cards: Cards };

/** v1 모양 — 버전 없이 `{ [word]: Card }` 평면 구조 */
type StoredV1 = Record<string, Card>;

/**
 * 카드 키. 덱이 다르면 같은 단어도 다른 기록이 된다.
 *
 * **정규화하지 않는다** — 덱 JSON 의 `word` 를 그대로 쓴다.
 * 소문자로 낮추면 `Rollback`(IT 용어)과 `rollback`(영단어)이 한 칸에
 * 합쳐질 뻔하지만, 그건 이미 `deckId` 가 갈라 준다. 반대로 정규화는
 * 손실만 남긴다. 덱 안에서는 `word` 가 대소문자 구분 없이도 유일하고
 * (`data.test.ts` 가 정확 중복을 막는다), 키는 항상 덱 데이터에서 오지
 * 사용자 입력에서 오지 않으므로 같은 단어가 갈릴 경로가 없다.
 */
export function cardKey(deckId: string, word: string): string {
  return `${deckId}:${word}`;
}

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

let cache: Cards | null = null;

/**
 * 카드 하나를 믿을 수 있는 모양으로 만든다. 못 쓰면 null.
 *
 * 저장소에서 온 값은 어떤 모양이든 올 수 있다. 여기서 한 번 걸러 두면
 * `priorityOf` 가 `undefined` 날짜를 비교해 복습이 멈추는 일이 없다.
 * streak 의 세부 보정은 `nextCard` 의 `safeStreak` 가 다시 한다 —
 * 여기서는 날짜만 반드시 유효하게 만든다.
 */
function reviveCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<Card>;
  const ymdOk = (v: unknown): v is string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  // due 가 깨졌으면 오늘로 둔다 — 복습 대상으로 잡혀 한 번 더 물어본다.
  // 버리는 쪽(= 처음 보는 단어)보다 streak 를 지키는 쪽이 손실이 적다.
  const due = ymdOk(c.due) ? c.due : today();
  const last = ymdOk(c.last) ? c.last : due;
  const streak =
    typeof c.streak === 'number' && Number.isFinite(c.streak)
      ? Math.max(0, Math.floor(c.streak))
      : 0;
  return { streak, due, last };
}

/** 어떤 모양이 와도 쓸 수 있는 카드만 남긴다. */
function reviveCards(raw: unknown): Cards {
  const out: Cards = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const card = reviveCard(value);
    if (card) out[key] = card;
  }
  return out;
}

/**
 * v1 기록을 v2 키로 옮긴다.
 *
 * v1 은 `{ [word]: Card }` 라 덱 정보가 없다. 단어가 실제로 어느 덱에
 * 있는지 덱 데이터에서 **찾아서** 귀속시킨다 — `it-terms` 를 먼저 보고,
 * 없으면 `it-words` 를 본다. 접두사를 일괄로 붙이는 쪽(`it-terms:` 고정)
 * 보다 정확하고 비용도 같다. it-terms 가 424개로 압도적이라 일괄도 대개
 * 맞지만, 영단어 덱에서만 푼 단어 80개가 통째로 엉뚱한 키로 들어가면
 * 그 진도는 영구히 안 보인다.
 *
 * 어느 덱에도 없는 단어(데이터에서 빠진 옛 단어)는 `it-terms:` 로 둔다.
 * 버리면 복구가 안 되지만, 남겨 두면 덱에 다시 들어올 때 살아난다.
 */
function migrateV1(v1: StoredV1, lookup: (word: string) => string | null): Cards {
  const out: Cards = {};
  for (const [word, raw] of Object.entries(v1)) {
    const card = reviveCard(raw);
    if (!card) continue;
    out[cardKey(lookup(word) ?? 'it-terms', word)] = card;
  }
  return out;
}

/**
 * 단어가 속한 덱을 찾는다. `decks.ts` 를 정적으로 import 하지 않는 이유는
 * srs.ts → decks.ts → data/*.json 순환을 만들지 않기 위해서다.
 * 마이그레이션 때 한 번만 쓰므로 그때 읽는다.
 */
function deckLookup(): (word: string) => string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DECKS } = require('./decks') as {
      DECKS: { id: string; words: { word: string }[] }[];
    };
    const index = new Map<string, string>();
    // 뒤 덱이 앞 덱을 덮지 않도록 먼저 넣은 쪽을 남긴다(it-terms 우선)
    for (const deck of DECKS) {
      for (const w of deck.words) {
        if (!index.has(w.word)) index.set(w.word, deck.id);
      }
    }
    return (word) => index.get(word) ?? null;
  } catch (e) {
    console.warn('[srs] 덱 조회 실패, it-terms 로 귀속:', e);
    return () => null;
  }
}

/**
 * 전체 기록을 읽는다. 실패하면 빈 기록으로 시작한다(학습을 막지 않는다).
 *
 * 버전별 분기:
 *   version 2       → 그대로 (카드는 한 번 걸러서)
 *   version 없음    → v1 평면 구조로 보고 옮긴다
 *   version 3 이상  → 버리지 않는다. 아는 만큼만(= Card 모양인 것만) 읽는다.
 *                     앞 버전으로 되돌린 사용자의 진도를 날리지 않기 위해서다.
 */
export async function loadCards(): Promise<Cards> {
  if (cache) return cache;
  cache = {};
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        const version = (parsed as Partial<StoredV2>).version;
        if (version === VERSION) {
          cache = reviveCards((parsed as StoredV2).cards);
        } else if (typeof version === 'number' && version > VERSION) {
          // 모르는 상위 버전. cards 가 있으면 거기서, 없으면 통째로 긁는다.
          const maybe = (parsed as Partial<StoredV2>).cards;
          cache = reviveCards(maybe && typeof maybe === 'object' ? maybe : parsed);
          console.warn(`[srs] 모르는 저장 버전 ${version}, 읽을 수 있는 것만 읽음`);
        } else {
          // 버전 필드가 없다 = v2 키에 v1 모양이 들어 있다(이례적이지만 안전하게)
          cache = migrateV1(parsed as StoredV1, deckLookup());
        }
        return cache;
      }
    }
  } catch (e) {
    console.warn('[srs] 읽기 실패, 빈 기록으로 시작:', e);
  }

  // v2 가 없으면 v1 을 찾아 한 번 옮긴다. 옮긴 뒤 v1 키는 지운다 —
  // 남겨 두면 다음 실행에서 또 읽혀 v2 의 갱신분을 덮어쓴다.
  try {
    const legacy = await AsyncStorage.getItem(V1_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      if (parsed && typeof parsed === 'object') {
        cache = migrateV1(parsed as StoredV1, deckLookup());
        await save();
        await AsyncStorage.removeItem(V1_KEY);
        console.warn(`[srs] v1 기록 ${Object.keys(cache).length}개를 v2 로 옮겼다`);
      }
    }
  } catch (e) {
    // 마이그레이션이 실패해도 앱은 돌아야 한다. 이번엔 빈 기록으로 가고
    // v1 키는 지우지 않으므로 다음 실행에서 다시 시도한다.
    console.warn('[srs] v1 마이그레이션 실패, 빈 기록으로 시작:', e);
  }

  // 옛 키는 더 쓰지 않는다. 남겨두면 저장소만 차지한다.
  AsyncStorage.removeItem(OLD_KEY).catch(() => {});
  return cache;
}

async function save(): Promise<void> {
  if (!cache) return;
  try {
    const payload: StoredV2 = { version: VERSION, cards: cache };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[srs] 저장 실패:', e);
  }
}

/**
 * 저장소에서 읽은 streak 을 믿을 수 있는 수로 만든다.
 *
 * `loadCards()` 는 JSON 이 객체인지만 보고 카드 하나하나는 검사하지 않는다.
 * 그래서 깨진 기록(문자열 "3", 음수, NaN)이 그대로 여기까지 올 수 있다.
 * 그걸 막지 않으면:
 *   "3"  → streak 이 "31" 로 문자열 연결되고 간격이 60일로 튄다
 *   -1   → INTERVALS[-1] 이 undefined → addDays(undefined) → due 가 "NaN-NaN-NaN"
 * due 가 NaN 이 되면 `priorityOf` 의 날짜 비교가 영구히 어긋나고,
 * 그 값이 AsyncStorage 에 그대로 저장돼 앱을 다시 켜도 낫지 않는다.
 */
function safeStreak(streak: unknown): number {
  if (typeof streak !== 'number' || !Number.isFinite(streak)) return 0;
  return Math.max(0, Math.floor(streak));
}

/**
 * 한 문제를 푼 결과로 다음 카드 상태를 계산한다. 저장은 하지 않는다.
 * 순수 함수라 테스트하기 쉽고, 화면에서도 같은 결과를 바로 쓸 수 있다.
 */
export function nextCard(
  prev: Card | undefined,
  grade: 'correct' | 'close' | 'wrong',
): Card {
  const streak = grade === 'correct' ? safeStreak(prev?.streak) + 1 : 0;
  // streak 는 correct 일 때 항상 1 이상이라 인덱스가 음수로 내려가지 않는다.
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
  deckId: string,
  word: string,
  grade: 'correct' | 'close' | 'wrong',
): Promise<Card> {
  const cards = await loadCards();
  const key = cardKey(deckId, word);
  const card = nextCard(cards[key], grade);
  cards[key] = card;
  await save();
  return card;
}

/** 기록 전체 삭제 (디버그·초기화용) */
export async function clearCards(): Promise<void> {
  cache = null;
  try {
    // v1 키도 함께 지운다. 남겨 두면 다음 loadCards 가 그걸 읽어
    // 방금 지운 진도가 되살아난다.
    await AsyncStorage.multiRemove([KEY, V1_KEY]);
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
export function countDue(cards: Cards, deckId: string, words: string[]): number {
  const now = today();
  let n = 0;
  for (const w of words) {
    const p = priorityOf(cards[cardKey(deckId, w)], now);
    if (p === Priority.Due || p === Priority.Relearn) n++;
  }
  return n;
}

/** 아직 한 번도 안 본 단어 수 */
export function countNew(cards: Cards, deckId: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (!cards[cardKey(deckId, w)]) n++;
  return n;
}
