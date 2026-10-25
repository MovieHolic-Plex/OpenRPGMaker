# 전투 시트 포즈에서 모자를 걷어 내고 머리카락·머리띠로 바꾼 파생 포즈를 만든다(손 도트 원본을 화소 단위로 고침, 생성 그림 없음).
#
# 왜: 걷기 칩을 손으로 고친 인물(폴른 스타 심문관 발렌 — Actor1 #4 의 광대 모자를 걷고 긴 푸른 머리·금빛 머리띠)은
#     전투 시트가 여전히 원본 칩(actor1-4)의 모자를 썼다. 걷기 칩·흉상과 전투 모습이 다른 사람이 된다.
# 방법(포즈마다):
#   1) 모자 챙 = 챙 색(주황·금) 화소가 한 줄에 4칸 이상 이어진 가장 위 줄(누운 포즈는 한 열). 그 폭이 머리 폭이다.
#   2) 챙보다 위(누운 포즈는 머리 쪽) 모자 색 화소 중 머리 폭 밖은 지운다(늘어진 모자 자락·방울과 그 외곽선).
#   3) 머리 폭 안의 모자 색은 머리카락 색으로 바꾸고, 챙 줄은 머리띠 색으로 칠한다.
# 사용: python3 derive_hatless.py actor1-4 fs-valen   → tiledata/charset-battlers/fs-valen/*.png (그다음 build.py fs-valen)
import json, os, sys
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from cb_lib import SRC_DIR  # noqa: E402

# actor1-4 모자: 회색 세 단·검은 외곽·주황 방울·갈색 그늘.
HAT_SHADES = {(41, 41, 41): 0, (65, 65, 65): 1, (106, 106, 106): 2}  # 칼의 검보라(30,24,34)는 넣지 않는다
BRIM = {(213, 98, 16), (246, 164, 24), (189, 57, 8)}
BELL_EXTRA = {(98, 19, 0), (115, 41, 16)}
OUTLINE = (0, 0, 0)
# 발렌 흉상·걷기 칩의 강철빛 푸른 머리(어두움→밝음)와 금빛 머리띠.
HAIR = [(16, 24, 106), (32, 49, 164), (32, 115, 238)]
BAND = (246, 196, 40)


def brim_line(px, w, h):
    """(축, 위치, 시작, 끝) — 'row' 면 y 줄의 x0..x1, 'col' 이면 x 열의 y0..y1.
    챙은 칼·팔에 가려 끊길 수 있다 — 7칸 창 안에 챙 색이 3칸 이상이면 챙 줄로 본다(양끝 방울은 1~2칸이라 걸리지 않는다)."""
    def scan(n_lines, n_along, get):
        for line in range(n_lines):
            for start in range(0, n_along - 6):
                hits = [u for u in range(start, start + 7) if get(u, line)]
                if len(hits) >= 3:
                    # 이 창에서 시작해 이어지는(2칸 이하 틈) 챙 색 구간 전체.
                    lo, hi = hits[0], hits[-1]
                    u = hi + 1
                    while u < n_along and any(get(k, line) for k in range(u, min(n_along, u + 3))):
                        while not get(u, line):
                            u += 1
                        hi = u
                        u += 1
                    return line, lo, hi
        return None
    def on(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] and px[x, y][:3] in BRIM
    r = scan(h, w, lambda u, line: on(u, line))
    c = scan(w, h, lambda u, line: on(line, u))
    if r and c:
        # 누운 포즈만 열 챙이 더 길다.
        return ("col",) + c if (c[2] - c[1]) > (r[2] - r[1]) + 1 else ("row",) + r
    return ("row",) + r if r else (("col",) + c if c else None)


