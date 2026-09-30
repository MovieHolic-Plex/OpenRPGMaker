"""C(글자 = 픽셀) 결과를 Sonnet 5.5(medium)에게 손질시키는 후처리 실험.

  python3 scripts/content/atlas-pick/ascii_post.py prep      # 보기용 확대 그림·지시문
  python3 scripts/content/atlas-pick/ascii_post.py run       # claude -p 9개 병렬
  python3 scripts/content/atlas-pick/ascii_post.py render    # 손질본 → PNG, 변경량
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
D = ROOT / 'tiledata/atlas-pick/ascii-pixelize'
P = D / 'post'


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def to_img(text, legend):
    rows = text.rstrip('\n').split('\n')
    im = Image.new('RGBA', (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in legend:
                im.putpixel((x, y), hexrgb(legend[c]) + (255,))
    return im


def zoom_grid(im, s=12):
    big = Image.new('RGBA', im.size, (70, 70, 80, 255)); big.alpha_composite(im)
    big = big.resize((im.width * s, im.height * s), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for x in range(0, big.width, s):
        d.line([(x, 0), (x, big.height)], fill=(0, 0, 0, 60) if (x // s) % 4 else (0, 0, 0, 140))
    for y in range(0, big.height, s):
        d.line([(0, y), (big.width, y)], fill=(0, 0, 0, 60) if (y // s) % 4 else (0, 0, 0, 140))
    return big


PROMPT = """너는 16px 도트 작가다. 생성 그림을 기계로 줄인 도트를 **손질**한다. 도구는 Read·Write 만 쓴다.

대상: {name} ({w}×{h}px). 현대 도시 RPG 맵 소품, 빛은 왼쪽 위.
1. Read {src} — 원래 생성 그림(참고만, 크게 줄이기 전 모습).
2. Read {zoom} — 지금 도트를 12배 확대한 것(격자 4칸마다 진한 선).
3. Read {txt} — 지금 도트의 글자 격자. 한 글자 = 한 픽셀. '.' = 투명.
   색 글자(어두움→밝음): {legend}

할 일: 같은 크기({w}열 × {h}줄), 같은 글자만 써서 손질한 격자를 Write {out} 에 쓴다(격자만, 다른 글 없이).
그다음 Write {notes} 에 무엇을 고쳤는지 한국어 5줄 이내.

손질 기준(도트 작가가 하는 일):
- 외곽선: 바깥 윤곽을 끊김 없는 한 겹으로. 계단이 들쭉날쭉한 곳(1-2-1-3 같은)을 고른 계단으로. 윤곽 바깥에 떨어진 외톨이 점은 지운다.
- 잡티: 넓은 면 안의 외톨이 한 점·체크무늬 얼룩을 없애고 면을 깨끗이. 명암 덩어리는 왼쪽 위가 밝고 오른쪽 아래가 어둡게 정돈.
- 작은 정보는 살린다: 창·불빛·버튼·바퀴·얼굴처럼 1~2px 정보가 뭉개졌으면 읽히게 다시 찍는다. 좌우 대칭인 물건은 대칭을 맞춘다.
- 모양·크기·시점은 바꾸지 마라. 글자 격자 밖 새 글자 금지. 줄 수·열 수가 정확해야 한다.
"""


def prep():
    res = json.loads((D / 'result.json').read_text(encoding='utf-8'))
    jobs = []
    for r in res:
        n = r['name']
        text = (D / f'{n}.txt').read_text(encoding='utf-8')
        legend = r['legend']
        zoom_grid(to_img(text, legend)).save(P / f'{n}-zoom.png')
        src = Image.open(D / f'{n}-src.png'); src.thumbnail((360, 360)); src.save(P / f'{n}-src.png')
        leg = ', '.join(f"'{k}'={v}" for k, v in sorted(legend.items(), key=lambda kv: sum(hexrgb(kv[1]))))
        rel = lambda p: str(p.relative_to(ROOT))
        prompt = PROMPT.format(name=n, w=r['target'][0], h=r['target'][1], src=rel(P / f'{n}-src.png'),
                               zoom=rel(P / f'{n}-zoom.png'), txt=rel(D / f'{n}.txt'), legend=leg,
                               out=rel(P / f'{n}.txt'), notes=rel(P / f'{n}.notes.md'))
        (P / f'{n}.prompt.md').write_text(prompt, encoding='utf-8')
        jobs.append(n)
    return jobs


def run_one(n):
    prompt = (P / f'{n}.prompt.md').read_text(encoding='utf-8')
    r = subprocess.run(['claude', '-p', '--model', 'sonnet', '--effort', 'medium',
                        '--allowedTools', 'Read,Write', '--output-format', 'json', prompt],
                       cwd=ROOT, capture_output=True, text=True, timeout=1800)
    (P / f'{n}.run.json').write_text(r.stdout or r.stderr, encoding='utf-8')
    return n, r.returncode


def render():
    res = json.loads((D / 'result.json').read_text(encoding='utf-8'))
    out = []
    for r in res:
        n = r['name']; f = P / f'{n}.txt'
        if not f.exists():
            out.append({'name': n, 'error': 'no output'}); continue
        before = (D / f'{n}.txt').read_text(encoding='utf-8').rstrip('\n').split('\n')
        after = f.read_text(encoding='utf-8').strip('\n').split('\n')
        tw, th = r['target']
        shape_ok = len(after) == th and all(len(a) == tw for a in after)
        bad = sorted({c for a in after for c in a if c != '.' and c not in r['legend']})
        changed = sum(1 for y in range(min(th, len(after))) for x in range(min(tw, len(after[y])))
                      if after[y][x] != before[y][x])
        if shape_ok and not bad:
            to_img('\n'.join(after), r['legend']).save(P / f'{n}-post.png')
        cost = None
        try:
            cost = json.loads((P / f'{n}.run.json').read_text(encoding='utf-8')).get('total_cost_usd')
        except Exception:
            pass
        out.append({'name': n, 'shape_ok': shape_ok, 'bad_chars': bad, 'changed_px': changed,
                    'changed_pct': round(100 * changed / (tw * th), 1), 'cost_usd': cost})
    (P / 'post-result.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for o in out:
        print(o)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'prep':
        print(prep())
    elif cmd == 'run':
        jobs = prep()
        with ThreadPoolExecutor(9) as ex:
            for n, rc in ex.map(run_one, jobs):
                print(n, rc, flush=True)
    elif cmd == 'render':
        render()
