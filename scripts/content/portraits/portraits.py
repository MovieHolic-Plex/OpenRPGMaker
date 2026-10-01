#!/usr/bin/env python3
"""76종 공용 얼굴 → 흉상/전신 기본 + 표정 4종 일괄 생성 (Tibo / MDC 이미지 API).
재개 가능: 이미 있는 출력은 건너뛴다.  사용: portraits.py [--only slug,slug] [--workers 10]
출력: out/<slug>/{bust,full}-{base,happy,sad,angry,surprised}.png   로그: run.log.jsonl
"""
import base64, io, json, os, sys, threading, time, urllib.request, queue, argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / ".omo/asset-gen-tmp/portraits"  # 생성 원본·로그(무시 폴더). 저장소에는 finalize.py 결과만 넣는다
FACES = ROOT / "public/assets/shared/faceset"
STYLE = ROOT / "public/assets/generated/faces/actor1-bust.png"
OUT = WORK / "out"
API = os.environ.get("MDC_IMAGE_API", "http://100.73.251.77:8091") + "/v1/generate/json"
EMO_CELL = {"happy": 2, "surprised": 4, "angry": 9, "sad": 10}
MAG = (255, 0, 255)

PROMPT_BUST = " ".join([
  "The reference image has two panels. LEFT panel: the house-style example of a finished pixel-art dialogue bust portrait (tight head-and-shoulders close-up, slight three-quarter turn, thick dark outline, chunky visible pixels, flat cel colors with a few shade steps). RIGHT panel: a small face portrait of the character to draw (its top edge may cut off hats or hair).",
  "Draw the character from the RIGHT panel as a NEW bust portrait in EXACTLY the same style, framing, scale, pixel size and composition as the LEFT panel: a large tight head-and-shoulders close-up filling the square canvas, face big and readable, slight three-quarter turn, shoulders and collar running off the bottom edge.",
  "Keep this character's hair, face, species (it may be a human or an animal-like person; keep any non-human features exactly), colors and outfit from the right panel. Do NOT copy the left character's hair, face or clothes.",
  "Output a single square image of only the new portrait, not the multi-panel layout. Background: every non-subject pixel one flat uniform pure magenta #FF00FF. No text, no frame, no extra characters.",
])
PROMPT_BUST_CHIP = " ".join([
  "The reference image has three panels. LEFT panel: the house-style example of a finished pixel-art dialogue bust portrait (tight head-and-shoulders close-up, slight three-quarter turn, thick dark outline, chunky visible pixels, flat cel colors with a few shade steps). MIDDLE panel: a small face portrait of the character to draw (its top edge may cut off hats or hair). RIGHT panel: the SAME character's tiny walking sprite seen from the front and from the side.",
  "The walking sprite is the GROUND TRUTH for the headwear shape (for example a pointed witch hat versus a flat cap versus a headband versus a hood), hair length and style, clothing, colors and footwear. The face portrait is the ground truth for the facial features and expression. When they disagree about headwear or clothing, follow the sprite.",
  "Draw this character as a NEW bust portrait in EXACTLY the same style, framing, scale, pixel size and composition as the LEFT panel: a large tight head-and-shoulders close-up filling the square canvas, face big and readable, slight three-quarter turn, shoulders and collar running off the bottom edge. Show the complete headwear if the character wears any. Keep the species exactly (human, animal or monster) and never invent animal ears, horns or accessories that the sprite and face do not show. Do NOT copy the left character's looks.",
  "Output a single square image of only the new portrait, not the multi-panel layout. Background: every non-subject pixel one flat uniform pure magenta #FF00FF. No text, no frame, no extra characters.",
])
PROMPT_FULL = " ".join([
  "The reference image has two panels. LEFT panel: a finished pixel-art bust portrait of a character. RIGHT panel: that character's small face portrait.",
  "Draw this SAME character as a tall VERTICAL standing figure for a JRPG dialogue window, in the SAME pixel art style, outline weight and pixel size as the left panel. Portrait orientation, aspect about 9:16. Show the whole character from the top of the head down to the knees, relaxed upright pose, facing the viewer with a slight three-quarter turn, arms natural and fully inside the canvas, nothing held. Keep hair, face, species (keep any non-human features exactly), colors and outfit from the panels; invent the clothing below the chest consistently with the visible outfit. Leave a small margin above the head and beside the body.",
  "Output a single image of only the character, not the multi-panel layout. Background: every non-subject pixel one flat uniform pure magenta #FF00FF. No text, no frame, no extra characters, no shadow.",
])
PROMPT_FULL_CHIP = " ".join([
  "The reference image has three panels. LEFT panel: a finished pixel-art bust portrait of a character. MIDDLE panel: that character's small face portrait. RIGHT panel: the SAME character's tiny walking sprite seen from the front and from the side.",
  "Draw this SAME character as a tall VERTICAL standing figure for a JRPG dialogue window, in the SAME pixel art style, outline weight and pixel size as the left panel. Portrait orientation, aspect about 9:16. Show the whole character from the top of the head down to the knees, relaxed upright pose, facing the viewer with a slight three-quarter turn, arms natural and fully inside the canvas, nothing held.",
  "The walking sprite is the GROUND TRUTH for the full outfit: headwear shape, clothing, trousers or skirt, colors, footwear and body proportions. The bust and face are the ground truth for the face. Keep the species exactly (an animal or monster stays an animal or monster, drawn in a natural upright standing pose). Never invent animal ears, horns or accessories that the sprite does not show. Leave a small margin above the head and beside the body.",
  "Output a single image of only the character, not the multi-panel layout. Background: every non-subject pixel one flat uniform pure magenta #FF00FF. No text, no frame, no extra characters, no shadow.",
])
# 칩(걷기 스프라이트)이 정답이다. 얼굴만 보고 적은 설명(BRIEF)은 틀려서 버렸다(2026-10-01: 마법사 모자를 챙 모자로 적었다).
GENERIC = "If the small face crop cuts off the top of the head, complete it as ordinary headwear or hair; never invent animal ears, horns or extra accessories unless the character is clearly an animal or monster."
def brief(slug):
  return " " + GENERIC

