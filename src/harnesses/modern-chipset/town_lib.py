#!/usr/bin/env python3
"""compose_town.py 의 보조 모듈 — 에셋 병합, 지붕(색 변형·옥상 정리·설비 재배치), 간판, 그림자, 도로 표시, 차 색 램프.

모두 '순수 함수'(그림·배열을 받아 새 그림/목록을 돌려준다)라서 도시 상태(sprites, kind)는 compose_town.py 쪽이 쥔다.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

INK = (9, 17, 37)                       # 팔레트 ink 램프 가장 어두운 색(#091125) — 그림자 색


def hx(l): return [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in l]


def alpha_bbox(img, thr=24):
    a = np.asarray(img)[:, :, 3]
    ys, xs = np.nonzero(a > thr)
    if not len(xs): return (0, 0, img.width, img.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


# ------------------------------------------------------------------ 에셋 JSON 병합
def merge_assets(path):
    """town_assets.json + (같은 폴더의) town_assets_a1.json, town_assets_a2.json 을 병합. 없으면 무시.
    리스트(buildings, vehicles)는 이어 붙이고, 같은 이름의 dict 섹션(props2/props3/...)은 시트가 달라도 잃지 않게 '__multi' 에 모두 쌓는다."""
    out = {}
    base, ext = os.path.splitext(path)
    notes = []
    for p in (path, base + '_a1' + ext, base + '_a2' + ext):
        if not os.path.exists(p): continue
        try: d = json.load(open(p))
        except Exception as e:
            notes.append(f'{os.path.basename(p)} 읽기 실패({e})'); continue
        notes.append(os.path.basename(p))
        for k, v in d.items():
            if isinstance(v, list): out.setdefault(k, []).extend(v)
            elif isinstance(v, dict):
                if k not in out: out[k] = v
                elif out[k] is v: pass
                else:
                    multi = out.setdefault('__multi', {}).setdefault(k, [out[k]]); multi.append(v)
                    for kk, vv in v.items(): out[k].setdefault(kk, vv)
            else: out.setdefault(k, v)
    return out, notes


def sheet_slots(load2, spec_list, trim=True):
    """슬롯 시트 섹션(들) -> {슬롯 이름: [바닥 정렬 그림 (알파 여백 제거)]}. spec 하나는 {round, letters, slots:{이름:[x,w,h]}}."""
    res = {}
    for spec in spec_list:
        if not spec or not spec.get('slots'): continue
        sheets = []
        for lt in spec.get('letters') or ['A']:
            try: sheets.append(load2(f"{spec['round']}:{lt}"))
            except Exception: pass
        for nm, (x, w, h) in spec['slots'].items():
            for s in sheets:
                crop = s.crop((x, s.height - h, x + w, s.height))
                if not (np.asarray(crop)[:, :, 3] > 24).any(): continue
                if trim:
                    bb = alpha_bbox(crop); crop = crop.crop(bb)
                res.setdefault(nm, []).append(crop)
    return res


# ------------------------------------------------------------------ 지붕
ROOF_BASE = hx(['#3b3634', '#524b49', '#68605e', '#7b7270', '#8d8482'])
ROOF_VARIANTS = {
    'teal': hx(['#203b3b', '#2c4e4d', '#3a6260', '#4a7673', '#5d8a86']),
    'navy': hx(['#25314a', '#313f5c', '#404f71', '#506186', '#63749a']),
    'brick': hx(['#4a2b29', '#613a37', '#7a4945', '#8f5a56', '#a36d68']),
    'sage': hx(['#394238', '#4a5649', '#5d6b5c', '#70806f', '#859684']),
    'lgray': hx(['#5b5e62', '#74777c', '#8d9095', '#a6a9ad', '#bec1c4']),
}
SPECIAL_WORDS = ('school', 'parking', 'warehouse', 'gas', 'fire', 'police')


def is_special_roof(b):
    if 'hospital' in b['name']: return False          # 병원은 구워진 헬리패드(지름 40px)·잔선을 지우고 코드 헬리패드로 교체
    return b['cat'].startswith('civic') or b['cat'] == 'warehouse' or any(w in b['name'] for w in SPECIAL_WORDS)


def find_roof(im):
    """roof 램프 5색이 이루는 최대 연결 성분의 사각 영역(x0,y0,x1,y1). 사각형이 아니면 None."""
    arr = np.asarray(im); a = arr[:, :, 3] > 0
    m = np.zeros(a.shape, bool)
    for c in ROOF_BASE: m |= (arr[:, :, :3] == np.array(c, np.uint8)).all(-1) & a
    lab, n = ndimage.label(m)
    if n == 0: return None
    sizes = ndimage.sum(m, lab, range(1, n + 1)); k = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(lab == k)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    area = (x1 - x0) * (y1 - y0)
    if area < 900 or (y1 - y0) < 20 or sizes.max() < .5 * area: return None
    return (x0, y0, x1, y1)


def recolor_roof(im, rect, name):
    """지붕 사각 안의 램프 5색만 목표 램프로 치환(정면·창·난간·윤곽은 그대로)."""
    tgt = ROOF_VARIANTS[name]; arr = np.array(im); x0, y0, x1, y1 = rect
    sub = arr[y0:y1, x0:x1]
    for sc, dc in zip(ROOF_BASE, tgt):
        m = (sub[:, :, :3] == np.array(sc, np.uint8)).all(-1) & (sub[:, :, 3] > 0)
        sub[m, 0], sub[m, 1], sub[m, 2] = dc
    return Image.fromarray(arr, 'RGBA')


def clear_roof(im, rect, ramp):
    """구워진 옥상 설비·잔선(이어지지 않는 직각 이음선)을 모두 지운다: 난간 안쪽(3px 안)은 전부 램프 3번째 색, 가장자리 띠는 램프 밖 화소만. 약한 점 격자를 얹는다."""
    arr = np.array(im); x0, y0, x1, y1 = rect
    sub = arr[y0:y1, x0:x1]; base = np.array(ramp[2], np.uint8)
    isramp = np.zeros(sub.shape[:2], bool)
    for c in ramp: isramp |= (sub[:, :, :3] == np.array(c, np.uint8)).all(-1)
    inner = np.zeros(sub.shape[:2], bool); inner[3:-3, 3:-3] = True
    clr = (sub[:, :, 3] > 0) & (inner | (~inner & ~isramp))
    sub[clr, 0], sub[clr, 1], sub[clr, 2] = base
    yy, xx = np.mgrid[0:sub.shape[0], 0:sub.shape[1]]
    dots = inner & (((xx - 5) % 16) < 2) & (((yy - 5) % 12) < 2)
    sub[dots, 0], sub[dots, 1], sub[dots, 2] = ramp[3]
    return Image.fromarray(arr, 'RGBA')


def clean_seams(im, rect, ramp, minrun=8):
    """특별 지붕(우체국·경찰서 등)의 구워진 이음선·직각 잔선: 난간 안쪽(3px)에서 램프색(기본색 제외)이 가로/세로로 minrun 화소 이상 이어진 직선만 기본색으로 칠한다. 설비(램프 밖 색)는 건드리지 않는다."""
    arr = np.array(im); x0, y0, x1, y1 = rect
    sub = arr[y0:y1, x0:x1]; base = np.array(ramp[2], np.uint8)
    M = np.zeros(sub.shape[:2], bool)
    for k in (0, 1, 3, 4): M |= (sub[:, :, :3] == np.array(ramp[k], np.uint8)).all(-1)
    inner = np.zeros_like(M); inner[3:-3, 3:-3] = True; M &= inner & (sub[:, :, 3] > 0)
    kill = np.zeros_like(M)
    for ax in (0, 1):
        A = M if ax == 1 else M.T; K = np.zeros_like(A)
        for i in range(A.shape[0]):
            row = A[i]; j = 0
            while j < len(row):
                if row[j]:
                    e = j
                    while e < len(row) and row[e]: e += 1
                    if e - j >= minrun: K[i, j:e] = True
                    j = e
                else: j += 1
        kill |= K if ax == 1 else K.T
    sub[kill, 0], sub[kill, 1], sub[kill, 2] = base
    return Image.fromarray(arr, 'RGBA')


def make_helipad(w, h):
    """코드로 그린 헬리패드(3/4 시점으로 납작한 타원 + H). 원본 도트 격자 그대로(스케일 업 없음)."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((0, 0, w - 1, h - 1), fill=(24, 30, 36, 255)); d.ellipse((1, 1, w - 2, h - 2), fill=(214, 221, 218, 255))
    d.ellipse((3, 3, w - 4, h - 4), fill=(66, 74, 82, 255))
    cx, cy = w // 2, h // 2; hw, hh = max(5, w // 6), max(4, h // 4)
    for x0, x1 in ((cx - hw, cx - hw + 2), (cx + hw - 2, cx + hw)): d.rectangle((x0, cy - hh, x1, cy + hh), fill=(240, 244, 242, 255))
    d.rectangle((cx - hw, cy - 1, cx + hw, cy), fill=(240, 244, 242, 255))
    return im


