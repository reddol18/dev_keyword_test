import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * 런칭 화면.
 *
 * 안드로이드 네이티브 스플래시(windowBackground)는 그림 한 장만 띄울 수 있어
 * 글자를 넣지 못한다. 그래서 같은 배경색으로 이 화면을 이어 붙여
 * 앱 이름과 설명을 보여준다. 배경이 같으니 이음새가 보이지 않는다.
 */
export default function SplashScreen() {
  return (
    <View style={s.root}>
      <Image
        source={require('../assets/splash-icon.png')}
        style={s.logo}
        resizeMode="contain"
      />
      <Text style={s.title}>용어먹는하마</Text>
      <Text style={s.tagline}>면접에 나오는 IT 용어, 하마처럼 씹어 삼키기</Text>

      <View style={s.footer}>
        <Text style={s.footerText}>오프라인 · AI 채점</Text>
      </View>
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
  logo: { width: 180, height: 180, borderRadius: 32 },
  title: {
    marginTop: 28,
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
  footer: { position: 'absolute', bottom: 48, alignItems: 'center' },
  footerText: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
});
