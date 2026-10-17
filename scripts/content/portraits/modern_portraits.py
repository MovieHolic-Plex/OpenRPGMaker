#!/usr/bin/env python3
"""현대 연애 칩(Modern1~3) → 흉상·전신 초상 (2026-10-16).

기존 portraits2.py 는 「48px 얼굴 + 걷기 칩」을 참조로 쓴다. 현대 칩에는 얼굴 그림이 없으므로
**칩(걷기 스프라이트)이 정답**이고 얼굴은 같은 화풍으로 새로 그린다. 한 장에 전신+흉상을 같이 그린다(옷·얼굴이 어긋나지 않게).
후보를 N장 뽑고(cand-k), 감독이 독립 판정자로 1등을 골라 `pick.json` 에 적으면 표정 시트가 그 후보를 기본으로 이어 그린다.

  python3 modern_portraits.py base  --cands 4 [--only stem,...]      # 기본 시트 후보
  python3 modern_portraits.py blind                                   # 눈가림 비교 시트(후보 순서 섞음) → blind/<stem>.png, blind/key.json
  python3 modern_portraits.py emo   --cands 2 [--only stem,...]       # pick.json 의 기본에서 표정 시트 후보
  python3 modern_portraits.py split                                   # 선택된 시트 → full-/bust- 정리용 원본

작업 폴더: .omo/asset-gen-tmp/portraits/modern/<stem>/ (무시 폴더). 이미 있는 파일은 건너뛴다(재개 가능).
이미지 API 는 이 박스의 이미지 서버(MDC_IMAGE_API, 기본 http://mdc-server:8091). 키·토큰 없음.
"""
from __future__ import annotations

import argparse, json, os, re, queue, random, sys, threading, time
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.setdefault("MDC_IMAGE_API", "http://mdc-server:8091")
import portraits2 as P2  # noqa: E402  (portraits.py 를 exec 로 끌어온다)

ROOT = HERE.parents[2]
WORK = P2.WORK / "modern"
CHARSETS = ROOT / "public/assets/generated/charsets"
MAG = (255, 0, 255)

