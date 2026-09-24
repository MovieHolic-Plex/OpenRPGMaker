# Rebuild a Rasak creator preview (a 48px RPG Maker MZ screenshot) as an OPRN
# map on a baked atlas. Only atlas cells are placed; preview pixels are never
# copied into tiles. Scores count RGB-exact pixels over the whole preview.
#   python3 scripts/content/rasak/reconstruct_preview.py --baked ~/third-party-assets/rasak/baked/rasak_field \
#       --preview ~/third-party-assets/rasak/previews/p01.png --id rasak_preview_p01 --name "일본 정원" \
#       --out ~/third-party-assets/rasak/maps
# Per cell: one opaque base, then up to --layers transparent tiles chosen greedily.
# Stack order is always A-layers < shadow < B..E, matching MZ draw order, so the
# map's lower stack holds A tiles + shadow and the upper stack holds B..E tiles.
import argparse, json, os
from pathlib import Path
import numpy as np
from PIL import Image

T = 48
RANK = {'A1': 0, 'A2': 0, 'A3': 0, 'A4': 0, 'A5': 0, 'shadow': 1, 'B': 2, 'C': 2, 'D': 2, 'E': 2}


def rank(slot):
    # X1.. are extra object sheets past MZ's four; they draw with B..E.
    return 2 if slot.startswith('X') else RANK[slot]


