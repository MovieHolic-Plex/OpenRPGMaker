#!/usr/bin/env python3
"""Lead/worker split battery — logic JSON of one run for the judge: ../script-ab/logic_export.py, keeping movement and
adding what RPG/romance requests use (equipment, actors, map encounters/BGM, start gold/party).

  python3 scripts/qa/split-ab/export.py <runtime project.json> > logic.json
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "script-ab"))
import logic_export  # noqa: E402
logic_export.DROP -= {"movement", "moveRoute"}
SKIP_MAP = {"lowerTiles", "upperTiles", "layers", "tiles", "events", "shadows", "regions", "passability", "relief", "extraLayers", "decorations"}


def main():
    path = sys.argv[1]
    p = json.load(open(path))
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        logic_export.main()
    out = json.loads(buf.getvalue())
    maps = p["maps"] if isinstance(p["maps"], list) else list(p["maps"].values())
    used = json.dumps(out)
    db = p.get("database") or {}
    def recs(key):
        v = db.get(key) or []
        return list(v.values()) if isinstance(v, dict) else v
    out["equipment"] = logic_export.clean([{k: e.get(k) for k in ("id", "name", "price", "params", "stats", "slot", "kind", "etypeId", "traits")} for e in recs("equipment") if f'"{e.get("id")}"' in used or e.get("id", "").startswith(("eq_", "equipment_")) and e.get("name") in used])
    out["actors"] = logic_export.clean([{k: a.get(k) for k in ("id", "name", "classId", "initialLevel", "level", "faceName", "portrait")} for a in recs("actors") if f'"{a.get("id")}"' in used])
    extra = {}
    for m in maps:
        small = {k: v for k, v in m.items() if k not in SKIP_MAP and not k.endswith("Tiles") and k not in ("id", "name", "width", "height", "tilesetId", "tileSize", "terrainDesign")
                 and not (isinstance(v, list) and len(v) > 64) and len(json.dumps(v, ensure_ascii=False)) < 2500}
        small = logic_export.clean(small)
        if small: extra[m["id"]] = small
    out["mapSettings"] = extra
    sysrec = p.get("system") or {}
    out["system"] = logic_export.clean({k: v for k, v in sysrec.items() if any(w in k.lower() for w in ("gold", "party", "start", "bgm")) and len(json.dumps(v, ensure_ascii=False)) < 2500})
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
