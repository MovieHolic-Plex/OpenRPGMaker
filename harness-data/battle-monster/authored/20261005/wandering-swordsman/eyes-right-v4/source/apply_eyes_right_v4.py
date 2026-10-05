"""Apply the supplied literal eye runs using zero-based native coordinates."""

from pathlib import Path


PATCHES = {
    "poses/idle_a.pxgrid": [(29, 20, "uppuupp"), (29, 22, "uekuuek"), (30, 23, "ukuuwk")],
    "poses/idle_b.pxgrid": [(29, 20, "uppuupp"), (29, 22, "uekuuek"), (30, 23, "ukuuwk")],
    "poses/idle_c.pxgrid": [(29, 20, "uppuupp"), (29, 22, "uekuuek"), (30, 23, "ukuuwk")],
    "poses/windup.pxgrid": [(28, 22, "uppuupp"), (28, 24, "uekuuek"), (29, 25, "ukuuwk")],
    "poses/move.pxgrid": [(31, 20, "uppuupp"), (31, 22, "uekuuek"), (32, 23, "ukuuwk")],
    "poses/attack.pxgrid": [(26, 24, "uppuupp"), (26, 26, "uekuuek"), (27, 27, "ukuuwk")],
    "poses/recover.pxgrid": [(28, 21, "uppuupp"), (28, 23, "uekuuek"), (29, 24, "ukuuwk")],
    "poses/hit.pxgrid": [(24, 21, "uutpupt"), (24, 23, "uekuuek"), (25, 24, "ukuuwk")],
    "poses/dead.pxgrid": [(25, 45, "ueeuuee")],
    "actions/skill_a.pxgrid": [(30, 22, "uppuupp"), (30, 24, "uekuuek"), (31, 25, "ukuuwk")],
    "actions/skill_b.pxgrid": [(30, 22, "uppuupp"), (30, 24, "uekuuek"), (31, 25, "ukuuwk")],
    "actions/skill_c.pxgrid": [(28, 21, "uppuupp"), (28, 23, "uekuuek"), (29, 24, "ukuuwk")],
    "actions/poison_a.pxgrid": [(28, 23, "uutpupt"), (28, 25, "uekuuek"), (29, 26, "ukuuwk")],
    "actions/poison_b.pxgrid": [(26, 24, "uutpupt"), (26, 26, "uekuuek"), (27, 27, "ukuuwk")],
    "actions/stun_a.pxgrid": [(28, 22, "uppuupp"), (28, 24, "uekuuek"), (29, 25, "ukuuuk")],
    "actions/stun_b.pxgrid": [(29, 23, "uppuupp"), (29, 25, "uekuuek"), (30, 26, "ukuuuk")],
    "actions/sleep_a.pxgrid": [(28, 24, "uppuupp"), (28, 26, "ueeuuee")],
    "actions/sleep_b.pxgrid": [(28, 24, "uppuupp"), (28, 26, "ueeuuee")],
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
