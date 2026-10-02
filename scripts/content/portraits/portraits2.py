import os
#!/usr/bin/env python3
"""v2: 얼굴+칩 → 한 장의 캐릭터 시트(전신 + 흉상)를 한 호출로. 표정은 시트를 통째로 편집. 등신 고정.
사용: portraits2.py [--only slug,...] [--workers 12] [--phase base|all]   출력: out2/<slug>/sheet-*.png, full-*.png, bust-*.png"""
import argparse, json, queue, sys, threading, time
from pathlib import Path
import numpy as np
from PIL import Image
here = Path(__file__).parent
src = (here / "portraits.py").read_text().replace("\nmain()\n", "\n")
ns = {"__file__": str(here / "portraits.py")}; exec(compile(src, "portraits.py", "exec"), ns)
call, b64, hstack, hstack3, face_panel, raw_panel, chip_panel = (ns[k] for k in ("call", "b64", "hstack", "hstack3", "face_panel", "raw_panel", "chip_panel"))
STYLE, FACES, CHIPS, EMO_CELL, EMO_TEXT, GENERIC = (ns[k] for k in ("STYLE", "FACES", "CHIPS", "EMO_CELL", "EMO_TEXT", "GENERIC"))
WORK = ns["WORK"]
OUT = WORK / ("out3" if "--out3" in sys.argv else "out2")

# 인물별 비례(머리 높이 N개 = 전체 키). 칩의 SD 비율은 무시한다. 기본 8등신.
KIDS = {"people1-boy": 6, "people1-girl": 6}
ELDERS = {"people1-old-man": 7.5, "people1-old-woman": 7, "people2-white-elder": 7.5}
STOCKY = {"people1-bald-man": 7, "monster-red-demon": 7.5, "monster-pig": 6.5, "monster-beast": 7.5}
# 사람꼴이 아닌 것: 칩의 몸 구조 그대로, 자연스러운 자세. 마네킹 없음.
NATURAL = {
  "people2-dog": "a real dog (not anthropomorphic), sitting upright on its haunches in three-quarter front view",
  "people2-cat": "a real cat (not anthropomorphic), sitting upright in three-quarter front view",
  "people2-rooster": "a real rooster (not anthropomorphic) standing on its two legs in three-quarter view",
  "people2-sheep": "a real sheep (not anthropomorphic) standing on four legs in three-quarter front view",
  "people2-cow": "a real cow (not anthropomorphic) standing on four legs in three-quarter front view",
  "people2-horse": "a real horse (not anthropomorphic) standing on four legs in three-quarter front view",
  "people2-tiger": "a real tiger (not anthropomorphic) sitting upright on its haunches in three-quarter front view",
  "people2-lion": "a real lion (not anthropomorphic) sitting upright on its haunches in three-quarter front view",
  "monster-slime": "a slime blob with no limbs, a low rounded mound as in the sprite",
  "monster-ghost": "a floating sheet-like ghost with no legs, as in the sprite",
  "monster-white-dragon": "a dragon with the body plan shown in the sprite, in a natural pose in three-quarter front view",
}
def heads(slug):
  st = slug.replace("-expressions", "")
  if st in NATURAL: return None
  return KIDS.get(st) or ELDERS.get(st) or STOCKY.get(st) or 8
def body(slug):
  st = slug.replace("-expressions", "")
  if st in NATURAL: return NATURAL[st]
  if st in KIDS: return "a child"
  if st in ELDERS: return "an elderly person, slightly stooped"
  if st in STOCKY: return "a stocky, heavyset build"
  return "a slender adult"

