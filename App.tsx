import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { BackHandler, StyleSheet } from 'react-native';
import * as NativeSplash from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StartScreen from './src/StartScreen';
import type { StartConfig } from './src/StartScreen';
import QuizScreen from './src/QuizScreen';
import ListScreen from './src/ListScreen';
import SplashScreen from './src/SplashScreen';
import { loadModel } from './src/embedding';
import mobileAds from 'react-native-google-mobile-ads';

// 네이티브 스플래시를 런칭 화면이 뜰 때까지 붙잡아 둔다.
// 컴포넌트 밖(전역)에서 불러야 자동으로 숨겨지기 전에 실행된다.
NativeSplash.preventAutoHideAsync().catch(() => {});

/** 런칭 화면을 최소한 이만큼은 보여준다 (너무 빨리 지나가면 읽히지 않는다) */
const SPLASH_MIN_MS = 1200;
/** 모델이 느려도 이 시간이 지나면 넘어간다. 채점은 규칙 기반으로 동작한다. */
const SPLASH_MAX_MS = 3000;
/** 앱이 켜진 시각. 모듈이 읽히는 때가 사실상 시작 시점이다. */
const START_AT = Date.now();

/**
 * 지금 보고 있는 화면.
 *
 * 이전에는 `config` / `listing` state 2개로 갈랐다. 그러면
 * `listing === true && config !== null` 같은 **무효 조합이 표현 가능**한데,
 * 판별 유니온으로 바꾸면 그런 상태가 애초에 만들어지지 않는다.
 * 뒤로가기도 "start 가 아니면 start 로" 한 줄로 끝난다.
 *
 * `react-navigation` 을 넣지 않은 이유: 화면이 3개뿐이고, 출시 직전에
 * 네이티브 의존성을 추가하면 ONNX·AdMob 가 들어간 빌드에 변수를 더 얹는다.
 */
type Route =
  | { name: 'start' }
  | { name: 'list' }
  | { name: 'quiz'; config: StartConfig };

const START: Route = { name: 'start' };

export default function App() {
  const [route, setRoute] = useState<Route>(START);
  const [modelReady, setModelReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // 모델 로딩은 수 초 걸린다. 그동안에도 앱은 쓸 수 있고,
  // 채점은 규칙 기반으로 동작한다.
  useEffect(() => {
    loadModel()
      .then(() => setModelReady(true))
      .catch((e) => console.warn('[model] 로딩 실패, 규칙 기반으로 동작:', e));
  }, []);

  // 광고 SDK. 결과 화면에 배너 하나를 띄우는 데만 쓴다.
  // 실패해도 삼킨다 — 광고는 부수 기능이고, 이 앱은 비행기 모드에서도
  // 쓰라고 만든 앱이다. 네트워크가 없으면 배너만 높이 0 으로 접힌다.
  useEffect(() => {
    mobileAds()
      .initialize()
      .catch((e) => console.warn('[ads] 초기화 실패, 광고 없이 동작:', e));
  }, []);

  // 런칭 화면을 내리는 시점.
  // 모델이 준비되면 최소 시간만 채우고 넘어가고, 안 되면 최대 시간에서 끊는다.
  // 남은 시간은 "앱이 켜진 시각"부터 재야 한다. modelReady 가 바뀔 때마다
  // 타이머를 새로 걸면 그만큼 뒤로 밀려 최대 시간을 넘긴다.
  useEffect(() => {
    const left = modelReady
      ? Math.max(0, SPLASH_MIN_MS - (Date.now() - START_AT))
      : Math.max(0, SPLASH_MAX_MS - (Date.now() - START_AT));
    const t = setTimeout(() => setSplashDone(true), left);
    return () => clearTimeout(t);
  }, [modelReady]);

  // 런칭 화면이 그려진 뒤에 네이티브 스플래시를 내린다.
  // 순서가 반대면 그 사이에 빈 흰 화면이 한 번 번쩍인다.
  useEffect(() => {
    NativeSplash.hide();
  }, []);

  const goStart = useCallback(() => setRoute(START), []);

  /**
   * 지금 화면이 뒤로가기를 직접 처리하겠다고 등록한 함수.
   *
   * 시험 화면은 "푼 문제가 있으면 확인부터" 라는 규칙이 있는데, 그 판단에
   * 필요한 `answers` 는 `QuizScreen` 의 state 라서 여기서 볼 수 없다.
   * 화면이 자기 규칙을 여기 꽂아 두고, 처리했으면 true 를 돌려준다.
   *
   * state 가 아니라 ref 인 이유: 이 값이 바뀔 때 리렌더가 필요하지 않고,
   * 아래 `BackHandler` effect 를 다시 걸 이유도 없다. state 로 두면
   * 등록할 때마다 리스너를 떼고 다시 붙인다.
   *
   * ★ 비우는 건 **등록한 화면의 책임**이다(`QuizScreen` 의 cleanup).
   * 여기서 `route` 가 바뀔 때 비우는 effect 를 두면 안 된다 — 자식 effect
   * 가 부모보다 먼저 돌기 때문에, start→quiz 로 갈 때 QuizScreen 이
   * 등록한 핸들러를 부모가 곧바로 null 로 덮어써서 확인 다이얼로그가
   * 통째로 사라진다.
   */
  const screenBack = useRef<(() => boolean) | null>(null);

  /**
   * 안드로이드 하드웨어 뒤로가기.
   *
   * 핸들러가 없거나 전부 false 를 돌려주면 RN 이 기본 동작(앱 종료)을
   * 한다. 그래서 start 화면 밖에서는 반드시 true 를 돌려줘야 한다 —
   * 이게 없어서 시험 중 뒤로가기가 앱을 그냥 종료시켰다.
   *
   * 정리(cleanup)는 RN 0.86 기준 **구독 객체의 `remove()`** 다.
   * `BackHandler.removeEventListener` 는 이 버전에 아예 없으므로
   * (`Libraries/Utilities/BackHandler.d.ts` 참조) 부르면 터진다.
   * 안 떼면 리렌더마다 리스너가 쌓여 뒤로가기 한 번에 여러 번 동작한다.
   *
   * `route` 를 의존성에 넣어 매번 다시 거는 쪽이 맞다. 핸들러가 클로저로
   * 잡은 `route` 가 낡으면 이미 start 인데도 true 를 돌려줘 종료가 막힌다.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // 화면이 자기 규칙으로 처리했으면(확인 다이얼로그 등) 거기서 끝낸다
      if (screenBack.current?.()) return true;
      if (route.name !== 'start') {
        goStart();
        return true;           // 기본 동작(종료)을 막는다
      }
      return false;            // start 화면에서는 종료를 허용한다
    });
    return () => sub.remove();
  }, [route, goStart]);

  if (!splashDone) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SplashScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        {route.name === 'list' ? (
          <ListScreen onExit={goStart} />
        ) : route.name === 'start' ? (
          <StartScreen
            modelReady={modelReady}
            onStart={(config) => setRoute({ name: 'quiz', config })}
            onOpenList={() => setRoute({ name: 'list' })}
          />
        ) : (
          <QuizScreen
            // 시험으로 들어오는 길은 start 화면뿐이라, 새 시험은 항상
            // unmount → mount 를 거친다. 그래서 key 로 강제할 필요가 없다.
            config={route.config}
            modelReady={modelReady}
            onExit={goStart}
            onBackRequest={screenBack}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
