import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';
import { Tokenizer } from '@huggingface/tokenizers';

import tokenizerJson from '../assets/model/tokenizer.json';
import tokenizerConfig from '../assets/model/tokenizer_config.json';

/**
 * 온디바이스 한국어 임베딩.
 *
 * 모델: jhgan/ko-sroberta-multitask (int8 양자화, 106MB)
 * 런타임: ONNX Runtime — 폰 CPU에서 추론한다. 네트워크를 쓰지 않는다.
 * 토크나이저: @huggingface/tokenizers (순수 JS, 의존성 없음)
 *
 * 로딩이 수 초 걸리므로 앱 시작 시 미리 준비시키고,
 * 준비되기 전에는 규칙 기반 채점으로 동작한다 (grading.ts 참조).
 */

let session: InferenceSession | null = null;
let tokenizer: Tokenizer | null = null;
let loading: Promise<void> | null = null;

/**
 * 모델 로딩. 여러 번 불러도 한 번만 로딩한다.
 *
 * **실패하면 캐시를 비운다.** 예전에는 `loading` 에 reject 된 Promise 가
 * 그대로 남아서, 한 번 실패하면 이후 모든 호출이 같은 실패 Promise 를 받아
 * 세션 내내 영구 실패였다 — 앱을 완전히 종료해야 풀렸다 (이슈 #23).
 * 모델이 106MB 라 저사양 기기에서 OOM·파일 접근 실패가 현실적으로 나온다.
 *
 * `loading = null` 로 되돌리면 다음 호출이 **재시도**가 된다. 실패를
 * 삼키지는 않고 그대로 다시 던지므로, 호출부가 '실패' 상태를 표시할 수 있다.
 */
export function loadModel(): Promise<void> {
  if (loading) return loading;

  const run = async (): Promise<void> => {
    const asset = Asset.fromModule(require('../assets/model/model.onnx'));
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    session = await InferenceSession.create(uri.replace('file://', ''));
    tokenizer = new Tokenizer(tokenizerJson as never, tokenizerConfig as never);
  };

  // 캐시에 넣는 것과 실패 처리를 분리한다. `catch` 를 async 본문 안에
  // 두면 `require` 처럼 **동기로 던지는** 경우에 캐시를 비우는 코드가
  // `loading = ...` 보다 먼저 돌아서, 결국 reject 된 Promise 가 캐시에
  // 남는다 — 고치려던 버그가 그대로 재현된다.
  const attempt = run().catch((e) => {
    // 중간까지 올라간 것이 남아 있으면 isModelReady 가 어긋난다.
    // 둘 다 있어야 준비된 것이므로 같이 되돌린다.
    session = null;
    tokenizer = null;
    // 이 호출이 아직 캐시에 있을 때만 비운다. 재시도가 이미 새 Promise 를
    // 넣어 둔 뒤라면 남의 것을 지우는 코드가 된다.
    if (loading === attempt) loading = null;
    throw e;
  });

  loading = attempt;
  return attempt;
}

export function isModelReady(): boolean {
  return session !== null && tokenizer !== null;
}

/**
 * 모델 로딩 상태.
 *
 * 불리언 하나로는 **세 번째 상태를 표현할 수 없다** — 그게 이슈 #23 의
 * 근원이었다. `modelReady === false` 가 "아직 로딩 중"과 "실패해서 영원히
 * 안 됨"을 같이 뜻해서, 실패한 기기에 "로딩 중" 이 영구히 떠 있었다.
 *
 * 화면 문구를 상태별로 가를 수 있게 유니온으로 둔다.
 */
export type ModelStatus = 'loading' | 'ready' | 'failed';

/** 짧은 구를 다루므로 32토큰이면 충분하다. 길이를 줄이면 추론도 빨라진다. */
const MAX_LEN = 32;

/**
 * 문장들을 임베딩한다.
 * 평균 풀링 후 L2 정규화 → 내적이 곧 코사인 유사도가 된다.
 */
async function embed(texts: string[]): Promise<Float32Array[]> {
  if (!session || !tokenizer) throw new Error('model not loaded');

  const encoded = texts.map((t) => {
    const enc = tokenizer!.encode(t);
    return {
      ids: enc.ids.slice(0, MAX_LEN),
      mask: enc.attention_mask.slice(0, MAX_LEN),
    };
  });
  const len = Math.max(...encoded.map((e) => e.ids.length));

  const ids = new BigInt64Array(texts.length * len);
  const mask = new BigInt64Array(texts.length * len);
  encoded.forEach((e, row) => {
    for (let i = 0; i < len; i++) {
      const at = row * len + i;
      ids[at] = BigInt(i < e.ids.length ? e.ids[i] : 0);
      mask[at] = BigInt(i < e.mask.length ? e.mask[i] : 0);
    }
  });

  const dims = [texts.length, len];
  const out = await session.run({
    input_ids: new Tensor('int64', ids, dims),
    attention_mask: new Tensor('int64', mask, dims),
  });

  const hidden = out.last_hidden_state;
  const data = hidden.data as Float32Array;
  const H = hidden.dims[2];

  return texts.map((_, row) => {
    const vec = new Float32Array(H);
    let count = 0;
    for (let t = 0; t < len; t++) {
      if (mask[row * len + t] === 0n) continue;
      count++;
      const base = (row * len + t) * H;
      for (let h = 0; h < H; h++) vec[h] += data[base + h];
    }
    if (count === 0) count = 1;
    let norm = 0;
    for (let h = 0; h < H; h++) {
      vec[h] /= count;
      norm += vec[h] * vec[h];
    }
    norm = Math.sqrt(norm) || 1;
    for (let h = 0; h < H; h++) vec[h] /= norm;
    return vec;
  });
}

/** 두 문자열의 코사인 유사도 (-1 ~ 1). 정규화했으므로 내적으로 구한다. */
export async function similarity(a: string, b: string): Promise<number> {
  const [x, y] = await embed([a, b]);
  let dot = 0;
  for (let i = 0; i < x.length; i++) dot += x[i] * y[i];
  return dot;
}

/** 입력과 여러 정답 후보 중 가장 높은 유사도를 돌려준다. */
export async function maxSimilarity(
  input: string,
  candidates: string[],
): Promise<number> {
  if (candidates.length === 0) return 0;
  const vecs = await embed([input, ...candidates]);
  const q = vecs[0];
  let best = -1;
  for (let i = 1; i < vecs.length; i++) {
    let dot = 0;
    for (let h = 0; h < q.length; h++) dot += q[h] * vecs[i][h];
    if (dot > best) best = dot;
  }
  return best;
}
