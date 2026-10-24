"""Build one play.json fixture per field-foe look, staged on the B1 forest edge (fs_forest_edge) chase checkpoint.

usage: python3 make_fixtures.py <baked chrono-bell.play.json> <out dir> [variant ...]
Variants: base (current battler-as-sprite), a, b, c, d. Each non-base variant gets an uploaded RM2000 CharSet
(slots 0..3 = wolf, spider, wisp, boar; Option C slots are area tints) and every foe page uses it with stepping idle.
Three extra stationary foes (spider, wisp, boar) are staged in view of the chase so all species share one screen.
Prototype staging only — the shipped game is unchanged.
"""
from __future__ import annotations
import base64, copy, io, json, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from option_ac_charsets import FW, FH, shadow  # noqa: E402

MAP = "fs_forest_edge"
SPECIES = ["wolf-grey", "spider-cave", "wisp-blue", "boar-tusk"]
STAGED = [("spider", 1, 13, 20, "right"), ("wisp", 2, 22, 17, "left"), ("boar", 3, 14, 16, "right")]
DIR_ROW = {"up": 0, "right": 1, "down": 2, "left": 3}


def frame_index(slot: int, direction: str, pattern: int = 1) -> int:
    row = (slot // 4) * 4 + DIR_ROW[direction]
    return row * 12 + (slot % 4) * 3 + pattern


def with_shadows(img: Image.Image) -> Image.Image:
    """Option B is drawn without a shadow; give it the same baked ground ellipse as A/C for a fair comparison."""
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for slot in range(4):
        for row in range(4):
            for col in range(3):
                x, y = (slot % 4) * 72 + col * FW, (slot // 4) * 128 + row * FH
                cell = img.crop((x, y, x + FW, y + FH))
                frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
                floats = slot == 2
                shadow(frame, FW / 2, 10 if floats else 16, FH - 2, 70 if floats else 96)
                frame.alpha_composite(cell)
                out.alpha_composite(frame, (x, y))
    return out


def data_url(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def build(src: dict, variant: str) -> dict:
    project = copy.deepcopy(src)
    m = project["maps"][MAP]
    foes = [e for e in m["events"] if "_foe" in e["id"]]
    charset_id = f"oprn-proto-field-foes-{variant}"
    if variant != "base":
        sheet = Image.open(HERE / "out" / f"option-{variant}.png").convert("RGBA")
        if variant == "b":
            sheet = with_shadows(sheet)
        project["assets"]["uploaded"][charset_id] = {
            "id": charset_id, "name": f"field foe prototype {variant}", "kind": "charset", "dataUrl": data_url(sheet),
            "meta": {"width": 288, "height": 256, "frameWidth": 24, "frameHeight": 32},
        }

    def graphic(slot: int, direction: str) -> dict:
        if variant == "base":
            return {"sprite": {"type": "bundled", "id": f"generated-enemy-{SPECIES[slot]}"}, "direction": "down", "pattern": 0}
        use = 0 if variant == "c" else slot  # C: one area symbol (forest edge tint) for every foe on the map
        return {"sprite": {"type": "uploaded", "id": charset_id}, "direction": direction, "pattern": frame_index(use, direction)}

    for e in foes:
        lead = "spider-cave" if "spider" in json.dumps(e["pages"][0]["graphic"]) else "wolf-grey"
        slot = SPECIES.index(lead)
        for page in e["pages"]:
            if page.get("graphic", {}).get("sprite"):
                page["graphic"] = graphic(slot, "down")
                if variant != "base":
                    page["animationType"] = "step"
    template = foes[0]
    for name, slot, x, y, facing in STAGED:
        ev = copy.deepcopy(template)
        ev["id"] = f"ev_{MAP}_stage_{name}"
        ev["x"], ev["y"] = x, y
        ev["trigger"] = {"kind": "action"}
        page = ev["pages"][0]
        page["id"] = f"{ev['id']}_p"
        page["trigger"] = {"kind": "action"}
        page["commands"] = []
        page.pop("movement", None)
        page["graphic"] = graphic(slot, facing)
        if variant != "base":
            page["animationType"] = "step"
        ev["pages"] = [page]
        m["events"].append(ev)
    return project


if __name__ == "__main__":
    src = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for variant in sys.argv[3:] or ["base", "a", "b", "c"]:
        (out / f"{variant}.play.json").write_text(json.dumps(build(src, variant)))
        print("wrote", out / f"{variant}.play.json")
