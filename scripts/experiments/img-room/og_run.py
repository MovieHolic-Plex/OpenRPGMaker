#!/usr/bin/env python3
"""조건 O 2단계: missing.json 의 물건마다 object-gen(~/object-gen) 한 판 — 손 도트 실내 칩셋(v5) 팔레트 잠금, 후보 A/B,
블라인드 판정·다시 그리기·Opus 고르기(object-gen 기본 단계 그대로). 고른 그림만 <prep>/objects/<slug>.png(+json).
  python3 og_run.py <prep dir> <pieces.txt> [workers=6]      (repo 루트에서)
실험 전용: 번들·공용 DB·스토어에 넣지 않는다(object-gate 미통과)."""
import json, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

PREP = Path(sys.argv[1]).resolve(); IDS = Path(sys.argv[2]); WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 6
OG = Path.home() / "object-gen"; T = 16
spec = json.load(open("src/assets/handInteriorSpec.json"))
chip = Image.open("public/assets/atlas-interior/interior-chipset.png").convert("RGBA"); C = chip.width // T

def tile(i): return chip.crop(((i % C) * T, (i // C) * T, (i % C) * T + T, (i // C) * T + T))
def obj_img(o):
    xs = [c[0] for c in o["cells"]]; ys = [c[1] for c in o["cells"]]; x0, y0 = min(xs), min(ys)
    im = Image.new("RGBA", ((max(xs) - x0 + 1) * T, (max(ys) - y0 + 1) * T), (0, 0, 0, 0))
    for dx, dy, idx, _ in sorted(o["cells"], key=lambda c: c[3]): im.alpha_composite(tile(idx), ((dx - x0) * T, (dy - y0) * T))
    return im

def sheet() -> Path:
    """이 방 조각들을 16px 시트 한 장으로(이름표·격자 없음): object-gen 이 팔레트를 잠그고 화풍을 읽는다."""
    ims = [obj_img(spec["objects"][n]) for n in IDS.read_text().split() if n in spec["objects"] and spec["objects"][n]["cells"]]
    W, x, y, rowh, pos = 512, 0, 0, 0, []
    for im in ims:
        if x + im.width > W: x, y, rowh = 0, y + rowh, 0
        pos.append((x, y)); x += im.width; rowh = max(rowh, im.height)
    H = y + rowh; out = Image.new("RGBA", (W, H + (-H) % T), (0, 0, 0, 0))
    for im, p in zip(ims, pos): out.alpha_composite(im, p)
    f = PREP / "og" / "_sheet.png"; f.parent.mkdir(parents=True, exist_ok=True); out.save(f); return f

RULES = ("This object belongs to the 16 px hand-pixel interior chipset of a fantasy RPG (the attached tileset sheet); its colours are locked to that "
         "set and it must sit among the set's other pieces as the same craft. Indoor furniture / room prop, 3/4 top-down view: a large lit top plane, "
         "a short front, no side faces. Scale: a person is 1x2 cells, a chair 1 cell, a table top waist-high.")

def og(*args, timeout=5400) -> dict:
    env = dict(os.environ); env["PYTHONPATH"] = str(OG) + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    env.setdefault("OBJECTGEN_CLAUDE_ARGS", "--effort medium"); env.setdefault("OBJECTGEN_DRAW_CLAUDE_ARGS", "--effort medium")
    r = subprocess.run([sys.executable, "-m", "objectgen", *args], capture_output=True, text=True, env=env, timeout=timeout)
    out = r.stdout.strip()
    try: return json.loads(out[out.index("{"):]) if "{" in out else {"error": (r.stderr or out)[-800:]}
    except ValueError: return {"error": (r.stderr or out)[-800:]}

def one(o: dict, sh: Path) -> dict:
    slug = re.sub(r"[^a-z0-9]+", "-", o["name"]).strip("-"); jd = PREP / "og" / slug; t0 = time.time()
    rules = PREP / "og" / "_rules.txt"; rules.write_text(RULES)
    if not (jd / "job.json").exists():
        r = og("new", str(jd), "--brief", f"{o['brief']} - for a {PREP.name} room", "--name", o["name"], "--tileset", str(sh),
               "--size", f"{o['w']}x{o['h']}", "--anchor", o["anchor"], "--kind", o["kind"], "--candidates", "AB", "--rules", f"@{rules}")
        if r.get("error"): return {**o, "slug": slug, "error": r["error"][-400:]}
    r = og("run", str(jd), "--n-refs", "0", "--rules", f"@{rules}")
    pk = jd / "pick.json"
    if not pk.exists(): return {**o, "slug": slug, "picked": None, "error": (r.get("error") or str(r.get("log", ""))[-300:]), "s": round(time.time() - t0)}
    p = json.loads(pk.read_text()); L = p.get("letter")
    if not L: return {**o, "slug": slug, "picked": None, "reason": p.get("reason"), "s": round(time.time() - t0)}
    st = json.loads((jd / "candidates" / L / "state.json").read_text()); png = jd / "candidates" / L / f"attempt-{st['attempt']}.png"
    if st.get("pixelSha256") != p.get("pixelSha256") or not png.exists():
        return {**o, "slug": slug, "picked": L, "error": "pick does not match the candidate's current picture"}
    (PREP / "objects").mkdir(exist_ok=True); shutil.copy(png, PREP / "objects" / f"{slug}.png")
    rec = {**o, "slug": slug, "picked": L, "by": p.get("by"), "reason": p.get("reason"), "pixelSha256": p.get("pixelSha256"), "job": str(jd), "s": round(time.time() - t0)}
    (PREP / "objects" / f"{slug}.json").write_text(json.dumps(rec, indent=1, ensure_ascii=False))
    return rec

if __name__ == "__main__":
    miss = json.loads((PREP / "missing.json").read_text())["objects"]
    sh = sheet()
    with ThreadPoolExecutor(WORKERS) as ex: res = list(ex.map(lambda o: one(o, sh), miss))
    (PREP / "OBJECTS.json").write_text(json.dumps({"objects": len(miss), "picked": sum(1 for r in res if r.get("picked")), "results": res}, indent=1, ensure_ascii=False))
    print(json.dumps({"objects": len(miss), "picked": sum(1 for r in res if r.get("picked"))}))
