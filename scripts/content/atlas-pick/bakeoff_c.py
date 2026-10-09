#!/usr/bin/env python3
"""품질 비교전 C 조 — 32px 칸, 이미지 생성(Tibo) + 도트화. 오사카식 길모퉁이 512x448 한 장면.
  python3 scripts/content/atlas-pick/bakeoff_c.py frames            # 회색 덩어리 틀 그리기 (frames/)
  python3 scripts/content/atlas-pick/bakeoff_c.py gen L 3 [round]    # Tibo 생성 (raw/)
  python3 scripts/content/atlas-pick/bakeoff_c.py check L [round]    # 후검수 + 음성 대조군
  python3 scripts/content/atlas-pick/bakeoff_c.py dot L [round]      # 통과작 도트화 (work/)
  python3 scripts/content/atlas-pick/bakeoff_c.py compose           # 땅(코드) + 부품 합성 → scene.png
방식: 모델은 「칠만」 한다. 시야각·층 높이·문 자리는 틀이 정한다. 간판 글자는 Galmuri11(코드). 땅(보도·차도·횡단보도)은 코드.
참고 그림(오사카 팩)은 눈으로만 보았고 생성 모델에 넣지 않았다."""
import base64, json, os, sys, time, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
C = os.path.join(ROOT, 'tiledata/atlas-pick/bakeoff/c-32px')
RAW, FR, WK = (os.path.join(C, d) for d in ('raw', 'frames', 'work'))
PAL = os.path.join(ROOT, 'tiledata/atlas-pick/palette/modern3.pal')
TIBO = os.environ.get('TIBO_URL', 'http://mdc-server:8091/v1/generate/json')
MAG = (255, 0, 255)
W, H = 512, 448                      # 장면 (16x14 칸, 32px)

# ── 틀 색(회색 계열: 칠할 자리를 알려 주는 표식일 뿐 최종색이 아니다) ──
G = dict(roof=(214, 214, 214), lip=(242, 242, 242), wall=(150, 150, 150), slab=(118, 118, 118), win=(96, 100, 118),
         glass=(72, 76, 90), door=(8, 8, 10), side=(88, 88, 92), sign=(190, 172, 120), obj=(176, 176, 176),
         noren=(196, 120, 120), rail=(230, 230, 230), shade=(112, 112, 116))

def rect(d, x0, y0, x1, y1, col):     # x1,y1 배타
    d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=col)

# 부품 정의: 이름 → (캔버스 w,h, K배율, 그리기 함수, 검수용 규칙)
def frame_L(d):
    """왼쪽 5층 타일 건물(앞으로 튀어나옴). 밑변 y=264, 옥상 윗면은 화면 위로 잘림."""
    rect(d, 0, 0, 288, 84, G['roof'])
    rect(d, 0, 84, 288, 92, G['lip'])                       # 슬래브 앞 lip
    rect(d, 0, 92, 288, 264, G['wall'])
    for y in (120, 152, 184, 216): rect(d, 0, y, 288, y + 4, G['slab'])
    for fy in (92, 124, 156, 188):                          # 위 4개 층 창(4칸)
        for i in range(4): rect(d, 14 + 72 * i, fy + 6, 58 + 72 * i, fy + 26, G['win'])
    rect(d, 288, 84, 304, 92, G['shade']); rect(d, 288, 92, 304, 264, G['side'])   # 오른쪽 옆면(그늘)
    rect(d, 0, 84 - 8, 288, 84, G['rail'])                  # 옥상 앞 난간(윗면 안쪽)
    # 옥상 기물
    rect(d, 28, 8, 76, 66, G['obj'])                        # 물탱크(다리 달림)
    for x in (140, 180, 220): rect(d, x, 40, x + 32, 66, G['obj'])   # 실외기 3
    # 1층 가게 (물러선다)
    rect(d, 0, 220, 176, 238, G['sign'])                    # 편의점 간판띠
    rect(d, 0, 238, 176, 262, G['glass']); rect(d, 128, 236, 156, 264, G['door'])
    rect(d, 176, 220, 288, 232, G['slab'])                  # 식당 처마
    rect(d, 176, 232, 288, 262, G['wall']); rect(d, 212, 236, 240, 264, G['door'])
    rect(d, 208, 232, 244, 250, G['noren'])                 # 노렌
    rect(d, 252, 236, 280, 256, G['glass'])
    rect(d, 0, 262, 288, 264, G['slab'])                    # 주춧돌
    rect(d, 266, 100, 282, 204, G['sign'])                  # 세로 돌출 간판

def frame_R(d):
    """오른쪽 4층 콘크리트 건물(물러서 있음). 224x240, 밑변 y=232. 오른쪽 16px 이 그늘진 옆면."""
    rect(d, 0, 0, 208, 48, G['roof']); rect(d, 0, 48, 208, 56, G['lip'])
    rect(d, 0, 40, 208, 48, G['rail'])
    rect(d, 0, 56, 208, 232, G['wall'])
    for y in (88, 120, 152): rect(d, 0, y, 208, y + 4, G['slab'])
    rect(d, 0, 184, 208, 190, G['slab'])
    for fy in (56, 92, 124, 156):
        for i in range(3): rect(d, 12 + 68 * i, fy + 8, 56 + 68 * i, fy + 26, G['win'])
    for fy in (92, 124):                                     # 2,3층 베란다 난간
        for i in range(3): rect(d, 8 + 68 * i, fy + 26, 60 + 68 * i, fy + 30, G['rail'])
    rect(d, 208, 48, 224, 56, G['shade']); rect(d, 208, 56, 224, 232, G['side'])
    rect(d, 20, 190, 100, 232, G['glass']); rect(d, 52, 196, 80, 232, G['door'])   # 로비 유리문
    rect(d, 120, 196, 188, 232, G['win'])                    # 셔터 창고
    rect(d, 0, 232, 208, 236, G['slab'])
    for x in (150, 180): rect(d, x, 14, x + 26, 40, G['obj'])   # 옥상 실외기
    rect(d, 20, 6, 60, 40, G['obj'])                         # 옥상 계단실 상자

