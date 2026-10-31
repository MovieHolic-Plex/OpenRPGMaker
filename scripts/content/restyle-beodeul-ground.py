#!/usr/bin/env python3
"""버들항 시트(beodeul_city)의 풀밭 색을 숲 수관·낱 나무와 같은 «햇볕 든 풀밭» 색 무리로 옮긴다.

왜: 2026-10-18 사용자 「숲이 흠. 주변 바닥 타일들이랑 잘 어울리게 했음 좋네. 지금은 좀 .. 잘 안 어울림」.
    숲 수관·낱 나무는 restyle-beodeul-foliage.py · append-beodeul-forest-canopy.py 가 왼쪽 위 해·누런 올리브~짙은 솔빛 단으로 다시 칠했는데,
    바닥 풀밭(737 과 그 둘레 칸)은 옛 그림의 쨍한 합성 초록(#579f35) 한 색에 결이 거의 없어(밝기 차 ±5) 나무가 «평평한 초록 판 위에 붙여 놓은» 것처럼 보였다.
무엇: 두 단계로 시트 전체(숲 수관 원본 칸 beodeul-foliage/source-tiles.json 밖)를 바꾼다.
  1) 자리 맞춤 바탕: 마을 바닥은 전부 737 한 칸이라 그 무늬가 16px 마다 되풀이된다. 옛 737 의 왼쪽 첫 열 짙은 줄이 결을 키우면 격자로 드러나서
     (밝기 결 2.4·1.8 배 시도 — 둘 다 격자) 결을 키우지 않고 737 바탕을 새로 그린다: 무리 진 짙은·밝은 풀 점과 서로 다른 줄·칸의 풀포기 셋·클로버 하나,
     대비는 수관 색 단 한 단 안쪽. 옛 737 과 «같은 자리·같은 색» 인 화소는 어느 칸에서든 새 바탕의 같은 자리 화소로 바꿔
     길 가장자리·물가·울타리 칸에 복사된 바탕도 이음매 없이 함께 바뀐다.
  2) 색 표: 남은 풀밭 색 무리(737 색 ± 14 안의 초록 + 풀밭 묶음 칸의 초록) 한 색마다 새 색 하나 — 색조 노란 쪽 11°, 채도 ×0.84, 명도 ×0.96
     (수관 oak·elm 단의 중간 톤과 같은 무리). 같은 색은 어느 칸에서든 같은 색이 되어 칸 이음매가 그대로 맞는다.
멱등: 처음 돌 때 색 표와 옛 737 바탕을 scripts/content/beodeul-foliage/ground-lut.json 에 적어 두고 다음부터는 그것만 쓴다(새 색은 옛 색 무리와
  겹치지 않아 두 번 돌려도 같다). bake_picks.py · build-beodeul-city.py 가 칸을 새로 그려 옛 풀색이 돌아오면 다시 돌리면 된다.
  그 뒤 자연 덧그림을 다시 굽는다(물가·잔디 둑이 737 풀색을 읽는다):
    python3 scripts/content/build-beodeul-nature.py && python3 scripts/content/append-beodeul-lava-bank.py && python3 scripts/content/append-beodeul-forest-canopy.py

  python3 scripts/content/restyle-beodeul-ground.py
"""
import colorsys, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SHEET = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
FOLIAGE_IDX = ROOT / "scripts/content/beodeul-foliage/source-tiles.json"
LUT = ROOT / "scripts/content/beodeul-foliage/ground-lut.json"
T, SHEET_COLS = 16, 128
GRASS = 737
GROUP = [2502, 11628, 5485, 573, 4546, 6686, 12130, 7232, 9353, 1588, 3485]   # 버들항 풀밭 묶음(beodeulCityTileset.json tileGroups beodeul:grass)
NEAR = 14            # 737 색에서 이만큼(RGB 맨해튼) 안이면 풀밭 색
HUE, SAT, VAL = -11 / 360, 0.84, 0.96

