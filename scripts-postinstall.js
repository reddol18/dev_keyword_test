// onnxruntime-react-native 패치 (재설치 후에도 유지되도록 postinstall로 처리)
//
// 1) unimodule.json 제거
//    expo-modules-autolinking이 이 파일을 보고 Expo 모듈로 오인해
//    RN 커뮤니티 자동링킹에서 제외한다. 실제로는 Expo 모듈이 아니라
//    어느 쪽에도 등록되지 않고, 앱은 실행 시점에 install of null로 죽는다.
//    빌드는 성공하므로 빌드 로그에 단서가 남지 않는다.
//    https://github.com/microsoft/onnxruntime/issues/29004
//
// 2) VersionNumber → 문자열 비교
//    Gradle 9에서 org.gradle.util.VersionNumber가 제거됐다.
//    해당 코드는 RN 0.71 미만에서만 쓰이는 분기라 우리(0.86)에겐 불필요하다.
const fs = require('fs');

const uni = 'node_modules/onnxruntime-react-native/unimodule.json';
if (fs.existsSync(uni)) {
  fs.unlinkSync(uni);
  console.log('[postinstall] removed', uni);
}

const gradle = 'node_modules/onnxruntime-react-native/android/build.gradle';
if (fs.existsSync(gradle)) {
  const before = fs.readFileSync(gradle, 'utf8');
  const after = before.replace(
    'if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {',
    'if (REACT_NATIVE_VERSION.tokenize(".")[1].toInteger() < 71 && REACT_NATIVE_VERSION.tokenize(".")[0].toInteger() == 0) {',
  );
  if (after !== before) {
    fs.writeFileSync(gradle, after);
    console.log('[postinstall] patched VersionNumber in', gradle);
  }
}
