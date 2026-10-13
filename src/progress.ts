import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 오늘 맞힌 횟수 기록.
 *
 * 같은 날 여러 번 맞힌 단어는 출제 확률을 낮추는 데 쓴다.
 * 날짜가 바뀌면 자동으로 비워진다 — 저장할 때 날짜를 함께 두고,
 * 읽을 때 날짜가 다르면 버리는 방식이라 따로 정리할 필요가 없다.
 */

const KEY = 'daily-correct-v1';

type Stored = {
  /** 기기 로컬 날짜 YYYY-MM-DD */
  date: string;
  /** 용어 → 오늘 맞힌 횟수 */
  counts: Record<string, number>;
};

/** 기기 로컬 날짜. UTC를 쓰면 한국에서 오전 9시에 날짜가 바뀐다. */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let cache: Stored | null = null;

/** 오늘 기록을 읽는다. 날짜가 지났으면 빈 기록으로 시작한다. */
export async function loadToday(): Promise<Record<string, number>> {
  const now = today();
  if (cache && cache.date === now) return cache.counts;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.date === now && parsed.counts) {
        cache = parsed;
        return parsed.counts;
      }
    }
  } catch (e) {
    console.warn('[progress] 읽기 실패, 빈 기록으로 시작:', e);
  }
  cache = { date: now, counts: {} };
  return cache.counts;
}

/** 한 문제를 맞혔을 때 호출. 저장 실패는 학습을 막지 않으므로 삼킨다. */
export async function recordCorrect(word: string): Promise<void> {
  const counts = await loadToday();
  counts[word] = (counts[word] ?? 0) + 1;
  cache = { date: today(), counts };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[progress] 저장 실패:', e);
  }
}

/** 기록 전체 삭제 (디버그·초기화용) */
export async function clearProgress(): Promise<void> {
  cache = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn('[progress] 삭제 실패:', e);
  }
}