def roof_occupied(im, rect, ramp, grow=3):
    """특수 지붕: 이미 있는 설비(램프 3번째 색이 아닌 화소) 점유 마스크(지붕 사각 좌표)."""
    arr = np.asarray(im); x0, y0, x1, y1 = rect
    sub = arr[y0:y1, x0:x1]
    occ = ~((sub[:, :, :3] == np.array(ramp[2], np.uint8)).all(-1))
    return ndimage.binary_dilation(occ, iterations=grow)


FILLERS = {
    'tall': ['ac_big', 'vent', 'solar', 'dish', 'ac_two', 'duct', 'ac_one', 'vent', 'ac_big', 'ac_row'],
    'mid': ['ac_big', 'vent', 'solar', 'ac_two', 'duct', 'ac_one', 'dish', 'roof_terrace', 'ac_row', 'garden'],
    'low': ['vent', 'solar', 'ac_one', 'ac_two', 'chimney', 'duct', 'ac_big', 'roof_terrace', 'ac_row'],
}
LIM = {'ac_row': 1}                                              # 시드당 상한: 4연 실외기 묶음 1
PER_ROOF = {'dish': 1, 'roof_terrace': 1, 'stairwell_l': 1, 'tank_l': 1, 'helipad_l': 1, 'billboard': 1, 'billboard_s': 1, 'garden': 1, 'solar': 1}   # 한 지붕에 같은 설비는 이만큼까지(접시 쌍 금지)
BIGP = ('stairwell_l', 'tank_l', 'helipad_l', 'stairwell', 'tank', 'helipad')   # 지붕 면적 25%를 넘어도 되는 큰 설비
DEPRECATED = ('pipes', 'pipes_b', 'stairwell', 'stairwell_s', 'tank', 'tank_s', 'helipad')   # 3차 QA: 드론처럼 읽히는 파이프·구형 계단실/물탱크/헬리패드는 폐기(_l 로 대체)
LEGACY_FOR = {'stairwell_l': ('stairwell',), 'tank_l': ('tank',), 'helipad_l': ('helipad',)}   # _l 슬롯이 없을 때만 구형으로 되돌아간다


