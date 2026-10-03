"""Joint-level source coordinate rigs for four hand-pixel battle studies.

Transforms apply to authored vertices/pixel clusters before rasterization. Never
read, rotate, resize, or translate a completed sprite. Fallen poses are separately
painted by the species sources. idle_a is the exact approved source geometry.
"""
import math

POSES = ('idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead')


def turn(x, y, pivot, dx=0, dy=0, angle=0):
    a = math.radians(angle)
    u, v = x - pivot[0], y - pivot[1]
    return pivot[0] + u * math.cos(a) - v * math.sin(a) + dx, \
        pivot[1] + u * math.sin(a) + v * math.cos(a) + dy


def clamp(x):
    return min(1, max(0, x))


BODY = {
    'wolf-grey': {'idle_b': (0, 1), 'idle_c': (0, 0), 'windup': (-2, 3),
                  'move': (-1, -2), 'attack': (-2, -1), 'recover': (-1, 1), 'hit': (-2, 2)},
    'kappa-01': {'idle_b': (0, 1), 'idle_c': (0, 0), 'windup': (-2, 3),
                 'move': (0, -1), 'attack': (-2, 2), 'recover': (-1, 1), 'hit': (-2, 3)},
    'skeleton-knight': {'idle_b': (0, 1), 'idle_c': (0, 0), 'windup': (-1, 3),
                        'move': (0, -2), 'attack': (-2, 0), 'recover': (-1, 1), 'hit': (-2, 3)},
    'bat-cave': {'idle_b': (0, 1), 'idle_c': (0, -1), 'windup': (0, -2),
                 'move': (-1, -2), 'attack': (-1, 6), 'recover': (0, 2), 'hit': (-3, 4)},
}

HEAD = {
    'wolf-grey': {'idle_b': (0, 1, 0), 'idle_c': (-1, -1, 3), 'windup': (-5, 5, -8),
                  'move': (-1, -3, -5), 'attack': (0, 5, 8), 'recover': (-1, 2, 3), 'hit': (-5, 4, -12)},
    'kappa-01': {'idle_b': (0, 1, 0), 'idle_c': (-1, 0, 2), 'windup': (-4, 4, -6),
                 'move': (0, -1, 3), 'attack': (-1, 2, 4), 'recover': (-1, 1, 0), 'hit': (-5, 4, -10)},
    'skeleton-knight': {'idle_b': (0, 1, 0), 'idle_c': (-1, 0, -3), 'windup': (-2, 3, -5),
                        'move': (0, -2, 4), 'attack': (-2, 0, 5), 'recover': (-1, 1, 3), 'hit': (-5, 4, -12)},
    'bat-cave': {'idle_b': (0, 1, 0), 'idle_c': (0, -1, -3), 'windup': (-1, -2, -8),
                 'move': (0, -1, 8), 'attack': (0, 6, 12), 'recover': (0, 2, 3), 'hit': (-4, 5, -14)},
}

FEET = {
    'wolf-grey': {
        'windup': {'hind_leg': (1, 0), 'front_leg': (-4, 0)},
        'move': {'hind_leg': (-5, -4), 'front_leg': (7, -5), 'far_hind': (4, -2), 'far_front': (-4, -1)},
        'attack': {'hind_leg': (2, 0), 'front_leg': (8, -4), 'far_hind': (-2, 0), 'far_front': (5, -3)},
        'recover': {'hind_leg': (0, 0), 'front_leg': (3, 0)},
        'hit': {'hind_leg': (2, 0), 'front_leg': (-3, 0)},
    },
    'kappa-01': {
        'windup': {'far_leg': (2, 0), 'front_leg': (-3, 0)},
        'move': {'far_leg': (-3, -2), 'front_leg': (6, -3)},
        'attack': {'far_leg': (-2, 0), 'front_leg': (6, 0)},
        'recover': {'front_leg': (2, 0)},
        'hit': {'far_leg': (-1, 0), 'front_leg': (3, 0)},
    },
    'skeleton-knight': {
        'windup': {'far_leg': (1, 0), 'front_leg': (-2, 0)},
        'move': {'far_leg': (-5, -2), 'front_leg': (7, -3)},
        'attack': {'far_leg': (-2, 0), 'front_leg': (8, 0)},
        'recover': {'front_leg': (3, 0)},
        'hit': {'far_leg': (1, 0), 'front_leg': (-3, 0)},
    },
}

WEAPON = {
    'idle_b': (0, 1, 2), 'idle_c': (-1, 0, -3), 'windup': (-6, 4, -22),
    'move': (-1, -2, -4), 'attack': (-17, 3, 75), 'recover': (-14, 2, 45), 'hit': (-8, 5, -14),
}


