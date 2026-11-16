/**
 * 릴리스 서명을 `prebuild` 후에도 살아남게 하는 config plugin.
 *
 * ## 왜 이 파일이 필요한가
 *
 * Expo 가 만드는 `android/app/build.gradle` 은 release 빌드도 **debug 키**로
 * 서명한다. 템플릿에 경고가 박혀 있다:
 *
 *   release {
 *       // Caution! In production, you need to generate your own keystore file.
 *       signingConfig signingConfigs.debug
 *
 * debug 키로 서명한 AAB 는 플레이 스토어가 거부한다. 그런데 `android/` 는
 * `.gitignore` 에 걸려 있고 `npx expo prebuild` 가 통째로 다시 만든다.
 * 그래서 `build.gradle` 을 손으로 고치면 **다음 prebuild 에서 사라진다.**
 * 한 번 빌드하고 끝이면 모르지만, 의존성을 하나 추가할 때마다 서명이
 * 조용히 debug 로 되돌아가는 건 사고로 이어진다.
 *
 * `expo-build-properties` 에 서명 옵션이 있으면 그걸 썼겠지만 없다.
 * (v57 안드로이드 옵션 전체를 확인했다: buildArchs·minSdkVersion·
 * extraProguardRules 등뿐이고 signingConfig 류는 없다.)
 * https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/
 *
 * 그래서 prebuild 파이프라인 **안에** 끼워 넣는다. config plugin 은
 * prebuild 가 네이티브 파일을 생성한 직후에 돌기 때문에, 몇 번을 다시
 * 만들어도 그 끝에서 항상 같은 수정이 다시 적용된다.
 * https://docs.expo.dev/config-plugins/introduction/
 *
 * ## 비밀번호를 어디에 두는가
 *
 * `build.gradle` 에 비밀번호를 박지 않는다. 이 파일은 공개 저장소에
 * 올라가고, `build.gradle` 은 생성물이라 실수로 커밋될 여지도 있다.
 *
 * 값의 출처는 `.env` 한 곳이다 (AdMob ID 와 같은 자리, 이미 gitignore 됨).
 * 플러그인이 그걸 읽어 `android/gradle.properties` 로 옮기고,
 * `build.gradle` 은 그 속성 이름만 참조한다. `gradle.properties` 도
 * prebuild 가 다시 만들지만 이 플러그인이 매번 다시 써 주므로 괜찮다.
 *
 * `.env` 가 없으면(남의 PC, CI) 아무것도 하지 않고 debug 서명을 그대로
 * 둔다. 서명 키가 없는 환경에서 빌드가 깨지는 쪽이 더 불편하다.
 */

const path = require('path');
const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/** Gradle 쪽에서 쓸 속성 이름. `build.gradle` 과 여기서만 쓴다. */
const PROP = {
  storeFile: 'WORDBOOK_RELEASE_STORE_FILE',
  storePassword: 'WORDBOOK_RELEASE_STORE_PASSWORD',
  keyAlias: 'WORDBOOK_RELEASE_KEY_ALIAS',
  keyPassword: 'WORDBOOK_RELEASE_KEY_PASSWORD',
};

/**
 * `.env` 에서 읽은 서명 정보. 하나라도 비면 null 을 돌려 서명 설정을
 * 건너뛴다. 반쯤 채워진 설정으로 빌드가 이상하게 실패하는 것보다
 * 아예 손대지 않는 쪽이 낫다.
 */
function readSigningEnv(projectRoot) {
  const keystore = process.env.ANDROID_KEYSTORE_FILE;
  const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
  const keyAlias = process.env.ANDROID_KEY_ALIAS;
  const keyPassword = process.env.ANDROID_KEY_PASSWORD || storePassword;

  if (!keystore || !storePassword || !keyAlias) return null;

  /*
    키스토어 경로는 절대 경로로 바꿔 둔다. `storeFile file(...)` 의
    상대 경로 기준은 `android/app/` 인데, 우리 키스토어는 prebuild 가
    지우지 못하도록 프로젝트 루트의 `keystore/` 에 있다. 기준이 다른
    경로를 섞는 것보다 여기서 한 번 펼치는 게 덜 헷갈린다.
  */
  const storeFile = path.isAbsolute(keystore)
    ? keystore
    : path.join(projectRoot, keystore);

  return { storeFile, storePassword, keyAlias, keyPassword };
}