def roof_pieces(RP, name):
    v = RP.get(name)
    if v: return v
    for old in LEGACY_FOR.get(name, ()):
        if RP.get(old): return RP[old]
    return None


def strip_antenna(im, rect, ramp):
    """경찰서 지붕에 구워진 흰 십자 안테나(전선처럼 읽힘)를 지운다: 지붕 램프색이 아닌 화소의 연결 성분 중 높이 28 이상이고 채움 30% 미만인 가늘고 긴 것(기둥+가로대)."""
    arr = np.array(im); x0, y0, x1, y1 = rect
    rowcnt = (arr[:, :, 3] > 0).sum(1); top = int(np.argmax(rowcnt >= .6 * rowcnt.max()))
    if top > 0: arr[:top, :, 3] = 0                                      # 건물 윗선 위로 솟은 구워진 안테나 기둥
    sub = arr[y0:y1, x0:x1]
    M = np.ones(sub.shape[:2], bool)
    for c in ramp: M &= ~((sub[:, :, :3] == np.array(c, np.uint8)).all(-1))
    M &= sub[:, :, 3] > 0
    inner = np.zeros_like(M); inner[3:-3, 3:-3] = True; M &= inner
    lab, n = ndimage.label(M, structure=np.ones((3, 3))); kill = np.zeros(M.shape, bool)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i); bh = ys.max() - ys.min() + 1; bw = xs.max() - xs.min() + 1
        if bh >= 28 and len(ys) < .3 * bh * bw: kill[lab == i] = True
    if not kill.any(): return Image.fromarray(arr, 'RGBA')
    nonramp = np.ones(sub.shape[:2], bool)
    for c in ramp: nonramp &= ~((sub[:, :, :3] == np.array(c, np.uint8)).all(-1))
    kill = ndimage.binary_dilation(kill, iterations=3) & (sub[:, :, 3] > 0) & nonramp       # 위쪽 그림자 띠(가장자리 3줄)에 걸친 꼭대기 조각까지
    ys, xs = np.nonzero(kill)
    for y, x in zip(ys, xs):
        if y < 3 or x < 3:                                        # 가장자리 띠: 같은 줄 옆 화소 색을 복사(램프 그림자 줄을 보존)
            for dx in (-5, 5, -9, 9):
                if 0 <= x + dx < sub.shape[1] and not kill[y, x + dx]: sub[y, x, :3] = sub[y, x + dx, :3]; break
            else: sub[y, x, :3] = ramp[min(y, 2)]
        else: sub[y, x, :3] = ramp[2]
    return Image.fromarray(arr, 'RGBA')