def derive(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    line = brim_line(px, w, h)
    if not line:
        return im, "no-brim"
    axis, pos, a, b = line
    hat_fill = set(HAT_SHADES) | BRIM | BELL_EXTRA
    hat = hat_fill | {OUTLINE}
    n_u = w if axis == "row" else h

    def coords(u, v):
        return (u, v) if axis == "row" else (v, u)

    def get(u, v):
        x, y = coords(u, v)
        return px[x, y] if 0 <= x < w and 0 <= y < h else None

    def put(u, v, rgba):
        x, y = coords(u, v)
        if 0 <= x < w and 0 <= y < h:
            px[x, y] = rgba

    def count(side):
        n = 0
        for d in range(1, 10):
            for u in range(a - 8, b + 9):
                p = get(u, pos + side * d)
                if p and p[3] and p[:3] in HAT_SHADES:
                    n += 1
        return n
    side = -1 if count(-1) >= count(1) else 1
    orig = im.copy().load()

    # 팔: 몸(챙에서 얼굴 쪽으로 두 줄 이상)에서 이어져 올라온 회색·검정 화소는 모자가 아니라 팔·어깨다.
    # 챙 줄은 주황이라 건너지 못하고, 모자 자락 끝 방울도 주황이라 몸과 모자는 팔이 겹칠 때만 이어진다.
    protected = set()
    stack = []
    for u in range(n_u):
        for d in range(-6, -1):
            p = get(u, pos + side * d)
            if p and p[3] and p[:3] in set(HAT_SHADES) | {OUTLINE} and not (a - 1 <= u <= b + 1):
                stack.append((u, d))
    while stack:
        u, d = stack.pop()
        if (u, d) in protected or d > 12:
            continue
        p = get(u, pos + side * d)
        if not p or not p[3] or p[:3] not in set(HAT_SHADES) | {OUTLINE}:
            continue
        if d >= 0 and a - 1 <= u <= b + 1:
            continue  # 머리 위 띠 안으로는 번지지 않는다(모자 정수리)
        protected.add((u, d))
        stack.extend(((u + 1, d), (u - 1, d), (u, d + 1), (u, d - 1)))

    def touches_other(u, v):
        """원본에서 모자 아닌 색(칼·팔·몸)에 붙은 외곽선 — 그 물건의 외곽선이므로 남긴다."""
        x, y = coords(u, v)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = orig[x + dx, y + dy] if 0 <= x + dx < w and 0 <= y + dy < h else None
            if q and q[3] and q[:3] not in hat:
                return True
        return False
    # 1) 모자 쪽(챙 포함, 얼굴 쪽 한 줄까지)의 모자 색을 지운다. 칼·팔 같은 다른 색은 남긴다.
    for d in range(-1, 14):
        v = pos + side * d
        for u in range(0, n_u):
            p = get(u, v)
            if not p or not p[3]:
                continue
            rgb = p[:3]
            inside = a - 1 <= u <= b + 1
            if d == -1:
                if rgb in BRIM | BELL_EXTRA and not inside:
                    put(u, v, (0, 0, 0, 0))
                continue
            if d == 0 and inside and rgb in BRIM:
                put(u, v, BAND + (255,))
                continue
            if (u, d) in protected:
                continue
            if rgb in hat_fill or (rgb == OUTLINE and (inside or d >= 1) and not touches_other(u, v)):
                put(u, v, (0, 0, 0, 0))
    # 2) 지운 자리에 남은 외곽선 고아(이웃에 색 있는 화소가 없는 검은 칸)를 걷는다.
    for _ in range(2):
        drop = []
        for y in range(h):
            for x in range(w):
                if px[x, y][3] and px[x, y][:3] == OUTLINE:
                    if not any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] and px[x + dx, y + dy][:3] != OUTLINE
                               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        drop.append((x, y))
        for x, y in drop:
            px[x, y] = (0, 0, 0, 0)
    # 3) 머리카락 둥근 정수리: 챙 폭보다 한 칸씩 넓게 시작해 세 줄로 좁아진다. 외곽선 검정, 앞(왼쪽)은 밝게.
    width = b - a + 1
    rows = [(a - 1, b + 1), (a - 1, b + 1), (a, b), (a + 1, b - 1)] if width >= 4 else [(a - 1, b + 1), (a, b), (a, b)]
    for d, (lo, hi) in enumerate(rows, start=1):
        v = pos + side * d
        for u in range(lo - 1, hi + 2):
            p = get(u, v)
            if p and p[3] and p[:3] not in hat:
                continue  # 칼·팔이 앞에 있다
            if u in (lo - 1, hi + 1) or d == len(rows):
                put(u, v, OUTLINE + (255,))
            else:
                shade = 2 if (u - lo) <= (hi - lo) // 3 else (1 if (u - lo) <= 2 * (hi - lo) // 3 else 0)
                put(u, v, HAIR[shade] + (255,))
    # 4) 긴 머리: 정수리 뒤쪽(오른쪽, 누운 포즈는 아래)으로 챙 줄부터 다섯 칸 흘러내린다.
    back = b + 2
    for d in range(0, -6, -1):
        v = pos + side * d
        for k, u in enumerate((back - 1, back)):
            p = get(u, v)
            if p and p[3] and p[:3] not in hat and p[:3] not in set(HAIR):
                continue
            put(u, v, (HAIR[0] if k else HAIR[1]) + (255,))
        p = get(back + 1, v)
        if p is not None and not p[3]:
            put(back + 1, v, OUTLINE + (255,))
    return im, f"{axis}@{pos} {a}-{b} side{side}"


def main():
    src, out = sys.argv[1], sys.argv[2]
    sdir, odir = os.path.join(SRC_DIR, src), os.path.join(SRC_DIR, out)
    os.makedirs(odir, exist_ok=True)
    log = {}
    for name in sorted(os.listdir(sdir)):
        if not name.endswith(".png") or name.startswith("_"):
            continue
        im, note = derive(Image.open(os.path.join(sdir, name)))
        im.save(os.path.join(odir, name), optimize=True)
        log[name] = note
    json.dump({"source": src, "script": "scripts/asset-gen/charset-battler/derive_hatless.py", "poses": log},
              open(os.path.join(odir, "provenance.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()
