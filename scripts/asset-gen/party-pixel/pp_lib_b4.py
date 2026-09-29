"""retro2003 파티 도트(비인간형 걷기 칩 → 전투 9칸 시트) 공용 빌더 (r2w8).

pixelEnemySheets.ts 규격(3x3 셀, idle a·b·c / windup move attack / recover hit dead)을 그대로 따르되
**왼쪽(적 쪽)을 본다.** 그림은 pixel-enemy 의 오른쪽 보기 관례(pe_lib.Pen · pe_rig.cap/limb)로 그린 뒤
마지막에 칸마다 좌우 반전한다(반전은 정확한 픽셀 복사 — 리샘플 없음).
산출: public/assets/generated/party-pixel/<chip>.png,  QA: .omo/r2w8/<batch>/<chip>/
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pixel-enemy'))
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw, ImageOps  # noqa: E402
from pe_lib import Pen, NAMES, ROOT, BG  # noqa: E402,F401
from pe_rig import cap, put, clean, ik, limb, boot, leg_to, R, flip_grid, rot_grid, _isolated, _diff  # noqa: E402,F401

OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/r2w8'
CYCLE = [0, 1, 2, 1, 0, 1, 2, 1, 3, 4, 5, 6, 7, 8]
CYCLE_MS = [200] * 8 + [320, 220, 360, 260, 420, 1200]
BATCH = 'b4'


def build(chip, cell, colors, draw, flying=False, batch=BATCH, mirror=True):
    frames = []
    for n in NAMES:
        im = draw(n).im
        frames.append(im)
    errors = []
    base = cell - 4
    rep = {'chip': chip, 'cell': cell, 'flying': flying, 'baseline': base, 'frames': {}}
    for n, im in zip(NAMES, frames):
        box = im.getbbox()
        if not box:
            errors.append(f'{n} empty')
            continue
        if not (box[0] > 0 and box[1] > 0 and box[2] < cell and box[3] <= base + 1):
            errors.append(f'{n} bounds {box}')
        grounded = (n == 'dead') or not flying
        if grounded and n != 'move' and box[3] != base + 1:
            errors.append(f'{n} baseline {box[3] - 1}')
        if flying and n != 'dead' and box[3] > base - 1:
            errors.append(f'{n} not airborne')
        iso = _isolated(im)
        if iso:
            errors.append(f'{n} isolated px {iso}')
        rep['frames'][n] = {'bbox': list(box), 'size': [box[2] - box[0], box[3] - box[1]], 'bottom': box[3] - 1}
    mind = None
    for i in range(9):
        for j in range(i + 1, 9):
            d = _diff(frames[i], frames[j])
            if d == 0:
                errors.append(f'{NAMES[i]}=={NAMES[j]}')
            if mind is None or d < mind[0]:
                mind = (d, NAMES[i], NAMES[j])
    if mirror:
        frames = [ImageOps.mirror(f) for f in frames]
    sheet = Image.new('RGBA', (cell * 3, cell * 3))
    for i, im in enumerate(frames):
        sheet.paste(im, (i % 3 * cell, i // 3 * cell))
    palette = {c for _, c in sheet.getcolors(cell * cell * 9) if c[3]}
    if len(palette) > 16:
        errors.append(f'colors {len(palette)}')
    if not set(sheet.getchannel('A').tobytes()) <= {0, 255}:
        errors.append('alpha')
    rep.update(colors=len(palette), min_pair_diff=list(mind), errors=errors)
    OUT.mkdir(parents=True, exist_ok=True)
    qa = QA / batch / chip
    qa.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png')
    with Image.open(OUT / f'{chip}.png') as saved:
        if saved.convert('RGBA').tobytes() != sheet.tobytes():
            errors.append('reload mismatch')
    # preview: 3x3 sheet, 총 폭 ≤ 1800px
    sc = 1800 // (cell * 3)
    board = Image.new('RGBA', sheet.size, BG)
    board.alpha_composite(sheet)
    board = board.convert('RGB').resize((cell * 3 * sc, cell * 3 * sc), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(board)
    for q in range(0, cell * 3 * sc, cell * sc):
        d.line((q, 0, q, board.height - 1), fill='#586078')
        d.line((0, q, board.width - 1, q), fill='#586078')
    for i, n in enumerate(NAMES):
        x, y = i % 3 * cell * sc, i // 3 * cell * sc
        d.text((x + 6, y + 5), n, fill='#d6cddc')
        d.line((x + 2, y + (base + 1) * sc, x + cell * sc - 3, y + (base + 1) * sc), fill='#39465e')
    board.save(qa / 'preview.png')
    gif = []
    for i in CYCLE:
        im = Image.new('RGBA', (cell, cell), BG)
        im.alpha_composite(frames[i])
        gif.append(im.convert('RGB').resize((cell * 3, cell * 3), Image.Resampling.NEAREST))
    gif[0].save(qa / 'cycle.gif', save_all=True, append_images=gif[1:], duration=CYCLE_MS, loop=0, disposal=2, optimize=False)
    (qa / 'validation.json').write_text(json.dumps(rep, indent=2, ensure_ascii=False) + '\n')
    print(f"{chip}: cell={cell} colors={len(palette)} minDiff={mind[0]}({mind[1]}/{mind[2]}) errors={errors or 'none'}")
    if errors:
        raise SystemExit(1)
    return frames
