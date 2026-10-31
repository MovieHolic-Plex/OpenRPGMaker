#!/usr/bin/env python3
"""Object page -> ~/claude-viz/argon-image-dungeon.html (images in ~/claude-viz/argon-image-dungeon/obj/).
Per object one row: crop from the generated picture | Argon pixel art (4x) | Opus object-gen counterpart (4x) | verdict. Summary on top.
  python3 obj_page.py "<one-line conclusion>"   (run from the worktree root)"""
import json, os, sys, html
from pathlib import Path
from PIL import Image
S = Path.home() / "z-project/assistant-whole-game/suite"
RUNS = Path(os.environ.get("AID_RUNS", S / "rooms/runs-argonimg")); O = RUNS / "objects"; POOL = S / "rooms/objpool"
VIZ = Path.home() / "claude-viz"; IMG = VIZ / "argon-image-dungeon" / "obj"; IMG.mkdir(parents=True, exist_ok=True)
FLOOR = (36, 44, 56, 255)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중"
d = json.load(open(O / "draw.json")); J = json.load(open(O / "judge.json")) if (O / "judge.json").exists() else {}
def x4(png, tag, k=4):
    a = Image.open(png).convert("RGBA"); bg = Image.new("RGBA", a.size, FLOOR); bg.alpha_composite(a)
    bg.resize((a.width * k, a.height * k), Image.NEAREST).convert("RGB").save(IMG / f"{tag}.png"); return f"argon-image-dungeon/obj/{tag}.png"
