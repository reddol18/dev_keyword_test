/**
 * jest 준비 작업 — 네이티브 모듈을 가짜로 바꾼다.
 *
 * 테스트하는 건 순수 함수뿐인데, 그 함수들이 든 파일이 네이티브 모듈을
 * import 하고 있다. import 시점에 네이티브 바인딩을 찾으므로 Node 에서는
 * 바로 터진다 (`Cannot read properties of undefined (reading 'install')`).
 *
 *   grading.ts → embedding.ts → onnxruntime-react-native
 *   srs.ts     → @react-native-async-storage/async-storage
 *
 * 그래서 두 개만 막아 둔다. 채점 로직 자체는 가짜가 아니라 실제 코드를 쓴다.
 */

// AsyncStorage — 라이브러리가 공식 제공하는 메모리 구현
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * ONNX Runtime — 네이티브 추론기. 테스트에서는 쓰지 않는다.
 *
 * 중요: `isModelReady()` 가 false 로 남아야 한다. 그래야 `gradeAsync` 가
 * 규칙 기반 경로(어간·near)만 타고, 테스트가 모델 유사도에 흔들리지 않는다.
 * 모델을 로딩하지 않으면 embedding.ts 의 session 이 null 로 남으므로
 * 여기서 따로 할 일은 없다.
 */
jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: {
    create: jest.fn(() => Promise.reject(new Error('테스트에서는 모델을 쓰지 않는다'))),
  },
  Tensor: jest.fn(),
}));
