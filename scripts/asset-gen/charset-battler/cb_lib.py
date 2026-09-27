# 걷기 캐릭터셋(EasyRPG Actor1~4) → 도트 전투 시트 공용 도구.
#
# 계약(모든 그림 에이전트·런타임이 같은 표를 본다 — 런타임 정본은 src/battle/battlePose.ts):
#   시트 144×384 = 48px 셀 3열×8행. 원본 1:1 도트(확대 없음). 캐릭터는 왼쪽을 본다(아군은 오른쪽에 선다).
#   발 기준선 GROUND_Y=44(마지막 불투명 행), 몸 중심 x=24. 알파는 0/255 만.
#   포즈 원본은 tiledata/charset-battlers/<id>/<pose>.png (48×48, 이미 제자리에 놓인 셀). 빌드가 시트로 모은다.
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
CHARSET_DIR = os.path.join(ROOT, "public/assets/easyrpg/charset")
SRC_DIR = os.path.join(ROOT, "tiledata/charset-battlers")
OUT_DIR = os.path.join(ROOT, "public/assets/generated/charset-battlers")
CELL = 48
GROUND_Y = 44
CENTER_X = 24
FW, FH = 24, 32
DIRS = ["up", "right", "down", "left"]

# (id, col, row, 한 줄 설명). 앞 여섯은 기존 POSE_FRAME 과 같은 자리다(하위 호환).
POSES = [
    ("idle", 0, 0, "전투 대기. 왼쪽을 보고 무기를 든 채 선다"),
    ("attack", 1, 0, "공격 착탄 순간. 무기를 앞(왼쪽)으로 끝까지 휘두름/찌름"),
    ("hit", 2, 0, "피격. 뒤(오른쪽)로 젖혀 비틀, 눈 질끈"),
    ("defend", 0, 1, "방어. 낮게 웅크리고 방패/무기/팔로 앞을 막음"),
    ("dead", 1, 1, "전투 불능. 바닥에 누움(머리는 오른쪽), 발 기준선에 붙음"),
    ("victory", 2, 1, "승리. 무기를 번쩍 치켜듦"),
    ("walk_a", 0, 2, "걷기 1(걷기 칩 왼쪽 방향 패턴 0 기반)"),
    ("walk_b", 1, 2, "걷기 2(패턴 1 = 서 있는 발)"),
    ("walk_c", 2, 2, "걷기 3(패턴 2)"),
    ("attack_windup", 0, 3, "공격 예비동작. 무기를 뒤로 크게 젖힘"),
    ("attack_strike", 1, 3, "공격 휘두름 중간(궤적 한가운데)"),
    ("attack_follow", 2, 3, "공격 마무리. 휘두른 뒤 무기가 아래·앞에 남음"),
    ("cast_charge", 0, 4, "마법 준비. 두 손을 모아 가슴 앞에서 힘을 모음"),
    ("cast_raise", 1, 4, "마법 영창. 두 팔/지팡이를 머리 위로"),
    ("cast_release", 2, 4, "마법 방출. 팔/지팡이를 앞으로 뻗음"),
    ("item", 0, 5, "아이템 사용. 한 손으로 병/물건을 들어 올림"),
    ("weak", 1, 5, "빈사(HP 낮음). 한쪽 무릎을 꿇고 숨참"),
    ("evade", 2, 5, "회피. 뒤로 몸을 빼며 피함"),
    ("guard_hit", 0, 6, "방어 중 피격. 방어 자세로 밀림"),
    ("skill", 1, 6, "필살기/특기 결정 자세"),
    ("victory_b", 2, 6, "승리 2번째 칸(승리와 번갈아 환호 루프)"),
    ("dying", 0, 7, "쓰러지는 중(무릎이 꺾이며 넘어짐)"),
    ("revive", 1, 7, "부활·일어섬(한쪽 무릎에서 일어나는 중)"),
    ("front", 2, 7, "정면(걷기 칩 아래 방향 패턴 1). 메뉴·연출용"),
]
POSE_BY_ID = {p[0]: p for p in POSES}
SHEETS = {"actor1": "Actor1.png", "actor2": "Actor2.png", "actor3": "Actor3.png", "actor4": "Actor4.png"}
ALL_IDS = [f"{s}-{i}" for s in SHEETS for i in range(8)]