# 줄기 = modern-<archetype> (OPRN 이름 규칙). sheet/index 는 src/assets/modernCharsets.json 의 칸 번호(덧붙이기 전용).
ROSTER = [
    dict(stem="modern-uni-boy-navy", sheet=1, index=0, who="a male high-school / university student", heads=7.5,
         look="short dark-brown hair, navy blazer over a white shirt, red necktie, grey trousers, black shoes"),
    dict(stem="modern-uni-boy-sidetail", sheet=1, index=3, who="a male student", heads=7.5,
         look="black hair tied into a long side ponytail resting over one shoulder, navy blazer over a white shirt, grey trousers"),
    dict(stem="modern-uni-girl-navy", sheet=1, index=4, who="a female high-school / university student", heads=7.5,
         look="dark-brown wavy shoulder-length hair, navy blazer, red ribbon bow, navy pleated skirt, white socks, black shoes"),
    dict(stem="modern-uni-girl-sailor", sheet=1, index=5, who="a female high-school student", heads=7.5,
         look="black hair, white sailor-style top with navy collar and a red scarf, navy skirt"),
    dict(stem="modern-uni-girl-twintail", sheet=1, index=6, who="a female high-school student", heads=7.5,
         look="reddish-brown twin-tail hair in two high bunches, navy blazer, red ribbon, navy skirt"),
    dict(stem="modern-casual-boy-hoodie", sheet=2, index=2, who="a young man in weekend clothes", heads=7.5,
         look="brown hair, grey hoodie with drawstrings, black jogger pants, white sneakers"),
    dict(stem="modern-casual-girl-mint", sheet=2, index=4, who="a young woman in a casual dress", heads=7.5,
         look="honey-coloured wavy hair, mint-green one-piece dress"),
    dict(stem="modern-suit-boy-navy", sheet=3, index=0, who="an adult male office worker", heads=8,
         look="dark short hair, navy suit jacket, white shirt with a blue necktie, matching trousers, black dress shoes"),
    dict(stem="modern-suit-girl-navy", sheet=3, index=2, who="an adult female office worker", heads=8,
         look="dark-brown hair, navy suit jacket and slacks, white collar"),
    dict(stem="modern-apron-brown", sheet=3, index=3, who="a young woman working at a cafe", heads=7.5,
         look="chestnut-brown hair in an updo bun, white shirt with rolled sleeves, dark-brown apron, dark long skirt"),
    dict(stem="modern-teacher-tweed", sheet=3, index=6, who="an adult male teacher / young professor", heads=8,
         look="dark-brown hair, brown tweed jacket, cream shirt collar, wine-red necktie, dark grey trousers, brown shoes"),
    dict(stem="modern-teacher-cardigan", sheet=3, index=7, who="an adult female teacher", heads=8,
         look="brown bob haircut, cream blouse collar, burgundy cardigan, dark grey trousers"),
    # --- 2차(2026-10-17): 나머지 12종. 설명은 칩 PNG 를 직접 보고 쓴 것이다 ---
    dict(stem="modern-uni-boy-grey", sheet=1, index=1, who="a male high-school / university student", heads=7.5,
         look="short brown hair with a fringe, grey blazer over a white shirt, dark-green necktie, black trousers, black shoes"),
    dict(stem="modern-uni-boy-summer", sheet=1, index=2, who="a male student in summer uniform", heads=7.5,
         look="light chestnut-brown tousled hair, white short-sleeved shirt under a beige knitted vest, green necktie, grey trousers"),
    dict(stem="modern-uni-girl-bun", sheet=1, index=7, who="a female high-school / university student", heads=7.5,
         look="black-brown hair gathered in a high bun on top of the head, beige cardigan over a white collar, red ribbon bow, dark skirt, dark-blue socks"),
    dict(stem="modern-uni-girl-long", sheet=2, index=0, who="a female high-school / university student", heads=7.5,
         look="long brown hair past the shoulders, grey blazer, burgundy ribbon, dark-grey skirt"),
    dict(stem="modern-casual-boy-mustard", sheet=2, index=1, who="a young man in weekend clothes", heads=7.5,
         look="light-brown messy hair, mustard-yellow sweatshirt, dark-blue jeans, white sneakers"),
    dict(stem="modern-casual-boy-olive", sheet=2, index=3, who="a young man in weekend clothes", heads=7.5,
         look="black hair with a headband-like dark band and a side ponytail hanging down at the back, olive-green jacket over a white tee, beige chino trousers, brown shoes"),
    dict(stem="modern-casual-girl-pink", sheet=2, index=5, who="a young woman in casual clothes", heads=7.5,
         look="brown hair in two round buns on both sides of the head, pink hoodie, blue denim skirt, white sneakers"),
    dict(stem="modern-casual-girl-lavender", sheet=2, index=6, who="a young woman in casual clothes", heads=7.5,
         look="long brown hair, lavender blouse, cream-coloured long skirt, brown shoes"),
    dict(stem="modern-casual-girl-stripe", sheet=2, index=7, who="a young woman in casual clothes", heads=7.5,
         look="black hair in a high bun, white and navy horizontally striped tee, dark navy bottoms"),
    dict(stem="modern-suit-boy-charcoal", sheet=3, index=1, who="an adult male office worker", heads=8,
         look="black hair with a short ponytail tied at the back, charcoal suit jacket, white shirt line at the collar, black necktie, black trousers"),
    dict(stem="modern-apron-navy", sheet=3, index=4, who="a young woman working at a cafe", heads=7.5,
         look="black hair in an updo bun, white shirt with rolled sleeves, dark-navy apron with a brown pocket, dark long skirt"),
    dict(stem="modern-apron-olive", sheet=3, index=5, who="a young woman working at a cafe", heads=7.5,
         look="reddish-brown hair in an updo bun, white shirt with rolled sleeves, olive-green apron with a brown pocket, dark long skirt"),
]
BY_STEM = {r["stem"]: r for r in ROSTER}

# 첫 단계 표정(기본 + 4). 얼굴 16칸 이름과 같다(sharedPortraitAssets.ts). 대사 emotion 자동 전환은 happy/sad/angry/surprised 만이므로
# 이 세트는 angry 없이 base·happy·surprised·sad·embarrassed 5표정이다(angry·나머지는 2단계).
EMOTIONS = ["happy", "surprised", "sad", "embarrassed"]
EMO_TEXT = P2.EMO_TEXT


