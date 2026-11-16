import { useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  useForeground,
} from 'react-native-google-mobile-ads';
import { C } from './theme';

/**
 * 배너 광고 한 자리.
 *
 * 광고를 화면 코드에 직접 박지 않고 여기로 모은다. 위치를 옮기거나
 * 빼야 할 때 이 파일과 부르는 쪽 한 줄만 보면 된다.
 *
 * ## 둘 곳
 *
 * 결과 화면의 점수와 오답노트 사이. 버튼에서 멀고, 내용 위에 겹치지
 * 않고, 목록 항목 사이에 끼지 않는 자리다. AdMob 이 '바람직하지 않은
 * 배너 구현'으로 드는 세 가지가 정확히 그 셋이다.
 * https://support.google.com/admob/answer/6275345
 *
 * 시험 화면에는 두지 않는다. 외우는 데 집중하는 중이고 오답을 터치해
 * 펼치는 동작이 잦아 잘못 눌릴 위험이 크다.
 *
 * ## 크기를 INLINE 으로 쓰는 이유
 *
 * 결과 화면은 ScrollView 다. 구글은 스크롤되는 콘텐츠 안에 넣을 때
 * INLINE_ADAPTIVE_BANNER 를 쓰라고 안내한다. ANCHORED 쪽은 화면
 * 위아래에 고정해 두는 용도다.
 * https://developers.google.com/admob/android/banner/inline-adaptive
 *
 * 정책이 금지하는 '스크롤할 때 움직이는 배너' 는 콘텐츠 위에 떠다니는
 * 오버레이를 말한다. 스크롤용 포맷을 따로 두고 그 자리에 쓰라고
 * 안내하는 이상, 제자리에 흘러가는 배너는 그 금지 대상이 아니다.
 *
 * ## 광고 단위 ID
 *
 * 개발 중에는 반드시 테스트 ID 를 쓴다. 자기 앱의 진짜 광고를 직접
 * 누르면 무효 클릭으로 계정이 정지될 수 있다.
 * __DEV__ 는 릴리스 빌드에서 false 라 실수로 테스트 광고가 나갈 일은
 * 없지만, 출시 전에 REAL_UNIT_ID 를 실제 값으로 바꿔야 한다.
 */

// TODO(출시 전): AdMob 콘솔에서 발급받은 배너 단위 ID 로 바꾼다.
//   ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY  (앱 ID 와 달리 슬래시다)
const REAL_UNIT_ID = '';

const unitId =
  __DEV__ || !REAL_UNIT_ID ? TestIds.ADAPTIVE_BANNER : REAL_UNIT_ID;

/**
 * 배너가 차지할 수 있는 최대 높이(dp).
 * 흔한 배너가 50~100dp 다. 넉넉히 두되 화면의 주인공인 점수·오답노트를
 * 밀어내지 않는 선으로 잡았다.
 */
const MAX_H = 120;

/**
 * 결과 화면(S.screen)의 좌우 패딩. 배너 폭을 여기에 맞춰 줄여야
 * 오답노트 카드와 좌우가 맞는다. 폭을 안 주면 기기 전체 폭을 써서
 * 혼자 화면 끝까지 삐져나간다.
 */
const SCREEN_PAD = 24;

export default function AdBanner() {
  const ref = useRef<BannerAd>(null);
  const { width } = useWindowDimensions();
  /**
   * 광고가 실제로 떴는가. 구분선과 여백을 이때만 그린다.
   * 오프라인에서 쓰라고 만든 앱이라 '광고 없음' 이 드물지 않고,
   * 그때 빈 줄만 남으면 레이아웃이 깨진 것처럼 보인다.
   */
  const [loaded, setLoaded] = useState(false);

  // iOS 는 앱이 백그라운드에 오래 있으면 WKWebView 가 죽어 빈 배너로
  // 돌아온다. 포그라운드로 올 때 다시 받는다. 안드로이드는 불필요.
  useForeground(() => {
    if (Platform.OS === 'ios') ref.current?.load();
  });

  return (
    <View style={loaded ? s.box : undefined}>
      <BannerAd
        ref={ref}
        unitId={unitId}
        size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
        /*
          maxHeight 를 주지 않으면 기본값이 '기기 화면 높이' 다.
          결과를 보러 온 화면을 광고가 통째로 덮을 수 있다.
          점수와 오답노트 사이를 적당히 차지하는 선으로 묶는다.
        */
        maxHeight={MAX_H}
        // 화면 패딩만큼 좁혀 오답노트 카드와 좌우를 맞춘다.
        width={Math.floor(width - SCREEN_PAD * 2)}
        onAdLoaded={() => setLoaded(true)}
        // 실패는 조용히 넘긴다. 광고가 없는 것은 이 앱에서 정상이다.
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  /** 광고가 떴을 때만 입힌다. 안 뜨면 이 틀 자체를 쓰지 않는다. */
  box: {
    alignItems: 'center',
    // 점수·오답노트와 붙지 않게 띄운다. 가까우면 결과의 일부로 읽힌다.
    marginVertical: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
});
