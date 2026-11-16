/**
 * 동적 앱 설정 — AdMob ID 만 여기서 주입한다.
 *
 * ## 왜 app.json 을 두고 이 파일을 또 두는가
 *
 * 앱 이름·아이콘·패키지명처럼 공개해도 되고 공개하는 편이 나은 설정은
 * 그대로 `app.json` 에 남긴다. 저장소를 열었을 때 정적 JSON 한 장으로
 * 읽히는 쪽이 좋다.
 *
 * 반면 AdMob ID 는 `.env` 에만 둔다. 이 저장소가 공개라서다.
 * `app.json` 은 정적 JSON 이라 `process.env` 를 못 읽는다. 그래서
 * 함수형 동적 설정을 하나 더 두고, Expo 가 넘겨 주는 `config`
 * (= app.json 의 expo 블록)를 펼친 뒤 AdMob 부분만 덮어쓴다.
 * 함수로 내보내야 `config` 인자가 들어온다.
 * https://docs.expo.dev/workflow/configuration/
 *
 * `.env` 는 Expo CLI 가 알아서 `process.env` 로 읽어 준다. dotenv 를
 * 따로 부를 필요가 없다.
 * https://docs.expo.dev/guides/environment-variables/
 *
 * ## ID 가 비밀이냐 하면, 아니다
 *
 * AdMob 앱 ID 와 광고 단위 ID 는 원래 클라이언트에 박혀 배포된다.
 * APK 를 뜯으면 누구나 본다. 숨겨서 지킬 수 있는 값이 아니다.
 * 그래도 `.env` 로 뺀 이유는 사용자가 `.env` 에 넣어 둔 의도를 따르는
 * 것이고, 공개 저장소 히스토리에 계정과 묶인 식별자를 남기지 않는
 * 편이 깔끔하기 때문이다. 보안이 아니라 위생 문제로 다룬다.
 *
 * ## 기본값을 테스트 ID 로 두는 이유
 *
 * `.env` 가 없는 환경(CI, 저장소를 clone 한 남의 PC)에서도 빌드가
 * 깨지지 않아야 한다. 그때는 구글 공식 테스트 ID 로 떨어진다.
 * 실제 ID 가 안 들어간 빌드는 광고가 테스트 광고로 뜨니, 잘못 섞여도
 * 무효 클릭 사고로는 이어지지 않는다.
 */

/** 구글 공식 테스트 ID. `.env` 가 없을 때 쓰는 기본값이다. */
const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';

const appId = process.env.ADMOB_ID || TEST_APP_ID;
const bannerUnitId = process.env.ADMOB_AD_ID || TEST_BANNER_UNIT_ID;

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    // app.json 의 plugins 중 AdMob 것만 빼고 그대로 쓴다.
    // 배열 통째로 다시 쓰면 splash·build-properties 설정이 사라진다.
    ...(config.plugins ?? []).filter(
      (p) => !(Array.isArray(p) ? p[0] : p)?.includes?.('google-mobile-ads'),
    ),
    ['react-native-google-mobile-ads', { androidAppId: appId }],
  ],
  extra: {
    ...config.extra,
    /*
      JS 런타임(AdBanner.tsx)이 읽을 값.
      `process.env` 는 EXPO_PUBLIC_ 접두사가 붙은 것만 번들에 박히고,
      `.env` 의 키 이름은 사용자가 정한 것이라 바꾸지 않는다. 그래서
      extra 로 넘기고 expo-constants 로 꺼낸다.
    */
    admobBannerUnitId: bannerUnitId,
  },
});
