#!/bin/sh
# 온디바이스 한국어 임베딩 모델을 받는다 (106MB).
# 저장소에는 넣지 않으므로 클론 후 한 번 실행해야 한다.
set -e
mkdir -p assets/model
BASE="https://huggingface.co/jhgan/ko-sroberta-multitask/resolve/main"
echo "모델 다운로드 중 (106MB)..."
curl -L --progress-bar -o assets/model/model.onnx \
  "$BASE/onnx/model_qint8_avx512_vnni.onnx"
curl -sL -o assets/model/tokenizer.json        "$BASE/tokenizer.json"
curl -sL -o assets/model/tokenizer_config.json "$BASE/tokenizer_config.json"
echo "완료:"
ls -lh assets/model/
