"""Tiny layered row-string pixel compositor for hand-authored portraits.

Every pixel is authored by hand as a letter in a row string. A part is a
block of row strings placed at an offset; each letter maps to a colour in
that part's palette ('.' = nothing). After stacking, each part may get a
1px outline on its own edge pixels where they touch empty space or a part
drawn earlier (lower) that is not in the same group — the same rule the
walking chips follow (dark rim on the shape's own side).
"""
from PIL import Image

W, H = 44, 46


def hexc(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


class Part:
    def __init__(self, rows, off, pal, outline=None, group=None, name=''):
        self.rows = rows
        self.off = off
        self.pal = {k: hexc(v) for k, v in pal.items()}
        self.outline = hexc(outline) if outline else None
        self.group = group
        self.name = name


def compose(parts, w=W, h=H):
    col = [[None] * w for _ in range(h)]
    own = [[-1] * w for _ in range(h)]
    for i, p in enumerate(parts):
        ox, oy = p.off
        for dy, row in enumerate(p.rows):
            for dx, ch in enumerate(row):
                if ch == '.' or ch == ' ':
                    continue
                x, y = ox + dx, oy + dy
                if not (0 <= x < w and 0 <= y < h):
                    continue
                if ch not in p.pal:
                    raise KeyError(f'{p.name}: letter {ch!r} at {dx},{dy} not in palette')
                col[y][x] = p.pal[ch]
                own[y][x] = i
    # cast shadow: a part with .cast = (groups, colour) darkens its pixels sitting right under those groups
    for y in range(1, h):
        for x in range(w):
            i = own[y][x]
            if i < 0 or not getattr(parts[i], 'cast', None):
                continue
            j = own[y - 1][x]
            groups, shade = parts[i].cast
            if j >= 0 and parts[j].group in groups:
                col[y][x] = hexc(shade) if isinstance(shade, str) else shade
    # outline pass
    out = [r[:] for r in col]
    for y in range(h):
        for x in range(w):
            i = own[y][x]
            if i < 0:
                continue
            p = parts[i]
            if p.outline is None:
                continue
            edge = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h):
                    continue  # canvas edge = cut, no rim
                j = own[ny][nx]
                if j < 0:
                    edge = True
                    break
                if j < i:
                    q = parts[j]
                    if q.group is not None and q.group == p.group:
                        continue
                    if q.outline is None:
                        continue  # never rim against detail layers
                    edge = True
                    break
            if edge:
                out[y][x] = p.outline
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            if out[y][x]:
                img.putpixel((x, y), out[y][x])
    return img


def check_rows(name, rows, width=None):
    for i, r in enumerate(rows):
        if width is not None and len(r) != width:
            raise ValueError(f'{name} row {i} has len {len(r)} != {width}: {r!r}')


def pad(rows, width):
    """Right-pad hand rows with '.' to width; longer rows are an authoring error."""
    out = []
    for i, r in enumerate(rows):
        if len(r) > width:
            raise ValueError(f'row {i} too long ({len(r)} > {width}): {r!r}')
        out.append(r + '.' * (width - len(r)))
    return out
