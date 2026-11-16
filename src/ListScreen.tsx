import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Pressable, ScrollView, SectionList, Share,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { DeckId } from './decks';
import { DECKS, fieldsOf, getDeck, levelsOf } from './decks';
import type { Word } from './types';
import { buildExport, clearCards, loadCards } from './srs';
import { deckIcon, fieldIcon, levelIcon } from './icons';
import { C, S } from './theme';

const LEVEL_LABEL: Record<number, string> = { 1: '기초', 2: '일반', 3: '면접 우선' };

/**
 * 항목·헤더의 고정 높이(dp). getItemLayout 이 쓴다.
 *
 * 스타일에서 계산해 둔 값이라 둘을 따로 고치면 어긋난다.
 *   row  = paddingVertical 11*2 + 단어 24 + 뜻 21*2 + 풀네임 18 + gap 2*2 ≈ 130
 *   head = paddingVertical 7*2 + 글자 20 ≈ 34
 * 실기기(S8, density 480)에서 265px/328px 로 나왔던 것을 2줄 고정으로 맞춘 값.
 */
const ROW_H = 130;
const SECTION_H = 34;

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

  /** 검색어가 이 단어에 걸리는가. 뜻만 기억나는 경우가 흔해 함께 훑는다. */
  const matches = (w: Word, q: string) =>
    !q ||
    w.word.toLowerCase().includes(q) ||
    w.meanings.some((m) => m.toLowerCase().includes(q)) ||
    (w.near ?? []).some((n) => n.toLowerCase().includes(q)) ||
    (w.aliases ?? []).some((a) => a.toLowerCase().includes(q));

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (w: Word) => matches(w, q);

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

  /**
   * 이 덱에서 못 찾았을 때, 다른 덱에 있는지 본다.
   *
   * 목록은 IT 개발 용어(424개)로 열린다. 영단어 덱 80개는 수가 적어
   * 존재가 잊히기 쉬운데, 거기 있는 단어를 찾으면 "없습니다"만 나와서
   * 지워진 것처럼 읽힌다(실제 제보가 있었다).
   *
   * 검색어가 있을 때만 본다. 필터만 걸었을 때는 덱마다 분야가 달라
   * 안내가 혼란만 준다.
   */
  const otherDeck = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || total > 0) return null;
    for (const d of DECKS) {
      if (d.id === deckId) continue;
      const n = d.words.filter((w) => matches(w, q)).length;
      if (n > 0) return { deck: d, count: n };
    }
    return null;
  }, [query, total, deckId]);

  /**
   * 목록이 바뀌면 맨 위로 올린다.
   *
   * 분야 칩을 누르면 섹션이 23개에서 1~2개로 줄어드는데 스크롤 위치는
   * 그대로다. 그 자리에 있던 내용이 사라져 RN 이 위치를 보정하고,
   * 사용자에게는 "갑자기 다른 섹션으로 튀는" 것처럼 보인다.
   *
   * 덱·검색어·필터 중 하나라도 바뀌면 지금 보던 자리는 의미를 잃으므로
   * 올려 버리는 쪽이 맞다.
   */
  const listRef = useRef<SectionList<Word>>(null);
  useEffect(() => {
    // 섹션이 비었을 때 부르면 터진다
    if (sections.length === 0) return;
    listRef.current?.scrollToLocation({
      sectionIndex: 0, itemIndex: 0, animated: false, viewPosition: 0,
    });
  }, [deckId, query, levels, fields, sections.length]);

  const toggleLevel = (lv: number) =>
    setLevels(levels.includes(lv) ? levels.filter((x) => x !== lv) : [...levels, lv]);

  const toggleField = (f: string) =>
    setFields(fields.includes(f) ? fields.filter((x) => x !== f) : [...fields, f]);

  /**
   * 진도 내보내기.
   *
   * RN 내장 `Share` 를 쓴다. `expo-sharing` 은 **로컬 파일만** 보낼 수
   * 있어서(v57 문서) JSON 을 파일로 먼저 써야 하는데, 그러려면
   * `expo-file-system` 까지 새로 깔아야 한다. 출시 직전에 네이티브
   * 의존성을 두 개 더 얹을 이유가 없다 — `Share.share({ message })` 는
   * 문자열을 그대로 공유 시트에 넘기고, 사용자는 메모앱·드라이브·메신저
   * 중 원하는 곳에 붙여 둘 수 있다.
   *
   * 저장은 안 하므로 실패해도 잃는 게 없다. 취소(dismissedAction)도
   * 실패가 아니라서 따로 알리지 않는다.
   */
  const exportProgress = async () => {
    try {
      const cards = await loadCards();
      const json = buildExport(cards);
      const n = Object.keys(cards).length;
      await Share.share({
        message: json,
        // 안드로이드 공유 시트의 제목. 메일 앱으로 보내면 제목 줄이 된다.
        title: `용어먹는하마 진도 백업 (${n}개)`,
      });
    } catch (e) {
      console.warn('[export] 내보내기 실패:', e);
      Alert.alert('내보내기 실패', '잠시 후 다시 시도해 주세요.');
    }
  };

  /**
   * 처음부터 다시 외우기.
   *
   * 되돌릴 수 없으므로 확인을 받는다. 지우기 전에 몇 개가 사라지는지
   * 보여준다 — "진도 삭제"라는 말만으로는 양이 체감되지 않는다.
   */
  const resetProgress = async () => {
    const n = Object.keys(await loadCards()).length;
    if (n === 0) {
      Alert.alert('지울 기록이 없습니다', '아직 푼 문제가 없습니다.');
      return;
    }
    Alert.alert(
      '처음부터 다시 외우기',
      `단어 ${n}개의 학습 기록이 모두 지워집니다.\n되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '지우기',
          style: 'destructive',
          onPress: () => {
            clearCards()
              .then(() => Alert.alert('완료', '학습 기록을 지웠습니다.'))
              .catch(() => Alert.alert('삭제 실패', '잠시 후 다시 시도해 주세요.'));
          },
        },
      ],
    );
  };

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
        ref={listRef}
        sections={sections}
        keyExtractor={(w) => `${deckId}-${w.word}`}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        /*
         * 안드로이드 기본값이 true 인데, 공식 문서가 "may lead to bugs
         * (missing content)" 라고 경고한다. 실제로 S8(안드로이드 9)에서
         * 423개를 내리다 보면 항목이 같은 y 에 겹쳐 쌓이고 일부는 y=0 으로
         * 튀면서 스크롤이 아예 멈췄다. 항목 높이를 미리 모르는 상태에서
         * 화면 밖 뷰를 떼어내면 다시 들어올 때 위치를 잃는다.
         * 423개 텍스트 항목이라 메모리 부담은 크지 않다.
         */
        removeClippedSubviews={false}
        /*
         * getItemLayout 이 없으면 아직 안 그린 곳으로는 못 뛴다.
         * 이 fallback 이 없으면 scrollToLocation 이 예외를 던진다.
         */
        onScrollToIndexFailed={() => {
          listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
        }}
        /*
         * 데이터 관리는 목록 끝에 둔다. 헤더에 두면 검색·필터보다 먼저
         * 눈에 들어오는데, 자주 쓰는 기능이 아니고 하나는 파괴적이다.
         * 필터가 걸려 목록이 짧아져도 푸터는 항상 따라오므로 닿을 수 있다.
         */
        ListFooterComponent={
          <View style={l.dataBox}>
            <Text style={l.dataNote}>
              학습 기록은 이 기기에만 저장됩니다. 앱을 지우면 사라집니다.
            </Text>
            <Pressable onPress={exportProgress} style={l.dataBtn}>
              <Text style={l.dataBtnText}>진도 내보내기</Text>
            </Pressable>
            <Pressable onPress={resetProgress} style={l.dataBtn}>
              <Text style={l.dataDanger}>처음부터 다시 외우기</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={l.emptyBox}>
            <Text style={l.empty}>
              {query ? `"${query}"에 맞는 단어가 없습니다` : '단어가 없습니다'}
            </Text>
            {otherDeck && (
              <Pressable
                onPress={() => {
                  // 검색어는 그대로 두고 덱만 옮긴다 — 찾던 단어가 바로 보이게
                  setDeckId(otherDeck.deck.id);
                  setLevels([]);
                  setFields([]);
                }}
                style={l.otherBtn}
              >
                <Text style={l.otherText}>
                  {deckIcon(otherDeck.deck.id)} {otherDeck.deck.name} 덱에
                  {' '}{otherDeck.count}개 있습니다
                </Text>
                <Text style={l.otherGo}>그 덱으로 보기 →</Text>
              </Pressable>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={l.sectionHead}>
            <Text style={l.sectionText}>
              {fieldIcon(section.title)}  {section.title}
              <Text style={l.sectionCount}>  {section.data.length}</Text>
            </Text>
          </View>
        )}
        /*
         * 항목 높이를 고정하고 미리 알려 준다. 이게 없으면 RN 이 항목을
         * 그려 본 뒤에야 높이를 알아서, 스크롤 중 계속 측정·보정이 일어나고
         * 느린 기기에서는 그 계산이 무너진다(S8 재현 참조).
         *
         * SectionList 의 getItemLayout 은 헤더·푸터까지 섞인 평탄화 인덱스를
         * 받는다. 섹션마다 [헤더, 항목…] 순서라 직접 세어 offset 을 만든다.
         */
        getItemLayout={(_data, index) => {
          let offset = 0;
          let i = 0;
          for (const s of sections) {
            if (i === index) return { length: SECTION_H, offset, index };   // 헤더
            offset += SECTION_H;
            i += 1;
            if (index < i + s.data.length) {
              const within = index - i;
              return { length: ROW_H, offset: offset + within * ROW_H, index };
            }
            offset += s.data.length * ROW_H;
            i += s.data.length;
          }
          return { length: ROW_H, offset, index };
        }}
        renderItem={({ item }) => (
          <View style={l.row}>
            <View style={l.wordRow}>
              <Text style={l.word} numberOfLines={1}>{item.word}</Text>
              {item.level === 3 && <Text style={l.star}>★</Text>}
            </View>
            {/* 뜻은 최대 45자라 2줄이면 거의 다 들어간다. 높이를 고정하려고
                줄 수를 묶되, 짧은 뜻도 두 줄 자리를 차지하게 해 간격을 맞춘다. */}
            <Text style={l.meaning} numberOfLines={2}>{item.meanings[0]}</Text>
            {/* 풀네임 줄은 295/424 개에만 있다. 없을 때도 자리를 비워 둬야
                항목 높이가 같아진다. */}
            <Text style={l.full} numberOfLines={1}>
              {item.meanings[1] != null && item.meanings[1] !== item.word
                ? item.meanings[1] : ' '}
            </Text>
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

  // 높이를 getItemLayout 과 맞춘다 (SECTION_H)
  sectionHead: {
    backgroundColor: C.card, paddingHorizontal: 20,
    height: SECTION_H, justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  sectionText: { fontSize: 14, fontWeight: '700', color: C.text },
  sectionCount: { fontSize: 12, color: C.faint, fontWeight: '400' },

  // 높이를 getItemLayout 과 맞춘다 (ROW_H). 뜻 2줄 + 풀네임 1줄 기준.
  row: {
    paddingHorizontal: 20, paddingVertical: 11, gap: 2,
    height: ROW_H,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontSize: 17, fontWeight: '700', color: C.text },
  star: { fontSize: 12, color: C.close },
  meaning: { fontSize: 15, color: C.text, lineHeight: 21 },
  full: { fontSize: 13, color: C.faint },

  // 목록 끝의 데이터 관리. 항목과 섞이지 않게 위에 선을 하나 둔다.
  dataBox: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 10,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  dataNote: { fontSize: 13, color: C.faint, lineHeight: 19 },
  dataBtn: {
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
  },
  dataBtnText: { fontSize: 15, color: C.text },
  // 파괴적인 동작이라 색으로 구분한다. 확인 다이얼로그가 한 겹 더 있다.
  dataDanger: { fontSize: 15, color: C.no },

  emptyBox: { paddingVertical: 48, paddingHorizontal: 20, gap: 16 },
  empty: { textAlign: 'center', color: C.faint, fontSize: 15 },
  otherBtn: {
    alignSelf: 'center', alignItems: 'center', gap: 4,
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.blue, backgroundColor: '#eff6ff',
  },
  otherText: { fontSize: 14, color: C.text, textAlign: 'center' },
  otherGo: { fontSize: 13, color: C.blue, fontWeight: '700' },
});
