"""Apply the supplied literal eye runs at zero-based native pixel coordinates."""

from pathlib import Path


# Each tuple is (x, y, literal palette-index ink).
PATCHES = {
    "poses/idle_a.pxgrid": [(28, 20, "uppuupp"), (28, 22, "uekuuek"), (29, 23, "ukuuwk")],
    "poses/idle_b.pxgrid": [(28, 20, "uppuupp"), (28, 22, "uekuuek"), (29, 23, "ukuuwk")],
    "poses/idle_c.pxgrid": [(28, 20, "uppuupp"), (28, 22, "uekuuek"), (29, 23, "ukuuwk")],
    "poses/windup.pxgrid": [(27, 22, "uppuupp"), (27, 24, "uekuuek"), (28, 25, "ukuuwk")],
    "poses/move.pxgrid": [(30, 20, "uppuupp"), (30, 22, "uekuuek"), (31, 23, "ukuuwk")],
    "poses/attack.pxgrid": [(25, 24, "uppuupp"), (25, 26, "uekuuek"), (26, 27, "ukuuwk")],
    "poses/recover.pxgrid": [(27, 21, "uppuupp"), (27, 23, "uekuuek"), (28, 24, "ukuuwk")],
    "poses/hit.pxgrid": [(23, 21, "uutpupt"), (23, 23, "uekuuek"), (24, 24, "ukuuwk")],
    "poses/dead.pxgrid": [(24, 45, "ueeuuee")],
    "actions/skill_a.pxgrid": [(29, 22, "uppuupp"), (29, 24, "uekuuek"), (30, 25, "ukuuwk")],
    "actions/skill_b.pxgrid": [(29, 22, "uppuupp"), (29, 24, "uekuuek"), (30, 25, "ukuuwk")],
    "actions/skill_c.pxgrid": [(27, 21, "uppuupp"), (27, 23, "uekuuek"), (28, 24, "ukuuwk")],
    "actions/poison_a.pxgrid": [(27, 23, "uutpupt"), (27, 25, "uekuuek"), (28, 26, "ukuuwk")],
    "actions/poison_b.pxgrid": [(25, 24, "uutpupt"), (25, 26, "uekuuek"), (26, 27, "ukuuwk")],
    "actions/stun_a.pxgrid": [(27, 22, "uppuupp"), (27, 24, "uekuuek"), (28, 25, "ukuuuk")],
    "actions/stun_b.pxgrid": [(28, 23, "uppuupp"), (28, 25, "uekuuek"), (29, 26, "ukuuuk")],
    "actions/sleep_a.pxgrid": [(27, 24, "uppuupp"), (27, 26, "ueeuuee")],
    "actions/sleep_b.pxgrid": [(27, 24, "uppuupp"), (27, 26, "ueeuuee")],
}


def apply():
    source = Path(__file__).resolve().parent
    for relative_path, runs in PATCHES.items():
        path = source / relative_path
        rows = path.read_bytes().splitlines(keepends=True)
        for x, y, literal_ink in runs:
            ink = literal_ink.encode("ascii")
            rows[y] = rows[y][:x] + ink + rows[y][x + len(ink):]
        path.write_bytes(b"".join(rows))


if __name__ == "__main__":
    apply()