def chip_panel(sheet: int, index: int, h: int = 512, scale: int = 14) -> Image.Image:
    im = Image.open(CHARSETS / f"Modern{sheet}.png").convert("RGBA")
    bx, by = (index % 4) * 72, (index // 4) * 128
    frames = []
    for row in (2, 1):  # 2=아래(앞모습) 1=오른쪽. 현대 칩은 RGBA 라 투명색 키가 필요 없다
        fr = im.crop((bx + 24, by + row * 32, bx + 48, by + row * 32 + 32)).resize((24 * scale, 32 * scale), Image.NEAREST)
        bg = Image.new("RGBA", fr.size, (222, 222, 222, 255)); bg.alpha_composite(fr); frames.append(bg.convert("RGB"))
    c = Image.new("RGB", (frames[0].width * 2 + 8, h), (222, 222, 222))
    c.paste(frames[0], (0, (h - frames[0].height) // 2)); c.paste(frames[1], (frames[0].width + 8, (h - frames[1].height) // 2))
    return c


def base_ref(r: dict) -> Image.Image:
    im = P2.hstack(P2.raw_panel(P2.STYLE), chip_panel(r["sheet"], r["index"]))
    return P2.hstack(im, P2.mannequin_panel(r["heads"]))


def prompt_base(r: dict) -> str:
    n = r["heads"]
    head = ("The reference image has 3 panels. LEFT panel: the house-style example of a finished pixel-art dialogue bust portrait (use it for STYLE only: thick dark outline, chunky visible pixels, flat cel shading, slight three-quarter turn; do NOT copy that character's looks or face); "
            "middle panel: the character's tiny walking sprite seen from the front and from the side - the GROUND TRUTH for hair colour and style, clothing, colours and footwear (ignore only its tiny chibi proportions); "
            f"RIGHT panel: a gray PROPORTION GUIDE mannequin divided into numbered bands, each band exactly one head tall - the full-length figure must be exactly {n} heads tall like this mannequin (copy ONLY its proportions, never its look, lines or numbers).")
    who = (f"The character is {r['who']}, in a modern-day romance visual-novel. Outfit and hair as seen on the sprite: {r['look']}. "
           "The sprite has no readable face, so invent a friendly, attractive, natural anime-style face fitting the character, with a clear readable pair of eyes, small nose and mouth - not creepy, no exaggerated features, no heavy makeup.")
    full = (f"LEFT: the full-length figure from the top of the head to the feet, relaxed upright pose, facing the viewer with a slight three-quarter turn, arms natural and fully inside the canvas, hands empty and simple, nothing held. "
            f"Build: a slender person exactly {n} head-heights tall in total - a small head on a long body, NOT chibi, NOT big-headed, NOT super-deformed. Measured landmarks: the chin sits at 1/{n} of the figure's height from the top, and the legs (crotch to soles) are HALF of the total height. The full figure fills almost the whole canvas height.")
    sheet = (f"Draw ONE character design sheet: a landscape image on a flat uniform pure magenta #FF00FF background containing the SAME character twice, side by side, with a wide empty magenta gap between the two drawings (they must not overlap or touch, and the right drawing must not touch the canvas edge except at the bottom). {full} "
             "RIGHT: a large head-and-shoulders bust close-up of the same character in the house style of the style reference: tight crop, face big and readable, slight three-quarter turn, shoulders and collar running off the bottom edge. "
             "Both drawings must show identical face, hair, clothing and colours, with the same pixel size and outline weight. Do not add hats, glasses, bags, badges or accessories that the sprite does not show. No text, no frames, no guide lines, no extra characters, no shadow.")
    return head + " " + who + " " + sheet


def prompt_emo(emo: str) -> str:
    return (f"The reference image shows a finished pixel-art character design sheet: one character as a full-length standing figure (left) and a large bust close-up (right), on a flat magenta background. "
            f"Redraw the ENTIRE sheet exactly the same - same layout, same two drawings, same poses, hair, outfit, proportions, colours, pixel size, outline, flat magenta #FF00FF background and wide magenta gap between the drawings - changing only the facial expression to {EMO_TEXT[emo]}, in BOTH the full-length figure and the bust. "
            "Keep the same face identity (same eyes, nose, skin colour, hair). The full figure keeps the same silhouette, size and clothing; arms stay natural and inside the canvas. Output only the new sheet. No text.")


def split_ok(path: Path):
    return P2.split_sheet(path)


def call_with_retry(prompt, ref, tries=4):
    last = None
    for a in range(tries):
        try:
            im, eng, fb, sec = P2.call(prompt, ref, "1536x1024")
            if im.width / im.height < 1.15:
                raise RuntimeError(f"bad sheet aspect {im.size}")
            return im, dict(engine=eng, fallback=fb, sec=sec, attempt=a)
        except Exception as e:  # noqa: BLE001
            last = e; time.sleep(5 * (a + 1) if "429" not in str(e) else 60 * (2 ** a))
    raise RuntimeError(str(last)[:200])


def run_jobs(jobs, workers):
    q = queue.Queue(); lock = threading.Lock(); done = [0]; fail = []
    for j in jobs: q.put(j)
    def worker():
        while True:
            try: j = q.get_nowait()
            except queue.Empty: return
            try:
                im, meta = call_with_retry(j["prompt"], j["ref"]())
                tmp = j["out"].with_suffix(".tmp.png"); im.save(tmp)
                parts = split_ok(tmp)
                if parts is None:
                    tmp.unlink(); raise RuntimeError("sheet did not split into 2 drawings")
                tmp.replace(j["out"]); parts[0].save(j["out"].with_name(j["out"].stem.replace("sheet-", "full-") + ".png")); parts[1].save(j["out"].with_name(j["out"].stem.replace("sheet-", "bust-") + ".png"))
                ok = True; rec = dict(k=j["key"], **meta)
            except Exception as e:  # noqa: BLE001
                ok = False; rec = dict(k=j["key"], error=str(e)[:200])
            with lock:
                done[0] += ok
                if not ok: fail.append(rec)
                (WORK / "run.log.jsonl").open("a").write(json.dumps(rec, ensure_ascii=False) + "\n")
                print(f"[{done[0]}/{len(jobs)}] {j['key']} {'ok' if ok else 'FAIL ' + rec['error']}", flush=True)
    ts = [threading.Thread(target=worker) for _ in range(workers)]
    [t.start() for t in ts]; [t.join() for t in ts]
    print(f"done={done[0]} failed={len(fail)}", flush=True)
    for f in fail: print("FAILED", f)


def selected(args):
    return [r for r in ROSTER if not args.only or r["stem"] in args.only.split(",")]


def cmd_base(args):
    WORK.mkdir(parents=True, exist_ok=True); jobs = []
    for r in selected(args):
        d = WORK / r["stem"]; d.mkdir(exist_ok=True)
        for k in range(args.cands):
            out = d / f"sheet-cand{k}.png"
            if out.with_name(f"full-cand{k}.png").exists(): continue
            jobs.append(dict(key=f"{r['stem']}/cand{k}", out=out, prompt=prompt_base(r), ref=lambda r=r: base_ref(r)))
    print(f"jobs={len(jobs)}", flush=True); run_jobs(jobs, args.workers)


def load_pick():
    p = WORK / "pick.json"
    return json.loads(p.read_text()) if p.exists() else {}


def cmd_emo(args):
    pick = load_pick(); jobs = []
    for r in selected(args):
        if r["stem"] not in pick: print("no pick for", r["stem"]); continue
        d = WORK / r["stem"]; base = d / f"sheet-{pick[r['stem']]}.png"
        for emo in EMOTIONS:
            for k in range(args.cands):
                out = d / f"sheet-{emo}-cand{k}.png"
                if out.with_name(f"full-{emo}-cand{k}.png").exists(): continue
                jobs.append(dict(key=f"{r['stem']}/{emo}-cand{k}", out=out, prompt=prompt_emo(emo), ref=lambda base=base: P2.raw_panel(base, h=768)))
    print(f"jobs={len(jobs)}", flush=True); run_jobs(jobs, args.workers)


def contact(items, labels, ref=None, h=480, cols=3):
    """후보 시트를 격자로(눈가림 라벨 A,B,C…). ref(칩 패널)는 첫 칸에 「REF」로 붙는다."""
    from PIL import ImageDraw
    tiles = []
    if ref is not None:
        r = ref.resize((int(ref.width * h / ref.height), h), Image.LANCZOS); d = ImageDraw.Draw(r); d.rectangle([0, 0, 90, 26], fill=(0, 0, 0)); d.text((8, 6), "REF (walk chip)", fill=(0, 255, 255)); tiles.append(r)
    for im, lb in zip(items, labels):
        bg = Image.new("RGB", im.size, (60, 64, 76)); bg.paste(im, mask=im.split()[3]); bg = bg.resize((int(bg.width * h / bg.height), h), Image.LANCZOS)
        d = ImageDraw.Draw(bg); d.rectangle([0, 0, 34, 26], fill=(0, 0, 0)); d.text((8, 6), lb, fill=(255, 255, 0)); tiles.append(bg)
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    W = max(sum(t.width for t in row) + 8 * (len(row) - 1) for row in rows); c = Image.new("RGB", (W, (h + 8) * len(rows)), (20, 20, 24))
    for ri, row in enumerate(rows):
        x = 0
        for t in row: c.paste(t, (x, ri * (h + 8))); x += t.width + 8
    return c


def sheet_rgba(path: Path) -> Image.Image:
    """시트 → 분홍 배경을 투명으로(눈가림 시트용)."""
    im = Image.open(path).convert("RGBA"); a = np.array(im)
    bg = (a[..., 0] > 225) & (a[..., 1] < 70) & (a[..., 2] > 225); a[bg] = (0, 0, 0, 0); return Image.fromarray(a, "RGBA")


def cmd_blind(args):
    out = WORK / "blind"; out.mkdir(exist_ok=True); key = {}
    rng = random.Random(20261016)
    for r in selected(args):
        d = WORK / r["stem"]
        tag = args.tag
        rx = re.compile(r"^sheet-" + re.escape(tag) + r"cand\d+\.png$")
        cands = sorted(p for p in d.iterdir() if rx.match(p.name))
        if not cands: continue
        order = list(range(len(cands))); rng.shuffle(order)
        letters = "ABCDEFGH"[: len(cands)]
        sheet = contact([sheet_rgba(cands[i]) for i in order], list(letters), ref=chip_panel(r['sheet'], r['index'], h=480, scale=12))
        name = f"{r['stem']}{('-' + tag.rstrip('-')) if tag else ''}"
        sheet.save(out / f"{name}.png"); key[name] = {letters[j]: cands[order[j]].stem.replace("sheet-", "") for j in range(len(cands))}
    kp = out / "key.json"; old = json.loads(kp.read_text()) if kp.exists() else {}; old.update(key); kp.write_text(json.dumps(old, ensure_ascii=False, indent=1))
    print("blind sheets:", len(key))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["base", "blind", "emo", "emoblind"]); ap.add_argument("--only", default=""); ap.add_argument("--cands", type=int, default=4)
    ap.add_argument("--workers", type=int, default=8); ap.add_argument("--tag", default="", help="blind: 표정 접두(예: happy-)")
    a = ap.parse_args()
    {"base": cmd_base, "emo": cmd_emo, "blind": cmd_blind, "emoblind": cmd_emoblind}[a.cmd](a)



def cmd_emoblind(args):
    """표정 눈가림 시트: 줄기마다 한 장, 표정 줄마다 [BASE(선택된 기본) | A | B] (A/B 순서는 섞는다). key → blind/emo-key.json"""
    from PIL import ImageDraw
    pick = load_pick(); out = WORK / "blind"; out.mkdir(exist_ok=True); key = {}; rng = random.Random(20261017)
    for r in selected(args):
        d = WORK / r["stem"]; rows = []; key[r["stem"]] = {}
        base = sheet_rgba(d / f"sheet-{pick[r['stem']]}.png")
        for emo in EMOTIONS:
            cands = [d / f"sheet-{emo}-cand{k}.png" for k in range(args.cands)]
            order = list(range(len(cands))); rng.shuffle(order)
            letters = "AB"[: len(cands)]
            key[r["stem"]][emo] = {letters[j]: f"cand{order[j]}" for j in range(len(cands))}
            row = contact([base] + [sheet_rgba(cands[i]) for i in order], ["BASE"] + list(letters), h=330, cols=3)
            d2 = ImageDraw.Draw(row); d2.rectangle([row.width - 200, 0, row.width, 22], fill=(0, 0, 0)); d2.text((row.width - 196, 5), f"expression: {emo}", fill=(0, 255, 0)); rows.append(row)
        W = max(x.width for x in rows); sheet = Image.new("RGB", (W, sum(x.height + 6 for x in rows)), (10, 10, 12)); y = 0
        for x in rows: sheet.paste(x, (0, y)); y += x.height + 6
        sheet.save(out / f"emo-{r['stem']}.png")
    (out / "emo-key.json").write_text(json.dumps(key, ensure_ascii=False, indent=1)); print("emo blind sheets", len(key))


if __name__ == "__main__":
    main()
