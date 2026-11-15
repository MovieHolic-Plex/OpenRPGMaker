# 전투 시트의 무기만 다른 계열로 다시 찍은 파생 포즈를 만든다(몸 층은 손 도트 원본 그대로, 생성 그림 없음).
#
# 왜: 전투 시트는 인물마다 무기가 하나로 그려져 있다. 창을 들려도 전투의 카엘(actor1-0)은 검을 들고 서 있었다(2026-11-14 폴른 스타 QA).
#     엔진은 장비한 무기 계열로 시트를 고른다(ActorRecord.weaponBattleSheets) — 그 계열의 시트가 있어야 한다.
# 방법: repaint_weapons.py 의 무기 찍기를 그대로 쓴다 — 손 도트 몸 층을 다시 그려 옛 무기를 걷어 내고(같은 색 옷 화소는 건드리지 않는다),
#       손바닥 화소를 기준으로 weapons.py 의 손 도트 무기 격자를 찍는다. 회전·보간·생성은 없다.
#       원본 인물 폴더(tiledata/charset-battlers/<원본>)와 .omo/weapons 증거 폴더는 쓰지 않는다 — 임시 폴더에서 찍고 결과만 새 폴더로 옮긴다.
# 창(spear)의 공격 각도: 검은 올려 베지만 창은 찌른다 — 내려치기·공격·뒷동작·기술을 수평(0°)으로 찌르고,
#       준비 자세는 창끝을 비스듬히 아래로(315°) 겨눈다(수평이면 창대가 얼굴을 가로지른다). 쓰러지는 자세는 검처럼 눕힌다(0°).
# 사용: python3 derive_weapon.py actor1-0 spear actor1-0-spear
#       → tiledata/charset-battlers/actor1-0-spear/*.png + provenance.json (그다음 build.py·build_cast.py actor1-0-spear)
import json, os, shutil, sys, tempfile
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True
import cb_lib  # noqa: E402

# 계열마다 검과 다르게 잡는 자세 각도(없는 자세는 weapons.POSE_ANGLES 그대로). 왼쪽을 보는 인물 기준 0=왼쪽, 90=위, 315=왼쪽 아래.
KIND_ANGLES = {
    "spear": {"attack_windup": 315, "attack_strike": 0, "attack": 0, "attack_follow": 0, "skill": 0, "dying": 0},
}


def derive(source, kind, out_id, angles=None):
    real_src = Path(cb_lib.SRC_DIR)
    if not (real_src / source).is_dir():
        raise SystemExit(f"원본 포즈 폴더가 없다: {real_src / source}")
    if out_id == source:
        raise SystemExit("원본과 같은 id 로는 만들지 않는다")
    overrides = dict(KIND_ANGLES.get(kind, {}) if angles is None else angles)
    with tempfile.TemporaryDirectory(prefix="derive-weapon-") as tmp:
        tmp = Path(tmp)
        shutil.copytree(real_src / source, tmp / "src" / source)
        import repaint_weapons as rw
        rw.SRC_DIR = str(tmp / "src")
        rw.EVIDENCE = tmp / "evidence"
        group, index = source.split("-")[:2]
        kinds = list(rw.KINDS[group]); kinds[int(index)] = kind
        rw.KINDS = {**rw.KINDS, group: tuple(kinds)}
        base_angle = rw.angle_for
        rw.angle_for = lambda k, pid: overrides[pid] if k == kind and pid in overrides else base_angle(k, pid)
        report = rw.repaint(source)
        if not report["poses"]:
            raise SystemExit(f"{source} 는 repaint_weapons 가 무기를 찍지 않는 인물이다({report['kind']})")
        out = real_src / out_id
        out.mkdir(parents=True, exist_ok=True)
        for png in sorted((tmp / "src" / source).glob("*.png")):
            if png.name.startswith("_"):
                continue  # 확인판(_board·_cast_board)은 build.py·build_cast.py 가 새로 만든다
            shutil.copyfile(png, out / png.name)
    provenance = {
        "source": source,
        "script": "scripts/asset-gen/charset-battler/derive_weapon.py",
        "weapon": kind,
        "angles": overrides,
        "poses": {f"{pid}.png": [{"angle": p["angle"], "grip": list(p["grip"]), "repairedHand": p["repaired_hand"]} for p in placed]
                  for pid, placed in sorted(report["poses"].items())},
    }
    (real_src / out_id / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=1) + "\n")
    return provenance


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("사용: derive_weapon.py <원본 id> <무기 계열> <새 id>")
    made = derive(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f"{sys.argv[3]}: {len(made['poses'])}포즈, 무기 {made['weapon']}, 각도 {made['angles']}")
