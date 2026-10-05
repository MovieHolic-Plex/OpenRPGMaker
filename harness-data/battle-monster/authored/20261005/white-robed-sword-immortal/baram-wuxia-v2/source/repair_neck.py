"""Apply only the two literal native pixels specified by QUALITY_REPAIR.md."""
from pathlib import Path

path = Path(__file__).resolve().parent / "poses" / "dead.pxgrid"
rows = path.read_bytes().splitlines(keepends=True)
for x, y, symbol in ((24, 50, b"P"), (25, 50, b"B")):
    if rows[y][x:x + 1] not in (b".", symbol):
        raise ValueError(f"Unexpected existing pixel at ({x}, {y})")
    rows[y] = rows[y][:x] + symbol + rows[y][x + 1:]
path.write_bytes(b"".join(rows))
