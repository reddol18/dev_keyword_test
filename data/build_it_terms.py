"""IT 개발 용어(영어·약어) 덱 생성기.

단어앱 형식(words.json)과 같은 모양으로 it_terms.json 을 만든다.
  word          : 용어·약어 (문제로 나오는 쪽)
  meanings      : [한국어 뜻, 영문 풀네임]  ← 정답으로 인정
  partOfSpeech  : 분야 (앱의 품사 칸을 분야 표시로 재사용)
  near          : 비슷하게 답해도 맞게 쳐 줄 표현
면접 대비 요약본(it_terms_review.md)도 함께 만든다. ★ = 위시켓 IRE 면접 우선.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))

# (분야, 용어, 영문 풀네임, 한국어 뜻, near, ★)
T = [
    # ── 1. AI·LLM·에이전트 ────────────────────────────────────────────
    ("AI·에이전트", "LLM", "Large Language Model", "대규모 언어 모델", ["거대언어모델", "언어모델"], 1),
    ("AI·에이전트", "Agent", "AI Agent", "목표를 받아 도구를 쓰며 스스로 여러 단계를 수행하는 AI", ["에이전트", "자율 AI"], 1),
    ("AI·에이전트", "Agentic workflow", "Agentic Workflow", "에이전트가 계획·실행·검토를 반복하는 작업 흐름", ["에이전트형 워크플로"], 1),
    ("AI·에이전트", "System prompt", "System Prompt", "모델의 역할·규칙·권한을 정해 두는 최상위 지시문", ["시스템 프롬프트", "시스템 지시"], 1),
    ("AI·에이전트", "Tool calling", "Tool / Function Calling", "모델이 외부 함수·API를 호출하는 기능", ["함수 호출", "펑션 콜링", "도구 호출"], 1),
    ("AI·에이전트", "MCP", "Model Context Protocol", "AI가 외부 도구·데이터에 붙는 표준 연결 규약", ["모델 컨텍스트 프로토콜"], 1),
    ("AI·에이전트", "RAG", "Retrieval-Augmented Generation", "검색한 자료를 근거로 답을 생성하는 방식", ["검색 증강 생성"], 1),
    ("AI·에이전트", "HITL", "Human-in-the-Loop", "중요 단계에 사람의 확인·승인을 끼워 넣는 구조", ["휴먼 인 더 루프", "사람 개입"], 1),
    ("AI·에이전트", "Guardrail", "Guardrail", "모델이 넘지 말아야 할 행동을 막는 안전장치", ["가드레일", "안전장치"], 1),
    ("AI·에이전트", "Hallucination", "Hallucination", "사실이 아닌 내용을 그럴듯하게 지어내는 현상", ["환각", "할루시네이션"], 1),
    ("AI·에이전트", "Grounding", "Grounding", "답을 실제 자료·데이터에 근거하게 만드는 것", ["그라운딩", "근거 기반"], 1),
    ("AI·에이전트", "Escalation", "Escalation", "에이전트가 판단 범위를 넘으면 사람에게 넘기는 것", ["에스컬레이션", "상위 이관"], 1),
    ("AI·에이전트", "Reversibility", "Reversibility", "행동이 틀렸을 때 되돌릴 수 있는 정도(자율 허용 기준)", ["가역성", "되돌림 가능성"], 1),
    ("AI·에이전트", "Confidence", "Confidence Score", "모델이 자기 판단을 얼마나 확신하는지의 값", ["확신도", "신뢰도"], 1),
    ("AI·에이전트", "Orchestration", "Agent Orchestration", "여러 에이전트·도구의 순서와 역할을 조율하는 것", ["오케스트레이션", "조율"], 1),
    ("AI·에이전트", "Multi-agent", "Multi-Agent System", "역할이 다른 에이전트 여럿이 협업하는 구조", ["멀티 에이전트", "다중 에이전트"], 1),
    ("AI·에이전트", "Subagent", "Subagent", "메인 에이전트가 일을 떼어 맡기는 하위 에이전트", ["서브에이전트", "하위 에이전트"], 0),
    ("AI·에이전트", "Context window", "Context Window", "모델이 한 번에 읽을 수 있는 토큰 한도", ["컨텍스트 윈도", "문맥 길이"], 1),
    ("AI·에이전트", "Token", "Token", "모델이 글을 쪼개 처리하는 단위(과금 단위)", ["토큰"], 0),
    ("AI·에이전트", "Embedding", "Embedding", "글의 의미를 숫자 벡터로 바꾼 것", ["임베딩", "벡터화"], 0),
    ("AI·에이전트", "Vector DB", "Vector Database", "임베딩을 저장해 의미로 검색하는 DB", ["벡터 데이터베이스", "벡터 DB"], 0),
    ("AI·에이전트", "Fine-tuning", "Fine-tuning", "기존 모델을 특정 데이터로 추가 학습시키는 것", ["파인튜닝", "미세조정"], 0),
    ("AI·에이전트", "RLHF", "Reinforcement Learning from Human Feedback", "사람 피드백으로 모델을 강화학습시키는 방법", ["인간 피드백 강화학습"], 0),
    ("AI·에이전트", "CoT", "Chain-of-Thought", "단계별로 생각을 풀어 답하게 하는 기법", ["사고의 사슬", "단계적 추론"], 0),
    ("AI·에이전트", "ReAct", "Reason + Act", "생각과 행동(도구 사용)을 번갈아 하는 에이전트 패턴", ["리액트 패턴"], 0),
    ("AI·에이전트", "Few-shot", "Few-shot Prompting", "예시 몇 개를 프롬프트에 넣어 따라 하게 하는 것", ["퓨샷", "예시 학습"], 0),
    ("AI·에이전트", "Eval", "Evaluation", "모델·에이전트 품질을 정해진 시험셋으로 재는 것", ["평가", "이밸"], 1),
    ("AI·에이전트", "Prompt injection", "Prompt Injection", "외부 입력에 숨긴 지시로 모델을 조종하는 공격", ["프롬프트 인젝션", "프롬프트 주입"], 1),
    ("AI·에이전트", "Red teaming", "Red Teaming", "일부러 공격해 약점을 찾는 검증", ["레드팀", "레드티밍"], 0),
    ("AI·에이전트", "Temperature", "Temperature", "답의 무작위성(창의성)을 정하는 값", ["온도", "템퍼러처"], 0),
    ("AI·에이전트", "Inference", "Inference", "학습된 모델로 실제 답을 내는 과정", ["추론", "인퍼런스"], 0),
    ("AI·에이전트", "SLM", "Small Language Model", "작고 가벼운 언어 모델(기업 내부 구축·기기 내 실행용)", ["소형 언어 모델", "sLLM", "경량 LLM"], 1),
    ("AI·에이전트", "On-device AI", "On-device AI", "서버 없이 기기 안에서 도는 AI", ["온디바이스", "기기 내 AI"], 0),
    ("AI·에이전트", "Multimodal", "Multimodal", "글·이미지·음성 등 여러 형식을 함께 다루는 것", ["멀티모달", "다중 모달"], 0),
    ("AI·에이전트", "AX", "AI Transformation", "AI로 업무·조직을 바꾸는 것", ["AI 전환", "AI 트랜스포메이션"], 1),
    ("AI·에이전트", "Sovereign AI", "Sovereign AI", "자국 기술·데이터로 통제하는 AI", ["소버린 AI", "주권 AI"], 0),

    # ── 2. AI 기반 개발·DevOps (면접 약점 보완) ─────────────────────────
    ("개발·DevOps", "CI/CD", "Continuous Integration / Continuous Delivery", "코드 통합·테스트·배포를 자동으로 이어 가는 체계", ["지속적 통합 배포"], 1),
    ("개발·DevOps", "DevOps", "Development + Operations", "개발과 운영을 한 흐름으로 자동화하는 문화·방식", ["데브옵스"], 1),
    ("개발·DevOps", "LLMOps", "LLM Operations", "LLM 기반 서비스의 배포·평가·모니터링 운영", ["엘엘엠옵스"], 1),
    ("개발·DevOps", "MLOps", "Machine Learning Operations", "ML 모델의 학습·배포·운영 자동화", ["엠엘옵스"], 0),
    ("개발·DevOps", "Spec-driven development", "Spec-driven Development", "명세를 먼저 쓰고 그 명세로 AI·코드를 구현하는 방식", ["명세 주도 개발", "스펙 드리븐"], 1),
    ("개발·DevOps", "Vibe coding", "Vibe Coding", "자연어로 AI에게 지시하며 코드를 만드는 방식", ["바이브 코딩"], 0),
    ("개발·DevOps", "Hook", "Hook", "특정 이벤트 때 자동 실행되게 걸어 두는 스크립트", ["훅", "후크"], 1),
    ("개발·DevOps", "PR", "Pull Request", "변경 코드를 합치기 전 검토를 요청하는 것", ["풀 리퀘스트", "병합 요청"], 1),
    ("개발·DevOps", "Code review", "Code Review", "다른 사람이 코드를 검토하는 과정", ["코드 리뷰"], 0),
    ("개발·DevOps", "TDD", "Test-Driven Development", "테스트를 먼저 쓰고 코드를 맞추는 개발 방식", ["테스트 주도 개발"], 0),
    ("개발·DevOps", "Regression test", "Regression Test", "고친 뒤 기존 기능이 안 깨졌는지 보는 테스트", ["회귀 테스트"], 1),
    ("개발·DevOps", "E2E test", "End-to-End Test", "사용자 흐름 처음부터 끝까지 검증하는 테스트", ["종단간 테스트", "이투이"], 0),
    ("개발·DevOps", "Smoke test", "Smoke Test", "핵심 기능만 빠르게 켜 보는 최소 테스트", ["스모크 테스트"], 0),
    ("개발·DevOps", "Rollback", "Rollback", "문제 생긴 배포를 이전 상태로 되돌리는 것", ["롤백", "되돌리기"], 1),
    ("개발·DevOps", "Canary release", "Canary Release", "일부 사용자에게만 먼저 배포해 보는 방식", ["카나리 배포"], 0),
    ("개발·DevOps", "Blue-green", "Blue-Green Deployment", "두 환경을 두고 한 번에 전환하는 배포", ["블루그린 배포"], 0),
    ("개발·DevOps", "Feature flag", "Feature Flag", "코드 배포 없이 기능을 켜고 끄는 스위치", ["기능 플래그", "피처 토글"], 0),
    ("개발·DevOps", "IaC", "Infrastructure as Code", "인프라 구성을 코드로 관리하는 것", ["코드형 인프라"], 0),
    ("개발·DevOps", "Observability", "Observability", "로그·지표·추적으로 시스템 내부 상태를 보는 능력", ["관측성", "옵저버빌리티"], 1),
    ("개발·DevOps", "SLA", "Service Level Agreement", "서비스 수준 약정(지키기로 한 응답·가용 수준)", ["서비스 수준 협약"], 1),
    ("개발·DevOps", "SLO", "Service Level Objective", "내부적으로 정한 서비스 수준 목표치", ["서비스 수준 목표"], 1),
    ("개발·DevOps", "SLI", "Service Level Indicator", "서비스 수준을 재는 실제 지표(응답시간 등)", ["서비스 수준 지표"], 0),
    ("개발·DevOps", "MTTR", "Mean Time To Recovery", "장애부터 복구까지 평균 시간", ["평균 복구 시간"], 1),
    ("개발·DevOps", "Incident", "Incident", "서비스에 영향을 준 장애·사고", ["인시던트", "장애"], 0),
    ("개발·DevOps", "Postmortem", "Postmortem", "장애 후 원인·재발방지를 정리하는 회고", ["포스트모템", "사후 분석"], 1),
    ("개발·DevOps", "Runbook", "Runbook", "상황별 대응 절차를 적어 둔 운영 매뉴얼", ["런북", "운영 절차서"], 1),
    ("개발·DevOps", "Idempotency", "Idempotency", "같은 요청을 여러 번 해도 결과가 한 번과 같은 성질", ["멱등성"], 1),
    ("개발·DevOps", "Retry / Backoff", "Retry with Exponential Backoff", "실패 시 간격을 늘려 가며 다시 시도하는 것", ["재시도", "지수 백오프"], 1),
    ("개발·DevOps", "Rate limit", "Rate Limiting", "일정 시간당 요청 수를 제한하는 것", ["속도 제한", "호출 제한"], 0),
    ("개발·DevOps", "Circuit breaker", "Circuit Breaker", "실패가 이어지면 호출을 잠시 끊어 전체 장애를 막는 패턴", ["서킷 브레이커"], 0),
    ("개발·DevOps", "Cron", "Cron", "정해진 시각에 작업을 자동 실행하는 스케줄러", ["크론", "예약 실행"], 0),
    ("개발·DevOps", "Daemon", "Daemon", "뒤에서 계속 돌며 일하는 프로그램", ["데몬", "백그라운드 프로세스"], 0),

    # ── 3. 아키텍처·백엔드 ─────────────────────────────────────────────
    ("아키텍처", "API", "Application Programming Interface", "프로그램끼리 기능을 주고받는 약속된 창구", ["응용 프로그래밍 인터페이스"], 1),
    ("아키텍처", "REST", "Representational State Transfer", "HTTP 자원 중심으로 API를 설계하는 방식", ["레스트", "RESTful"], 0),
    ("아키텍처", "Webhook", "Webhook", "일이 생기면 상대 서버로 알려 주는 역방향 호출", ["웹훅"], 1),
    ("아키텍처", "Batch", "Batch Processing", "모아 두었다 한꺼번에 처리하는 방식", ["배치", "일괄 처리"], 1),
    ("아키텍처", "Queue", "Message Queue", "작업을 줄 세워 두고 순서대로 처리하게 하는 장치", ["메시지 큐", "대기열"], 1),
    ("아키텍처", "Event-driven", "Event-driven Architecture", "사건(이벤트) 발생에 반응해 동작하는 구조", ["이벤트 기반"], 0),
    ("아키텍처", "Pub/Sub", "Publish / Subscribe", "발행자가 보내면 구독자들이 받는 메시지 방식", ["발행 구독"], 0),
    ("아키텍처", "MSA", "Microservice Architecture", "기능을 작은 서비스 여럿으로 나눈 구조", ["마이크로서비스"], 0),
    ("아키텍처", "Monolith", "Monolithic Architecture", "하나로 뭉친 단일 애플리케이션 구조", ["모놀리식", "단일 구조"], 0),
    ("아키텍처", "Cache", "Cache", "자주 쓰는 데이터를 가까이 임시 저장하는 것", ["캐시"], 0),
    ("아키텍처", "CDN", "Content Delivery Network", "콘텐츠를 가까운 서버에서 내려주는 전송망", ["콘텐츠 전송 네트워크"], 0),
    ("아키텍처", "Load balancer", "Load Balancer", "요청을 여러 서버에 나눠 주는 장치", ["로드밸런서", "부하 분산"], 0),
    ("아키텍처", "Transaction", "Transaction", "전부 성공하거나 전부 취소되는 작업 묶음", ["트랜잭션"], 1),
    ("아키텍처", "ACID", "Atomicity, Consistency, Isolation, Durability", "트랜잭션이 지켜야 할 네 가지 성질", ["원자성 일관성 고립성 지속성"], 0),
    ("아키텍처", "Eventual consistency", "Eventual Consistency", "시간이 지나면 결국 데이터가 맞춰지는 일관성", ["최종적 일관성"], 0),
    ("아키텍처", "ETL", "Extract, Transform, Load", "데이터를 뽑아 바꿔서 적재하는 과정", ["추출 변환 적재"], 0),
    ("아키텍처", "NFR", "Non-Functional Requirement", "성능·보안·가용성처럼 기능 외 요구사항", ["비기능 요구사항"], 1),
    ("아키텍처", "FR", "Functional Requirement", "시스템이 해야 할 기능 요구사항", ["기능 요구사항"], 1),
    ("아키텍처", "BR", "Business Rule", "업무상 반드시 지켜야 할 규칙", ["비즈니스 규칙", "업무 규칙"], 1),

    # ── 4. 보안·권한 ───────────────────────────────────────────────────
    ("보안·권한", "RBAC", "Role-Based Access Control", "역할에 따라 권한을 주는 접근 제어", ["역할 기반 접근 제어"], 1),
    ("보안·권한", "ABAC", "Attribute-Based Access Control", "속성(부서·시간 등) 조건으로 권한을 주는 방식", ["속성 기반 접근 제어"], 0),
    ("보안·권한", "Least privilege", "Principle of Least Privilege", "필요한 최소한의 권한만 주는 원칙", ["최소 권한 원칙"], 1),
    ("보안·권한", "AuthN", "Authentication", "누구인지 확인하는 것(로그인)", ["인증"], 1),
    ("보안·권한", "AuthZ", "Authorization", "무엇을 할 수 있는지 허락하는 것", ["인가", "권한 부여"], 1),
    ("보안·권한", "SoD", "Separation of Duties", "한 사람이 요청과 승인을 함께 못 하게 나누는 것", ["직무 분리"], 1),
    ("보안·권한", "Audit log", "Audit Log", "누가 언제 무엇을 했는지 남기는 기록", ["감사 로그"], 1),
    ("보안·권한", "Approval gate", "Approval Gate", "실행 전 사람 승인을 받아야 넘어가는 관문", ["승인 게이트"], 1),
    ("보안·권한", "OAuth", "Open Authorization", "비밀번호 없이 다른 서비스 권한을 위임받는 표준", ["오어스"], 0),
    ("보안·권한", "SSO", "Single Sign-On", "한 번 로그인으로 여러 서비스를 쓰는 것", ["통합 로그인", "싱글 사인온"], 0),
    ("보안·권한", "JWT", "JSON Web Token", "서명된 인증 정보를 담은 토큰", ["제이더블유티"], 0),
    ("보안·권한", "MFA", "Multi-Factor Authentication", "두 가지 이상 수단으로 확인하는 인증", ["다중 인증", "2단계 인증"], 0),
    ("보안·권한", "PII", "Personally Identifiable Information", "개인을 알아볼 수 있는 정보", ["개인식별정보", "개인정보"], 1),
    ("보안·권한", "Zero trust", "Zero Trust", "내부라도 믿지 않고 매번 검증하는 보안 모델", ["제로 트러스트"], 0),
    ("보안·권한", "Air gap", "Air-gapped Network", "외부망과 물리적으로 끊은 폐쇄망", ["폐쇄망", "망분리", "에어갭"], 0),

    # ── 5. 커머스·운영 도메인 (과제 도메인) ────────────────────────────
    ("커머스 운영", "SKU", "Stock Keeping Unit", "재고 관리 최소 단위(상품·옵션별 코드)", ["재고 관리 단위", "품목 코드"], 1),
    ("커머스 운영", "ERP", "Enterprise Resource Planning", "재무·재고·구매 등을 통합 관리하는 전사 시스템", ["전사적 자원 관리"], 1),
    ("커머스 운영", "OMS", "Order Management System", "주문 접수부터 처리까지 관리하는 시스템", ["주문 관리 시스템"], 1),
    ("커머스 운영", "WMS", "Warehouse Management System", "창고 입출고·재고 위치를 관리하는 시스템", ["창고 관리 시스템"], 0),
    ("커머스 운영", "CS", "Customer Service", "고객 문의·클레임 응대", ["고객 서비스", "고객 응대"], 1),
    ("커머스 운영", "PO", "Purchase Order", "공급처에 내는 발주서", ["발주서", "구매 주문"], 1),
    ("커머스 운영", "B2C", "Business to Consumer", "기업이 소비자에게 파는 거래", ["기업 소비자 간"], 0),
    ("커머스 운영", "B2B", "Business to Business", "기업끼리의 거래", ["기업 간"], 0),
    ("커머스 운영", "Safety stock", "Safety Stock", "품절을 막으려 늘 남겨 두는 재고", ["안전 재고", "안전선"], 1),
    ("커머스 운영", "Backorder", "Backorder", "재고가 없어 나중에 보내기로 한 주문", ["이월 주문", "백오더"], 0),
    ("커머스 운영", "Fulfillment", "Fulfillment", "주문 후 포장·출고·배송까지의 처리", ["풀필먼트", "주문 이행"], 0),
    ("커머스 운영", "3PL", "Third-Party Logistics", "물류를 외부 전문업체에 맡기는 것", ["삼자 물류"], 0),
    ("커머스 운영", "RMA", "Return Merchandise Authorization", "반품 승인 절차·번호", ["반품 승인"], 0),
    ("커머스 운영", "Chargeback", "Chargeback", "카드사를 통한 결제 취소·환불 요구", ["차지백", "지불 거절"], 0),
    ("커머스 운영", "KPI", "Key Performance Indicator", "핵심 성과 지표", ["핵심 성과 지표"], 1),
    ("커머스 운영", "ROI", "Return on Investment", "투자 대비 수익률", ["투자 수익률"], 1),
    ("커머스 운영", "CSAT", "Customer Satisfaction Score", "고객 만족도 점수", ["고객 만족도"], 0),

    # ── 6. 모바일·프론트엔드 (단어앱 경험) ─────────────────────────────
    ("모바일·프론트", "React Native", "React Native", "React로 iOS·안드로이드 앱을 함께 만드는 프레임워크", ["리액트 네이티브", "RN"], 1),
    ("모바일·프론트", "Expo", "Expo", "React Native 앱 개발·빌드를 쉽게 해 주는 도구", ["엑스포"], 0),
    ("모바일·프론트", "SPA", "Single Page Application", "한 페이지에서 화면만 바꿔 가는 웹앱", ["단일 페이지 애플리케이션"], 0),
    ("모바일·프론트", "SSR", "Server-Side Rendering", "서버에서 화면을 그려 보내는 방식", ["서버 사이드 렌더링"], 0),
    ("모바일·프론트", "CSR", "Client-Side Rendering", "브라우저에서 화면을 그리는 방식", ["클라이언트 사이드 렌더링"], 0),
    ("모바일·프론트", "PWA", "Progressive Web App", "앱처럼 설치해 쓰는 웹앱", ["프로그레시브 웹 앱"], 0),
    ("모바일·프론트", "Deep link", "Deep Link", "앱의 특정 화면으로 바로 여는 링크", ["딥링크"], 0),
    ("모바일·프론트", "KeyboardAvoidingView", "KeyboardAvoidingView", "키보드가 올라올 때 입력창이 가려지지 않게 밀어 올리는 RN 컴포넌트", ["키보드 회피", "키보드 밀림 처리"], 0),
    ("모바일·프론트", "Responsive", "Responsive Design", "화면 크기에 맞춰 배치가 바뀌는 설계", ["반응형"], 0),
]

# ── AICC·RAG 보강 (이아이씨엔 10/14 면접 대비) ──────────────────────────────
# 회사 공개 구조: KMS·문서 임베딩 → 벡터DB → 벡터+키워드 다중 검색 → 재랭킹 → sLLM(Gemma 2B/9B)
# 제품: IPCC / 상담어시스트+KMS / STT / 콜봇·챗봇 / TA / 보이는 ARS
EICN = [
    # [RAG·검색] 회사가 "다중 검색 + 재랭킹"을 전면에 내세움 → 이 묶음이 면접 핵심
    ("RAG·검색", "Hybrid search", "Hybrid Search", "키워드 검색과 벡터 검색을 함께 써 결과를 합치는 방식", ["하이브리드 검색", "다중 검색"], 1),
    ("RAG·검색", "BM25", "Best Matching 25", "단어 빈도·희소성으로 문서 점수를 매기는 키워드 검색 알고리즘", ["비엠25", "키워드 검색 점수"], 1),
    ("RAG·검색", "Reranker", "Reranker (Cross-encoder)", "1차로 뽑은 후보를 질문과 다시 견줘 순위를 매기는 2차 모델", ["재랭킹", "리랭커", "재순위화"], 1),
    ("RAG·검색", "Chunking", "Chunking", "긴 문서를 검색·임베딩 단위로 잘게 나누는 것", ["청킹", "문서 분할"], 1),
    ("RAG·검색", "Top-k", "Top-k Retrieval", "검색 결과 중 상위 k개만 추려 모델에 넘기는 것", ["상위 k개", "탑케이"], 0),
    ("RAG·검색", "Faithfulness", "Faithfulness", "생성한 답이 근거 문서에 얼마나 충실한지의 척도", ["충실도", "근거 일치도"], 0),
    ("RAG·검색", "Golden set", "Golden Set", "정답을 미리 정해 둔 평가용 질문 묶음", ["골든셋", "정답셋", "평가셋"], 0),
    ("RAG·검색", "RAGAS", "RAG Assessment", "RAG 품질을 자동 지표로 재는 평가 프레임워크", ["라가스", "RAG 평가"], 0),
    ("RAG·검색", "pgvector", "pgvector", "PostgreSQL에 벡터 검색을 더해 주는 확장", ["피지벡터"], 0),
    ("RAG·검색", "Elasticsearch", "Elasticsearch", "역색인 기반의 대표적인 검색·분석 엔진", ["엘라스틱서치", "ES"], 0),
    ("RAG·검색", "Apache Solr", "Apache Solr", "Lucene 기반의 오픈소스 검색 플랫폼", ["솔라", "솔라 검색엔진"], 0),
    ("RAG·검색", "Milvus", "Milvus", "대규모 벡터 검색에 쓰는 오픈소스 벡터 DB", ["밀버스"], 0),
    ("RAG·검색", "Qdrant", "Qdrant", "필터링에 강한 오픈소스 벡터 DB", ["큐드란트"], 0),

    # [LLM 서빙·튜닝] Gemma 2B/9B 자체 구축 → 경량화·파인튜닝·응답속도가 면접 질문거리
    ("LLM 서빙", "Quantization", "Quantization", "가중치 정밀도를 낮춰(4·8비트) 모델을 가볍고 빠르게 만드는 것", ["양자화", "경량화"], 1),
    ("LLM 서빙", "LoRA", "Low-Rank Adaptation", "전체가 아닌 작은 행렬만 학습하는 경량 파인튜닝 기법", ["로라", "경량 파인튜닝"], 1),
    ("LLM 서빙", "Streaming", "Token Streaming", "생성되는 토큰을 기다리지 않고 바로바로 내보내는 것", ["스트리밍", "실시간 출력"], 1),
    ("LLM 서빙", "TTFT", "Time To First Token", "요청부터 첫 토큰이 나올 때까지 걸리는 시간", ["첫 토큰 지연", "티티에프티"], 0),
    ("LLM 서빙", "vLLM", "vLLM", "묶음 처리·메모리 최적화로 LLM을 빠르게 서빙하는 엔진", ["브이엘엘엠"], 0),
    ("LLM 서빙", "Open-weight model", "Open-weight Model", "가중치를 공개해 내려받아 쓸 수 있는 모델", ["오픈웨이트", "가중치 공개 모델"], 0),
    ("LLM 서빙", "Gemma", "Gemma", "구글이 공개한 경량 오픈웨이트 모델(Gemini 계열)", ["젬마"], 0),

    # [대화형 AI] 챗봇·콜봇 시나리오 설계가 포지션 업무
    ("대화형 AI", "Intent classification", "Intent Classification", "사용자 발화가 어떤 용건인지 분류하는 것", ["의도 분류", "인텐트 분류"], 1),
    ("대화형 AI", "Slot filling", "Slot Filling", "예약처럼 필요한 항목을 대화로 하나씩 채워 가는 방식", ["슬롯 필링", "항목 채우기"], 1),
    ("대화형 AI", "NER", "Named Entity Recognition", "문장에서 이름·날짜·금액 같은 개체를 뽑아내는 것", ["개체명 인식", "엔티티 추출"], 0),
    ("대화형 AI", "NLU", "Natural Language Understanding", "말의 의도와 내용을 이해하는 단계", ["자연어 이해"], 0),
    ("대화형 AI", "NLP", "Natural Language Processing", "사람 말을 컴퓨터가 다루는 기술 전반", ["자연어 처리"], 0),
    ("대화형 AI", "Rule-based", "Rule-based System", "미리 정한 규칙대로 동작하게 만드는 방식", ["룰베이스", "규칙 기반"], 0),
    ("대화형 AI", "Chatbot", "Chatbot", "글로 대화하며 응대하는 봇", ["챗봇"], 0),
    ("대화형 AI", "Callbot", "Callbot", "전화 통화로 음성 응대하는 봇", ["콜봇", "음성봇"], 0),

    # [컨택센터] 회사 제품군 그대로 — 모르면 대화가 안 되는 도메인 용어
    ("컨택센터", "AICC", "AI Contact Center", "AI를 접목해 상담을 자동화·보조하는 컨택센터", ["에이아이씨씨", "AI 컨택센터"], 1),
    ("컨택센터", "IPCC", "IP Contact Center", "인터넷전화(VoIP) 기반으로 구축한 콜센터 시스템", ["아이피씨씨"], 1),
    ("컨택센터", "STT", "Speech-to-Text", "음성을 글자로 받아 적는 음성인식", ["음성인식", "에스티티"], 1),
    ("컨택센터", "KMS", "Knowledge Management System", "상담에 쓸 지식·문서를 모아 관리·검색하는 시스템", ["지식관리시스템", "케이엠에스"], 1),
    ("컨택센터", "Agent assist", "Agent Assist", "통화 중 상담원에게 답변·지식을 실시간 추천하는 기능", ["상담어시스트", "상담원 보조"], 1),
    ("컨택센터", "TTS", "Text-to-Speech", "글자를 사람 목소리로 읽어 주는 음성합성", ["음성합성", "티티에스"], 0),
    ("컨택센터", "TA", "Text Analytics", "상담 녹취를 텍스트로 바꿔 유형·불만을 분석하는 것", ["텍스트 분석", "녹취 분석"], 0),
    ("컨택센터", "VOC", "Voice of Customer", "고객이 남긴 의견·불만을 모아 개선에 쓰는 것", ["고객의 소리", "브이오씨"], 0),
    ("컨택센터", "IVR", "Interactive Voice Response", "전화에서 안내 음성으로 메뉴를 고르게 하는 자동응답", ["자동응답", "아이브이알", "보이는 ARS"], 0),
    ("컨택센터", "CRM", "Customer Relationship Management", "고객 정보·이력을 모아 관계를 관리하는 시스템", ["고객관계관리", "씨알엠"], 0),
    ("컨택센터", "CX", "Customer Experience", "고객이 겪는 경험 전체의 질", ["고객 경험", "씨엑스"], 0),
]

# ── 제조·물류·Vision AI 보강 (TCCINS 10/20 면접 대비) ───────────────────────
# 회사 영역: 제조·물류 현장의 AI CCTV(Vision), SAP/MES 기간계 연동, SI·SM
# 주의: 여섯째 값은 레벨이 아니라 '면접 우선' 플래그다(1이면 level 3, 0이면 level 2).
TCCINS = [
    # [제조·스마트팩토리] 공장 도메인 — 모르면 요구사항 회의가 안 된다
    ("제조·스마트팩토리", "MES", "Manufacturing Execution System", "공장 현장의 생산 지시·실적·품질을 관리하는 제조실행시스템", ["제조실행시스템", "생산관리시스템"], 1),
    ("제조·스마트팩토리", "SAP", "SAP ERP", "대기업 기간계에서 사실상 표준인 독일 ERP 제품군", ["SAP ERP", "S/4HANA"], 1),
    ("제조·스마트팩토리", "SCM", "Supply Chain Management", "원자재 조달부터 생산·배송까지 공급망 전체를 관리", ["공급망 관리"], 0),
    ("제조·스마트팩토리", "PLC", "Programmable Logic Controller", "설비를 제어하는 산업용 컴퓨터", ["설비 제어기", "시퀀서"], 0),
    ("제조·스마트팩토리", "SCADA", "Supervisory Control and Data Acquisition", "여러 설비 데이터를 모아 원격으로 감시·제어하는 시스템", ["원격 감시 제어"], 0),
    ("제조·스마트팩토리", "HMI", "Human Machine Interface", "작업자가 설비를 보고 조작하는 화면", ["설비 조작 화면", "사람-기계 인터페이스"], 0),
    ("제조·스마트팩토리", "OPC UA", "OPC Unified Architecture", "제조사가 달라도 설비 데이터를 주고받게 하는 산업 표준 통신 규격", ["산업 통신 표준"], 0),
    ("제조·스마트팩토리", "Modbus", "Modbus", "오래되고 단순해 지금도 널리 쓰는 산업용 통신 프로토콜", ["산업용 프로토콜"], 0),
    ("제조·스마트팩토리", "IIoT", "Industrial Internet of Things", "공장 설비·센서를 네트워크에 연결해 데이터를 모으는 산업용 사물인터넷", ["산업용 IoT"], 0),
    ("제조·스마트팩토리", "Digital twin", "Digital Twin", "현실의 설비·공정을 가상 공간에 똑같이 복제한 모델", ["디지털 트윈", "가상 복제"], 0),
    ("제조·스마트팩토리", "OEE", "Overall Equipment Effectiveness", "가동률×성능×품질로 계산하는 설비종합효율", ["설비종합효율"], 0),
    ("제조·스마트팩토리", "BOM", "Bill of Materials", "제품 하나를 만드는 데 필요한 부품·자재 목록", ["자재명세서"], 0),
    ("제조·스마트팩토리", "Lot", "Lot", "같은 조건으로 생산·입고된 묶음 단위. 추적·리콜의 기준", ["로트", "배치 번호"], 0),

    # [물류 현장] 창고에서 실제로 쓰는 말 — WMS(기존)와 같이 묶인다
    ("물류 현장", "Putaway", "Putaway", "입고된 물건을 정해진 보관 위치에 놓는 적치 작업", ["적치"], 0),
    ("물류 현장", "Picking", "Picking", "출고할 물건을 보관 위치에서 꺼내는 작업", ["피킹", "집품"], 0),
    ("물류 현장", "Cycle count", "Cycle Count", "창고 전체를 멈추지 않고 구역별로 돌아가며 하는 순환 재고조사", ["순환 재고조사", "재고 실사"], 1),
    ("물류 현장", "ASN", "Advanced Shipping Notice", "물건이 도착하기 전에 보내는 사전 출하 통지", ["사전 출하 통지"], 0),
    ("물류 현장", "RFID", "Radio Frequency Identification", "무선 태그로 물건을 접촉 없이 인식하는 기술", ["무선 태그", "전자 태그"], 0),
    ("물류 현장", "PDA", "Personal Digital Assistant", "현장 작업자가 바코드를 찍고 입력하는 휴대 단말", ["핸디 터미널", "바코드 스캐너"], 0),
    ("물류 현장", "Location", "Storage Location", "창고 안 보관 위치 주소(구역-랙-단-칸)", ["로케이션", "보관 위치"], 0),

    # [Vision AI] AI CCTV 가 회사 주력 — 이 분야가 면접의 중심이다
    ("Vision AI", "Object detection", "Object Detection", "이미지에서 물체의 위치와 종류를 찾는 작업", ["객체 탐지", "물체 인식"], 1),
    ("Vision AI", "Bounding box", "Bounding Box", "탐지된 물체를 둘러싼 사각형 좌표", ["경계 상자", "바운딩 박스"], 0),
    ("Vision AI", "MOT", "Multi-Object Tracking", "영상에서 여러 물체를 프레임마다 이어서 추적", ["다중 객체 추적", "트래킹"], 1),
    ("Vision AI", "Re-ID", "Re-Identification", "카메라가 바뀌어도 같은 사람·물체임을 다시 알아보는 기술", ["재식별"], 1),
    ("Vision AI", "OCR", "Optical Character Recognition", "이미지 속 글자를 텍스트로 읽어내는 기술", ["광학 문자 인식", "문자 인식"], 0),
    ("Vision AI", "IoU", "Intersection over Union", "예측 박스와 정답 박스가 겹치는 비율", ["겹침 비율"], 0),
    ("Vision AI", "mAP", "mean Average Precision", "객체 탐지 정확도를 나타내는 대표 지표", ["평균 정밀도"], 0),
    ("Vision AI", "Annotation", "Annotation", "학습용 데이터에 정답을 표시하는 작업", ["라벨링", "어노테이션"], 0),
    ("Vision AI", "Edge inference", "Edge Inference", "클라우드로 보내지 않고 현장 장비에서 바로 추론", ["엣지 추론", "엣지 AI"], 1),
    ("Vision AI", "RTSP", "Real Time Streaming Protocol", "CCTV 영상을 실시간으로 받아오는 표준 프로토콜", ["영상 스트리밍 프로토콜"], 0),
    ("Vision AI", "NVR", "Network Video Recorder", "IP 카메라 영상을 저장하는 네트워크 녹화기", ["영상 녹화기"], 0),
    ("Vision AI", "Data drift", "Data Drift", "현장 환경이 바뀌어 입력 데이터가 달라지고 모델 정확도가 떨어지는 현상", ["데이터 드리프트", "분포 변화"], 1),

    # [기간계 연동] SAP 붙이는 일이 업무의 큰 축
    ("기간계 연동", "EAI", "Enterprise Application Integration", "기업 내 여러 시스템을 하나로 연결하는 통합 방식", ["시스템 통합"], 0),
    ("기간계 연동", "ESB", "Enterprise Service Bus", "시스템 사이 메시지를 중계하는 공용 버스", ["서비스 버스"], 0),
    ("기간계 연동", "RFC / BAPI", "Remote Function Call / Business API", "외부에서 SAP 기능을 호출하는 함수 인터페이스", ["SAP 함수 호출"], 1),
    ("기간계 연동", "IDoc", "Intermediate Document", "SAP가 다른 시스템과 주고받는 표준 전자문서 형식", ["SAP 전자문서"], 0),
    ("기간계 연동", "OData", "Open Data Protocol", "REST 방식으로 데이터를 조회·수정하는 표준. SAP가 많이 씀", ["오데이터"], 0),
    ("기간계 연동", "Gateway", "Gateway", "외부와 내부 시스템 사이의 출입구. 인증·변환·중계를 맡음", ["게이트웨이", "API Gateway"], 0),
    ("기간계 연동", "Groupware", "Groupware", "메일·전자결재·게시판 같은 사내 협업 시스템", ["그룹웨어", "전자결재"], 0),
    ("기간계 연동", "EP", "Enterprise Portal", "여러 사내 시스템을 한 화면에서 쓰게 묶은 기업 포털", ["기업 포털"], 0),

    # [SI·프로젝트] 계약·범위 말이 안 통하면 일이 안 된다
    ("SI·프로젝트", "SI", "System Integration", "고객 요구에 맞춰 시스템을 새로 구축하는 사업", ["시스템 구축"], 1),
    ("SI·프로젝트", "SM", "System Management", "구축된 시스템을 운영·유지보수하는 사업", ["운영 유지보수"], 1),
    ("SI·프로젝트", "ITO", "IT Outsourcing", "기업의 IT 운영 전체를 외부에 맡기는 것", ["IT 아웃소싱"], 0),
    ("SI·프로젝트", "FDE", "Forward Deployed Engineer", "고객 현장에 들어가 제품을 맞춰 붙이고 요구를 개발팀에 전달하는 엔지니어", ["현장 투입 엔지니어"], 1),
    ("SI·프로젝트", "PL", "Project Leader", "개발 파트를 이끄는 실무 리더", ["프로젝트 리더", "파트 리더"], 1),
    ("SI·프로젝트", "PM", "Project Manager", "일정·예산·범위·인력을 책임지는 프로젝트 관리자", ["프로젝트 매니저"], 1),
    ("SI·프로젝트", "RFP", "Request for Proposal", "발주처가 원하는 내용을 적어 제안을 요청하는 문서", ["제안요청서"], 1),
    ("SI·프로젝트", "SOW", "Statement of Work", "무엇을 어디까지 할지 적은 과업 범위 기술서", ["과업지시서", "과업 범위"], 0),
    ("SI·프로젝트", "WBS", "Work Breakdown Structure", "전체 작업을 관리 가능한 단위로 쪼갠 구조", ["작업 분해 구조"], 0),
    ("SI·프로젝트", "As-Is / To-Be", "As-Is / To-Be", "현재 업무 모습과 목표 업무 모습. 차이가 곧 개발 범위", ["현행 / 목표 모델"], 0),
    ("SI·프로젝트", "Change request", "Change Request", "계약 후 범위·사양을 바꾸자는 공식 요청", ["변경 요청", "CR"], 1),
    ("SI·프로젝트", "Scope creep", "Scope Creep", "합의 없이 요구가 조금씩 늘어나 범위가 커지는 현상", ["범위 확산"], 1),
    ("SI·프로젝트", "Stakeholder", "Stakeholder", "프로젝트 결과에 이해관계가 있는 사람·조직", ["이해관계자"], 0),
    ("SI·프로젝트", "Consortium", "Consortium", "여러 기관이 역할을 나눠 함께 수행하는 과제 구조", ["컨소시엄", "공동 수행"], 0),
    ("SI·프로젝트", "Customization", "Customization", "제품을 고객별 요구에 맞춰 고쳐 붙이는 개발", ["커스터마이징", "맞춤 개발"], 1),
]


# ── 0. 기초 (면접장에서 '쉬운데 안 떠오르는' 용어 — 로드밸런싱 사례) ─────────
B = "기초"
BASIC = [
    (B, "Server", "Server", "요청을 받아 처리해 주는 컴퓨터·프로그램", ["서버"]),
    (B, "Client", "Client", "서버에 요청을 보내는 쪽", ["클라이언트"]),
    (B, "Frontend", "Frontend", "사용자가 보는 화면 쪽 개발", ["프론트엔드", "프런트엔드"]),
    (B, "Backend", "Backend", "서버·데이터 처리 쪽 개발", ["백엔드"]),
    (B, "Full-stack", "Full-stack", "프론트와 백엔드를 모두 다루는 개발", ["풀스택"]),
    (B, "Load balancing", "Load Balancing", "요청을 여러 서버에 고르게 나눠 보내는 것", ["로드밸런싱", "부하 분산"]),
    (B, "Scale-out", "Scale-out (Horizontal Scaling)", "서버 대수를 늘려 처리량을 키우는 것", ["수평 확장", "스케일 아웃"]),
    (B, "Scale-up", "Scale-up (Vertical Scaling)", "서버 한 대의 성능을 키우는 것", ["수직 확장", "스케일 업"]),
    (B, "Availability", "Availability", "서비스가 중단 없이 쓸 수 있는 정도", ["가용성"]),
    (B, "Failover", "Failover", "장애 시 예비 시스템으로 자동 전환", ["장애 조치", "페일오버"]),
    (B, "Redundancy", "Redundancy", "장애 대비로 같은 구성을 여러 벌 두는 것", ["이중화", "중복 구성"]),
    (B, "Backup", "Backup", "데이터를 따로 복사해 보관하는 것", ["백업"]),
    (B, "Latency", "Latency", "요청부터 응답까지 걸리는 지연 시간", ["지연 시간", "레이턴시"]),
    (B, "Throughput", "Throughput", "단위 시간당 처리량", ["처리량", "스루풋"]),
    (B, "Bandwidth", "Bandwidth", "한 번에 보낼 수 있는 데이터 양(통신 폭)", ["대역폭"]),
    (B, "Scalability", "Scalability", "사용량이 늘어도 감당하도록 늘릴 수 있는 성질", ["확장성"]),
    (B, "DB", "Database", "데이터를 체계적으로 저장·조회하는 저장소", ["데이터베이스"]),
    (B, "RDBMS", "Relational Database Management System", "표(테이블) 구조로 관리하는 관계형 DB", ["관계형 데이터베이스"]),
    (B, "NoSQL", "Not only SQL", "표 구조가 아닌 방식의 DB(문서·키값 등)", ["노에스큐엘", "비관계형 DB"]),
    (B, "SQL", "Structured Query Language", "DB에 조회·수정을 요청하는 언어", ["에스큐엘", "구조화 질의어"]),
    (B, "Query", "Query", "DB에 보내는 조회·수정 요청문", ["쿼리", "질의"]),
    (B, "Index", "Database Index", "조회를 빠르게 하려고 만든 색인", ["인덱스", "색인"]),
    (B, "Schema", "Schema", "데이터 구조(테이블·필드)의 설계도", ["스키마"]),
    (B, "CRUD", "Create, Read, Update, Delete", "생성·조회·수정·삭제 기본 동작", ["크루드", "생성 조회 수정 삭제"]),
    (B, "ORM", "Object-Relational Mapping", "코드의 객체와 DB 테이블을 자동으로 이어 주는 도구", ["객체 관계 매핑"]),
    (B, "HTTP", "HyperText Transfer Protocol", "웹에서 요청·응답을 주고받는 규약", ["에이치티티피"]),
    (B, "HTTPS", "HTTP Secure", "암호화된 HTTP", ["보안 HTTP"]),
    (B, "SSL/TLS", "Secure Sockets Layer / Transport Layer Security", "통신을 암호화하는 보안 규약", ["보안 소켓 계층", "전송 계층 보안"]),
    (B, "DNS", "Domain Name System", "도메인 이름을 IP 주소로 바꿔 주는 체계", ["도메인 네임 시스템"]),
    (B, "IP", "Internet Protocol", "인터넷에서 장비를 찾아가는 주소 규약", ["인터넷 프로토콜", "IP 주소"]),
    (B, "TCP", "Transmission Control Protocol", "순서·도착을 보장하는 신뢰성 통신 규약", ["티씨피"]),
    (B, "UDP", "User Datagram Protocol", "빠르지만 도착을 보장하지 않는 통신 규약", ["유디피"]),
    (B, "Port", "Port", "한 서버 안에서 서비스를 구분하는 번호", ["포트"]),
    (B, "URL", "Uniform Resource Locator", "웹 자원의 주소", ["웹 주소", "유알엘"]),
    (B, "Proxy", "Proxy", "요청을 대신 전달해 주는 중계 서버", ["프록시", "중계 서버"]),
    (B, "Firewall", "Firewall", "허용되지 않은 접근을 막는 보안 장치", ["방화벽"]),
    (B, "VPN", "Virtual Private Network", "공용망 위에 만든 암호화 전용 통신로", ["가상 사설망"]),
    (B, "Session", "Session", "로그인 상태 등을 서버가 기억하는 것", ["세션"]),
    (B, "Cookie", "Cookie", "브라우저에 저장하는 작은 데이터", ["쿠키"]),
    (B, "JSON", "JavaScript Object Notation", "키-값 형태의 가벼운 데이터 형식", ["제이슨"]),
    (B, "OS", "Operating System", "하드웨어를 관리하는 기본 소프트웨어", ["운영체제"]),
    (B, "CPU", "Central Processing Unit", "연산을 처리하는 중앙 처리 장치", ["중앙처리장치"]),
    (B, "RAM", "Random Access Memory", "실행 중 데이터를 두는 주기억장치", ["램", "메모리"]),
    (B, "Process", "Process", "실행 중인 프로그램 하나", ["프로세스"]),
    (B, "Thread", "Thread", "프로세스 안에서 동시에 도는 실행 흐름", ["스레드", "쓰레드"]),
    (B, "VM", "Virtual Machine", "소프트웨어로 만든 가상 컴퓨터", ["가상 머신"]),
    (B, "Container", "Container", "앱과 실행환경을 묶어 어디서나 똑같이 돌리는 단위", ["컨테이너"]),
    (B, "Docker", "Docker", "컨테이너를 만들고 실행하는 대표 도구", ["도커"]),
    (B, "Kubernetes", "Kubernetes (K8s)", "컨테이너 여러 개를 배치·관리하는 플랫폼", ["쿠버네티스", "K8s"]),
    (B, "Cloud", "Cloud Computing", "인터넷으로 빌려 쓰는 컴퓨팅 자원", ["클라우드"]),
    (B, "SaaS", "Software as a Service", "설치 없이 인터넷으로 쓰는 소프트웨어", ["사스", "서비스형 소프트웨어"]),
    (B, "PaaS", "Platform as a Service", "개발·실행 환경을 빌려 주는 서비스", ["파스", "서비스형 플랫폼"]),
    (B, "IaaS", "Infrastructure as a Service", "서버·저장소 같은 인프라를 빌려 주는 서비스", ["이아스", "서비스형 인프라"]),
    (B, "Serverless", "Serverless", "서버 관리 없이 코드만 올려 실행하는 방식", ["서버리스"]),
    (B, "Git", "Git", "코드 변경 이력을 관리하는 버전 관리 도구", ["깃", "버전 관리"]),
    (B, "Repository", "Repository", "코드와 이력을 모아 둔 저장소", ["저장소", "레포", "리포지토리"]),
    (B, "Commit", "Commit", "변경 내용을 이력에 한 단위로 기록하는 것", ["커밋"]),
    (B, "Branch", "Branch", "작업을 나눠 진행하는 코드 갈래", ["브랜치"]),
    (B, "Merge", "Merge", "갈래(브랜치)를 하나로 합치는 것", ["병합", "머지"]),
    (B, "Deploy", "Deployment", "만든 프로그램을 실제 서비스 환경에 올리는 것", ["배포", "디플로이"]),
    (B, "Debugging", "Debugging", "버그를 찾아 고치는 작업", ["디버깅"]),
    (B, "Refactoring", "Refactoring", "동작은 그대로 두고 코드 구조를 개선하는 것", ["리팩토링", "리팩터링"]),
    (B, "Technical debt", "Technical Debt", "급하게 만든 탓에 나중에 치러야 할 개선 비용", ["기술 부채"]),
    (B, "Legacy", "Legacy System", "오래되어 바꾸기 어려운 기존 시스템", ["레거시"]),
    (B, "Framework", "Framework", "틀이 정해져 있어 그 안에 코드를 채우는 개발 뼈대", ["프레임워크"]),
    (B, "Library", "Library", "필요할 때 가져다 쓰는 코드 모음", ["라이브러리"]),
    (B, "SDK", "Software Development Kit", "특정 플랫폼 개발용 도구 모음", ["소프트웨어 개발 키트"]),
    (B, "IDE", "Integrated Development Environment", "코드 작성·실행·디버깅을 한곳에서 하는 도구", ["통합 개발 환경"]),
    (B, "CLI", "Command Line Interface", "명령어로 조작하는 방식", ["명령줄 인터페이스"]),
    (B, "GUI", "Graphical User Interface", "그림·버튼으로 조작하는 화면 방식", ["그래픽 사용자 인터페이스"]),
    (B, "UI/UX", "User Interface / User Experience", "화면 구성 / 사용 경험", ["사용자 인터페이스 사용자 경험"]),
    (B, "Middleware", "Middleware", "프로그램 사이에서 연결·중계하는 소프트웨어", ["미들웨어"]),
    (B, "Open source", "Open Source", "소스코드가 공개되어 누구나 쓰고 고칠 수 있는 것", ["오픈소스"]),
    (B, "Agile", "Agile", "짧게 나눠 만들고 자주 고치는 개발 방식", ["애자일"]),
    (B, "Scrum", "Scrum", "스프린트 단위로 일하는 애자일 방법", ["스크럼"]),
    (B, "Sprint", "Sprint", "1~4주 단위의 짧은 개발 주기", ["스프린트"]),
    (B, "MVP", "Minimum Viable Product", "핵심 기능만 담은 최소 제품", ["최소 기능 제품"]),
    (B, "PoC", "Proof of Concept", "개념이 실제로 되는지 확인하는 검증", ["개념 증명"]),
    (B, "QA", "Quality Assurance", "품질을 검증·보증하는 활동", ["품질 보증"]),
    (B, "UAT", "User Acceptance Test", "사용자가 직접 확인하는 인수 테스트", ["사용자 인수 테스트"]),
]

# 용어 쪽 허용 표기 (뜻→용어 방향 채점용). 기본값: 용어 자체 + 풀네임 + near 중 한글 음차
ALIASES = {
    "Load balancing": ["Load balancer", "LB", "로드밸런서", "부하분산"],
    "Load balancer": ["Load balancing", "LB", "로드밸런싱"],
    "Kubernetes": ["K8s", "k8s", "쿠버네티스"],
    "CI/CD": ["CICD", "CI CD"], "Pub/Sub": ["PubSub", "Pub Sub"], "UI/UX": ["UI UX"],
    "SSL/TLS": ["SSL", "TLS"], "Retry / Backoff": ["Retry", "Backoff", "Exponential backoff"],
    "DB": ["Database", "데이터베이스"], "Tool calling": ["Function calling"],
    "Eval": ["Evaluation", "Evals"], "Deploy": ["Deployment", "배포"],
    # AICC·RAG 보강
    "SLM": ["sLLM", "SLLM", "경량 LLM", "소형 LLM"],
    "NER": ["Entity extraction", "개체명 추출"],
    "Agent assist": ["상담어시스트", "Agent Assistant"],
    "IVR": ["Visual ARS", "보이는 ARS", "ARS"],
    "Apache Solr": ["Solr"], "Elasticsearch": ["ES"],
    "Open-weight model": ["Open weight", "오픈웨이트"],
    "Rule-based": ["Rule base", "룰베이스"],
    "Top-k": ["Topk", "Top k"],
    # 제조·물류·Vision 보강
    "RFC / BAPI": ["RFC", "BAPI"],
    "As-Is / To-Be": ["As-Is", "To-Be", "AsIs ToBe", "As Is To Be"],
    "OPC UA": ["OPCUA", "OPC-UA"],
    "Re-ID": ["ReID", "Re ID", "Reidentification"],
    "Change request": ["CR", "변경요청"],
    "Object detection": ["Detection", "객체탐지"],
    "mAP": ["MAP", "mean AP"],
    "IoU": ["Intersection over Union"],
    "SAP": ["S/4HANA", "SAP ERP"],
    "Edge inference": ["Edge AI", "엣지 추론"],
}

# 헷갈리는 묶음 — 객관식 오답은 우선 여기서, 없으면 같은 분야에서 고른다.
# 묶음 안의 용어끼리는 '비슷하지만 다른 답'이어야 한다(정답이 둘이 되면 안 됨).
CONFUSABLE = [
    ["SLA", "SLO", "SLI"], ["AuthN", "AuthZ", "SSO", "MFA"], ["FR", "NFR", "BR"],
    ["RBAC", "ABAC", "Least privilege", "SoD"], ["Canary release", "Blue-green", "Feature flag", "Rollback"],
    ["SSR", "CSR", "SPA", "PWA"], ["MLOps", "LLMOps", "DevOps"], ["Cache", "CDN", "Proxy"],
    ["Queue", "Pub/Sub", "Webhook", "Event-driven"], ["MSA", "Monolith", "Serverless"],
    ["Scale-out", "Scale-up", "Load balancing", "Failover"], ["Availability", "Scalability", "Redundancy"],
    ["Latency", "Throughput", "Bandwidth"], ["TCP", "UDP", "HTTP", "IP"], ["DNS", "IP", "URL"],
    ["SaaS", "PaaS", "IaaS"], ["VM", "Container", "Docker", "Kubernetes"], ["Process", "Thread"],
    ["Commit", "Branch", "Merge", "PR"], ["Framework", "Library", "SDK"], ["MVP", "PoC", "UAT"],
    ["QA", "UAT", "Regression test", "Smoke test", "E2E test"], ["RDBMS", "NoSQL", "DB"],
    ["Transaction", "ACID", "Eventual consistency"], ["RAG", "Fine-tuning", "Grounding", "Embedding"],
    ["Hallucination", "Prompt injection", "Guardrail"], ["Agent", "Subagent", "Multi-agent", "Orchestration"],
    ["System prompt", "Few-shot", "CoT", "Temperature"], ["HITL", "Escalation", "Approval gate"],
    ["Token", "Context window", "Embedding"], ["ERP", "OMS", "WMS"], ["CSAT", "KPI", "ROI"],
    ["Safety stock", "Backorder", "Fulfillment"], ["Incident", "Postmortem", "Runbook", "MTTR"],
    ["Refactoring", "Technical debt", "Legacy"], ["Agile", "Scrum", "Sprint"],
    ["Session", "Cookie", "JWT"], ["Firewall", "VPN", "Zero trust", "Air gap"],
    # ── AICC·RAG 보강 ──
    ["Hybrid search", "BM25", "Reranker"],          # 검색 단계가 서로 다름
    ["Chunking", "Top-k", "Embedding"],             # RAG 파이프라인의 다른 지점
    ["RAGAS", "Faithfulness", "Golden set", "Eval"],
    ["STT", "TTS", "NLU"],                          # 음성→글 / 글→음성 / 이해
    ["AICC", "IPCC", "IVR"],                        # AI 접목 / 콜센터 인프라 / 자동응답
    ["LoRA", "Quantization", "Fine-tuning"],        # 경량 학습 / 경량화 / 전체 학습
    ["Chatbot", "Callbot", "Agent assist"],         # 글봇 / 음성봇 / 상담원 보조
    ["KMS", "CRM", "VOC"],                          # 지식 / 고객정보 / 고객의견
    ["Intent classification", "Slot filling", "NER"],
    ["NLP", "NLU", "Rule-based"],
    ["TTFT", "Latency", "Streaming"],               # 첫 토큰 / 전체 지연 / 전송 방식
    ["vLLM", "Gemma", "Open-weight model"],
    ["pgvector", "Milvus", "Qdrant", "Vector DB"],
    ["Elasticsearch", "Apache Solr", "BM25"],
    ["TA", "VOC", "CSAT"],                          # 녹취분석 / 고객의견 / 만족도
    ["CX", "CSAT", "CS"],
    # ── 제조·물류·Vision 보강 ──
    ["MES", "ERP", "SCM"],                          # 현장 실행 / 전사 자원 / 공급망
    ["SCADA", "HMI", "PLC"],                        # 감시 시스템 / 조작 화면 / 제어기
    ["Putaway", "Picking", "Cycle count"],          # 넣기 / 꺼내기 / 세기
    ["RFID", "PDA", "ASN"],                         # 무선 태그 / 바코드 단말 / 사전 통지
    ["IoU", "mAP", "Bounding box"],                 # 겹침 비율 / 전체 지표 / 좌표
    ["Object detection", "MOT", "Re-ID"],           # 찾기 / 이어 추적 / 카메라 넘어 재식별
    ["OCR", "STT", "Annotation"],                   # 이미지→글 / 음성→글 / 정답 표시
    ["EAI", "ESB", "Gateway"],                      # 통합 개념 / 중계 버스 / 출입구
    ["RFC / BAPI", "IDoc", "OData"],                # SAP 연동 방식 셋
    ["SI", "SM", "ITO"],                            # 구축 / 운영 / 통째 위탁
    ["PL", "PM", "FDE"],                            # 개발 리더 / 일정·예산 / 현장 투입
    ["RFP", "SOW", "WBS"],                          # 제안요청 / 과업범위 / 작업분해
    ["Change request", "Scope creep", "As-Is / To-Be"],   # 공식 변경 / 무단 확산 / 범위 산정
    ["Digital twin", "IIoT", "Edge inference"],     # 가상 복제 / 설비 연결 / 현장 추론
    ["OEE", "Lot", "BOM"],                          # 효율 지표 / 생산 묶음 / 자재 목록
    ["Data drift", "Fine-tuning", "Eval"],          # 성능 저하 원인 / 재학습 / 측정
    ["WMS", "Location", "Putaway"],                 # 창고 시스템 / 보관 주소 / 적치
    ["Groupware", "EP", "KMS"],                     # 협업 / 포털 / 지식
]


def main():
    global T
    # 기초는 level 1. Load balancer 는 기초의 Load balancing 과 겹치므로 아키텍처에서 뺀다.
    T = [r for r in T if r[1] != "Load balancer"] + EICN + TCCINS \
        + [(c, w, f, k, n, 0) for c, w, f, k, n in BASIC]
    lv = {w: 1 for _, w, *_ in BASIC}

    # 같은 용어가 두 번 들어오면 출제·채점이 꼬인다. 묶음을 합칠 때 가장 흔한 사고라 막아 둔다.
    seen = {}
    for cat, w, *_ in T:
        assert w not in seen, f"용어 중복: {w} ({seen[w]} / {cat})"
        seen[w] = cat

    # 첫 뜻이 겹치면 객관식에서 정답이 둘이 된다.
    first = {}
    for cat, w, _f, ko, *_ in T:
        assert ko not in first, f"첫 뜻 중복: {ko!r} — {first[ko]} / {w}"
        first[ko] = w

    words = {r[1] for r in T}
    conf = {}
    for g in CONFUSABLE:
        miss = [x for x in g if x not in words]
        assert not miss, f"헷갈림 묶음에 없는 용어: {miss}"
        for x in g:
            conf.setdefault(x, [])
            conf[x] += [y for y in g if y != x and y not in conf[x]]
    deck = []
    for cat, w, full, ko, near, star in T:
        al = [w, full] + ALIASES.get(w, [])
        deck.append({
            "word": w, "meanings": [ko, full], "partOfSpeech": cat, "near": near,
            "level": 1 if w in lv else (3 if star else 2),      # 1 기초 / 2 일반 / 3 면접 우선
            "aliases": list(dict.fromkeys(a for a in al if a)),  # 뜻→용어 채점 시 인정할 표기
            "confusable": conf.get(w, []),                       # 객관식 오답 1순위 후보
        })
    json.dump(deck, open(os.path.join(HERE, "it_terms.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    out = [f"# IT 개발 용어 — 면접 대비 ({len(T)}개)\n",
           "★ = 면접 우선. 앱 덱: `it_terms.json`\n",
           "RAG·검색 / LLM 서빙 / 대화형 AI / 컨택센터는 이아이씨엔(AICC) 대비로 추가.\n"]
    cats = []
    for c, *_ in T:
        if c not in cats:
            cats.append(c)
    for c in cats:
        rows = [r for r in T if r[0] == c]
        out.append(f"\n## {c} ({len(rows)})\n\n| | 용어 | 풀네임 | 뜻 |\n|---|---|---|---|")
        for _, w, full, ko, _n, star in sorted(rows, key=lambda r: -r[5]):
            out.append(f"| {'★' if star else ''} | **{w}** | {full} | {ko} |")
    p = os.path.join(HERE, "..", "..", "fund_agent", "docs", "jobs", "it_terms_review.md")
    open(p, "w", encoding="utf-8").write("\n".join(out) + "\n")
    star = sum(r[5] for r in T)
    print(f"덱 {len(deck)}개 → data/it_terms.json  |  면접 우선 ★ {star}개  |  요약본 → {os.path.normpath(p)}")
    for c in cats:
        print(f"  {c}: {sum(1 for r in T if r[0] == c)}")


if __name__ == "__main__":
    main()
