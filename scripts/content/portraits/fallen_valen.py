#!/usr/bin/env python3
"""폴른 스타 · 심문관 발렌 흉상·전신 — 공용 초상과 같은 경로(portraits2 의 시트 한 장 = 전신 + 흉상, 표정은 시트 편집).

공용 초상 76종은 「얼굴 칸 + 걷기 칩」이 정체였다. 발렌은 손으로 고친 전용 칩(fallenValenChip.ts)만 있고 짝 얼굴이 없다 —
그래서 얼굴 패널 대신 글로 정체를 주고, 칩 패널(앞·옆)과 화풍 패널(공용 초상과 같은 actor1-bust)·등신 마네킹은 그대로 쓴다.
표정은 얼굴 칸 대신 글(EMO_TEXT)로 편집한다. 결과는 finalize 와 같은 정리(분홍 테두리·여백·128색)를 거친다.

사용:
  python3 scripts/content/portraits/fallen_valen.py base --round r1 --n 3          # 후보 시트 n 장
  python3 scripts/content/portraits/fallen_valen.py emo --round r1 [--cands a,b]   # 후보마다 표정 4장
  python3 scripts/content/portraits/fallen_valen.py finalize --round r1 [--cands a]   # → .omo/.../fallen-valen/<round>/<후보>/{bust,full}-*.png
그다음 cast-portrait 하네스: import → check → lineup → review (openwiki/harnesses/cast-portrait.md).
"""
import argparse, base64, io, json, re, sys, threading, time
from pathlib import Path
from PIL import Image

here = Path(__file__).parent
ns = {"__file__": str(here / "portraits2.py")}
src = (here / "portraits2.py").read_text().replace('\nif __name__ == "__main__": main()', "\n")
exec(compile(src, "portraits2.py", "exec"), ns)
call, hstack, raw_panel, mannequin_panel, split_sheet = (ns[k] for k in ("call", "hstack", "raw_panel", "mannequin_panel", "split_sheet"))
STYLE, EMO_TEXT, WORK = ns["STYLE"], ns["EMO_TEXT"], ns["WORK"]
ROOT = here.parents[2]
OUT = WORK / "fallen-valen"
EXPRESSIONS = ["happy", "sad", "angry", "surprised"]

IDENTITY = ("The character is Inquisitor Valen, a stern man in his early fifties: a gaunt, lined face with high cheekbones and faint creases at the eyes and mouth, "
            "cold pale grey-blue eyes under straight dark brows, a thin closed mouth, clean-shaven, no beard and no moustache. "
            "Long straight steel-blue hair parted in the middle and falling past the shoulders, with a single thin gold circlet across the forehead (the gold band of the sprite). "
            "He wears a high-collared black armored coat with dark steel plates at the shoulders and a deep navy-blue cape over both shoulders fastened with a small silver clasp. "
            "No hat, no hood, no helmet, no jester cap. He looks severe, disciplined and tired, not friendly.")


