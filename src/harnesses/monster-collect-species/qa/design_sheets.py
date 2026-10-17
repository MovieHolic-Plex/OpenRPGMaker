#!/usr/bin/env python3
"""몬스터 종 디자인 점검·후보 시트 생성기 (자체완결 HTML, 그림은 data URI).

  python3 design_sheets.py audit  <out.html> [--bundle <dir>] [--git-ref <ref>]   현재 번들 그림의 디자인 점검표
  python3 design_sheets.py pick   <out.html>                                       재작업 후보·고른 근거 시트 (design-v2-picks.json)

실루엣 대비: 그림을 알파 마스크로만 만들어(검정 단색) 긴 변 60px 로 맞춰 64px 캔버스에 놓고, 종끼리 겹침(IoU)이 높으면 구별이 어렵다.
IoU 0.6 이상 = 윤곽이 닮음(△), 0.8 이상 = 사실상 같은 실루엣(×). 숫자는 눈 판정을 대체하지 않는다 — 점검표의 ○△× 는 눈으로 본 판정이다.
"""
import base64, io, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
BUNDLE = ROOT / "public/assets/harnesses/monster-collect-species"
DATA = ROOT / "harness-data/monster-collect-species"


def uri(img: Image.Image) -> str:
    b = io.BytesIO(); img.save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


def load_png(path_or_bytes) -> Image.Image:
    return Image.open(path_or_bytes if not isinstance(path_or_bytes, bytes) else io.BytesIO(path_or_bytes)).convert("RGBA")


def git_bytes(ref: str, rel: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(ROOT), "show", f"{ref}:{rel}"])


