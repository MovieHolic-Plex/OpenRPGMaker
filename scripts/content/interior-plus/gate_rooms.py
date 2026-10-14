"""조립 방 관문 — 바닥·벽면 칸은 혼자서 윗면을 보일 수 없는 부품이라, 그 칸을 화소 그대로 품은 「방 한 칸」 그림을
object-gate(kind structure)에 낸다(gothic-manor assemble.py · jp-city gate_assembled.py 와 같은 규칙). 바닥·벽면을 한 화소라도
다시 그리면 조립 그림 해시가 바뀌어 덮임이 풀린다(굽기가 다시 그려 영수증을 찾는다).

판정 상태(jp-city gate_kinds.state 와 같은 뜻):
  pass        — 보정된 프로필의 PASS
  provisional — 현재 프로필(아직 보정 전)의 PASS → 임시 통과, 보고에 「미보정 프로필 임시」로 적는다
  그 밖(영수증 없음·FAIL·옛 프로필·다른 종류)은 막는다.

  python3 gate_rooms.py           → _gate/_rooms/*.png 저장 + 상태 표
"""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import iplib
from PIL import Image
sys.path.insert(0, os.path.join(iplib.ROOT, 'src', 'harnesses', '_core'))
sys.path.insert(0, os.path.join(iplib.ROOT, 'scripts', 'content', 'hand-interior-pick'))

OUT = os.path.join(iplib.TD, '_gate', '_rooms')
# 벽면 → 그 벽 밑에 까는 바닥(둘이면 왼쪽 반·오른쪽 반). 바닥 다섯·벽면 넷을 모두 한 번 이상 품는다.
ROOMS = [('hull', ('deck', 'hold'), '범선 선체 판자 벽 방(갑판 판자·짐칸 판자 바닥)'),
         ('cabin', ('deck',), '선장실 판벽 방(갑판 판자 바닥)'),
         ('gallery', ('parquet',), '미술관 벽지 전시실(쪽모이 마루)'),
         ('arenawall', ('sand', 'sandstone'), '투기장 사암 벽 마당(모래·사암 포석 바닥)')]
W, FLOOR_ROWS = 10, 4


def room_image(reg, wid, floors):
    import bake
    from palette_snap import snap
    wd = reg.walls[wid]
    H = 1 + 2 + FLOOR_ROWS                      # 맨 윗줄 = 막힌 천장 띠(어두운 판), 벽면 두 줄, 바닥
    im = Image.new('RGBA', ((W + 2) * 16, (H + 1) * 16), (0, 0, 0, 0))
    dark = Image.new('RGBA', (16, 16), (28, 20, 24, 255))
    for x in range(W + 2):
        im.paste(dark, (x * 16, 0)); im.paste(dark, (x * 16, H * 16))
    for y in range(H + 1):
        im.paste(dark, (0, y * 16)); im.paste(dark, ((W + 1) * 16, y * 16))
    for x in range(W):
        for row in (1, 2):
            im.paste(bake.wall_tile(wd, x % wd['cols'], row, x == 0), ((x + 1) * 16, row * 16))
    for y in range(FLOOR_ROWS):
        for x in range(W):
            fid = floors[0] if len(floors) == 1 or x < W // 2 else floors[1]
            fd = reg.floors[fid]
            sh = (1 if y == 0 else 0) | (2 if x == 0 else 0)
            im.paste(bake.floor_tile(fd, x % fd['cols'], y % fd['rows'], sh), ((x + 1) * 16, (3 + y) * 16))
    return snap(im)[0]


def rooms(reg):
    return [dict(label=f'atlas_biome_interior/plus/room-{wid}', kind='structure', img=room_image(reg, wid, floors),
                 name=f'{ko} — 바닥·벽면 조립(위에서 본 3/4 방 한 칸)', covers=[('wall', wid)] + [('floor', f) for f in floors])
            for wid, floors, ko in ROOMS]


_CUR = None
def current_profile():
    global _CUR
    if _CUR: return _CUR
    out = subprocess.run(['npm', 'run', 'harness', '--', 'object-gate', 'status'], cwd=iplib.ROOT, capture_output=True, text=True).stdout
    m = re.search(r'현재 규칙 프로필 ([0-9a-f]{16})', out)
    if not m: raise RuntimeError('현재 판정 프로필 해시를 못 읽었다(object-gate status)')
    _CUR = m.group(1); return _CUR


def state(img, kind):
    """('pass'|'provisional', None) 또는 (None, 이유)."""
    import object_gate as OG
    rc = OG.read_receipt(OG.pixel_sha256(img))
    if not rc: return None, '영수증 없음 — object-gate review 를 먼저 받아라'
    if rc.get('kind') != kind: return None, f"영수증 종류({rc.get('kind')})가 요청 종류({kind})와 다르다"
    cal = OG.calibrated_profiles()
    if rc.get('profileHash') != current_profile() and rc.get('profileHash') not in cal:
        return None, f"옛 판정 프로필({rc.get('profileHash')}) 영수증 — 다시 판정받아라"
    if rc.get('verdict') != 'pass': return None, '불합격(' + ' · '.join(rc.get('reasons') or ['fail']) + ')'
    return ('pass' if rc.get('profileHash') in cal else 'provisional'), None


def check(reg):
    """기물 + 조립 방 전부. {'pass':[], 'provisional':[], 'bad':[(label, why)]}"""
    res = {'pass': [], 'provisional': [], 'bad': []}
    items = [(f'atlas_biome_interior/plus/{pid}', iplib.render(reg.pieces[pid]), reg.pieces[pid]['gate']) for pid in reg.order]
    items += [(r['label'], r['img'], r['kind']) for r in rooms(reg)]
    for label, img, kind in items:
        st, why = state(img, kind)
        (res[st].append(label) if st else res['bad'].append((label, why)))
    return res


def require_structure(reg):
    """굽기 관문: 기물과 조립 방이 모두 pass/provisional 이어야 한다. 아니면 SystemExit(이유 전부)."""
    res = check(reg)
    print(f"[3/4 관문] 기물 {len(reg.order)} + 조립 방 {len(ROOMS)}: 통과 {len(res['pass'])} · 미보정 프로필 임시통과 {len(res['provisional'])} · 막힘 {len(res['bad'])}")
    if res['bad']:
        raise SystemExit('3/4 관문 막힘:\n' + '\n'.join(f'  {l}: {w}' for l, w in res['bad']))
    return res


if __name__ == '__main__':
    import loader
    reg = loader.load(); os.makedirs(OUT, exist_ok=True)
    for r in rooms(reg):
        p = os.path.join(OUT, r['label'].split('/')[-1] + '.png'); r['img'].save(p)
        print(p, r['img'].size, state(r['img'], 'structure'))