/**
 * `.properties` 는 JS 문자열이 아니라 자체 문법이 있는 포맷이다.
 * 이걸 빼먹고 비밀번호에 `#` 이 들어간 채로 한 번 당했다 — `#` 이
 * 주석 시작이라 비밀번호가 그 앞에서 잘렸고, Gradle 은 끝까지 가서
 * "keystore password was incorrect" 로 죽었다. 원인이 비밀번호가
 * 아니라 파일 포맷이라 메시지만 보고는 찾기 어렵다.
 *
 * 그래서 특수문자를 유니코드 이스케이프(`\uXXXX`)로 바꿔 둔다.
 * `.properties` 는 이 표기를 읽어 주므로 값은 그대로 전달되고,
 * 주석·구분자로 오해될 글자가 파일에 남지 않는다.
 * https://docs.oracle.com/javase/8/docs/api/java/util/Properties.html#load-java.io.Reader-
 */
function escapeForProperties(value) {
  return String(value).replace(/[^A-Za-z0-9._/-]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${hex}`;
  });
}

/** `gradle.properties` 에 서명 값을 넣는다 (있으면 덮어쓴다). */
const withSigningGradleProperties = (config) =>
  withGradleProperties(config, (cfg) => {
    const signing = readSigningEnv(cfg.modRequest.projectRoot);
    if (!signing) return cfg;

    const values = {
      // 경로의 역슬래시는 `/` 로. Windows 도 이걸 받아 주고,
      // `.properties` 에서 역슬래시가 이스케이프로 먹히는 문제도 없어진다.
      [PROP.storeFile]: signing.storeFile.replace(/\\/g, '/'),
      [PROP.storePassword]: escapeForProperties(signing.storePassword),
      [PROP.keyAlias]: escapeForProperties(signing.keyAlias),
      [PROP.keyPassword]: escapeForProperties(signing.keyPassword),
    };

    // 이 플러그인이 전에 넣은 줄을 먼저 빼고 새로 넣는다. 그러지 않으면
    // prebuild 를 --clean 없이 돌릴 때마다 같은 키가 쌓인다.
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && Object.keys(values).includes(item.key)),
    );
    for (const [key, value] of Object.entries(values)) {
      cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });

/**
 * `build.gradle` 의 `signingConfigs` 에 release 를 추가하고,
 * `buildTypes.release` 가 그걸 가리키게 바꾼다.
 */
const withSigningAppBuildGradle = (config) =>
  withAppBuildGradle(config, (cfg) => {
    const signing = readSigningEnv(cfg.modRequest.projectRoot);
    if (!signing) return cfg;

    let gradle = cfg.modResults.contents;

    if (gradle.includes('signingConfigs.release')) {
      // 이미 적용됨 (prebuild 를 --clean 없이 두 번 돌린 경우)
      return cfg;
    }

    /*
      release 서명 블록을 debug 블록 바로 뒤에 끼운다.
      `findProperty` 로 읽는 이유: 값이 없는 환경에서 Gradle 이
      "could not find property" 로 죽지 않고 그냥 null 이 된다.
    */
    const releaseSigningConfig = `
        release {
            // ★ plugins/withReleaseSigning.js 가 생성한 블록이다.
            // 값은 .env → gradle.properties 를 거쳐 들어온다.
            storeFile file(findProperty('${PROP.storeFile}'))
            storePassword findProperty('${PROP.storePassword}')
            keyAlias findProperty('${PROP.keyAlias}')
            keyPassword findProperty('${PROP.keyPassword}')
        }
`;

    const debugBlock = /(signingConfigs\s*\{\s*\n\s*debug\s*\{[\s\S]*?\n\s*\}\n)/;
    if (!debugBlock.test(gradle)) {
      throw new Error(
        '[withReleaseSigning] build.gradle 의 signingConfigs.debug 블록을 찾지 못했습니다. ' +
          'Expo 템플릿이 바뀐 것 같습니다 — plugins/withReleaseSigning.js 의 정규식을 확인하세요.',
      );
    }
    gradle = gradle.replace(debugBlock, `$1${releaseSigningConfig}`);

    // release 빌드가 debug 키를 쓰는 기본값을 돌려놓는다.
    const releaseUsesDebugKey = /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!releaseUsesDebugKey.test(gradle)) {
      throw new Error(
        '[withReleaseSigning] buildTypes.release 가 signingConfigs.debug 를 쓰는 부분을 ' +
          '찾지 못했습니다. 이미 다른 값으로 바뀐 것인지 확인하세요.',
      );
    }
    gradle = gradle.replace(releaseUsesDebugKey, '$1signingConfig signingConfigs.release');

    cfg.modResults.contents = gradle;
    return cfg;
  });

module.exports = (config) =>
  withSigningGradleProperties(withSigningAppBuildGradle(config));
