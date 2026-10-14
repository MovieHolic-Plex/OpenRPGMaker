#!/usr/bin/env python3
"""modern_campus 굽기 — 야외(art/ 등록부 · object-gate 통과분) + 실내(campus_interior 가구·바닥·벽면 + 재사용 jp_city 학교 기물)를 한 시트로.

  python3 scripts/content/modern-campus/bake_mc.py          # 쓰기
  python3 scripts/content/modern-campus/bake_mc.py --dry    # 보고만

산출: public/assets/modern-campus/modern-campus-chipset.png · src/assets/modernCampusTileset.json · modernCampusSheet.json · modernCampusRoomSpec.json
      tiledata/modern-campus/bake-pins.json · bake-report.json
3/4 관문: 모든 새 조각(야외·실내 mc-*)은 그림 화소 해시의 object-gate 영수증이 pass 여야 한다(theme_bake.gate_status). 재사용 jp_city 기물(sc-·pb-·…)은
이미 번들된 jp_city 시트의 그림을 화소 그대로 복사한 것이라 소급 면제(보고서 legacy_reused 에 목록).
"""
import argparse, collections, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'lib'))
sys.path.insert(0, os.path.join(HERE, 'interior'))
import theme_bake as TB   # noqa: E402
BL = TB.BL
import campus_interior as CI   # noqa: E402  (jp-city 실내·블록 경로를 sys.path 에 얹는다)
import ikit               # noqa: E402
import campus_plan_render as CPR   # noqa: E402  (재사용 jp_city 실내 블록 레지스트리 목록)
import categories as JPCATS    # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'modern_campus', '현대 학교·캠퍼스 (손 도트)', 'tex_modern_campus', 'oprn-campus'
TPR = 48
TD = os.path.join(ROOT, 'tiledata', 'modern-campus')
P = dict(png=os.path.join(ROOT, 'public/assets/modern-campus/modern-campus-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/modernCampusTileset.json'), sheet=os.path.join(ROOT, 'src/assets/modernCampusSheet.json'),
         roomspec=os.path.join(ROOT, 'src/assets/modernCampusRoomSpec.json'), roomtable=os.path.join(ROOT, 'src/assets/modernCampusRoomTable.json'),
         pins=os.path.join(TD, 'bake-pins.json'), report=os.path.join(TD, 'bake-report.json'))
GROUP_KO = dict(terrain='바닥·도로', buildings='건물', props='교정 소품')
FENCE_IDS = {'mc-fence-mesh', 'mc-wall-brick', 'mc-hedge', 'mc-gate-pillar', 'mc-gate-slide'}
TREE_IDS = {'mc-tree-zelkova', 'mc-tree-ginkgo', 'mc-tree-cherry', 'mc-tree-pine', 'mc-shrub', 'mc-azalea'}
ANIM_SETS = [  # (id, 이름, 프레임 id 목록, fps) — 프레임 0 은 정지 그림(mc-fountain)과 같은 조각이다
    ('mc-fountain-anim', '분수(물 움직임)', ['mc-fountain', 'mc-fountain-f1', 'mc-fountain-f2'], 4),
]
NO_RECEIPT_INTERIOR = []        # 영수증 없음 — 굽지 않는다

# 실내 가구 분류(방별). 재사용 jp_city 기물은 jp 분류표 그대로.
MC_CAT = {
    'classroom': ('교실·강의실', ['mc-desk-pair', 'mc-lectern', 'mc-lecture-bench', 'mc-lecture-stool', 'mc-board-green', 'mc-screen-proj', 'mc-pc-cart', 'mc-wall-clock', 'mc-window-class', 'mc-cork-board', 'mc-bin-wide', 'mc-trash-bin', 'mc-chair-stack', 'mc-cabinet-glass']),
    'corridor': ('복도·현관', ['mc-hall-locker', 'mc-water-fountain', 'mc-umbrella-stand', 'mc-shoe-rack-low', 'mc-locker-bench', 'mc-trophy-shelf', 'mc-trophy-case', 'mc-cleaning-wagon', 'mc-clean-cart', 'mc-fire-cabinet', 'mc-vending-in', 'mc-vending-low', 'mc-bulletin-stand']),
    'toilet': ('화장실', ['mc-toilet-stall', 'mc-stall-block', 'mc-sink-vanity']),
    'library': ('도서관', ['mc-carrel', 'mc-book-trolley', 'mc-book-cart', 'mc-catalog-drawers']),
    'infirmary': ('보건실', ['mc-eye-chart', 'mc-aid-counter', 'mc-aid-cabinet', 'mc-nurse-desk']),
    'cafeteria': ('급식실', ['mc-serving-counter', 'mc-tray-cart', 'mc-fridge-counter', 'mc-cafe-table', 'mc-cafe-table-2', 'mc-cafe-stool']),
    'dorm': ('기숙사', ['mc-dorm-bed', 'mc-dorm-desk', 'mc-dorm-wardrobe', 'mc-dorm-dresser', 'mc-mini-fridge', 'mc-lounge-sofa', 'mc-low-table', 'mc-bean-bag']),
    'club': ('동아리방', ['mc-club-shelf', 'mc-club-table', 'mc-amp', 'mc-amp-stack', 'mc-easel-board']),
}