class Placer:
    """지붕 위 설비 배치기. blocked = 이미 설비가 있는 화소 마스크(특별 지붕), 지붕 사각 좌표."""
    def __init__(self, rng, RP, rect, usable, room, budget, blocked=None):
        self.rng, self.RP, self.rect, self.us, self.room, self.budget, self.blocked = rng, RP, rect, usable, room, budget, blocked
        x0, y0, x1, y1 = rect; self.area = (x1 - x0) * (y1 - y0)
        self.placed = []; self.boxes = []; self.used = 0; self.local = {}; self.cnt = {}

    def clipped(self, bx):
        x0, y0, x1, y1 = self.rect
        return max(0, min(bx[2], x1) - max(bx[0], x0)) * max(0, min(bx[3], y1) - max(bx[1], y0))

    def add_fixed(self, name, piece, pos):
        self.placed.append((name, piece, pos)); bx = (pos[0], pos[1], pos[0] + piece.width, pos[1] + piece.height); self.boxes.append(bx)
        self.used += self.clipped(bx); self.cnt[name] = self.cnt.get(name, 0) + 1; self.local[name] = self.local.get(name, 0) + 1

    def try_place(self, name, tries=60, piece=None, cap_area=.25):
        rng = self.rng; RP = self.RP; x0, y0, x1, y1 = self.rect; ux0, uy0, ux1, uy1 = self.us
        alts = [piece] if piece is not None else roof_pieces(RP, name)
        if not alts: return False
        if name in LIM and self.budget.get(name, 0) + self.local.get(name, 0) >= LIM[name]: return False
        if self.cnt.get(name, 0) >= PER_ROOF.get(name, 2): return False
        big = name in BIGP; over = 10 if name.endswith('_l') else 0                        # 큰 설비는 뒤 난간 위로 조금 솟아 보여도 된다(3/4 시점)
        order = sorted(alts, key=lambda p: -p.width * p.height) if big else rng.sample(list(alts), len(alts))
        for piece_ in order[:3]:
            w, h = piece_.size
            if w > ux1 - ux0 or (name != 'antenna' and h > (uy1 - uy0) + over): continue
            if not big and self.used + w * h > cap_area * self.area and name != 'antenna': continue
            if big and w * h > .62 * self.area: continue
            for _ in range(tries):
                px = rng.randint(ux0, ux1 - w)
                lo = uy0 + h - over if name != 'antenna' else max(uy0 + 14, y0 + 3 + h)
                if lo > uy1: break
                foot = rng.randint(lo, uy1)
                if foot - h < -self.room: continue
                bx = (px, foot - h, px + w, foot)
                if any(bx[0] < o[2] + 4 and o[0] < bx[2] + 4 and bx[1] < o[3] + 4 and o[1] < bx[3] + 4 for o in self.boxes): continue
                if any(abs(foot - o[3]) < 3 and abs((px + w // 2) - (o[0] + o[2]) // 2) < 40 and (o[3] - o[1]) < 40 for o in self.boxes): continue      # 일렬 정렬 금지
                if self.blocked is not None:
                    ly0, ly1 = max(0, bx[1] - y0), max(0, foot - y0); lx0, lx1 = max(0, bx[0] - x0), min(self.blocked.shape[1], bx[2] - x0)
                    if self.blocked[ly0:ly1, lx0:lx1].any(): continue
                self.add_fixed(name, piece_, (px, foot - h)); return True
        return False


def decorate_roof(b, rng, RP, room, ramp_name='base', budget=None):
    """건물 b(풀 항목: im, roof=(rect, ramp), h(칸), floors, special) 의 한 인스턴스를 만든다.
    반환 (새 그림, info) — info: pad(위로 늘린 px), roof(새 좌표 사각), usable, items [(이름, 사각)], ratio.
    room = 스프라이트 위로 더 솟아도 되는 px (맵·블록 위 경계)."""
    im = b['im']; rect = b['roof']; hb = b['h']; fl = b['floors']
    x0, y0, x1, y1 = rect
    ramp = ROOF_BASE if ramp_name == 'base' else ROOF_VARIANTS[ramp_name]
    if ramp_name != 'base': im = recolor_roof(im, rect, ramp_name)
    info = dict(pad=0, roof=rect, usable=(x0 + 4, y0 + 4, x1 - 4, y1 - 4), items=[], ratio=0.0, special=b['special'], cleared=False, ramp=ramp, ramp_name=ramp_name, helipad=False, big=False)
    if not RP: return im, info
    ux0, uy0, ux1, uy1 = info['usable']
    budget = budget if budget is not None else {}
    area = (x1 - x0) * (y1 - y0)

    if b['special']:
        im = clean_seams(im, rect, ramp)
        if 'police' in b['name']: im = strip_antenna(im, rect, ramp)
        occ = roof_occupied(im, rect, ramp)
        raw = ~((np.asarray(im)[y0:y1, x0:x1, :3] == np.array(ramp[2], np.uint8)).all(-1)); raw[:3] = 0; raw[-3:] = 0; raw[:, :3] = 0; raw[:, -3:] = 0
        P = Placer(rng, RP, rect, info['usable'], room, budget, blocked=occ)
        if 'antenna' in RP and hb >= 9 and rng.random() < .6: P.try_place('antenna', 60)
        small = ['ac_one', 'ac_two', 'duct', 'vent', 'solar', 'ac_one']
        for nm in small * 2:                                       # 구워진 설비만으로 15% 미만이면 작은 설비를 보충
            if (int(raw.sum()) + P.used) >= .17 * area or P.used > .12 * area: break
            P.try_place(nm, 80, cap_area=.30)
        placed = P.placed
        for nm, _p, _pos in placed:
            if nm in LIM: budget[nm] = budget.get(nm, 0) + 1
    else:
        im = clear_roof(im, rect, ramp); info['cleared'] = True
        rw = x1 - x0; is_hosp = 'hospital' in b['name']
        tier = 'tall' if (hb >= 12 or fl >= 10) else ('mid' if hb >= 9 else ('low' if hb <= 5 else 'mid'))
        tall6 = fl >= 6 or hb >= 10                                  # 6층 이상: 옥탑 계단실 필수
        big_fit = lambda nm: any(p.width <= ux1 - ux0 and p.height <= (uy1 - uy0) + 10 for p in (roof_pieces(RP, nm) or []))

        def attempt():
            P = Placer(rng, RP, rect, info['usable'], room, budget)
            need_ok = True
            pad_ = None
            if is_hosp and rw >= 90:                                       # 병원: 지붕 중앙에 큰 헬리패드(helipad_l, 없으면 코드 도형)
                pcs = [p for p in (roof_pieces(RP, 'helipad_l') or []) if 60 <= p.width <= rw - 12 and p.height <= (uy1 - uy0) + 10]
                if pcs: pad_ = rng.choice(pcs)
                else:
                    hw_ = min(64, rw - 14); hh_ = min(40, uy1 - uy0 - 2)
                    if hw_ >= 60 and hh_ >= 28: pad_ = make_helipad(hw_, hh_)
            if pad_ is not None:
                px = (x0 + x1) // 2 - pad_.width // 2; py = (y0 + y1) // 2 - pad_.height // 2
                P.add_fixed('helipad_l', pad_, (px, py))
                if 'antenna' in RP and rng.random() < .4: P.try_place('antenna')
                for nm in ('vent', 'ac_one'):
                    if rng.random() < .5: P.try_place(nm, 30)
                return P, True
            must = []
            if tall6 and big_fit('stairwell_l'): must.append('stairwell_l')
            if (tall6 or tier != 'low') and big_fit('tank_l') and rng.random() < (.55 if tier == 'tall' else .3): must.append('tank_l')
            if hb >= 12 or fl >= 10: must.append('antenna')
            if rng.random() < (.22 if hb >= 6 else .12): must.append('billboard' if hb >= 6 else 'billboard_s')
            if rng.random() < .15: must.append('garden')
            if tier == 'tall' and rw >= 100 and rng.random() < .12:
                pcs = [p for p in (roof_pieces(RP, 'helipad_l') or []) if 60 <= p.width <= rw - 12 and p.height <= (uy1 - uy0) + 10]
                if pcs: P.try_place('helipad_l', piece=rng.choice(pcs))
            for nm in must:
                ok_ = P.try_place(nm, 120)
                if nm == 'stairwell_l' and not ok_: need_ok = False
            target = rng.uniform(.17, .24)
            fills = list(FILLERS[tier]); rng.shuffle(fills)
            for nm in fills * 2:
                if P.used >= target * area: break
                P.try_place(nm)
            extra = ['ac_one', 'ac_two', 'duct', 'vent', 'ac_one', 'ac_big', 'chimney', 'solar']                  # 채움 하한 15%: 모자라면 작은 설비를 더 얹는다
            rng.shuffle(extra)
            for nm in extra * 3:
                if P.used >= .16 * area: break
                P.try_place(nm, 120, cap_area=.30)
            return P, need_ok

        best = None
        for _t in range(30):
            P, need_ok = attempt(); r_ = P.used / area
            hasbig = any(nm in BIGP for nm, _p, _q in P.placed)
            hi = .62 if hasbig else .25
            sc = (0 if need_ok else 1.0) + (0 if .155 <= r_ <= hi else abs(r_ - .20))
            if best is None or sc < best[0]: best = (sc, P)
            if sc == 0: break
        P = best[1]; placed = P.placed
        for nm, _p, _pos in placed:
            if nm in LIM: budget[nm] = budget.get(nm, 0) + 1
        info['helipad'] = any(nm.startswith('helipad') for nm, _p, _pos in placed)
        info['big'] = any(nm in BIGP for nm, _p, _pos in placed)
    boxes = []

    # 합성 (위로 솟은 만큼 캔버스를 늘린다)
    pad = max([0] + [-p[2][1] for p in placed])
    if pad:
        canvas = Image.new('RGBA', (im.width, im.height + pad), (0, 0, 0, 0)); canvas.alpha_composite(im, (0, pad)); im = canvas
    for nm, piece, (px, py) in sorted(placed, key=lambda t: t[2][1] + t[1].height):
        im.alpha_composite(piece, (px, py + pad))
    info['pad'] = pad
    info['roof'] = (x0, y0 + pad, x1, y1 + pad)
    info['usable'] = (ux0, uy0 + pad, ux1, uy1 + pad)
    info['items'] = [(nm, (px, py + pad, px + p.width, py + pad + p.height)) for nm, p, (px, py) in placed]
    rarea = (x1 - x0) * (y1 - y0)
    clipped = 0
    for _, r in info['items']:
        clipped += max(0, min(r[2], x1) - max(r[0], x0)) * max(0, min(r[3], y1 + pad) - max(r[1], y0 + pad))
    info['ratio'] = clipped / rarea
    return im, info


# ------------------------------------------------------------------ 간판 (건물 정면에 합성)
def facade_wall_colors(im, roof_y1, rx0=None, rx1=None):
    """정면 벽 색 집합: 지붕 사각의 좌우 끝 기둥(바깥 윤곽 바로 안쪽 4px 띠)에서 윤곽·흰 난간을 뺀 색."""
    arr = np.asarray(im); y0, y1 = roof_y1 + 3, im.height - 36
    if y1 - y0 < 12: return None
    rx0 = 6 if rx0 is None else rx0 + 1; rx1 = im.width - 6 if rx1 is None else rx1 - 1
    strip = np.concatenate([arr[y0:y1, rx0:rx0 + 4].reshape(-1, 4), arr[y0:y1, rx1 - 4:rx1].reshape(-1, 4)])
    strip = strip[strip[:, 3] > 0][:, :3]
    if len(strip) < 20: return None
    keys = strip[:, 0].astype(int) * 65536 + strip[:, 1].astype(int) * 256 + strip[:, 2]
    u, c = np.unique(keys, return_counts=True)
    out = set()
    for k, n in zip(u, c):
        col = (int(k) >> 16, (int(k) >> 8) & 255, int(k) & 255)
        if n < .06 * len(strip) or col == INK or min(col) > 215: continue
        out.add(col)
    if not out: return None
    cols = np.array(sorted(out), float) / 255.0; mx = cols.max(1); mn = cols.min(1); d = mx - mn
    gray = d < .12 * np.maximum(mx, 1e-6)
    hue = np.zeros(len(cols))
    for i, c in enumerate(cols):
        if d[i] < 1e-6: continue
        r, g, b = c
        h = ((g - b) / d[i]) % 6 if mx[i] == r else ((b - r) / d[i] + 2 if mx[i] == g else (r - g) / d[i] + 4)
        hue[i] = h / 6
    return dict(hue=hue, gray=gray, colors=out)


def wall_free(im, rect, wall, thr=.75, inkmax=.10):
    """사각 rect 의 화소가 대부분(85%↑) 벽 색 계열(기둥 색과 같은 색조·채도 구분)이고 윤곽 잉크가 거의 없는가."""
    x0, y0, x1, y1 = rect
    if x0 < 0 or y0 < 0 or x1 > im.width or y1 > im.height: return False
    arr = np.asarray(im)[y0:y1, x0:x1].astype(float) / 255.0
    a = arr[:, :, 3] > 0
    mx = arr[:, :, :3].max(-1); mn = arr[:, :, :3].min(-1); d = mx - mn
    gray = d < .12 * np.maximum(mx, 1e-6)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    dd = np.where(d > 1e-6, d, 1)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) / 6
    ok = np.zeros(a.shape, bool)
    for hu, gr in zip(wall['hue'], wall['gray']):
        if gr: ok |= gray
        else: ok |= (~gray) & (np.minimum(np.abs(h - hu), 1 - np.abs(h - hu)) < .045)
    ink = (mx < .25)
    return bool(a.all() and (ok & a).mean() >= thr and ink.mean() <= inkmax)


SIGN_BY_CAT = {'cafe': ['v_cafe'], 'bakery': ['v_bread'], 'izakaya': ['v_ramen', 'v_bar'], 'conv': ['sign_conv', 'v_phone'], 'neon': ['v_bar', 'v_phone'],
               'civic_police': ['sign_police'], 'civic_fire': ['sign_fire'], 'civic_post': ['sign_post'],
               'shop': ['v_pharm', 'v_hair', 'v_book', 'v_phone', 'v_cafe']}


SIGN_WF = (0, .90, .05)         # (둘레 여유px, 벽 색 비율 하한, 윤곽 잉크 비율 상한) — 창·창틀 위에는 얹지 않는다


def add_facade_sign(im, b, info, S, rng):
    """상점류 정면의 문 옆 벽에 돌출 간판(+가끔 차양). 못 찾으면 그대로. 반환 (그림, 간판 사각 또는 None)."""
    cat = b['cat']
    names = [n for n in SIGN_BY_CAT.get(cat, []) if n in S]
    if not names or not b.get('doors'): return im, None
    roof_y1 = info['roof'][3]
    wall = facade_wall_colors(im, roof_y1, info['roof'][0], info['roof'][2])
    if not wall: return im, None
    piece = rng.choice(S[rng.choice(names)]); w, h = piece.size
    d0, d1 = b['doors'][0]; Hf = im.height - roof_y1; sign = None
    cands = []
    for gap in list(range(4, 11)) + list(range(11, 70, 2)):                      # 문 곁 먼저, 안 되면 조금씩 멀리(문 사이 기둥 벽 포함)
        for side in rng.sample((-1, 1), 2):
            for fr in rng.sample((.26, .32, .38, .44, .50, .56, .62, .68, .74), 9):
                cands.append(((d1 + gap) if side > 0 else (d0 - gap - w), roof_y1 + int(Hf * fr) - h // 2))
    for x, y in cands:
        y = min(y, im.height - 34 - h); r = (x, y, x + w, y + h)
        if r[0] < 2 or r[2] > im.width - 2 or r[1] < roof_y1 + 2: continue
        if any(r[2] > e0 - 2 and r[0] < e1 + 2 for e0, e1 in b['doors']): continue
        wf_ = SIGN_WF if not cat.startswith('civic') else (0, .80, .10)                      # 공공 건물은 입구 곁 벽면이 좁아 조금 느슨하게(윤곽 잉크가 많은 문틀 옆)
        if not wall_free(im, (r[0] - wf_[0], r[1] - wf_[0], r[2] + wf_[0], r[3] + wf_[0]), wall, wf_[1], wf_[2]): continue         # 창 위에는 얹지 않는다: 둘레 3px 까지 벽 색(≥94%)·윤곽 잉크 거의 없음
        im = im.copy(); im.alpha_composite(piece, (x, y)); sign = r
        break
    aw = [n for n in ('awning_s', 'awning_r', 'awning_g') if n in S]
    if aw and rng.random() < .4:
        piece = rng.choice(S[rng.choice(aw)]); w, h = piece.size
        cx = (d0 + d1) // 2; x = cx - w // 2; y = im.height - 34 - h - 2
        r = (x, y, x + w, y + h)
        if r[0] >= 2 and r[2] <= im.width - 2 and wall_free(im, r, wall, .9, .04) and (sign is None or r[2] <= sign[0] or r[0] >= sign[2] or r[3] <= sign[1] or r[1] >= sign[3]):
            im = im.copy(); im.alpha_composite(piece, (x, y))
    return im, sign


# ------------------------------------------------------------------ 차 색 램프
def make_ramp(rgb):
    """목표 색 하나 -> 7단 램프(차체 회색 램프와 같은 명암 배율)."""
    mult = [.50, .62, .76, .88, 1.0, 1.12, 1.26]
    out = []
    for m in mult:
        c = [min(255, rgb[i] * m) for i in range(3)]
        if m > 1: t = (m - 1) * .5; c = [c[i] + (255 - c[i]) * t * .6 for i in range(3)]
        out.append(tuple(int(v) for v in c))
    return out


# ------------------------------------------------------------------ 도로 표시
STOP = (228, 232, 236)


def arrow_img(vertical, flip=False):
    """직진 화살표 10×16(세로) / 16×10(가로, 오른쪽 향함). flip=True 면 반대 방향."""
    im = Image.new('RGBA', (10, 16), (0, 0, 0, 0)); px = im.load()
    c = STOP + (235,)
    for i, (a, b) in enumerate(((4, 5), (3, 6), (2, 7), (1, 8), (0, 9))):
        for x in range(a, b + 1): px[x, i] = c
    for y in range(5, 16):
        for x in range(3, 7): px[x, y] = c
    for x in range(2, 8): px[x, 5] = c
    if not vertical: im = im.rotate(-90, expand=True)
    if flip: im = im.transpose(Image.FLIP_TOP_BOTTOM if vertical else Image.FLIP_LEFT_RIGHT)
    return im


def manhole_img():
    im = Image.new('RGBA', (12, 8), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((0, 0, 11, 7), fill=(14, 22, 34, 255)); d.ellipse((1, 1, 10, 6), fill=(46, 60, 78, 255)); d.ellipse((2, 2, 9, 5), fill=(22, 33, 48, 255))
    px = im.load()
    for x in (4, 7): 
        for y in (2, 3, 4, 5): px[x, y] = (46, 60, 78, 255)
    return im


def drain_img():
    im = Image.new('RGBA', (10, 3), (0, 0, 0, 0)); px = im.load()
    for x in range(10):
        px[x, 0] = (54, 70, 90, 255)
        px[x, 1] = (13, 21, 33, 255) if x % 2 == 0 else (30, 44, 62, 255)
        px[x, 2] = (13, 21, 33, 255)
    return im


def ellipse_mask(shape, cx, cy, rx, ry):
    yy, xx = np.ogrid[:shape[0], :shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


# ------------------------------------------------------------------ 접지 그림자 (광원 왼쪽 위 -> 오른쪽 아래)
def make_shadows(sprites, kind, PX):
    """건물(오른쪽 4~6px·아래 3~4px), 소품(납작 타원/비스듬한 짧은 그림자), 사람(발밑 타원)의 그림자 레이어.
    반환 (RGBA 레이어, 건물 그림자 불리언 마스크). 건물 그림자는 보도('side') 위에만 남는다."""
    kk = np.array(kind)
    def px_of(sel): return np.kron(sel.astype(np.uint8), np.ones((16, 16), np.uint8)).astype(bool)
    side = px_of(kk == 'side'); walk = px_of((kk == 'side') | (kk == 'park')); nobld = px_of((kk == 'side') | (kk == 'park') | (kk == 'cross'))
    A = np.zeros((PX, PX), np.uint8); bsh = np.zeros((PX, PX), bool)

    def paint(mask, x, y, alpha, allow, record=None):
        h, w = mask.shape; x0, y0 = max(0, x), max(0, y); x1, y1 = min(PX, x + w), min(PX, y + h)
        if x1 <= x0 or y1 <= y0: return
        sub = mask[y0 - y:y1 - y, x0 - x:x1 - x] & allow[y0:y1, x0:x1]
        A[y0:y1, x0:x1] = np.maximum(A[y0:y1, x0:x1], np.where(sub, alpha, 0).astype(np.uint8))
        if record is not None: record[y0:y1, x0:x1] |= sub

    for s in sprites:
        k = s['k']
        if k == 'bld':
            m = np.asarray(s['img'])[:, :, 3] > 40; h, w = m.shape
            bh = 4 + (s['x'] // 16 + s['foot'] // 16) % 3                                   # 정면 아래 띠 높이 4~6px
            big = np.zeros((h + bh, w + 6), bool); near = np.zeros_like(big)
            for dx in range(0, 7):
                for dy in range(0, bh + 1):
                    if dx == 0 and dy == 0: continue
                    big[dy:dy + h, dx:dx + w] |= m
                    if dx <= 3 and dy <= bh - 2: near[dy:dy + h, dx:dx + w] |= m
            body = np.zeros_like(big); body[:h, :w] = m
            far = big & ~body & ~near; nr = near & ~body
            paint(far, s['x'], s['y'], 88, side, bsh); paint(nr, s['x'], s['y'], 112, side, bsh)
        elif k == 'prop':
            if s['name'] in ('fountain', 'pond'): continue
            img = s['img']; bb = alpha_bbox(img); w = bb[2] - bb[0]; h = bb[3] - bb[1]
            cx = s['x'] + (bb[0] + bb[2]) // 2; foot = s['foot']
            if s['name'] == 'tree':                                                       # 나무: 20x6 타원 α90
                mm = ellipse_mask((8, 22), 11, 4, 10, 3)
                paint(mm, cx - 11, foot - 5, 90, walk)
            elif h > 2.4 * w and w <= 14 or s['name'] in ('lamp', 'signal', 'pole', 'busstop'):
                m = np.zeros((6, 10), bool)
                for t in range(9): m[1 + t // 3: 3 + t // 3, t] = True
                paint(m, cx + 1, foot - 2, 85, walk)
            else:
                rx = max(5.0, w * .5); ry = 3.0
                mm = ellipse_mask((int(ry * 2) + 3, int(rx * 2) + 3), rx + 1, ry + 1, rx, ry)
                paint(mm, int(cx + 1 - rx - 1), int(foot - ry - 2), 80, walk)
        elif k == 'person':
            mm = ellipse_mask((6, 16), 8, 3, 7, 2)                                        # 사람: 14x4 타원 α70
            paint(mm, s['fx'] - 8, s['foot'] - 5, 70, nobld)
    img = np.zeros((PX, PX, 4), np.uint8); img[..., 0], img[..., 1], img[..., 2] = INK; img[..., 3] = A
    return Image.fromarray(img, 'RGBA'), bsh