def frame_P(d):
    """소품 시트 384x192: 상자마다 한 물건. 물건 사이는 자홍."""
    for b in P_BOXES.values(): rect(d, *b[:4], G['obj'])

P_BOXES = {  # 이름: (x0,y0,x1,y1, 설명)
 'tree1': (8, 8, 64, 88, 'street tree'), 'tree2': (72, 8, 128, 88, 'street tree'),
 'vend1': (140, 8, 172, 52, 'vending machine'), 'vend2': (180, 8, 212, 52, 'vending machine'),
 'lamp': (224, 8, 244, 84, 'street lamp'), 'tlight': (256, 8, 282, 76, 'traffic light'),
 'hero': (300, 8, 332, 56, 'hero'), 'taxi': (8, 108, 108, 152, 'taxi'), 'rail': (124, 124, 188, 144, 'guardrail'),
}

FR_DEF = {'L': (304, 272, 4, frame_L), 'R': (224, 240, 4, frame_R), 'P': (384, 192, 4, frame_P)}

def make_frame(name):
    w, h, K, fn = FR_DEF[name]
    im = Image.new('RGB', (w, h), MAG); fn(ImageDraw.Draw(im))
    big = im.resize((w * K, h * K), Image.NEAREST)
    big.save(f'{FR}/{name}-frame.png'); im.save(f'{FR}/{name}-frame1x.png')
    return im

# ── 프롬프트 ──
STYLE = ("Crisp pixel art game asset, 32px-tile top-down 3/4 JRPG city style (Japanese city street): the camera looks slightly down, "
         "roofs show as a large flat top surface, front walls face the viewer, no perspective convergence, no fisheye. "
         "Light comes from the upper left: left/top faces lighter, right faces darker; every wall has 4-5 distinct tone steps with grout lines, "
         "slab edges 4px thick with a 3px shadow beneath, windows recessed with a dark top and left inner edge and a lit sill. "
         "1px dark blue-violet outlines only where a light face meets a dark one. Muted lilac-gray shadows, warm apricot highlights, no pure black or white, "
         "no gradients, no painterly blur, no anti-aliasing.")
PROMPTS = {
 'L': ("EDIT TASK. The reference is a flat gray MASSING FRAME on a magenta #FF00FF background: it fixes exactly where each part of one building goes. "
       "PAINT it as a finished pixel-art building and keep every silhouette edge, floor line, window box and door box exactly where the frame has it. "
       "Everything magenta stays flat magenta #FF00FF (no ground, no shadow outside the building, no sky). " + STYLE +
       " The building is a 5-storey Osaka mid-rise clad in small square muted blue-gray glazed ceramic tiles with visible grout grid, seen from the front: "
       "the very light top band is the flat concrete ROOF SURFACE seen from above (cropped by the top edge, light lilac-gray concrete, faint panel joints), the whitish strip under it is the roof slab edge, "
       "the light strip just above the slab is a low metal railing along the roof front edge. "
       "On the roof: at left a cylindrical steel water tank on four legs, on the right three gray outdoor air-conditioner units in a row. "
       "The four dark-blue boxes per floor are recessed aluminium-frame windows with blue reflective glass and a lit sill; the darker bands between floors are 4px slab edges with a shadow. "
       "The dark narrow vertical strip on the right is the shaded SIDE FACE of the building (darker tone of the same tile). "
       "Ground floor, set back 8px under the slabs: on the left a convenience store with a plain blank sign band (leave the band a flat single color, NO text) above a glass storefront and one dark glass sliding door where the black box is; "
       "on the right a small restaurant with a wooden sliding door where the black box is, a red-and-white cloth noren curtain hanging in front of it, a small lattice window at far right, and a stone plinth along the bottom. "
       "The tall narrow box near the right edge of the facade is a vertical projecting shop sign board (blank, flat single color, NO text). "
       "No people, no cars, no text, no letters, no logos."),
}

PROMPTS['R'] = ("EDIT TASK. The reference is a flat gray MASSING FRAME on a magenta #FF00FF background: it fixes exactly where each part of one building goes. "
       "PAINT it as a finished pixel-art building and keep every silhouette edge, floor line, window box and door box exactly where the frame has it. "
       "Everything magenta stays flat magenta #FF00FF. " + STYLE +
       " The building is a 4-storey Japanese apartment/office block of exposed light-gray concrete with subtle formwork panel joints and faint stains, seen from the front: "
       "the light top band is the flat concrete ROOF SURFACE seen from above (cropped by the top edge) with a low parapet railing on its front edge, a small stair-head box at left and two outdoor AC units at right; "
       "the whitish strip under it is the roof slab edge. The blue boxes are recessed aluminium windows with bluish glass and a lit sill; on floors 2 and 3 a thin white metal balcony railing runs below the windows. "
       "The dark vertical strip at the right is the shaded SIDE FACE of the building (darker tone of the same concrete). "
       "Ground floor: an entrance lobby with a glass door where the black box is, and at right a roll-up metal shutter window; a stone plinth at the bottom. No people, no text, no logos.")
