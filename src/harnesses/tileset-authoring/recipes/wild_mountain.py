"""산·절벽 도로 — 원작 112·114번 도로(em Route112·Route114)와 fr Route4 바깥 산길을 그려 잰 장소 문법.

장소 문법(원작에서 잰 것):
- 높이는 「단」으로 읽힌다. 단의 윗면은 아랫땅과 **같은 바닥**(돌흙)이고, 높이는 테두리로만 보인다.
- 단의 **남쪽 끝 아래에 앞면**이 선다. 앞면은 **두 칸(30px) 높이의 바위 덩어리**이고 통행 불가다(112번 문법, 동굴 벽과 같은 재료 램프).
  크고 작은 적갈 바위 덩이(세 종 크기, 모가 난 윤곽)가 겹쳐 앉은 면이다: 덩이마다 왼쪽 위 삼각 면이 밝고 가운데 몸, 오른쪽 아래 면은
  홈·최암 윤곽, 덩이 사이 틈은 최암. 윗입술은 맨 위 덩이들의 머리 윤곽 그대로(1~3px 사이로 윗단 바닥이 비친다). 아래 1/3 은 한 단
  어둡고 맨 아래 두 줄 최암 → 아랫바닥 그늘 2줄. 평행 사선 획·고정 봉우리 줄은 쓰지 않는다(나무껍질·목책으로 읽혔다, QA-L7 M13).
  바위 램프(seed palette.cliff)는 나무 램프와 색상이 다른 적갈 하나 — 큰 바위·잔돌·깨는 바위도 같은 램프다(M14).
  칸 좌우 끝·윗칸/아랫칸 경계를 지나는 덩이는 모든 변형이 같아 변형(<접두>in0_*/in1_*)을 섞어 깔아도 이어진다.
- **등고선은 직선 띠가 아니다.** 단의 남쪽 끝은 열마다 한 줄씩 물러나며 사선 계단을 이룬다(한 칸짜리 계단 칸은 앞면 덩이가 비늘처럼
  한 줄 아래로 이어진다). 세 단은 서로 다른 열에서 꺾이고, 띠 끝은 맵 끝·나무·바위에 닿는다. 앞면 끝(옆이 열린 칸)은 위·아래 모서리가
  둥글고, 서쪽 끝은 최암 윤곽 + 빛 1줄, 동쪽 끝은 최암 2줄(윗테 줄은 양 끝 모두 크림색 톱니 그대로).
- 단의 동·서 끝은 7px 바위 옆면 띠(바깥 최암 윤곽 · 띠를 따라 이어 앉은 바위 덩이 — 앞면과 같은 면 명암 · 서쪽은 빛, 동쪽은 그늘),
  북쪽 끝(뒤로 떨어지는 쪽)은 6px 뒷테(같은 바위 덩이 줄). 띠 바로 안 윗면 1px 은 바닥 최암 그늘. 옆면과 뒷테는 모서리에서 45° 로 맞붙고
  바깥 모서리는 작게 둥글다(반지름 3 — 둥근 말뚝 머리가 아니게). 테는 통나무·목책처럼 매끈한 세로 명암이 아니다(QA-L7 N70). 앞면이 없는데 남쪽이 열린 곳은 5px 낮은 앞면(턱 크기)으로 끝난다.
- 단을 오르내리는 길은 앞면을 끊고 들어선 **회색 돌계단**(2칸 폭 2줄, 난간 없음 — 양옆 바위색 1px 뒤에 바로 앞면). 계단 옆 앞면은
  계단에 붙어 끊긴다(둥근 끝이 아니다).
- 동굴 입구는 2칸 앞면 안의 둥근 아치(폭 12~13px, 높이 21px) — 본 시트 동굴 입구와 같은 문법: 앞면 바닥선까지 뚫린 어두운 굴
  (바위 최암을 누른 두 톤) + 아치 둘레 밝은 돌 테 한 겹(왼쪽 밝고 오른쪽 어둡다). 문턱·문설주는 없다.
- 한 방향 지름길은 단 위의 흙 턱 = 본 시트 턱(outdoor2.ledge — 가는 혹 띠, 끝은 가늘어져 아래로 말림, 아래 그늘 2줄)을 절벽 바위
  램프로 칠한 것(숲 턱도 같은 문법을 숲 흙 램프로) — 남쪽으로 뛰어내리기만 한다. 턱의 끝은 맵 끝·벼랑·큰 바위에 닿는다.
- 침엽수는 본 시트 침엽수(pine_a 와 같은 그림, 발밑 그늘만 돌흙 — pine_m)이고 맵 둘레를 줄로 막는다(출입구만 길 폭으로 연다).
  큰 바위(본 시트 g2.big_rock)·깨지는 바위(본 시트 cave.smash_rock)는 통로 바닥에 놓여 길을 좁히거나
  막다른 주머니를 막는다(바위 깨기 자리). 풀 덩이는 흙 위에 바로 놓지 않고 풀 바닥(가장자리 오토타일) 위에 둔다.

깔기 순서(에디터 조수용):
1. 바닥 mfl0~3 → 2. 단 윗면을 그룹 cliff_a·cliff_b(서로 닿는 두 단은 다른 그룹)로 칠한다 → 3. 윗면 남쪽 끝 바로 아래 2줄을 앞면
   그룹 cface 로 칠한다(열마다 끝줄을 바꿔 사선 계단으로) → 4. 앞면 가운데 칸을 cface_atin0_*/cface_atin1_* 변형으로 섞는다(쇼케이스 faceVary),
   윗면 속 칸은 바닥 결 변형 cliffa_atin0_* → 5. 계단 cstairs(2줄 앞면) 을 앞면 줄 위치에 찍고, 계단 바로 위 윗면 칸은 남쪽으로 이어지게 한다 →
6. 동굴 ccave 를 2줄 앞면 안에 찍는다 → 7. 풀 바닥 mgrass 를 칠하고 그 속 칸에 키 큰 풀 tall0/1 → 8. 맵 둘레 침엽수 줄 pine_m(출입구 2칸만 비운다) → 9. 소품(바위·잔돌).
10. 마감: 앞면 칸 중 옆이 열린 윗칸(어깨)·아랫칸(발끝)은 cface_rnd<마스크>(반지름 13 큰 곡선 — face_round)로 바꾼다. 사선 등고선이
    열마다 16px 각진 계단이 아니라 둥근 띠로 흘러내린다(풀 바닥 앞면은 gface_rnd<마스크>). 이 둥근 끝이 모든 바위 벼랑 띠 끝의 정본이다(I4 W3 —
    강·본 시트 고원·기후 벼랑도 add_round_face + node/wild_round.mts roundFace). 사선 계단을 열마다 떼지 않는다(한 칸 기둥이 알약 바위로 선다).

타일:
- cliffa_at·cliffb_at(돌흙 윗면) · cliffg_at(풀 윗면, 강 협곡) — 가장자리 막힘(edge). connectGroups 로 앞면을 이웃으로 보아,
  앞면 위 칸은 남쪽 테두리를 그리지 않고 앞면 아래 칸은 북쪽 테두리를 그리지 않는다.
- cface_at(돌흙 바닥 사이 앞면) · gface_at(풀 바닥 사이 앞면) — block(통행 불가, terrain stone). 가운데 칸 변형:
  in0_0·in0_1 = 윗칸(위가 윗단) 금 무늬 둘, in1_0·in1_1 = 아랫칸(아래가 아랫땅) 금 무늬 둘. 아무 순서로 섞어도 이어진다.
- cliffa_atin0_0..2 · cliffb_atin0_* · cliffg_atin0_* — 윗면 속 칸 바닥 결 변형(엔진이 칸 해시로 섞는다).
- cstairs(2×2)·cstairs1(2×1)·gstairs(2×2, 풀) 회색 돌계단, ccave(1×2) 동굴 입구, mledge_s_{mid,mid1,l,r} 흙 턱(본 시트 턱 문법), mgrass_at 흙 위 풀 바닥,
  pine_m(2×3) 침엽수, bigrock(2×2), smashrock, mpeb0/1 잔돌(본 시트 cave.small_pebbles, 막힘)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402
import wild_common as wc  # noqa: E402

CR = 1                    # 단 바깥 모서리 반지름(거의 각 — 둥근 캡이 말뚝 머리·액자 틀로 읽혔다, QA-L7 N70·L8 R8b)
RIM = 6                   # 북쪽 뒷테 폭: 최암 1 · 밝은 입술 2 · 덩이 머리 3(머리 사이·밑은 윗면, 띠 안 윗면에 그늘 1px — QA-L8 R8b)
RIMS = 8                  # 서·동 옆면 폭 8px: 최암 1 · 바깥으로 비스듬히 깎인 덩이 옆면 7(R114 — QA-L8 R8b). 안쪽 구석 홈은 옆면 띠로 칠해 북 테와 다르므로 8+8 이 칸 폭을 채워도 47 변형이 갈린다
LOWFACE = 5               # 앞면 없이 남쪽이 열린 곳의 낮은 앞면 높이


def mfloor(P, v: int):
    return wc.quiet_floor("mfl", P["mfloor"], v)


MFLOOR_HI = ["#c49668", "#d2a678", "#dcb488", "#e6c498"]   # 높은 고원 윗면: 돌흙 램프 한 단 위(아랫땅과 다른 칸 — QA-L4 M9)


def mfloor_hi(P, v: int):
    """높은 고원(꼭대기 둔덕) 윗면 바닥: 아랫땅 돌흙과 같은 결, 한 단 밝은 톤 — 햇빛 받는 높은 단."""
    return wc.quiet_floor("mfh", [px.hexc(c) for c in MFLOOR_HI], v)


# ---- 둥근 사각 마스크(동심 모서리) -----------------------------------------------------------------
def rr_mask(m: int, dn: int, ds: int, dw: int, de: int, R: int):
    """열린 변마다 깊이만큼 깎고, 두 변이 열린 바깥 모서리는 반지름 R 로 둥글게(중심 = (dw+R', dn+R')).
    대각만 빈 안쪽 모서리는 두 깊이가 겹치는 사각을 깎는다. R 은 바깥 마스크와 같은 중심을 쓰도록 호출자가 맞춘다."""
    ins = [[True] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if (not m & N and y < dn) or (not m & S and y > T - 1 - ds) or (not m & W and x < dw) or (not m & E and x > T - 1 - de):
                ins[y][x] = False
    for bits, sx, sy, d1, d2 in ((N | W, 1, 1, dw, dn), (N | E, -1, 1, de, dn), (S | W, 1, -1, dw, ds), (S | E, -1, -1, de, ds)):
        if m & bits:
            continue
        cx0 = 0 if sx > 0 else T - 1
        cy0 = 0 if sy > 0 else T - 1
        ox, oy = cx0 + sx * (d1 + R), cy0 + sy * (d2 + R)
        for y in range(T):
            for x in range(T):
                inx = (x - ox) * sx < 0
                iny = (y - oy) * sy < 0
                if inx and iny and (x - ox) ** 2 + (y - oy) ** 2 > R * R + 0.5:
                    ins[y][x] = False
    for sides, diag, fx, fy, d1, d2 in ((N | W, NW, 0, 0, dw, dn), (N | E, NE, 1, 0, de, dn), (S | W, SW, 0, 1, dw, ds), (S | E, SE, 1, 1, de, ds)):
        if (m & sides) == sides and not m & diag:
            for y in range(T):
                for x in range(T):
                    xx = x if not fx else T - 1 - x
                    yy = y if not fy else T - 1 - y
                    if xx < d1 and yy < d2:
                        ins[y][x] = False
    return ins


def top_outer(m):
    return rr_mask(m, 0, 0, 0, 0, CR)


def top_inner(m):
    ins = rr_mask(m, RIM, LOWFACE, RIMS, RIMS, max(0, CR - RIM))
    for sides, diag, fx in ((S | W, SW, 0), (S | E, SE, 1)):          # 남쪽 안쪽 모서리는 바닥 그대로(구석 한 점만 그늘)
        if (m & sides) == sides and not m & diag:
            for y in range(T - LOWFACE, T):
                for x in range(RIMS):
                    xx = x if not fx else T - 1 - x
                    if (m & N or y >= RIM) and (m & (E if fx else W) or True):
                        ins[y][xx] = not (xx in (0, T - 1) and y == T - 1)
    return ins


def top_mask(m: int):
    return top_outer(m)


def face_mask(m: int):
    return [[True] * T for _ in range(T)]


# ---- 앞면(바위 벽) -----------------------------------------------------------------------------------
# 앞면 = 크고 작은 바위 덩이가 겹쳐 앉은 면(QA-L7 M13 — 평행 사선 획은 나무껍질·잔가지 다발로 읽혔다). 원작 112번 문법:
# 6~10px 덩이마다 왼쪽 위가 밝은 면(테 → 빛 → 몸), 오른쪽 아래 가장자리는 홈, 덩이 사이 틈은 홈·최암. 앞(아래) 덩이가 뒤 덩이를 덮는다.
# 윗입술은 맨 위 덩이들의 머리 윤곽 그대로(그 위로 윗단 바닥이 비친다) — 봉우리 「^」나 고정 톱니 줄이 아니다.
# 아래 1/3 은 한 단 어둡고 맨 아래 2줄은 최암, 그 밑 아랫바닥에 그늘 2줄. 본 시트 동굴 앞면(cave.cliff_face_px)과 같은 재료 문법.
# 이음: 칸 좌우 끝(x=0≡16)을 지나는 덩이는 모든 변형이 같은 「이음 덩이」다(작게 — 16px 주기가 드러나지 않게). 변형 덩이는 이음 열에
# 닿지 않게 안쪽에만 두므로 변형을 어떻게 옆으로 섞어도 이어진다. 윗칸·아랫칸 경계(r=16)를 지나는 큰 덩이는 변형마다 자리가 다르다
# (QA-L8 M17 — 위·가운데·아래 세 줄 코스가 쌓은 돌담으로 읽혔다) — 그래서 **한 열의 윗칸과 아랫칸은 같은 변형 번호**를 쓴다(쇼케이스 faceVary).
import random as _random

_SEAM_LUMPS = (                                                     # (중심 x, 중심 r, 반폭, 반높이) — 모든 변형 공통(칸 좌우 끝 이음 + 맨 아래 받침)
    (0.0, 4.6, 3.4, 4.4), (0.3, 14.0, 2.8, 3.8), (16.0, 21.5, 3.0, 4.2), (0.0, 27.0, 3.6, 3.0),
    (8.0, 30.0, 7.0, 2.6),
)


def _variant_lumps(var: int):
    """변형 var 의 덩이: 칸 경계 r=16 을 가로지르는 큰 덩이 하나(가로 자리·높이가 변형마다 다르다) + 윗칸·아랫칸에 둘씩.
    모두 이음 열(0·15)에 닿지 않게. 크기는 세 종(작은 3~3.6 · 중간 3.8~4.6 · 큰 4.8~5.8 반폭), 가로로 조금 넓적하다
    (반높이 = 반폭 × 0.7~1.0 — 둥근 조약돌이 아니라 쪼개진 바위 덩이)."""
    r = px.rng(f"cliff-face-lumps-{var}")
    rx = r.uniform(4.6, 5.6)
    out = [(r.uniform(1.8 + rx, 14.2 - rx), r.uniform(13.5, 18.5), rx, rx * r.uniform(0.8, 1.0))]   # 가운데 가로 틈을 끊는 덩이
    for half, (r0, r1) in enumerate(((-1.5, 16.5), (14.5, 29.2))):
        placed = 0
        for _ in range(400):
            if placed >= 2:
                break
            kind = (2, 1)[placed] if r.random() < 0.75 else r.choice((0, 1, 2))
            rx = r.uniform(*((3.0, 3.6), (3.8, 4.6), (4.8, 5.8))[kind])
            ry = rx * r.uniform(0.7, 1.0)
            cx = r.uniform(1.6 + rx, 14.4 - rx)
            cy = r.uniform(r0 + ry, r1 - ry) if half else r.uniform(max(r0 + ry, ry - 1.0), r1 - ry)
            if cx - rx < 1.5 or cx + rx > 14.5:
                continue
            if any(abs(cx - a) < (rx + c) * 0.55 and abs(cy - b) < (ry + d) * 0.55 for a, b, c, d in out):
                continue                                             # 너무 겹치면 한 덩이로 뭉개진다
            out.append((cx, cy, rx, ry))
            placed += 1
    return tuple(out)


FACE_VARS = 4        # 앞면 덩이 변형 수(<접두>in0_0..3 윗칸, in1_0..3 아랫칸 + 기본 칸 = 다섯 벌). 한 열의 윗칸·아랫칸은 같은 번호를 쓴다
_LUMPS_BY_VAR = {v: tuple(sorted(_SEAM_LUMPS + _variant_lumps(v), key=lambda l: l[1])) for v in range(FACE_VARS + 1)}


def _inside(nx: float, ny: float, seed: float) -> float:
    """모가 난 덩이 윤곽 값(1 이하면 안): 초타원(지수 1.5 — 둥근 알이 아니라 각진 돌)에 각도별 흔들림을 얹는다."""
    a = math.atan2(ny, nx)
    wob = 1.0 + 0.10 * math.sin(3 * a + seed) + 0.06 * math.sin(5 * a + 2 * seed)
    return (abs(nx) ** 1.5 + abs(ny) ** 1.5) ** (1 / 1.5) / wob


def _lump_at(var: int, x: float, r: float):
    """(x, r) 를 덮는 가장 앞(아래) 덩이의 정규 좌표 (nx, ny, 윤곽 값) 또는 None. 가로는 칸 주기로 감긴다."""
    best = None
    for cx, cy, rx, ry in _LUMPS_BY_VAR[var % (FACE_VARS + 1)]:
        dx = (x + 0.5 - cx + T / 2) % T - T / 2
        nx, ny = dx / rx, (r + 0.5 - cy) / ry
        e = _inside(nx, ny, cx * 1.7 + cy)
        if e <= 1.0:
            best = (nx, ny, e)
    return best


def _facet(nx: float, ny: float, e: float, tones, edge: float = 0.84):
    """바위 덩이 한 점의 면 명암(원작 112번 — 면이 꺾인 바위): tones = (테, 빛, 몸, 홈, 최암).
    왼쪽 위 삼각 면은 밝고(테·빛), 가운데 몸, 오른쪽 아래 면은 홈, 오른쪽 아래 윤곽은 최암. 둥근 그러데이션이 아니라 면 경계가 곧다."""
    rim, lit, body, groove, dark = tones
    s_ = nx + ny
    if e > edge and s_ > -0.05:
        return dark                                                    # 오른쪽 아래 윤곽(그늘 쪽 가장자리)
    if s_ < -1.15:
        return rim                                                     # 왼쪽 위 끝 작은 빛점
    if s_ < -0.5:
        return lit                                                     # 빛 받은 왼쪽 위 삼각 면
    if s_ < 0.55:
        return body
    return groove                                                      # 그늘 면


def _lip(var: int, x: int) -> int:
    """윗입술 깊이: 이 열에서 맨 처음 덩이가 덮는 줄(그 위는 윗단 바닥이 비친다)."""
    for r in range(3):
        if _lump_at(var, x, r) is not None:
            return r
    return 3


def face_px(w, x: int, r: int, var: int = 0, tall: bool = True):
    """앞면 한 점. r = 앞면 맨 위에서 내려온 줄(두 칸 앞면 0..31, 한 칸 앞면 0..15). None = 아랫바닥 그늘 자리, "top" = 윗단 바닥.
    w = 바위 램프 5톤(최암·홈·몸·빛·테)."""
    H = 32 if tall else 16
    if r >= H - 2:
        return None
    rr = r if tall or r < 9 else r + 16                               # 한 칸 앞면: 윗칸 위쪽 + 아랫칸 아래쪽
    if rr >= 28:
        return w[0]                                                   # 맨 아래 2줄 최암(아랫땅으로 가라앉는다)
    low = rr >= 21                                                    # 아래 1/3: 한 단 어둡다
    hit = _lump_at(var, x, rr)
    if hit is None:
        if rr < 3:
            return "top"                                              # 덩이 머리 사이로 윗단 바닥이 비친다(울퉁불퉁한 윗입술, 1~3px)
        return w[0]                                                   # 덩이 사이 틈(최암 — 점 무늬를 넣으면 해칭으로 읽힌다)
    nx, ny, e = hit
    if rr < 9 and rr - 1 < 3 and _lump_at(var, x, rr - 1) is None:
        return w[4]                                                   # 덩이 머리 윗선 = 밝은 윗입술(덩이 윤곽을 따른다)
    return _facet(nx, ny, e, (w[4], w[3], w[2], w[1], w[0]) if not low else (w[3], w[2], w[1], w[1], w[0]))


def face_tile(P, m: int, top_px, low_px, shade_px, var: int = 0, lip=None):
    """앞면 한 칸. 위가 윗단(N 열림)이면 윗칸, 아래가 아랫땅(S 열림)이면 아랫칸, 둘 다 열리면 한 칸 앞면(낮은 단).
    옆이 열리면 끝: 서쪽 = 밝은 테 2줄, 동쪽 = 최암 2줄, 아래 모서리는 반지름 4 로 둥글다(바깥은 아랫바닥).
    본 시트 rock_at* 이 이 함수를 정본으로 import 한다 — 이름·인자를 바꾸지 말 것."""
    w = P["cliff"]
    im = px.new()
    n_open, s_open, w_open, e_open = not m & N, not m & S, not m & W, not m & E
    tall = not (n_open and s_open)
    H = 32 if tall else 16
    roff = 0 if n_open else T
    R, RT = 4, 5
    for y in range(T):
        for x in range(T):
            r = y + roff
            if not n_open and not s_open:
                r = T + 2 + (y % 10)                              # 세 칸 이상 앞면의 가운데 칸: 아랫칸 결을 이어 간다
            yb = H - 3 - roff                                     # 이 칸 안의 앞면 마지막 줄 y(아랫칸·한 칸 앞면)
            outside = False
            if s_open:
                for open_, X in ((w_open, x), (e_open, T - 1 - x)):
                    if open_ and X < R and y > yb - R and (X - R + 0.5) ** 2 + (y - (yb - R) - 0.5) ** 2 > R * R:
                        outside = True
            if n_open:                                            # 위 모서리도 둥글다(볼록 모서리 — 사선 단이 둥글게 꺾여 내려간다)
                for open_, X in ((w_open, x), (e_open, T - 1 - x)):
                    if open_ and X < RT and y < RT and (X - RT + 0.5) ** 2 + (y - RT + 0.5) ** 2 > RT * RT:
                        im.putpixel((x, y), top_px(x, y))
                        outside = None
            if outside is None:
                continue
            if outside:
                im.putpixel((x, y), low_px(x, y))
                continue
            c = face_px(w, x, r, var, tall)
            if c is None:
                im.putpixel((x, y), shade_px(x, y))
                continue
            if c == "top":
                im.putpixel((x, y), top_px(x, y))
                continue
            fr_x = _lip(var, x)
            if n_open and r > fr_x + 1:                           # 둥근 위 모서리 윤곽(윗테 줄은 건드리지 않는다 — 모서리에 혹이 솟지 않게)
                for open_, X in ((w_open, x), (e_open, T - 1 - x)):
                    if open_ and X < RT and y < RT and (X - RT + 0.5) ** 2 + (y - RT + 0.5) ** 2 > (RT - 1.3) ** 2:
                        c = w[0]
            if w_open and x <= 1 and r > fr_x + 1:
                c = w[0] if x == 0 else (w[2] if c != w[0] else w[1])   # 서쪽 끝: 최암 윤곽 1px + 빛 받은 옆면 1px
            if e_open and x >= T - 2 and r > fr_x + 1:
                c = w[0] if x == T - 1 or r % 2 else w[1]
            im.putpixel((x, y), c)
    # 안쪽 모서리(대각만 빈 칸): 구석 2px 그늘 점 — 47 변형이 모두 다르게(사선 계단 칸이 눈에 띄는 홈을 갖지 않게 작게)
    for sides, diag, pts in ((N | E, NE, ((15, 0), (14, 0))), (N | W, NW, ((0, 0), (1, 0))),
                             (S | E, SE, ((15, 15), (15, 14))), (S | W, SW, ((0, 15), (0, 14)))):
        if (m & sides) == sides and not m & diag:
            for p_ in pts:
                im.putpixel(p_, w[2] if im.getpixel(p_)[:3] == w[0][:3] else w[0])
    return im


_RIM_HEADS = ((1.8, 2.4), (6.4, 2.0), (10.6, 2.6), (14.6, 1.6))       # 북 테 혹 머리(가로 중심, 반폭) — 칸마다 넷, 크기가 다르다
_RIM_LUMPS = ((3.6, 4.6), (10.8, 3.4), (15.4, 2.0))                  # 테 띠 바위 덩이(띠를 따라 중심, 반길이) — 칸 16px 주기, 크기 셋


def _rim_px(rk, d: int, x: int, y: int, face: str, wd: int, shade, top=None):
    """고원 테 띠 한 점(QA-L7 N70·R8 — 매끈한 띠는 통나무·목책·액자 틀로 읽혔다): 띠를 따라 이어 앉은 바위 덩이(크기 셋, 칸 주기).
    본 시트 동굴 벽 옆면(cave._gside — 변을 따라 이어 앉은 바위 덩이)과 같은 문법이고, 덩이 명암은 앞면 덩이(face_px)와 같다:
    왼쪽 위 밝은 면 → 몸 → 오른쪽 아래 홈, 덩이 사이 틈은 최암. 서쪽 옆면·북 테는 빛(테·빛·몸), 동쪽 옆면은 한 단 어둡다.
    face: "w" 서쪽 옆면 · "e" 동쪽 옆면 · "n" 북쪽 뒷테. d = 바깥에서 몇 px(0 = 최암 윤곽), wd = 띠 폭.
    옆면은 바깥 2px 이 한 단 어둡다 — 바깥쪽으로 비스듬히 깎여 내려가는 덩이 옆면(R114, QA-L8 R8b).
    북 테는 맨 윗줄부터 가장 밝은 혹 머리(2~3px, 칸마다 넷)가 늘어서고 최암은 혹 사이 틈 1px 에만 — 혹 밑 1px 그늘, 그 밖은 윗면(top).
    띠 안쪽(윗면 쪽)에 밝은 입술을 따로 긋지 않는다 — 띠 바로 안 윗면 1px 은 cliff_top 이 바닥 최암 그늘(shade)로 칠한다."""
    if face == "n":
        hit = None
        for ca, ra in _RIM_HEADS:                                      # 혹 머리(맨 윗줄부터 2~3px — 단에서 가장 밝은 입술, QA-L9 R9)
            da = (x + 0.5 - ca + T / 2) % T - T / 2
            nx, ny = da / ra, (d + 0.5 - 1.6) / 1.9
            e = _inside(nx, ny, ca * 2.3)
            if e <= 1.0:
                hit = (nx, ny, e)
        if hit is not None:
            return _facet(*hit, (rk[4], rk[4], rk[3], rk[2], rk[1]), 0.93)
        if d == 0:
            return rk[0]                                               # 혹과 혹 사이 틈 1px 만 최암
        if d == 1:
            return rk[3]
        above = any(_inside(((x + 0.5 - ca + T / 2) % T - T / 2) / ra, (d - 0.5 - 1.6) / 1.9, ca * 2.3) <= 1.0 for ca, ra in _RIM_HEADS)
        return shade if above or d == 2 or top is None else top        # 혹·입술 바로 밑 그늘 1px, 그 밖은 윗면
    if d <= 0:
        return rk[0]
    c = face_px(rk, x, 6 + y, 1)                                      # 옆면 몸 = 앞면과 같은 바위 덩이 판(덩이·빛 면·틈이 그대로 이어진다)
    if c is None or c == "top":
        c = rk[1]
    if face == "e":
        c = rk[max(0, rk.index(c) - 1)]                                # 동쪽(그늘) 옆면은 한 단 어둡다
    if d == 1:
        c = rk[max(0, rk.index(c) - 1)] if face == "e" else c          # 바깥 1px: 그늘 쪽은 깎인 면
    return c


def cliff_top(P, m: int, top_px, low_px, shade_px):
    """단 윗면 한 칸. 안은 윗단 바닥. 동서 옆면 8px 는 띠를 따라 이어 앉은 바위 덩이(바깥 1/3 은 비스듬히 깎여 한 단 어둡다),
    북 테 6px 는 밝은 입술 2px + 덩이 머리(_rim_px). 서쪽은 빛, 동쪽은 그늘. 옆면과 북 테는 모서리에서 45° 로 맞붙고
    바깥 모서리는 거의 각이다(둥근 캡 없음). 안쪽 구석 홈은 위 칸에서 내려온 옆면 띠로 칠한다. 남쪽이 열리면(앞면 없이 끝남) 5px 낮은 앞면(덩이 머리 → 최암 밑).
    바깥 모서리 밖은 아랫바닥. 본 시트 rock_at* 이 이 함수를 정본으로 import 한다 — 이름·인자를 바꾸지 말 것."""
    rk = P["cliff"]
    outer, inner = top_outer(m), top_inner(m)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if not outer[y][x]:
                im.putpixel((x, y), low_px(x, y))
                continue
            if inner[y][x]:
                band = lambda xx, yy: 0 <= xx < T and 0 <= yy < T and outer[yy][xx] and not inner[yy][xx]
                # 테 띠 바로 안(띠가 왼·오른·위에 있는 윗면 점) = 입술 밑 그늘 1px — 띠는 바위 7px(북 6px) 그대로, 그늘은 윗면에 진다
                im.putpixel((x, y), shade_px(x, y) if band(x - 1, y) or band(x + 1, y) or band(x, y - 1) else top_px(x, y))
                continue
            # 테두리: 어느 변 쪽인가
            dn = y if not m & N else 99
            ds = T - 1 - y if not m & S else 99
            dw = x if not m & W else 99
            de = T - 1 - x if not m & E else 99
            notch = ""
            for sides, diag, fx, fy in ((N | W, NW, 0, 0), (N | E, NE, 1, 0)):
                if (m & sides) == sides and not m & diag:
                    xx = x if not fx else T - 1 - x
                    if xx < RIMS and y < RIM:
                        notch = "w" if not fx else "e"             # 안쪽 구석 홈 = 위 칸에서 내려온 옆면 띠가 아래 단 북 테와 만나는 자리 — 옆면 띠로 칠한다
            dout = wc.dist_out(outer, m, x, y, RIMS)
            if y == T - 1 and ((x == 0 and (m & (S | W)) == (S | W) and not m & SW) or (x == T - 1 and (m & (S | E)) == (S | E) and not m & SE)):
                im.putpixel((x, y), rk[1])                        # 남쪽 안쪽 구석 한 점(그늘) — 47 변형이 갈린다
                continue
            if ds <= LOWFACE - 1 and ds <= min(dn, dw, de) + 2:
                # 낮은 앞면(남쪽): 덩이 머리 → 몸 → 최암 밑
                k = LOWFACE - 1 - ds                              # 0 = 맨 위
                c = rk[3] if k == 0 else rk[2] if k == 1 else rk[0] if ds == 0 or (x * 3 + k) % 5 == 0 else rk[1]
            elif notch:
                c = _rim_px(rk, x if notch == "w" else T - 1 - x, x, y, notch, RIMS, shade_px(x, y))
            elif dw < RIMS and (dw <= min(dn, de) or dn >= RIM):    # 서쪽 옆면(빛 받음)
                c = _rim_px(rk, 0 if dout <= 1 else min(dw, RIMS - 1), x, y, "w", RIMS, shade_px(x, y))
            elif de < RIMS and (de <= dn or dn >= RIM):          # 동쪽 옆면(그늘)
                c = _rim_px(rk, 0 if dout <= 1 else min(de, RIMS - 1), x, y, "e", RIMS, shade_px(x, y))
            else:                                                 # 북쪽 뒷테
                c = _rim_px(rk, min(dn, RIM - 1), x, y, "n", RIM, shade_px(x, y), top_px(x, y))   # 북 테는 맨 윗줄도 혹·입술(최암은 틈에만)
            im.putpixel((x, y), c)
    return im


STAIR_STONE = ["#555f64", "#7a878d", "#b1bcc0", "#f4fefa"]   # 돌계단 회색 돌 램프(정본 — 원작 돌계단의 푸른 회색 4톤)


def stairs(P, x_cell: int, y_cell: int, top_px, low_px, rows: int = 2):
    """앞면을 끊고 들어선 회색 돌계단(2×rows). 윗단은 앞면 입술과 같은 높이(칸 맨 위)에서 시작한다.
    한 단 = 밝은 디딤 3px + 어두운 챌면 2px, 디딤 앞 끝에 흰 빛 한 줄. 난간은 없다 — 양옆은 바위색 1px 뒤에 바로 앞면이 붙는다.
    회색 돌 램프는 이 함수가 정본으로 정한 STAIR_STONE 네 톤이다(본 시트가 이 함수를 그대로 부른다 — 본 시트 색을 따라 바꾸지 않는다).
    본 시트가 이 함수를 정본으로 import 한다 — 이름·인자를 바꾸지 말 것."""
    st = [px.hexc(c) for c in STAIR_STONE]
    g = [st[0], st[1], st[3], st[2], st[3]]                      # 최암·챌면·왼쪽 빛·디딤·흰 빛(옛 5톤 자리를 steel 4톤으로)
    rk = P["cliff"]
    im = px.new()
    H = rows * T
    for y in range(T):
        for x in range(T):
            X = x_cell * T + x
            Y = y_cell * T + y
            k = Y % 5
            if X in (0, 31):
                c = rk[1] if Y > 0 else rk[4]
            else:
                c = g[4] if k == 0 else g[3] if k <= 2 else g[1] if k == 3 else g[0]
                if X == 1 and k > 0:
                    c = g[2] if k <= 2 else g[0]
                elif X == 30 and k > 0:
                    c = g[1] if k <= 2 else g[0]
            if Y >= H - 1:
                c = rk[0] if X in (0, 31) else g[0]
            im.putpixel((x, y), c)
    return im


CAVE_DARK = "#3c3040"        # 굴 속 한 톤(원작 112·114 굴의 보라 기운 짙은 회색 — 최암보다 한 단 밝다)
CAVE_SILL = ["#6e6460", "#8c827a"]   # 굴 바닥 회갈 문턱 2px(위 밝음 · 아래 어둠)


def cave_mouth(P, part: int, top_px, low_px, shade_px):
    """2줄 앞면 안의 동굴 입구(1×2, QA-L8 M16 — 네모 문틈·갱도 문으로 읽혔다): 원작 112·114 굴 문법.
    구멍 = 반지름 6.5px 반원 아치 머리 + 곧은 몸(폭 13px, 높이 20px — 사람이 드는 크기), 속은 보라 기운 짙은 회색 한 톤(CAVE_DARK).
    아치 머리 둘레 1px 은 바위 최암 윤곽(앞면 덩이가 구멍을 두른다), 몸 양옆 1px 은 덩이 그늘(w1) — 밝은 문설주는 없다.
    바닥에 회갈 문턱 2px(CAVE_SILL), 그 밑은 앞면 밑 그늘. 본 시트가 정본으로 import 한다 — 이름·인자를 바꾸지 말 것."""
    w = P["cliff"]
    m = (S | E | W | SE | SW) if part == 0 else (N | E | W | NE | NW)
    im = face_tile(P, m, top_px, low_px, shade_px)
    top, bot, rad, cx = 8.0, 27.0, 6.5, 8.0
    cyc = top + rad

    def door(x, Y):
        if Y > bot or Y < top or x < 0 or x >= T:
            return False
        dx = x + 0.5 - cx
        if Y + 0.5 >= cyc:
            return abs(dx) <= rad
        return dx * dx + (Y + 0.5 - cyc) ** 2 <= rad * rad
    dark, sill = px.hexc(CAVE_DARK), [px.hexc(c) for c in CAVE_SILL]
    for y in range(T):
        for x in range(T):
            Y = part * T + y
            if door(x, Y):
                im.putpixel((x, y), dark)
            elif bot < Y <= bot + 2 and abs(x + 0.5 - cx) <= rad + 0.5:
                im.putpixel((x, y), sill[0] if Y == bot + 1 else sill[1])   # 문턱 2px
            elif Y <= bot and any(door(x + dx, Y + dy) for dx, dy in ((0, 1), (1, 0), (-1, 0), (1, 1), (-1, 1))):
                im.putpixel((x, y), w[0] if Y + 0.5 < cyc + 1 else w[1])   # 아치 머리 둘레 = 최암 윤곽, 몸 옆 = 덩이 그늘
    return im


def big_rock(P):
    """큰 바위(2×2, 투명 바탕): 덩이 넷, 왼쪽 위 빛, 아래·오른쪽 최암 윤곽, 바닥 접점에 붙은 2px 그림자(윤곽을 따른다)."""
    rk = P["rock"]
    im = px.new(2 * T, 2 * T)
    shape = [(15.5, 13.0, 10.0), (8.5, 19.0, 7.2), (23.0, 19.5, 7.4), (16.0, 22.0, 7.5), (11.0, 9.5, 5.0)]
    inside = wc.lobes(shape)
    for y in range(18, 2 * T):                                           # 그림자: 바닥에 닿은 아래 가장자리 바로 밑 2px(바위 윤곽을 따른다)
        for x in range(2 * T):
            if not inside(x, y) and (inside(x, y - 1) or inside(x, y - 2) or inside(x - 1, y - 2)):
                im.putpixel((x, y), wc.SHADOW)
    for y in range(2 * T):
        for x in range(2 * T):
            if not inside(x, y):
                continue
            cx, cy, r = min(shape, key=lambda l: (x - l[0]) ** 2 + (y - l[1]) ** 2 - l[2] ** 2)
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            light = -((x - cx) + (y - cy)) / r
            if edge[1] or edge[2]:
                c = rk[0]
            elif edge[0] or edge[3]:
                c = rk[1]
            else:
                c = rk[4] if light > 0.85 else rk[3] if light > 0.25 else rk[2] if light > -0.45 else rk[1]
                d2 = sorted(((x - l[0]) ** 2 + (y - l[1]) ** 2 - l[2] ** 2) for l in shape)
                if len(d2) > 1 and abs(d2[0] - d2[1]) < 9 and light < 0.6:
                    c = rk[1]
            im.putpixel((x, y), c)
    return im


GRASS_PATCH = ("mgrass", 4, 7, 2)   # (이름, 평균 깊이, 바깥 모서리 반지름, 출렁임 진폭)


def _gwave(side: str, i: int) -> int:
    """풀밭 가장자리 깊이(칸 변을 따라 i 번째 px): 두 사인을 겹친 주기 16 물결 — 1~7px 로 크게 출렁인다.
    같은 변 이름이면 같은 값이라 옆 칸 가장자리와 이어진다(QA-L5 M10: 칸 경계를 따라 곧게 잘린 판이 아니게)."""
    import math
    if i == T - 1:
        i = 0                                                    # 끝 줄은 첫 줄과 같다 — 위아래(좌우) 칸 이음새가 맞는다(px.edge_jitter 와 같은 규칙)
    ph = {"n": 3.0, "s": 9.0, "w": 6.0, "e": 12.0}[side]
    _, depth, _, amp = GRASS_PATCH
    v = depth + amp * math.sin(2 * math.pi * (i + ph) / T) + 1.2 * math.sin(4 * math.pi * (i + ph * 1.7) / T)
    return max(1, min(T // 2 - 1, round(v)))


def grass_mask(m):
    """풀밭 마스크: 열린 변마다 _gwave 깊이만큼 깎고(물결 둑), 두 변이 열린 바깥 모서리는 둥글게, 대각만 빈 안쪽 모서리는
    두 이웃 칸의 물결이 만나는 홈만 깎는다."""
    R = GRASS_PATCH[2]
    ins = [[True] * T for _ in range(T)]
    cn = lambda x, y: y < _gwave("n", x)
    cs = lambda x, y: y > T - 1 - _gwave("s", x)
    cw = lambda x, y: x < _gwave("w", y)
    ce = lambda x, y: x > T - 1 - _gwave("e", y)
    for y in range(T):
        for x in range(T):
            if (not m & N and cn(x, y)) or (not m & S and cs(x, y)) or (not m & W and cw(x, y)) or (not m & E and ce(x, y)):
                ins[y][x] = False
            for bits, fx, fy in ((N | W, 0, 0), (N | E, 1, 0), (S | W, 0, 1), (S | E, 1, 1)):
                if m & bits:
                    continue
                xx = x if not fx else T - 1 - x
                yy = y if not fy else T - 1 - y
                if xx < R and yy < R and (xx - R + 0.5) ** 2 + (yy - R + 0.5) ** 2 > R * R:
                    ins[y][x] = False
            for sides, diag, ca, cb in ((N | E, NE, cn, ce), (N | W, NW, cn, cw), (S | E, SE, cs, ce), (S | W, SW, cs, cw)):
                if (m & sides) == sides and not m & diag and ca(x, y) and cb(x, y):
                    ins[y][x] = False
    return ins


def grass_patch(P, m: int, dirt_px, grass_px):
    """흙 위 풀 바닥(가장자리 오토타일, 걸을 수 있다): 안은 마을 풀, 가장자리 1px 짙은 풀, 바깥 흙 쪽으로 잎 술(1~2px)이
    띄엄띄엄 삐져나오고, 풀 바로 밑 흙 한 줄은 그늘. 가장자리는 1~7px 로 출렁이는 물결 — 원 크기에서 덩이 풀밭으로 읽힌다."""
    g = P["grass"]
    inside = grass_mask(m)
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                c = grass_px(x, y)
                if not all(nb.values()):
                    c = g[1] if (x + y) % 3 else g[0]
            else:
                c = dirt_px(x, y)
                if nb.get("n"):
                    c = P["mfloor"][0]                                     # 풀 밑 그늘
                elif any(nb.values()) and (x * 7 + y * 3) % 4 == 0:
                    c = g[1]                                               # 잎 술
            im.putpixel((x, y), c)
    return im


# 앞면 줄 종류(가운데 칸 마스크): 윗칸 = 위가 윗단, 아랫칸 = 아래가 아랫땅
ROW_T = S | E | W | SE | SW
ROW_B = N | E | W | NE | NW


# ---- 사선 등고선·띠 끝의 둥근 어깨·발끝(정본 — 감독 결정 I4 W3: 모든 바위 벼랑 띠 끝은 이 칸이다. face_tile 출력은 그대로 두고 덧칠한 새 칸) ----
# 다른 시트는 add_round_face / round_face_set 을 색 인자(P["cliff"] 램프 · 윗단·아랫땅·그늘 바닥 함수)로 부른다. 배치는 쇼케이스 공용
# node/wild_round.mts 의 roundFace(옆이 열린 앞면 윗칸·아랫칸 = ROUND_MASKS 마스크 칸을 <앞면>_rnd<마스크> 로) — 사선 계단은 먼저 stepCut 으로 뗀다.
# 단 끝이 열마다 한 줄씩 물러나는 사선 등고선에서 face_tile 은 바깥 모서리를 반지름 4~5 로만 깎는다 — 열마다 16px 각진 계단이
# 지그재그로 읽혔다(I3 Z3). 사선 계단의 윗칸 바깥 위 모서리(어깨)와 아랫칸 바깥 아래 모서리(발끝)를 큰 반지름으로 깎은 칸을 따로 둔다.
# 어깨 곡선은 한 칸 높이를 거의 다 써서 윗단 입술이 다음 열 입술로 둥글게 흘러내리고, 발끝 곡선은 앞 열 밑선에서 다음 열 밑선으로 흘러내린다.
ROUND_R = 13          # 어깨·발끝 반지름(px)
ROUND_MASKS = {       # 앞면 마스크 → 깎을 모서리(ne/nw = 윗칸 어깨, sw/se = 아랫칸 발끝)
    S | W: "ne", S | W | SW: "ne", S | E: "nw", S | E | SE: "nw", S: "nwne",
    N | E: "sw", N | E | NE: "sw", N | W: "se", N | W | NW: "se", N: "swse",
}


def face_round(P, m: int, top_px, low_px, shade_px, var: int = 0, R: int = ROUND_R):
    """앞면 칸 m(face_tile 그대로)의 바깥 모서리를 반지름 R 로 크게 깎는다(ROUND_MASKS). 곡선 바깥은 윗단 바닥(어깨) · 아랫바닥(발끝),
    곡선 위 1px 은 바위 최암 윤곽, 어깨의 빛 쪽(서쪽 끝)은 그 안 1px 이 빛 면 — face_tile 의 옆 끝 문법을 곡선을 따라 잇는다.
    발끝 곡선 밑 2px 은 아랫바닥 그늘(앞면 밑 그늘 2줄과 같은 톤)."""
    w = P["cliff"]
    im = face_tile(P, m, top_px, low_px, shade_px, var)
    corners = ROUND_MASKS[m]
    yb = 13                                                        # 아랫칸 앞면 마지막 줄(face_tile: H-3-roff)
    face = [[True] * T for _ in range(T)]

    def dist(x, y, c):
        X = x if c[1] == "w" else T - 1 - x
        if c[0] == "n":
            return X, y, R, R                                       # 모서리 쪽 좌표 · 원 중심(R-0.5, R-0.5)
        return X, yb - y, R, R

    zone = {}
    for c in (corners[i:i + 2] for i in range(0, len(corners), 2)):
        for y in range(T):
            for x in range(T):
                X, Y, cx, cy = dist(x, y, c)
                if X < cx and 0 <= Y < cy:
                    d = math.hypot(X - cx + 0.5, Y - cy + 0.5)
                    if d > R:
                        face[y][x] = False
                    zone[(x, y)] = (c, d, X, Y)
                elif c[0] == "s" and X < cx and Y < 0:
                    face[y][x] = False                               # 발끝 곡선 밑 그늘 줄(아래에서 칠한다)
                    zone[(x, y)] = (c, R + 9, X, Y)
    out = im.copy()
    for (x, y), (c, d, X, Y) in zone.items():
        if not face[y][x]:
            if c[0] == "n":
                out.putpixel((x, y), top_px(x, y))
            else:
                under = any(0 <= y - k and face[y - k][x] for k in (1, 2))
                out.putpixel((x, y), shade_px(x, y) if under else low_px(x, y))
            continue
        px_ = im.getpixel((x, y))
        if c[0] == "n" and px_[:3] == top_px(x, y)[:3]:
            continue                                                # 입술 위 덩이 머리 사이(윗단 바닥)
        if d > R - 1.2:
            out.putpixel((x, y), w[0])                              # 곡선 윤곽(최암)
        elif d > R - 2.3 and c[1] == "w" and (c[0] == "n" or Y > 3):
            out.putpixel((x, y), w[2] if px_[:3] != w[0][:3] else w[1])   # 서쪽(빛) 끝: 윤곽 안 1px 빛 면
        elif d > R - 2.3 and c[1] == "e":
            out.putpixel((x, y), w[1] if px_[:3] != w[0][:3] else w[0])   # 동쪽(그늘) 끝: 윤곽 안 1px 홈
    return out



def round_face_set(P, pre: str, top_px, low_px, shade_px) -> dict:
    """둥근 어깨·발끝 한 벌 {<pre>_rnd<m>: 그림}(m = ROUND_MASKS 10개: 4 5 12 13 … 그대로 숫자). pre = 앞면 그룹 접두(… _at 를 뺀 것,
    예: cface · gface · 기후 dface/vface/iceface). P 는 face_tile 과 같은 팔레트(P["cliff"] 바위 램프), 바닥 함수 셋도 face_tile 과 같다."""
    return {f"{pre}_rnd{m}": face_round(P, m, top_px, low_px, shade_px) for m in ROUND_MASKS}


def add_round_face(sh, P, pre: str, top_px, low_px, shade_px):
    """시트 sh 에 round_face_set 한 벌을 굽는다(현재 줄에 이어서)."""
    for name, im in round_face_set(P, pre, top_px, low_px, shade_px).items():
        sh.add(name, im)
