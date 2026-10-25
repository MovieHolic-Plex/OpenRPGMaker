"""fc_build 변환기 단위 시험 — 계약 모양의 작은 합성 타일맵 두 장.  python3 -m unittest scripts/content/fantasy-castles/test_fc_build.py"""
import json
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fc_build as FB  # noqa: E402

T = 16


def solid(rgb):
    a = np.zeros((T, T, 4), np.uint8)
    a[..., :3] = rgb
    a[..., 3] = 255
    return a


def blob(rgb, rows):
    a = np.zeros((T, T, 4), np.uint8)
    a[rows[0]:rows[1], 2:14, :3] = rgb
    a[rows[0]:rows[1], 2:14, 3] = 255
    return a


CELLS = [solid((60, 140, 60)), solid((40, 70, 160)), solid((120, 120, 120)), blob((200, 190, 90), (12, 16)),
         blob((90, 80, 70), (0, 16)), blob((30, 100, 40), (0, 10)), blob((150, 110, 60), (4, 12)), solid((180, 160, 120)),
         blob((250, 10, 10), (5, 7))]


def dump(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f)


def load(path):
    with open(path) as f:
        return json.load(f)


def write_tilemap(d, w, h, layers, walk, pieces, placements, cells=CELLS, cols=4, tweak=None):
    os.makedirs(d, exist_ok=True)
    rows = (len(cells) + cols - 1) // cols
    sheet = np.zeros((rows * T, cols * T, 4), np.uint8)
    for i, c in enumerate(cells):
        y, x = divmod(i, cols)
        sheet[y * T:(y + 1) * T, x * T:(x + 1) * T] = c
    Image.fromarray(sheet).save(os.path.join(d, "tileset.png"))
    comp = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 0))
    for L in FB.LAYERS:
        for y in range(h):
            for x in range(w):
                i = layers.get(L, [[-1] * w] * h)[y][x]
                if i >= 0:
                    tile = Image.fromarray(cells[i])
                    layer = Image.new("RGBA", comp.size, (0, 0, 0, 0))
                    layer.paste(tile, (x * T, y * T))
                    comp = Image.alpha_composite(comp, layer)
    if tweak:
        tweak(comp)
    comp.save(os.path.join(d, "composite.png"))
    dump(dict(w=w, h=h, tileSize=16, tilesetColumns=cols, layers=layers, walk=walk, pieces=placements), os.path.join(d, "map.json"))
    dump(pieces, os.path.join(d, "pieces.json"))


E = -1


def map_a(d, **kw):
    layers = dict(ground=[[0, 0, 0, 0], [0, 0, 2, 0], [1, 1, 1, 0]],
                  ground_over=[[E, 3, E, E], [E, E, E, E], [E, E, 3, E]],
                  object=[[E, E, E, E], [E, E, 6, 4], [E, E, E, E]],
                  object_over=[[E, E, E, E], [5, E, E, E], [E, E, E, E]])
    walk = ["OOOO", "OOOX", "XXXO"]
    pieces = {"wall": dict(w=1, h=1, layers=dict(object=[[4]]), walk=["X"]),
              "tree": dict(w=1, h=2, layers=dict(ground=[[0], [0]], object=[[E], [4]], object_over=[[5], [E]]), walk=["O", "X"])}
    placements = [dict(id="wall", x=3, y=1, w=1, h=1, layer="object"), dict(id="gate", x=2, y=1, w=1, h=1, layer="object")]
    write_tilemap(d, 4, 3, layers, walk, pieces, placements, **kw)


def map_b(d, extra=False):
    g = [[0, 7, 0], [1, 0, 0]]
    if extra:
        g[1][2] = 7
    layers = dict(ground=g, object=[[E, 4, E], [E, E, E]], object_over=[[E, 5, E], [E, E, 5 if not extra else E]])
    walk = ["OXO", "XOO"]
    cells = CELLS if not extra else CELLS[:8] + [blob((10, 10, 250), (0, 16))]
    if extra:
        layers["object"][1][1] = 8
        walk = ["OXO", "XXO"]
    write_tilemap(d, 3, 2, layers, walk, {}, [dict(id="tower", x=1, y=0, w=1, h=1, layer="object")], cells=cells)


class FcBuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fc-test-")
        self.a, self.b, self.data = (os.path.join(self.tmp, n) for n in ("a", "b", "data"))
        map_a(self.a)
        map_b(self.b)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_build(self, srcs=None, **kw):
        srcs = srcs or [(self.a, "fc_a", "가 성"), (self.b, "fc_b", "나 성")]
        return FB.run(srcs, self.data, **kw)

    def test_layers_passability_and_composite(self):
        r = self.run_build()
        st, led, g = r["stats"], r["ledger"], r["grids"]["fc_a"]
        self.assertEqual(st["maps"]["fc_a"]["walkMismatch"], 0)
        self.assertEqual(st["maps"]["fc_a"]["compositeVsSource"]["differing"], 0)
        self.assertEqual(st["maps"]["fc_b"]["compositeVsSource"]["differing"], 0)
        canopy = led.cells[g["object_over"][1][0]]
        self.assertEqual((canopy["pass"], canopy["prio"]), ("O", "upper"))
        gate = led.cells[g["object"][1][2]]
        self.assertEqual((gate["pass"], gate["prio"]), ("O", "lower"))
        wall = led.cells[g["object"][1][3]]
        self.assertEqual(wall["pass"], "X")
        self.assertNotEqual(g["ground_over"][0][1], g["ground_over"][2][2])
        self.assertEqual(st["splitByPassability"].get("upper"), 1)
        for y in range(3):
            for x in range(4):
                self.assertEqual(FB.engine_pass(led, g, x, y), "OOOO OOOX XXXO".split()[y][x] == "O")

    def test_dedupe_across_maps(self):
        r = self.run_build()
        ga, gb = r["grids"]["fc_a"], r["grids"]["fc_b"]
        self.assertEqual(ga["ground"][0][0], gb["ground"][0][0])
        self.assertEqual(ga["object"][1][3], gb["object"][0][1])
        self.assertGreaterEqual(r["stats"]["sharedAcrossMaps"], 3)
        shas = [(c["sha"], c["pass"], c["prio"], c["home"]) for c in r["ledger"].cells]
        self.assertEqual(len(shas), len(set(shas)))

    def test_ledger_append_only_and_orphans(self):
        r1 = self.run_build()
        before = list(r1["ledger"].cells)
        sheet1 = r1["sheet"].copy()
        map_b(self.b, extra=True)
        r2 = self.run_build(srcs=[(self.b, "fc_b", "나 성")])
        after = r2["ledger"].cells
        self.assertEqual(after[:len(before)], before)
        self.assertGreater(len(after), len(before))
        self.assertGreater(r2["stats"]["orphanCellsFromPreviousSheet"], 0)
        for i in range(len(before)):
            self.assertTrue(np.array_equal(FB.cell_px(sheet1, r1["cols"], i), FB.cell_px(r2["sheet"], r2["cols"], i)))

    def test_frozen_ledger_refuses_reset(self):
        self.run_build()
        p = os.path.join(self.data, "cell-ledger.json")
        d = load(p)
        d["frozen"] = 2
        dump(d, p)
        with self.assertRaises(FB.BuildError):
            self.run_build(reset_ledger=True)

    def test_composite_mismatch_fails(self):
        map_a(self.a, tweak=lambda im: im.putpixel((0, 0), (1, 2, 3, 255)))
        with self.assertRaises(FB.BuildError):
            self.run_build()

    def test_transparent_ground_fails(self):
        d = os.path.join(self.tmp, "bad")
        write_tilemap(d, 1, 1, dict(ground=[[3]]), ["O"], {}, [])
        with self.assertRaises(FB.BuildError):
            FB.run([(d, "fc_bad", "x")], self.data, write=False)

    def test_kits_from_pieces_and_placements(self):
        r = self.run_build()
        kits = {k["id"]: k for k in r["tileset"]["structureKits"]}
        tree = kits["fc-a-tree"]
        led = r["ledger"].cells
        self.assertEqual((tree["width"], tree["height"]), (1, 2))
        self.assertEqual(led[tree["rows"][0]["upperTiles"][0]]["prio"], "upper")
        self.assertEqual(led[tree["rows"][1]["upperTiles"][0]]["pass"], "X")
        self.assertIn("fc-b-tower", kits)
        self.assertEqual(r["stats"]["kits"]["source"], {"fc_a": "pieces.json", "fc_b": "map.json 배치"})

    def test_written_outputs(self):
        self.run_build()
        ts = load(os.path.join(self.data, "build", "fantasyCastlesTileset.json"))
        self.assertEqual(ts["count"], len(ts["passability"]))
        self.assertEqual(ts["count"], len(ts["tileMeta"]))
        m = load(os.path.join(self.data, "maps", "fc_a.json"))["map"]
        self.assertEqual(len(m["lowerTiles"]), 12)
        self.assertEqual(len(m["upperOverlayTiles"]), 12)
        self.assertEqual(m["tilesetId"], "fantasy_castles")
        with Image.open(os.path.join(self.data, "build", "fantasy-castles-chipset.png")) as sheet:
            self.assertEqual(sheet.size[0], 32 * T)


if __name__ == "__main__":
    unittest.main()
