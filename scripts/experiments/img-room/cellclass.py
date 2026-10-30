"""칸 분류기(조건 V): 16×16 칸 하나를 void(0) / floor(1) / wall(2) 로 — 대략.
  void  = 어둡고 결이 없는 칸(방 밖 검은 바탕).
  wall  = 3/4 실내의 문법으로: void 에 닿은 칸(벽 윗면·외벽 테두리) + 북쪽이 열린 벽 윗면 바로 아래 두 줄(북벽 벽면).
  floor = 나머지 방 안 칸(물건이 덮은 칸 포함).
목업(16px 로 줄인 것)과 지은 맵 그림에 같은 분류기를 써서 계산 충실도를 잰다 — 색이 달라도 구조만 본다."""
import numpy as np
from PIL import Image

T = 16

def void_mask(a: np.ndarray) -> np.ndarray:
    H, W = a.shape[0] // T, a.shape[1] // T
    out = np.zeros((H, W), dtype=bool)
    for y in range(H):
        for x in range(W):
            lum = a[y * T:(y + 1) * T, x * T:(x + 1) * T].mean(axis=2)
            out[y, x] = lum.mean() < 26 and lum.std() < 10
    return out

def classify(im: Image.Image) -> np.ndarray:
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    v = void_mask(a); H, W = v.shape
    pad = np.pad(v, 1, constant_values=True)
    near_void = np.zeros_like(v)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near_void |= pad[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
    cls = np.where(v, 0, np.where(near_void, 2, 1)).astype(np.int8)
    # 북벽 벽면: 북쪽이 void 인 벽 윗면 칸 아래 두 줄
    for y in range(H):
        for x in range(W):
            if cls[y, x] == 2 and (y == 0 or v[y - 1, x]):
                for k in (1, 2):
                    if y + k < H and cls[y + k, x] == 1: cls[y + k, x] = 2
    return cls

class Classifier:
    """옛 이름 호환(과제별 견본은 더 쓰지 않는다)."""
    def __init__(self, task: str = ""): pass
    def classify(self, im: Image.Image) -> np.ndarray: return classify(im)