def cell(S, n):
    return S[(n // SHEET_COLS) * T:(n // SHEET_COLS + 1) * T, (n % SHEET_COLS) * T:(n % SHEET_COLS + 1) * T]

def opaque_colors(px):
    px = px.reshape(-1, 4)
    return {tuple(int(v) for v in p[:3]) for p in px if p[3] == 255}

def greenish(c):
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    return 70 / 360 <= h <= 160 / 360 and s >= 0.3 and v >= 0.15

def shift(c):
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    return tuple(round(x * 255) for x in colorsys.hsv_to_rgb((h + HUE) % 1, min(1.0, s * SAT), min(1.0, v * VAL)))

def build_lut(S, foliage):
    grass = np.unique(cell(S, GRASS)[..., :3].reshape(-1, 3), axis=0).astype(int)
    H, W = S.shape[0] // T, S.shape[1] // T
    keep = np.ones(H * W, bool); keep[list(foliage)] = False
    cells = S.reshape(H, T, W, T, 4).transpose(0, 2, 1, 3, 4).reshape(H * W, T * T, 4)[keep].reshape(-1, 4)
    sheet = np.unique(cells[cells[:, 3] == 255][:, :3], axis=0).astype(int)
    near = np.abs(sheet[:, None, :] - grass[None, :, :]).sum(-1).min(1) <= NEAR
    fam = {tuple(map(int, c)) for c in sheet[near]}
    for n in GROUP: fam |= opaque_colors(cell(S, n))
    fam = {c for c in fam if greenish(c)}
    lut = {}
    for c in sorted(fam):
        out = shift(c)
        while out in fam: out = (out[0], out[1], out[2] + 1)
        lut[c] = out
    return lut

def grass_body(base, taken):
    """737 새 풀밭 바탕(16×16, 감싸 이어짐). 바탕 한 색에 무리 진 짙은·밝은 풀 점(흐린 잡음 위·아래 몫 — 줄·격자로 늘어서지 않게)과
    서로 다른 줄·칸에 놓인 작은 풀잎 둘(밝은 잎끝 + 그 밑 옅은 그늘). 명도 차는 ±4~7% 로 낮게 —
    1차(±11~24%, 풀포기 셋·클로버)는 16px 마다 같은 «ㄴ» 무늬가 벽지처럼 줄지어 보였다."""
    def tone(k):
        h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in base))
        dh, ds, dv = {"d1": (2, 0.02, -0.05), "l1": (-2, -0.02, 0.04), "l2": (-4, -0.04, 0.07)}[k]
        c = tuple(round(x * 255) for x in colorsys.hsv_to_rgb((h + dh / 360) % 1, min(1, s + ds), min(1, v + dv)))
        while c in taken: c = (c[0], c[1], c[2] + 1)
        return c
    pal = {"b": base, **{k: tone(k) for k in ("d1", "l1", "l2")}}
    # r2 (2026-10-31): r1 의 흐린 잡음 문턱 무리가 16px 마다 글자(「Sng」)처럼 읽혀(LEDGER J124) 손 도트 행 문자열로 바꿨다.
    #   흩뿌린 점·세로 2~3화소 풀잎뿐(8-이웃 무리 최대 3화소, 3화소는 세로 풀잎만). 이미 구운 시트는 beodeul-grass-unglyph.py 가 같은 자리에서 바꾼다.
    rows = json.loads((ROOT / "scripts/content/beodeul-foliage/grass-body-r2.json").read_text())["rows"]
    px = [[{".": "b", "a": "d1", "b": "l1", "c": "l2"}[ch] for ch in row] for row in rows]
    return np.array([[pal[k] for k in row] for row in px], np.uint8)

def main():
    S = np.array(Image.open(SHEET).convert("RGBA"))
    foliage = json.loads(FOLIAGE_IDX.read_text())["tiles"]
    if LUT.exists():
        saved = json.loads(LUT.read_text())
        lut = {tuple(a): tuple(b) for a, b in saved["lut"]}
        old_body = np.array(saved["bodyFrom"], np.uint8)
    else:
        lut = build_lut(S, foliage)
        old_body = cell(S, GRASS)[..., :3].copy()
    vals, counts = np.unique(old_body.reshape(-1, 3), axis=0, return_counts=True)
    new_body = grass_body(lut[tuple(map(int, vals[counts.argmax()]))], set(lut))
    LUT.write_text(json.dumps({"note": "restyle-beodeul-ground.py 풀밭 색 표 [옛 RGB, 새 RGB] 와 옛 737 바탕(bodyFrom) - 처음 한 번 만들고 다음부터 이 표만 쓴다.",
                               "bodyFrom": old_body.tolist(), "lut": [[list(a), list(b)] for a, b in sorted(lut.items())]},
                              ensure_ascii=False) + "\n", encoding="utf-8")
    H, W = S.shape[0] // T, S.shape[1] // T
    skip = np.zeros((H, W), bool)
    for n in foliage: skip[n // W, n % W] = True
    allowed = ~np.kron(skip, np.ones((T, T), bool))
    # 1) 자리 맞춤: 옛 737 바탕과 같은 자리·같은 색인 화소(풀밭·길 가장자리·물가 칸에 복사된 바탕)는 새 바탕의 같은 자리 화소로
    tiled_old = np.tile(old_body, (H, W, 1)); tiled_new = np.tile(new_body, (H, W, 1))
    body = (S[..., :3] == tiled_old).all(-1) & (S[..., 3] == 255) & allowed
    S[body, :3] = tiled_new[body]
    # 2) 색 표: 남은 풀밭 색 무리
    key = (S[..., 0].astype(np.int64) << 16) | (S[..., 1].astype(np.int64) << 8) | S[..., 2]
    src = np.array([(a[0] << 16) | (a[1] << 8) | a[2] for a in lut], np.int64)
    dst = np.array(list(lut.values()), np.uint8)
    order = np.argsort(src); src, dst = src[order], dst[order]
    pos = np.clip(np.searchsorted(src, key), 0, len(src) - 1)
    hit = (src[pos] == key) & (S[..., 3] > 0) & allowed & ~body
    S[hit, :3] = dst[pos[hit]]
    Image.fromarray(S, "RGBA").save(SHEET, optimize=True)
    print(f"풀밭 바탕 화소 {int(body.sum())}개 · 색 표 {len(lut)}색 화소 {int(hit.sum())}개 바꿈")

if __name__ == "__main__":
    main()
