"""조선 조각의 칸별 통행 격자(X / C / F / .) 자동 생성 + 수작업 보정 + 검토용 겹쳐 그림.

문자 뜻 (버들항 kits7 의 X/C/F/. 와 같다):
  X  막힘.      건물·가구·담. 칸 통행 = 막힘, 렌더 = 사람과 y 정렬.
  C  걸음(★).   처마·수관·문루 보. 칸 통행은 아래 땅이 정하고, 그림은 항상 사람 위에 그려진다.
  F  걸음(바닥). 문 앞 디딤돌·다리 상판·선착장·그림자. 칸 통행 = 걸음, 그림은 사람 아래.
  .  그림 없음.  완전 투명 칸.

자동 규칙 (조각 그림 + 분류 cls) — 입력은 칸 픽셀뿐이라 국내성처럼 새 조각이 와도 같은 규칙이 돈다:
  built   몸채(집·관아·누각). 단단한 칸(불투명 화소 ≥ 30) 중 그 칸 밑 같은 열에 단단한 칸이 있으면 X,
          없으면 돌출 처마라 C. 단단하지 않은 가장자리 칸은 반투명 그림자면 F, 아니면 C(맨 아래 칸은 F).
          맨 아래 줄에서 아래쪽 절반이 채워진 소수 칸은 디딤돌(문 앞 계단)이라 F — 문 칸 자체는 막힘.
  tree    수관 줄(맨 아래 줄 위) 전부 C, 맨 아래 줄은 줄기 폭(단단한 칸)만 X, 나머지 F.
  bush / sapling / tuft  tree 와 같은 규칙(덤불은 2줄이면 위 C, 아래 X).
  wall    담·성벽. 그림 있는 칸 전부 X(가장자리 반투명은 F).
  prop    소품. 단단한 칸 X, 가장자리 F.
보정(piece-walk-overrides.json 의 pieces): all / grid / passage / set — walk_overrides 설명 참고.
"""
import re
import numpy as np

T = 16
STRONG = 30           # 한 칸에서 불투명(알파 ≥ 128) 화소가 이만큼 이상이면 「단단한」 칸
STEP_LOW = 10         # 맨 아래 줄 칸의 아래쪽 절반 불투명 화소가 이만큼 이상이면 디딤돌 후보


def cell_stats(img):
    """16×16 RGBA → 통행 규칙이 보는 값 몇 개."""
    a = img[..., 3]
    anyp = int((a > 0).sum())
    return {
        "any": anyp,
        "solid": int((a >= 128).sum()),
        "low": int((a[8:] >= 128).sum()),
        "soft": (float(((a > 0) & (a < 200)).sum()) / anyp) if anyp else 0.0,
    }


VARIANT_RE = re.compile(r"__s\d+$")


def base_name(name):
    """시트 합치기가 만든 변형 이름(`gungnae_gate_great_12__s1`)에서 기준 조각 이름을 돌려준다."""
    return VARIANT_RE.sub("", name)


def infer_cls(name, meta):
    """pieces_meta.json 에 없는 조각의 분류를 이름에서 짐작한다."""
    name = base_name(name) if name not in (meta or {}) else name
    m = (meta or {}).get(name)
    if m and m.get("cls"):
        return m["cls"]
    if re.match(r"^(zelkova|pine|persimmon|willow|bamboo|palace_pine)", name):
        return "tree"
    if re.match(r"^bush_s", name):
        return "tuft"
    if re.match(r"^bush", name):
        return "bush"
    if re.match(r"^small_", name):
        return "sapling"
    if re.search(r"wall|dam$|jukbyeok|fence|^gn_(mud|mudg|stone)_", name):
        return "wall"
    if re.match(r"^(giwa|thatch|gwanah|pavilion|palace_(hall|jeongak|haengnak|gate)|tower_|gn_(l|u|jm|shop|g\d|thatch|sarip|samun)_)", name):
        return "built"
    return "prop"


