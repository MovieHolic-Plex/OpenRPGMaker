"""슈퍼하네스 데모에서 이미 독립 native 검수를 통과해 실제 장면에 쓰인 원본(tiledata/wizarding/native)을 조각으로 등록한다.
그림은 손대지 않는다(원본 화소 그대로). 칸 크기(16의 배수)가 아닌 미세 조각(덕트 4×8 등)과 장면 전용 큰 합성 벽은 넣지 않는다 —
그 자리는 castle_kit 의 공용 벽이 맡는다. 같은 줄 프레임(약 반응 1~6, 촛불 0~3, 세척 0~3, 지팡이 반응)은 애니메이션 조각이 된다.
  python3 scripts/content/wizarding/pieces/native.py
"""
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image  # noqa: E402
from wzlib import REG, TD, run_module  # noqa: E402

MODULE = 'native'
NATIVE = os.path.join(TD, 'native')
# 같은 이름의 수선판이 여럿이면 마지막 판 하나만(데모 최종 레시피가 쓴 것)
SKIP = {'dark_timber_wall', 'dark_timber_wall__scene-junction-repair-rev7', 'dark_timber_wall__scene-spec-repair-r4-prep-rev4',
        'theme_potions_repair_r5_joined_low_vault', 'theme_potions_repair_v2_low_vault', 'theme_potions_repair_v2_scene_stone_wall',
        'theme_potions_repair_r7_low_vault_exhaust', 'theme_potions_repair_r7_low_vault_exhaust__repair-r7-material-lineage-prep',
        'wandtrial_shelves'}
ANIMS = [  # (파일 이름, 키 정규식 → 묶음 이름, fps)
    ('theme_potions_potion_response', r'^(bubble|steam|green|purple|amber|bottle)-(\d)$', 6),
    ('theme_potions_hood_lighting', r'^(candle)(\d)$', 6),
    ('theme_potions_stone_wash', r'^(rinse)(\d)$', 5),
    ('wandtrial_response', r'^(emit|travel|absorb|fade|end)$', 6),
    ('wand_response_extra', r'^(emit-unfurl|absorb-break|settle)$', 5),
]
KO = {'bench': '오크 작업대', 'cauldron-burner-stirrer': '버너 위 가마솥과 교반봉', 'table': '교탁', 'blackboard': '칠판', 'counter': '오크 카운터',
      'drawers': '재료 서랍장', 'glass-display': '유리 시약 진열장', 'dried-herbs': '말린 약초 장', 'stair': '남쪽 계단', 'ladder': '재고 사다리',
      'target': '지팡이 시험 표적', 'recess': '깊은 진열창', 'window': '낮은 납살 창'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def walk_for(item, sl, img):
    """층·발밑 정보 → walk 문자열. 빈 칸 '.'."""
    w, h = img.width // 16, img.height // 16
    L = sl.get('layer'); key = sl['key']; name = item
    foot_h = (sl.get('foot') or [0, 0])[1] or 1
    rows = []
    for y in range(h):
        r = ''
        for x in range(w):
            cell = img.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16))
            A = cell.getchannel('A')
            if not A.getbbox(): r += '.'; continue
            full = A.getextrema()[0] == 255
            if L == 0 or 'boards' in name or 'stone_floor' in name: r += 'F' if full else 'f'
            elif 'open' in key and ('door' in name): r += 'C'
            elif 'wall' in name and L in (1, 3): r += 'S'
            elif L == 1 and 'wall' in name: r += 'S'
            elif L == 2 or ('door' in name) or key in ('target', 'table', 'counter', 'west-run', 'east-run', 'west', 'east', 'north'):
                r += 'S' if y >= h - foot_h else 'C'
            else: r += 'C'
        rows.append(r)
    return rows


def family_for(item, key):
    if any(k in item for k in ('response', 'hood_lighting', 'stone_wash')) and re.search(r'\d|emit|travel|absorb|fade|end|settle', key): return 'effects'
    if 'wall' in item or 'door' in item or 'window' in item or 'ceiling' in item or 'stair' in item: return 'architecture'
    if 'floor' in item or 'boards' in item: return 'surfaces'
    return 'furniture'


def pad16(im):
    w, h = im.size
    W, H = -(-w // 16) * 16, -(-h // 16) * 16
    if (W, H) == (w, h): return im
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.paste(im, (0, H - h)); return out


def register():
    for space_dir, space, pre in (('wandshop', 'wandshop', 'wz-nv-wand-'), ('potions', 'potions', 'wz-nv-pot-')):
        d = os.path.join(NATIVE, space_dir)
        for fn in sorted(os.listdir(d)):
            if not fn.endswith('.json'): continue
            item = fn[:-5]
            if item in SKIP: continue
            meta = json.load(open(os.path.join(d, fn), encoding='utf-8'))
            sheet = Image.open(os.path.join(d, item + '.png')).convert('RGBA')
            slots = (meta.get('set') or {}).get('slots') or []
            base = slug(item.replace('theme_potions_', '').split('__')[0])
            anim = next((a for a in ANIMS if a[0] == item), None)
            groups = {}
            for sl in slots:
                if sl.get('x') is None: continue
                if sl['w'] % 16 or sl['h'] > 112 or sl['h'] < 8: continue
                crop = pad16(sheet.crop((sl['x'], sl['y'], sl['x'] + sl['w'], sl['y'] + sl['h'])))
                if not crop.getchannel('A').getbbox(): continue
                if anim:
                    m = re.match(anim[1], sl['key'])
                    if m:
                        g = m.group(1) if m.groups() and m.group(1) and not anim[0].startswith('wand') else 'seq'
                        groups.setdefault(g, []).append((sl, crop)); continue
                pid = pre + base + '-' + slug(sl['key'])
                if pid in REG.pieces: continue
                walk = walk_for(item, sl, crop)
                label = KO.get(sl['key'], sl['key'])
                desc = ((meta.get('set') or {}).get('description') or '')[:200]
                _add(pid, f"{base} · {label}", crop, walk, family_for(item, sl['key']), space, desc, 1, [crop])
            for g, lst in groups.items():
                frames = [c for _, c in lst]
                if len({f.size for f in frames}) != 1: continue
                pid = pre + base + '-' + slug(g) + '-anim'
                walk = ['C' * (frames[0].width // 16)] * (frames[0].height // 16)
                if 'stone_wash' in item: walk = walk_for(item, lst[0][0], frames[0])
                _add(pid, f"{base} · {g} {len(frames)}프레임", frames[0], walk, 'effects', space,
                     f'승인 native {item} 의 {g} 프레임 {len(frames)}장을 순서대로 이은 애니메이션.', len(frames), frames, fps=anim[2])


def _add(pid, name, first, walk, family, space, desc, nframes, frames, fps=6):
    w, h = first.width // 16, first.height // 16
    def used(x, y):
        return any(f.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)).getchannel('A').getbbox() for f in frames)
    walk = [''.join((walk[y][x] if walk[y][x] != '.' else 'C') if used(x, y) else '.' for x in range(w)) for y in range(h)]
    role = 'wall' if family == 'architecture' else 'terrain' if family == 'surfaces' else 'prop'

    def draw(c, f=0):
        c.blit(frames[f], 0, 0)
    fn = (lambda c, f: draw(c, f)) if nframes > 1 else (lambda c: draw(c))
    REG.piece(pid, name, w, h, walk, family, space, desc=desc or name, rules='승인된 데모 원본 그대로. 같은 공간 예제의 배치를 따른다.',
              tags=['native', space], role=role, frames=nframes, fps=fps)(fn)


register()

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
