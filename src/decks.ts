import type { Word } from './types';

import itTerms from '../data/it_terms.json';
import itWords from '../data/it_words.json';

export type DeckId = 'it-terms' | 'it-words';

export type Deck = {
  id: DeckId;
  name: string;
  /** 시작 화면에서 한 줄로 보여줄 설명 */
  description: string;
  words: Word[];
};

export const DECKS: Deck[] = [
  {
    id: 'it-terms',
    name: 'IT 개발 용어',
    description: '면접에서 바로 나오는 용어·약어',
    words: itTerms as Word[],
  },
  {
    id: 'it-words',
    name: 'IT 문서 영단어',
    description: '기술 문서·에러 메시지에 자주 쓰이는 어휘',
    words: itWords as Word[],
  },
];

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
