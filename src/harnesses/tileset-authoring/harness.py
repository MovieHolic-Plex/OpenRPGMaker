#!/usr/bin/env python3
"""타일셋 구현 하네스 실행기.

  python3 src/harnesses/tileset-authoring/harness.py <단계> [--theme pokemon-overworld] [옵션]
  npm run harness -- tileset-authoring <단계> ...

단계: status · spec · draw · check  (pick · bake · wire · verify 는 사용자가 후보를 고른 뒤 — 아직 구현 전)
후보는 qa-runs/harnesses/tileset-authoring/<테마>/<run>/ 에만 쓴다(커밋 안 함).
"""
from __future__ import annotations

import argparse
import importlib
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE / "lib"))
sys.path.insert(0, str(HERE / "recipes"))
import px  # noqa: E402
import study as st  # noqa: E402
import gates as gt  # noqa: E402
T = px.T

DATA = ROOT / "harness-data" / "tileset-authoring"
RUNS = ROOT / "qa-runs" / "harnesses" / "tileset-authoring"
RECIPES = {
    "pokemon-overworld": ("pokemon_overworld", "pokemon_overworld_demo"),
    "monster-overworld": ("monster_overworld", "monster_overworld_demo"),
}


def _merge(base, over):
    """지역 시드 겹치기: 사전은 재귀로 덮고, 목록·값은 갈아 끼우고, null 은 물려받은 키를 지운다."""
    if not isinstance(base, dict) or not isinstance(over, dict):
        return over
    out = dict(base)
    for k, v in over.items():
        if v is None:
            out.pop(k, None)
        else:
            out[k] = _merge(base.get(k), v) if isinstance(v, dict) else v
    return out


def load_seed(theme: str) -> dict:
    seed = json.loads((DATA / theme / "seed.json").read_text())
    if seed.get("extends"):                            # 지역 시트: 본 시드(팔레트·집·관문)를 물려받고 다른 것만 적는다
        base = json.loads((DATA / seed["extends"] / "seed.json").read_text())
        seed = _merge(base, {k: v for k, v in seed.items() if k != "extends"})
    for g in seed.get("gates", {}).values():
        if g.get("auto_houses"):                       # 집 정의에서 후보·배치·허용 지붕색을 펼친다
            for hid, h in seed["houses"].items():
                rows = 6 if h.get("kind") == "house2" else 4          # 지붕 2줄 + 벽 2줄(2층은 +2) — 통합 I4 W1, buildings.ROOF_H
                g["candidates"][hid] = [f"{hid}.{x}.{y}" for y in range(rows) for x in range(h["n"])]
                g.setdefault("layouts", {})[hid] = [h["n"], rows]
            g["extra_ramps"] = sorted({h["roof"] for h in seed["houses"].values() if h["roof"] != "roof_green"} | {h["accent"] for h in seed["houses"].values() if h.get("accent")})
    return seed


def load_recipe(theme: str):
    """(레시피, 데모). RECIPES 에 없으면 recipes/<테마_밑줄>.py 를 찾는다 — 지역 시트(monster-coast 등)는 등록 없이 늘린다.
    데모가 없으면 None(그림판 미리보기 생략)."""
    if theme in RECIPES:
        return [importlib.import_module(m) for m in RECIPES[theme]]
    mod = theme.replace("-", "_")
    if not (Path(__file__).resolve().parent / "recipes" / f"{mod}.py").exists():
        raise SystemExit(f"레시피가 없는 테마: {theme}. 있는 것: {', '.join(RECIPES)} + recipes/<테마>.py")
    return [importlib.import_module(mod), None]


def cmd_status(args) -> int:
    for theme in sorted(p.name for p in DATA.iterdir() if (p / "seed.json").exists()):
        runs = sorted((RUNS / theme).glob("*/candidate.png")) if (RUNS / theme).exists() else []
        baked = (ROOT / "public" / "assets" / theme / "chipset.png").exists()
        ledger = (DATA / theme / "ledger.json").exists()
        print(f"{theme}: 후보 run {len(runs)}개 · 구운 시트 {'있음' if baked else '없음'} · 번호 등록부 {'있음' if ledger else '없음'} · 배선 아직")
    return 0