PROMPTS['P'] = ("EDIT TASK. The reference is a flat gray SPRITE-SHEET FRAME on a magenta #FF00FF background: each gray box marks where ONE separate game sprite goes. "
       "PAINT each box as a finished pixel-art sprite that fits inside its box, and keep everything between boxes flat magenta #FF00FF (no shadows on the ground, no ground). " + STYLE +
       " Sprites, front view with a slight downward camera: top row left to right: two different leafy Japanese street trees (round dark-green crowns with 4-tone leaf clumps, a trunk as wide as its base, small dark planter grate at the base); "
       "two Japanese drink vending machines (32px wide, one red-white, one blue-white, lit product window with rows of bottles, coin slot, tiny dark base); "
       "a tall gray metal street lamp with curved arm; a Japanese traffic light on a gray pole (horizontal signal head with three lights, red lit); "
       "a 32x48 JRPG hero character, a young person with dark hair, a white shirt and navy jacket, standing facing the viewer, feet at the bottom of the box. "
       "Bottom row: a Japanese taxi in side view (yellow-cream body with a roof lamp, dark windows, black wheels, slightly seen from above); "
       "a section of white-and-gray metal roadside guardrail with two posts. No text, no logos.")


# ---- 2라운드 프롬프트: 1라운드 「허접한 곳」 목록에서 나온 교정 ----
PROMPTS['P_r2'] = PROMPTS['P'].replace(
    "two different leafy Japanese street trees (round dark-green crowns with 4-tone leaf clumps, a trunk as wide as its base, small dark planter grate at the base)",
    "two leafy Japanese street trees, both plain GREEN zelkova-type trees (NOT pink, NOT cherry blossom, no flowers, no yellow blossoms), rounded dark-green crowns with 4-tone leaf clumps, brown trunk exactly as wide as its base standing directly on the ground, NO planter box and NO grate around the base") \
    .replace("a 32x48 JRPG hero character, a young person with dark hair, a white shirt and navy jacket, standing facing the viewer, feet at the bottom of the box. ",
    "a 32x48 JRPG hero character in normal adult-teen proportions (about 4 heads tall, NOT chibi, NOT a big head), short dark hair, white shirt and navy jacket, gray trousers, dark shoes, standing straight facing the viewer, feet at the bottom of the box. ") \
    .replace("a Japanese traffic light on a gray pole (horizontal signal head with three lights, red lit)",
    "a Japanese traffic light: ONE straight gray pole with a short horizontal arm holding a signal head with three round lights (red lit), drawn as one connected object") \
    + " IMPORTANT: paint the sprites directly on flat magenta #FF00FF; do NOT paint any gray rectangle or box behind or around a sprite, do not add planter boxes, ground patches or shadows outside the sprite."
PROMPTS['L_r2'] = PROMPTS['L'] + (" QUALITY: keep every wall surface clean and evenly toned (no speckle noise, no dirt spots), tile joints as a regular thin grid, "
    "rooftop left and right edges exactly vertical, window glass with 3 tone steps and one diagonal highlight, crisp 1px dark outline on the building silhouette.")

def load_pal(path=PAL):
    global NEON
    import re
    cols = []
    for ln in open(path, encoding='utf-8'):
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
        if m:
            for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2)):
                c = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)); cols.append(c)
                if m.group(1).startswith('neon'): NEON.add(c)
    return cols

def tibo(prompt, ref_png, out_png, model='sunburst', timeout=900):
    import requests
    body = dict(prompt=prompt, slug=os.path.basename(out_png)[:-4], return_base64=True, fallback=False, priority=10,
                reference_b64=base64.b64encode(open(ref_png, 'rb').read()).decode())
    t0 = time.time()
    r = requests.post(TIBO, json=body, timeout=timeout)
    try: j = r.json()
    except Exception: j = None
    if not j or not j.get('image_b64'):
        return False, time.time() - t0, (r.status_code, str(j)[:200])
    open(out_png, 'wb').write(base64.b64decode(j['image_b64']))
    return True, time.time() - t0, None

def cmd_gen(name, n, rnd='r1', model='sunburst'):
    from concurrent.futures import ThreadPoolExecutor
    make_frame(name)
    prompt = PROMPTS.get(name + '_' + rnd, PROMPTS[name])
    def one(i):
        out = f'{RAW}/{name}-{rnd}-{i}.png'
        ok, dt, err = tibo(prompt, f'{FR}/{name}-frame.png', out, model)
        print(name, rnd, i, 'ok' if ok else 'FAIL', '%.0fs' % dt, err or '', flush=True)
        with open(f'{C}/gen-log.jsonl', 'a') as f: f.write(json.dumps(dict(name=name, round=rnd, i=i, ok=ok, sec=round(dt), model=model, err=str(err) if err else None, t=time.strftime('%F %T'))) + '\n')
    with ThreadPoolExecutor(n) as ex: list(ex.map(one, range(1, n + 1)))

