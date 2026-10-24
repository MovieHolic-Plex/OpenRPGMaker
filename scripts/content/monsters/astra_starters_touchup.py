#!/usr/bin/env python3
"""아스트라 호라이즌 새 스타터 3종(2026-10-23)의 64px 얼굴 손질 — 생성 → 격자 도트화 뒤 마지막 한 겹.

생성 그림(god-tibo 대신 Antigravity gemini-3.1-flash-image)을 하네스 `import` 로 격자 도트화하면 64 캔버스로 줄이며
눈·입이 뭉개진다. 판정단(Opus 3 + Argon 1) 지적대로 눈·코·입·불꽃 끝 같은 몇 칸만 손으로 다시 찍는다.

  python3 scripts/content/monsters/astra_starters_touchup.py --out-dir /tmp/x     미리보기(저장소 무변경)
  python3 scripts/content/monsters/astra_starters_touchup.py --apply             authored/<종>-<면>.png + 장부·eyes.json

바탕은 지금 고른 격자(`grids/<종>-<면>.png`)를 하네스 build 가 줄인 번들 그림이다. 바탕 해시가 손질 표의 `from` 과 다르면
거부한다(격자를 다시 고르면 손질 표도 다시 쓴다). 표: harness-data/monster-collect-species/astra-starters-touchup.json
  ops: {"recolor": ["#from", "#to"]}  한 색을 다른 색으로(마젠타 정리 뒤 남은 보라 윤곽 등)
       {"clean": [x0,y0,x1,y1], "keep": [...]}  clear 와 같되 실루엣 가장자리 칸은 남긴다(몸 안쪽 잡선 지우기)
       {"clear": [x0,y0,x1,y1], "keep": [색...]}  상자 안에서 keep 에 없는 칸을 둘레 살갗 최빈색으로 메운다(옛 눈·입 지우기)
       {"at": [x,y], "rows": ["..."], "pal": {"n": "#121639"}}  '.' 그대로, '_' 투명, 그 밖 글자는 pal 색
"""
import argparse, hashlib, json, os, shutil
from collections import Counter
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.join(ROOT, 'harness-data/monster-collect-species')
BUNDLE = os.path.join(ROOT, 'public/assets/harnesses/monster-collect-species')
TABLE = os.path.join(DATA, 'astra-starters-touchup.json')


def sha_file(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def hexrgb(v):
    v = v.lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def apply_ops(im, ops):
    px = im.load()
    W, H = im.size
    for op in ops:
        if 'clear' in op or 'clean' in op:
            x0, y0, x1, y1 = op.get('clear') or op['clean']
            keep = {hexrgb(c) for c in op.get('keep', [])}
            inner = 'clean' in op  # 'clean' 은 실루엣 가장자리(투명과 닿는 칸)를 남기고 안쪽 선만 지운다

            def interior(x, y):
                return all(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] >= 128
                           for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            todo = [(x, y) for y in range(y0, y1) for x in range(x0, x1)
                    if px[x, y][3] >= 128 and px[x, y] not in keep and (not inner or interior(x, y))]
            box = set(todo)
            # 바깥(상자 밖·keep 색) 살갗에서 안쪽으로 번지듯 채운다
            for _ in range(12):
                if not todo:
                    break
                rest = []
                for x, y in todo:
                    near = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1))
                            if 0 <= x + dx < W and 0 <= y + dy < H and (x + dx, y + dy) not in box and px[x + dx, y + dy][3] >= 128
                            and px[x + dx, y + dy] in keep]
                    if near:
                        px[x, y] = Counter(near).most_common(1)[0][0]
                        box.discard((x, y))
                    else:
                        rest.append((x, y))
                todo = rest
        elif 'recolor' in op:
            src, dst = hexrgb(op['recolor'][0]), hexrgb(op['recolor'][1])
            bx0, by0, bx1, by1 = op.get('box', [0, 0, W - 1, H - 1])  # 'box' 가 있으면 그 상자 안만 바꾼다
            for y in range(by0, by1 + 1):
                for x in range(bx0, bx1 + 1):
                    if px[x, y] == src:
                        px[x, y] = dst
        elif 'rows' in op:
            ax, ay = op['at']
            pal = {k: hexrgb(v) for k, v in op.get('pal', {}).items()}
            for j, row in enumerate(op['rows']):
                for i, ch in enumerate(row):
                    if ch == '.':
                        continue
                    px[ax + i, ay + j] = (0, 0, 0, 0) if ch == '_' else pal[ch]
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out-dir')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--base-dir', help='바탕 그림 폴더(<종>-<면>.png). 없으면 지금 번들 그림')
    a = ap.parse_args()
    table = json.load(open(TABLE, encoding='utf-8'))
    ledger_path = os.path.join(DATA, 'ledger.json')
    ledger = json.load(open(ledger_path, encoding='utf-8'))
    eyes_path = os.path.join(DATA, 'eyes.json')
    eyes = json.load(open(eyes_path, encoding='utf-8'))
    for sid, sides in table['species'].items():
        for side, entry in sides.items():
            base = os.path.join(a.base_dir, f'{sid}-{side}.png') if a.base_dir else os.path.join(BUNDLE, sid, f'{side}.png')
            got = sha_file(base)
            if got != entry['from']:
                raise SystemExit(f'{sid} {side}: 바탕 해시 {got[:12]} != 표 from {entry["from"][:12]} — 격자를 다시 골랐으면 표를 다시 쓴다')
            im = apply_ops(Image.open(base).convert('RGBA'), entry['ops'])
            if a.out_dir:
                os.makedirs(a.out_dir, exist_ok=True)
                im.save(os.path.join(a.out_dir, f'{sid}-{side}.png'))
            if a.apply:
                rel = f'authored/{sid}-{side}.png'
                out = os.path.join(DATA, rel)
                im.save(out)
                to = sha_file(out)
                pick = ledger['picks'][sid][side]
                pick['authored'] = rel
                pick['previousAuthoredSha256'] = entry['from']
                pick['authoredSha256'] = to
                if side == 'front':
                    e = eyes['species'][sid]
                    e.pop('repair', None)
                    e['patch'] = {'from': entry['from'], 'to': to, 'source': 'astra_starters_touchup.py'}
                print(f'{sid} {side}: {entry["from"][:12]} → {to[:12]} ({rel})')
    if a.apply:
        json.dump(ledger, open(ledger_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        open(ledger_path, 'a').write('\n')
        body = ',\n'.join(f'    {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in eyes['species'].items())
        open(eyes_path, 'w', encoding='utf-8').write('{\n  "version": %d,\n  "species": {\n%s\n  }\n}\n' % (eyes['version'], body))


if __name__ == '__main__':
    main()
