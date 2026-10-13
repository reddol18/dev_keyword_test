import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import StartScreen from './src/StartScreen';
import type { StartConfig } from './src/StartScreen';
import QuizScreen from './src/QuizScreen';
import ListScreen from './src/ListScreen';
import { loadModel } from './src/embedding';

export default function App() {
  const [config, setConfig] = useState<StartConfig | null>(null);
  const [listing, setListing] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  // 모델 로딩은 수 초 걸린다. 그동안에도 앱은 쓸 수 있고,
  // 채점은 규칙 기반으로 동작한다.
  useEffect(() => {
    loadModel()
      .then(() => setModelReady(true))
      .catch((e) => console.warn('[model] 로딩 실패, 규칙 기반으로 동작:', e));
  }, []);

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
