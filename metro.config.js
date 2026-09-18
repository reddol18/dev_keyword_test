const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .onnx 모델을 에셋으로 번들에 포함시킨다.
// (tokenizer.json은 sourceExts의 json으로 이미 처리된다)
config.resolver.assetExts.push('onnx');

module.exports = config;
