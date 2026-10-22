# -*- coding: utf-8 -*-
"""
이슈 8 — 더 작은 모델로 바꿔도 채점이 되는지 본다.

src/embedding.ts 와 똑같이 계산한다:
  - MAX_LEN 32 로 자른다
  - 평균 풀링(attention_mask 로 가중) 후 L2 정규화
  - 내적 = 코사인 유사도
  - token_type_ids 를 넘기지 않는다 (앱이 안 넘긴다 → 기본 0)
"""
import json
import sys
import io

import torch
from transformers import AutoTokenizer, AutoModel

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

MAX_LEN = 32
GOOD, CLOSE = 0.85, 0.70


def load(model_id):
    tok = AutoTokenizer.from_pretrained(model_id)
    mdl = AutoModel.from_pretrained(model_id).eval()
    return tok, mdl


@torch.no_grad()
def embed(tok, mdl, texts):
    enc = tok(texts, padding=True, truncation=True,
              max_length=MAX_LEN, return_tensors="pt")
    # 앱은 input_ids / attention_mask 만 넘긴다
    out = mdl(input_ids=enc["input_ids"],
              attention_mask=enc["attention_mask"]).last_hidden_state
    mask = enc["attention_mask"].unsqueeze(-1).float()
    vec = (out * mask).sum(1) / mask.sum(1).clamp(min=1)
    return torch.nn.functional.normalize(vec, p=2, dim=1)


def sim(tok, mdl, a, b):
    v = embed(tok, mdl, [a, b])
    return float((v[0] * v[1]).sum())


def grade(s):
    return "정답" if s >= GOOD else ("비슷" if s >= CLOSE else "오답")


def main():
    model_id = sys.argv[1]
    verify = "--verify" in sys.argv

    pairs = json.load(open("pairs.json", encoding="utf-8"))
    tok, mdl = load(model_id)
    n_param = sum(p.numel() for p in mdl.parameters())

    print(f"모델: {model_id}")
    print(f"파라미터: {n_param/1e6:.1f}M  → int8 약 {n_param/1024/1024:.0f}MB")
    print(f"토크나이저: {tok.__class__.__name__}")
    print()

    results = {}
    worst_verify = 0.0

    for group in ("control", "opposite", "sibling", "inflection", "wordorder"):
        rows = pairs[group]
        print(f"=== {group} ===")
        scores = []
        for r in rows:
            s = sim(tok, mdl, r["a"], r["b"])
            scores.append(s)
            label = r.get("label", "")
            line = f"  {s:.4f}  {grade(s):<4}"
            if verify:
                d = abs(s - r["expect"])
                worst_verify = max(worst_verify, d)
                line += f"  (폰 {r['expect']:.4f}, 차이 {d:.4f})"
            if label:
                line += f"  {label}"
            else:
                line += f"  {r['a'][:22]} / {r['b'][:22]}"
            print(line)
        results[group] = scores
        print()

    print("=== 요약 ===")
    opp = max(results["opposite"])
    sib = max(results["sibling"])
    infl = min(results["inflection"])
    wo = max(results["wordorder"])
    print(f"  대립쌍 최고   {opp:.4f}   (0.85 아래여야 한다)")
    print(f"  형제쌍 최고   {sib:.4f}   (0.85 아래여야 한다)")
    print(f"  어순뒤집기 최고 {wo:.4f}   (0.85 아래여야 한다)")
    print(f"  활용형 최저   {infl:.4f}   (0.85 위여야 한다)")
    print()

    # 핵심 지표: 통과해야 하는 것들과 막아야 하는 것들 사이의 간격
    margin = infl - max(opp, sib, wo)
    print(f"  >>> 분리 폭: {margin:+.4f}  (활용형 최저 - 틀린답 최고)")
    if margin <= 0:
        print("      겹친다 — 임계값을 어디에 둬도 오채점이 난다")
    else:
        print(f"      임계값 0.85 가 이 구간 안에 있는가: "
              f"{'예' if max(opp,sib,wo) < 0.85 <= infl else '아니오'}")

    if verify:
        print()
        print(f"  폰 값과 최대 차이: {worst_verify:.4f}")
        print(f"  {'재현 성공' if worst_verify < 0.02 else '재현 실패 — 설정이 다르다'}")


if __name__ == "__main__":
    main()
