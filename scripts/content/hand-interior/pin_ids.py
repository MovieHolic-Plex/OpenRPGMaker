# 칸 번호 고정 — 다시 구워도 이미 깐 맵이 깨지지 않게 한다.
#
# 굽기는 칸을 차례로 싣는다(가구 → 탁자 → 단 → 줄 → 탁상 물건 → 예제 합성 칸). 그래서 가구가 하나만 늘어도
# 그 뒤 탁자·줄·탁상 물건 번호가 전부 밀려, 이미 깐 맵(프로젝트 저장본)의 칸이 엉뚱한 그림이 된다(2026-10-02 실측:
# 새 기물 113종을 그대로 구우면 가구 33종 + 탁자·단·줄·탁상 물건 전부가 밀린다).
#
# 규칙: 이전 굽기(지금 디스크에 있는 사양·예제 맵·시트·정의)와 같은 자리(가구 id + 칸 위치, 탁자 조각 키, 예제 맵 칸 …)는
# 이전 번호를 그대로 쓴다. 그림이 바뀌었으면(다시 고른 그림) 그 번호에서 그림만 바뀐다. 새 자리는 시트 끝에 붙는다.
# 아무도 쓰지 않게 된 옛 번호는 옛 그림·옛 정의 그대로 남긴다(옛 맵이 그 칸을 들고 있을 수 있다).
# HAND_INTERIOR_REPACK=1 이면 고정하지 않고 처음부터 빽빽하게 싣는다(모든 맵이 다시 지어질 때만).
import json, os
from PIL import Image


def slots(blank, void, floors, walls, ceilings, objects, tables, lines, daises, goods, maps):
    """자리 키 → 칸 번호. floors/walls/ceilings = 이름 → 번호 목록, objects/tables/lines = cells([dx,dy,tid,layer]),
    daises = 이름 → {조각: 번호}, goods = 이름 → 번호, maps = 맵 id → 층 이름 → 번호 목록."""
    out = {'blank': blank, 'void': void}
    for kind, d in (('floor', floors), ('wall', walls), ('ceil', ceilings)):
        for n, ts in d.items():
            for i, t in enumerate(ts): out[f'{kind}:{n}:{i}'] = t
    for n, cells in objects.items():
        for dx, dy, t, _ in cells: out[f'obj:{n}:{dx},{dy}'] = t
    for kind, d in (('table', tables), ('line', lines)):
        for n, pieces in d.items():
            for k, cells in pieces.items():
                for dx, dy, t, _ in cells: out[f'{kind}:{n}:{k}:{dx},{dy}'] = t
    for n, pieces in daises.items():
        for k, t in pieces.items(): out[f'dais:{n}:{k}'] = t
    for n, t in goods.items(): out[f'goods:{n}'] = t
    for mid, layers in maps.items():
        for L, ts in layers.items():
            for i, t in enumerate(ts):
                if t >= 0: out[f'map:{mid}:{L}:{i}'] = t
    return out


def load_previous(spec_path, def_path, png_path, maps_path):
    """디스크의 이전 굽기 → (자리 키 → 번호, 정의, 시트 그림) 또는 None."""
    if os.environ.get('HAND_INTERIOR_REPACK') == '1' or not all(os.path.exists(p) for p in (spec_path, def_path, png_path, maps_path)):
        return None
    S = json.load(open(spec_path)); D = json.load(open(def_path)); M = json.load(open(maps_path))
    LAYERS = {'lower': 'lowerTiles', 'L2': 'lowerOverlayTiles', 'L3': 'upperTiles', 'L4': 'upperOverlayTiles'}
    old = slots(S['blank'], S['void'], {n: f['tiles'] for n, f in S['floors'].items()}, {n: w['tiles'] for n, w in S['walls'].items()},
                S['ceilings'], {n: o['cells'] for n, o in S['objects'].items()}, {n: t['pieces'] for n, t in S['tables'].items()},
                {n: l['pieces'] for n, l in S['lines'].items()}, {n: d['pieces'] for n, d in S['daises'].items()}, S['goods'],
                {mid: {L: m[k] for L, k in LAYERS.items()} for mid, m in M['maps'].items()})
    return old, D, Image.open(png_path).convert('RGBA')


def plan(new_slots, old_slots, new_strips, old_strips, new_count, old_count, N, skip=()):
    """→ (perm: 새 번호 → 최종 번호, legacy: 아무도 안 쓰는 옛 번호 목록, final_count, 고정 통계).
    new_strips/old_strips = {바탕 번호: 프레임 수}. 띠는 바탕끼리만 맞추고 프레임은 통째로 옮긴다. skip = 띠 정렬용 빈 칸."""
    def strip_of(strips):
        inside = {}
        for b, n in strips.items():
            for i in range(n): inside[b + i] = b
        return inside
    new_in, old_in = strip_of(new_strips), strip_of(old_strips)
    votes = {}
    for k, nt in new_slots.items():
        ot = old_slots.get(k)
        if ot is None or nt < 0 or ot < 0: continue
        votes.setdefault(nt, {}); votes[nt][ot] = votes[nt].get(ot, 0) + 1
    perm, taken = {}, set()
    for nt in sorted(votes):
        if nt in perm: continue
        for ot, _ in sorted(votes[nt].items(), key=lambda kv: (-kv[1], kv[0])):
            if nt in new_strips:
                if old_strips.get(ot) != new_strips[nt] or any(ot + i in taken for i in range(new_strips[nt])): continue
                for i in range(new_strips[nt]): perm[nt + i] = ot + i; taken.add(ot + i)
                break
            if nt in new_in or ot in old_in or ot in taken: continue
            perm[nt] = ot; taken.add(ot)
            break
    pinned = len(perm)
    nxt = old_count
    for nt in range(new_count):
        if nt in perm or nt in skip or (nt in new_in and nt not in new_strips): continue
        if nt in new_strips:
            while nxt % N: nxt += 1
            for i in range(new_strips[nt]): perm[nt + i] = nxt + i
            nxt += new_strips[nt]
        else:
            perm[nt] = nxt; nxt += 1
    legacy = [t for t in range(old_count) if t not in taken]
    return perm, legacy, max(nxt, old_count), {'pinned': pinned, 'appended': len(perm) - pinned, 'legacy': len(legacy)}
