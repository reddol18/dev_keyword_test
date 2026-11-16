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
//
// 3) libonnxruntimejsi.so 를 16KB 페이지로 정렬
//    이 라이브러리만 패키지의 CMakeLists.txt 로 우리 빌드에서 컴파일된다.
//    NDK r27 은 기본 정렬이 4KB 라서 플레이 콘솔이 "앱이 16KB 메모리 페이지
//    크기를 지원하지 않습니다" 로 출시를 막았다. 앱의 64비트 .so 17개 중
//    이것 하나만 4KB 였다(나머지는 미리 빌드돼 16KB 로 들어온다).
//    16KB 페이지 기기에서는 이 라이브러리를 못 올려 앱이 시작 즉시 죽는다.
//    링커 플래그로 직접 주면 NDK 버전과 무관하게 적용된다.
//    https://developer.android.com/guide/practices/page-sizes
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

const cmake = 'node_modules/onnxruntime-react-native/android/CMakeLists.txt';
const pageFlag =
  'target_link_options(onnxruntimejsi PRIVATE "-Wl,-z,max-page-size=16384")';
if (fs.existsSync(cmake)) {
  const src = fs.readFileSync(cmake, 'utf8');
  if (!src.includes(pageFlag)) {
    fs.writeFileSync(cmake, src.trimEnd() + '\n\n# 16KB page size (postinstall)\n' + pageFlag + '\n');
    console.log('[postinstall] added 16KB page alignment to', cmake);
  }
}
