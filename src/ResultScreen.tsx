import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Answer } from './types';
import { MODE_LABEL, asksForTerm, isSkipped } from './types';
import { fieldIcon, levelIcon } from './icons';
import { C, S } from './theme';

export default function ResultScreen({
  answers, onRestart, onExit,
}: {
  answers: Answer[];
  onRestart: () => void;
  onExit: () => void;
}) {
  const missed = useMemo(
    () => answers.filter((a) => a.grade !== 'correct'),
    [answers],
  );
  const score = answers.length - missed.length;

  // 펼친 항목. 화면을 벗어나면 사라져도 되는 상태라 저장하지 않는다.
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ScrollView
      style={S.flex}
      contentContainerStyle={[S.screen, { paddingBottom: 40 }]}
    >
      <Text style={[S.sub, { textAlign: 'center', marginTop: 12 }]}>결과</Text>
      <Text style={r.score}>
        {score} <Text style={r.scoreTotal}>/ {answers.length}</Text>
      </Text>

      {missed.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={S.h2}>📝 오답노트</Text>
          {missed.map((a, i) => {
            const shown = open.has(i);
            // 물어본 방향으로 답을 보여준다. 뜻을 주고 용어를 물었는데
            // 정답에 또 뜻을 내놓으면 정작 못 맞힌 용어가 안 보인다.
            const wantsTerm = asksForTerm(a.mode);
            const answer = wantsTerm ? a.word.word : a.word.meanings.join(' · ');
            // 용어 자체는 이미 머리에 떠 있으니 다른 표기만 추린다
            const others = (a.word.aliases ?? []).filter((x) => x !== a.word.word);
            const near = a.word.near ?? [];
            const confusable = a.word.confusable ?? [];

            return (
              <Pressable
                key={i}
                onPress={() => toggle(i)}
                style={[r.row, a.grade === 'close' && r.rowClose]}
              >
                <View style={r.head}>
                  <Text style={r.word}>{a.word.word}</Text>
                  {a.grade === 'close' && <Text style={r.badge}>🟡 비슷했어요</Text>}
                  {isSkipped(a) && <Text style={r.badgeSkip}>🤔 모르겠어요</Text>}
                  <View style={S.flex} />
                  <Text style={r.caret}>{shown ? '▲' : '▼'}</Text>
                </View>

                {shown && (
                  <Text style={r.meta}>
                    {fieldIcon(a.word.partOfSpeech)} {a.word.partOfSpeech}
                    {a.word.level != null
                      ? `  ·  ${levelIcon(a.word.level)} L${a.word.level}` : ''}
                  </Text>
                )}

                <Text style={r.mode}>{MODE_LABEL[a.mode]}</Text>

                {/* 내가 뭐라고 썼는지 그대로 보여준다 */}
                {!isSkipped(a) && (
                  <Text style={a.grade === 'close' ? r.mineClose : r.mine}>
                    내 답: {a.input}
                  </Text>
                )}
                <Text style={r.answer}>정답: {answer}</Text>

                {shown && (
                  <View style={r.more}>
                    {/*
                      용어는 머리에 이미 크게 떠 있으므로 반복하지 않는다.
                      뜻을 물은 쪽은 정답줄이 곧 뜻이라 이것도 생략한다.
                    */}
                    {wantsTerm && <Field label="뜻" value={a.word.meanings.join(' · ')} />}
                    {/* word 와 다른 표기만 — 301개 중 211개가 가지고 있다 */}
                    {others.length > 0 && (
                      <Field label="인정 표기" value={others.join(' · ')} />
                    )}
                    {near.length > 0 && (
                      <Field label="비슷한 말" value={near.join(' · ')} />
                    )}
                    {confusable.length > 0 && (
                      <Field label="헷갈리는 것" value={confusable.join(' · ')} />
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {missed.length === 0 && (
        <Text style={[S.sub, { textAlign: 'center' }]}>전부 맞혔습니다</Text>
      )}

      <Pressable style={S.button} onPress={onRestart}>
        <Text style={S.buttonText}>같은 조건으로 다시</Text>
      </Pressable>
      <Pressable style={[S.button, r.ghost]} onPress={onExit}>
        <Text style={[S.buttonText, { color: C.blue }]}>조건 바꾸기</Text>
      </Pressable>
    </ScrollView>
  );
}

/** 펼쳤을 때의 한 줄. 라벨 폭을 고정해 값이 세로로 맞는다. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={r.fieldRow}>
      <Text style={r.fieldLabel}>{label}</Text>
      <Text style={r.fieldValue}>{value}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  score: {
    fontSize: 54, fontWeight: '700', textAlign: 'center', color: C.text,
  },
  scoreTotal: { fontSize: 26, color: C.faint, fontWeight: '400' },
  row: { backgroundColor: C.noBg, borderRadius: 12, padding: 14, gap: 3 },
  rowClose: { backgroundColor: C.closeBg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontSize: 19, fontWeight: '700', color: C.text },
  badge: {
    fontSize: 12, color: C.closeText, backgroundColor: C.closeChip,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    overflow: 'hidden',
  },
  // 몰라서 넘긴 것. 찍어서 틀린 것과 구분하면 복습할 때 도움이 된다.
  badgeSkip: {
    fontSize: 12, color: C.sub, backgroundColor: C.card,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    overflow: 'hidden',
  },
  mode: { fontSize: 12, color: C.faint },
  mine: { fontSize: 15, color: C.no },
  mineClose: { fontSize: 15, color: C.close },
  answer: { fontSize: 15, color: C.ok },

  // 펼치기
  caret: { fontSize: 11, color: C.faint },
  meta: { fontSize: 12, color: C.sub },
  more: {
    marginTop: 8, paddingTop: 8, gap: 5,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  fieldRow: { flexDirection: 'row', gap: 8 },
  // '헷갈리는 것'(6자)이 한 줄에 들어가야 한다. 좁으면 라벨이 접혀
  // 값과 높이가 어긋난다.
  fieldLabel: { width: 76, fontSize: 13, color: C.faint },
  fieldValue: { flex: 1, fontSize: 14, color: C.text, lineHeight: 20 },
  ghost: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.blue },
});
