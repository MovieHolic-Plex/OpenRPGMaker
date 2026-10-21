"""아스트라 호라이즌 등장인물 흉상·전신을 char-gen(최신 main, 고해상 초상 + 품질 관문) 결과에서 번들 그림으로 굽는다.
  python3 scripts/content/monsters/bake_astra_cast.py <cid>=<char-gen set JOB 폴더> ...
- 입력은 `set finalize` 의 out/bust-<표정>.png(약 720px, 1화소 결, 128색, 투명) · out/full-<표정>.png(약 760px).
- 흉상: 대사 상자 그림 칸 88x92 에 1:1 로 나오는 도트로 줄인다(머리·어깨가 칸을 채우게 위를 기준으로 자르고, 화소 평균으로 줄인 뒤
  그 그림 자신의 128색 팔레트로 되돌리고, 바깥에 1화소 윤곽). 런타임(src/player/bustPixelate.ts)은 88x92 그림을 다시 줄이지 않는다.
- 전신: 키 168px 로 같은 방법. 전신 카드(card-base.png) = 대사 상자와 같은 두 겹 테두리 + 전신.
- 다시 그리지 않는다(줄이기·색 맞추기·윤곽만). 표정은 KEEP 에 적은 것만 — src/assets/astraCast.ts ASTRA_CAST_EXPRESSIONS 와 같아야 한다.
- 트레이너 소개 앞모습(fronts=)은 이 스크립트가 더 이상 굽지 않는다(전투 그림은 따로 관리).
- 출처: public/assets/emerald-monster/cast/provenance.json (원본·결과 화소 해시)."""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/emerald-monster/cast'
EXPR = ['base', 'happy', 'sad', 'angry', 'surprised']
KEEP = {cid: EXPR for cid in ('hero', 'mom', 'professor', 'naru', 'nurse', 'yurim')}
KEEP['muyeong'] = EXPR + ['serious']  # 옛 저장본이 muyeong_bust_serious 를 가리킨다 — 빼면 그 프로젝트가 안 열린다
BUST = (88, 92)
FULL_H = 168
OUTLINE = (0x20, 0x30, 0x28, 255)
# 흉상 자르기: 그림 너비의 1/ZOOM 을 쓴다. 1.0 = char-gen 흉상 전체(가슴 표식까지 보이게) — 일곱 명 모두 같은 틀로 잘라 크기를 맞춘다.
ZOOM = {'hero': 1.0, 'mom': 1.0, 'professor': 1.0, 'naru': 1.0, 'nurse': 1.0, 'yurim': 1.0, 'muyeong': 1.0}


def sha(im): return hashlib.sha256(np.array(im.convert('RGBA')).tobytes()).hexdigest()


def shrink(im, size, inner):
    """im(RGBA, 잘라 둔 것) -> size 캔버스. inner = 윤곽 1화소를 뺀 그림 크기(w, h), 아래·가운데 맞춤."""
    src = np.array(im)
    pal = np.unique(src[src[..., 3] >= 128][:, :3], axis=0).astype(np.int32)
    a = src.astype(np.float64) / 255
    a[..., :3] *= a[..., 3:]
    pm = Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA').resize(inner, Image.Resampling.BOX)
    s = np.array(pm).astype(np.float64)
    al = s[..., 3] / 255
    rgb = np.where(al[..., None] > 0.02, s[..., :3] / np.maximum(al[..., None], 1e-6), 0)
    # 색 고르기: 각 칸의 평균색에 가장 가까운 색을, 그 칸이 덮는 원본 화소들 안에서만 고른다(그림 전체 팔레트에서 고르면
    # 눈동자 평균색이 머리띠의 보라 같은 엉뚱한 색으로 간다 — 2026-10-21 VQA 지적). 원본에 없는 색은 생기지 않는다.
    sh, sw = src.shape[:2]
    q = np.zeros(rgb.shape, np.uint8)
    for y in range(inner[1]):
        y0, y1 = int(y * sh / inner[1]), max(int(y * sh / inner[1]) + 1, int((y + 1) * sh / inner[1]))
        for x in range(inner[0]):
            x0, x1 = int(x * sw / inner[0]), max(int(x * sw / inner[0]) + 1, int((x + 1) * sw / inner[0]))
            blk = src[y0:y1, x0:x1]
            cand = blk[blk[..., 3] >= 128][:, :3].astype(np.int32)
            if not len(cand):
                cand = pal
            q[y, x] = cand[((cand - rgb[y, x]) ** 2).sum(-1).argmin()]
    W, H = size
    out = np.zeros((H, W, 4), np.uint8)
    x0 = (W - inner[0]) // 2; y0 = H - inner[1]
    out[y0:, x0:x0 + inner[0], :3] = q
    out[y0:, x0:x0 + inner[0], 3] = np.where(al >= 0.5, 255, 0)
    sol = out[..., 3] == 255
    edge = np.zeros_like(sol)
    edge[1:] |= sol[:-1]; edge[:-1] |= sol[1:]; edge[:, 1:] |= sol[:, :-1]; edge[:, :-1] |= sol[:, 1:]
    out[edge & ~sol] = OUTLINE
    return Image.fromarray(out, 'RGBA')


