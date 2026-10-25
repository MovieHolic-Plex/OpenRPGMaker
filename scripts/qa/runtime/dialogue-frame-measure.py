#!/usr/bin/env python3
"""dialogue-frame 시나리오의 rects.json 요약 — 줄(창)마다 안정 상태의 상자 위·아래, 연속 줄 사이 이동량.
사용: python3 scripts/qa/runtime/dialogue-frame-measure.py verify-shots/runtime-qa/dframe-<tag>-<which>-rects.json [--json]
「줄」 = 같은 글(text)·같은 종류가 이어지는 프레임 묶음. 안정 상태 = 그 묶음의 마지막 프레임(등장 연출이 끝난 뒤)."""
import json, sys

def segments(log):
    segs = []
    for f in log:
        key = (f["kind"], f.get("id") if f["kind"] != "choices" else "choices")
        if segs and segs[-1]["key"] == key:
            segs[-1]["frames"].append(f)
        else:
            segs.append({"key": key, "frames": [f]})
    return [s for s in segs if len(s["frames"]) >= 3]

def summarize(path):
    log = json.load(open(path))
    rows = []
    for s in segments(log):
        last = s["frames"][-1]
        tops = {f["top"] for f in s["frames"] if f["phase"] in ("shown", "")}
        rows.append({"kind": last["kind"], "face": last["face"], "pos": last["pos"], "text": last["text"],
                     "top": last["top"], "bottom": last["bottom"], "left": last.get("left"), "right": last.get("right"), "height": round(last["bottom"] - last["top"], 1),
                     "plateTop": last["plateTop"], "reason": last.get("reason"), "panel": last.get("panel"), "framed": last.get("framed"), "frames": len(s["frames"]), "steadyTopsSeen": sorted(tops)})
    moves = []
    for a, b in zip(rows, rows[1:]):
        moves.append({"from": f'{a["kind"]}{"+face" if a["face"] else ""}', "to": f'{b["kind"]}{"+face" if b["face"] else ""}',
                      "dTop": round(b["top"] - a["top"], 1), "dBottom": round(b["bottom"] - a["bottom"], 1), "dLeft": round((b.get("left") or 0) - (a.get("left") or 0), 1), "dRight": round((b.get("right") or 0) - (a.get("right") or 0), 1), "toPos": b["pos"]})
    return {"frames": len(log), "lines": rows, "moves": moves}

if __name__ == "__main__":
    out = summarize(sys.argv[1])
    if "--json" in sys.argv:
        print(json.dumps(out, ensure_ascii=False, indent=1)); sys.exit()
    print(f'frames recorded: {out["frames"]}')
    for r in out["lines"]:
        print(f'{r["kind"]:9} face={int(r["face"])} {r["pos"]:16} top={r["top"]:7} bottom={r["bottom"]:7} h={r["height"]:6} plate={r["plateTop"]} n={r["frames"]} {r["reason"]} {"panel="+str(r["panel"]) if r["panel"] else ""} | {r["text"]}')
    for m in out["moves"]:
        flag = "" if m["dTop"] == 0 and m["dBottom"] == 0 else "  <-- MOVED"
        print(f'  {m["from"]:>15} -> {m["to"]:<15} dTop={m["dTop"]:7} dBottom={m["dBottom"]:7} {m["toPos"]}{flag}')
