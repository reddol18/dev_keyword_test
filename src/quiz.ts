import type { Question, QuizMode, Word } from './types';
import { isChoiceMode } from './types';
import { buildChoices } from './choices';
import { shuffle } from './grading';
import type { Card } from './srs';
import { Priority, priorityOf, today } from './srs';

/**
 * 한 회차에 최소한 이만큼은 처음 보는 단어를 넣는다.
 *
 * 우선순위만 따르면 복습이 자리를 다 차지해 새 단어가 거의 안 들어온다.
 * 301개 덱에서 하루 10문제로 90일을 돌려 보면 23%(69개)밖에 못 본다.
 * 두 자리를 떼어 두면 63%(191개)까지 올라간다. 면접 대비용이라
 * "덱을 한 바퀴 도는 것"도 복습만큼 중요해서 이 비용을 치른다.
 */
const MIN_NEW = 2;

/**
 * 간격 반복 순서로 count개를 중복 없이 뽑는다.
 *
 * 오늘 틀린 것 → 복습할 때가 된 것 → 처음 보는 것 → 나머지 순이되,
 * 처음 보는 단어 자리를 MIN_NEW 개 먼저 떼어 둔다.
 *
 * 복습 대상이 count 보다 많으면 **밀린 것부터**(due 가 오래된 순) 낸다.
 * 무작위로 뽑으면 오래 밀린 단어가 계속 안 나올 수 있다.
 * 나머지 묶음은 섞어서 순서가 매번 같지 않게 한다.
 *
 * 뽑을 수 있는 수가 count보다 적으면 있는 만큼만 돌려준다.
 */
function srsPick(
  pool: Word[],
  count: number,
  cards: Record<string, Card>,
): Word[] {
  const now = today();
  const groups: Word[][] = [[], [], [], []];   // Relearn / Due / New / Later
  for (const w of pool) groups[priorityOf(cards[w.word], now)].push(w);

  // 복습 대상만 밀린 순으로. 나머지는 섞는다.
  groups[Priority.Due].sort(
    (a, b) => (cards[a.word]?.due ?? '').localeCompare(cards[b.word]?.due ?? ''),
  );
  groups[Priority.Relearn] = shuffle(groups[Priority.Relearn]);
  groups[Priority.New] = shuffle(groups[Priority.New]);
  groups[Priority.Later] = shuffle(groups[Priority.Later]);

  // 새 단어 자리를 먼저 확보한다. 새 단어가 없으면 그만큼 복습이 더 들어간다.
  const fresh = groups[Priority.New].splice(0, Math.min(MIN_NEW, count));
  const rest = groups.flat();

  // 섞어서 내보낸다. 새 단어가 항상 1번 문제로 나오면 티가 난다.
  return shuffle([...fresh, ...rest.slice(0, count - fresh.length)]);
}

/**
 * 출제할 문제 목록을 만든다.
 *
 * modes 가 여러 개면 문제마다 번갈아 섞는다. 한 방식으로만 계속 나오면
 * 답하는 요령이 생겨서 실제로 외웠는지 확인이 안 된다.
 *
 * cards 를 주면 간격 반복 순서(복습할 것 → 새 것 → 나머지)로 뽑는다.
 * 안 주면 전부 '처음 보는 것'으로 취급되어 고르게 섞인다.
 */
export function buildQuiz(
  pool: Word[],
  modes: QuizMode[],
  count: number,
  cards: Record<string, Card> = {},
): Question[] {
  if (pool.length === 0 || modes.length === 0) return [];

  const picked = srsPick(pool, count, cards);
  const modeBag = shuffle(modes);

  return picked.map((word, i) => {
    const mode = modeBag[i % modeBag.length];
    const prompt =
      mode === 'type-meaning-to-term' || mode === 'choice-meaning-to-term'
        ? word.meanings[0]
        : word.word;

    if (!isChoiceMode(mode)) {
      return { word, mode, prompt };
    }
    const { choices, answerIndex } = buildChoices(word, pool, mode);
    return { word, mode, prompt, choices, answerIndex };
  });
}

/** 지문 위에 붙일 짧은 안내 — 무엇을 답해야 하는지 */
export function hintOf(mode: QuizMode): string {
  switch (mode) {
    case 'type-term-to-meaning':
      return '뜻을 입력하세요';
    case 'type-meaning-to-term':
      return '용어를 입력하세요';
    case 'choice-term-to-meaning':
      return '알맞은 뜻을 고르세요';
    case 'choice-meaning-to-term':
      return '알맞은 용어를 고르세요';
  }
}