EMO_TEXT = {
  "happy": "a bright happy smile, joyful",
  "surprised": "a surprised expression, wide eyes, raised brows, mouth open",
  "angry": "an angry expression, lowered furrowed brows, glaring, scowling",
  "sad": "a clearly sad, tearful expression, brows drawn together, downcast",
}
def prompt_emo(kind, emo):
  sub = "bust portrait" if kind == "bust" else "full-length standing figure"
  keep = "same head angle, pose, framing, scale" if kind == "bust" else "same pose, same outfit down to the trousers and shoes, same framing, scale and tall portrait canvas composition (small body language such as clenched fists or a raised hand is allowed to match the emotion)"
  return " ".join([
    f"The reference image has two panels. LEFT panel: a finished pixel-art {sub} of a character. RIGHT panel: a small face portrait of the SAME character showing the target expression ({EMO_TEXT[emo]}).",
    f"Redraw EXACTLY the left character with the expression shown in the right panel. Keep identical to the left panel: same hair, outfit, colors, species and non-human features, {keep}, chunky pixel size, thick dark outline, flat cel shading and the flat magenta #FF00FF background. Change only the facial expression.",
    "Output a single image of only the character, not the two-panel layout. No text, no frame.",
  ])

def b64(im):
  b = io.BytesIO(); im.save(b, "PNG"); return base64.b64encode(b.getvalue()).decode()
