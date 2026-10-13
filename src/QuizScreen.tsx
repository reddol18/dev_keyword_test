import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { applyFilter, getDeck } from './decks';
import { gradeByMode } from './grading';
import { buildQuiz, hintOf } from './quiz';
import type { Answer, Question } from './types';
import { MODE_LABEL, isChoiceMode } from './types';
import type { StartConfig } from './StartScreen';
import ResultScreen from './ResultScreen';
import { loadToday, recordCorrect } from './progress';
import { C, S } from './theme';

export default function QuizScreen({
  config, modelReady, onExit,
}: {
  config: StartConfig;
  modelReady: boolean;
  onExit: () => void;
}) {
  const pool = useMemo(
    () => applyFilter(getDeck(config.deckId), config.filter),
    [config],
  );
  // 오늘 맞힌 기록. 읽기 전에는 빈 값이라 가중치 없이 출제된다.
  // 기록은 ref 에도 둬서 '다시 풀기' 때 최신 값을 쓴다.
  const correctToday = useRef<Record<string, number>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  // 채점 직후 결과를 잠깐 보여주는 상태. null이면 아직 답하는 중.
  const [judged, setJudged] = useState<Answer | null>(null);
  const [grading, setGrading] = useState(false);

  // 기록을 읽은 뒤 첫 문제를 만든다. 저장소 읽기는 보통 수십 ms라
  // 체감되지 않지만, 실패해도 가중치 없이 그대로 출제된다.
  useEffect(() => {
    let alive = true;
    loadToday()
      .then((c) => { if (alive) correctToday.current = c; })
      .catch((e) => console.warn('[progress] 로딩 실패, 가중치 없이 출제:', e))
      .finally(() => {
        if (alive) {
          setQuestions(buildQuiz(pool, config.modes, config.count, correctToday.current));
        }
      });
    return () => { alive = false; };
  }, [pool, config.modes, config.count]);

  const q = questions[index];
  // 문제가 아직 안 만들어진 상태(기록 읽는 중)를 '끝남'으로 보면 안 된다
  const finished = questions.length > 0 && index >= questions.length;

  const commit = async (raw: string) => {
    if (!raw.trim() || judged || grading) return;
    setGrading(true);
    const result: Answer = {
      word: q.word,
      mode: q.mode,
      input: raw,            // 입력 원문을 그대로 보관 → 오답노트에서 쓴다
      grade: await gradeByMode(raw, q.word, q.mode),
    };
    setAnswers((prev) => [...prev, result]);
    setJudged(result);
    setGrading(false);

    // 맞힌 것만 센다. "비슷했어요"는 아직 정확히 모르는 것이라 세지 않는다.
    if (result.grade === 'correct') {
      const w = q.word.word;
      correctToday.current[w] = (correctToday.current[w] ?? 0) + 1;
      recordCorrect(w).catch(() => {});   // 저장 실패가 학습을 막지 않게
    }
  };

  const next = () => {
    setJudged(null);
    setInput('');
    setIndex((i) => i + 1);
  };

  const restart = () => {
    // 방금 맞힌 것도 반영되도록 ref 의 최신 기록을 쓴다
    setQuestions(buildQuiz(pool, config.modes, config.count, correctToday.current));
    setIndex(0);
    setInput('');
    setAnswers([]);
    setJudged(null);
  };

  if (finished) {
    return <ResultScreen answers={answers} onRestart={restart} onExit={onExit} />;
  }

  // 기록을 읽는 동안의 짧은 공백. 여기서 q 가 없는데 아래로 내려가면 터진다.
  if (!q) {
    return (
      <View style={[S.flex, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={S.sub}>문제 준비 중…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={S.flex}
      // Android도 'height'를 줘야 한다. undefined면 아무 보정도 하지 않아
      // 키보드가 입력창을 덮는다. (Manifest는 adjustResize로 설정돼 있음)
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={S.flex}
        contentContainerStyle={[S.screen, S.screenFill, { justifyContent: 'center' }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={q2.topRow}>
          <Pressable onPress={onExit} hitSlop={12}>
            <Text style={q2.exit}>← 설정</Text>
          </Pressable>
          <Text style={q2.progress}>
            {index + 1} / {questions.length}
          </Text>
          <Text style={modelReady ? q2.aiOn : q2.aiOff}>
            {modelReady ? '● AI 채점' : '○ 로딩 중'}
          </Text>
        </View>

        <View style={q2.card}>
          <Text style={q2.meta}>
            {q.word.partOfSpeech}
            {q.word.level != null ? `  ·  L${q.word.level}` : ''}
          </Text>
          <Text style={isChoiceMode(q.mode) || q.prompt.length > 20
            ? q2.promptSmall : q2.prompt}>
            {q.prompt}
          </Text>
          <Text style={q2.modeTag}>{MODE_LABEL[q.mode]}</Text>
        </View>

        {isChoiceMode(q.mode) ? (
          <View style={{ gap: 10 }}>
            {q.choices!.map((c, i) => {
              const chosen = judged?.input === c;
              const isAnswer = i === q.answerIndex;
              return (
                <Pressable
                  key={`${c}-${i}`}
                  disabled={!!judged || grading}
                  onPress={() => commit(c)}
                  style={[
                    q2.choice,
                    judged && isAnswer && q2.choiceOk,
                    judged && chosen && !isAnswer && q2.choiceNo,
                  ]}
                >
                  <Text style={q2.choiceText}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <TextInput
            style={[
              q2.input,
              judged && (judged.grade === 'correct' ? q2.inputOk
                       : judged.grade === 'close' ? q2.inputClose
                       : q2.inputNo),
            ]}
            value={input}
            onChangeText={setInput}
            placeholder={hintOf(q.mode)}
            placeholderTextColor={C.faint}
            // ★ 리뷰 불만 "단어쓰기 할때 대문자로 계속 시작해서 불편해요"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!judged}
            onSubmitEditing={() => commit(input)}
            returnKeyType="done"
            autoFocus
          />
        )}

        {judged ? (
          <View style={q2.feedback}>
            <Text style={
              judged.grade === 'correct' ? q2.ok
              : judged.grade === 'close' ? q2.closeText : q2.no
            }>
              {judged.grade === 'correct' ? '정답입니다'
               : judged.grade === 'close' ? '비슷했어요' : '오답입니다'}
            </Text>
            {judged.grade === 'close' && (
              <Text style={q2.closeHint}>뜻은 통하지만 정확한 답은 아닙니다</Text>
            )}
            <Text style={q2.answerLine}>{q.word.word}</Text>
            <Text style={q2.answerMeaning}>{q.word.meanings.join(' · ')}</Text>
            <Pressable style={S.button} onPress={next}>
              <Text style={S.buttonText}>
                {index + 1 === questions.length ? '결과 보기' : '다음'}
              </Text>
            </Pressable>
          </View>
        ) : !isChoiceMode(q.mode) ? (
          <Pressable
            style={[S.button, (!input.trim() || grading) && S.buttonOff]}
            onPress={() => commit(input)}
            disabled={!input.trim() || grading}
          >
            <Text style={S.buttonText}>{grading ? '채점 중…' : '확인'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const q2 = StyleSheet.create({
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  exit: { color: C.sub, fontSize: 14 },
  progress: { color: C.sub, fontSize: 15 },
  aiOn: { color: C.ok, fontSize: 12, fontWeight: '600' },
  aiOff: { color: C.faint, fontSize: 12 },

  card: {
    backgroundColor: C.card, borderRadius: 16,
    paddingVertical: 26, paddingHorizontal: 18,
    alignItems: 'center', gap: 8,
  },
  meta: { color: C.sub, fontSize: 13 },
  prompt: { fontSize: 38, fontWeight: '700', color: C.text, textAlign: 'center' },
  promptSmall: {
    fontSize: 21, fontWeight: '700', color: C.text,
    textAlign: 'center', lineHeight: 30,
  },
  modeTag: { color: C.faint, fontSize: 12 },

  input: {
    borderWidth: 2, borderColor: C.line, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, color: C.text,
  },
  inputOk: { borderColor: C.ok, backgroundColor: C.okBg },
  inputClose: { borderColor: C.closeBorder, backgroundColor: C.closeBg },
  inputNo: { borderColor: C.no, backgroundColor: C.noBg },

  choice: {
    borderWidth: 1.5, borderColor: C.line, borderRadius: 12,
    paddingVertical: 15, paddingHorizontal: 16, backgroundColor: '#fff',
  },
  choiceOk: { borderColor: C.ok, backgroundColor: C.okBg },
  choiceNo: { borderColor: C.no, backgroundColor: C.noBg },
  choiceText: { fontSize: 16, color: C.text, lineHeight: 22 },

  feedback: { gap: 8, alignItems: 'center' },
  ok: { color: C.ok, fontSize: 20, fontWeight: '700' },
  closeText: { color: C.close, fontSize: 20, fontWeight: '700' },
  closeHint: { color: C.closeText, fontSize: 14 },
  no: { color: C.no, fontSize: 20, fontWeight: '700' },
  answerLine: { fontSize: 19, fontWeight: '700', color: C.text, marginTop: 2 },
  answerMeaning: {
    fontSize: 15, color: C.sub, textAlign: 'center', marginBottom: 4,
  },
});