def load_atlas(baked):
    manifest = json.loads((baked / 'manifest.json').read_text())
    img = np.array(Image.open(baked / 'atlas.png').convert('RGBA'))
    cols = manifest['tilesPerRow']
    n = manifest['count']
    tiles = np.stack([img[(i // cols) * T:(i // cols + 1) * T, (i % cols) * T:(i % cols + 1) * T] for i in range(n)])
    return manifest, tiles


def composite(stack, rgb, alpha):
    out = rgb[stack[0]].astype(np.int32)
    for t in stack[1:]:
        a = alpha[t][:, None]
        out = (rgb[t] * a + out * (255 - a) + 127) // 255
    return out


def pack(c):
    return c[..., 0] * 65536 + c[..., 1] * 256 + c[..., 2]


def detect_phase(src, opaque_hash):
    best = (-1, 0, 0)
    for py in range(0, T, 1):
        for px in range(0, T, 1):
            n = 0
            for y in range(py, src.shape[0] - T + 1, T * 3):
                for x in range(px, src.shape[1] - T + 1, T * 3):
                    n += src[y:y + T, x:x + T].tobytes() in opaque_hash
            if n > best[0]:
                best = (n, px, py)
    return best[1], best[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baked', required=True)
    ap.add_argument('--preview', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--name', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--phase', help='px,py grid origin inside the preview; auto-detected when omitted')
    ap.add_argument('--layers', type=int, default=4)
    ap.add_argument('--topk', type=int, default=24)
    ap.add_argument('--beam', type=int, default=4)
    ap.add_argument('--exact-enough', type=float, default=0.93,
                    help='cells whose exact match is below this ratio try the nearest-object fallback')
    ap.add_argument('--min-error-drop', type=float, default=0.3)
    ap.add_argument('--max-object-mae', type=float, default=28)
    ap.add_argument('--ground-margin', type=float, default=0.8,
                    help='reset a cell to neighbouring ground when that alone has under this share of its error')
    ap.add_argument('--substitutions', default=str(Path(__file__).resolve().parents[3] / 'tiledata/rasak-fantasy/substitutions.json'))
    args = ap.parse_args()
    baked = Path(os.path.expanduser(args.baked))
    manifest, tiles = load_atlas(baked)
    entries = manifest['entries']
    rgb = tiles[:, :, :, :3].reshape(len(tiles), -1, 3).astype(np.int32)
    alpha = tiles[:, :, :, 3].reshape(len(tiles), -1).astype(np.int32)
    slot = [e['slot'] if e and not e.get('empty') else None for e in entries]
    usable = np.array([s is not None for s in slot])
    opaque = np.where(usable & (alpha == 255).all(1))[0]
    trans = np.where(usable & ~(alpha == 255).all(1))[0]
    shadows = np.array([i for i in trans if slot[i] == 'shadow'])
    objects = np.array([i for i in trans if slot[i] != 'shadow'])
    packed = pack(rgb)
    fg = alpha == 255
    opaque_hash = {}
    for i in opaque:
        opaque_hash.setdefault(tiles[i, :, :, :3].tobytes(), int(i))

    src = np.array(Image.open(os.path.expanduser(args.preview)).convert('RGB'))
    sh, sw = src.shape[:2]
    px, py = map(int, args.phase.split(',')) if args.phase else detect_phase(src, opaque_hash)
    # Grid origin (px,py) is where a cell starts; cells that begin before it are clipped.
    ox, oy = (px % T) - T if px % T else 0, (py % T) - T if py % T else 0
    w, h = (sw - ox + T - 1) // T, (sh - oy + T - 1) // T
    cache, stacks, targets = {}, [], []
    for cy in range(h):
        for cx in range(w):
            sx, sy = ox + cx * T, oy + cy * T
            target = np.zeros((T, T, 3), np.uint8)
            valid = np.zeros((T, T), bool)
            ax, ay, bx, by = max(0, sx), max(0, sy), min(sw, sx + T), min(sh, sy + T)
            target[ay - sy:by - sy, ax - sx:bx - sx] = src[ay:by, ax:bx]
            valid[ay - sy:by - sy, ax - sx:bx - sx] = True
            key = target.tobytes() + valid.tobytes()
            if key not in cache:
                cache[key] = solve(target, valid, opaque_hash, opaque, objects, shadows, rgb, alpha, packed, fg, slot, args)
            stacks.append(list(cache[key]))
            targets.append((target.reshape(-1, 3).astype(np.int32), valid.ravel()))

    def err(n, stack):
        flat, v = targets[n]
        d = composite(stack, rgb, alpha) - flat
        return float(((d * d).sum(1) * v).sum())

    # Where the current pack cannot explain a cell (art redrawn since the screenshot), plain
    # neighbouring ground often reads closer than any fragment; take it only when it is.
    unresolved = []
    frozen = [list(st) for st in stacks]
    for n in range(w * h):
        cx, cy = n % w, n // w
        grounds = [frozen[(cy + dy) * w + cx + dx][0] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                   if (dx or dy) and 0 <= cx + dx < w and 0 <= cy + dy < h
                   and slot[frozen[(cy + dy) * w + cx + dx][0]] in ('A1', 'A2', 'A4', 'A5')]
        if not grounds:
            continue
        ground = max(set(grounds), key=grounds.count)
        if ground != stacks[n][0] and err(n, [ground]) < err(n, stacks[n]) * args.ground_margin:
            stacks[n] = [ground]
            unresolved.append(n)
    substituted = apply_substitutions(args, manifest, stacks, targets, w, h, rgb, alpha, slot)

    result = np.zeros((h * T, w * T, 3), np.uint8)
    for n, stack in enumerate(stacks):
        cx, cy = n % w, n // w
        result[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = composite(stack, rgb, alpha).reshape(T, T, 3)

    crop = result[-oy:-oy + sh, -ox:-ox + sw]
    same = (crop == src).all(2)
    absdiff = np.abs(crop.astype(np.int32) - src)
    near = absdiff.max(2) <= 3
    close = absdiff.max(2) <= 32
    out = Path(os.path.expanduser(args.out))
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(result).save(out / f'{args.id}.render.png')
    Image.fromarray(np.where(same[:, :, None], src // 3, np.array([255, 0, 100], np.uint8)).astype(np.uint8)).save(out / f'{args.id}.diff.png')

    strip_base = {s['baseTile']: s for s in manifest['animationStrips']}
    lower, upper, lower_st, upper_st = [], [], {}, {}
    for index, stack in enumerate(stacks):
        # Animated A1 cells are stored as the strip's first frame so the editor animates them.
        norm = [t - (entries[t].get('frame', 0) if entries[t].get('slot') == 'A1' and (t - entries[t].get('frame', 0)) in strip_base else 0) for t in stack]
        lo = [t for t in norm if rank(slot[t]) < 2]
        up = [t for t in norm if rank(slot[t]) == 2]
        if not lo:
            # Opaque B..E base (e.g. a roof cell): nothing is drawn under it anyway.
            lo, up = up[:1], up[1:]
        lower.append(lo[0])
        if lo[1:]:
            lower_st[index] = lo[1:]
        upper.append(up[0] if up else -1)
        if up[1:]:
            upper_st[index] = up[1:]
    game_map = {'id': args.id, 'name': args.name, 'width': w, 'height': h, 'tileSize': T,
                'tilesetId': manifest['bundle'], 'lowerTiles': lower, 'upperTiles': upper,
                'lowerTileStacks': {str(k): v for k, v in lower_st.items()},
                'upperTileStacks': {str(k): v for k, v in upper_st.items()}, 'events': []}
    score = {'id': args.id, 'preview': Path(args.preview).name, 'bundle': manifest['bundle'], 'phase': [px, py],
             'size': [w, h], 'uniqueCells': len(cache), 'exactPixelRatio': round(float(same.mean()), 6),
             'nearPixelRatio': round(float(near.mean()), 6),
             'closePixelRatio': round(float(close.mean()), 6),
             'meanAbsError': round(float(absdiff.mean()), 3),
             'unresolvedCells': len(unresolved), 'substitutions': substituted,
             'layerHistogram': np.bincount([len(s) for s in stacks]).tolist()}
    (out / f'{args.id}.map.json').write_text(json.dumps(game_map))
    (out / f'{args.id}.score.json').write_text(json.dumps(score, indent=1))
    print(json.dumps(score))


def solve(target, valid, opaque_hash, opaque, objects, shadows, rgb, alpha, packed, fg, slot, args):
    if valid.all() and target.tobytes() in opaque_hash:
        return [opaque_hash[target.tobytes()]]
    flat = target.reshape(-1, 3).astype(np.int32)
    v = valid.ravel()
    tp = pack(flat)
    goal = int(v.sum())
    eq_obj = (packed[objects] == tp) & v
    fg_obj = fg[objects]

    def score(stack):
        return int(((pack(composite(stack, rgb, alpha)) == tp) & v).sum())

    def looks_alike(t):
        # An object may only be added where it resembles the target on the pixels it paints;
        # otherwise a few exact pixels buy a visibly wrong fragment.
        draw = fg[t] & v
        return draw.any() and np.abs(rgb[t][draw] - flat[draw]).mean() <= args.max_object_mae

    # Bases: best on all pixels, plus best on the pixels the strongest object leaves visible.
    base_scores = ((packed[opaque] == tp) & v).sum(1)
    bases = set(int(opaque[i]) for i in np.argsort(base_scores)[-args.beam:])
    top_obj = np.argsort((eq_obj & fg_obj).sum(1))[-args.beam:]
    eq_base = (packed[opaque] == tp) & v
    for o in top_obj:
        bases.add(int(opaque[((eq_base & ~fg_obj[o]).sum(1)).argmax()]))
    beams = sorted(((score([b]), [b]) for b in bases), reverse=True)[:args.beam * 2]
    best_s, best_stack = beams[0]
    for _ in range(args.layers):
        if best_s >= goal:
            break
        grown = []
        for s0, stack in beams:
            cur = pack(composite(stack, rgb, alpha)) == tp
            # Gain if the object were drawn on top: pixels it fixes minus pixels it breaks.
            gain = (eq_obj & fg_obj & ~cur).sum(1) - (~eq_obj & fg_obj & cur).sum(1)
            cand = list(objects[np.argsort(gain)[-args.topk:]]) + list(shadows)
            for t in cand:
                t = int(t)
                if t in stack or (slot[t] != 'shadow' and not looks_alike(t)):
                    continue
                trial = sorted(stack + [t], key=lambda i: rank(slot[i]))
                if trial[0] != stack[0]:
                    continue  # the opaque base stays at the bottom
                s = score(trial)
                if s > s0:
                    grown.append((s, trial))
        if not grown:
            break
        grown.sort(key=lambda g: -g[0])
        seen, beams = set(), []
        for s, st in grown:
            k = tuple(st)
            if k not in seen:
                seen.add(k)
                beams.append((s, st))
            if len(beams) >= args.beam:
                break
        if beams[0][0] > best_s:
            best_s, best_stack = beams[0]
    if best_s < goal * args.exact_enough:
        best_stack = refine_by_error(best_stack, flat, v, objects, rgb, alpha, fg, slot, args)
    return best_stack


def refine_by_error(stack, flat, v, objects, rgb, alpha, fg, slot, args):
    # Older gallery shots use art that the current pack redrew, so no exact tile exists.
    # Substitute at most one current object, and only one that itself looks like the
    # target where it draws; stacking unrelated fragments reads worse than leaving a gap.
    def err(st):
        d = composite(st, rgb, alpha) - flat
        return float(((d * d).sum(1) * v).sum())

    cur = err(stack)
    pix_now = ((composite(stack, rgb, alpha) - flat) ** 2).sum(1) * v
    obj_err = ((rgb[objects] - flat) ** 2).sum(2) * v
    gain = (np.where(fg[objects], pix_now - obj_err, 0)).sum(1)
    best = None
    for t in objects[np.argsort(gain)[-args.topk:]]:
        t = int(t)
        draw = fg[t] & v
        if t in stack or draw.sum() < 0.15 * v.sum():
            continue
        if np.abs(rgb[t][draw] - flat[draw]).mean() > args.max_object_mae:
            continue
        trial = sorted(stack + [t], key=lambda i: rank(slot[i]))
        if trial[0] != stack[0]:
            continue
        e = err(trial)
        if e < cur * (1 - args.min_error_drop) and (best is None or e < best[0]):
            best = (e, trial)
    return best[1] if best else stack


def apply_substitutions(args, manifest, stacks, targets, w, h, rgb, alpha, slot):
    # Whole-object stand-ins for objects the pack redrew: {"sheet", "rect":[tx,ty,w,h] in
    # sheet tiles, "near":[cx,cy]}. The object lands on the best cell offset within "search".
    path = Path(args.substitutions)
    if not path.exists():
        return []
    subs = json.loads(path.read_text()).get(args.id, [])
    sections = {s['file']: s for s in manifest['sections']}
    done = []
    for sub in subs:
        sec = sections[sub['sheet']]
        tx, ty, rw, rh = sub['rect']
        ids = [[sec['start'] + (x // 8) * 128 + y * 8 + x % 8 for x in range(tx, tx + rw)] for y in range(ty, ty + rh)]
        best = None
        r = sub.get('search', 0)
        for oy in range(sub['near'][1] - r, sub['near'][1] + r + 1):
            for ox in range(sub['near'][0] - r, sub['near'][0] + r + 1):
                e = 0.0
                for j in range(rh):
                    for i in range(rw):
                        if not (0 <= ox + i < w and 0 <= oy + j < h):
                            continue
                        n = (oy + j) * w + ox + i
                        flat, v = targets[n]
                        base = [t for t in stacks[n] if rank(slot[t]) < 2] or stacks[n][:1]
                        d = composite(base + [ids[j][i]], rgb, alpha) - flat
                        e += float(((d * d).sum(1) * v).sum())
                if best is None or e < best[0]:
                    best = (e, ox, oy)
        _, ox, oy = best
        for j in range(rh):
            for i in range(rw):
                t = ids[j][i]
                if manifest['entries'][t].get('empty') or not (0 <= ox + i < w and 0 <= oy + j < h):
                    continue
                n = (oy + j) * w + ox + i
                base = [s for s in stacks[n] if rank(slot[s]) < 2] or stacks[n][:1]
                tops = [s for s in stacks[n][len(base):]]
                flat, v = targets[n]
                solved = ((pack(composite(stacks[n], rgb, alpha)) == pack(flat)) & v).sum() >= 0.85 * v.sum()
                # A cell the pack already explains keeps its objects in front (a wall post
                # before a tree); elsewhere the stand-in replaces the near-miss objects.
                stacks[n] = base + [t] + tops if solved else base + [t]
        done.append({'sheet': sub['sheet'], 'rect': sub['rect'], 'at': [ox, oy], 'why': sub.get('why', '')})
    return done


if __name__ == '__main__':
    main()
