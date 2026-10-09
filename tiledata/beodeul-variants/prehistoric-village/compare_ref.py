# 비교 시트 compare-ref.png (보정 패스 2026-10-08): 같은 2배율로 [이전 판 | 새 판] — 달라진 곳만 잘라 나란히.
#   1줄 = 화산 분지: 곧은 세로 금·네모 재 바닥 → 고원으로 번진 화산재 덩이(autotile-ashsoil) + 용암 웅덩이 둘(autotile-lavapool)
#   2줄 = 서쪽 숲: 같은 두 나무 반복 → 나무고사리 변형 3·야자 변형 3 섞임 + 고사리 늪 웅덩이(autotile-bogpool)
#   3줄 = 동쪽 숲 + 작은 늪
#   4줄 = 남쪽 숲 띠(울타리 밖)
#   5줄 = 기준: 깊은 숲길 숲(deep-forest-path) | 새 숲 (질감·윤곽·채도 맞춤 확인)
#   python3 compare_ref.py   (이전 판은 웨이브 2 커밋 a1cec928f8 의 render-1x.png 를 git 에서 읽는다)
import os, io, subprocess
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(HERE, '..', '..')) + '/'
OLD_REV = 'a1cec928f8'

old = Image.open(io.BytesIO(subprocess.check_output(['git', 'show', OLD_REV + ':tiledata/beodeul-variants/prehistoric-village/render-1x.png'], cwd=HERE))).convert('RGB')
new = Image.open(os.path.join(HERE, 'render-1x.png')).convert('RGB')


def cr(im, x, y, w=240, h=180): return im.crop((x, y, x + w, y + h)).resize((w * 2, h * 2), Image.NEAREST)


def ref(p, x, y): return cr(Image.open(R + p).convert('RGB'), x, y)


rows = [('BEFORE basin: straight ash edge, square floor', cr(old, 420, 20), 'AFTER: ash-soil autotile spills onto plateau + 2 lava pools', cr(new, 420, 20)),
        ('BEFORE west forest: 2 tree shapes repeat', cr(old, 0, 380), 'AFTER: 3 tree-fern + 3 palm variants, bog pool', cr(new, 0, 380)),
        ('BEFORE east forest', cr(old, 912, 330), 'AFTER: variants + small bog pool', cr(new, 912, 330)),
        ('BEFORE south forest strip', cr(old, 600, 650), 'AFTER', cr(new, 600, 650)),
        ('REF deep-forest-path forest', ref('beodeul-variants/deep-forest-path/render-1x.png', 330, 230), 'AFTER: west forest (same 2x)', cr(new, 120, 420))]
o = Image.new('RGB', (480 * 2 + 30, sum(r[1].height + 22 for r in rows) + 8), (28, 28, 34)); d = ImageDraw.Draw(o); y = 8
for la, A_, lb, B_ in rows:
    d.text((10, y), la, fill=(230, 230, 230)); d.text((480 + 20, y), lb, fill=(230, 230, 230))
    o.paste(A_, (10, y + 14)); o.paste(B_, (480 + 20, y + 14)); y += A_.height + 22
o.save(os.path.join(HERE, 'compare-ref.png')); print(o.size)