# ───────── 후검수 ─────────
def is_mag(a):  # a: HxWx3 uint8
    a = a.astype(int)
    return (a[..., 0] > 190) & (a[..., 2] > 190) & (a[..., 1] < 110)

def fit_raw(name, raw_path):
    w, h, K, _ = FR_DEF[name]
    return Image.open(raw_path).convert('RGB').resize((w * K, h * K), Image.LANCZOS)

def measures(name, raw_img):
    w, h, K, _ = FR_DEF[name]
    fr = np.array(Image.open(f'{FR}/{name}-frame.png').convert('RGB'))
    ra = np.array(raw_img)
    fm, rm = ~is_mag(fr), ~is_mag(ra)
    iou = (fm & rm).sum() / max(1, (fm | rm).sum())
    diff = np.abs(ra.astype(int) - fr.astype(int)).sum(-1)[fm].mean() / 3       # 칠해졌는지(틀 그대로면 0)
    def bb(m):
        ys, xs = np.where(m); return xs.min(), ys.min(), xs.max(), ys.max()
    a, b = bb(fm), bb(rm)
    dev = max(abs(a[i] - b[i]) for i in range(4)) / K                          # 실루엣 바깥 모서리 어긋남(art px)
    ratio = ((b[2] - b[0]) / (b[3] - b[1])) / ((a[2] - a[0]) / (a[3] - a[1]))   # 가로/세로 축척비
    # 문 상자(검은 상자)가 실제로 어두운지
    door = (fr.sum(-1) < 40) & fm
    dark = (ra.astype(int).sum(-1)[door].mean() / 3) if door.any() else 0
    # 상자 정렬: 틀의 창·간판·기물 상자마다 「안쪽 밝기 ≠ 바깥 고리 밝기」 여야 한다(틀에서 어긋나면 고리와 섞여 차이가 줄어든다)
    from scipy import ndimage as ndi
    lum = ra.astype(float).mean(-1); ok = n = ok2 = 0
    for key in ('win', 'sign', 'obj', 'noren'):
        col = np.array(G[key]); m = (np.abs(fr.astype(int) - col).sum(-1) < 6)
        lab, cnt = ndi.label(m)
        for i in range(1, cnt + 1):
            bx = lab == i
            if bx.sum() < 60 * K * K // 4: continue
            inner = ndi.binary_erosion(bx, iterations=K * 2)
            ring = ndi.binary_dilation(bx, iterations=K * 5) & ~ndi.binary_dilation(bx, iterations=K * 1) & fm
            if inner.sum() < 20 or ring.sum() < 20: continue
            n += 1; ok += abs(lum[inner].mean() - lum[ring].mean()) >= 18
            ys_, xs_ = np.where(bx); cy_, cx_ = (ys_.min() + ys_.max()) / 2, (xs_.min() + xs_.max()) / 2
            hh_, ww_ = (ys_.max() - ys_.min()) / 4, (xs_.max() - xs_.min()) / 4
            core = np.zeros_like(bx); core[int(cy_ - hh_):int(cy_ + hh_) + 1, int(cx_ - ww_):int(cx_ + ww_) + 1] = True
            core &= bx
            ok2 += abs(lum[core].mean() - lum[ring].mean()) >= 18
    boxes = ok / max(1, n); boxes_core = ok2 / max(1, n)
    bg_keep = (~fm & is_mag(ra)).sum() / max(1, (~fm).sum())             # 자홍 배경을 지켰는가(채우면 시야 틀어짐)
    dev_rows = []                                                        # 옆 윤곽선(좌·우 끝)을 행마다 틀과 비교 = 원근 수렴(사다리꼴) 검출
    for y in range(0, fm.shape[0], K * 4):
        fx, rx = np.where(fm[y])[0], np.where(rm[y])[0]
        if len(fx) and len(rx): dev_rows.append(max(abs(fx.min() - rx.min()), abs(fx.max() - rx.max())) / K)
        elif len(fx) != len(rx): dev_rows.append(40)
    side_dev = float(np.percentile(dev_rows, 90)) if dev_rows else 0
    return dict(bg_keep=round(float(bg_keep), 2), side_dev_px=round(side_dev, 1), boxes=round(float(boxes), 2), boxes_core=round(float(boxes_core), 2), iou=round(float(iou), 3), colordiff=round(float(diff), 1), edge_dev_px=round(float(dev), 1), aspect_ratio=round(float(ratio), 3), door_lum=round(float(dark), 0))

def verdict(m, name):
    thr_iou = 0.90 if name != 'P' else 0.80
    return (m['bg_keep'] >= 0.6 and m['side_dev_px'] <= 5 and m['boxes'] >= 0.85 and m['iou'] >= thr_iou and m['colordiff'] >= 30 and m['edge_dev_px'] <= 6 and abs(m['aspect_ratio'] - 1) <= 0.03
            and (name == 'P' or m['door_lum'] < 110))

