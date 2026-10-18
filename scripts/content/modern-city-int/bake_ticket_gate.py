# 개찰구(mci-ticket-gate) 제자리 다시 굽기 — 2026-10-18 적대적 VQA: 대칭 판독 패드 둘 + 위 검은 창 + 양옆 빨강 날개가
# 얼굴(눈·입·팔) 달린 로봇처럼 읽혔다. 같은 4 조각(사양 cells)을 낮고 넓은 스테인리스 함체로 덮어쓴다:
# 왼쪽 표 투입구 · 오른쪽 IC 판독 패드(비대칭) · 윗면 높이의 얇은 날개문 · 앞면 진행 화살표와 받침.
# 실행: python3 scripts/content/modern-city-int/bake_ticket_gate.py
import json
from PIL import Image

REPO = __file__.rsplit('/scripts/', 1)[0]
PNG = f'{REPO}/public/assets/modern-city/modern-city-chipset.png'
TS = f'{REPO}/src/assets/modernCityTileset.json'
RS = f'{REPO}/src/assets/modernCityRoomSpec.json'

INK = (26, 28, 38, 255)
TOP_HI = (236, 240, 246, 255)
TOP = (204, 210, 220, 255)
TOP_LO = (176, 183, 196, 255)
FACE = (138, 146, 160, 255)
FACE_LO = (104, 111, 126, 255)
PLINTH = (64, 68, 82, 255)
SLOT = (40, 44, 58, 255)
PAD = (56, 196, 232, 255)
PAD_HI = (176, 236, 250, 255)
FLAP = (214, 58, 66, 255)
FLAP_HI = (246, 132, 136, 255)
ARROW = (92, 196, 96, 255)


def draw():
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    p = im.load()

    def rect(x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                p[xx, yy] = c

    # 날개문: 윗면 높이에서 통로 쪽으로 얇게(함체보다 먼저 - 함체 테두리가 덮는다).
    for x0 in (0, 27):
        rect(x0, 11, 5, 4, INK)
        rect(x0 + (0 if x0 == 0 else 1), 12, 4, 2, FLAP)
        rect(x0 + (0 if x0 == 0 else 1), 12, 4, 1, FLAP_HI)
    # 함체 테두리와 윗면(깊은 윗면 - 위에서 내려다본 낮은 상자).
    rect(4, 5, 24, 25, INK)
    rect(5, 6, 22, 14, TOP)
    rect(5, 6, 22, 1, TOP_HI)
    rect(5, 18, 22, 2, TOP_LO)
    # 왼쪽 표 투입구(가는 홈)와 그 뒤 표 나오는 홈.
    rect(7, 9, 9, 2, SLOT)
    rect(7, 11, 9, 1, TOP_HI)
    rect(7, 14, 6, 1, SLOT)
    # 오른쪽 IC 판독 패드(한쪽에만 - 대칭 '눈'이 되지 않게).
    rect(19, 9, 6, 6, INK)
    rect(20, 10, 4, 4, PAD)
    rect(20, 10, 2, 1, PAD_HI)
    # 앞면과 받침.
    rect(5, 20, 22, 7, FACE)
    rect(5, 20, 22, 1, FACE_LO)
    rect(5, 27, 22, 2, PLINTH)
    # 앞면 진행 화살표(초록, 오른쪽 아래 작은 표시).
    for i, (dx, w) in enumerate(((0, 1), (0, 2), (0, 3), (0, 2), (0, 1))):
        rect(21 + dx, 21 + i, w, 1, ARROW)
    rect(18, 23, 3, 1, ARROW)
    return im


def main():
    ts = json.load(open(TS)); rs = json.load(open(RS))
    cols = ts['tilesPerRow']
    cells = rs['objects']['mci-ticket-gate']['cells']
    sheet = Image.open(PNG).convert('RGBA')
    art = draw()
    for cx, cy, t, _ in cells:
        tile = art.crop((cx * 16, (cy + 1) * 16, cx * 16 + 16, (cy + 1) * 16 + 16))
        x, y = (t % cols) * 16, (t // cols) * 16
        sheet.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (x, y))
        sheet.paste(tile, (x, y))
    sheet.save(PNG, optimize=True)
    desc = '낮고 넓은 스테인리스 함체 - 윗면 왼쪽 표 투입구·오른쪽 IC 판독 패드, 통로 쪽으로 얇은 빨강 날개문, 앞면 초록 진행 화살표.'
    rs['objects']['mci-ticket-gate']['desc'] = desc
    for _, _, t, _ in cells:
        ts['tileMeta'][t]['description'] = desc
    dump = lambda o, ea=False: json.dumps(o, ensure_ascii=ea, separators=(',', ':'))
    open(TS, 'w').write(dump(ts) + '\n'); open(RS, 'w').write(dump(rs, True) + '\n')
    print('rebaked mci-ticket-gate', [c[2] for c in cells])


if __name__ == '__main__':
    main()
