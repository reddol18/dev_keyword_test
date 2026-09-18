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

/** 모델 로딩. 여러 번 불러도 한 번만 로딩한다. */
export function loadModel(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const asset = Asset.fromModule(require('../assets/model/model.onnx'));
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    session = await InferenceSession.create(uri.replace('file://', ''));
    tokenizer = new Tokenizer(tokenizerJson as never, tokenizerConfig as never);
  })();
  return loading;
}

export function isModelReady(): boolean {
  return session !== null && tokenizer !== null;
}

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
