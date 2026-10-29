#!/usr/bin/env python3
"""버들항 던전 「동굴 기물」 꼬리 굽기(2026-10-29) — 주제 2 꼬리(33,664~33,919) 바로 뒤, 공용 버들항 시트 끝 33,920 부터 덧붙인다.

  python3 scripts/content/beodeul-dungeon/bake_cave.py import --jobs ~/.cache/og-dungeon/jobs   # object-gen 고름(pick.json)을 저장소로 옮긴다
  python3 scripts/content/beodeul-dungeon/bake_cave.py --dry                                    # 무엇을 굽는지·관문 상태만
  python3 scripts/content/beodeul-dungeon/bake_cave.py                                          # 관문 통과한 것만 번들에 굽는다
  python3 scripts/content/beodeul-dungeon/bake_cave.py --no-gate --test-out /tmp/x              # 저장소 밖 미리 보기(번들 안 건드림)

왜: 동굴 던전의 회색 원뿔 석순·민둥 돌기둥·네모 계단이 「허접하다」(2026-10-29 사용자, vm5 deepseek jrpg 동굴). 새 기물은
object-gen(정본 흐름: 참고 그림 → Opus 그리기 → 숨긴 반려 표본 블라인드 검수 → 다시 그리기 → Opus picker 고르기)으로 그렸다.
고름은 picker(by: opus-picker)가 한 것이고 감독·작업자가 고르지 않았다. 그림 정본 = `tiledata/beodeul-dungeon/cave/picks/<항목>.png`
+ `picks.json`(그림 해시·picker 표·이유·검수 표). import 는 고름 해시가 PNG 와 같을 때만 옮긴다.

3/4 관문(hard rule): 항목마다 object_gate.refusal(context="bundle") — 서명된 사람·위임 허용, 또는 보정 프로필 PASS 만 굽는다.
막힌 항목은 굽지 않고(전에 구운 정의도 뺀다) 종료코드 2. 던전 빌더(dress.ts `CK(...)`)는 hasKit 이 거짓이면 옛 조각으로 물러선다.

칸 규칙은 bake_gap.py 와 같다(덧붙이기 전용, 칸 정본 `tiledata/beodeul-dungeon/cave/cells.png` + `cells.json`).
시트 순서: … → 왕도 → 주제 2 → 동굴 기물(이것). bake_theme2.py 가 시트를 다시 쓰면 끝에서 이것을 `--from-store` 로 부른다.
"""
import argparse, json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bake_gap as G  # noqa: E402

ROOT = G.ROOT
dot = G.dot
G.BASE = 33920
G.BASE_ROW = G.BASE // G.COLS
G.STORE = ROOT / "tiledata/beodeul-dungeon/cave"
G.STORE_PNG = G.STORE / "cells.png"
G.STORE_JSON = G.STORE / "cells.json"
G.KIT_PREFIX = "bd-pick-dungeon-cave-"
G.GROUP_PREFIX = "beodeul_dungeon_cave_"
G.OWN_GROUPS = re.compile(r"^beodeul_dungeon_cave_")
G.TILEGROUP_PREFIX = "beodeul:dungeon_cave"
PICKS = G.STORE / "picks"
PICKS_JSON = G.STORE / "picks.json"
T = G.T
CAVE_FLOOR = 25270   # bd-pick-mining-valley-ground-road 가운데 칸 — 동굴 바닥(profiles.ts cave.floor). 내려가는 계단 구멍을 이 바닥 위에 얹어 아래층 칸으로 굽는다.