def mannequin_panel(n, h=512):
  """머리 높이 칸이 매겨진 회색 마네킹. 비례만 전달한다."""
  from PIL import ImageDraw
  W = int(h * 0.62); im = Image.new("RGB", (W, h), (236, 236, 236)); d = ImageDraw.Draw(im)
  top, Hf = 14, h - 28; u = Hf / n; cx = W // 2
  for k in range(int(n) + 1):
    y = top + k * u; d.line([(4, y), (W - 4, y)], fill=(170, 170, 200), width=1); d.text((6, y + 2), str(k + 1) if k < n else "", fill=(120, 120, 160))
  g = (150, 150, 150); sw = 0.21 * Hf; hw = 0.34 * u
  d.ellipse([cx - hw, top, cx + hw, top + u], fill=g)
  d.rectangle([cx - 0.11 * u, top + u * 0.92, cx + 0.11 * u, top + u * 1.18], fill=g)
  sh = top + u * 1.18; crotch = top + Hf * 0.5; aw = 0.024 * Hf; gap = 0.012 * Hf
  d.polygon([(cx - sw / 2, sh), (cx + sw / 2, sh), (cx + sw * 0.36, crotch), (cx - sw * 0.36, crotch)], fill=g)
  for sgn in (-1, 1):
    x0 = cx + sgn * (sw / 2 + gap); x1 = x0 + sgn * 2 * aw
    d.polygon([(x0, sh + 3), (x1, sh + 3), (x1 + sgn * 0.01 * Hf, top + Hf * 0.52), (x0 + sgn * 0.01 * Hf, top + Hf * 0.52)], fill=g)
    lx0 = cx + sgn * 0.012 * Hf; lx1 = cx + sgn * sw * 0.36
    d.polygon([(lx0, crotch - 2), (lx1, crotch - 2), (cx + sgn * sw * 0.26, top + Hf - 4), (cx + sgn * 0.03 * Hf, top + Hf - 4)], fill=g)
  return im

NOINVENT = ("The walking sprite shows the true look of the top of the head (bald, hat, horns, hair) and of the body: if it shows bare skin, draw bare skin; "
            "do NOT add hair, clothing (vests, jackets, capes), accessories, ears or horns that the sprite and face do not show, and do not remove ones they do show.")
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "head_notes.py")).read())
def prompt_base(slug, chip):
  n = heads(slug)
  panels = ["LEFT panel: the house-style example of a finished pixel-art dialogue bust portrait (use it for STYLE only: thick dark outline, chunky visible pixels, flat cel shading, slight three-quarter turn; do NOT copy that character's looks)",
            "next panel: a small face portrait of the character (its top edge may cut off the top of the head)"]
  if chip: panels.append("next panel: the SAME character's tiny walking sprite seen from the front and from the side - the GROUND TRUTH for headwear, hair, body plan, clothing, colors and footwear (ignore only its tiny chibi proportions)")
  if n: panels.append(f"RIGHT panel: a gray PROPORTION GUIDE mannequin divided into numbered bands, each band exactly one head tall - the full-length figure must be exactly {n} heads tall like this mannequin (copy ONLY its proportions, never its look, lines or numbers)")
  head = f"The reference image has {len(panels)} panels. " + "; ".join(panels) + "."
  full = (f"LEFT: the full-length figure from the top of the head to the feet, relaxed upright pose, facing the viewer with a slight three-quarter turn, arms natural and fully inside the canvas, nothing held. Build: {body(slug)}, exactly {n} head-heights tall in total - a small head on a long body, NOT chibi, NOT big-headed, NOT super-deformed even if the character is a child or elderly. Measured landmarks: the chin sits at 1/{n} of the figure's height from the top, and the legs (crotch to soles) are HALF of the total height. The full figure fills almost the whole canvas height."
          if n else f"LEFT: the whole body: {body(slug)}, filling most of the canvas height, nothing held.")
  sheet = (f"Draw ONE character design sheet: a landscape image on a flat uniform pure magenta #FF00FF background containing the SAME character twice, side by side, with a wide empty magenta gap between the two drawings (they must not overlap or touch, and the right drawing must not touch the canvas edge except at the bottom). {full} "
           "RIGHT: a large head-and-shoulders bust close-up of the same character in the house style of the style reference: tight crop, face big and readable, slight three-quarter turn, shoulders and collar running off the bottom edge. "
           "Do not drop anything the face portrait or sprite shows: goggles, headbands, hats, hoods, masks, earrings, scars stay in BOTH drawings in the same place. Keep the exact facial features of the face portrait in both drawings (same number and shape of eyes, nose, mouth, skin color). Both drawings must show identical face, species, headwear, hair, clothing and colors, with the same pixel size and outline weight. No text, no frames, no guide lines, no extra characters, no shadow.")
  key = slug.removesuffix("-expressions"); top = HEAD.get(key)
  crown = ("The face portrait is a close crop that cuts off the top of the head - never infer baldness, a receding hairline or a missing hat from it; take hair volume and headwear from the sprite." + (f" Top of the head: {top}." if top else ""))
  return head + " " + sheet + " " + crown + " " + (NOINVENT if chip else "Never invent animal ears, horns or accessories the face does not show.")