class _Cats:
    """ikit.Registry.build 의 jp 분류표 검사를 캠퍼스 가구·재사용 가구에 맞게 바꾼 것."""
    BY_ID = {}
    @staticmethod
    def check(obj_ids, complete=False):
        miss = sorted(set(obj_ids) - set(_Cats.BY_ID))
        assert not miss, ('분류 없음', miss)


def _art_items():
    """art/ 의 세 등록부(바닥·건물·소품) → 관문 PNG(tiledata/modern-campus/<group>/_gate/mc-<id>.png) 와 메타."""
    sys.path.insert(0, os.path.join(HERE, 'art'))
    import terrain as AT, buildings as AB, props as AP   # noqa: E401
    out = []
    for reg in (AT.R, AB.R, AP.R):
        for it in reg.items:
            png = os.path.join(TD, reg.group, '_gate', 'mc-%s.png' % it['id'])
            out.append(dict(it, id='mc-' + it['id'], group=reg.group, png=png))
    return out


def build_outdoor_pieces(report):
    items = _art_items()
    by = {i['id']: i for i in items}
    pieces, prov, blocked = [], 0, []
    def status(png, kind):
        nonlocal prov
        s = TB.gate_status(png, kind)
        if s == 'pass': return True
        if s == 'prov': prov += 1; return True
        return s
    anim_frames = {f for _, _, fs, _ in ANIM_SETS for f in fs[1:]}
    for it in items:
        if not os.path.exists(it['png']): blocked.append((it['id'], 'PNG 없음 — art 내보내기 먼저')); continue
        ok = status(it['png'], it['kind'])
        if ok is not True: blocked.append((it['id'], ok)); continue
        if it['id'] in anim_frames: continue
        g = it['group']
        role = ('terrain' if it['kind'] == 'terrain' else 'building' if g == 'buildings' else 'fence' if it['id'] in FENCE_IDS
                else 'prop')
        desc = f"{it['name']}. 캠퍼스 {GROUP_KO[g]}, 칸 {it['w']}×{it['h']}, 3/4 탑뷰(윗면 + 남쪽 앞면)."
        p = dict(id=it['id'], name=it['name'], kind=it['kind'], png=it['png'], group='mc-' + g, group_ko=GROUP_KO[g], desc=desc, role=role,
                 tags=list(it.get('tags') or []) + (['나무'] if it['id'] in TREE_IDS else []), rules=it.get('rules') or '')
        if g == 'buildings':
            p['entrance'] = list(it.get('entrance') or [])
            p['rules'] = ('건물 하나를 키트로 찍는다. 문 칸(entrance)은 막힘이고 그 바로 아래 칸(접근칸)은 포석으로 비워 둔다. '
                          '건물 둘레 1칸·문 앞 2칸은 나무·소품을 두지 않는다. 건물끼리는 2칸 이상 띄운다.')
        elif it['kind'] == 'terrain': p['rules'] = p['rules'] or '한 칸 바닥 — 넓게 칠한다.'
        pieces.append(p)
    for aid, aname, frames, fps in ANIM_SETS:
        fr = [by.get(f) for f in frames]
        if not all(fr) or any(status(f['png'], f['kind']) is not True for f in fr): blocked.append((aid, '프레임 관문 미통과/누락')); continue
        it0 = fr[0]
        pieces.append(dict(id=aid, name=aname, kind=it0['kind'], png=it0['png'], frames=[f['png'] for f in fr], fps=fps, group='mc-anim', group_ko='움직임', role='prop', tags=['애니메이션'],
                           desc=f"{aname} — {len(fr)}프레임 반복 애니메이션 키트(칸 {it0['w']}×{it0['h']}).", rules='키트 하나로 찍으면 프레임이 자동 반복된다.'))
    report['outdoor_gate'] = dict(provisional_profile_uncalibrated=prov, blocked=blocked, pieces=len(pieces))
    return pieces


