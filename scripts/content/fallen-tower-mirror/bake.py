"""폴른 스타 하늘탑 3층 「렌즈 거울」 걷기 칩 시트(RM2K3 CharSet 288x256) — 코드 손 도트.

fs-vqa-obs(2026-11-10): 3층 거울 다섯이 RTP Object2 의 누름 버튼(#3)·회보라 바위(#6) 칸이라 거울로 읽히지 않았다
(오너: 「저거 뭔 벽돌을 배치해놓고 웬 거울이라우기고있냐」). 이벤트 그림은 캐릭터 시트만 받으므로 시트를 새로 그린다.
- 칸 0 = 어두운 거울(남빛 유리), 칸 1 = 빛이 맺힌 거울(옅은 유리 + 반짝 + 따뜻한 테두리 빛).
- 네 방향 줄 = 거울 면이 향한 쪽: 아래 = 유리 원판 정면, 왼쪽·오른쪽 = 옆에서 본 얇은 원판과 축, 위 = 놋쇠 뒷판(위 테두리로 유리 가장자리).
- 돌 받침·놋쇠 갈래는 네 방향 모두 같다 — 같은 물건이 돈 것으로 읽힌다. 패턴 셋은 같은 그림(fixedGraphic 로 쓴다).
실행: python3 scripts/content/fallen-tower-mirror/bake.py  → public/assets/generated/charsets/FallenMirror1.png
"""
from pathlib import Path

from PIL import Image

T = (0, 0, 0, 0)
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/assets/generated/charsets/FallenMirror1.png"
DIR_ROWS = ["up", "right", "down", "left"]  # RM2K3 시트 줄 순서(src/assets/easyrpgRtp.ts CHARSET_DIRECTIONS)


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


OUTLINE = hexc("1c1418")
STONE = (hexc("a8a6b4"), hexc("767484"), hexc("4a485e"))
BRASS = (hexc("ffe08a"), hexc("d0a040"), hexc("8a6018"))
BACK = (hexc("4a3428"), hexc("3a281e"))  # 거울 뒷판(어두운 나무)


def mirror_frame(lit, facing):
    """거울 한 칸(24x32). lit = 빛이 맺힘, facing = 면이 향한 쪽."""
    im = Image.new("RGBA", (24, 32), T)
    p = im.load()
    stone_l, stone_m, stone_d = STONE
    brass_l, brass_m, brass_d = BRASS
    for x in range(5, 20):
        p[x, 31] = (28, 20, 24, 70)
    # 돌 받침 — 윗면 두 줄 + 앞면, 오른쪽 끝 그늘.
    for y in range(24, 31):
        for x in range(6, 18):
            p[x, y] = stone_l if y <= 25 else (stone_m if x < 16 else stone_d)
        p[5, y] = OUTLINE
        p[18, y] = OUTLINE
    for x in range(5, 19):
        p[x, 23] = OUTLINE
        p[x, 30] = OUTLINE
    for x in range(6, 18):
        p[x, 26] = stone_d
    # 놋쇠 기둥.
    for y in range(19, 23):
        for x in range(10, 14):
            p[x, y] = brass_m if x < 13 else brass_d
        p[9, y] = OUTLINE
        p[14, y] = OUTLINE
    cx, cy, ry = 11.5, 10.5, 8
    rx = 8 if facing in ("down", "up") else 3.4

    def glass(x, y):
        t = ((x - cx) / rx + (y - cy) / ry) / 1.4
        if lit:
            return (232, 244, 255, 255) if t < -0.2 else ((204, 228, 252, 255) if t < 0.35 else (172, 208, 242, 255))
        return (70, 96, 140, 255) if t < -0.2 else ((46, 66, 104, 255) if t < 0.35 else (32, 44, 76, 255))

    for y in range(0, 21):
        for x in range(24):
            d = (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 0.5
            if d > 1 + 0.5 / ry:
                continue
            if d > 1 - 1.0 / min(rx, ry):
                p[x, y] = OUTLINE
            elif d > 1 - 2.3 / min(rx, ry):
                p[x, y] = brass_l if (y < cy and x < cx + 1) else (brass_m if y < cy + 3 else brass_d)
            elif facing == "up":
                # 뒷면 — 반점 박힌 놋쇠 원판은 실제 크기에서 금빛 돌처럼 읽혔다(fs-sky-tower-mirrors).
                # 어두운 나무 뒷판 + 놋쇠 십자 버팀으로 「거울을 뒤에서 본 것」이 되게 한다.
                if abs(x - cx) < 1 or abs(y - cy) < 1:
                    p[x, y] = brass_m
                else:
                    p[x, y] = BACK[0] if (x + y) % 5 else BACK[1]
            else:
                p[x, y] = glass(x, y)
    if facing in ("down", "up"):
        # 좌우 축 핀 — 틀 양옆.
        for yy in (10, 11):
            p[2, yy] = OUTLINE
            p[3, yy] = brass_l
            p[21, yy] = OUTLINE
            p[20, yy] = brass_d
    else:
        # 옆모습 — 받침에서 축까지 올라온 놋쇠 팔.
        for y in range(11, 19):
            p[int(cx), y] = brass_d if y > 12 else brass_l
        p[int(cx), 10] = OUTLINE
    if facing == "down":
        for k in range(5):
            if p[8 + k, 4 + k][3]:
                p[8 + k, 4 + k] = (255, 255, 255, 255) if lit else (150, 176, 214, 255)
        for k in range(3):
            p[7 + k, 9 + k] = (240, 250, 255, 255) if lit else (118, 146, 186, 255)
        if lit:
            for x, y in ((13, 8), (14, 9), (12, 9), (13, 10)):
                p[x, y] = (255, 255, 225, 255)
    elif facing in ("left", "right"):
        xx = int(cx) - 1 if facing == "right" else int(cx) + 1
        for y in range(5, 10):
            if p[xx, y][3] and p[xx, y] != OUTLINE:
                p[xx, y] = (255, 255, 255, 255) if lit else (140, 170, 210, 255)
    else:
        # 뒷판 — 위 테두리 너머로 유리 가장자리가 한 줄 보인다(뒤에서 본 거울).
        for x in range(8, 16):
            p[x, 1] = (232, 244, 255, 255) if lit else (110, 140, 186, 255)
        for x in range(10, 14):
            p[x, 0] = (255, 255, 255, 255) if lit else (150, 176, 214, 255)
        p[11, 10] = brass_l
        p[12, 11] = OUTLINE
    if lit:
        glow = Image.new("RGBA", (24, 32), T)
        gp = glow.load()
        for y in range(0, 22):
            for x in range(24):
                if p[x, y][3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < 24 and 0 <= ny < 22 and p[nx, ny] == OUTLINE:
                        gp[x, y] = (255, 236, 160, 150)
                        break
        im = Image.alpha_composite(glow, im)
    return im


def main():
    sheet = Image.new("RGBA", (288, 256), T)
    for ci, lit in enumerate([False, True]):
        bx, by = (ci % 4) * 72, (ci // 4) * 128
        for row, facing in enumerate(DIR_ROWS):
            frame = mirror_frame(lit, facing)
            for pat in range(3):
                sheet.alpha_composite(frame, (bx + pat * 24, by + row * 32))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
