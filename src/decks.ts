import type { QuizMode, Word } from './types';
import { ALL_MODES } from './types';

import itTerms from '../data/it_terms.json';
import itWords from '../data/it_words.json';

export type DeckId = 'it-terms' | 'it-words';

export type Deck = {
  id: DeckId;
  name: string;
  /** 시작 화면에서 한 줄로 보여줄 설명 */
  description: string;
  /** 이 덱에서 쓸 수 있는 출제 방식 */
  modes: QuizMode[];
  words: Word[];
};

/**
 * 뜻이 서술형인 덱에서 쓰는 방식.
 *
 * IT 용어의 뜻은 문장이다 — 301개의 meanings[0] 이 중간값 22자, 15자
 * 이상이 93%, 최대 40자다("고객 현장에 들어가 제품을 맞춰 붙이고 요구를
 * 개발팀에 전달하는 엔지니어"). 받아쓸 수 있는 길이가 아니라서, 뜻을
 * 알아도 자기 말로 짧게 쓰게 되고 유사도가 0.85 를 못 넘어 오답이 된다.
 * 아는데 틀리는 구조라 주관식을 뺀다.
 *
 * 뜻→용어 주관식도 함께 뺀다. 복수/단수형을 인정하려면 끝의 s 를 떼야
 * 하는데 그러면 DevOp·Kubernete·regardles 같은 없는 말을 정답으로 받는다.
 * 예외 규칙을 쌓아 덮을 수는 있지만 하나를 맞히려고 다른 걸 틀리게 할
 * 위험이 더 크다.
 */
const CHOICE_ONLY: QuizMode[] = ['choice-term-to-meaning', 'choice-meaning-to-term'];

export const DECKS: Deck[] = [
  {
    id: 'it-terms',
    name: 'IT 개발 용어',
    description: '면접에서 바로 나오는 용어·약어',
    modes: CHOICE_ONLY,
    words: itTerms as Word[],
  },
  {
    id: 'it-words',
    // 뜻이 짧고(10자 이하가 56%) 80개 전부 near 를 들고 있어서
    // 표현이 달라도 데이터로 잡힌다. 주관식이 제대로 동작한다.
    name: 'IT 문서 영단어',
    description: '기술 문서·에러 메시지에 자주 쓰이는 어휘',
    modes: ALL_MODES,
    words: itWords as Word[],
  },
];

/** 덱이 지원하지 않는 방식을 걸러낸다. 저장된 설정에 남아 있을 수 있다. */
export function allowedModes(deck: Deck, modes: QuizMode[]): QuizMode[] {
  return modes.filter((m) => deck.modes.includes(m));
}

export function getDeck(id: DeckId): Deck {
  const deck = DECKS.find((d) => d.id === id);
  if (!deck) throw new Error(`unknown deck: ${id}`);
  return deck;
}

/** 덱에 들어 있는 분야 목록 (등장 순서 유지) */
export function fieldsOf(deck: Deck): string[] {
  const seen: string[] = [];
  for (const w of deck.words) {
    if (!seen.includes(w.partOfSpeech)) seen.push(w.partOfSpeech);
  }
  return seen;
}

/** 덱에 들어 있는 레벨 목록 (오름차순) */
export function levelsOf(deck: Deck): number[] {
  const seen = new Set<number>();
  for (const w of deck.words) {
    if (w.level != null) seen.add(w.level);
  }
  return [...seen].sort((a, b) => a - b);
}

export type Filter = {
  /** 비어 있으면 전체 */
  levels: number[];
  /** 비어 있으면 전체 */
  fields: string[];
};

export function applyFilter(deck: Deck, filter: Filter): Word[] {
  return deck.words.filter((w) => {
    if (filter.levels.length > 0) {
      if (w.level == null || !filter.levels.includes(w.level)) return false;
    }
    if (filter.fields.length > 0) {
      if (!filter.fields.includes(w.partOfSpeech)) return false;
    }
    return true;
  });
}
