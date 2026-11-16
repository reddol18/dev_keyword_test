import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { allowedModes, applyFilter, getDeck } from './decks';
import { gradeByMode } from './grading';
import { buildQuiz, hintOf, quizPhase, shouldKeepGrade } from './quiz';
import type { Answer, Question } from './types';
import { MODE_LABEL, SKIPPED, isChoiceMode } from './types';
import type { StartConfig } from './StartScreen';
import ResultScreen from './ResultScreen';
import type { Cards } from './srs';
import { cardKey, loadCards, nextCard, recordResult } from './srs';
import { fieldIcon, levelIcon } from './icons';
import { C, S } from './theme';

export default function QuizScreen({
  config, modelReady, onExit, onBackRequest,
}: {
  config: StartConfig;
  modelReady: boolean;
  onExit: () => void;
  /**
   * 하드웨어 뒤로가기를 이 화면이 직접 처리하려고 꽂아 두는 자리.
   * `App.tsx` 가 들고 있고, 처리했으면 true 를 돌려줘야 한다.
   *
   * **필수 prop 이다.** optional 로 두면 넘기는 걸 빼먹어도 타입 에러가
   * 없는데, 그때 확인 다이얼로그가 통째로 사라지고 뒤로가기가 App 의
   * "start 로 되돌리기"로 흘러 답을 푼 시험이 확인 없이 날아간다 —
   * 이 화면이 막으려는 바로 그 사고다. 필수로 두면 컴파일에서 걸린다.
   */
  onBackRequest: MutableRefObject<(() => boolean) | null>;
}) {
  const pool = useMemo(
    () => applyFilter(getDeck(config.deckId), config.filter),
    [config],
  );
  // 덱이 지원하지 않는 방식은 걸러낸다. 설정 화면이 막아 주지만
  // config 가 다른 경로로 들어올 수 있으므로 여기서도 본다.
  // 전부 걸러지면 덱의 방식으로 되돌린다 — 빈 목록이면 문제가 안 만들어진다.
  const modes = useMemo(() => {
    const deck = getDeck(config.deckId);
    const kept = allowedModes(deck, config.modes);
    return kept.length > 0 ? kept : deck.modes;
  }, [config]);
  // 간격 반복 기록. 읽기 전에는 빈 값이라 고르게 출제된다.
  // 기록은 ref 에도 둬서 '다시 풀기' 때 최신 값을 쓴다.
  const cards = useRef<Cards>({});
  /**
   * 출제된 문제. **`null` 은 "아직 만들지 않았다"** 를 뜻한다.
   *
   * `[]` 를 초기값으로 쓰면 "기록 읽는 중"과 "만들었는데 0개"가 같은 값이
   * 되어 구분이 안 된다(이슈 #26). boolean state 를 하나 더 두는 쪽은
   * 두 state 가 어긋날 수 있어서, 없는 값을 `null` 로 표현한다.
   */
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  /**
   * 회차 번호. '다시 풀기' 를 누를 때마다 1 올라간다.
   *
   * 비동기 채점이 끝났을 때 "그 답이 아직 이 문제의 답인가" 를 판정하는 데
   * 쓴다 (`shouldKeepGrade`). index 만으로는 부족하다 — `restart` 가
   * index 를 0 으로 되돌리므로, 1번 문제를 채점하는 중에 다시 풀기를 누르면
   * index 가 그대로 0 이어서 "안 바뀌었다" 로 잘못 읽힌다.
   */
  const [epoch, setEpoch] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  // 채점 직후 결과를 잠깐 보여주는 상태. null이면 아직 답하는 중.
  const [judged, setJudged] = useState<Answer | null>(null);
  const [grading, setGrading] = useState(false);

  // 기록을 읽은 뒤 첫 문제를 만든다. 저장소 읽기는 보통 수십 ms라
  // 체감되지 않지만, 실패해도 고르게 섞어 그대로 출제된다.
  useEffect(() => {
    let alive = true;
    loadCards()
      .then((c) => { if (alive) cards.current = c; })
      .catch((e) => console.warn('[srs] 로딩 실패, 고르게 출제:', e))
      .finally(() => {
        if (alive) {
          setQuestions(
            buildQuiz(pool, modes, config.count, cards.current, config.deckId),
          );
        }
      });
    return () => { alive = false; };
  }, [pool, modes, config.count, config.deckId]);

  // 문제가 아직 안 만들어진 상태(기록 읽는 중)를 '끝남'으로 보면 안 되고,
  // 만들었는데 0개인 상태를 '준비 중'으로 봐도 안 된다. 판정은 quizPhase 에
  // 모아 두고 단위 테스트로 덮는다 (src/quiz.ts).
  const total = questions?.length ?? 0;
  const phase = quizPhase(questions !== null, total, index);
  const q = questions?.[index];
  const finished = phase === 'finished';

  /**
   * 지금 보고 있는 자리(회차·문제 번호)의 **최신** 값.
   *
   * 비동기 채점이 끝난 뒤 "그 사이에 문제가 바뀌었는가" 를 보려면 지금
   * 값이 필요한데, `commit` 의 클로저가 잡은 `epoch`/`index` 는 렌더 당시
   * 값이라 낡아 있다. state 를 그대로 읽으면 항상 "안 바뀌었다" 가 나와서
   * 검사가 무력해진다. 그래서 렌더마다 ref 에 실어 둔다.
   */
  const nowAt = useRef({ epoch, index });
  nowAt.current = { epoch, index };

  /** 그만두기 확인 다이얼로그가 떠 있는가. 두 겹으로 쌓이는 것을 막는다. */
  const asking = useRef(false);

  /**
   * 시험을 그만두려 할 때. `← 설정` 과 하드웨어 뒤로가기가 **같이** 쓴다.
   *
   * 푼 문제가 있으면 확인부터 받는다. `answers` 는 메모리에만 있어서
   * 이 화면이 unmount 되면 그 회차의 점수와 오답노트가 통째로 사라진다
   * (SRS 기록은 문제마다 저장되므로 남는다 — 그래서 "뭘 틀렸는지"만
   * 잃는 어중간한 손실이 된다).
   *
   * 아직 하나도 안 풀었으면 바로 나간다. 거기서까지 묻는 건 성가시다.
   * 결과 화면(finished)에서도 묻지 않는다 — 이미 결과를 본 상태다.
   */
  const confirmExit = useCallback((): void => {
    if (answers.length === 0 || finished) {
      onExit();
      return;
    }
    // 이미 떠 있으면 또 띄우지 않는다. `← 설정` 을 누른 직후 하드웨어
    // 뒤로가기를 빠르게 누르면 다이얼로그가 두 겹으로 쌓여서 취소를
    // 두 번 눌러야 한다.
    if (asking.current) return;
    asking.current = true;
    const done = (then?: () => void) => () => {
      asking.current = false;
      then?.();
    };
    Alert.alert(
      '시험을 그만둘까요?',
      `지금까지 푼 ${answers.length}문제의 결과를 볼 수 없게 됩니다`,
      [
        { text: '취소', style: 'cancel', onPress: done() },
        { text: '그만두기', style: 'destructive', onPress: done(onExit) },
      ],
      // 바깥을 눌러 닫은 경우에도 플래그를 풀어야 한다.
      // 안 풀면 다음 뒤로가기가 영구히 무시된다.
      { onDismiss: done() },
    );
  }, [answers.length, finished, onExit]);

  /**
   * 하드웨어 뒤로가기를 가로챈다.
   *
   * 항상 true 를 돌려준다 — 이 화면에서는 뒤로가기가 언제나 "확인 후
   * 설정으로" 를 뜻하고, 앱 종료로 흘러가면 안 된다. App.tsx 가 start 로
   * 되돌리는 것도 막아야 한다. 확인을 받기 전에 화면이 바뀌면
   * 다이얼로그를 띄운 의미가 없다.
   */
  useEffect(() => {
    const handler = () => {
      confirmExit();
      return true;
    };
    onBackRequest.current = handler;
    // 화면이 사라지면 뗀다. 남겨 두면 설정 화면에서 뒤로가기를 눌렀을 때
    // 없어진 시험의 다이얼로그가 뜬다.
    //
    // **내가 넣은 것일 때만** 비운다. `if (current)` 같은 truthy 검사는
    // 들어갈 수 있는 값이 함수 아니면 null 뿐이라 아무것도 보호하지 않는다.
    // 지금은 등록하는 화면이 하나라 결과가 같지만, 다른 화면이 하나라도
    // 등록하게 되면 남의 핸들러를 지우는 코드가 된다.
    return () => {
      if (onBackRequest.current === handler) onBackRequest.current = null;
    };
  }, [onBackRequest, confirmExit]);

  /**
   * 채점 결과를 기록한다.
   *
   * 세 결과를 모두 기록한다. 틀린 것도 남겨야 간격이 하루로 돌아간다.
   * 맞힌 것만 세던 이전 구조에서는 틀린 단어가 다시 안 나올 수 있었다.
   *
   * ref 를 먼저 갱신하는 이유: '다시 풀기'가 방금 푼 문제를 피해야 하는데,
   * 저장은 비동기라 그때까지 기다릴 수 없다. 계산은 nextCard 한 곳에서만 한다.
   */
  const keep = (result: Answer) => {
    setAnswers((prev) => [...prev, result]);
    setJudged(result);
    const w = result.word.word;
    const key = cardKey(config.deckId, w);
    cards.current[key] = nextCard(cards.current[key], result.grade);
    // 저장 실패가 학습을 막지 않게
    recordResult(config.deckId, w, result.grade).catch(() => {});
  };

  const commit = async (raw: string) => {
    // `q` 를 함께 본다. 문제가 없을 때는 이 핸들러가 붙은 입력창·보기 자체가
    // 그려지지 않으므로 실제로는 호출되지 않지만, `questions` 가
    // `Question[] | null` 이 되어 타입이 그 사실을 모른다. 예전에는
    // `questions[index]` 가 `Question` 이라고 거짓말을 해서 이 자리가
    // 검사 없이 통과했다 — 그 거짓말이 이슈 #26 의 멈춤을 가린 쪽이다.
    if (!q || !raw.trim() || judged || grading) return;

    /**
     * 채점을 시작한 시점의 문제를 고정한다.
     *
     * `await` 뒤에서 `q` 를 다시 읽으면 안 된다 — 이 클로저의 `q` 는
     * 렌더 당시 값이라 낡았을 수 있고, 그 낡은 값으로 기록하는 것이
     * 이슈 #22 의 버그 자체다. 기록은 반드시 `asked` 로 한다.
     */
    const asked = q;
    const at = { epoch, index };

    setGrading(true);
    const grade = await gradeByMode(raw, asked.word, asked.mode);
    setGrading(false);

    // 채점 중에 문제가 바뀌었으면(뒤로가기·다시 풀기 등) 결과를 버린다.
    // 여기서 버리지 않으면 답한 적 없는 문제가 오답으로 기록되고
    // SRS 복습 주기까지 잘못 당겨진다 (이슈 #22).
    if (!shouldKeepGrade(at, nowAt.current)) return;

    keep({
      word: asked.word,
      mode: asked.mode,
      input: raw,            // 입력 원문을 그대로 보관 → 오답노트에서 쓴다
      grade,
    });
  };

  /**
   * 모르겠어요.
   *
   * 오답으로 기록한다 — 간격이 하루로 돌아가고, streak 0 이라
   * priorityOf 가 Relearn 으로 올려 '다시 풀기' 에서 바로 또 나온다
   * (src/srs.ts 의 Priority 참조). 새 등급을 만들지 않은 이유는
   * 채점 경로 네 개와 결과 화면까지 번지는데, 간격은 오답과 같아야 해서
   * 얻는 게 표시뿐이기 때문이다.
   *
   * 찍어서 맞히면 streak 가 올라가 due 가 1→3→7일로 늘어난다.
   * 모르는 단어가 점점 안 나오게 되므로, 찍기보다 이 버튼이 낫다.
   */
  const giveUp = () => {
    if (!q || judged || grading) return;
    keep({ word: q.word, mode: q.mode, input: SKIPPED, grade: 'wrong' });
  };

  /**
   * 다음 문제로.
   *
   * `grading` 가드가 있다. 지금은 채점 중에 `judged` 가 null 이라 "다음"
   * 버튼이 아예 그려지지 않지만, 그건 **화면 모양에 기댄 안전성**이다.
   * 스와이프 전환처럼 버튼을 거치지 않는 경로가 생기면 그대로 깨진다.
   * 불변식은 렌더 조건이 아니라 로직이 지켜야 한다 (이슈 #22).
   */
  const next = () => {
    if (grading) return;
    setJudged(null);
    setInput('');
    setIndex((i) => i + 1);
  };

  const restart = () => {
    if (grading) return;
    // 방금 푼 것도 반영되도록 ref 의 최신 기록을 쓴다
    setQuestions(buildQuiz(pool, modes, config.count, cards.current, config.deckId));
    setIndex(0);
    // 회차를 올려 둔다. 진행 중인 채점이 끝나도 이전 회차의 결과로
    // 판정되어 버려진다 (shouldKeepGrade).
    setEpoch((e) => e + 1);
    setInput('');
    setAnswers([]);
    setJudged(null);
  };

  if (phase === 'finished') {
    return <ResultScreen answers={answers} onRestart={restart} onExit={onExit} />;
  }

  /**
   * 낼 문제가 0개다.
   *
   * 오류가 아니라 정상 상태다 — 조건에 맞는 단어가 없거나 출제 방식이
   * 없으면 낼 게 없는 게 맞다. 그래서 문구도 "준비 중"(= 기다리면 된다)이
   * 아니라 "없다"(= 조건을 바꿔야 한다)로 말하고, **나갈 길을 그려 준다.**
   * 여기엔 기다릴 비동기 작업이 없으므로 안내만 띄우면 영구히 갇힌다.
   */
  if (phase === 'empty') {
    return (
      <View style={[S.flex, S.screen, { justifyContent: 'center', gap: 14 }]}>
        <Text style={[S.h2, { textAlign: 'center' }]}>낼 문제가 없습니다</Text>
        <Text style={[S.sub, { textAlign: 'center' }]}>
          지금 조건에 맞는 단어가 없습니다. 난이도·분야나 출제 방식을 바꿔 보세요.
        </Text>
        <Pressable style={S.button} onPress={onExit}>
          <Text style={S.buttonText}>조건 바꾸기</Text>
        </Pressable>
      </View>
    );
  }

  // 기록을 읽는 동안의 짧은 공백. 여기서 q 가 없는데 아래로 내려가면 터진다.
  // `q` 를 함께 보는 이유는 타입을 좁히기 위해서다 — phase 만으로는
  // 컴파일러가 `questions?.[index]` 가 있다는 것을 알 수 없다.
  if (phase === 'loading' || !q) {
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
          {/* 확인을 거친다. hitSlop 으로 터치 영역이 글자보다 넓고,
              바로 옆이 진행 표시라 오터치 거리가 가깝다. */}
          <Pressable onPress={confirmExit} hitSlop={12}>
            <Text style={q2.exit}>← 설정</Text>
          </Pressable>
          <Text style={q2.progress}>
            {index + 1} / {total}
          </Text>
          {/* 이 문제가 모델로 채점되는 방식일 때만 알린다 */}
          {q.mode === 'type-term-to-meaning' ? (
            <Text style={modelReady ? q2.aiOn : q2.aiOff}>
              {modelReady ? '● AI 채점' : '○ 로딩 중'}
            </Text>
          ) : (
            <Text style={q2.aiOff} />
          )}
        </View>

        <View style={q2.card}>
          <Text style={q2.meta}>
            {fieldIcon(q.word.partOfSpeech)}  {q.word.partOfSpeech}
            {q.word.level != null ? `  ·  ${levelIcon(q.word.level)} L${q.word.level}` : ''}
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
              {judged.grade === 'correct' ? '✅ 정답입니다'
               : judged.grade === 'close' ? '🟡 비슷했어요'
               : judged.input === SKIPPED ? '🤔 다음에 또 나옵니다'
               : '❌ 오답입니다'}
            </Text>
            {judged.grade === 'close' && (
              <Text style={q2.closeHint}>뜻은 통하지만 정확한 답은 아닙니다</Text>
            )}
            <Text style={q2.answerLine}>{q.word.word}</Text>
            <Text style={q2.answerMeaning}>{q.word.meanings.join(' · ')}</Text>
            <Pressable style={S.button} onPress={next}>
              <Text style={S.buttonText}>
                {index + 1 === total ? '결과 보기' : '다음'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {!isChoiceMode(q.mode) && (
              <Pressable
                style={[S.button, (!input.trim() || grading) && S.buttonOff]}
                onPress={() => commit(input)}
                disabled={!input.trim() || grading}
              >
                <Text style={S.buttonText}>{grading ? '채점 중…' : '확인'}</Text>
              </Pressable>
            )}
            {/* 확인 옆이 아니라 아래에 둔다. 옆에 두면 급할 때 잘못 누른다. */}
            <Pressable
              style={q2.giveUp}
              onPress={giveUp}
              disabled={grading}
              hitSlop={6}
            >
              <Text style={q2.giveUpText}>🤔 모르겠어요</Text>
            </Pressable>
          </View>
        )}
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

  // 테두리 없는 보조 버튼. 확인보다 눈에 덜 띄어야 한다 —
  // 모르겠어요가 기본 선택처럼 보이면 생각하기 전에 누른다.
  giveUp: { paddingVertical: 12, alignItems: 'center' },
  giveUpText: { color: C.sub, fontSize: 15 },

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
