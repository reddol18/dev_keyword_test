import { StyleSheet } from 'react-native';

export const C = {
  text: '#111827',
  sub: '#6b7280',
  faint: '#9ca3af',
  line: '#d1d5db',
  card: '#f3f4f6',
  blue: '#2563eb',
  blueOff: '#cbd5e1',
  ok: '#16a34a',
  okBg: '#f0fdf4',
  close: '#d97706',
  closeBorder: '#f59e0b',
  closeBg: '#fffbeb',
  closeText: '#92400e',
  closeChip: '#fde68a',
  no: '#dc2626',
  noBg: '#fef2f2',
};

export const S = StyleSheet.create({
  flex: { flex: 1 },
  // flexGrow를 두지 않는다. ScrollView contentContainer에 flexGrow:1을 주면
  // 내용이 화면보다 길 때도 늘어나지 않아 아래쪽(시작 버튼)에 닿을 수 없다.
  screen: { padding: 24, gap: 16 },
  /** 내용이 짧아 화면을 채워야 할 때만 함께 쓴다 (결과 화면 등) */
  screenFill: { flexGrow: 1 },

  h1: { fontSize: 26, fontWeight: '700', color: C.text },
  h2: { fontSize: 18, fontWeight: '700', color: C.text },
  sub: { fontSize: 14, color: C.sub },

  button: {
    backgroundColor: C.blue, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', alignSelf: 'stretch',
  },
  buttonOff: { backgroundColor: C.blueOff },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { fontSize: 14, color: C.text },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
