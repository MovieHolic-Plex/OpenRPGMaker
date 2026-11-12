"""바닥 칸 이음 검사(코드): 칸을 4×4 로 깔았을 때 칸 경계가 보이는가.
- wrapV / wrapH: 경계를 건너는 이웃 화소 쌍(오른쪽 끝 열↔왼쪽 끝 열, 아랫줄↔윗줄)의 밝기 차 평균 ÷ 칸 안쪽 이웃 쌍의 밝기 차 평균. 1 근처면 경계가 안쪽과 같다. 1.6 넘으면 경계에 줄이 선다.
- ring: 바깥 한 줄 테두리의 평균 밝기 − 안쪽 평균 밝기. 크게 음수면 칸마다 어두운 액자가 생겨 16px 격자가 보인다.
- tones: 색 수. flat: 가장 많은 색의 비율.
수치는 보조다. 판정은 4×4 로 깐 그림을 보고 한다."""
import numpy as np
LUM = np.array([0.299, 0.587, 0.114])


def seam(im):
    a = np.array(im.convert('RGBA'))
    if (a[:, :, 3] != 255).any():
        return dict(opaque=False)
    L = a[:, :, :3].astype(float) @ LUM
    inner_h = np.abs(np.diff(L, axis=1)).mean()
    inner_v = np.abs(np.diff(L, axis=0)).mean()
    wrap_h = np.abs(L[:, 0] - L[:, -1]).mean()
    wrap_v = np.abs(L[0, :] - L[-1, :]).mean()
    ring = np.concatenate([L[0, :], L[-1, :], L[1:-1, 0], L[1:-1, -1]]).mean() - L[1:-1, 1:-1].mean()
    cols = {tuple(p) for p in a[:, :, :3].reshape(-1, 3)}
    vals, cnt = np.unique(a[:, :, :3].reshape(-1, 3), axis=0, return_counts=True)
    return dict(opaque=True, wrapH=round(float(wrap_h / max(inner_h, 0.5)), 2), wrapV=round(float(wrap_v / max(inner_v, 0.5)), 2), ring=round(float(ring), 1),
                tones=len(cols), flat=round(float(cnt.max() / cnt.sum()), 2), lum=round(float(L.mean()), 1))


def patch(im, n=4):
    from PIL import Image
    out = Image.new('RGBA', (im.width * n, im.height * n))
    for y in range(n):
        for x in range(n):
            out.alpha_composite(im.convert('RGBA'), (x * im.width, y * im.height))
    return out
