import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DeckId, Filter } from './decks';
import { DECKS, applyFilter, fieldsOf, getDeck, levelsOf } from './decks';
import type { QuizMode } from './types';
import { ALL_MODES, MODE_LABEL } from './types';
import { SECTION, deckIcon, fieldIcon, levelIcon } from './icons';
import { C, S } from './theme';

const LEVEL_LABEL: Record<number, string> = {
  1: '기초',
  2: '일반',
  3: '면접 우선',
};

export type StartConfig = {
  deckId: DeckId;
  filter: Filter;
  modes: QuizMode[];
  count: number;
};

const COUNTS = [10, 20, 30];

export default function StartScreen({
  onStart,
  onOpenList,
  modelReady,
}: {
  onStart: (config: StartConfig) => void;
  onOpenList: () => void;
  modelReady: boolean;
}) {
  const [deckId, setDeckId] = useState<DeckId>('it-terms');
  const [levels, setLevels] = useState<number[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [modes, setModes] = useState<QuizMode[]>(ALL_MODES);
  const [count, setCount] = useState(10);

  const deck = getDeck(deckId);
  const availableLevels = useMemo(() => levelsOf(deck), [deck]);
  const availableFields = useMemo(() => fieldsOf(deck), [deck]);
  const matched = useMemo(
    () => applyFilter(deck, { levels, fields }).length,
    [deck, levels, fields],
  );

  // 덱을 바꾸면 이전 덱의 분야·레벨이 남아 0개가 되는 일이 없도록 초기화한다
  const pickDeck = (id: DeckId) => {
    setDeckId(id);
    setLevels([]);
    setFields([]);
  };

  const toggle = <T,>(list: T[], v: T, set: (x: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const canStart = matched > 0 && modes.length > 0;

  return (
    <View style={S.flex}>
    <ScrollView
      style={S.flex}
      contentContainerStyle={[S.screen, { paddingBottom: 16 }]}
      showsVerticalScrollIndicator={true}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={S.h1}>무엇을 외울까요</Text>
          <Text style={S.sub}>
            {modelReady ? '● AI 채점 준비됨' : '○ 모델 로딩 중 — 지금 시작해도 됩니다'}
          </Text>
        </View>
        <Pressable onPress={onOpenList} hitSlop={10} style={S.chip}>
          <Text style={S.chipText}>목록 보기</Text>
        </Pressable>
      </View>

      <Section title="단어장" icon={SECTION.deck}>
        {DECKS.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => pickDeck(d.id)}
            style={[
              {
                borderWidth: 1, borderRadius: 12, padding: 14, gap: 2,
                borderColor: deckId === d.id ? C.blue : C.line,
                backgroundColor: deckId === d.id ? '#eff6ff' : '#fff',
              },
            ]}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>
              {deckIcon(d.id)}  {d.name}
              <Text style={{ fontWeight: '400', color: C.faint }}>
                {'  '}{d.words.length}개
              </Text>
            </Text>
            <Text style={S.sub}>{d.description}</Text>
          </Pressable>
        ))}
      </Section>

      {availableLevels.length > 0 && (
        <Section title="난이도" hint="안 고르면 전체" icon={SECTION.level}>
          <View style={S.chipRow}>
            {availableLevels.map((lv) => (
              <Chip
                key={lv}
                on={levels.includes(lv)}
                label={`${levelIcon(lv)} ${LEVEL_LABEL[lv] ?? `레벨 ${lv}`}`}
                onPress={() => toggle(levels, lv, setLevels)}
              />
            ))}
          </View>
        </Section>
      )}

      <Section title="분야" hint="안 고르면 전체" icon={SECTION.field}>
        <View style={S.chipRow}>
          {availableFields.map((f) => (
            <Chip
              key={f}
              on={fields.includes(f)}
              label={`${fieldIcon(f)} ${f}`}
              onPress={() => toggle(fields, f, setFields)}
            />
          ))}
        </View>
      </Section>

      <Section title="출제 방식" icon={SECTION.mode}>
        <View style={S.chipRow}>
          {ALL_MODES.map((m) => (
            <Chip
              key={m}
              on={modes.includes(m)}
              label={MODE_LABEL[m]}
              onPress={() => toggle(modes, m, setModes)}
            />
          ))}
        </View>
        {modes.length === 0 && (
          <Text style={{ color: C.no, fontSize: 13 }}>
            하나 이상 골라야 합니다
          </Text>
        )}
      </Section>

      <Section title="문항 수" icon={SECTION.count}>
        <View style={S.chipRow}>
          {COUNTS.map((n) => (
            <Chip
              key={n}
              on={count === n}
              label={`${n}문제`}
              onPress={() => setCount(n)}
            />
          ))}
        </View>
      </Section>

    </ScrollView>

    {/* 시작 버튼은 하단에 고정한다. 선택지가 많아 스크롤이 길어지는데
        버튼이 맨 아래에만 있으면 매번 끝까지 내려가야 한다. */}
    <View style={{
      paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14, gap: 8,
      borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fff',
    }}>
      <Text style={[S.sub, { textAlign: 'center' }]}>
        조건에 맞는 단어 {matched}개
        {matched > 0 && matched < count ? ` — ${matched}문제만 출제됩니다` : ''}
      </Text>
      <Pressable
        style={[S.button, !canStart && S.buttonOff]}
        disabled={!canStart}
        onPress={() => onStart({ deckId, filter: { levels, fields }, modes, count })}
      >
        <Text style={S.buttonText}>시작</Text>
      </Pressable>
    </View>
    </View>
  );
}

function Section({
  title, hint, icon, children,
}: { title: string; hint?: string; icon?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={S.h2}>{icon ? `${icon} ${title}` : title}</Text>
        {hint && <Text style={{ fontSize: 12, color: C.faint }}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function Chip({
  on, label, onPress,
}: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[S.chip, on && S.chipOn]}>
      <Text style={[S.chipText, on && S.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}
