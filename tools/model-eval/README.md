# 채점 모델 비교

임베딩 모델을 바꾸려 할 때, **앱에 넣기 전에** 채점이 되는지 PC 에서 먼저 본다.
폰이 필요 없다.

## 왜 필요한가

채점 임계값 0.85 는 지금 모델의 실측값 위에 잡힌 숫자다
(https://github.com/reddol18/dev_keyword_test/issues/3#issuecomment-6332184571).
모델을 바꾸면 유사도 분포가 통째로 바뀌므로 임계값이 더는 맞지 않는다.

## 보는 것 — 분리 폭

```
분리 폭 = (활용형 최저) - (대립쌍·형제쌍·어순뒤집기 최고)
```

- **통과해야 하는 것**: 활용형 (`쪼갠 구조` ↔ `나눈 구조`) — 같은 뜻을 다르게 쓴 것
- **막아야 하는 것**: 대립쌍(동기/비동기), 형제쌍(STT/TTS), 어순 뒤집기

이 둘이 겹치면(**분리 폭이 음수**) 임계값을 어디에 둬도 오채점이 난다.
양수여야 하고, 그 구간 안에 0.85 가 들어가야 한다.

## 쓰는 법

```sh
uv venv --python 3.11 --python-preference only-managed .venv
uv pip install --python .venv/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv/Scripts/python.exe transformers sentencepiece

.venv/Scripts/python.exe measure.py jhgan/ko-sroberta-multitask   # 지금 모델
.venv/Scripts/python.exe measure.py <비교할-모델-id>
```

`--verify` 를 붙이면 `pairs.json` 의 `expect`(폰 실측값)와 비교한다.

## 주의 — PC 값은 폰과 정확히 같지 않다

`measure.py` 는 **fp32** 로 잰다. 폰은 int8 ONNX 를 쓴다.

앱이 받는 파일이 `model_qint8_avx512_vnni.onnx` 인데 **AVX512-VNNI 는
x86 명령어 집합**이다. AVX512 가 없는 PC(예: i7-8700K)에서는 다른 연산
경로를 타서, 짧은 구에서 폰 값과 0.1~0.26 까지 벌어진다. 토큰이 적으면
양자화 오차가 평균 풀링으로 상쇄되지 않기 때문이다. 긴 문장은 0.004 까지
일치한다. (토크나이저는 앱과 PC 가 완전히 같다 — 따로 확인했다.)

그래서 **절대값을 폰 값과 비교하지 말고**, 같은 PC 에서 같은 정밀도로
**모델끼리 비교**한다. 분리 폭의 부호와 크기는 그렇게 봐도 유효하다.

## 측정해 둔 결과 (2026-10-23)

| 모델 | 파라미터 | 분리 폭 | 판정 |
|---|---|---|---|
| **jhgan/ko-sroberta-multitask** (지금) | 110.6M | **+0.1455** | 유일하게 통과 |
| bongsoo/albert-small-kor-sbert-v1.1 | 11.7M | −0.0160 | 대립쌍을 정답 처리 |
| snunlp/KR-SBERT-V40K-klueNLI-augSTS | 116.8M | −0.0496 | 겹침 + 더 큼 |
| intfloat/multilingual-e5-small | 117.7M | −0.0040 | 겹침 + 더 큼 |
| paraphrase-multilingual-MiniLM-L12-v2 | 117.7M | −0.2112 | 활용형도 못 통과 |

자세한 근거는
https://github.com/reddol18/dev_keyword_test/issues/8 에 있다.