# 항목 → 키트. walk 는 위→아래 줄, 'x' 막힘 'o' 걸음 '★' 사람 위에 그림. layer lower = 바닥 칸으로(투명 화소는 CAVE_FLOOR).
ITEMS = {
    "stalagmite": dict(name="동굴 석순 1×2", walk=["★", "x"], gate="organic", tags=["석순", "stalagmite", "바위"],
                       desc="울퉁불퉁한 석회 석순(뭉툭한 끝·흘러내린 결). 아래 칸 막힘, 위 칸 ★.", rules="동굴 바닥 벽가·덩이에. 홀로 한가운데 두지 않는다."),
    "stalagmite-cluster": dict(name="동굴 석순 무리 2×2", walk=["★★", "xx"], gate="organic", tags=["석순", "stalagmite", "바위"],
                               desc="한 바위 둔덕에서 솟은 석순 셋. 아래 줄 막힘, 윗줄 ★.", rules="벽가 덩이·무너진 바위 더미의 큰 조각."),
    "crystal-cluster": dict(name="동굴 수정 무리 1×2", walk=["★", "x"], gate="organic", tags=["수정", "crystal"],
                            desc="빛나는 청록 수정 다발. 아래 칸 막힘, 위 칸 ★.", rules="벽가·구석에 드물게."),
    "bone-pile": dict(name="괴물 뼈 더미 2×2", walk=["xx", "xx"], gate="debris", tags=["뼈", "bones", "둥지"],
                      desc="뿔 달린 해골과 긴 뼈·갈비가 얽힌 더미. 막힘.", rules="괴물 둥지·보스 굴 제단. 벽가나 큰 바위 곁에."),
    "mushroom-patch": dict(name="빛 버섯 군락 2×1", walk=["xx"], gate="organic", tags=["버섯", "mushroom", "빛"],
                           desc="청록 빛 버섯 대여섯 개 군락. 막힘.", rules="벽가·물가에 덩이로, 서로 두 칸 띄운다."),
    "mossy-boulder": dict(name="이끼 바위 2×2", walk=["★★", "xx"], gate="organic", tags=["바위", "boulder", "이끼"],
                          desc="윗면에 이끼 덮인 둥근 동굴 바위. 아래 줄 막힘, 윗줄 ★.", rules="벽가 덩이·무너진 바위 더미."),
    "broken-pillar": dict(name="부러진 돌기둥 1×2", walk=["★", "x"], gate="column", tags=["기둥", "pillar", "폐허"],
                          desc="부러진 홈 파인 돌기둥 밑동과 받침. 아래 칸 막힘, 위 칸 ★.", rules="오래된 굴·폐허 방 벽가에."),
    "stairs-down": dict(name="동굴 내려가는 계단 2×2", walk=["xx", "ox"], gate="flat", tags=["계단", "stairs", "내려가는"], layer="lower",
                        desc="동굴 바닥에 뚫린 구멍으로 내려가는 거친 돌계단. 왼쪽 아래 칸이 이동 칸(걸음), 나머지 막힘. 바닥 칸으로 굽혔다.",
                        rules="방 안쪽 바닥(여덟 이웃이 바닥). 이동 이벤트는 왼쪽 아래 칸, 그 남쪽 칸이 도착 칸."),
    "stairs-up": dict(name="동굴 올라가는 계단 2×2", walk=["xx", "xx"], gate="wall_structure", tags=["계단", "stairs", "올라가는"],
                      desc="동굴 벽 앞면 두 줄에 얹는 돌계단과 굴 입구. 막힘(부딪쳐 들어간다).",
                      rules="북쪽 벽 앞면 2단(양옆도 같은 높이 벽)에 위층으로 얹는다. 이동 이벤트는 왼쪽 아래 칸, 바로 남쪽 바닥 칸은 비운다.", role="wall"),
}
JOB_OF = {"stairs-down": "cave-stairs-down", "stairs-up": "cave-stairs-up"}


def do_import(jobs: pathlib.Path):
    sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
    import object_gate as OG
    PICKS.mkdir(parents=True, exist_ok=True)
    rec = json.loads(PICKS_JSON.read_text()) if PICKS_JSON.exists() else {}
    for item in ITEMS:
        # 가장 늦은 판(…-r2, -r3)에 고름이 있으면 그것 — 관문(3/4·화풍) 이유를 규칙으로 넘겨 다시 그린 판이다.
        base = JOB_OF.get(item, item)
        cands = sorted([d for d in jobs.glob(f"{base}-r*") if d.name[len(base) + 2:].isdigit()], key=lambda d: int(d.name[len(base) + 2:]), reverse=True) + [jobs / base]
        jd = next((d for d in cands if (d / "pick.json").exists()), jobs / base)
        pk = jd / "pick.json"
        if not pk.exists():
            print(f"  고름 없음  {item}")
            continue
        p = json.loads(pk.read_text())
        st = json.loads((jd / "candidates" / p["letter"] / "state.json").read_text())
        png = jd / "candidates" / p["letter"] / f"attempt-{st['attempt']}.png"
        sha = OG.pixel_sha256(png)
        if sha != p["pixelSha256"]:
            print(f"  해시 다름  {item}: 고름 {p['pixelSha256'][:12]} ≠ 그림 {sha[:12]} — 옮기지 않는다")
            continue
        vqa = json.loads((jd / "vqa" / "result.json").read_text()) if (jd / "vqa" / "result.json").exists() else {}
        shutil.copy(png, PICKS / f"{item}.png")
        rec[item] = dict(job=jd.name, letter=p["letter"], attempt=st["attempt"], pixelSha256=sha, by=p.get("by"), picker=p.get("picker"),
                         majority=p.get("majority"), tally=p.get("tally"), reason=p.get("reasonLetters") or p.get("reason"), at=p.get("at"),
                         review=(vqa.get("candidates") or {}).get(p["letter"]) if isinstance(vqa.get("candidates"), dict) else None)
        print(f"  옮김  {item}: {p['letter']} ({p.get('majority')}) {sha[:12]}")
    PICKS_JSON.write_text(json.dumps(rec, ensure_ascii=False, indent=1) + "\n")