def deform(species, pose, part, x, y):
    assert pose in POSES
    if pose in ('idle_a', 'dead'):
        return x, y
    dx, dy = BODY[species][pose]
    head_pivot = {'wolf-grey': (48, 23), 'kappa-01': (40, 21),
                  'skeleton-knight': (36, 22), 'bat-cave': (38, 26)}[species]
    if part in ('head', 'jaw'):
        if part == 'jaw' and species == 'wolf-grey':
            amount = {'windup': .55, 'attack': 1.8, 'hit': .5}.get(pose, 1)
            y = 27 + (y - 27) * amount
        return tuple(round(v) for v in turn(x, y, head_pivot, *HEAD[species][pose]))
    if part == 'neck' and species == 'wolf-grey':
        # Ruff bridges the moving head and fixed shoulder without a detached gap.
        w = clamp((34 - y) / 16)
        hx, hy = turn(x, y, head_pivot, *HEAD[species][pose])
        return round((x + dx) * (1 - w) + hx * w), round((y + dy) * (1 - w) + hy * w)
    if part in ('far_leg', 'hind_leg', 'front_leg', 'far_hind', 'far_front'):
        top = {'wolf-grey': 34, 'kappa-01': 43, 'skeleton-knight': 43}[species]
        w = clamp((y - top) / (60 - top))
        fx, fy = FEET[species].get(pose, {}).get(part, (0, 0))
        return round(x + dx * (1 - w) + fx * w), round(y + dy * (1 - w) + fy * w)
    if species == 'wolf-grey' and part == 'tail':
        w = clamp((18 - x) / 15)
        bend = {'idle_b': -2, 'idle_c': 2, 'windup': 3, 'move': -4,
                'attack': -3, 'recover': 1, 'hit': -5}[pose]
        return round(x + dx), round(y + dy + w * bend)
    if species == 'kappa-01' and part in ('near_arm', 'far_arm'):
        mx, my = {
            'idle_b': (0, 1), 'idle_c': (-1, -1), 'windup': (-7, -3),
            'move': (-2, -4), 'attack': (0, -10), 'recover': (-1, -6), 'hit': (-8, -7),
        }[pose]
        if part == 'far_arm':
            mx, my = -mx // 2, -my // 3
            # This hand already reaches x61 in the source grid.
            mx = min(0, mx)
        reach = 13 if pose == 'attack' and part == 'near_arm' else (22 if part == 'near_arm' else 8)
        w = clamp((y - 30) / reach)
        return round(x + dx * (1 - w) + mx * w), round(y + dy * (1 - w) + my * w)
    if species == 'skeleton-knight' and part in ('weapon', 'sword_arm'):
        wx, wy = turn(x, y, (52, 29), *WEAPON[pose])
        if part == 'sword_arm':
            w = clamp((x - 41) / 11)
            return round((x + dx) * (1 - w) + wx * w), round((y + dy) * (1 - w) + wy * w)
        return round(wx), round(wy)
    if species == 'skeleton-knight' and part in ('shield', 'shield_arm'):
        mx, my, angle = {'idle_b': (0, 1, 0), 'idle_c': (0, 0, 2), 'windup': (-1, -2, -5),
                         'move': (1, -1, 4), 'attack': (-2, -3, -7), 'recover': (-1, -1, -3),
                         'hit': (-2, -7, -12)}[pose]
        sx, sy = turn(x, y, (26, 31), mx, my, angle)
        if part == 'shield_arm':
            w = clamp((33 - x) / 8)
            return round((x + dx) * (1 - w) + sx * w), round((y + dy) * (1 - w) + sy * w)
        return round(sx), round(sy)
    if species == 'bat-cave':
        if part in ('near_wing', 'far_wing'):
            near = part == 'near_wing'
            rootx, rooty = (32, 30) if near else (38, 30)
            sx, sy, tipdy = {
                'idle_b': (.9, .90, 8), 'idle_c': (.98, .86, 3), 'windup': (.72, 1.0, 0),
                'move': (.60, .83, 4), 'attack': (1, .78, 10), 'recover': (.83, .90, 3),
                'hit': (.68, .75, 12 if near else 4),
            }[pose]
            w = clamp(abs(x - rootx) / (29 if near else 23))
            return round(rootx + (x - rootx) * sx + dx), round(rooty + (y - rooty) * sy + tipdy * w + dy)
        if part == 'tail':
            sy = .65 if pose in ('attack', 'hit') else 1
            return round(x + dx), round(43 + (y - 43) * sy + dy)
    return round(x + dx), round(y + dy)
