import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Answer } from './types';
import { MODE_LABEL } from './types';
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
          <Text style={S.h2}>오답노트</Text>
          {missed.map((a, i) => (
            <View
              key={i}
              style={[r.row, a.grade === 'close' && r.rowClose]}
            >
              <View style={r.head}>
                <Text style={r.word}>{a.word.word}</Text>
                {a.grade === 'close' && <Text style={r.badge}>비슷했어요</Text>}
              </View>
              <Text style={r.mode}>{MODE_LABEL[a.mode]}</Text>
              {/* 내가 뭐라고 썼는지 그대로 보여준다 */}
              <Text style={a.grade === 'close' ? r.mineClose : r.mine}>
                내 답: {a.input}
              </Text>
              <Text style={r.answer}>정답: {a.word.meanings.join(' · ')}</Text>
            </View>
          ))}
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
  mode: { fontSize: 12, color: C.faint },
  mine: { fontSize: 15, color: C.no },
  mineClose: { fontSize: 15, color: C.close },
  answer: { fontSize: 15, color: C.ok },
  ghost: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.blue },
});
