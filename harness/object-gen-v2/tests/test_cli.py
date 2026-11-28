"""Smoke tests for object-gen-v2 verify, sheet, pack, and init-batch."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from objectgen_v2.cli import main

ROOT = Path(__file__).resolve().parent.parent
PALETTE = ROOT / "palettes" / "fable-city.json"
REFS = ROOT / "references"


class ObjectGenV2CliTest(unittest.TestCase):
    def test_verify_bundled_references_zero_violations(self) -> None:
        rc = main(["verify", str(REFS), "--palette", str(PALETTE)])
        self.assertEqual(rc, 0)

    def test_sheet_and_pack_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            qa_dir = t / "qa"
            self.assertEqual(main(["sheet", str(REFS), "--out", str(qa_dir), "--html"]), 0)
            self.assertTrue((qa_dir / "qa-sheet-1.png").exists())
            self.assertTrue((qa_dir / "gallery.html").exists())

            batch = t / "demo-batch"
            self.assertEqual(main(["init-batch", str(batch), "--palette", str(PALETTE)]), 0)
            ref_idx = json.loads((REFS / "index.json").read_text(encoding="utf-8"))
            spec_path = batch / "spec.json"
            spec = json.loads(spec_path.read_text(encoding="utf-8"))
            spec["piecesDir"] = str(REFS)
            spec["items"] = [
                {
                    "id": entry["id"],
                    "name": entry["name"],
                    "w": entry["w"],
                    "h": entry["h"],
                    "tags": entry["tags"],
                }
                for entry in ref_idx["references"]
            ]
            spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")

            pack_dir = t / "out-pack"
            self.assertEqual(main(["pack", str(spec_path), "--out", str(pack_dir)]), 0)
            manifest = json.loads((pack_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["schema"], "oprn-store-pack/1")
            self.assertEqual(len(manifest["content"]["tilesets"]["ts_demo-batch"]["structureKits"]), len(ref_idx["references"]))
            for blob in manifest["blobs"]:
                self.assertTrue((pack_dir / "blobs" / f"{blob['sha256']}.png").exists())


if __name__ == "__main__":
    unittest.main()
