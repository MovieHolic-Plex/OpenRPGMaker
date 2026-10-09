# 버들항 화풍 웨이브 5 — 전투 배경 도시 6장(640x360). 다시 돌리면 같은 그림.   python3 make_battle_bg.py
#   1) copy_fn.py  — 각 장소의 그림 함수 모듈을 src-<장소>/ 로 복사(원본은 읽기만), 버들항 원본 조각은 src-beodeul/sprites/
#   2) bg_<장소>.py — 장소마다 따로 실행(장소별 복사본 모듈 이름이 겹쳐서 프로세스를 나눈다)
#   3) compare-ref.png — [전투 배경 | 같은 장소 맵 렌더 1x 크롭]   4) check-overlay.png — 가짜 전투원(적 3·아군 4, 48x48) 겹침
import os, sys, subprocess
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw
import bgcommon as B

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
VAR = os.path.dirname(HERE)
JOBS = [('beodeul-port', 'bg_port.py', 'tiledata/beodeul-city/render/city6_base.png', (880, 540, 1360, 900)),
        ('ruined-village', 'bg_ruined.py', 'tiledata/beodeul-variants/ruined-village/render-1x.png', (360, 100, 840, 460)),
        ('rain-ruin-town', 'bg_rain.py', 'tiledata/beodeul-variants/rain-ruin-town/render-1x.png', (230, 0, 710, 360)),
        ('empire-city', 'bg_empire.py', 'tiledata/beodeul-variants/empire-city/render-1x.png', (400, 0, 880, 360)),
        ('mansion-art-city', 'bg_mansion.py', 'tiledata/beodeul-variants/mansion-art-city/render-1x.png', (0, 0, 480, 360)),
        ('eastern-castle', 'bg_eastern.py', 'tiledata/beodeul-variants/eastern-castle/render-1x.png', (440, 0, 920, 360))]
ENEMY = [(150, 196), (100, 250), (176, 282)]          # 적: 왼쪽
ALLY = [(410, 196), (466, 226), (420, 262), (480, 290)]   # 아군: 오른쪽 아래


def run_all(only=None):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    subprocess.run([sys.executable, os.path.join(HERE, 'copy_fn.py')], check=True, env=env, stdout=subprocess.DEVNULL)
    for slug, script, _, _ in JOBS:
        if only and slug not in only: continue
        subprocess.run([sys.executable, os.path.join(HERE, script), os.path.join(HERE, slug + '.png')], check=True, env=env)


def compare_ref():
    rows = []
    for slug, _, ref, box in JOBS:
        bg = Image.open(os.path.join(HERE, slug + '.png')).convert('RGB')
        rf = Image.open(os.path.join(ROOT, ref)).convert('RGB').crop(box)
        rows.append((slug, bg, rf, ref))
    W = 640 + 8 + 480; Hh = len(rows) * (360 + 18)
    sh = Image.new('RGB', (W, Hh), (24, 24, 30)); d = ImageDraw.Draw(sh)
    for i, (slug, bg, rf, ref) in enumerate(rows):
        y = i * 378
        d.text((4, y + 3), '%s  (battle bg 1x)' % slug, fill=(235, 235, 235))
        d.text((652, y + 3), 'map render 1x: %s' % ref.replace('tiledata/', ''), fill=(235, 235, 235))
        sh.paste(bg, (0, y + 18)); sh.paste(rf, (648, y + 18))
    sh.save(os.path.join(HERE, 'compare-ref.png'))


def check_overlay():
    cols = 2; sh = Image.new('RGB', (cols * 640 + 8, 3 * 360 + 16), (24, 24, 30))
    for i, (slug, _, _, _) in enumerate(JOBS):
        bg = Image.open(os.path.join(HERE, slug + '.png')).convert('RGBA')
        ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        for (x, y) in ENEMY: d.rectangle((x, y, x + 47, y + 47), fill=(230, 40, 40, 110), outline=(255, 90, 90, 255))
        for (x, y) in ALLY: d.rectangle((x, y, x + 47, y + 47), fill=(40, 120, 240, 110), outline=(110, 170, 255, 255))
        d.rectangle((120, 190, 560, 330), outline=(255, 230, 60, 255))                 # 배틀러 자리(키 큰 물체·밝은 점 금지)
        d.line((0, 165, 639, 165), fill=(255, 255, 255, 120)); d.line((0, 185, 639, 185), fill=(255, 255, 255, 120))
        d.rectangle((0, 340, 639, 359), fill=(0, 0, 0, 150))                           # 하단 HUD 가림
        d.text((4, 3), slug, fill=(255, 255, 255, 255))
        bg.alpha_composite(ov)
        sh.paste(bg.convert('RGB'), ((i % cols) * 648, (i // cols) * 368))
    sh.save(os.path.join(HERE, 'check-overlay.png'))


if __name__ == '__main__':
    only = sys.argv[1:] or None
    run_all(only)
    compare_ref(); check_overlay()
    for slug, _, _, _ in JOBS: print(slug, B.check(os.path.join(HERE, slug + '.png')))
