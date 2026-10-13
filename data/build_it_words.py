"""IT 문서 영단어 덱 생성기.

기술 용어(it_terms.json)가 아니라, 영문 기술 문서·에러 메시지·코드 리뷰·
릴리스 노트에서 반복해서 나오는 **일반 영단어**를 모았다.
"deprecated", "mitigate", "arbitrary" 같은 것들 — 뜻을 모르면 문서를 읽다 막히는데
정작 단어장에는 잘 없는 어휘다.

it_terms.json 과 같은 필드 구조를 쓴다:
  word          : 영단어
  meanings      : [한국어 뜻, ...]  ← 정답으로 인정
  partOfSpeech  : 분야 (문서 읽기 / 에러·로그 / 리뷰·협업 / 릴리스·운영)
  near          : 비슷하게 답해도 맞게 쳐 줄 표현
  level         : 1 기초 / 2 일반 / 3 우선
  aliases       : 뜻→단어 방향 채점에서 인정할 표기
  confusable    : 헷갈리는 단어 (객관식 오답 후보)

용어 추가·수정은 이 파일에서 하고 다시 실행할 것. JSON 직접 수정 금지.
    python data/build_it_words.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))

# (분야, 단어, 한국어 뜻들, near, level, confusable)
W = [
    # ── 문서 읽기 ────────────────────────────────────────────────
    ("문서 읽기", "deprecated", ["더 이상 권장되지 않는", "폐기 예정인"],
     ["사용 중단된", "구식의"], 1, ["obsolete", "legacy", "discouraged"]),
    ("문서 읽기", "obsolete", ["한물간", "쓸모없어진"],
     ["구식의", "퇴물이 된"], 2, ["deprecated", "legacy", "outdated"]),
    ("문서 읽기", "legacy", ["예전부터 써 온", "구형의"],
     ["레거시", "기존의"], 1, ["deprecated", "obsolete", "existing"]),
    ("문서 읽기", "arbitrary", ["임의의", "아무렇게나 정한"],
     ["제멋대로인", "자의적인"], 1, ["random", "specific", "explicit"]),
    ("문서 읽기", "explicit", ["명시적인", "분명히 밝힌"],
     ["명확한", "드러낸"], 1, ["implicit", "specific", "verbose"]),
    ("문서 읽기", "implicit", ["암묵적인", "말하지 않아도 되는"],
     ["내재된", "묵시적인"], 1, ["explicit", "inherent", "default"]),
    ("문서 읽기", "inherent", ["본래부터 있는", "타고난"],
     ["내재적인", "고유한"], 2, ["implicit", "intrinsic", "built-in"]),
    ("문서 읽기", "subsequent", ["뒤이어 오는", "그다음의"],
     ["후속의", "이후의"], 2, ["preceding", "consecutive", "following"]),
    ("문서 읽기", "preceding", ["앞선", "바로 전의"],
     ["선행하는", "이전의"], 2, ["subsequent", "prior", "previous"]),
    ("문서 읽기", "respectively", ["각각", "순서대로 각기"],
     ["차례대로"], 2, ["accordingly", "consecutively", "separately"]),
    ("문서 읽기", "accordingly", ["그에 맞게", "따라서"],
     ["그에 따라"], 2, ["respectively", "consequently", "hence"]),
    ("문서 읽기", "regardless", ["상관없이", "무관하게"],
     ["개의치 않고"], 1, ["nevertheless", "irrespective", "despite"]),
    ("문서 읽기", "prerequisite", ["사전에 갖춰야 할 것", "선행 조건"],
     ["전제 조건", "필수 조건"], 1, ["dependency", "requirement", "constraint"]),
    ("문서 읽기", "constraint", ["제약", "제한 조건"],
     ["구속 조건", "한계"], 1, ["limitation", "restriction", "prerequisite"]),
    ("문서 읽기", "caveat", ["주의할 점", "단서"],
     ["유의사항", "경고"], 2, ["disclaimer", "limitation", "warning"]),
    ("문서 읽기", "verbose", ["장황한", "말이 많은"],
     ["상세한", "수다스러운"], 2, ["explicit", "concise", "detailed"]),
    ("문서 읽기", "concise", ["간결한", "짧고 명확한"],
     ["간명한"], 2, ["verbose", "brief", "terse"]),
    ("문서 읽기", "ambiguous", ["모호한", "여러 뜻으로 읽히는"],
     ["애매한", "불분명한"], 1, ["vague", "explicit", "obscure"]),
    ("문서 읽기", "trivial", ["사소한", "별것 아닌"],
     ["하찮은", "간단한"], 2, ["negligible", "significant", "minor"]),
    ("문서 읽기", "negligible", ["무시해도 될 만큼 작은"],
     ["미미한", "하찮은"], 2, ["trivial", "minimal", "insignificant"]),

    # ── 에러·로그 ────────────────────────────────────────────────
    ("에러·로그", "invalid", ["유효하지 않은", "잘못된"],
     ["부적합한", "무효한"], 1, ["malformed", "corrupt", "unexpected"]),
    ("에러·로그", "malformed", ["형식이 깨진", "잘못 만들어진"],
     ["형식 오류의"], 1, ["invalid", "corrupt", "truncated"]),
    ("에러·로그", "corrupt", ["손상된", "깨진"],
     ["망가진", "훼손된"], 1, ["malformed", "invalid", "damaged"]),
    ("에러·로그", "truncated", ["잘려 나간", "중간에 끊긴"],
     ["절단된", "잘린"], 1, ["corrupt", "trimmed", "incomplete"]),
    ("에러·로그", "exceed", ["넘어서다", "초과하다"],
     ["초과", "웃돌다"], 1, ["surpass", "overflow", "violate"]),
    ("에러·로그", "overflow", ["넘쳐흐르다", "용량을 넘다"],
     ["오버플로", "범람"], 1, ["exceed", "underflow", "leak"]),
    ("에러·로그", "stale", ["오래돼 쓸 수 없는", "낡은"],
     ["묵은", "만료된"], 1, ["expired", "obsolete", "cached"]),
    ("에러·로그", "expired", ["기한이 지난", "만료된"],
     ["유효기간이 끝난"], 1, ["stale", "revoked", "timeout"]),
    ("에러·로그", "revoked", ["철회된", "취소된"],
     ["회수된", "무효화된"], 2, ["expired", "denied", "invalidated"]),
    ("에러·로그", "denied", ["거부된", "허용되지 않은"],
     ["거절된"], 1, ["revoked", "forbidden", "rejected"]),
    ("에러·로그", "forbidden", ["금지된", "접근이 막힌"],
     ["허가되지 않은"], 1, ["denied", "unauthorized", "restricted"]),
    ("에러·로그", "unauthorized", ["인증되지 않은", "권한이 없는"],
     ["미인증의"], 1, ["forbidden", "denied", "unauthenticated"]),
    ("에러·로그", "abort", ["중도에 멈추다", "중단하다"],
     ["중지", "취소하다"], 1, ["terminate", "cancel", "halt"]),
    ("에러·로그", "terminate", ["끝내다", "종료시키다"],
     ["종료", "끊다"], 1, ["abort", "kill", "exit"]),
    ("에러·로그", "stacktrace", ["오류가 난 호출 경로 기록"],
     ["스택 트레이스", "호출 스택"], 2, ["traceback", "log", "dump"]),
    ("에러·로그", "threshold", ["넘으면 반응하는 기준값", "임계값"],
     ["문턱값", "기준선"], 1, ["limit", "baseline", "quota"]),
    ("에러·로그", "quota", ["쓸 수 있는 할당량"],
     ["쿼터", "한도"], 1, ["threshold", "limit", "capacity"]),
    ("에러·로그", "leak", ["새어 나가다", "누수"],
     ["유출", "누출"], 1, ["overflow", "exposure", "drain"]),
    ("에러·로그", "flaky", ["됐다 안 됐다 하는", "불안정한"],
     ["간헐적으로 실패하는"], 2, ["intermittent", "unstable", "unreliable"]),
    ("에러·로그", "intermittent", ["간헐적인", "띄엄띄엄 일어나는"],
     ["단속적인"], 2, ["flaky", "sporadic", "occasional"]),

    # ── 리뷰·협업 ────────────────────────────────────────────────
    ("리뷰·협업", "mitigate", ["피해를 줄이다", "완화하다"],
     ["경감하다", "누그러뜨리다"], 1, ["alleviate", "resolve", "prevent"]),
    ("리뷰·협업", "alleviate", ["덜어 주다", "누그러뜨리다"],
     ["완화하다", "경감"], 2, ["mitigate", "relieve", "reduce"]),
    ("리뷰·협업", "workaround", ["근본 해결은 아니지만 우회하는 방법"],
     ["임시 방편", "우회책"], 1, ["hotfix", "patch", "fallback"]),
    ("리뷰·협업", "fallback", ["안 될 때 대신 쓰는 대안"],
     ["폴백", "대비책"], 1, ["workaround", "backup", "default"]),
    ("리뷰·협업", "tradeoff", ["하나를 얻으면 하나를 잃는 관계"],
     ["트레이드오프", "맞바꿈"], 1, ["compromise", "balance", "constraint"]),
    ("리뷰·협업", "edge case", ["드물게 일어나는 경계 상황"],
     ["엣지 케이스", "예외 상황"], 1, ["corner case", "outlier", "exception"]),
    ("리뷰·협업", "regression", ["잘 되던 게 다시 망가지는 것"],
     ["회귀", "퇴행"], 1, ["bug", "defect", "rollback"]),
    ("리뷰·협업", "refactor", ["동작은 그대로 두고 구조만 고치다"],
     ["리팩터링", "구조 개선"], 1, ["rewrite", "optimize", "restructure"]),
    ("리뷰·협업", "nit", ["사소한 지적", "잔소리 수준의 의견"],
     ["닛픽", "소소한 지적"], 2, ["nitpick", "minor", "suggestion"]),
    ("리뷰·협업", "bikeshedding", ["사소한 문제로 논쟁을 오래 끄는 것"],
     ["바이크셰딩"], 3, ["nitpick", "overthinking", "debate"]),
    ("리뷰·협업", "rationale", ["그렇게 한 이유", "근거"],
     ["논거", "타당한 이유"], 1, ["justification", "context", "reasoning"]),
    ("리뷰·협업", "assumption", ["당연하다고 전제한 것"],
     ["가정", "전제"], 1, ["premise", "hypothesis", "constraint"]),
    ("리뷰·협업", "scope", ["다룰 범위", "작업 경계"],
     ["스코프", "범위"], 1, ["boundary", "context", "extent"]),
    ("리뷰·협업", "defer", ["나중으로 미루다", "뒤로 미루다"],
     ["연기하다", "지연"], 1, ["postpone", "delay", "suspend"]),
    ("리뷰·협업", "supersede", ["대신하다", "대체해 밀어내다"],
     ["대체하다"], 3, ["replace", "deprecate", "override"]),
    ("리뷰·협업", "redundant", ["중복된", "없어도 되는"],
     ["불필요한", "군더더기의"], 1, ["duplicate", "verbose", "excessive"]),
    ("리뷰·협업", "idempotent", ["여러 번 해도 결과가 같은"],
     ["멱등한", "멱등성"], 2, ["deterministic", "atomic", "stateless"]),
    ("리뷰·협업", "deterministic", ["같은 입력이면 항상 같은 결과인"],
     ["결정론적인", "예측 가능한"], 2, ["idempotent", "predictable", "consistent"]),
    ("리뷰·협업", "consensus", ["여럿이 합의한 결론"],
     ["합의", "의견 일치"], 2, ["agreement", "quorum", "alignment"]),
    ("리뷰·협업", "ambiguity", ["여러 뜻으로 읽히는 상태", "모호함"],
     ["애매함", "불명확성"], 2, ["vagueness", "uncertainty", "confusion"]),

    # ── 릴리스·운영 ──────────────────────────────────────────────
    ("릴리스·운영", "rollout", ["단계적으로 배포해 나가는 것"],
     ["롤아웃", "점진 배포"], 1, ["rollback", "deployment", "release"]),
    ("릴리스·운영", "rollback", ["이전 버전으로 되돌리는 것"],
     ["롤백", "원복"], 1, ["rollout", "revert", "restore"]),
    ("릴리스·운영", "revert", ["변경을 되돌리다"],
     ["되돌리기", "원상복구"], 1, ["rollback", "undo", "reset"]),
    ("릴리스·운영", "hotfix", ["급하게 내보내는 긴급 수정"],
     ["핫픽스", "긴급 패치"], 1, ["patch", "workaround", "bugfix"]),
    ("릴리스·운영", "patch", ["부분적으로 고쳐 덧대는 수정"],
     ["패치", "수정본"], 1, ["hotfix", "fix", "update"]),
    ("릴리스·운영", "downtime", ["서비스가 멈춰 있는 시간"],
     ["다운타임", "중단 시간"], 1, ["outage", "maintenance", "latency"]),
    ("릴리스·운영", "outage", ["장애로 서비스가 끊긴 상태"],
     ["장애", "서비스 중단"], 1, ["downtime", "incident", "failure"]),
    ("릴리스·운영", "incident", ["대응이 필요한 장애 사건"],
     ["인시던트", "사고"], 1, ["outage", "issue", "postmortem"]),
    ("릴리스·운영", "postmortem", ["장애 후 원인을 정리한 회고"],
     ["포스트모템", "사후 분석"], 2, ["retrospective", "incident", "review"]),
    ("릴리스·운영", "mitigation", ["피해를 줄이기 위한 조치"],
     ["완화 조치", "경감책"], 2, ["remediation", "workaround", "prevention"]),
    ("릴리스·운영", "remediation", ["문제를 바로잡는 시정 조치"],
     ["시정", "교정 조치"], 3, ["mitigation", "fix", "correction"]),
    ("릴리스·운영", "provision", ["필요한 자원을 미리 마련해 두다"],
     ["프로비저닝", "자원 할당"], 2, ["allocate", "deploy", "configure"]),
    ("릴리스·운영", "throttle", ["속도·요청량을 일부러 줄이다"],
     ["쓰로틀링", "속도 제한"], 1, ["rate limit", "quota", "restrict"]),
    ("릴리스·운영", "graceful", ["갑자기 끊지 않고 부드럽게 처리하는"],
     ["우아한", "안전한"], 2, ["clean", "soft", "safe"]),
    ("릴리스·운영", "idle", ["아무 일도 안 하고 놀고 있는"],
     ["유휴의", "대기 중인"], 1, ["pending", "inactive", "standby"]),
    ("릴리스·운영", "pending", ["아직 처리되지 않고 대기 중인"],
     ["보류 중인", "대기 중"], 1, ["idle", "queued", "blocked"]),
    ("릴리스·운영", "obsolete build", ["더 쓰지 않는 예전 빌드"],
     ["폐기된 빌드"], 3, ["stale build", "legacy build", "old build"]),
    ("릴리스·운영", "saturate", ["더 못 받을 만큼 가득 차다"],
     ["포화되다", "한계에 이르다"], 3, ["exhaust", "overload", "fill"]),
    ("릴리스·운영", "degrade", ["성능이 서서히 나빠지다"],
     ["저하되다", "성능 하락"], 1, ["deteriorate", "decline", "drop"]),
    ("릴리스·운영", "resilient", ["장애가 나도 잘 버티는"],
     ["회복력 있는", "탄력적인"], 2, ["robust", "fault-tolerant", "durable"]),
]


def build():
    out = []
    for field, word, meanings, near, level, confusable in W:
        # 뜻→단어 방향 채점에서 인정할 표기.
        # 원형 + 소문자 + 공백/하이픈 제거형까지 넣어 둔다.
        aliases = {word, word.lower(), word.capitalize()}
        if " " in word:
            aliases.add(word.replace(" ", ""))
            aliases.add(word.replace(" ", "-"))
        if "-" in word:
            aliases.add(word.replace("-", " "))
            aliases.add(word.replace("-", ""))
        out.append({
            "word": word,
            "meanings": list(meanings),
            "partOfSpeech": field,
            "near": list(near),
            "level": level,
            "aliases": sorted(aliases),
            "confusable": list(confusable),
        })

    path = os.path.join(HERE, "it_words.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    by_level = {}
    by_field = {}
    for w in out:
        by_level[w["level"]] = by_level.get(w["level"], 0) + 1
        by_field[w["partOfSpeech"]] = by_field.get(w["partOfSpeech"], 0) + 1
    print(f"{path}  —  {len(out)}개")
    print("  level:", dict(sorted(by_level.items())))
    print("  분야 :", by_field)


if __name__ == "__main__":
    build()