def lower_cells(st, img, walk, origin, label, desc, tags):
    """투명 화소를 동굴 바닥 칸 위에 얹어 아래층(바닥) 칸으로."""
    from PIL import Image
    sheet = Image.open(G.SHEET_PATH).convert("RGBA")
    per = sheet.width // T
    floor = sheet.crop(((CAVE_FLOOR % per) * T, (CAVE_FLOOR // per) * T, (CAVE_FLOOR % per) * T + T, (CAVE_FLOOR // per) * T + T))
    w, h = img.width // T, img.height // T
    out = []
    for y in range(h):
        row = []
        for x in range(w):
            c = floor.copy()
            c.alpha_composite(img.crop((x * T, y * T, x * T + T, y * T + T)))
            passage = {"x": "solid", "o": "passable"}[walk[y][x]]
            row.append(st.cell(c, G.cm(f"{label} ({x},{y})", desc, tags, passage, "lower"), origin))
        out.append(row)
    return out


def bake_item(st, item, img, origin):
    spec = ITEMS[item]
    w, h = img.width // T, img.height // T
    walk = [list(r) for r in spec["walk"]]
    assert len(walk) == h and all(len(r) == w for r in walk), (item, w, h, walk)
    label = f"버들항 동굴 · {spec['name']}"
    if spec.get("layer") == "lower":
        lo = lower_cells(st, img, walk, origin, label, spec["desc"], spec["tags"])
        k = G.kit(f"{G.KIT_PREFIX}{item}", label, w, h, [[-1] * w for _ in range(h)], lower=lo, desc=spec["desc"], rules=spec["rules"],
                  tags=spec["tags"], layer_home="lower")
    else:
        up = G.object_cells(st, dot.Cv.of(img), walk, origin, label, spec["desc"], spec["tags"])
        # 벽 앞면에 얹는 계단은 role wall(받침 규칙 face) — prop 이면 「벽 칸 위에 선 물건」으로 막힌다.
        k = G.kit(f"{G.KIT_PREFIX}{item}", label, w, h, up, desc=spec["desc"], rules=spec["rules"], tags=spec["tags"], role=spec.get("role", "prop"))
    k["ai"]["provenance"] = "object-gen (Opus picker), tiledata/beodeul-dungeon/cave/picks.json"
    ids = sorted({t for r in k["rows"] for t in r["upperTiles"] + r["tiles"] if t >= 0})
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_{item}", name=label, role="object", source="bundled-default", defaultLayer=spec.get("layer", "upper"),
              confidence="high", tileIds=ids, description=f"{spec['desc']} 키트 {k['id']}.", placementRules=spec["rules"])
    return [tg], [k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="bake", choices=["bake", "import"])
    ap.add_argument("--jobs", default=str(pathlib.Path.home() / ".cache/og-dungeon/jobs"))
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--no-gate", action="store_true", help="관문 확인 없이 — --test-out 과 함께만(번들에 굽지 않는다)")
    ap.add_argument("--test-out", help="저장소 밖 시험 폴더: 시트·칸 표·저장소 사본을 여기에")
    ap.add_argument("--from-store", action="store_true", help="저장소대로 시트·칸 표만 다시 쓴다(bake_theme2.py 가 부른다)")
    a = ap.parse_args()
    if a.cmd == "import":
        do_import(pathlib.Path(a.jobs).expanduser())
        return
    if a.test_out:
        out = pathlib.Path(a.test_out).resolve()
        if str(out).startswith(str(ROOT) + "/"):
            sys.exit("--test-out 은 저장소 밖이어야 한다")
        out.mkdir(parents=True, exist_ok=True)
        for src in (G.SHEET_PATH, G.TS_PATH, G.SHEET_JSON):
            shutil.copy(src, out / src.name)
        G.SHEET_PATH, G.TS_PATH, G.SHEET_JSON = out / G.SHEET_PATH.name, out / G.TS_PATH.name, out / G.SHEET_JSON.name
        if G.STORE_JSON.exists():
            shutil.copytree(G.STORE, out / "cave", dirs_exist_ok=True)
        G.STORE = out / "cave"
        G.STORE_PNG, G.STORE_JSON = G.STORE / "cells.png", G.STORE / "cells.json"
    elif a.no_gate:
        sys.exit("--no-gate 는 --test-out 과 함께만 쓴다(시험 결과를 번들에 굽지 않는다)")
    sheet_count = json.loads(G.SHEET_JSON.read_text())["count"]
    st = G.Store()
    if a.from_store:
        if st.cells:
            print(f"동굴 기물 꼬리 다시 씀: {G.BASE}..{G.write_out(st) - 1}")
        return
    if sheet_count < G.BASE:
        sys.exit(f"시트 count {sheet_count} < 동굴 꼬리 시작 {G.BASE} — 주제 2 꼬리(bake_theme2.py)부터 굽는다")
    if sheet_count > G.BASE and not st.cells:
        sys.exit(f"시트 count {sheet_count} 가 동굴 꼬리 시작 {G.BASE} 보다 크다 — 앞 꼬리가 자랐다. BASE 를 시트 끝으로 옮긴다(덧붙이기 전용)")
    rec = json.loads(PICKS_JSON.read_text()) if PICKS_JSON.exists() else {}
    from PIL import Image
    import object_gate as OG
    report, blocked = [], []
    for item in ITEMS:
        r = rec.get(item)
        png = PICKS / f"{item}.png"
        if not r or not png.exists():
            report.append(f"  없음  {item:20} — object-gen 고름이 아직 없다")
            continue
        img = Image.open(png).convert("RGBA")
        sha = OG.pixel_sha256(img)
        if sha != r["pixelSha256"]:
            report.append(f"  VOID  {item:20} — 그림이 고름 뒤에 바뀌었다")
            continue
        if a.no_gate:
            gst, why = "skipped", "관문 생략(--no-gate, 시험 폴더)"
        else:
            gst, why = G.gate_state(img, strict=True)
        if not gst:
            rc = OG.read_receipt(sha) or {}
            blocked.append(f"{item}: {why}\n    pixelSha256 {sha} · label {rc.get('label')} · kind {rc.get('kind')}")
            report.append(f"  막힘  {item:20} — {why}")
            prev = st.baked.pop(item, None)
            for kind_, ids in ((prev or {}).get("defs") or {}).items():
                for i in ids:
                    st.defs[kind_].pop(i, None)
            continue
        origin = f"cave/{item}/{r['job']}:{r['letter']}@{sha[:8]}"
        before = st.added
        tgs, kits = bake_item(st, item, img, origin)
        for g in tgs:
            st.defs["tileGroups"][g["id"]] = g
        for k in kits:
            st.defs["structureKits"][k["id"]] = k
        st.baked[item] = dict(sha256=sha, gate=gst, defs=dict(autotileGroups=[], tileGroups=[g["id"] for g in tgs], structureKits=[k["id"] for k in kits]))
        report.append(f"  굽기  {item:20} [{gst}: {why}] 새 칸 {st.added - before} · 키트 {[k['id'] for k in kits]}")
    print("\n".join(report))
    # 내려가는 계단은 동굴 바닥 칸(광산 골짜기 흙길, 시트에 이미 있는 그림) 위에 얹어 굽는다 — 그 바닥 칸의 색은 던전 팔레트 밖이어도 받는다.
    sheet = Image.open(G.SHEET_PATH).convert("RGBA"); per = sheet.width // T
    fl = sheet.crop(((CAVE_FLOOR % per) * T, (CAVE_FLOOR // per) * T, (CAVE_FLOOR % per) * T + T, (CAVE_FLOOR // per) * T + T))
    floor_cols = {tuple(px) for px in fl.getdata()}
    bad = {px for px in G.palette_problems(st) if px not in floor_cols}
    if bad:
        sys.exit(f"팔레트 밖 색 {len(bad)}개: {sorted(bad)[:6]}")
    rows = st.rows()
    print(f"칸 {len(st.cells)}개(새 {st.added}) → 꼬리 {G.BASE}..{G.BASE + rows * G.COLS - 1}")
    if a.dry:
        print("(--dry: 쓰지 않음)")
    elif st.cells:
        st.save()
        print(f"썼다 (count {G.write_out(st)}) → {G.SHEET_PATH}")
    if blocked:
        print("3/4 관문 미통과 — 굽지 않은 항목:", *blocked, sep="\n  ", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
