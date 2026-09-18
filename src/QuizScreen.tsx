import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import wordsData from '../data/words.json';
import { gradeAsync, shuffle } from './grading';
import { loadModel } from './embedding';
import type { Answer, Word } from './types';

const QUIZ_SIZE = 10;

export default function QuizScreen() {
  // 앱을 켤 때마다 순서를 새로 섞는다. 리뷰 불만 #2 "문제가 다 순서대로 나와요"
  const [deck, setDeck] = useState<Word[]>(() =>
    shuffle(wordsData as Word[]).slice(0, QUIZ_SIZE),
  );
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  // 채점 직후 정답/오답을 잠깐 보여주는 상태. null이면 입력 중.
  const [judged, setJudged] = useState<Answer | null>(null);
  const [grading, setGrading] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  // 모델 로딩은 수 초 걸린다. 그동안에도 앱은 쓸 수 있고,
  // 채점은 규칙 기반으로 동작한다.
  useEffect(() => {
    loadModel()
      .then(() => setModelReady(true))
      .catch((e) => console.warn('[model] 로딩 실패, 규칙 기반으로 동작:', e));
  }, []);

  const current = deck[index];
  const finished = index >= deck.length;

  const submit = async () => {
    if (!input.trim() || judged || grading) return;
    setGrading(true);
    const result: Answer = {
      word: current,
      input,                              // 입력 원문을 그대로 보관 → 오답노트에서 쓴다
      grade: await gradeAsync(input, current),
    };
    setAnswers((prev) => [...prev, result]);
    setJudged(result);
    setGrading(false);
  };

  const next = () => {
    setJudged(null);
    setInput('');
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setDeck(shuffle(wordsData as Word[]).slice(0, QUIZ_SIZE));
    setIndex(0);
    setInput('');
    setAnswers([]);
    setJudged(null);
  };

  if (finished) {
    return <ResultView answers={answers} onRestart={restart} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      // Android도 'height'를 줘야 한다. undefined면 아무 보정도 하지 않아
      // 키보드가 입력창을 덮는다. (Manifest는 adjustResize로 설정돼 있음)
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topRow}>
          <Text style={styles.progress}>
            {index + 1} / {deck.length}
          </Text>
          <Text style={modelReady ? styles.aiOn : styles.aiOff}>
            {modelReady ? '● AI 채점' : '○ 모델 로딩 중'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.pos}>{current.partOfSpeech}</Text>
          <Text style={styles.word}>{current.word}</Text>
        </View>

        <TextInput
          style={[
            styles.input,
            judged && (judged.grade === 'correct' ? styles.inputOk
                     : judged.grade === 'close'   ? styles.inputClose
                     : styles.inputNo),
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="뜻을 입력하세요"
          placeholderTextColor="#9ca3af"
          // ★ 리뷰 불만 #4 "단어쓰기 할때 대문자로 계속 시작해서 불편해요"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!judged}
          onSubmitEditing={submit}
          returnKeyType="done"
          autoFocus
        />

        {judged ? (
          <View style={styles.feedback}>
            <Text style={
              judged.grade === 'correct' ? styles.ok
              : judged.grade === 'close' ? styles.closeText
              : styles.no
            }>
              {judged.grade === 'correct' ? '정답입니다'
               : judged.grade === 'close' ? '비슷했어요'
               : '오답입니다'}
            </Text>
            {judged.grade === 'close' && (
              <Text style={styles.closeHint}>
                뜻은 통하지만 정확한 답은 아닙니다
              </Text>
            )}
            {/* 복수정답을 모두 보여준다 — 하나만 써도 맞다는 걸 학습자가 알게 된다 */}
            <Text style={styles.allMeanings}>
              {current.meanings.join(' · ')}
            </Text>
            <Pressable style={styles.button} onPress={next}>
              <Text style={styles.buttonText}>
                {index + 1 === deck.length ? '결과 보기' : '다음'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.button, (!input.trim() || grading) && styles.buttonOff]}
            onPress={submit}
            disabled={!input.trim() || grading}
          >
            <Text style={styles.buttonText}>{grading ? '채점 중…' : '확인'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResultView({
  answers, onRestart,
}: { answers: Answer[]; onRestart: () => void }) {
  const wrong = useMemo(
    () => answers.filter((a) => a.grade !== 'correct'),
    [answers],
  );
  const score = answers.length - wrong.length;

  return (
    <ScrollView contentContainerStyle={styles.resultBox}>
      <Text style={styles.scoreLabel}>결과</Text>
      <Text style={styles.score}>
        {score} <Text style={styles.scoreTotal}>/ {answers.length}</Text>
      </Text>

      {wrong.length > 0 && (
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>오답노트</Text>
          {wrong.map((a, i) => (
            <View
              key={i}
              style={[styles.noteRow, a.grade === 'close' && styles.noteRowClose]}
            >
              <View style={styles.noteHead}>
                <Text style={styles.noteWord}>{a.word.word}</Text>
                {a.grade === 'close' && (
                  <Text style={styles.badge}>비슷했어요</Text>
                )}
              </View>
              {/* 내가 뭐라고 썼는지 그대로 보여준다 */}
              <Text style={a.grade === 'close' ? styles.noteMineClose : styles.noteMine}>
                내 답: {a.input}
              </Text>
              <Text style={styles.noteAnswer}>
                정답: {a.word.meanings.join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.button} onPress={onRestart}>
        <Text style={styles.buttonText}>다시 풀기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 20 },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  progress: { color: '#6b7280', fontSize: 15 },
  aiOn: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  aiOff: { color: '#9ca3af', fontSize: 12 },
  card: {
    backgroundColor: '#f3f4f6', borderRadius: 16,
    paddingVertical: 28, alignItems: 'center', gap: 8,
  },
  pos: { color: '#6b7280', fontSize: 14 },
  word: { fontSize: 40, fontWeight: '700', color: '#111827' },
  input: {
    borderWidth: 2, borderColor: '#d1d5db', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 20,
    color: '#111827',
  },
  inputOk: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  inputNo: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  inputClose: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  feedback: { gap: 12, alignItems: 'center' },
  ok: { color: '#16a34a', fontSize: 20, fontWeight: '700' },
  no: { color: '#dc2626', fontSize: 20, fontWeight: '700' },
  closeText: { color: '#d97706', fontSize: 20, fontWeight: '700' },
  closeHint: { color: '#92400e', fontSize: 14 },
  allMeanings: { fontSize: 18, color: '#374151' },
  button: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', alignSelf: 'stretch',
  },
  buttonOff: { backgroundColor: '#cbd5e1' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  resultBox: { padding: 24, gap: 16, justifyContent: 'center', flexGrow: 1 },
  scoreLabel: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  score: { fontSize: 56, fontWeight: '700', textAlign: 'center', color: '#111827' },
  scoreTotal: { fontSize: 28, color: '#9ca3af', fontWeight: '400' },
  noteBox: { gap: 12 },
  noteTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  noteRow: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 14, gap: 4,
  },
  noteRowClose: { backgroundColor: '#fffbeb' },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteWord: { fontSize: 20, fontWeight: '700', color: '#111827' },
  badge: {
    fontSize: 12, color: '#92400e', backgroundColor: '#fde68a',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    overflow: 'hidden',
  },
  noteMine: { fontSize: 15, color: '#dc2626' },
  noteMineClose: { fontSize: 15, color: '#d97706' },
  noteAnswer: { fontSize: 15, color: '#16a34a' },
});
