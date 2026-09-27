# 걷기 칩만으로 만드는 **기준선** 포즈 24칸. 그림 에이전트가 포즈를 손으로 다시 찍기 전의 출발점이다.
# 이미 있는 포즈 파일은 덮지 않는다(--force 로 덮음). 사용: python3 baseline.py [actor1-0 ...] [--force]
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cb_lib import ALL_IDS, POSES, SRC_DIR, blank, place, pose_path, walk_frame


def crouch(sprite, rows):
    """다리 구간(아래 35%)에서 rows 줄을 고르게 빼 키를 낮춘다(무릎을 굽힌 효과)."""
    bbox = sprite.getbbox()
    if not bbox or rows <= 0:
        return sprite
    x0, y0, x1, y1 = bbox
    h = y1 - y0
    legs_top = y0 + int(h * 0.65)
    leg_rows = list(range(legs_top, y1))
    step = max(1, len(leg_rows) // (rows + 1))
    drop = set(leg_rows[step::step][:rows])
    out = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    ny = y1 - 1
    for y in range(y1 - 1, -1, -1):
        if y in drop:
            continue
        out.paste(sprite.crop((0, y, sprite.width, y + 1)), (0, ny))
        ny -= 1
    return out


def lean(sprite, amount):
    """위로 갈수록 amount 만큼 가로로 민다(+ 는 오른쪽 = 뒤로 젖힘)."""
    bbox = sprite.getbbox()
    if not bbox or amount == 0:
        return sprite
    x0, y0, x1, y1 = bbox
    out = Image.new("RGBA", (sprite.width + 8, sprite.height), (0, 0, 0, 0))
    for y in range(sprite.height):
        t = (y1 - 1 - y) / max(1, (y1 - y0))
        shift = round(amount * max(0.0, t))
        out.paste(sprite.crop((0, y, sprite.width, y + 1)), (4 + shift, y))
    return out


def lying(sprite):
    """정면 칩을 눕힌다(머리 오른쪽)."""
    return sprite.rotate(-90, expand=True)


def make(char_id):
    L = [walk_frame(char_id, "left", p) for p in range(3)]
    D = [walk_frame(char_id, "down", p) for p in range(3)]
    return {
        "idle": place(L[1]),
        "attack": place(lean(L[2], -2), dx=-3),
        "hit": place(lean(L[1], 2), dx=3),
        "defend": place(crouch(L[1], 3), dx=1),
        "dead": place(lying(D[1])),
        "victory": place(D[1], dy=-1),
        "walk_a": place(L[0]),
        "walk_b": place(L[1]),
        "walk_c": place(L[2]),
        "attack_windup": place(lean(L[0], 2), dx=2),
        "attack_strike": place(lean(L[2], -1), dx=-2),
        "attack_follow": place(L[1], dx=-2),
        "cast_charge": place(L[1], dx=1),
        "cast_raise": place(D[1], dy=-2),
        "cast_release": place(lean(L[2], -1), dx=-2),
        "item": place(L[1], dx=-1),
        "weak": place(crouch(lean(L[1], -1), 5)),
        "evade": place(lean(L[1], 3), dx=6),
        "guard_hit": place(crouch(L[1], 3), dx=3),
        "skill": place(lean(L[2], -2), dx=-4),
        "victory_b": place(D[1], dy=-3),
        "dying": place(crouch(lean(L[1], 3), 4), dx=2),
        "revive": place(crouch(L[1], 3)),
        "front": place(D[1]),
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    ids = args or ALL_IDS
    for cid in ids:
        os.makedirs(os.path.join(SRC_DIR, cid), exist_ok=True)
        poses = make(cid)
        written = 0
        for pid, *_ in POSES:
            path = pose_path(cid, pid)
            if os.path.exists(path) and not force:
                continue
            poses[pid].save(path)
            written += 1
        print(f"{cid}: 기준선 {written}칸 기록")


if __name__ == "__main__":
    main()

