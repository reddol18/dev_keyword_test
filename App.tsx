import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import * as NativeSplash from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StartScreen from './src/StartScreen';
import type { StartConfig } from './src/StartScreen';
import QuizScreen from './src/QuizScreen';
import ListScreen from './src/ListScreen';
import SplashScreen from './src/SplashScreen';
import { loadModel } from './src/embedding';

// 네이티브 스플래시를 런칭 화면이 뜰 때까지 붙잡아 둔다.
// 컴포넌트 밖(전역)에서 불러야 자동으로 숨겨지기 전에 실행된다.
NativeSplash.preventAutoHideAsync().catch(() => {});

/** 런칭 화면을 최소한 이만큼은 보여준다 (너무 빨리 지나가면 읽히지 않는다) */
const SPLASH_MIN_MS = 1200;
/** 모델이 느려도 이 시간이 지나면 넘어간다. 채점은 규칙 기반으로 동작한다. */
const SPLASH_MAX_MS = 3000;
/** 앱이 켜진 시각. 모듈이 읽히는 때가 사실상 시작 시점이다. */
const START_AT = Date.now();

export default function App() {
  const [config, setConfig] = useState<StartConfig | null>(null);
  const [listing, setListing] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // 모델 로딩은 수 초 걸린다. 그동안에도 앱은 쓸 수 있고,
  // 채점은 규칙 기반으로 동작한다.
  useEffect(() => {
    loadModel()
      .then(() => setModelReady(true))
      .catch((e) => console.warn('[model] 로딩 실패, 규칙 기반으로 동작:', e));
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
        {listing ? (
          <ListScreen onExit={() => setListing(false)} />
        ) : config === null ? (
          <StartScreen
            modelReady={modelReady}
            onStart={setConfig}
            onOpenList={() => setListing(true)}
          />
        ) : (
          <QuizScreen
            config={config}
            modelReady={modelReady}
            onExit={() => setConfig(null)}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