def cmd_check(name, rnd='r1'):
    w, h, K, _ = FR_DEF[name]
    res = {}
    for f in sorted(glob.glob(f'{RAW}/{name}-{rnd}-*.png')):
        im = fit_raw(name, f); m = measures(name, im); m['pass'] = bool(verdict(m, name)); res[os.path.basename(f)] = m
        print(os.path.basename(f), m, flush=True)
    # 음성 대조군: 틀 자체(안 칠함) · 가로로 5% 민 것 · 상하 뒤집기 → 모두 불합격이어야 한다
    fr = Image.open(f'{FR}/{name}-frame.png').convert('RGB')
    any_raw = sorted(glob.glob(f'{RAW}/{name}-{rnd}-*.png'))
    if any_raw:
        base = fit_raw(name, any_raw[0])
        shifted = Image.fromarray(np.roll(np.array(base), int(0.05 * base.width), axis=1))
        flipped = base.transpose(Image.FLIP_TOP_BOTTOM)
        for tag, im in (('neg-frame', fr), ('neg-shift5%', shifted), ('neg-flipV', flipped)):
            m = measures(name, im); ok = verdict(m, name); print(tag, m, 'PASS(=대조군 실패!)' if ok else 'fail(정상)')
            res[tag] = dict(m, pass_=bool(ok))
    json.dump(res, open(f'{C}/work/check-{name}-{rnd}.json', 'w'), indent=1)
    return res

# ───────── 도트화 ─────────
def srgb2lab(rgb):
    a = np.asarray(rgb, float) / 255.0
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = a @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

NEON = set()   # 장면에서 쓰지 않는 네온(가장자리 자홍 번짐이 붙는 색) — cmd_compose/ dot 전에 채움

def dotify(img, K, pal, out_a=None):
    """img: 고해상도 RGB(=art*K). 칸 중앙값(어두운 윤곽 우선) → modern3 Lab 최근접. 자홍은 투명."""
    a = np.array(img); H_, W_ = a.shape[0] // K, a.shape[1] // K
    a = a[:H_ * K, :W_ * K].reshape(H_, K, W_, K, 3).transpose(0, 2, 1, 3, 4).reshape(H_, W_, K * K, 3)
    mag = is_mag(a.reshape(-1, 3)).reshape(H_, W_, K * K)
    transp = mag.mean(-1) > 0.5
    lab = srgb2lab(a)
    L = lab[..., 0]
    out = np.zeros((H_, W_, 3), np.uint8)
    af = a.astype(np.float32); af[mag] = np.nan
    with np.errstate(all='ignore'):
        med = np.nanmedian(af, axis=2)
    med = np.nan_to_num(med, nan=0.0)
    medL = np.median(L, axis=2)
    dark = (L < (medL[..., None] - 22)) & ~mag
    use_dark = dark.mean(-1) >= 0.30
    for y, x in zip(*np.where(use_dark & ~transp)):
        sel = a[y, x][dark[y, x]]; med[y, x] = np.median(sel.astype(np.float32), axis=0)
    palc = np.array([c for c in pal if c not in NEON], np.uint8); pl = srgb2lab(palc)
    ml = srgb2lab(med.astype(np.uint8))
    d = ((ml[:, :, None, :] - pl[None, None, :, :]) ** 2).sum(-1)
    idx = d.argmin(-1)
    out = palc[idx]
    # 외톨이 화소 정리
    o = out.copy()
    for y in range(1, H_ - 1):
        for x in range(1, W_ - 1):
            if transp[y, x]: continue
            c = tuple(out[y, x]); nb = [tuple(out[y + 1, x]), tuple(out[y - 1, x]), tuple(out[y, x + 1]), tuple(out[y, x - 1])]
            if all(n != c for n in nb):
                from collections import Counter
                k, v = Counter(nb).most_common(1)[0]
                if v >= 3: o[y, x] = k
    rgba = np.dstack([o, np.where(transp, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')

def cmd_dot(name, pick, rnd='r1'):
    w, h, K, _ = FR_DEF[name]
    im = fit_raw(name, f'{RAW}/{name}-{rnd}-{pick}.png')
    o = dotify(im, K, load_pal())
    o.save(f'{WK}/{name}-{rnd}-{pick}-dot.png'); o.resize((o.width * 3, o.height * 3), Image.NEAREST).save(f'{WK}/{name}-{rnd}-{pick}-dot3x.png')
    print('dot', name, o.size)

KOV = {'hero': 5, 'vend1': 5, 'vend2': 5}   # 모델이 상자보다 크게 그린 것들을 목표 크기(주인공 ≈48px, 자판기 ≈47px)에 맞춰 칸을 키운다

def cmd_dotP(rnd, pick):
    """소품 시트: 상자마다 잘라 회색 상자 배경(가장자리에서 이어진 같은 회색)을 지우고 도트화 → work/sprites/"""
    from scipy import ndimage as ndi
    w, h, K, _ = FR_DEF['P']
    im = np.array(fit_raw('P', f'{RAW}/P-{rnd}-{pick}.png'))
    pal = load_pal(); os.makedirs(f'{WK}/sprites', exist_ok=True)
    for nm, (x0, y0, x1, y1, _d) in P_BOXES.items():
        pad = 3
        # 모델이 상자 높이를 넘겨 그리는 일이 잦다(신호등·주인공 아래쪽이 잘렸다) → 위 줄은 104, 아래 줄은 190 까지 세로로 넉넉히 자른다
        yb = 104 if y0 < 100 else 190
        cx0, cy0, cx1, cy1 = (x0 - pad) * K, (y0 - pad) * K, (x1 + pad) * K, yb * K
        crop = im[cy0:cy1, cx0:cx1].copy()
        ref = np.array([176, 176, 176])
        bgc = (np.abs(crop.astype(int) - ref).sum(-1) < 60) | is_mag(crop)
        lab, n = ndi.label(bgc)
        edge = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
        bg = np.isin(lab, [e for e in edge if e]); bg = ndi.binary_dilation(bg, iterations=2) & bgc | bg
        crop[bg] = MAG
        o = dotify(Image.fromarray(crop), KOV.get(nm, K), pal)   # 주인공은 K=3 으로 더 촘촘히(32×48 스펙에 가깝게)
        bbox = o.getchannel('A').getbbox()
        if bbox: o = o.crop(bbox)
        o.save(f'{WK}/sprites/{rnd}{pick}-{nm}.png')
        print(nm, o.size)

# ================= 합성: 바닥(코드) + 건물 2 + 소품 + 간판 글자(Galmuri11) =================
def ramps():
    import re
    r = {}
    for ln in open(PAL, encoding='utf-8'):
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
        if m: r[m.group(1)] = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))]
    return r