def interior_sub_registry(report):
    """campus_interior.R 의 통과 가구·바닥·벽면 + 재사용 jp 가구 + 기본 천장·공허로 새 Registry 를 만든다."""
    ikit.CATS = _Cats
    cat_of = {}
    for ck, (ko, ids) in MC_CAT.items():
        for i in ids: cat_of[i] = ('campus-' + ck, ko)
    jp_regs = CPR.regs()[1:]
    reuse_ids = sorted({i for v in CI.REUSE.values() for i in v})
    sub = ikit.Registry('interior_campus', '캠퍼스 실내')
    sub.add_void()
    import interior_shell
    sub.ceils = dict(interior_shell.R.ceils)
    legacy, missing = [], []
    mc_objs, gated, dropped = {}, [], []
    for id_, o in CI.R.objs.items():
        if id_ in NO_RECEIPT_INTERIOR: continue
        a, U = CI.R.obj_image(id_)
        png_img = Image.fromarray(a, 'RGBA')
        s = TB.gate_status(png_img, o.get('gate', 'low_furniture'))
        if s not in ('pass', 'prov'):
            dropped.append((id_, s[:80])); continue
        gated.append(id_)
        mc_objs[id_] = o
        cat_of.setdefault(id_, ('campus-misc', '캠퍼스 기타'))
    sub.objs.update(mc_objs)
    for fid, f in CI.R.floors.items(): sub.floors[fid] = f
    for wid, w in CI.R.walls.items(): sub.walls[wid] = w
    for id_ in reuse_ids:
        src = next((r for r in jp_regs if id_ in r.objs), None)
        if src is None: missing.append(id_); continue
        sub.objs[id_] = src.objs[id_]; legacy.append(id_)
        cat_of[id_] = JPCATS.BY_ID.get(id_, ('school-reuse', '학교(재사용)'))
    _Cats.BY_ID = cat_of
    # 바닥·벽면 영수증 확인(주기 그림)
    for fid, f in CI.R.floors.items():
        s = TB.gate_status(Image.fromarray(CI.R._canvas(f['draw'], f['cols'] * 16, f['rows'] * 16), 'RGBA'), 'terrain')
        if s not in ('pass', 'prov'): raise SystemExit('3/4 관문 미통과 바닥 %s — %s' % (fid, s))
    for wid, w in CI.R.walls.items():
        s = TB.gate_status(Image.fromarray(CI.R._canvas(w['draw'], w['cols'] * 16, 32), 'RGBA'), 'terrain')
        if s not in ('pass', 'prov'): raise SystemExit('3/4 관문 미통과 벽면 %s — %s' % (wid, s))
    report['interior_gate'] = dict(new_gated=len(gated), dropped_gate_fail=dropped, floors=len(CI.R.floors), walls=len(CI.R.walls), skipped_no_receipt=NO_RECEIPT_INTERIOR,
                                   legacy_reused=legacy, reuse_missing=missing)
    return sub


