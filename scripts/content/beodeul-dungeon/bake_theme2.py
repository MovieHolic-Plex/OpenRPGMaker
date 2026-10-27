#!/usr/bin/env python3
"""버들항 던전 「주제 2」 꼬리 굽기(2026-10-27) — 왕도 아스텔 꼬리(33,408~33,663) 바로 뒤, 공용 버들항 시트 끝 33,664 부터 덧붙인다.

  python3 scripts/content/beodeul-dungeon/bake_theme2.py --dry      # 무엇을 굽는지·관문 상태만
  python3 scripts/content/beodeul-dungeon/bake_theme2.py            # ledger 의 현재 고름 중 THEME2_ITEMS 만 굽는다

왜 따로: 주제 꼬리(bake_theme.py, 30,848~33,151)는 뒤에 마당 꼬리(33,152~)가 붙어 있어 더 자랄 수 없다. 이미 출하된 칸 번호를
옮기면(마당 BASE 이동) 저장된 맵이 깨진다 — 그래서 큰 조각(마계 판석 밭 224×160)은 시트 맨 끝에 새 꼬리로 덧붙인다(덧붙이기 전용).

bake_gap.py 의 칸 저장소·관문·칸 표 쓰기를 그대로 쓰고 상수만 바꾼다(bake_theme.py 와 같은 방식):
  - 칸 그림 정본 `tiledata/beodeul-dungeon/theme2/cells.png` + `cells.json`(덧붙이기 전용, 키 = 화소 해시 + 통행 + 층).
  - 키트 id = `bd-pick-dungeon-theme2-<이름>`, 칸 묶음 `beodeul:dungeon_theme2*`. 오토타일은 없다.
  - 3/4 관문(hard rule): object_gate.refusal(context="bundle") — 서명된 허용(위임 포함) 또는 보정 프로필 PASS 만 굽는다.

시트 순서: 성벽 → gap → 주제 → 마당 → 왕도 → 주제 2(이것). 앞 꼬리 스크립트는 시트를 자기 끝에서 자르므로 bake_capital.py 가 끝에서 이것을 부른다.
왕도 꼬리가 33,664 를 넘게 자라면 이 스크립트가 멈춘다(덧붙이기 전용 — 새 BASE 를 시트 끝으로 정한다).
"""
import argparse, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bake_gap as G  # noqa: E402
import bake_theme as B  # noqa: E402  주제 손(bake_field_floor)·themes_of 를 빌린다 — import 만으로 G 상수가 주제 꼬리로 바뀌므로 아래에서 다시 덮는다

ROOT = G.ROOT
dot = G.dot
G.BASE = 33664
G.BASE_ROW = G.BASE // G.COLS
G.STORE = ROOT / "tiledata/beodeul-dungeon/theme2"
G.STORE_PNG = G.STORE / "cells.png"
G.STORE_JSON = G.STORE / "cells.json"
G.KIT_PREFIX = "bd-pick-dungeon-theme2-"
G.GROUP_PREFIX = "beodeul_dungeon_theme2_"
G.OWN_GROUPS = re.compile(r"^beodeul_dungeon_theme2_")
G.TILEGROUP_PREFIX = "beodeul:dungeon_theme2"
B.KP = G.KIT_PREFIX
THEME2_ITEMS = {"other.ground"}
HANDLERS = {"other.ground": B.bake_field_floor("otherworld-floor", "마계 검은 돌 바닥", "마계의 갈라진 보라 검은 돌 바닥")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--from-store", action="store_true")
    a = ap.parse_args()
    cap = (ROOT / "scripts/content/beodeul-capital/bake_capital.py").read_text()
    if not re.search(r"^BASE = 33408", cap, re.M):
        sys.exit("왕도 꼬리 BASE 가 바뀌었다 — 주제 2 꼬리 시작을 다시 정한다")
    sheet_count = json.loads(G.SHEET_JSON.read_text())["count"]
    st = G.Store()
    if a.from_store:
        if st.cells:
            print(f"주제 2 꼬리 다시 씀: {G.BASE}..{G.write_out(st) - 1}")
        return
    if sheet_count < G.BASE:
        sys.exit(f"시트 count {sheet_count} < 주제 2 시작 {G.BASE} — 왕도 꼬리(bake_capital.py)부터 굽는다")
    report, blocked = [], []
    for p, line in B.current_picks()[0]:
        if p["item"] not in THEME2_ITEMS:
            continue
        m, cv, meta = G.render(p)
        im = cv.img()
        gst, why = G.gate_state(im, strict=True)
        if not gst:
            import object_gate as OG
            blocked.append(f"{p['item']} {p['letter']}: {why}\n    pixelSha256 {OG.pixel_sha256(im)}")
            report.append(f"  막힘  {p['item']:24} {p['round']} {p['letter']} — {why}")
            prev = st.baked.pop(f"{p['item']}|{line}", None)
            for kind_, ids in ((prev or {}).get("defs") or {}).items():
                for i in ids:
                    st.defs[kind_].pop(i, None)
            continue
        if not meta.get("fieldCols"):
            report.append(f"  건너뜀 {p['item']:24} {p['round']} {p['letter']} — 판석 밭(fieldCols)이 아니다: 주제 꼬리(bake_theme.py)에서 굽는다")
            continue
        origin = f"{p['item']}/{line}/{p['round']}:{p['letter']}@{dot.image_hash(im)[:8]}"
        before = st.added
        prev = st.baked.get(f"{p['item']}|{line}")
        for kind_, ids in ((prev or {}).get("defs") or {}).items():
            for i in ids:
                st.defs[kind_].pop(i, None)
        groups, tgs, kits = HANDLERS[p["item"]](st, p, line, meta, origin)
        for g in tgs:
            st.defs["tileGroups"][g["id"]] = g
        for k in kits:
            st.defs["structureKits"][k["id"]] = k
        st.baked[f"{p['item']}|{line}"] = dict(round=p["round"], letter=p["letter"], sha256=dot.image_hash(im), gate=gst,
                                               defs=dict(autotileGroups=[], tileGroups=[g["id"] for g in tgs], structureKits=[k["id"] for k in kits]))
        report.append(f"  굽기  {p['item']:24} {p['round']} {p['letter']} [{gst}] 새 칸 {st.added - before} · 키트 {[k['id'][len(G.KIT_PREFIX):] for k in kits]}")
    print("\n".join(report))
    bad = G.palette_problems(st)
    if bad:
        sys.exit(f"팔레트 밖 색 {len(bad)}개: {sorted(bad)[:6]}")
    rows = st.rows()
    print(f"칸 {len(st.cells)}개(새 {st.added}) → 꼬리 {G.BASE}..{G.BASE + rows * G.COLS - 1}")
    if a.dry:
        print("(--dry: 쓰지 않음)")
    else:
        st.save()
        print(f"썼다 (count {G.write_out(st)})")
    if blocked:
        print("3/4 관문 미통과 — 굽지 않은 항목:", *blocked, sep="\n  ", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