def cmd_spec(args) -> int:
    seed = load_seed(args.theme)
    recipe, _ = load_recipe(args.theme)
    problems: list[str] = []
    if seed["tileSize"] != 16:
        problems.append("tileSize 는 16 이어야 한다(공용 칩셋 규약)")
    for key in ("palette", "roles", "tilesetId", "textureKey", "view"):
        if key not in seed:
            problems.append(f"seed.json 에 {key} 가 없다")
    for name, ramp in seed.get("palette", {}).items():
        items = ramp if isinstance(ramp, list) else [ramp]
        for h in items:
            try:
                px.hexc(h)
            except Exception:
                problems.append(f"팔레트 {name}: 색 {h} 을 읽을 수 없다")
    for p in problems:
        print("X", p)
    print("계약 OK" if not problems else f"문제 {len(problems)}건")
    return 1 if problems else 0


def cmd_draw(args) -> int:
    seed = load_seed(args.theme)
    recipe, demo = load_recipe(args.theme)
    sh = recipe.build(seed)
    run = args.run or time.strftime("%Y%m%d-%H%M%S")
    out = RUNS / args.theme / run
    out.mkdir(parents=True, exist_ok=True)
    sheet = sh.image()
    sheet.save(out / "candidate.png")
    (out / "tiles.json").write_text(json.dumps(dict(ids=sh.ids, anim=sh.anim, sections=sh.sections, cols=sh.cols,
                                                   count=len(sh.tiles)), ensure_ascii=False, indent=1) + "\n")
    if hasattr(recipe, "landmark_roles"):
        (out / "roles.json").write_text(json.dumps(recipe.landmark_roles(None), ensure_ascii=False))
    if demo is not None:
        demo.render(sh, 3).save(out / "demo.png")
    if demo is not None and hasattr(demo, "render_town"):
        demo.render_town(sh, 2).save(out / "town.png")
    sheet.resize((sheet.width * 3, sheet.height * 3), 0).save(out / "sheet-3x.png")
    print(f"run {run}: 칸 {len(sh.tiles)} · 시트 {sheet.width}x{sheet.height} → {out.relative_to(ROOT)}")
    return cmd_check_run(args, sh, out)


def cmd_bake(args) -> int:
    import bake
    seed = load_seed(args.theme)
    run = args.run
    if not run:
        raise SystemExit("--run <run> 이 필요하다(draw 가 만든 후보)")
    d = RUNS / args.theme / run
    if (d / "GATE-FAIL.txt").exists():
        raise SystemExit(f"{run} 은 관문 불합격 run 이다 — 굽지 않는다")
    tiles = json.loads((d / "tiles.json").read_text())
    roles = json.loads((d / "roles.json").read_text()) if (d / "roles.json").exists() else {}
    info = bake.bake(d / "candidate.png", tiles, seed, roles, d / "bake")
    print(f"bake {run}: {info} → {(d / 'bake').relative_to(ROOT)}")
    return 0