def prompt_emo(slug, emo):
  t = _prompt_emo(slug, emo)
  if heads(slug) is None:  # 사람 아닌 몸: 몸짓 허용 문구가 일어서기·팔다리를 부른다
    t = t.replace("(small body language such as clenched fists or a raised hand is allowed in the full figure)", "(the full figure keeps EXACTLY the same silhouette, size and pose as before - only the face changes)")
  return t
def _prompt_emo(slug, emo):
  return (f"The reference image has two panels. LEFT panel: a finished pixel-art character design sheet showing one character as a full-length standing figure (left) and a large bust close-up (right). RIGHT panel: a small face portrait of the SAME character showing the target expression ({EMO_TEXT[emo]}). "
          "Redraw the ENTIRE sheet exactly the same - same layout, same two drawings, same poses, outfit, proportions, colors, pixel size, outline, flat magenta #FF00FF background and wide magenta gap between the drawings - changing only the facial expression to match the right panel, in BOTH the full-length figure and the bust (small body language such as clenched fists or a raised hand is allowed in the full figure). "
          "Do not change the body or species in any way: never add or remove legs, arms, horns, ears, wings or hair, and never make a blob or animal stand up like a person. Output only the new sheet, not the two-panel layout. No text.")

def split_sheet(path):
  """시트 → (전신, 흉상) RGBA. 두 덩이가 아니면 None."""
  im = Image.open(path).convert("RGBA"); a = np.array(im)
  bg = (a[..., 3] < 20) | ((a[..., 0] > 225) & (a[..., 1] < 70) & (a[..., 2] > 225))
  fg = ~bg; cols = fg.sum(axis=0) >= 3
  runs, i, W = [], 0, len(cols)
  while i < W:
    if cols[i]:
      j = i
      while j < W and cols[j]: j += 1
      runs.append([i, j]); i = j
    else: i += 1
  merged = []
  for r in runs:  # 가까운 덩이(<3% 폭)는 한 덩이로
    if merged and r[0] - merged[-1][1] < W * 0.03: merged[-1][1] = r[1]
    else: merged.append(r)
  big = [r for r in merged if fg[:, r[0]:r[1]].sum() > fg.sum() * 0.08]
  if len(big) != 2: return None
  outs = []
  for x0, x1 in big:
    sub = fg[:, x0:x1]; ys = np.where(sub.any(axis=1))[0]; y0, y1 = ys[0], ys[-1] + 1
    crop = a[y0:y1, x0:x1].copy(); m = bg[y0:y1, x0:x1]; crop[m] = (0, 0, 0, 0)
    outs.append(Image.fromarray(crop, "RGBA"))
  # 프롬프트가 왼쪽=전신, 오른쪽=흉상으로 지시한다. 가로 순서로 정한다(가로로 긴 동물 전신 때문에 비율로 고르면 뒤바뀐다).
  return outs[0], outs[1]

def base_ref(s, chip):
  im = hstack(raw_panel(STYLE), face_panel(s, 0))
  if chip: im = hstack(im, chip_panel(s))
  if heads(s): im = hstack(im, mannequin_panel(heads(s)))
  return im