def bust(path, zoom):
    im = Image.open(path).convert('RGBA'); im = im.crop(im.getbbox()); w, h = im.size
    iw, ih = BUST[0] - 2, BUST[1] - 1
    cw = w / zoom; ch = cw * ih / iw
    if ch > h: ch = h; cw = ch * iw / ih
    # 가로 가운데는 머리에 맞춘다(그림 위 45% 의 불투명 화소 무게중심) — 흉상이 비스듬하면 머리가 한쪽으로 쏠린다.
    top = np.array(im)[: int(h * 0.45), :, 3] >= 128
    cx = np.nonzero(top)[1].mean() if top.any() else w / 2
    x0 = min(max(cx - cw / 2, 0), w - cw)
    return shrink(im.crop((round(x0), 0, round(x0 + cw), round(ch))), BUST, (iw, ih))


def full(path):
    im = Image.open(path).convert('RGBA'); im = im.crop(im.getbbox()); w, h = im.size
    ih = FULL_H - 2; iw = max(1, round(w * ih / h))
    return shrink(im, (iw + 2, FULL_H), (iw, ih))


if __name__ == '__main__':
    import os, subprocess
    cg = os.environ.get('CHARGEN_DIR', str(Path.home() / 'char-gen-public'))
    CHARGEN = os.environ.get('CHARGEN_COMMIT') or subprocess.run(['git', '-C', cg, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() or None
    prov_path = OUT / 'provenance.json'
    prov = json.loads(prov_path.read_text()) if prov_path.exists() else {}
    prov['judge'] = 'char-gen 품질 관문(초상마다) + 눈가림 정체성·표정 판정(set judge) 통과분 + 독립 Opus 적대 VQA'
    prov['source'] = 'char-gen main(MovieHolic-Plex/char-gen) 고해상 초상, 이미지 엔진 codex(로그인, 유료 대체 경로 없음) · 후보는 감독이 골랐다(by: supervisor, 사용자 위임)'
    prov.setdefault('cast', {})
    for arg in sys.argv[1:]:
        cid, src = arg.split('=', 1); job = Path(src); src = job / 'out'
        dst = OUT / cid; dst.mkdir(parents=True, exist_ok=True)
        for old in dst.glob('*.png'): old.unlink()
        rec = {'from': str(src), 'charGen': CHARGEN, 'pictures': {}}
        for e in KEEP[cid]:
            for kind, fn in (('bust', lambda p: bust(p, ZOOM[cid])), ('full', full)):
                f = src / f'{kind}-{e}.png'
                im = fn(f)
                im.save(dst / f.name, optimize=True)
                rec['pictures'][f.name] = {'size': list(im.size), 'sourceSha256': sha(Image.open(f)), 'pixelSha256': sha(im)}
        fb = Image.open(dst / 'full-base.png').convert('RGBA')
        card = Image.new('RGBA', (fb.width + 24, fb.height + 20), (0x48, 0x70, 0x68, 255))
        card.paste((0xa8, 0xc0, 0xa0, 255), (4, 4, card.width - 4, card.height - 4))
        card.paste((0xe8, 0xf0, 0xd8, 255), (8, 8, card.width - 8, card.height - 8))
        card.alpha_composite(fb, ((card.width - fb.width) // 2, card.height - 8 - fb.height))
        card.save(dst / 'card-base.png', optimize=True)
        rec['pictures']['card-base.png'] = {'size': list(card.size), 'pixelSha256': sha(card)}
        prov['cast'][cid] = rec
        print(cid, 'card', card.size)
    prov_path.write_text(json.dumps(prov, ensure_ascii=False, indent=1) + '\n')