def face_panel(slug, idx, size=512):
  im = Image.open(FACES / slug / f"{idx:02d}.png").convert("RGBA")
  bg = Image.new("RGBA", (size, size), MAG + (255,))
  s = (size // 48) * 48
  up = im.resize((s, s), Image.NEAREST); bg.alpha_composite(up, ((size - s) // 2, (size - s) // 2))
  return bg.convert("RGB")
def raw_panel(path, size=512, h=None):
  im = Image.open(path).convert("RGBA")
  bg = Image.new("RGBA", im.size, MAG + (255,)); bg.alpha_composite(im)
  im = bg.convert("RGB")
  if h: im = im.resize((int(im.width * h / im.height), h), Image.LANCZOS)
  else: im = im.resize((size, size), Image.LANCZOS)
  return im
CHARSETS = ROOT / "public/assets/easyrpg/charset"
def chip_map():
  m = {k: (v["chs"], v["idx"]) for k, v in json.load(open(Path(__file__).parent / "charset-map.json")).items() if v["chs"]}
  animals = ["dog", "cat", "rooster", "sheep", "cow", "horse", "tiger", "lion"]
  for i, a in enumerate(animals): m[f"people2-{a}-expressions"] = ("Animal", i)
  mons = ["slime", "red-demon", "pig", "ghost", "skeleton", "green-scar", "hood-skeleton", "beast", "green-hair", "white-dragon", "white-hair", "red-helm"]
  for i, a in enumerate(mons): m[f"monster-{a}-expressions"] = ("Monster1", i) if i < 8 else ("Monster2", i - 8)
  m["people1-nun-expressions"] = ("People2", 1); m["people1-bald-man-expressions"] = ("People2", 2); m["people1-purple-woman-expressions"] = ("People2", 3)
  # People1 얼굴 13~15 ↔ People2 칩 5~7 (src/assets/sharedCharacterGraphics.json 검토 대응과 같다).
  # 8(검은 머리)·12(검은 웨이브)는 짝 칩이 없다: People2 0 중절모 신사는 People2 얼굴 06, 4 닌자 소녀는 생성 얼굴이 짝이다.
  m["people1-blonde-wave-expressions"] = ("People2", 5); m["people1-red-woman-expressions"] = ("People2", 6); m["people1-mint-woman-expressions"] = ("People2", 7)
  return m
CHIPS = chip_map()
def chip_panel(slug, h=512, scale=14):
  sheet, idx = CHIPS[slug]
  im = Image.open(CHARSETS / f"{sheet}.png").convert("RGBA"); bx = (idx % 4) * 72; by = (idx // 4) * 128
  frames = []
  for row in (2, 1):  # RM2000 칩 행 순서: 0=위(뒷모습) 1=오른쪽 2=아래(앞모습) 3=왼쪽
    fr = im.crop((bx + 24, by + row * 32, bx + 48, by + row * 32 + 32))
    px = fr.load()
    for yy in range(fr.height):
      for xx in range(fr.width):
        if px[xx, yy][:3] == (0, 147, 146): px[xx, yy] = (0, 0, 0, 0)  # 시트의 투명색 키
    fr = fr.resize((24 * scale, 32 * scale), Image.NEAREST)
    bg = Image.new("RGBA", fr.size, (222, 222, 222, 255)); bg.alpha_composite(fr); frames.append(bg.convert("RGB"))
  c = Image.new("RGB", (frames[0].width * 2 + 8, h), (222, 222, 222))
  c.paste(frames[0], (0, (h - frames[0].height) // 2)); c.paste(frames[1], (frames[0].width + 8, (h - frames[1].height) // 2)); return c
def hstack3(a, b, c):
  return hstack(hstack(a, b), c)
def hstack(a, b):
  h = max(a.height, b.height)
  c = Image.new("RGB", (a.width + b.width + 8, h), (255, 255, 255))
  c.paste(a, (0, 0)); c.paste(b, (a.width + 8, 0)); return c

def call(prompt, ref, size):
  body = json.dumps({"prompt": prompt, "reference_b64": b64(ref), "fallback": True, "priority": 0, "size": size, "return_base64": True}).encode()
  req = urllib.request.Request(API, body, {"Content-Type": "application/json"})
  with urllib.request.urlopen(req, timeout=1200) as r: j = json.load(r)
  if not j.get("ok") or not j.get("image_b64"): raise RuntimeError(json.dumps(j)[:200])
  return Image.open(io.BytesIO(base64.b64decode(j["image_b64"]))), j.get("engine"), j.get("fallback_used"), j.get("duration_sec")

def jobs_for(slug):
  d = OUT / slug
  J = {}
  chip = slug in CHIPS
  J[("bust", "base")] = dict(deps=[], out=d / "bust-base.png", size="1024x1024",
      ref=(lambda: hstack3(raw_panel(STYLE), face_panel(slug, 0), chip_panel(slug))) if chip else (lambda: hstack(raw_panel(STYLE), face_panel(slug, 0))),
      prompt=(PROMPT_BUST_CHIP if chip else PROMPT_BUST) + brief(slug))
  J[("full", "base")] = dict(deps=[("bust", "base")], out=d / "full-base.png", size="1024x1536",
      ref=(lambda: hstack3(raw_panel(d / "bust-base.png"), face_panel(slug, 0), chip_panel(slug))) if chip else (lambda: hstack(raw_panel(d / "bust-base.png"), face_panel(slug, 0))),
      prompt=(PROMPT_FULL_CHIP if chip else PROMPT_FULL) + brief(slug))
  for kind in ("bust", "full"):
    for emo, cell in EMO_CELL.items():
      J[(kind, emo)] = dict(deps=[(kind, "base")], out=d / f"{kind}-{emo}.png", size="1024x1024" if kind == "bust" else "1024x1536",
          ref=(lambda kind=kind, cell=cell: hstack(raw_panel(d / f"{kind}-base.png", h=512), face_panel(slug, cell))), prompt=prompt_emo(kind, emo) + brief(slug))
  return J

def main():
  ap = argparse.ArgumentParser(); ap.add_argument("--only", default=""); ap.add_argument("--workers", type=int, default=10); ap.add_argument("--retries", type=int, default=4)
  a = ap.parse_args()
  slugs = sorted(p.name for p in FACES.iterdir() if p.is_dir() and p.name.endswith("-expressions") and (p / "15.png").exists())
  if a.only: slugs = [s for s in slugs if s in a.only.split(",")]
  OUT.mkdir(exist_ok=True)
  all_jobs = {}
  for s in slugs:
    (OUT / s).mkdir(exist_ok=True)
    for k, j in jobs_for(s).items(): all_jobs[(s,) + k] = j
  todo = {k: j for k, j in all_jobs.items() if not j["out"].exists()}
  print(f"slugs={len(slugs)} total={len(all_jobs)} todo={len(todo)}", flush=True)
  q = queue.Queue(); lock = threading.Lock(); inflight = set(); failed = {}; done = 0
  def ready(k):
    return all((k[0],) + dep in all_jobs and (all_jobs[(k[0],) + dep]["out"].exists()) for dep in todo[k]["deps"])
  pending = set(todo)
  def pump():
    for k in sorted(pending, key=lambda k: (k[1:] != ("bust", "base"), k)):
      if k not in inflight and ready(k): inflight.add(k); pending.discard(k); q.put(k)
  def worker():
    nonlocal done
    while True:
      k = q.get()
      if k is None: return
      j = todo[k]; ok = False
      for attempt in range(a.retries):
        t0 = time.time()
        try:
          im, eng, fb, sec = call(j["prompt"], j["ref"](), j["size"])
          ratio = im.height / im.width
          if j["size"] == "1024x1024" and not (0.88 <= ratio <= 1.14): raise RuntimeError(f"bad aspect {im.size} for bust")
          if j["size"] != "1024x1024" and not (1.35 <= ratio <= 2.0): raise RuntimeError(f"bad aspect {im.size} for full")
          tmp = j["out"].with_suffix(".tmp.png"); im.save(tmp); tmp.replace(j["out"]); ok = True
          rec = dict(k="/".join(k), engine=eng, fallback=fb, sec=sec, size=im.size, attempt=attempt)
          break
        except Exception as e:
          rec = dict(k="/".join(k), error=str(e)[:200], attempt=attempt); time.sleep(5 * (attempt + 1))
      with lock:
        inflight.discard(k)
        if ok: done += 1
        else: failed[k] = rec
        open(WORK / "run.log.jsonl", "a").write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"[{done}/{len(todo)}] {'/'.join(k)} {'ok' if ok else 'FAIL'}", flush=True)
        pump()
        if not pending and not inflight:
          for _ in range(a.workers): q.put(None)
  with lock: pump()
  ts = [threading.Thread(target=worker) for _ in range(a.workers)]
  [t.start() for t in ts]; [t.join() for t in ts]
  print(f"done={done} failed={len(failed)} unreached={len(pending)}", flush=True)
  for k, r in failed.items(): print("FAILED", k, r)
main()