def _footprint_cols(strong, w, h):
    """몸채가 땅을 차지하는 열 범위. 단단한 칸이 가장 많은 줄의 45% 이상 찬 줄 중 맨 아래 줄이 정한다
    (맨 아래에 좌판·마당이 덧붙은 조각도 기단 줄을 찾는다). 지붕 좌우로 튀어나온 처마 열은 이 범위 밖이다."""
    counts = [sum(strong[j]) for j in range(h)]
    top = max(counts) if counts else 0
    if top == 0:
        return 0, -1
    row = max(j for j in range(h) if counts[j] >= 0.45 * top)
    cols = [i for i in range(w) if strong[row][i]]
    return min(cols), max(cols)


def _auto_built(st, w, h):
    g = [["." for _ in range(w)] for _ in range(h)]
    strong = [[st[j][i]["solid"] >= STRONG for i in range(w)] for j in range(h)]
    anyc = [[st[j][i]["any"] > 0 for i in range(w)] for j in range(h)]
    c0, c1 = _footprint_cols(strong, w, h)
    for j in range(h):
        for i in range(w):
            if not anyc[j][i]:
                continue
            below_any = any(anyc[k][i] for k in range(j + 1, h))
            if strong[j][i]:
                g[j][i] = "X" if c0 <= i <= c1 else "C"
            else:
                shadow = st[j][i]["soft"] > 0.6
                g[j][i] = "F" if (shadow or not below_any) else "C"
    # 디딤돌: 기단 줄(몸채 맨 아래 줄)에서 아래쪽 절반이 찬 소수 칸
    last = max((j for j in range(h) if any(strong[j][i] and c0 <= i <= c1 for i in range(w))), default=h - 1)
    cand = [i for i in range(c0, c1 + 1) if strong[last][i] and st[last][i]["low"] >= STEP_LOW]
    plain = [i for i in range(c0, c1 + 1) if strong[last][i] and st[last][i]["low"] < STEP_LOW]
    steps = []
    if cand and plain and len(cand) <= 3 and len(cand) <= max(1, w // 2):
        for i in cand:
            g[last][i] = "F"
            steps.append((last, i))
    return g, steps


def _auto_tree(st, w, h):
    g = [["." for _ in range(w)] for _ in range(h)]
    for j in range(h):
        for i in range(w):
            c = st[j][i]
            if not c["any"]:
                continue
            if j < h - 1:
                g[j][i] = "C"
            else:
                g[j][i] = "X" if c["solid"] >= STRONG else "F"
    return g


def _auto_flat(st, w, h):
    """wall / prop / tuft: 단단한 칸 X, 가장자리 F."""
    g = [["." for _ in range(w)] for _ in range(h)]
    for j in range(h):
        for i in range(w):
            c = st[j][i]
            if not c["any"]:
                continue
            g[j][i] = "X" if c["solid"] >= STRONG else "F"
    return g


def auto_grid(name, cls, st, w, h):
    """(격자, 디딤돌 칸 목록). 격자는 문자 2차원 리스트."""
    if cls == "built":
        return _auto_built(st, w, h)
    if cls in ("tree", "sapling"):
        return _auto_tree(st, w, h), []
    if cls == "bush":
        return _auto_tree(st, w, h), []
    return _auto_flat(st, w, h), []


def apply_override(grid, spec, st, w, h, name):
    """보정 한 건을 격자에 적용한다. 그림 없는 칸은 항상 '.' 으로 남는다.

    spec 키(순서대로 적용):
      all      "F" — 그림 있는 모든 칸을 이 문자로.
      grid     ["XXX","FFF"] — 통째로 지정(행 수·열 수가 조각과 같아야 한다).
      passage  {"cols":[4,5],"from":7,"above":"C"} — 이 열들의 from 줄부터 아래는 F(통로), 위는 above(기본 C).
      rect     [[row0,col0,row1,col1,"F"], ...] — 직사각형(양 끝 포함).
      set      [[row,col,"F"], ...] — 칸 하나씩.
    """
    g = [row[:] for row in grid]
    if "all" in spec:
        ch = spec["all"]
        g = [[(ch if st[j][i]["any"] else ".") for i in range(w)] for j in range(h)]
    if "grid" in spec:
        rows = spec["grid"]
        if len(rows) != h or any(len(r) != w for r in rows):
            raise ValueError(f"{name}: grid 크기가 조각({w}x{h})과 다르다")
        g = [[(rows[j][i] if st[j][i]["any"] else ".") for i in range(w)] for j in range(h)]
    if "passage" in spec:
        p = spec["passage"]
        above = p.get("above", "C")
        for i in p["cols"]:
            for j in range(h):
                if not st[j][i]["any"]:
                    g[j][i] = "."
                else:
                    g[j][i] = "F" if j >= p["from"] else above
    for (j0, i0, j1, i1, ch) in spec.get("rect", []):
        if j1 >= h or i1 >= w:
            raise ValueError(f"{name}: rect {[j0, i0, j1, i1]} 가 조각({w}x{h}) 밖이다 — 그림이 바뀐 조각이면 piece-walk-overrides.json 의 줄을 새 그림에 맞게 고친다")
        for j in range(j0, j1 + 1):
            for i in range(i0, i1 + 1):
                g[j][i] = ch if st[j][i]["any"] else "."
    for (j, i, ch) in spec.get("set", []):
        g[j][i] = ch if st[j][i]["any"] else "."
    return g


def build_piece_walk(pieces, cell_img, meta, overrides):
    """pieces: pieces.json 의 pieces 중 물체(w,h,tiles). cell_img(id) → 16×16 RGBA.
    반환: {이름: {w,h,cls,rows:[문자열],source,steps:[[row,col]]}}"""
    ov = (overrides or {}).get("pieces", {})
    out = {}
    for name, p in pieces.items():
        if "w" not in p:
            continue
        w, h = p["w"], p["h"]
        st = [[cell_stats(cell_img(p["tiles"][j][i])) for i in range(w)] for j in range(h)]
        cls = infer_cls(name, meta)
        grid, steps = auto_grid(name, cls, st, w, h)
        source = "auto"
        oname = name if name in ov else base_name(name)      # 변형(`…__s1`)은 기준 이름의 보정을 이어받는다(그림이 달라 격자가 안 맞으면 변형 이름으로 따로 줄을 적는다)
        if oname in ov:
            grid = apply_override(grid, ov[oname], st, w, h, name)
            source = "override"
            steps = [(j, i) for (j, i) in steps if grid[j][i] == "F"]
        out[name] = {"w": w, "h": h, "cls": cls, "rows": ["".join(r) for r in grid], "source": source,
                     "steps": [list(s) for s in steps]}
    return out


# 통행 겹침 우선순위: 한 칸에 여러 조각이 걸치면 가장 제한적인 값.  X > F > C
_RANK = {"X": 3, "F": 2, "C": 1}


def merge_chars(chars):
    best = None
    for c in chars:
        if c in _RANK and (best is None or _RANK[c] > _RANK[best]):
            best = c
    return best


# ---------- 검토용 겹쳐 그림 ----------
_TINT = {"X": (230, 40, 40), "C": (50, 110, 255), "F": (40, 200, 70)}


def tint_cell(im, ch, x, y, size, alpha=110):
    """RGBA 이미지 im 의 (x,y) 칸에 통행 색을 겹친다(PIL 필요 없이 numpy)."""
    if ch not in _TINT:
        return
    r, g, b = _TINT[ch]
    sub = im[y:y + size, x:x + size, :3].astype(np.float32)
    col = np.array([r, g, b], np.float32)
    im[y:y + size, x:x + size, :3] = (sub * (1 - alpha / 255) + col * (alpha / 255)).astype(np.uint8)
    im[y:y + size, x:x + size, 3] = 255
    im[y, x:x + size, :3] = col.astype(np.uint8)
    im[y:y + size, x, :3] = col.astype(np.uint8)