def _compose(sh, names: list[str], layout):
    from PIL import Image
    tiles = [_tile(sh, n) for n in names]
    if not layout:
        out = Image.new("RGBA", (T, T * len(tiles)))
        [out.paste(t, (0, i * T)) for i, t in enumerate(tiles)]
        return tiles[0] if len(tiles) == 1 else out
    cols, rows = layout
    out = Image.new("RGBA", (T * cols, T * rows))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * T, (i // cols) * T))
    return out


def run_gates(args, sh, seed, recipe, quiet=False):
    """관문 판정. 반환 (candidate_fails, selftest_issues). 양성 대조는 통과·음성 대조는 불합격이어야 관문이 유효하다."""
    if "gates" not in seed:
        return {}, []
    regs = ref_regions(seed)
    P = recipe.palette(seed)
    P["_leaf_hex"] = seed["palette"].get("leaf", [])
    negs = recipe.negatives(P, ROOT) if hasattr(recipe, "negatives") else {}
    cand_fails: dict[str, list[str]] = {}
    self_issues: list[str] = []
    specs: dict[str, dict] = {}
    for gname, g in seed["gates"].items():
        pos_imgs = [regs[r] for r in g["positives"]]
        if g["kind"] == "object":
            ramp = [tuple(c[:3]) for c in px.ramp(seed["palette"][g["ramp"]])]
            pos = [gt.object_metrics(im, ramp) for im in pos_imgs]
            spec = gt.derive_object_spec(pos)
            evaluate = lambda im: gt.evaluate_object(gt.object_metrics(im, ramp), spec)
        else:
            pos = [gt.tile_metrics(im) for im in pos_imgs]
            spec = gt.derive_tile_spec(pos)
            extra = [h for k in g.get("extra_ramps", []) for h in seed["palette"][k]]
            evaluate = lambda im, spec=spec, extra=extra: gt.evaluate_tile(im, spec, extra_hex=extra)
        specs[gname] = spec
        for im, rname in zip(pos_imgs, g["positives"]):
            f = evaluate(im)
            if f:
                self_issues.append(f"[관문 {gname}] 양성 대조 {rname} 이 불합격 — 관문이 기준 그림을 못 알아본다: {f[0]}")
        for nname in g.get("negatives", []):
            if nname not in negs:
                self_issues.append(f"[관문 {gname}] 음성 대조 {nname} 을 만들 수 없다")
            elif not evaluate(negs[nname]):
                self_issues.append(f"[관문 {gname}] 음성 대조 {nname} 이 통과했다 — 관문이 약하다(옛 불합격작을 못 거른다)")
        for cname, names in g["candidates"].items():
            f = evaluate(_compose(sh, names, (g.get("layouts") or {}).get(cname) or g.get("layout")))
            if f:
                cand_fails[f"{gname}/{cname}"] = f
    bf, bi, bspecs = run_building_gates(sh, seed, recipe, P, regs)
    cand_fails.update(bf)
    self_issues += bi
    specs.update({f"building/{k}": v for k, v in bspecs.items()})
    (DATA / args.theme / "gates.json").write_text(json.dumps(specs, ensure_ascii=False, indent=1) + "\n")
    return cand_fails, self_issues


def _resolve_roles(roles: dict, P: dict) -> dict:
    r = dict(roles)
    key = r.get("roof_ramp")
    if isinstance(key, str):
        r["roof_ramp"] = [tuple(c[:3]) for c in P[key]]
    for k in ("wall", "openings", "windows", "doors"):
        r[k] = [tuple(x) for x in r.get(k, [])]
    for k in ("frame_ramp", "glass_ramp"):
        if isinstance(r.get(k), str):
            r[k] = [tuple(c[:3]) for c in P[r[k]]]
    if r.get("frame_zone"):
        r["frame_zone"] = tuple(r["frame_zone"])
    return r


def run_building_gates(sh, seed, recipe, P, regs):
    """역할별(벽·처마·지붕·창·문) 건물 관문. 양성=기준 그림, 음성=사람이 불합격시킨 옛 그림(seed.building_negatives)."""
    import building as bd
    from PIL import Image
    fails: dict[str, list[str]] = {}
    issues: list[str] = []
    specs: dict[str, dict] = {}
    br = seed.get("building_roles", {})
    cand_roles = recipe.landmark_roles(P) if hasattr(recipe, "landmark_roles") else {}
    for bname, bg in seed.get("building_gates", {}).items():
        base = seed["gates"][bg["gate"]]
        refs = bg["ref"] if isinstance(bg["ref"], list) else [bg["ref"]]
        poss = [bd.measure(regs[r], _resolve_roles(br[r], P)) for r in refs]
        spec = {k: v for k, v in bd.derive_spec(poss).items() if k not in bg.get("skip", [])}
        specs[bname] = spec
        for r, pos in zip(refs, poss):
            if bd.evaluate(pos, spec):
                issues.append(f"[건물 관문 {bname}] 기준 그림 {r} 이 자기 관문에서 불합격")
        for nname in bg.get("negatives", []):
            nim = Image.open(ROOT / seed["building_negatives"][nname]).convert("RGBA")
            nf = bd.evaluate(bd.measure(nim, _resolve_roles(br[nname], P)), spec)
            if not nf:
                issues.append(f"[건물 관문 {bname}] 음성 대조 {nname} 이 통과했다 — 관문이 약하다")
            elif not quiet_negs:
                print(f"  (건물 관문 {bname}: 음성 대조 {nname} 은 {len(nf)}항목에서 불합격 — {', '.join(x.split('=')[0] for x in nf)})")
        for cname, names in base["candidates"].items():
            if cname not in cand_roles:
                continue
            im = _compose(sh, names, (base.get("layouts") or {}).get(cname) or base.get("layout"))
            skip_c = (bg.get("skip_by") or {}).get(cname, [])     # 후보별로 뺄 항목(예: 마트는 센터 분홍 틀 비중을 안 본다)
            spec_c = {k: v for k, v in spec.items() if k not in skip_c}
            f = bd.evaluate(bd.measure(im, _resolve_roles(cand_roles[cname], P)), spec_c)
            if f:
                fails[f"건물/{bname}/{cname}"] = f
    return fails, issues, specs


quiet_negs = True


def cmd_check_run(args, sh, out: Path) -> int:
    issues: list[str] = []
    seed = load_seed(args.theme)
    recipe, _ = load_recipe(args.theme)
    have = recipe.role_ids(sh)
    for role in seed["roles"]:
        if not have.get(role):
            issues.append(f"역할 {role} 의 칸이 시트에 없다")
    # 오토타일 47변형: 서로 달라야 하고, 이웃과 이어지는 변의 안/밖 모양(구조)이 맞아야 한다
    for fam, prefix, kind, suffix in recipe.FAMILIES:
        seen: dict[bytes, int] = {}
        for m in px.ALL47:
            key = _tile(sh, f"{prefix}{m}{suffix}").tobytes()
            if key in seen:
                issues.append(f"{fam} 변형 {m} 이 {seen[key]} 와 같은 그림")
            seen[key] = m
        issues += [f"{fam} 이음새 어긋남 {b}" for b in px.seam_report(recipe.autotile_masks(kind))]
    for fam, kind in getattr(recipe, "EXTRA_MASKS", {}).items():
        issues += [f"{fam} 이음새 어긋남 {b}" for b in px.seam_report(recipe.autotile_masks(kind))]
    if hasattr(recipe, "parity_issues"):                 # 다른 시트 정본과 같은 이름 칸 바이트 대조(레시피가 정한다)
        issues += recipe.parity_issues(sh, lambda n: _tile(sh, n), load_seed)
    colors = {tuple(c[:3]) for c in _pixels(sh.image()) if c[3] == 255}
    max_colors = seed.get("limits", {}).get("max_colors", 96)
    if len(colors) > max_colors:
        issues.append(f"불투명 색 {len(colors)}가지 — {max_colors} 이하로 줄인다")
    print(f"색 {len(colors)}가지")
    for name in getattr(recipe, "OPAQUE", []):
        if any(c[3] < 255 for c in _pixels(_tile(sh, name))):
            issues.append(f"바닥 칸 {name} 에 투명 픽셀이 있다")
    cand_fails, self_issues = run_gates(args, sh, seed, recipe)
    for i in issues:
        print("X", i)
    for i in self_issues:
        print("!! 관문 자체 결함:", i)
    for k, fl in cand_fails.items():
        print(f"X [관문] {k}")
        for f in fl:
            print("     -", f)
    bad = bool(issues or cand_fails or self_issues)
    (out / "GATE-FAIL.txt").unlink(missing_ok=True)
    if bad:
        (out / "GATE-FAIL.txt").write_text("\n".join(issues + self_issues + [f"{k}: {'; '.join(v)}" for k, v in cand_fails.items()]) + "\n")
    print("검사·관문 통과 — 시점·화풍의 최종 판단은 사람(비교판)이 한다." if not bad else f"불합격: 구조 검사 {len(issues)}건 · 관문 후보 {len(cand_fails)}건 · 관문 결함 {len(self_issues)}건 → pick 불가")
    return 1 if bad else 0


def _pixels(im):
    return list(im.getdata()) if not hasattr(im, "get_flattened_data") else list(im.get_flattened_data())


def _tile(sh, name):
    i = sh.ids[name]
    sheet = sh.image()
    x, y = (i % sh.cols) * px.T, (i // sh.cols) * px.T
    return sheet.crop((x, y, x + px.T, y + px.T))


def ref_regions(seed: dict):
    """기준 시트에서 seed.reference.regions 를 잘라 이름 → 이미지."""
    from PIL import Image
    ref = seed.get("reference")
    if not ref:
        raise SystemExit("이 테마의 seed.json 에 reference 가 없다")
    sheets = {k: Image.open(ROOT / v).convert("RGBA") for k, v in ref["sheets"].items()}
    out = {}
    for name, (sheet, x, y, w, h) in ref["regions"].items():
        out[name] = sheets[sheet].crop((x, y, x + w, y + h))
    return out


def cmd_study(args) -> int:
    """기준 팩을 잰다 → harness-data/<테마>/style.json (측정값만, 픽셀은 저장하지 않는다) + 연구 보드 html."""
    seed = load_seed(args.theme)
    regs = ref_regions(seed)
    report = {"pack": seed["reference"]["pack"], "regions": {n: st.measure(im) for n, im in regs.items()}}
    ref_all = set()
    for sheet in seed["reference"]["sheets"].values():
        from PIL import Image
        ref_all |= st.palette_set(Image.open(ROOT / sheet).convert("RGBA"))
    report["palette_colors"] = len(ref_all)
    (DATA / args.theme / "style.json").write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n")
    for n, m in report["regions"].items():
        ramp = " ".join(r["hex"] for r in m.get("ramp", []))
        print(f"{n:11s} 색 {m.get('colors'):3} 윤곽 {m.get('outline')} 덩이 {m.get('clump'):5} 잡음 {m.get('isolated'):.3f} 경계 {m.get('boundary'):.2f} 채도 {m.get('saturation')} | {ramp}")
    print(f"→ harness-data/tileset-authoring/{args.theme}/style.json (기준 전체 {len(ref_all)}색)")
    return 0


def cmd_compare(args) -> int:
    """후보 run 을 기준과 같은 잣대로 재서 나란히 놓는다 → qa-runs/.../<run>/compare.html + compare.json."""
    import base64, io
    from PIL import Image
    seed = load_seed(args.theme)
    recipe, _ = load_recipe(args.theme)
    run = args.run or sorted(p.name for p in (RUNS / args.theme).iterdir())[-1]
    out = RUNS / args.theme / run
    sh = recipe.build(seed)
    regs = ref_regions(seed)
    ref_pal = set()
    for sheet in seed["reference"]["sheets"].values():
        ref_pal |= st.palette_set(Image.open(ROOT / sheet).convert("RGBA"))
    def uri(im, scale):
        b = io.BytesIO(); bg = Image.new("RGBA", im.size, (48, 52, 60, 255)); bg.alpha_composite(im.convert("RGBA"))
        bg.resize((im.width * scale, im.height * scale), 0).save(b, "PNG"); return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    rows, table = [], {}
    for role, spec in seed["match"].items():
        ref_im = regs[spec["ref"]]
        tiles = [_tile(sh, n) for n in spec["tiles"]]
        # 후보 구역: 타일들을 가로로 이어 붙인 한 장(투명 포함 — 측정은 불투명 점만)
        mine_im = Image.new("RGBA", (T * len(tiles), T)); [mine_im.paste(t, (i * T, 0)) for i, t in enumerate(tiles)]
        if role == "tree":  # 2×3 나무는 세로로 쌓아 읽는다
            mine_im = Image.new("RGBA", (T * 2, T * 3)); [mine_im.paste(t, ((i % 2) * T, (i // 2) * T)) for i, t in enumerate(tiles)]
        a, b = st.measure(ref_im), st.measure(mine_im)
        cov = st.coverage(mine_im, ref_pal)
        verdict = st.judge(a, b, cov)
        table[role] = {"ref": a, "mine": b, "coverage": round(cov, 3), "verdict": verdict}
        v_html = "".join(f"<tr><td>{n}</td><td>{d}</td><td class={s_}>{s_}</td></tr>" for n, d, s_ in verdict)
        sw = lambda m: "".join(f"<span class=sw style='background:{r['hex']}' title='{r['hex']}'></span>" for r in m["ramp"])
        rows.append(f"<h2>{role}</h2><div class=two><div><small>기준 ({spec['ref']})</small><br><img src='{uri(ref_im, 6)}'><br>{sw(a)}</div>"
                    f"<div><small>내 후보</small><br><img src='{uri(mine_im, 6)}'><br>{sw(b)}</div></div><table>{v_html}</table>")
    html = ("<!doctype html><meta charset=utf-8><title>비교</title><style>body{font:14px system-ui;background:#16181d;color:#e8e8e8;padding:20px;max-width:1300px}"
            "img{image-rendering:pixelated;border:1px solid #333;max-width:100%}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.sw{display:inline-block;width:30px;height:18px;margin-right:2px}"
            "td{padding:2px 12px 2px 0}.ok{color:#7fe08a}.warn{color:#f0b070}.bad{color:#f07070}h2{color:#9ecbff;font-size:15px}small{color:#9aa}</style>"
            f"<h1>{seed['title']} — 기준과 비교 ({run})</h1><p>숫자는 닮은 정도의 단서일 뿐 합격 보증이 아니다. 화풍은 사람이 위 그림을 보고 정한다.</p>" + "".join(rows))
    (out / "compare.html").write_text(html)
    (out / "compare.json").write_text(json.dumps(table, ensure_ascii=False, indent=1) + "\n")
    bad = sum(1 for r in table.values() for _, _, s_ in r["verdict"] if s_ == "bad")
    warn = sum(1 for r in table.values() for _, _, s_ in r["verdict"] if s_ == "warn")
    for role, r in table.items():
        print(f"{role:10s} 팔레트 {r['coverage']*100:3.0f}% | " + " ".join(f"{n}:{s_}" for n, _, s_ in r["verdict"]))
    print(f"→ {out.relative_to(ROOT)}/compare.html  (bad {bad} · warn {warn})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="tileset-authoring")
    ap.add_argument("stage", choices=["status", "spec", "study", "draw", "check", "compare", "bake", "wire"])
    ap.add_argument("--theme", default="pokemon-overworld")
    ap.add_argument("--run", default="")
    args = ap.parse_args()
    if args.stage == "status":
        return cmd_status(args)
    if args.stage == "spec":
        return cmd_spec(args)
    if args.stage == "study":
        return cmd_study(args)
    if args.stage == "compare":
        return cmd_compare(args)
    if args.stage == "bake":
        return cmd_bake(args)
    if args.stage == "wire":
        import wire
        sys.path.insert(0, str(Path(__file__).resolve().parent / "recipes"))
        if not args.run:
            raise SystemExit("--run <run> 이 필요하다(구운 run)")
        d = RUNS / args.theme / args.run
        if (d / "GATE-FAIL.txt").exists() or not (d / "bake" / "tileset.json").exists():
            raise SystemExit(f"{args.run} 은 관문 불합격이거나 굽지 않은 run 이다")
        print("wire", wire.wire(args.theme, d, load_seed(args.theme)))
        return 0
    if args.stage in ("draw", "check"):
        return cmd_draw(args)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
