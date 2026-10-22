import { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { DeckId } from './decks';
import { DECKS, fieldsOf, getDeck, levelsOf } from './decks';
import type { Word } from './types';
import { deckIcon, fieldIcon, levelIcon } from './icons';
import { C, S } from './theme';

const LEVEL_LABEL: Record<number, string> = { 1: '기초', 2: '일반', 3: '면접 우선' };

/**
 * 단어-뜻 목록.
 *
 * 246개를 한 화면에서 훑는 용도라 SectionList를 쓴다. 분야별로 묶고
 * 헤더를 고정해(stickySectionHeaders) 스크롤 중에도 지금 보는 분야가 보이게 한다.
 */
export default function ListScreen({ onExit }: { onExit: () => void }) {
  const [deckId, setDeckId] = useState<DeckId>('it-terms');
  const [query, setQuery] = useState('');
  const [levels, setLevels] = useState<number[]>([]);
  const [fields, setFields] = useState<string[]>([]);

  const deck = getDeck(deckId);
  const availableLevels = useMemo(() => levelsOf(deck), [deck]);
  const availableFields = useMemo(() => fieldsOf(deck), [deck]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    // 용어·한국어 뜻·영문 풀네임을 함께 훑는다. 뜻만 기억나는 경우가 흔해서다.
    const hit = (w: Word) =>
      !q ||
      w.word.toLowerCase().includes(q) ||
      w.meanings.some((m) => m.toLowerCase().includes(q)) ||
      (w.near ?? []).some((n) => n.toLowerCase().includes(q)) ||
      (w.aliases ?? []).some((a) => a.toLowerCase().includes(q));

    const byField = new Map<string, Word[]>();
    for (const w of deck.words) {
      if (!hit(w)) continue;
      if (levels.length > 0 && (w.level == null || !levels.includes(w.level))) continue;
      if (fields.length > 0 && !fields.includes(w.partOfSpeech)) continue;
      const list = byField.get(w.partOfSpeech);
      if (list) list.push(w);
      else byField.set(w.partOfSpeech, [w]);
    }
    return [...byField.entries()].map(([title, data]) => ({ title, data }));
  }, [deck, query, levels, fields]);

  const total = useMemo(
    () => sections.reduce((n, s) => n + s.data.length, 0),
    [sections],
  );

  const toggleLevel = (lv: number) =>
    setLevels(levels.includes(lv) ? levels.filter((x) => x !== lv) : [...levels, lv]);

  const toggleField = (f: string) =>
    setFields(fields.includes(f) ? fields.filter((x) => x !== f) : [...fields, f]);

  const pickDeck = (id: DeckId) => {
    setDeckId(id);
    // 덱마다 레벨·분야 구성이 달라 초기화한다.
    // 안 그러면 이전 덱의 분야가 남아 결과가 0개가 된다.
    setLevels([]);
    setFields([]);
  };

  return (
    <View style={S.flex}>
      <View style={l.header}>
        <View style={l.topRow}>
          <Pressable onPress={onExit} hitSlop={12}>
            <Text style={l.exit}>← 뒤로</Text>
          </Pressable>
          <Text style={l.count}>{total}개</Text>
        </View>

        <View style={l.deckRow}>
          {DECKS.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => pickDeck(d.id)}
              style={[l.deckBtn, deckId === d.id && l.deckBtnOn]}
            >
              <Text style={[l.deckText, deckId === d.id && l.deckTextOn]}>
                {deckIcon(d.id)} {d.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={l.search}
          value={query}
          onChangeText={setQuery}
          placeholder="용어 · 뜻 · 풀네임으로 검색"
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        {availableLevels.length > 0 && (
          <View style={S.chipRow}>
            {availableLevels.map((lv) => (
              <Pressable
                key={lv}
                onPress={() => toggleLevel(lv)}
                style={[l.chip, levels.includes(lv) && S.chipOn]}
              >
                <Text style={[S.chipText, levels.includes(lv) && S.chipTextOn]}>
                  {levelIcon(lv)} {LEVEL_LABEL[lv] ?? `레벨 ${lv}`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* 분야는 16개라 세로로 쌓으면 머리가 목록보다 커진다. 가로 한 줄로 민다.
            헤더의 좌우 패딩(20)을 음수 마진으로 상쇄해 화면 끝까지 흐르게 한다 —
            그래야 잘린 칩이 보여서 더 밀 수 있다는 게 드러난다. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={l.fieldScroll}
          contentContainerStyle={l.fieldRow}
        >
          <Pressable
            onPress={() => setFields([])}
            style={[l.chip, fields.length === 0 && S.chipOn]}
          >
            <Text style={[S.chipText, fields.length === 0 && S.chipTextOn]}>전체</Text>
          </Pressable>
          {availableFields.map((f) => (
            <Pressable
              key={f}
              onPress={() => toggleField(f)}
              style={[l.chip, fields.includes(f) && S.chipOn]}
            >
              <Text style={[S.chipText, fields.includes(f) && S.chipTextOn]}>
                {fieldIcon(f)} {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(w) => `${deckId}-${w.word}`}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <Text style={l.empty}>
            {query ? `"${query}"에 맞는 단어가 없습니다` : '단어가 없습니다'}
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <View style={l.sectionHead}>
            <Text style={l.sectionText}>
              {fieldIcon(section.title)}  {section.title}
              <Text style={l.sectionCount}>  {section.data.length}</Text>
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={l.row}>
            <View style={l.wordRow}>
              <Text style={l.word}>{item.word}</Text>
              {item.level === 3 && <Text style={l.star}>★</Text>}
            </View>
            <Text style={l.meaning}>{item.meanings[0]}</Text>
            {item.meanings[1] != null && item.meanings[1] !== item.word && (
              <Text style={l.full}>{item.meanings[1]}</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const l = StyleSheet.create({
  header: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#fff',
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  exit: { color: C.sub, fontSize: 15 },
  count: { color: C.faint, fontSize: 13 },

  deckRow: { flexDirection: 'row', gap: 8 },
  deckBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
  },
  deckBtnOn: { backgroundColor: '#eff6ff', borderColor: C.blue },
  deckText: { fontSize: 14, color: C.sub },
  deckTextOn: { color: C.blue, fontWeight: '700' },

  search: {
    borderWidth: 1, borderColor: C.line, borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, color: C.text,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
  },
  // 헤더 패딩을 상쇄해 화면 끝까지 흐르게 한다
  fieldScroll: { marginHorizontal: -20 },
  // 가로 스크롤이라 줄바꿈하지 않는다. 좌우 여백은 헤더 패딩과 맞춘다.
  fieldRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },

  sectionHead: {
    backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  sectionText: { fontSize: 14, fontWeight: '700', color: C.text },
  sectionCount: { fontSize: 12, color: C.faint, fontWeight: '400' },

  row: {
    paddingHorizontal: 20, paddingVertical: 11, gap: 2,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontSize: 17, fontWeight: '700', color: C.text },
  star: { fontSize: 12, color: C.close },
  meaning: { fontSize: 15, color: C.text, lineHeight: 21 },
  full: { fontSize: 13, color: C.faint },

  empty: { textAlign: 'center', color: C.faint, fontSize: 15, paddingVertical: 48 },
});
