"""EasyRPG RTP attribution check.

Fails (exit 1) only when a sheet contains exact EasyRPG RTP pixels and public/assets/ATTRIBUTION.md does not list
that sheet inside the `rtp-derived-sheets` block. RTP material is CC BY 4.0 and may be used and modified with credit;
this check makes sure the credit follows the pixels.

    python3 scripts/content/rtp-attribution/rtp_check.py              # every bundled chipset in src/assets/bundled.ts
    python3 scripts/content/rtp-attribution/rtp_check.py public/assets/beodeul-city/beodeul-city-chipset.png
    python3 scripts/content/rtp-attribution/rtp_check.py --json        # machine-readable report

Bake scripts call `require_credit(path)` after writing a sheet.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rtp_match import scan  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ATTRIBUTION = ROOT / 'public/assets/ATTRIBUTION.md'
BLOCK = re.compile(r'<!-- rtp-derived-sheets:begin -->(.*?)<!-- rtp-derived-sheets:end -->', re.S)


def credited() -> set[str]:
    m = BLOCK.search(ATTRIBUTION.read_text())
    return set(re.findall(r'`([^`]+\.png)`', m.group(1))) if m else set()


def rel(path: Path) -> str:
    p = path.resolve()
    try:
        return str(p.relative_to(ROOT / 'public/assets'))
    except ValueError:
        return str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p)


def bundled_sheets() -> list[Path]:
    src = (ROOT / 'src/assets/bundled.ts').read_text()
    paths = sorted(set(re.findall(r'path:\s*["\'](assets/[^"\']+\.png)["\']', src)))
    return [ROOT / 'public' / p for p in paths if (ROOT / 'public' / p).exists()]


def check(paths: list[Path]) -> list[dict]:
    ok = credited()
    rows = []
    for p in paths:
        r = scan(p)
        name = rel(p)
        rows.append({'sheet': name, 'rtpCells': len(r['cells']), 'upstream': r['sheets'], 'credited': name in ok,
                     'pass': not r['cells'] or name in ok})
    return rows


def require_credit(path) -> None:
    """Call from a bake script after writing a sheet. Raises SystemExit when RTP pixels lack the credit."""
    row = check([Path(path)])[0]
    if not row['pass']:
        raise SystemExit(f"RTP attribution missing: {row['sheet']} has {row['rtpCells']} cells of EasyRPG RTP pixels "
                         f"({row['upstream']}). Add it to the rtp-derived-sheets block in public/assets/ATTRIBUTION.md "
                         f"with the CC BY 4.0 credit.")
    if row['rtpCells']:
        print(f"RTP attribution ok: {row['sheet']} {row['rtpCells']} RTP cells, credited")


def main(argv: list[str]) -> int:
    as_json = '--json' in argv
    paths = [Path(a) for a in argv if not a.startswith('--')] or bundled_sheets()
    rows = check(paths)
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
    else:
        for r in rows:
            if r['rtpCells'] or not r['pass']:
                print(f"{'PASS' if r['pass'] else 'FAIL'} {r['sheet']}: {r['rtpCells']} RTP cells {r['upstream']} "
                      f"{'credited' if r['credited'] else 'NOT credited'}")
        print(f"{sum(r['pass'] for r in rows)}/{len(rows)} sheets pass")
    return 0 if all(r['pass'] for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