def crop(png, tag):
    im = Image.open(png).convert("RGB"); k = max(1, min(4, 128 // max(im.size))); im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    im.save(IMG / f"{tag}.png"); return f"argon-image-dungeon/obj/{tag}.png"
KO = {"yes": "예", "partly": "일부", "no": "아니오"}
def absline(a):
    if not a: return "판정 없음"
    return f"닮음 {KO.get(a.get('reads'), '?')} · 칩셋 화풍 {KO.get(a.get('style'), '?')} · 3/4 {KO.get(a.get('view34'), '?')} · 쓸 만함 {KO.get(a.get('quality'), '?')}"
def pairv(cid):
    p = [J.get(f"pair|{cid}|xy"), J.get(f"pair|{cid}|yx")]
    if not all(p): return None, ""
    v = [(1 if (x.get("pick") or "").upper() == "A" else -1 if (x.get("pick") or "").upper() == "B" else 0) * s for x, s in zip(p, (1, -1))]
    return (v[0] if v[0] == v[1] else 0), (p[0].get("why") or "")
score = lambda a, k: (a or {}).get(k)
cnt = lambda rs, k: {v: sum(1 for a in rs if score(a, k) == v) for v in ("yes", "partly", "no")}
A = [J.get(f"abs|{c}") for c, r in d.items() if r["ok"]]; B = [J.get(f"absopus|{r['opus']}") for c, r in d.items() if r["ok"] and r["opus"]]
Aop = [J.get(f"abs|{c}") for c, r in d.items() if r["ok"] and r["opus"]]
W = [pairv(c)[0] for c, r in d.items() if r["ok"] and r["opus"]]; W = [w for w in W if w is not None]
fmt3 = lambda c: f"예 {c['yes']} · 일부 {c['partly']} · 아니오 {c['no']}"
ok = sum(1 for r in d.values() if r["ok"])
rows = []
for cid, r in d.items():
    c = crop(r["crop"], f"crop-{cid}")
    cap = html.escape(r["name"])
    if not r["ok"]:
        last = [x for x in (r.get("log") or []) if isinstance(x, dict)]
        why = (last[-1].get("error") or ", ".join(last[-1].get("hard") or [])) if last else str((r.get("log") or ["?"])[-1])
        rows.append(f"<tr><td><img src='{c}'><div class=cap>{cap}</div></td><td class=empty>Argon: 무효 그림 (검사 {r['attempts']}회 실패)<br><small>{html.escape(str(why))[:140]}</small></td><td class=empty>-</td><td class=empty>-</td></tr>"); continue
    ap = x4(r["png"], f"argon-{cid}")
    op_cell, pv = "<td class=empty>같은 종류 없음</td>", ""
    if r["opus"]:
        o = x4(POOL / "beodeul_city" / f"{r['opus']}.png", f"opus-{r['opus']}")
        op_cell = f"<td><img src='{o}'><div class=cap>{html.escape(r['opus'])}<br>{absline(J.get(f'absopus|' + r['opus']))}</div></td>"
        w, why = pairv(cid)
        pv = ("<b class=win>Argon 승</b>" if w == 1 else "<b class=lose>Opus 승</b>" if w == -1 else "<b>무</b> (두 순서 엇갈림)" if w == 0 else "판정 전") + f"<br><small>{html.escape(why)[:180]}</small>"
    a = J.get(f"abs|{cid}")
    rows.append(f"<tr><td><img src='{c}'><div class=cap>{cap}</div></td><td><img src='{ap}'><div class=cap>{r['size']} · 검사 {r['attempts']}회째 통과<br>{absline(a)}<br><small>{html.escape((a or {}).get('why') or '')[:160]}</small></div></td>{op_cell}<td>{pv}</td></tr>")
page = f"""<!doctype html><meta charset=utf-8><title>그림에서 오브젝트 뽑아 Argon 도트</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px;max-width:1200px}}h1{{font-size:20px;margin:0 0 6px}}.v{{font-size:16px;color:#ffd866;margin:8px 0}}
table{{border-collapse:collapse}}.sum td,.sum th{{border:1px solid #444;padding:4px 10px}}.grid{{width:100%;margin-top:14px}}.grid th{{text-align:left;padding:4px 6px;border-bottom:1px solid #444}}
.grid td{{vertical-align:top;padding:8px 6px;border-bottom:1px solid #2c2c36;width:25%}}.grid img{{image-rendering:pixelated;display:block;max-width:100%}}.cap{{font-size:12px;color:#aaa;margin-top:4px}}
.empty{{color:#999;font-size:13px}}.win{{color:#8f8}}.lose{{color:#f88}}a{{color:#9cf}}</style>
<h1>던전 그림에서 오브젝트를 잘라 → Argon 이 칩셋 도트로 그리기</h1>
<p class=v>{html.escape(verdict)}</p>
<table class=sum>
<tr><th></th><th>Argon (이번)</th><th>Opus object-gen (기존, 같은 종류 {len(B)}개)</th></tr>
<tr><td>유효하게 그린 수</td><td>{ok}/{len(d)} (object-gen 기계 검사 통과, 최대 3회)</td><td>{len(B)}개 모두 (검토·선택까지 거친 것)</td></tr>
<tr><td>잘라낸 그림과 닮았나</td><td>{fmt3(cnt(A, 'reads'))}</td><td>{fmt3(cnt(B, 'reads'))}</td></tr>
<tr><td>칩셋 화풍에 맞나</td><td>{fmt3(cnt(A, 'style'))}</td><td>{fmt3(cnt(B, 'style'))}</td></tr>
<tr><td>3/4 시점</td><td>{fmt3(cnt(A, 'view34'))}</td><td>{fmt3(cnt(B, 'view34'))}</td></tr>
<tr><td>그대로 쓸 만한가</td><td>{fmt3(cnt(A, 'quality'))}</td><td>{fmt3(cnt(B, 'quality'))}</td></tr>
<tr><td>맞대결 (같은 종류 {len(W)}쌍)</td><td colspan=2>Argon {W.count(1)}승 · 무 {W.count(0)} · Opus {W.count(-1)}승</td></tr></table>
<p class=cap>그림: gemini-3.1-flash-image (8318 의 Argon 은 그림을 못 만든다). 오브젝트 찾기·잘라낼 상자: Argon. 도트: Argon (gemini-4-argon-high) 이 object-gen 의 그리기 지시서·칩셋 견본·팔레트를 받고 칸 문자 격자로 직접 찍음, 잘라낸 그림은 모양 참고로만. 판정: Opus 5.5 medium (맞대결은 A/B 순서를 바꿔 두 번, 엇갈리면 무). Opus 쪽은 후보 둘 중 검토·선택을 거친 것이고, Argon 은 후보 하나다.</p>
<table class=grid><tr><th>잘라낸 그림</th><th>Argon 도트 (4배)</th><th>Opus object-gen (4배)</th><th>맞대결</th></tr>
{''.join(rows)}</table>
<p class=cap>앞선 실험(던전 배치를 그림에서 옮기기): <a href="argon-image-dungeon-layout.html">argon-image-dungeon-layout.html</a> — 그림을 봐도 Argon 배치는 나아지지 않았다.</p>"""
open(VIZ / "argon-image-dungeon.html", "w").write(page)
print("ok", ok, len(d), cnt(A, "quality"), cnt(B, "quality"), W.count(1), W.count(0), W.count(-1))
