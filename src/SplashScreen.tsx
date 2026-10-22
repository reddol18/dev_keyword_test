import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

/**
 * 런칭 화면.
 *
 * 안드로이드 네이티브 스플래시(windowBackground)는 그림 한 장만 띄울 수 있어
 * 글자를 넣지 못한다. 그래서 같은 배경색으로 이 화면을 이어 붙여
 * 앱 이름과 설명을 보여준다. 배경이 같으니 이음새가 보이지 않는다.
 *
 * ★ 아이콘이 튀지 않게 하는 것이 이 화면의 핵심이다.
 *
 * 네이티브 스플래시는 아이콘 하나만 화면 정가운데에 둔다. 이쪽에서
 * [아이콘][제목][설명]을 세로로 쌓아 가운데 정렬하면, 셋의 묶음이 가운데로
 * 가면서 아이콘만 그만큼 위로 올라간다 — 전환 순간 아이콘이 점프한다.
 *
 * 그래서 아이콘은 네이티브와 똑같이 정가운데 두고, 글자는 position:absolute 로
 * 레이아웃에서 빼내 아이콘 아래에 띄운다. 글자가 생겨도 아이콘은 안 움직인다.
 * 같은 이유로 글자를 조건부 렌더링하지 않는다 — opacity 만 0에서 1로 간다.
 */

const LOGO = 180;

export default function SplashScreen() {
  // 0 → 1. opacity 와 translateY 둘 다 이 값 하나로 움직인다.
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: 120,              // 네이티브 → JS 전환이 끝난 뒤 시작한다
      easing: Easing.out(Easing.cubic),
      // 반드시 네이티브 드라이버로 돌린다. 이 화면이 가리고 있는 동안
      // ONNX 모델(106MB)이 JS 스레드에서 로딩돼 애니메이션이 끊긴다.
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const rise = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
    ],
  };

  return (
    <View style={s.root}>
      {/* 네이티브 스플래시와 같은 자리 — 아무것도 이 아이콘을 밀어내지 않는다 */}
      <Image
        source={require('../assets/splash-icon.png')}
        style={s.logo}
        resizeMode="contain"
      />

      {/* 레이아웃에서 빠져 있어 아이콘 위치에 영향을 주지 않는다 */}
      <Animated.View style={[s.caption, rise]} pointerEvents="none">
        <Text style={s.title}>용어먹는하마</Text>
        <Text style={s.tagline}>면접에 나오는 IT 용어, 하마처럼 씹어 삼키기</Text>
      </Animated.View>

      <Animated.View style={[s.footer, rise]} pointerEvents="none">
        <Text style={s.footerText}>오프라인 · AI 채점</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // 네이티브 스플래시와 같은 색이어야 전환이 안 보인다
  root: {
    flex: 1,
    backgroundColor: '#4A9EFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: LOGO, height: LOGO, borderRadius: 32 },

  // 아이콘 중심에서 아래로. 레이아웃에서 빠져 있어 아이콘을 밀지 않는다.
  caption: {
    position: 'absolute',
    top: '50%',
    marginTop: LOGO / 2 + 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },

  footer: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  footerText: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
});
