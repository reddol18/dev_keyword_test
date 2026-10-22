/**
 * 화면에 붙이는 이모지.
 *
 * 데이터(`data/*.json`)에는 넣지 않는다. JSON 은 생성물이고,
 * `partOfSpeech` 값에 이모지를 섞으면 채점·검색·중복검사까지 번진다.
 * 표시용이므로 화면 쪽에서만 찾아 쓴다.
 */

/** 분야별 이모지. 두 덱(IT 개발 용어 / IT 문서 영단어)의 분야를 모두 담는다. */
const FIELD: Record<string, string> = {
  // IT 개발 용어
  'AI·에이전트': '🤖',
  '개발·DevOps': '⚙️',
  '아키텍처': '🏛️',
  '보안·권한': '🔒',
  '커머스 운영': '🛒',
  '모바일·프론트': '📱',
  'RAG·검색': '🔍',
  'LLM 서빙': '🚀',
  '대화형 AI': '💬',
  '컨택센터': '☎️',
  '제조·스마트팩토리': '🏭',
  '물류 현장': '📦',
  'Vision AI': '👁️',
  '기간계 연동': '🔗',
  'SI·프로젝트': '📋',
  '기초': '🧩',
  // IT 문서 영단어
  '문서 읽기': '📖',
  '에러·로그': '🐛',
  '리뷰·협업': '🤝',
  '릴리스·운영': '🚢',
};

/** 분야 이모지. 모르는 분야는 기본값으로 빠져 화면이 깨지지 않는다. */
export function fieldIcon(field: string): string {
  return FIELD[field] ?? '🏷️';
}

/**
 * 난이도 이모지. 1 기초 / 2 일반 / 3 면접 우선
 *
 * 2단계에 📘(파란 책)을 썼더니 실기기에서 🟦(파란 네모)로 나왔다.
 * 기기 글꼴에 없으면 비슷한 모양으로 대체된다. 📗로 바꾼다.
 */
export function levelIcon(level: number): string {
  return level === 1 ? '🌱' : level === 2 ? '📗' : '🔥';
}

/** 단어장 이모지 */
export function deckIcon(deckId: string): string {
  return deckId === 'it-terms' ? '💻' : '📄';
}

/** 시작 화면 섹션 제목 */
export const SECTION = {
  deck: '📚',
  level: '🎯',
  field: '🏷️',
  mode: '✍️',
  count: '🔢',
} as const;
