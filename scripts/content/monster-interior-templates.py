"""몬스터 원정 실내 방 템플릿을 칸 이름으로 짜서 mapTemplates.json 에 넣는다(2층·집 변주).

방 문법(기존 room-house/center/mart 와 같다):
- 맨 위 두 줄은 뒷벽(i2_wall_<방>_up/dn, 양 끝 _l/_r), 그 밑 한 줄은 벽 그늘 바닥(i2_fl_<방>_s), 그 아래는 바닥 두 톤 체크.
- 양옆은 i2_edge_r(왼쪽 끝)·i2_edge_l(오른쪽 끝), 맨 아래 줄은 i2_edge_t(모서리 rt·lt). 1층 출구는 맨 아래 가운데 i2_mat_<방> + i2_edge_mat.
- 가구는 위층(upper). 깔개·매트·문양은 아래층(lower). 계단(h_stairs·h_stairs_dn·c_escalator*)은 벽 두 줄은 아래층, 발치 한 줄은 위층.
- 층계 발치가 층 이동 칸이다. 2층의 내려가는 계단은 1층 올라가는 계단과 같은 자리에 둔다(걸어 올라간 자리에서 내려온다).

사용: python3 scripts/content/monster-interior-templates.py <tiles.json> [--bake <run>/bake]
  tiles.json = 하네스 그림 실행의 칸 표(qa-runs/harnesses/tileset-authoring/monster-overworld/<run>/tiles.json). 기존 칸 번호는 그대로이고 새 칸만 더해진다.
  --bake 를 주면 새 방을 verify-<방>.json 으로도 써서 wire 가 참고문서 견본(그림+전체 배열)으로 싣는다 — 조수가 2층·계단 짜는 법을 본다."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = ROOT / "src/project/examples/monsterExpedition/mapTemplates.json"

ids: dict[str, int] = json.loads(Path(sys.argv[1]).read_text())["ids"]


class Room:
    def __init__(self, kind: str, w: int, h: int, exit_x: int | None):
        self.kind, self.w, self.h = kind, w, h
        self.lower = [-1] * (w * h)
        self.upper = [-1] * (w * h)
        k = kind
        for y in range(h):
            for x in range(w):
                if y == h - 1:
                    n = "i2_edge_rt" if x == 0 else "i2_edge_lt" if x == w - 1 else "i2_edge_mat" if x == exit_x else "i2_edge_t"
                elif x == 0:
                    n = "i2_edge_r"
                elif x == w - 1:
                    n = "i2_edge_l"
                elif y < 2:
                    part = "up" if y == 0 else "dn"
                    n = f"i2_wall_{k}_{part}" + ("_l" if x == 1 else "_r" if x == w - 2 else "")
                elif y == 2:
                    n = f"i2_fl_{k}_s"
                elif y == h - 2 and x == exit_x:
                    n = f"i2_mat_{k}"
                else:
                    n = f"i2_fl_{k}{(x + y) % 2}"
                self.set(x, y, n, "lower")

    def set(self, x: int, y: int, name: str, layer: str):
        if name not in ids:
            raise SystemExit(f"없는 칸 이름 {name}")
        (self.lower if layer == "lower" else self.upper)[y * self.w + x] = ids[name]

    def put(self, name: str, x: int, y: int, layer: str | None = None):
        """여러 칸 물체 name.<dx>.<dy> 를 (x, y) 에 놓는다. 계단은 벽 두 줄 아래층 · 발치 위층."""
        cells = [(int(a), int(b)) for k in ids if k.startswith(name + ".") and k.count(".") == 2
                 for a, b in [k[len(name) + 1:].split(".")]]
        if not cells:
            raise SystemExit(f"없는 물체 {name}")
        h = 1 + max(b for _, b in cells)
        stairs = name.startswith(("h_stairs", "c_escalator"))
        for dx, dy in cells:
            lay = layer or ("lower" if name.startswith(("h_rug", "c_emblem")) or (stairs and dy < h - 1) else "upper")
            self.set(x + dx, y + dy, f"{name}.{dx}.{dy}", lay)
        return self

    def dump(self, base: dict) -> dict:
        return {"width": self.w, "height": self.h, "lower": self.lower, "upper": self.upper,
                "tilesetId": base["tilesetId"], "run": base["run"], "names": base["names"], "buildings": []}


def house_b() -> Room:
    """거실 집: 창 밑 소파, 책장 둘, 스탠드, 깔개 위 낮은 탁자와 1인 소파."""
    r = Room("house", 13, 9, 6)
    r.put("h_window", 2, 0).put("h_sofa", 2, 2).put("h_lamp", 4, 1)
    r.put("h_shelf", 5, 1).put("h_shelf", 6, 1).put("h_clock", 7, 0).put("h_bin", 8, 2)
    r.put("h_stairs", 10, 1).put("h_mat", 10, 4)
    r.put("h_rug", 2, 3)
    r.put("c_table", 4, 4).put("c_sofa_y", 3, 4).put("c_sofa_y", 3, 5).put("c_sofa_b", 6, 4).put("c_sofa_b", 6, 5)
    r.put("plant2", 1, 5).put("plant2", 11, 5)
    return r


def house_c() -> Room:
    """서재 집: 책장 셋, 창, 컴퓨터 책상, 깔개 위 식탁과 의자, 화분."""
    r = Room("house", 13, 9, 6)
    r.put("h_shelf", 1, 1).put("h_shelf", 2, 1).put("h_shelf", 3, 1)
    r.put("h_window", 5, 0).put("h_desk", 7, 1).put("h_clock", 9, 0)
    r.put("h_stairs", 10, 1).put("h_mat", 10, 4)
    r.put("h_rug", 2, 3)
    r.put("h_table", 4, 4).put("h_chair_r", 3, 4).put("h_chair_r", 3, 5).put("h_chair_l", 6, 4).put("h_chair_l", 6, 5)
    r.put("h_lamp", 8, 5).put("plant2", 1, 6).put("plant2", 11, 6)
    return r


def house_2f() -> Room:
    """2층 침실: 침대·옷장·책상, 창과 포스터, TV 와 게임기, 깔개. 내려가는 계단은 1층 계단과 같은 자리."""
    r = Room("house", 13, 9, None)
    r.put("h_bed", 1, 2).put("h_wardrobe", 3, 1).put("h_desk", 4, 1)
    r.put("h_window", 6, 0).put("h_poster", 8, 0).put("h_tv", 8, 1).put("h_console", 8, 3)
    r.put("h_stairs_dn", 10, 1)
    r.put("h_rug", 2, 4)
    r.put("plant2", 1, 6).put("plant2", 11, 6)
    return r


def house_2f_b() -> Room:
    """2층 아이 방: 침대 둘, 책장, 포스터 둘, 스탠드, 깔개."""
    r = Room("house", 13, 9, None)
    r.put("h_bed", 1, 2).put("h_bed", 4, 2).put("h_poster", 3, 0).put("h_poster", 6, 0)
    r.put("h_shelf", 7, 1).put("h_lamp", 8, 1)
    r.put("h_stairs_dn", 10, 1)
    r.put("h_rug", 2, 4)
    r.put("h_console", 9, 5).put("plant2", 1, 6).put("plant2", 11, 6)
    return r


def center_2f() -> Room:
    """센터 2층 교류 라운지: 내려가는 계단은 1층 에스컬레이터와 같은 자리(왼쪽 위), 화면·컴퓨터, 소파 두 묶음, 화분."""
    r = Room("center", 15, 9, None)
    r.put("c_escalator_dn", 1, 1)
    r.put("c_screen", 6, 0).put("c_pc", 11, 1).put("plant2", 13, 2)
    r.put("c_table", 4, 4).put("c_sofa_y", 3, 4).put("c_sofa_y", 3, 5).put("c_sofa_b", 6, 4).put("c_sofa_b", 6, 5)
    r.put("c_table", 10, 4).put("c_sofa_y", 9, 4).put("c_sofa_y", 9, 5).put("c_sofa_b", 12, 4).put("c_sofa_b", 12, 5)
    r.put("plant2", 1, 5).put("plant2", 13, 5)
    return r


ROOMS = {
    "overworld/room-house-b": house_b,
    "overworld/room-house-c": house_c,
    "overworld/room-house-2f": house_2f,
    "overworld/room-house-2f-b": house_2f_b,
    "overworld/room-center-2f": center_2f,
}

T = json.loads(TEMPLATES.read_text())
base = T["overworld/room-house"]
# 새 칸 이름을 같은 시트를 쓰는 모든 템플릿의 칸 표에 더한다(기존 번호는 바뀌지 않는다).
for t in T.values():
    if t.get("tilesetId") == base["tilesetId"]:
        for n, i in ids.items():
            if t["names"].get(n, i) != i:
                raise SystemExit(f"칸 번호가 바뀌었다: {n} {t['names'][n]} → {i}")
            t["names"].setdefault(n, i)
bake = Path(sys.argv[sys.argv.index("--bake") + 1]) if "--bake" in sys.argv else None
for key, fn in ROOMS.items():
    T[key] = fn().dump(base)
    if bake:
        m = T[key]
        (bake / f"verify-{key.split('/')[1]}.json").write_text(json.dumps({k: m[k] for k in ("width", "height", "lower", "upper")}))
TEMPLATES.write_text(json.dumps(T, ensure_ascii=False, separators=(",", ":")) + "\n")
print("written", list(ROOMS))
