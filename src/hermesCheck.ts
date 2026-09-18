/**
 * Hermes 엔진의 유니코드 지원 확인.
 *
 * @huggingface/tokenizers는 내부적으로 String.normalize()와
 * 유니코드 속성 이스케이프(\p{...})를 쓴다. 두 기능 모두 과거
 * Hermes에서 크래시하거나 SyntaxError를 낸 이력이 있다.
 * (RN 28698, 29807) 현재는 고쳐진 것으로 보이지만 확인이 필요하다.
 *
 * 한글은 NFC/NFD 조합이 실제로 일어나므로 영어보다 위험하다.
 */
export function checkHermesUnicode() {
  const results: Record<string, string> = {};

  try {
    const nfd = '조심스러운'.normalize('NFD');
    const nfc = nfd.normalize('NFC');
    results.normalize =
      nfc === '조심스러운' ? `OK (NFD ${nfd.length}자 → NFC 복원)` : `MISMATCH: ${nfc}`;
  } catch (e) {
    results.normalize = `THROW: ${String(e)}`;
  }

  try {
    results.propEscape = /\p{L}/u.test('한') ? 'OK' : 'FALSE (한글이 \\p{L}에 안 잡힘)';
  } catch (e) {
    results.propEscape = `THROW: ${String(e)}`;
  }

  try {
    results.punctEscape = /\p{P}/u.test('.') ? 'OK' : 'FALSE';
  } catch (e) {
    results.punctEscape = `THROW: ${String(e)}`;
  }

  try {
    results.nfkc = '①'.normalize('NFKC') === '1' ? 'OK' : 'MISMATCH';
  } catch (e) {
    results.nfkc = `THROW: ${String(e)}`;
  }

  return results;
}