def main():
  ap = argparse.ArgumentParser(); ap.add_argument("--only", default=""); ap.add_argument("--workers", type=int, default=12); ap.add_argument("--retries", type=int, default=4); ap.add_argument("--phase", default="all"); ap.add_argument("--out3", action="store_true")
  a = ap.parse_args()
  slugs = sorted(p.name for p in FACES.iterdir() if p.is_dir() and p.name.endswith("-expressions") and (p / "15.png").exists())
  if a.only: slugs = [s for s in slugs if s in a.only.split(",")]
  OUT.mkdir(exist_ok=True); jobs = {}
  for s in slugs:
    d = OUT / s; d.mkdir(exist_ok=True); chip = s in CHIPS
    jobs[(s, "base")] = dict(deps=[], sheet=d / "sheet-base.png", tag="base",
        ref=(lambda s=s, chip=chip: base_ref(s, chip)), prompt=prompt_base(s, chip))
    if a.phase == "all":
      for emo, cell in EMO_CELL.items():
        jobs[(s, emo)] = dict(deps=[(s, "base")], sheet=d / f"sheet-{emo}.png", tag=emo,
            ref=(lambda s=s, cell=cell, d=d: hstack(raw_panel(d / "sheet-base.png", h=512).copy(), face_panel(s, cell))), prompt=prompt_emo(s, emo))
  todo = {k: j for k, j in jobs.items() if not (j["sheet"].parent / f"full-{j['tag']}.png").exists()}
  print(f"slugs={len(slugs)} jobs={len(jobs)} todo={len(todo)}", flush=True)
  q = queue.Queue(); lock = threading.Lock(); inflight = set(); pending = set(todo); failed = {}; done = 0
  def ready(k): return all(dep not in todo or (jobs[dep]["sheet"].parent / f"full-{jobs[dep]['tag']}.png").exists() for dep in todo[k]["deps"])
  def pump():
    for k in sorted(pending, key=lambda k: (k[1] != "base", k)):
      if k not in inflight and ready(k): inflight.add(k); pending.discard(k); q.put(k)
  def worker():
    nonlocal done
    while True:
      k = q.get()
      if k is None: return
      j = todo[k]; ok = False; rec = {}
      for attempt in range(a.retries):
        try:
          im, eng, fb, sec = call(j["prompt"], j["ref"](), "1536x1024")
          if im.width / im.height < 1.15: raise RuntimeError(f"bad sheet aspect {im.size}")
          tmp = j["sheet"].with_suffix(".tmp.png"); im.save(tmp)
          parts = split_sheet(tmp)
          if parts is None: tmp.unlink(); raise RuntimeError("sheet did not split into 2 drawings")
          tmp.replace(j["sheet"]); parts[0].save(j["sheet"].parent / f"full-{j['tag']}.png"); parts[1].save(j["sheet"].parent / f"bust-{j['tag']}.png"); ok = True
          rec = dict(k="/".join(k), engine=eng, fallback=fb, sec=sec, size=im.size, attempt=attempt); break
        except Exception as e:
          rec = dict(k="/".join(k), error=str(e)[:200], attempt=attempt); time.sleep(4 * (attempt + 1))
      with lock:
        inflight.discard(k)
        if ok: done += 1
        else: failed[k] = rec
        open(WORK / "run2.log.jsonl", "a").write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"[{done}/{len(todo)}] {'/'.join(k)} {'ok' if ok else 'FAIL ' + rec.get('error','')}", flush=True)
        pump()
        if not pending and not inflight:
          for _ in range(a.workers): q.put(None)
  with lock: pump()
  ts = [threading.Thread(target=worker) for _ in range(a.workers)]
  [t.start() for t in ts]; [t.join() for t in ts]
  print(f"done={done} failed={len(failed)} unreached={len(pending)}", flush=True)
  for k, r in failed.items(): print("FAILED", k, r)
if __name__ == "__main__": main()