def load_sheet(sheet):
    im = Image.open(os.path.join(CHARSET_DIR, SHEETS[sheet])).convert("RGBA")
    key = im.getpixel((0, 0))[:3]
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][:3] == key:
                px[x, y] = (0, 0, 0, 0)
    return im


def walk_frame(char_id, direction, pattern):
    """걷기 칩 한 칸(24×32, 배경 투명)."""
    sheet, idx = char_id.split("-")
    idx = int(idx)
    im = load_sheet(sheet)
    cx = (idx % 4) * 72 + pattern * FW
    cy = (idx // 4) * 128 + DIRS.index(direction) * FH
    return im.crop((cx, cy, cx + FW, cy + FH))


def palette(char_id):
    """그 캐릭터 걷기 칩 12칸에 실제로 쓰인 색(불투명)."""
    colors = set()
    for d in DIRS:
        for p in range(3):
            f = walk_frame(char_id, d, p)
            for c in f.getdata():
                if c[3] == 255:
                    colors.add(c[:3])
    return sorted(colors)


def blank():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def place(sprite, dx=0, dy=0):
    """스프라이트를 셀에 놓는다: 불투명 영역 바닥을 GROUND_Y, 가로 중심을 CENTER_X 에 맞추고 dx/dy 만큼 민다."""
    cell = blank()
    bbox = sprite.getbbox()
    if not bbox:
        return cell
    x0, y0, x1, y1 = bbox
    ox = CENTER_X - (x0 + x1) // 2 + dx
    oy = GROUND_Y + 1 - y1 + dy
    cell.alpha_composite(sprite, (ox, oy))
    return cell


def binarize(im):
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return im


def validate(char_id, pose_id, im):
    """문제 목록(빈 목록 = 통과). 색 검사는 경고만: 무기·빛 색 추가는 허용한다."""
    issues = []
    if im.size != (CELL, CELL):
        issues.append(f"크기 {im.size} != 48x48")
        return issues
    alphas = {c[3] for c in im.getdata()}
    if not alphas <= {0, 255}:
        issues.append("반투명 픽셀 있음(알파는 0/255)")
    bbox = im.getbbox()
    if not bbox:
        issues.append("빈 칸")
        return issues
    if bbox[3] - 1 > GROUND_Y + 1:
        issues.append(f"발이 기준선 아래로 내려감(마지막 행 {bbox[3]-1} > {GROUND_Y + 1})")
    if pose_id not in ("victory", "victory_b", "cast_raise", "evade") and bbox[3] - 1 < GROUND_Y - 1:
        issues.append(f"발이 떠 있음(마지막 행 {bbox[3]-1} < {GROUND_Y - 1})")
    return issues


def pose_path(char_id, pose_id):
    return os.path.join(SRC_DIR, char_id, f"{pose_id}.png")


def build_sheet(char_id):
    sheet = Image.new("RGBA", (CELL * 3, CELL * 8), (0, 0, 0, 0))
    report = {}
    for pid, col, row, _ in POSES:
        path = pose_path(char_id, pid)
        if not os.path.exists(path):
            report[pid] = ["없음"]
            continue
        im = binarize(Image.open(path))
        report[pid] = validate(char_id, pid, im)
        sheet.alpha_composite(im, (col * CELL, row * CELL))
    return sheet, report


def board(char_id, sheet, scale=4):
    """사람(과 에이전트)이 보는 확인판: 칸마다 이름표, 체크 무늬 배경, 발 기준선."""
    cw = CELL * scale
    lab = 14
    W, H = cw * 3, (cw + lab) * 8
    out = Image.new("RGB", (W, H), (32, 34, 44))
    dr = ImageDraw.Draw(out)
    for pid, col, row, _ in POSES:
        x, y = col * cw, row * (cw + lab)
        for ty in range(0, cw, 8 * scale // 2):
            for tx in range(0, cw, 8 * scale // 2):
                c = (58, 62, 78) if ((tx + ty) // (4 * scale)) % 2 == 0 else (46, 50, 64)
                dr.rectangle([x + tx, y + lab + ty, x + tx + 4 * scale - 1, y + lab + ty + 4 * scale - 1], fill=c)
        cell = sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL)).resize((cw, cw), Image.NEAREST)
        out.paste(cell, (x, y + lab), cell)
        dr.line([x, y + lab + (GROUND_Y + 1) * scale, x + cw, y + lab + (GROUND_Y + 1) * scale], fill=(200, 80, 80))
        dr.text((x + 3, y + 1), pid, fill=(230, 230, 240))
    return out

