"""m5 검사·확인판: 칩 시트·전투 시트·이펙트 규격과 묶음 파일 레이어 키 검사, 크기 비교판(c)."""
import json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[3]
QA = ROOT / '.omo/nm5'
FX = ROOT / 'public/assets/generated/pixel-fx'
errs = []
ts = (ROOT / 'src/assets/retroRosterSkills/m5.ts').read_text()
skills = re.findall(r'\{ id: "(\w+)", classId: "(\w+)", actorId: "(\w+)", name: "([^"]+)", level: (\d+), motion: "([\w-]+)"', ts)
layers = re.findall(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', ts)
by = {}
for s in skills:
    by.setdefault(s[1], []).append(s)
if len(skills) != 64: errs.append(f'skills {len(skills)}')
if len({s[0] for s in skills}) != 64: errs.append('dup ids')
for cid, ss in by.items():
    lv = [int(s[4]) for s in ss]
    if lv != [1, 3, 5, 7, 10, 12, 16, 22]: errs.append(f'{cid} levels {lv}')
    if ss[-1][5] != 'finisher': errs.append(f'{cid} last not finisher')
    mo = {s[5] for s in ss}
    if len(mo) < 4: errs.append(f'{cid} motions {mo}')
    if 'blink-strike' in mo: errs.append(f'{cid} blink')
    key = cid.replace('class_', '')
    for s in ss:
        if s[0] != 'skill_' + key + s[0][len('skill_' + key):] or not s[0].startswith('skill_' + key + '_'): errs.append(f'id {s[0]}')
        if s[2] != 'actor_' + key: errs.append(f'actor {s[2]}')
# 기존 정의와 frame·frames 일치
known = {}
for f in [ROOT / 'src/assets/retroClassSkills.ts', ROOT / 'src/assets/retroMonsterSkills.ts'] + sorted((ROOT / 'src/assets/retroRosterSkills').glob('*.ts')):
    if f.name == 'm5.ts': continue
    for k, a, fr, n in re.findall(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', f.read_text()):
        known.setdefault(k, set()).add((int(fr), int(n)))
newk = set()
for k, a, fr, n in layers:
    fr, n = int(fr), int(n)
    if k in known:
        if (fr, n) not in known[k]: errs.append(f'{k} spec {(fr, n)} vs {known[k]}')
    else:
        newk.add(k)
        if not any(k.startswith(p + '_') for p in [c.replace('class_', '') for c in by]): errs.append(f'new key prefix {k}')
    p = FX / f'{k}.png'
    if not p.exists():
        errs.append(f'missing {k}'); continue
    im = Image.open(p)
    if im.size != (fr * n, fr): errs.append(f'{k} size {im.size} != {(fr * n, fr)}')
    if a == 'screen' and fr != 128: errs.append(f'{k} screen not 128')
    if a == 'projectile' and fr != 32: errs.append(f'{k} projectile not 32')
# 스킬당 새 시트 ≤1
for m in re.finditer(r'\{ id: "(\w+)".*?layers: \[(.*?)\] \}', ts):
    ks = re.findall(r'key: "(\w+)"', m.group(2))
    if sum(k in newk for k in ks) > 1: errs.append(f'{m.group(1)} new sheets > 1')
for k in newk:
    if not (ROOT / f'scripts/asset-gen/pixel-fx/{k}.py').exists(): errs.append(f'no generator {k}')
    a = np.array(Image.open(FX / f'{k}.png').convert('RGBA'))
    if not np.isin(a[:, :, 3], (0, 255)).all(): errs.append(f'{k} alpha')
    if len({tuple(v) for v in a[a[:, :, 3] == 255][:, :3]}) > 16: errs.append(f'{k} colors')
# 전투 시트
pp = re.findall(r'chip: "(monster5-\d)", cell: (\d+), motion: "(\w+)", idleFrameMs: (\d+), rows: (\d)', ts)
if len(pp) != 8: errs.append('partyPixel rows')
for chip, cell, mo, ms, rows in pp:
    a = np.array(Image.open(ROOT / f'public/assets/generated/party-pixel/{chip}.png'))
    cell = int(cell)
    if a.shape != (cell * 5, cell * 3, 4): errs.append(f'{chip} shape {a.shape}')
    if not np.isin(a[:, :, 3], (0, 255)).all(): errs.append(f'{chip} alpha')
    if len({tuple(v) for v in a[a[:, :, 3] == 255][:, :3]}) > 16: errs.append(f'{chip} colors')
    cells = [a[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell].tobytes() for r in range(5) for c in range(3)]
    if len(set(cells)) != 15: errs.append(f'{chip} dup cells')
# 칩 시트
cs = np.array(Image.open(ROOT / 'public/assets/generated/charsets/Monster5.png'))
if cs.shape != (256, 288, 4): errs.append('charset shape')
print('skills', len(skills), 'layers', len(layers), 'new sheets', len(newk), 'reused', len({k for k, *_ in layers} - newk))
print('errors:', errs or 'none')

# (c) 크기 비교판: actor1-0 대기 칸 + 8명 대기 칸, 같은 4배
S = 4
act = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
tiles = [('actor1-0', act)] + [(f'monster5-{i}', Image.open(ROOT / f'public/assets/generated/party-pixel/monster5-{i}.png').convert('RGBA').crop((0, 0, 48, 48))) for i in range(8)]
W = len(tiles) * 48 * S // 2
bg = Image.new('RGBA', (len(tiles) * 48 * 2 + 8, 48 * 2 + 14), (32, 40, 64, 255))
d = ImageDraw.Draw(bg)
for i, (n, im) in enumerate(tiles):
    bg.alpha_composite(im.resize((96, 96), Image.NEAREST), (i * 96, 0))
    d.text((i * 96 + 2, 98), n, fill=(210, 210, 230, 255))
d.line([(0, 44 * 2 + 1), (bg.width, 44 * 2 + 1)], fill=(90, 100, 140, 255))
bg.save(QA / 'c-size-compare.png')
# (b) 캐릭터별 판을 한 장에(2배로 축소해 1900 이하 두 장)
for part, ids in (('1', range(4)), ('2', range(4, 8))):
    ims = [Image.open(QA / f'board-monster5-{i}.png') for i in ids]
    ims = [im.resize((im.width // 2, im.height // 2), Image.NEAREST) for im in ims]
    out = Image.new('RGBA', (sum(im.width for im in ims) + 30, ims[0].height), (0, 0, 0, 255))
    x = 0
    for im in ims:
        out.paste(im, (x, 0)); x += im.width + 10
    out.save(QA / f'b-battle-{part}.png')
print('boards ok', bg.size)
sys.exit(1 if errs else 0)