def chip_panel(h=512, scale=14):
    s = (ROOT / "src/project/flagship/fallenValenChip.ts").read_text()
    sheet = Image.open(io.BytesIO(base64.b64decode(re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", s).group(1)))).convert("RGBA")
    frames = []
    for row in (2, 1):  # 0=위 1=오른쪽 2=아래(앞) 3=왼쪽 — 캐릭터 0번 자리
        fr = sheet.crop((24, row * 32, 48, row * 32 + 32)).resize((24 * scale, 32 * scale), Image.NEAREST)
        bg = Image.new("RGBA", fr.size, (222, 222, 222, 255)); bg.alpha_composite(fr); frames.append(bg.convert("RGB"))
    c = Image.new("RGB", (frames[0].width * 2 + 8, h), (222, 222, 222))
    for i, f in enumerate(frames):
        f = f.resize((int(f.width * h / f.height), h), Image.NEAREST); c.paste(f, (i * (f.width + 8), 0))
    return c


def base_prompt():
    n = 8
    panels = ["LEFT panel: the house-style example of a finished pixel-art dialogue bust portrait (use it for STYLE only: thick dark outline, chunky visible pixels, flat cel shading, slight three-quarter turn; do NOT copy that character's looks)",
              "next panel: the character's tiny walking sprite seen from the front and from the side - the GROUND TRUTH for hair color and length, the gold forehead band, the cape and the dark clothing colors (ignore only its tiny chibi proportions)",
              f"RIGHT panel: a gray PROPORTION GUIDE mannequin divided into numbered bands, each band exactly one head tall - the full-length figure must be exactly {n} heads tall like this mannequin (copy ONLY its proportions, never its look, lines or numbers)"]
    head = f"The reference image has {len(panels)} panels. " + "; ".join(panels) + "."
    full = (f"LEFT: the full-length figure from the top of the head to the feet, relaxed upright pose, facing the viewer with a slight three-quarter turn, arms natural and fully inside the canvas, nothing held. Build: a slender adult, exactly {n} head-heights tall in total - a small head on a long body, NOT chibi, NOT big-headed. The legs (crotch to soles) are HALF of the total height. The full figure fills almost the whole canvas height.")
    sheet = (f"Draw ONE character design sheet: a landscape image on a flat uniform pure magenta #FF00FF background containing the SAME character twice, side by side, with a wide empty magenta gap between the two drawings (they must not overlap or touch, and the right drawing must not touch the canvas edge except at the bottom). {full} "
             "RIGHT: a large head-and-shoulders bust close-up of the same character in the house style of the style reference: tight crop, face big and readable, slight three-quarter turn, shoulders and collar running off the bottom edge. "
             "Both drawings must show identical face, hair, gold circlet, clothing and colors, with the same pixel size and outline weight. Neutral cold composed expression. No text, no frames, no guide lines, no extra characters, no shadow.")
    return head + " " + IDENTITY + " " + sheet


def emo_prompt(emo):
    return ("The reference image is a finished pixel-art character design sheet showing one character as a full-length standing figure (left) and a large bust close-up (right). "
            f"Redraw the ENTIRE sheet exactly the same - same layout, same two drawings, same poses, outfit, proportions, colors, pixel size, outline, flat magenta #FF00FF background and wide magenta gap between the drawings - changing only the facial expression to {EMO_TEXT[emo]}, in BOTH the full-length figure and the bust. "
            "This is a stern middle-aged inquisitor: keep the expression restrained and in character (a happy face is a thin, faint smile; sad is weary and downcast; angry is a cold glare). "
            "Do not change the hair, the gold circlet, the clothing or the head angle. Output only the new sheet. No text.")


def run_jobs(jobs, workers=4, retries=4):
    lock = threading.Lock(); log = []
    def work(job):
        for attempt in range(retries):
            try:
                im, eng, fb, sec = call(job["prompt"], job["ref"](), "1536x1024")
                if im.width / im.height < 1.15: raise RuntimeError(f"bad sheet aspect {im.size}")
                job["sheet"].parent.mkdir(parents=True, exist_ok=True)
                tmp = job["sheet"].with_suffix(".tmp.png"); im.save(tmp)
                parts = split_sheet(tmp)
                if parts is None: tmp.unlink(); raise RuntimeError("sheet did not split into 2 drawings")
                tmp.replace(job["sheet"]); parts[0].save(job["sheet"].parent / f"full-{job['tag']}.png"); parts[1].save(job["sheet"].parent / f"bust-{job['tag']}.png")
                with lock: log.append({"job": str(job["sheet"]), "engine": eng, "fallback": fb, "sec": sec, "attempt": attempt}); print("ok", job["sheet"], flush=True)
                return
            except Exception as e:  # noqa: BLE001
                with lock: print("retry", job["sheet"], str(e)[:160], flush=True)
                time.sleep(4 * (attempt + 1))
        with lock: print("FAIL", job["sheet"], flush=True)
    threads = []
    pending = list(jobs)
    while pending or threads:
        while pending and len(threads) < workers:
            t = threading.Thread(target=work, args=(pending.pop(0),)); t.start(); threads.append(t)
        threads = [t for t in threads if t.is_alive()]; time.sleep(1)
    return log


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("phase", choices=["base", "emo", "finalize"])
    ap.add_argument("--round", required=True); ap.add_argument("--n", type=int, default=3); ap.add_argument("--cands", default=""); ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args(); rdir = OUT / a.round
    if a.phase == "base":
        ref = lambda: hstack(hstack(raw_panel(STYLE), chip_panel()), mannequin_panel(8))
        jobs = [dict(sheet=rdir / f"v{i + 1}" / "sheet-base.png", tag="base", prompt=base_prompt(), ref=ref) for i in range(a.n)
                if not (rdir / f"v{i + 1}" / "bust-base.png").exists()]
        log = run_jobs(jobs, a.workers)
    elif a.phase == "emo":
        cands = a.cands.split(",") if a.cands else sorted(p.name for p in rdir.iterdir() if (p / "sheet-base.png").exists())
        jobs = [dict(sheet=rdir / c / f"sheet-{e}.png", tag=e, prompt=emo_prompt(e), ref=(lambda c=c: raw_panel(rdir / c / "sheet-base.png", h=1024)))
                for c in cands for e in EXPRESSIONS if not (rdir / c / f"bust-{e}.png").exists()]
        log = run_jobs(jobs, a.workers)
    else:
        sys.argv = ["finalize.py"]
        fin = {"__file__": str(here / "finalize.py"), "__name__": "valen_finalize"}
        code = (here / "finalize.py").read_text().split("tot=0; n=0")[0]
        exec(compile(code, "finalize.py", "exec"), fin)
        clean, quant = fin["clean"], fin["quant"]
        cands = a.cands.split(",") if a.cands else sorted(p.name for p in rdir.iterdir() if p.is_dir())
        for c in cands:
            d = rdir / c; out = d / "final"; out.mkdir(exist_ok=True)
            for e in ["base"] + EXPRESSIONS:
                for k in ("bust", "full"):
                    p = d / f"{k}-{e}.png"
                    if p.exists(): quant(clean(Image.open(p))).save(out / f"{k}-{e}.png", optimize=True)
            (out / "provenance.json").write_text(json.dumps({"pipeline": "shared-portrait-sheet", "script": "scripts/content/portraits/fallen_valen.py",
                "style": str(STYLE.relative_to(ROOT)), "identity": "fallenValenChip.ts (front+side) + IDENTITY text", "finalize": "finalize.clean + quant(128)", "round": a.round, "candidate": c}, ensure_ascii=False, indent=1))
            print("finalized", out)
        return
    (rdir / "log.jsonl").parent.mkdir(parents=True, exist_ok=True)
    with open(rdir / "log.jsonl", "a") as f:
        for r in log: f.write(json.dumps(r) + "\n")


if __name__ == "__main__":
    main()
