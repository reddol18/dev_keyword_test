import { gradeTerm, normalize, normalizeTerm, stem } from './grading';
import type { Word } from './types';

/**
 * 채점 로직 테스트.
 *
 * 여기서 지키려는 것은 두 가지다.
 *  1) `stem()` 의 어미 목록이 "긴 것 먼저" 순서를 잃지 않는 것
 *  2) `gradeTerm()` 이 비슷한 약어(SLA/SLO)를 서로 정답으로 받지 않는 것
 *
 * 둘 다 조용히 깨지는 종류다. 앱은 계속 돌아가고 채점만 틀린다.
 */

/** 테스트용 Word 를 짧게 만든다 */
function word(partial: Partial<Word> & { word: string }): Word {
  return {
    meanings: ['뜻'],
    partOfSpeech: '기초',
    ...partial,
  };
}

describe('normalize', () => {
  it('앞뒤 공백을 떼고 내부 연속 공백을 하나로 줄인다', () => {
    expect(normalize('  load   balancing  ')).toBe('load balancing');
  });

  it('영문을 소문자로 내린다 — 키보드 자동 대문자 입력 대비', () => {
    expect(normalize('Deprecated')).toBe('deprecated');
  });

  it('빈 입력은 빈 문자열로 남는다', () => {
    expect(normalize('   ')).toBe('');
  });
});

describe('stem', () => {
  /**
   * ★ 이 파일의 핵심.
   *
   * `ENDINGS` 는 "긴 어미 먼저" 순서에 의존한다. 알파벳 순이나 추가 순으로
   * 바뀌면 '다'가 '하다'보다 먼저 걸려 "여행하다" → "여행하" 가 된다.
   * 그러면 "여행하다" 와 "여행" 의 어간이 어긋나 복수정답 인정이 깨진다.
   */
  it('긴 어미를 먼저 뗀다 — 여행하다/여행가다/여행이 모두 같은 어간', () => {
    expect(stem('여행하다')).toBe('여행');
    expect(stem('여행가다')).toBe('여행');
    expect(stem('여행')).toBe('여행');
  });

  it('하다/되다/시키다 계열이 "다"보다 먼저 떨어진다', () => {
    // '하'·'되'·'시키' 가 남으면 ENDINGS 순서가 깨진 것이다
    expect(stem('연습하다')).toBe('연습');
    expect(stem('배포되다')).toBe('배포');
    expect(stem('실행시키다')).toBe('실행');
  });

  it('과거형 어미(하였다/되었다)도 어간만 남긴다', () => {
    expect(stem('배포하였다')).toBe('배포');
    expect(stem('완료되었다')).toBe('완료');
  });

  it('형용사 어미(스럽다/롭다/답다)를 뗀다', () => {
    expect(stem('조심스럽다')).toBe('조심');
    expect(stem('자유롭다')).toBe('자유');
  });

  it('활용형끼리 어간이 같다 — 복수정답 인정의 근거', () => {
    expect(stem('기억하는')).toBe(stem('기억하다'));
    expect(stem('기억함')).toBe(stem('기억하다'));
    expect(stem('기억하던')).toBe(stem('기억하다'));
  });

  it('한글이 없으면 손대지 않는다 — 영문 뜻이 깎이면 안 된다', () => {
    expect(stem('Large Language Model')).toBe('large language model');
    expect(stem('is')).toBe('is');
  });

  it('2글자보다 짧게 깎이면 원본을 유지한다', () => {
    // '보다' 를 떼면 '보' 한 글자가 남아 의미가 사라진다
    expect(stem('보다')).toBe('보다');
    expect(stem('하다')).toBe('하다');
  });

  it('어미가 없는 명사는 그대로 둔다', () => {
    expect(stem('로드밸런서')).toBe('로드밸런서');
  });
});

describe('normalizeTerm', () => {
  it('공백·하이픈·슬래시·점·밑줄을 모두 지운다', () => {
    expect(normalizeTerm('Load-Balancer')).toBe('loadbalancer');
    expect(normalizeTerm('load balancer')).toBe('loadbalancer');
    expect(normalizeTerm('LOADBALANCER')).toBe('loadbalancer');
    expect(normalizeTerm('load_balancer')).toBe('loadbalancer');
  });

  it('표기만 다른 약어를 같은 키로 모은다', () => {
    expect(normalizeTerm('S.L.A')).toBe('sla');
    expect(normalizeTerm('SLA')).toBe('sla');
    expect(normalizeTerm('Pub/Sub')).toBe('pubsub');
  });

  it('빈 입력은 빈 문자열', () => {
    expect(normalizeTerm('  - ')).toBe('');
  });
});

describe('gradeTerm', () => {
  const sla = word({
    word: 'SLA',
    meanings: ['서비스 수준 협약', 'Service Level Agreement'],
    aliases: ['SLA', 'Service Level Agreement'],
    confusable: ['SLO', 'SLI'],
  });

  it('aliases 에 든 표기를 정답으로 받는다', () => {
    expect(gradeTerm('SLA', sla)).toBe('correct');
    expect(gradeTerm('Service Level Agreement', sla)).toBe('correct');
  });

  it('표기 차이(대소문자·공백·점)를 무시한다', () => {
    expect(gradeTerm('sla', sla)).toBe('correct');
    expect(gradeTerm('  S.L.A  ', sla)).toBe('correct');
    expect(gradeTerm('service-level-agreement', sla)).toBe('correct');
  });

  /**
   * ★ 비슷한 약어를 구분하는지.
   *
   * 용어 방향은 유사도로 봐주면 안 된다 — 철자가 비슷한 게 곧 다른 용어다.
   * SLO 가 correct 로 올라오면 채점이 무의미해진다.
   */
  it('비슷한 약어는 정답이 아니다 — SLA 에 SLO 를 쓰면 close', () => {
    expect(gradeTerm('SLO', sla)).toBe('close');
    expect(gradeTerm('SLI', sla)).toBe('close');
    expect(gradeTerm('SLO', sla)).not.toBe('correct');
  });

  it('confusable 에도 없는 답은 wrong', () => {
    expect(gradeTerm('JWT', sla)).toBe('wrong');
  });

  it('빈 입력은 wrong', () => {
    expect(gradeTerm('', sla)).toBe('wrong');
    expect(gradeTerm('   ', sla)).toBe('wrong');
  });

  it('aliases 가 없는 덱에서도 용어 자체는 인정한다', () => {
    const bare = word({ word: 'Webhook', meanings: ['웹훅'] });
    expect(gradeTerm('webhook', bare)).toBe('correct');
  });

  it('aliases 가 있어도 word 자체는 항상 인정한다', () => {
    const odd = word({
      word: 'Pub/Sub',
      meanings: ['발행·구독'],
      aliases: ['Publish Subscribe'],
    });
    expect(gradeTerm('Pub/Sub', odd)).toBe('correct');
    expect(gradeTerm('pubsub', odd)).toBe('correct');
  });

  it('뜻을 써도 용어 방향에서는 정답이 아니다', () => {
    // 물어본 게 용어라서 뜻을 그대로 돌려주면 답이 아니다
    expect(gradeTerm('서비스 수준 협약', sla)).toBe('wrong');
  });
});
