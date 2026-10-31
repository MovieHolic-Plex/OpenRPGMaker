#!/usr/bin/env python3
"""버들항 풀밭 바탕(737)의 «글자 무늬»를 지운다 — r1 바탕을 r2 손 도트 바탕으로 같은 자리에서 바꾼다.

왜: restyle-beodeul-ground.py(2026-10-19)의 grass_body 는 흐린 잡음을 문턱으로 잘라 짙은 풀 점을 무리 지었다.
    그 무리(3~8화소 획)가 16px 마다 똑같이 되풀이되어 마을 바닥 전체에 「Sng」「ULL」 같은 글자가 줄지어 읽혔고,
    적대적 VQA 가 버들항 마을마다 «풀밭 워터마크, 체험판 에셋 같다»(LEDGER J124)로 큰 결함을 매겼다.
    출처는 이 저장소 코드의 절차 무늬다 — 제3자 그림·워터마크·글자 렌더가 아니다.
무엇: scripts/content/beodeul-foliage/grass-body-r2.json 의 행 문자열(홀로 선 점·세로 2~3화소 풀잎, 8-이웃 무리 최대 3화소·세로 한 줄,
    같은 네 색·같은 대비)을 새 바탕으로 쓴다. 칸 번호·색 표는 그대로다.
    r1 바탕과 «같은 자리·같은 색» 인 화소만 새 바탕의 같은 자리 화소로 바꾼다 — 풀밭 변형 칸(736~749·548…)과
    길 가장자리·물가·울타리·둑 칸에 복사된 바탕도 함께 바뀌어 칸 이음매가 그대로 맞는다.
    r1 바탕의 무늬 화소(바탕색이 아닌 67화소)가 칸 안에 MIN_SIG 개 이상 같은 자리에 있거나, 좁은 풀 띠라 적더라도(2개 이상)
    같은 자리 화소 가운데 무늬 비율이 r1 바탕과 비슷한 칸만 건드린다(우연히 같은 색인 다른 풀 결·그림 보호).
    숲 수관 원본 칸(beodeul-foliage/source-tiles.json)은 버들항 시트에서 뺀다(restyle 과 같은 규칙).
멱등: 두 번째 실행은 r1 화소가 없어 0 화소를 바꾼다.

  python3 scripts/content/beodeul-grass-unglyph.py [--dry]
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "scripts/content/beodeul-foliage/grass-body-r2.json"
FOLIAGE_IDX = ROOT / "scripts/content/beodeul-foliage/source-tiles.json"
SHEETS = [  # (경로, 숲 원본 칸 빼기)
    ("public/assets/beodeul-city/beodeul-city-chipset.png", True),
    ("public/assets/beodeul-ground/chipset.png", False),
    ("public/assets/beodeul-nature/chipset.png", False),
]
T = 16
MIN_SIG = 6
MIN_SIG_SMALL, MIN_RATIO = 2, 0.6   # 좁은 풀 띠: 무늬 화소가 적어도 같은 자리 화소 가운데 무늬 비율이 r1 바탕과 비슷하면 바탕


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def r2_body(spec):
    pal = {k: hexrgb(v) for k, v in spec["palette"].items()}
    rows = spec["rows"]
    assert len(rows) == T and all(len(r) == T for r in rows)
    return np.array([[pal[c] for c in r] for r in rows], np.uint8)


def main():
    dry = "--dry" in sys.argv
    spec = json.loads(SPEC.read_text())
    new = r2_body(spec)
    old = np.array(spec["bodyR1"], np.uint8)
    base = old[15, 15]
    sig_mask = (old != base).any(-1)
    foliage = json.loads(FOLIAGE_IDX.read_text())["tiles"]
    for rel, skip_foliage in SHEETS:
        path = ROOT / rel
        S = np.array(Image.open(path).convert("RGBA"))
        H, W = S.shape[0] // T, S.shape[1] // T
        same = (S[: H * T, : W * T, :3] == np.tile(old, (H, W, 1))).all(-1) & (S[: H * T, : W * T, 3] == 255)
        sig = (same & np.tile(sig_mask, (H, W))).reshape(H, T, W, T).sum((1, 3))
        tot = same.reshape(H, T, W, T).sum((1, 3))
        ratio = sig / np.maximum(tot * sig_mask.sum() / (T * T), 1e-9)
        ok = (sig >= MIN_SIG) | ((sig >= MIN_SIG_SMALL) & (ratio >= MIN_RATIO))
        if skip_foliage:
            for n in foliage:
                ok[n // W, n % W] = False
        hit = same & np.kron(ok, np.ones((T, T), bool))
        before = S[: H * T, : W * T, :3][hit].copy()
        S[: H * T, : W * T, :3][hit] = np.tile(new, (H, W, 1))[hit]
        changed = int((before != S[: H * T, : W * T, :3][hit]).any(-1).sum())
        print(f"{rel}: 칸 {int(ok.sum())} · 바뀐 화소 {changed}")
        if not dry and changed:
            Image.fromarray(S, "RGBA").save(path, optimize=True)


if __name__ == "__main__":
    main()