def bake(dry=False):
    report = collections.OrderedDict()
    pins = TB.Pins(P['pins'], TPR)
    O = TB.Outdoor(pins, TPR, 'mc', '캠퍼스')
    pieces = build_outdoor_pieces(report)
    for p in pieces: O.add_piece(p)
    ground = '걸을 수 있는 바닥(아래층).'
    O.finish_pieces(pieces, lambda p: p.get('role', 'prop'), ground)

    # ── 실내 ──
    sub = interior_sub_registry(report)
    b = sub.build()
    loc = {}
    for local, c in b['cells'].items():
        pc = c['pc']
        loc[local] = O.put('int/' + local, c['img'], pc, dict(label=c['label'], desc=(c['desc'] + ' — ' + BL.PCNOTE[pc] + '.')[:400], role='wall' if pc == 'solidfloor' else 'prop',
                                                          tags=['캠퍼스', '실내'] + list(c['tags']), rep='fixed', piece='interior'))
    n = lambda l: loc[l]
    it = b['interior']
    spec = dict(version=1, source='scripts/content/modern-campus/bake_mc.py (campus_interior.py + jp_city 학교 기물 재사용)', tileSize=16, blank=-1, void=n(it['void']),
                floors={}, walls={}, ceilings={}, objects={}, tables={}, lines={}, daises={}, goods={})
    for k, f in it['floors'].items(): spec['floors'][k] = dict(f, tiles=[n(t) for t in f['tiles']])
    for k, w in it['walls'].items(): spec['walls'][k] = dict(w, tiles=[n(t) for t in w['tiles']])
    for k, c in it['ceilings'].items(): spec['ceilings'][k] = [n(t) for t in c]
    for k, o in it['objects'].items(): spec['objects'][k] = dict(o, cells=[[dx, dy, n(l), layer] for dx, dy, l, layer in o['cells']])
    rooms = json.load(open(P['roomtable'], encoding='utf-8'))
    # 관문 미통과로 빠진 가구는 방 예제·새 물건 목록에서도 뺀다(없는 id 를 조수에게 보이지 않는다)
    have = set(spec['objects'])
    rooms['examples'] = [[a, b_, k, [[i, c] for i, c in items if i in have or not i.startswith('mc-')]] for a, b_, k, items in rooms['examples']]
    rooms['newObjectIds'] = [i for i in rooms.get('newObjectIds', []) if i in have]
    spec['rooms'] = rooms
    # 실내 키트·그룹(번호로 변환)
    extra_groups = []
    for g in b['groups']:
        tids = sorted({n(l) for l in g['cells']})
        extra_groups.append(dict(id=g['id'].replace('jp:', 'mc:'), name=g['name'], role=g['role'], tileIds=set(tids), description=g['desc'], placementRules=g['rules'].replace('jp_city', 'modern_campus')))
    extra_kits, expected = [], {}
    for k in b['kits']:
        a = k['ai']; grid = k['grid']
        rows = []
        for r in grid:
            lo = [-1] * len(r); up = [-1] * len(r)
            for x, l in enumerate(r):
                if l is None: continue
                (lo if b['cells'][l]['pc'] in TB.LOWER_PC else up)[x] = n(l)
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(snap=a['snap'], tags=['캠퍼스', '실내'] + list(a['tags']), description=a['description'][:400], placementRules=(a['placementRules'] or '방 짓기 도구가 놓는다.')[:400], repeatability='fixed', role='prop',
                  anchor=a['anchor'], layerHome='upper', origin='ai', confidence='high')
        extra_kits.append(dict(id=k['id'].replace('jp-in-', 'mc-in-'), kind='section', name=k['name'], width=len(grid[0]), height=len(grid), tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai))
    data, sheet, count = TB.finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, extra_groups, extra_kits)
    expected = {pid: pc['src'] for pid, pc in O.piece_cells.items() if pc['W'] * pc['H'] > 1 or pc['piece']['kind'] not in ('terrain', 'flat')}
    ver = TB.verify(data, sheet, TPR, expected)
    report['tiles'] = dict(count=count, rows=-(-count // TPR), sheetPx=[TPR * 16, -(-count // TPR) * 16], strips=len(data['animationStrips']), kits=len(data['structureKits']),
                           groups=len(data['tileGroups']), outdoor_pieces=len(pieces), interior_objects=len(spec['objects']), interior_floors=len(spec['floors']), interior_walls=len(spec['walls']))
    report.update(ver)
    # 팔레트: 야외 조각은 modern3 외 색이 있을 수 있다(보고만)
    out = dict(data=data, sheet=sheet, spec=spec, report=report)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['roomspec'], spec, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    pins.save()
    wr(P['report'], report, indent=1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry); r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'reassembly')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'])
    print('야외 관문', r['outdoor_gate']); print('실내 관문', {k: (v if not isinstance(v, list) else len(v)) for k, v in r['interior_gate'].items()})
