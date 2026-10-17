#!/usr/bin/env python3
"""코퍼스 결과 집계 — 같은 기준으로 전/후를 채점한다.  python3 scripts/qa/stamp-place-corpus-report.py output/stamp-corpus/base [after1 ...]"""
import json, os, re, sys, collections
ONLY = set(filter(None, os.environ.get("THEMES", "").split(",")))  # THEMES=beodeul,jp,interior,sky 로 같은 칩셋만 비교
CLAIM = re.compile(r"놓음|배치 ·|완료|깔았|세웠|심었|산포|생성")
DENY = re.compile(r"않|실패|못|없|거절|버린")
def categorize(r):
    """결과 하나 → (분류, 거짓 줄 여부)."""
    obj = r["expect"] in ("art", "event")
    refuse = r["expect"] == "refuse"
    vis = r["tilesChanged"] > 0 or any(e["visible"] and not re.search(r"charset|actor|villager|people|sprite \?", e["graphic"]) for e in r["events"])
    placed = r["tilesChanged"] > 0 or len(r["events"]) > 0
    claims = r["ok"] or any(CLAIM.search(l) and not DENY.search(l) for l in r["lines"])
    if refuse:
        cat = "거절 올바름" if not placed else "없는 물건에 뭔가 깔림"
    elif obj and r["verdict"] == "ART": cat = "그림 맞음"
    elif obj and r["verdict"] == "WRONG_THING": cat = "엉뚱한 물건"
    elif obj and r["verdict"] in ("EVENT_ONLY", "FALSE_OK"): cat = "이벤트만(그림 없음)"
    elif obj and r["verdict"] == "REFUSED_OK" and any("그림이 없어 깔지 않았습니다" in l for l in r["lines"]): cat = "정직한 거절(그림 없음+대안)"
    elif obj and r["verdict"] == "REFUSED_OK": cat = "거절(사유 불명)"
    elif obj and r["verdict"] == "NONE" and any("놓을 자리가 없습니다" in l for l in r["lines"]): cat = "정직한 거절(자리 없음)"
    elif obj and r["verdict"] == "NONE" and any("실패" in l or "못" in l or "버린 단계" in l for l in r["lines"]): cat = "도구 실패(사유 표시)"
    elif obj and r["verdict"] == "NONE": cat = "아무것도 안 함"
    elif not obj and not refuse: cat = "모호한 말: 변화 있음" if placed else "모호한 말: 변화 없음"
    else: cat = r["verdict"]
    lie = (claims and obj and not vis and not r["verdict"] == "ART") or (refuse and claims and placed)
    return cat, bool(lie)

def score(path):
    d = json.load(open(path + "/results.json")); R = [r for r in d["results"] if not ONLY or r["theme"] in ONLY]
    out = collections.Counter(); bad = []
    for r in R:
        cat, lie = categorize(r)
        out[cat] += 1
        if lie: out["결과 줄 거짓"] += 1; bad.append((r["theme"], r["id"]))
    return len(R), out, bad
if __name__ != "__main__": sys.argv = sys.argv[:1]
for p in sys.argv[1:]:
    n, c, bad = score(p)
    print(p, n)
    for k, v in sorted(c.items(), key=lambda x: -x[1]): print("  %-28s %3d  %4.1f%%" % (k, v, 100 * v / n))