def hash2(x, y, s=0):
    v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791)
    v = (v ^ (v >> 13)) * 1274126177 & 0xffffffff
    return (v ^ (v >> 16)) & 0xffff

def shade(img, mask, ramp_of, step):
    """마스크 안 바닥 화소를 같은 램프의 step 칸 어둡게(그림자)"""
    ys, xs = np.where(mask)
    for y, x in zip(ys, xs):
        k = ramp_of.get(tuple(int(v) for v in img[y, x]))
        if k: nm, i = k; img[y, x] = R_[nm][max(0, i - step)]

R_ = None
SEL = {}   # 소품 선택: 이름 -> 스프라이트 파일 stem (예: 'r22-tree1'), cmd_compose 에서 채움

def draw_ground(R):
    g = np.zeros((H, W, 3), np.uint8)
    SW0, CB0, RD0 = 264, 312, 320
    g[0:SW0] = R['conc'][2]   # 건물이 덮지 못한 위쪽(오른쪽 끝 등)은 먼 벽면 톤으로 — 순흑 방지
    # 인도(타일 16x16, 줄눈 conc[2], 잔 얼룩)
    for y in range(SW0, CB0):
        for x in range(W):
            base = R['conc'][3]
            if (x % 32 == 0) or ((y - SW0) % 16 == 0): base = R['conc'][2]
            else:
                h = hash2(x, y)
                if h % 23 == 0: base = R['conc'][4]
                elif h % 29 == 0: base = R['conc'][2]
            g[y, x] = base
    # 점자블록 띠(연석 안쪽, 노랑)
    for y in range(300, 306):
        for x in range(W):
            edge = y in (300, 305)
            g[y, x] = R['kii'][1] if edge else R['kii'][3]
            if not edge and x % 4 in (1, 2) and y in (302, 303): g[y, x] = R['kii'][2]
    # 연석
    g[CB0:CB0 + 3, :] = R['conc'][5]; g[CB0 + 3:CB0 + 5, :] = R['conc'][2]; g[CB0 + 5:RD0 + 6, :] = R['tekko'][1]
    RD0 += 6
    for y in range(RD0, H):
        for x in range(W):
            h = hash2(x, y, 3); c = R['tekko'][2]
            if h % 17 == 0: c = R['tekko'][3]
            elif h % 19 == 0: c = R['tekko'][1]
            g[y, x] = c
    # 중앙선 점선
    for x in range(W):
        if (x // 24) % 2 == 0:
            g[392:394, x] = R['kii'][3]
    # 횡단보도(세로 줄무늬) + 정지선
    for x in range(384, 464):
        if ((x - 384) % 12) < 6:
            g[RD0 + 2:H - 4, x] = R['shiro'][3]
            g[RD0 + 2:H - 4, x][::2] = R['shiro'][3]
    for y in range(RD0 + 2, H - 4):
        for x in range(384, 464):
            if ((x - 384) % 12) < 6 and hash2(x, y, 9) % 11 == 0: g[y, x] = R['shiro'][2]
    g[RD0 + 2:H - 4, 372:376] = R['shiro'][3]
    # 3차: 도로 균열·아스팔트 보수 자국·노면 가장자리 흰 선(레퍼런스 대비 밋밋함 보완)
    for (x0, y0, ln) in ((96, 356, 26), (300, 428, 22), (150, 440, 18), (330, 340, 16)):
        x, y = x0, y0
        for k in range(ln):
            if 0 <= x < W and 0 <= y < H: g[y, x] = R['tekko'][4]
            x += 1; y += (1 if hash2(x, y, 5) % 3 == 0 else 0) - (1 if hash2(x, y, 7) % 5 == 0 else 0)
    for y in range(352, 372):
        for x in range(120, 168):
            if 0 <= y < H and hash2(x // 6, y // 6, 4) % 3 == 0: g[y, x] = R['tekko'][3] if (x + y) % 5 else R['tekko'][2]
    g[RD0 + 2:RD0 + 3, :] = R['shiro'][2]
    # 맨홀
    for y in range(408, 424):
        for x in range(56, 88):
            dx, dy = (x - 72) / 16.0, (y - 416) / 8.0
            r2 = dx * dx + dy * dy
            if r2 <= 1.0: g[y, x] = R['tekko'][4] if r2 > 0.72 else R['tekko'][3]
            if r2 <= 0.72 and ((x - 72) % 6 == 0 or (y - 416) % 4 == 0): g[y, x] = R['tekko'][2]
    return g

def text_layer(size, items, fontpath):
    from PIL import ImageDraw, ImageFont
    f = ImageFont.truetype(fontpath, 11)
    lay = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for (x, y, txt, col, vert) in items:
        if vert:
            for k, ch in enumerate(txt): d.text((x, y + k * 13), ch, font=f, fill=col + (255,))
        else:
            d.text((x, y), txt, font=f, fill=col + (255,))
    # 안티에일리어싱 제거: 알파 이진화
    a = np.array(lay); a[..., 3] = np.where(a[..., 3] > 110, 255, 0); return Image.fromarray(a)

def font_ttf():
    out = f'{WK}/Galmuri11.ttf'
    if not os.path.exists(out):
        from fontTools.ttLib import TTFont
        t = TTFont(f'{C}/fonts/Galmuri11.woff2'); t.flavor = None; t.save(out)
    return out

def paste_sprite(canvas, path, foot_x, foot_y):
    sp = Image.open(path).convert('RGBA')
    canvas.alpha_composite(sp, (int(foot_x - sp.width / 2), int(foot_y - sp.height)))
    return sp

def cmd_compose(cfg):
    """cfg: 'L=r1-1,R=r1-2,P=r1' 등 (건물 rnd-pick, 소품은 SEL 표에서)"""
    global R_
    R_ = ramps(); R = R_
    ramp_of = {}
    for nm, cols in R.items():
        for i, c in enumerate(cols): ramp_of.setdefault(c, (nm, i))
    g = draw_ground(R)
    cv = Image.fromarray(np.dstack([g, np.full((H, W), 255, np.uint8)]), 'RGBA')
    Lb = Image.open(f'{WK}/L-{cfg["L"]}-dot.png'); Rb = Image.open(f'{WK}/R-{cfg["R"]}-dot.png')
    # R: 위 24px 는 옥상 윗면 첫 줄을 늘려 이어 붙임(멀리 이어지는 옥상)
    top = Rb.crop((0, 0, Rb.width, 1)).resize((Rb.width, 24), Image.NEAREST)
    sky = Image.new('RGBA', (W, 24), tuple(R['conc'][3]) + (255,)); cv.alpha_composite(sky, (0, 0))
    cv.alpha_composite(top, (288, 0)); cv.alpha_composite(Rb, (288, 24))
    # 건물 밑 그림자 띠(빛은 왼쪽 위 → 오른쪽 아래)
    arr = np.array(cv)[..., :3]
    m = np.zeros((H, W), bool); m[264:268, 0:304] = True; m[256 + 8:260 + 8, 304:512] = False
    m2 = np.zeros((H, W), bool); m2[256:260, 304:512] = True
    shade(arr, m, ramp_of, 1)
    cv = Image.fromarray(np.dstack([arr, np.full((H, W), 255, np.uint8)]), 'RGBA')
    cv.alpha_composite(Lb, (0, 0))
    # 간판 글자
    f = font_ttf(); sumi = tuple(R['sumi'][1]); shiro = tuple(R['shiro'][3]); kon = tuple(R['kon'][1])
    items = [(10, 223, 'コンビニ 24', sumi, False), (269, 106, 'そば処ひなた', sumi, True), (211, 236, 'う', shiro, False),
             (222, 236, 'ど', shiro, False), (233, 236, 'ん', shiro, False)]
    cv.alpha_composite(text_layer((W, H), items, f), (0, 0))
    # 소품(발 좌표 기준 배치)
    arr = np.array(cv)[..., :3]
    def foot_shadow(cx, cy, w, hh=5, step=2):
        mm = np.zeros((H, W), bool)
        for y in range(cy - hh, cy + hh + 1):
            for x in range(cx - w, cx + w + 1):
                if 0 <= y < H and 0 <= x < W and ((x - cx - 3) / (w + 4.0)) ** 2 + ((y - cy - 1) / (hh + 0.5)) ** 2 <= 1: mm[y, x] = True
        shade(arr, mm, ramp_of, step)
    place = cfg['place']
    for nm, (fx, fy, sw) in place.items():
        foot_shadow(fx, fy, sw)
    cv = Image.fromarray(np.dstack([arr, np.full((H, W), 255, np.uint8)]), 'RGBA')
    for nm in cfg['order']:
        fx, fy, sw = place[nm]
        paste_sprite(cv, f'{WK}/sprites/{cfg["P"][nm]}-{nm}.png' if isinstance(cfg['P'], dict) else f'{WK}/sprites/{cfg["P"]}-{nm}.png', fx, fy)
    out = cv.convert('RGB'); out.save(f'{C}/scene.png')
    out.resize((int(W * 1.5), int(H * 1.5)), Image.NEAREST).save(f'{C}/scene-1.5x.png')
    print('scene', out.size)


# 합성 설정(발 위치 x, 발 y, 그림자 반폭)
CONFIG = dict(L='r1-1', R='r1-2', P={'tree1': 'r21', 'tree2': 'r21', 'vend1': 'r21', 'vend2': 'r21', 'lamp': 'r21', 'tlight': 'r21', 'hero': 'r21', 'taxi': 'r23', 'rail': 'r23'},
    place=dict(tree1=(196, 306, 22), tree2=(410, 306, 22), vend1=(316, 290, 14), vend2=(350, 290, 14), lamp=(466, 306, 6), tlight=(492, 310, 8),
               hero=(262, 304, 9), taxi=(206, 402, 46), rail=(120, 312, 30)),
    order=['rail', 'vend1', 'vend2', 'tree1', 'tree2', 'lamp', 'tlight', 'hero', 'taxi'])

def measures_P(ra, K=4):
    """소품 시트는 상자마다 따로 판정한다: 스프라이트가 자기 상자 안에 있는가 / 이웃으로 새지 않았는가 / 회색 상자 배경을 칠하지 않았는가 / 나무는 초록인가."""
    res = {}
    nm_ = ~is_mag(ra)
    ref = np.array(G['obj'])
    gray = (np.abs(ra.astype(int) - ref).sum(-1) < 40)
    H_, W_ = nm_.shape
    for nm, (x0, y0, x1, y1, _d) in P_BOXES.items():
        ex = 8
        X0, Y0, X1, Y1 = max(0, (x0 - ex) * K), max(0, (y0 - ex) * K), min(W_, (x1 + ex) * K), min(H_, (y1 + ex) * K)
        reg = nm_[Y0:Y1, X0:X1]
        # 다른 상자 안쪽(자기 것 제외)에 이 스프라이트가 새는가는 이웃 상자 쪽 비자홍 화소로 잰다: 확장영역 밖 0 이어야 한다
        bx = np.zeros_like(nm_); bx[y0 * K:y1 * K, x0 * K:x1 * K] = True
        inner = nm_ & bx
        cover = inner.sum() / max(1, bx.sum())                       # 상자를 얼마나 채웠나(0.25 이상: 그려졌다)
        # 스프라이트 덩이: 확장 영역 안 비자홍 화소의 bbox 가 확장 영역 가장자리에 붙었으면 새는 중
        ys, xs = np.where(reg)
        touch = bool(len(xs)) and (xs.min() == 0 or ys.min() == 0 or xs.max() == reg.shape[1] - 1 or ys.max() == reg.shape[0] - 1) and not (Y0 == 0 and ys.min() == 0)
        gfrac = gray[y0 * K:y1 * K, x0 * K:x1 * K].mean()
        sub = ra[y0 * K:y1 * K, x0 * K:x1 * K].astype(int); msk = nm_[y0 * K:y1 * K, x0 * K:x1 * K] & ~gray[y0 * K:y1 * K, x0 * K:x1 * K]
        green = 1.0
        if nm.startswith('tree') and msk.sum():
            px = sub[msk]; green = float(((px[:, 1] > px[:, 0] + 8) & (px[:, 1] >= px[:, 2])).mean())
        ok = cover >= 0.22 and not touch and gfrac < 0.12 and (green >= 0.45 if nm.startswith('tree') else True)
        res[nm] = dict(cover=round(float(cover), 2), leak=touch, gray=round(float(gfrac), 2), green=round(green, 2), ok=bool(ok))
    outside = np.ones_like(nm_)
    for (x0, y0, x1, y1, _d) in P_BOXES.values(): outside[max(0, (y0 - 8) * K):(y1 + 8) * K, max(0, (x0 - 8) * K):(x1 + 8) * K] = False
    bg = float(is_mag(ra)[outside].mean())
    return res, round(bg, 2)

def cmd_checkP(rnd):
    import glob
    out = {}
    def rep(tag, ra):
        res, bg = measures_P(ra)
        oks = [n for n, r in res.items() if r['ok'] and bg >= 0.6]
        print(f'{tag}: bg={bg} pass={len(oks)}/{len(res)} {oks}  fail={ {n: r for n, r in res.items() if not r["ok"]} }'); return dict(bg=bg, res=res, pass_=oks)
    for f in sorted(glob.glob(f'{RAW}/P-{rnd}-*.png')):
        out[os.path.basename(f)] = rep(os.path.basename(f), np.array(fit_raw('P', f)))
    fr = np.array(Image.open(f'{FR}/P-frame.png').convert('RGB'))
    rep('neg-frame(칠 안 한 틀)', fr)
    first = sorted(glob.glob(f'{RAW}/P-{rnd}-*.png'))[0]; ra = np.array(fit_raw('P', first))
    sh = np.roll(ra, int(ra.shape[1] * 0.05), axis=1); sh[:, :int(ra.shape[1] * 0.05)] = 255 * np.array([1, 0, 1])
    rep('neg-shift5%', sh)
    rep('neg-flipV', ra[::-1])
    json.dump(out, open(f'{WK}/check-P-{rnd}.json', 'w'), ensure_ascii=False, indent=1, default=str)

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(0)
    if a[0] == 'frames':
        for k in FR_DEF: make_frame(k); print('frame', k)
    elif a[0] == 'gen': cmd_gen(a[1], int(a[2]) if len(a) > 2 else 3, a[3] if len(a) > 3 else 'r1')
    elif a[0] == 'check': cmd_check(a[1], a[2] if len(a) > 2 else 'r1')
    elif a[0] == 'checkP': cmd_checkP(a[1])
    elif a[0] == 'compose': cmd_compose(CONFIG)
    elif a[0] == 'dotP': cmd_dotP(a[1], a[2])
    elif a[0] == 'dot': cmd_dot(a[1], a[2], a[3] if len(a) > 3 else 'r1')
