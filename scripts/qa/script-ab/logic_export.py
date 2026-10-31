#!/usr/bin/env python3
"""Script A/B PoC — the game logic of one build as compact JSON, for the pairwise judge.

  python3 scripts/qa/script-ab/logic_export.py <runtime project.json>  > logic.json

Keeps what decides behaviour: events (pages: trigger, conditions, commands — scripts with their source),
common events, script library, troops (battle pages), enemies used by troops, items, named switches/variables,
start map/position and time settings. Drops graphics, tiles and layout noise.
"""
import json, sys

DROP = {"graphic", "graphicPattern", "movement", "moveRoute", "priority", "nearSparkle", "compiled", "sourceHash", "apiVersion",
        "effects", "placementRole", "walkingAnimation", "steppingAnimation", "directionFix", "through", "alwaysOnTop", "label"}


def clean(v):
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items() if k not in DROP and x not in (None, "", [], {})}
    if isinstance(v, list):
        return [clean(x) for x in v]
    return v


def main():
    p = json.load(open(sys.argv[1]))
    maps = p["maps"] if isinstance(p["maps"], list) else list(p["maps"].values())
    used = json.dumps(maps) + json.dumps(p.get("commonEvents") or [])
    db = p.get("database") or {}
    troops = [t for t in (db.get("troops") or {}).values()] if isinstance(db.get("troops"), dict) else (db.get("troops") or [])
    troops = [t for t in troops if t.get("id") in used]
    enemy_ids = {m.get("enemyId") for t in troops for m in (t.get("members") or [])}
    enemies = db.get("enemies") or {}
    enemies = [e for e in (enemies.values() if isinstance(enemies, dict) else enemies) if e.get("id") in enemy_ids]
    items = db.get("items") or {}
    items = [{"id": i["id"], "name": i.get("name"), "price": i.get("price")} for i in (items.values() if isinstance(items, dict) else items) if i.get("id") in used]
    out = {
        "startMapId": p.get("startMapId"), "startPos": p.get("startPos"),
        "time": clean((p.get("system") or {}).get("time") or (p.get("system") or {}).get("timeSystem")),
        "switches": [s for s in p.get("switches") or [] if f'"{s["id"]}"' in used],
        "variables": [v for v in p.get("variables") or [] if f'"{v["id"]}"' in used],
        "items": items,
        "maps": [{"id": m["id"], "name": m.get("name"), "size": f'{m.get("width")}x{m.get("height")}',
                  "events": [clean({"id": e["id"], "name": e.get("name"), "x": e.get("x"), "y": e.get("y"), "pages": e.get("pages")}) for e in m.get("events") or []]}
                 for m in maps],
        "commonEvents": clean(p.get("commonEvents") or []),
        "scriptLibrary": clean(p.get("scriptLibrary") or []),
        "troops": clean(troops),
        "enemies": clean([{k: e.get(k) for k in ("id", "name", "maxHp", "hp", "params", "stats", "actions", "attack", "skills")} for e in enemies]),
        "endings": clean(p.get("endings") or []),
    }
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