def mask64(im: Image.Image) -> np.ndarray:
    a = im.split()[3].point(lambda v: 255 if v >= 128 else 0)
    bb = a.getbbox()
    a = a.crop(bb)
    w, h = a.size
    sc = 60 / max(w, h)
    a = a.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.NEAREST)
    c = Image.new("L", (64, 64), 0)
    c.paste(a, ((64 - a.size[0]) // 2, (64 - a.size[1]) // 2))
    return np.array(c) > 0


def iou(a, b) -> float:
    return float((a & b).sum() / (a | b).sum())


def mask_img(m: np.ndarray, scale=1) -> Image.Image:
    arr = np.zeros((64, 64, 4), dtype=np.uint8)
    arr[m] = (0, 0, 0, 255)
    im = Image.fromarray(arr, "RGBA")
    return im.resize((64 * scale, 64 * scale), Image.NEAREST) if scale != 1 else im


CSS = """body{margin:0;background:#14161c;color:#e4e7ee;font:14px/1.5 system-ui,'Noto Sans KR',sans-serif;padding:16px 20px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px}p.s{color:#9aa3b5;margin:2px 0 10px;max-width:1100px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #2a2f3b;padding:6px 8px;vertical-align:top;text-align:left}
th{color:#9aa3b5;font-weight:600;font-size:12px;position:sticky;top:0;background:#14161c}
img{image-rendering:pixelated;display:block}.art{background:#d6e4cd;padding:4px}.sil{background:#e8eef2;padding:4px}
.o{color:#6fdc8c;font-weight:700}.t{color:#f2c14e;font-weight:700}.x{color:#ff6b6b;font-weight:700}.m{color:#9aa3b5;font-size:12px}
.strip{display:flex;flex-wrap:wrap;gap:6px}.strip figure{margin:0;text-align:center;font-size:11px;color:#9aa3b5}
.cands{display:flex;flex-wrap:wrap;gap:8px}.cand{background:#1c2029;padding:6px;border:2px solid transparent}.cand.pick{border-color:#6fdc8c}
.cand .row{display:flex;gap:6px;align-items:flex-end}.tag{font-size:12px}.why{color:#c9d2e3;max-width:700px;margin:4px 0}
.sum span{display:inline-block;margin-right:18px}"""


def mark(v: str) -> str:
    cls = {"○": "o", "△": "t", "×": "x"}[v]
    return f'<span class="{cls}">{v}</span>'


def audit(out: str, ref: str | None, bundle: Path, ratings_path: Path):
    ratings = json.loads(ratings_path.read_text())
    order = list(ratings.keys())
    seed = {s["id"]: s for s in json.loads((DATA / "seed.json").read_text())["species"]}

    def get(sid, side):
        if ref:
            return load_png(git_bytes(ref, f"public/assets/harnesses/monster-collect-species/{sid}/{side}.png"))
        return load_png(bundle / sid / f"{side}.png")

    fronts = {s: get(s, "front") for s in order}
    backs = {s: get(s, "back") for s in order}
    masks = {s: mask64(fronts[s]) for s in order}
    nn = {}
    for s in order:
        sims = sorted(((iou(masks[s], masks[o]), o) for o in order if o != s), reverse=True)
        nn[s] = sims[0]
    counts = {k: {"○": 0, "△": 0, "×": 0} for k in ("sig", "cute", "sil")}
    for s in order:
        r = ratings[s]
        for k in counts: counts[k][r[k][0]] += 1
    sums = "".join(f'<span><b>{label}</b> {mark("○")}{counts[k]["○"]} {mark("△")}{counts[k]["△"]} {mark("×")}{counts[k]["×"]}</span>'
                   for k, label in (("sig", "시그니처"), ("cute", "귀여움·위압감"), ("sil", "실루엣 구별")))
    strip = "".join(f'<figure><div class="sil"><img src="{uri(mask_img(masks[s]))}" width="64" height="64"></div>{s}</figure>' for s in order)
    rows = []
    for s in order:
        r = ratings[s]
        sp = seed[s]
        stage = f'{sp["stage"]}단계' + (f' ← {sp["evolvesFrom"]}' if sp.get("evolvesFrom") else "")
        rows.append(f"""<tr><td><b>{s}</b><div class="m">{sp["name"]} · {stage}</div></td>
<td><div class="art"><img src="{uri(fronts[s])}" width="112" height="112"></div><div class="m">원본 112</div></td>
<td><div class="art"><img src="{uri(fronts[s])}" width="224" height="224"></div><div class="m">2배</div></td>
<td><div class="art"><img src="{uri(backs[s])}" width="112" height="112"></div><div class="m">뒷모습 112</div></td>
<td><div class="sil"><img src="{uri(mask_img(masks[s]))}" width="64" height="64"></div><div class="m">가장 닮음 {nn[s][1]} IoU {nn[s][0]:.2f}</div></td>
<td>{mark(r["sig"][0])} {r["sig"][1:]}</td><td>{mark(r["cute"][0])} {r["cute"][1:]}</td><td>{mark(r["sil"][0])} {r["sil"][1:]}</td></tr>""")
    html = f"""<!doctype html><meta charset="utf-8"><title>몬스터 디자인 점검 1</title><style>{CSS}</style>
<h1>몬스터 15종 디자인 점검{' (' + ref + ' 기준 그림)' if ref else ''}</h1>
<p class="s">외부 시험자 지적: 「귀엽지 않다 / 강해 보이지만 특징이 없다 / 어딘가 특출나게 강조된 곳이 있어야 한다」. 현재 번들 15종(스타터 3 + 캠페인 12)을 같은 기준으로 봤다.
○ 충분 · △ 약함 · × 없음. 1단계는 귀여움 비례(머리 40~50%, 큰 눈, 짧고 통통한 몸), 진화형은 위압감.</p>
<div class="sum">{sums}</div>
<h2>실루엣 대비 — 그림을 검정 단색 마스크로 만들어 64px 로 본 것</h2>
<p class="s">긴 변을 60px 로 맞춘 같은 규격. 도마뱀형(sparkit·zaptoe·kilnclaw)과 두더지·멧돼지·딱정벌레(gritnose·rootpig·pipbug)가 비슷한 덩어리로 보이는지 확인한다. leafling 과 frondhare 는 같은 윤곽이다.</p>
<div class="strip">{strip}</div>
<h2>종별 점검</h2>
<table><tr><th>종</th><th>앞모습</th><th>앞모습 2배</th><th>뒷모습</th><th>실루엣 64px</th><th>시그니처(과장된 한 부위)</th><th>귀여움 비례 / 위압감</th><th>64px 실루엣 구별</th></tr>{''.join(rows)}</table>"""
    Path(out).write_text(html)
    print("wrote", out, counts)


def pick(out: str):
    picks = json.loads((DATA / "design-v2-picks.json").read_text())
    seed = {s["id"]: s for s in json.loads((DATA / "seed.json").read_text())["species"]}
    chosen = {}
    blocks = []
    for sid, entry in picks["species"].items():
        for side in ("front", "back"):
            e = entry.get(side)
            if not e: continue
            run_dir = ROOT / "qa-runs/harnesses/monster-collect-species" / sid / side / e["run"]
            record = json.loads((run_dir / "run.json").read_text()) if (run_dir / "run.json").exists() else {"candidates": []}
            cells = []
            for c in record["candidates"]:
                im = load_png(run_dir / c["sprite"])
                if im.size != (64, 64):  # 112 캔버스로 만든 옛 후보는 현재 64 캔버스 규격으로 다시 맞춘 것을 쓴다(refit)
                    pass
                m = mask64(im)
                is_pick = c["k"] == e["candidate"]
                cells.append(f'<div class="cand{" pick" if is_pick else ""}"><div class="art"><img src="{uri(im)}" width="{im.width * (256 // im.width)}" height="{im.height * (256 // im.width)}"></div>'
                             f'<div class="row"><div class="sil"><img src="{uri(mask_img(m))}" width="64" height="64"></div><span class="tag">{c["k"]}{" · 선택" if is_pick else ""}</span></div></div>')
                if is_pick and side == "front": chosen[sid] = m
            before = e.get("before")
            before_html = ""
            if before:
                bim = load_png(git_bytes(before, f"public/assets/harnesses/monster-collect-species/{sid}/{side}.png"))
                before_html = f'<div class="cand"><div class="art"><img src="{uri(bim)}" width="{bim.width * (256 // bim.width)}" height="{bim.height * (256 // bim.width)}"></div><span class="tag">이전(재작업 전, {bim.width}px 캔버스)</span></div>'
            keep = "기존 유지 — 새 후보가 분명히 더 낫지 않았다" if e.get("keep") else ""
            blocks.append(f'<h2>{sid} · {seed[sid]["name"]} · {"앞모습" if side == "front" else "뒷모습"} <span class="m">run {e["run"]}</span></h2>'
                          f'<p class="s">시그니처: {seed[sid]["signature"]}</p><div class="cands">{before_html}{"".join(cells)}</div>'
                          f'<p class="why"><b>선택 근거</b> {e["reason"]} {keep}</p>')
    strip = "".join(f'<figure><div class="sil"><img src="{uri(mask_img(m))}" width="64" height="64"></div>{sid}</figure>' for sid, m in chosen.items())
    sims = []
    ids = list(chosen)
    for s in ids:
        o, v = max(((o, iou(chosen[s], chosen[o])) for o in ids if o != s), key=lambda t: t[1])
        sims.append(f"{s}↔{o} {v:.2f}")
    html = f"""<!doctype html><meta charset="utf-8"><title>몬스터 디자인 후보 2</title><style>{CSS}</style>
<h1>몬스터 재디자인 후보·선택 근거</h1>
<p class="s">기준: ① 시그니처 한 부위 과장 ② 1단계 chibi 비례(머리 40~50%, 큰 눈) ③ 진화 시 시그니처 확대·형태 변화, 최종형 위압감 ④ 검정 마스크 64px 실루엣 구별 ⑤ 몸 색 3~4개 + 포인트 1개 · 윤곽.
각 후보의 오른쪽 아래 검은 그림이 64px 실루엣이다. 초록 테두리가 고른 후보.</p>
<h2>고른 앞모습 64px 실루엣 대비</h2><div class="strip">{strip}</div><p class="m">가장 닮은 짝: {' · '.join(sims)}</p>
{''.join(blocks)}"""
    Path(out).write_text(html)
    print("wrote", out)


if __name__ == "__main__":
    mode, out = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    ref = args[args.index("--git-ref") + 1] if "--git-ref" in args else None
    bundle = Path(args[args.index("--bundle") + 1]) if "--bundle" in args else BUNDLE
    if mode == "audit":
        audit(out, ref, bundle, DATA / "design-audit-1.json")
    elif mode == "pick":
        pick(out)
