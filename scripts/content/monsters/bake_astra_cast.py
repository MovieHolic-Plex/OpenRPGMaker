"""아스트라 호라이즌 등장인물(char-gen 결과, 감독 선택)을 번들 그림으로 굽는다.
  python3 scripts/content/monsters/bake_astra_cast.py <cid>=<char-gen job out 폴더> ...
- char-gen 의 흉상·전신은 화소 격자를 정수배로 키운 그림이다. 칸 크기를 재서 원래 도트 크기로 되돌린다(칸 가운데 화소, 다시 그리지 않는다).
- public/assets/emerald-monster/cast/<cid>/bust-<표정>.png · full-<표정>.png
- 트레이너 소개 그림(naru·yurim·muyeong): public/assets/battle-trainers/astra_<cid>/front.png — 128×192 투명 판에 전신 1배, 발이 바닥.
- 출처: public/assets/emerald-monster/cast/provenance.json (원본 화소 해시)."""
import hashlib, json, sys
from collections import Counter
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/emerald-monster/cast'
TRAINERS = {'naru', 'yurim', 'muyeong'}

def cell(a):
    runs = Counter()
    for row in a[:, :, :].astype(int)[::7]:
        idx = np.where(np.abs(np.diff(row, axis=0)).sum(1) > 0)[0]
        runs.update(np.diff(idx).tolist())
    best = None
    for s in range(2, 13):
        if sum(v for k, v in runs.items() if k % s == 0) >= 0.9 * sum(runs.values()):
            best = s
    return best or 1

def native(path):
    im = Image.open(path).convert('RGBA'); a = np.array(im)
    s = cell(a)
    # 격자 원점: 칸 경계가 가장 많이 맞는 위치
    def offset(axis):
        d = (np.abs(np.diff(a.astype(int), axis=axis)).sum(2) > 0).sum(1 - axis)
        return max(range(s), key=lambda o: sum(d[i] for i in range(o - 1, len(d), s) if i >= 0)) if s > 1 else 0
    ox, oy = offset(1), offset(0)
    xs = list(range(ox, a.shape[1] - s + 1, s)); ys = list(range(oy, a.shape[0] - s + 1, s))
    small = a[np.ix_([y + s // 2 for y in ys], [x + s // 2 for x in xs])]
    # 칸 안이 고른지 확인 — 아니면 굽지 않는다
    blocks = a[ys[0]:ys[-1] + s, xs[0]:xs[-1] + s].reshape(len(ys), s, len(xs), s, 4)
    uniform = (blocks == blocks[:, :1, :, :1]).all(axis=(1, 3, 4)).mean()
    if uniform < 0.97: raise SystemExit(f'{path}: 칸 {s}px 고름 {uniform:.3f} — 격자가 아니다')
    out = Image.fromarray(small, 'RGBA')
    bbox = out.getbbox()
    return out.crop(bbox), s, float(uniform)

def sha(im): return hashlib.sha256(np.array(im.convert('RGBA')).tobytes()).hexdigest()

prov_path = OUT / 'provenance.json'
prov = json.loads(prov_path.read_text()) if prov_path.exists() else {'source': 'char-gen (OPRN 자체 생성기, 우리 산출물) · 후보는 감독이 골랐다(by: supervisor) · 유료 대체 경로·스토어 크레딧 사용 없음', 'cast': {}}
for arg in sys.argv[1:]:
    cid, src = arg.split('=', 1); src = Path(src)
    dst = OUT / cid; dst.mkdir(parents=True, exist_ok=True)
    rec = {'from': str(src), 'pictures': {}}
    for f in sorted(src.glob('bust-*.png')) + sorted(src.glob('full-*.png')):
        im, s, u = native(f)
        im.save(dst / f.name, optimize=True)
        rec['pictures'][f.name] = {'size': list(im.size), 'cell': s, 'uniform': round(u, 4), 'sourceSha256': sha(Image.open(f)), 'pixelSha256': sha(im)}
    if cid in TRAINERS:
        full = Image.open(dst / 'full-base.png').convert('RGBA')
        if full.width > 128 or full.height > 190: raise SystemExit(f'{cid} 전신 {full.size} 이 128×192 판보다 크다')
        board = Image.new('RGBA', (128, 192), (0, 0, 0, 0)); board.alpha_composite(full, ((128 - full.width) // 2, 190 - full.height))
        td = ROOT / f'public/assets/battle-trainers/astra_{cid}'; td.mkdir(parents=True, exist_ok=True)
        board.save(td / 'front.png', optimize=True)
        rec['trainerFront'] = f'battle-trainers/astra_{cid}/front.png'
    prov['cast'][cid] = rec
    print(cid, {k: v['size'] for k, v in rec['pictures'].items() if k.endswith('base.png')})
prov_path.write_text(json.dumps(prov, ensure_ascii=False, indent=1) + '\n')
