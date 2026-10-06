"""Explicit native coordinate/string corrections to three existing poses.

Each ink character below was selected for its actual destination. Dots in the
crown overlay leave the existing crown pixel alone. No pose transforms, geometry
masks, automatic shading, hole fills or cross-frame patch copying.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(folder, name):
    return [list(r) for r in (ROOT / folder / (name + '.pxgrid')).read_text().splitlines()]


def put(rows, x, y, pixels):
    rows[y][x:x + len(pixels)] = list(pixels)


def overlay(rows, x, y, pixels):
    for dx, c in enumerate(pixels):
        if c != '.':
            rows[y][x + dx] = c


def save(folder, name, rows):
    (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(r) for r in rows) + '\n')


def main():
    hit = read('poses', 'hit')
    # Broad projecting front tier: separate stepped tips and upper-left needle
    # ridges, full G base planes, V/U undersides. The old left tiers remain.
    crown = [
        (55, 12, '...................KK'),
        (55, 13, '.................KKJJK'),
        (55, 14, '...............KKGJNJK'),
        (55, 15, '.............KKVGJJGVK'),
        (55, 16, '...........KKVGJJGGVUK'),
        (55, 17, '.........KKVGJJGGGVVUK'),
        (55, 18, '.......KKVGJJGGGGVVUUK.........KK'),
        (55, 19, '.....KKVGJJGGGGVVVUUVK.......KKJJK'),
        (55, 20, '...KKVGJJGGGGVVVUUVGJJK....KKJJNJK'),
        (55, 21, '.KKVGJJGGGGVVVUUVGJJGVK..KKJJJGGVK'),
        (54, 22, 'KVGJJGGGGVVVUUVGJJGGGVKKKJJGGGGVUK'),
        (54, 23, 'VGJJGGGVVVUUVGJJGGGGGVUGJJGGGGVVUK'),
        (54, 24, 'GJJGGVVVUUVGJJGGGGVVUUVGJJGGGVVVUKK'),
        (53, 25, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUGVK'),
        (52, 26, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUUGJJK'),
        (51, 27, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUUGJGVK'),
        (50, 28, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUVGGGVUK'),
        (49, 29, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUVGGGVVUK'),
        (48, 30, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUVGGGVVUUK'),
        (47, 31, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUVGGVVUUKK'),
        (46, 32, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUVGVVUUKK'),
        (45, 33, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUVVUUKKK'),
        (44, 34, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUUUKKK'),
        (43, 35, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVVUUUKKK'),
        (42, 36, 'GJJGGVVUUVGJJGGGGVVUUVGJJGGGVVUUKKK'),
        (41, 37, 'GJJGGVVUUVGJJGGGGVVUUVGJGVVUUKKK'),
        (40, 38, 'GJJGGVVUUVGJJGGGGVVUUVGVVUUKKK'),
        (39, 39, 'GJJGGVVUUVGGGGVVVUUVVUUKKK'),
        (38, 40, 'GVVVUUVGGGGVVVUUUUUKKK'),
        (37, 41, 'VVUUUVGGGVVVUUUKKK'),
    ]
    for x, y, pixels in crown:
        overlay(hit, x, y, pixels)

    # Break the long diagonal fronts into broad irregular needle fans. These
    # ridges are selected separately instead of a repeated-width edge stripe.
    needle_planes = [
        (55, 22, 'GJJGGGGGGGGVVVUUVGJ'),
        (54, 23, 'VGJJGGGGGGGVVVUUVGJJ'),
        (53, 24, 'GJJGGGGGVVVVVUUUVGJJGGG'),
        (52, 25, 'GJGGGGGVVVVUUUVGJJJGGGG'),
        (51, 26, 'GGGGVVVVUUVGJJJGGGGGGVV'),
        (50, 27, 'GGVVVUUUVGJJGGGGGGGVVVV'),
        (49, 28, 'VVVUUUVGJJGGGGGGVVVVUU'),
        (48, 29, 'VUUUVGJJGGGGGGVVVVUUUVG'),
        (47, 30, 'UUVGJJGGGGGGVVVVUUUVGJJ'),
        (46, 31, 'VGJJGGGGGVVVVUUUVGJJGG'),
        (45, 32, 'GJJGGGVVVVUUUVGJJGGGGG'),
        (44, 33, 'GGGVVVVUUUVGJJGGGGGGVV'),
        (43, 34, 'VVVVUUUVGJJGGGGGGVVVUU'),
        (42, 35, 'VUUUVGJJGGGGGGVVVVUUU'),
    ]
    for x, y, pixels in needle_planes:
        put(hit, x, y, pixels)

    # Recoil trunk: a thick bent trunk, a dark cleft and angular split-ridge
    # planes. The folded striking arm remains to the right of the trunk.
    trunk = [
        (38, 72, 'KSLHHLLLBBSSDDBBBSSDDDDDDDDDDDK'),
        (37, 73, 'KSLHHLLLBBSSDDBLLBBSSDDDDDDDDDDK'),
        (36, 74, 'KSLHHLLLBBSSDDBLLLBBSSDDDDDDDDDDK'),
        (35, 75, 'KSLHHLLLBBSSDDDBLLLBBSSDDDDDDDDDDK'),
        (34, 76, 'KSLHHLLLBBSSDDDBLLLLBBSSDDDDDDDDDK'),
        (33, 77, 'KSLHHLLLBBSSDDDBLLLLLBBSSDDDDDDDDK'),
        (32, 78, 'KSLHHLLLBBSSDDDDBLLLLBBSSDDDDDDDDK'),
        (32, 79, 'KSLHHLLLLBBSSDDDBLLLBBSSDDDDDDDDK'),
        (32, 80, 'KSLHHLLLLBBSSDDDDDBBSSDDDDDDDDK'),
        (32, 81, 'KSLHHHLLLLBBSSDDDDDBSSDDDDDDDK'),
        (32, 82, 'KSLHHHLLLLBBSSDDDDDDSSDDDDDDK'),
        (32, 83, 'KSLHHHLLLLBBSSDDDDDDDDDDDDDDK'),
        (32, 84, 'KSLHHHHLLLBBSSDDDDBBBSSDDDDDK'),
        (33, 85, 'KSLHHHLLLLBBSSDDDBLLBBSSDDDDK'),
        (34, 86, 'KSLHHHLLLLBBSSDDDBLLLBBSSDDDK'),
        (35, 87, 'KSLHHHLLLLBBSSDDDBLLLLBBSSDDK'),
        (35, 88, 'KSLHHHLLLLBBSSDDDDBLLLLBBSSDDDK'),
        (36, 89, 'KSLHHLLLLLBBSSDDDDBLLLLBBSSDDDDK'),
        (36, 90, 'KSLHHLLLLBBSSDDDDDBLLLBBSSDDDDDDK'),
        (37, 91, 'KSLHHLLLLBBSSDDDDDBLLBBSSDDDDDDK'),
        (37, 92, 'KSLHHLLLLBBSSDDDDDBBBBSSDDDDDDDK'),
        (38, 93, 'KSLHHLLLLBBSSDDDDDBBBSSDDDDDDDDK'),
        (38, 94, 'KSLHHLLLLBBSSDDDDDBBBSSDDDDDDDDDK'),
        (38, 95, 'KSLHHLLLLBBSSDDDDDDBBBSSDDDDDDDDK'),
        (38, 96, 'KSLHHLLLLBBSSDDDDDDBLLBBSSDDDDDDDK'),
        (38, 97, 'KSLHHLLLLBBSSDDDDDDBLLLBBSSDDDDDDDK'),
        (38, 98, 'KSLHHLLLLBBSSDDDDDDBLLLLBBSSDDDDDDDK'),
        (38, 99, 'KSLHHLLLLBBSSDDDDDDBLLLLLBBSSDDDDDDK'),
    ]
    for x, y, pixels in trunk:
        put(hit, x, y, pixels)
    save('poses', 'hit', hit)

    # The two resting faces receive independently selected strings. These are
    # carved bark planes under the same crown, not a replacement body or a tint.
    sleep_a = read('actions', 'sleep_a')
    a_bark = [
        (50, 60, 'LHHLBBSSDDD'),
        (50, 61, 'LHHLLBSSDDD'),
        (50, 62, 'LHLLBBSDDDB'),
        (50, 63, 'LHLLBSDDDBB'),
        (50, 64, 'LLLBSDDDBLL'),
        (50, 65, 'LLBSDDDBLLB'),
        (50, 66, 'LBBSDDDBLBB'),
        (50, 67, 'BBSSDDDBBBB'),
        (50, 68, 'BBSSDDDDBBB'),
        (50, 69, 'LBSSDDDDDBB'),
        (50, 70, 'LBBSSDDDDDB'),
        (50, 71, 'LLBSSDDDDDD'),
        (50, 72, 'HLBBSDDDDDD'),
        (50, 73, 'HLLBBSDDDDD'),
        (50, 74, 'HLLBBSDDDDD'),
        (50, 75, 'HLLBBSSDDDD'),
        (50, 76, 'LLLBBSSDDDD'),
        (50, 77, 'LLBBSSDDDDD'),
        (50, 78, 'LBBSSDDDDDD'),
        (50, 79, 'LBSSDDDDDDD'),
        (50, 80, 'LBSSDDDDDBB'),
        (50, 81, 'LBBSDDDDBLL'),
        (50, 82, 'HLBSDDDBLLL'),
        (50, 83, 'HLBSDDDBLLB'),
        (50, 84, 'HLBBSDDBLBB'),
        (50, 85, 'HLLBSDDBBBB'),
        (50, 86, 'HLLBSDDDBBB'),
        (50, 87, 'HLLBBSDDDBB'),
        (50, 88, 'HLLBBSSDDDB'),
        (50, 89, 'HLLLBBSSDDD'),
        (50, 90, 'LLLLBBSSDDD'),
        (50, 91, 'LLLBBSSDDDD'),
        (50, 92, 'LLBBSSDDDDB'),
        (50, 93, 'LLBBSSDDDBL'),
        (50, 94, 'LLLBBSSDBLL'),
        (50, 95, 'HLLLBBSSBLL'),
        (50, 96, 'HLLLBBSSBLL'),
        (50, 97, 'HHLLBBSSDBL'),
        (50, 98, 'HHLLLBSSDBB'),
    ]
    for x, y, pixels in a_bark:
        put(sleep_a, x, y, pixels)
    save('actions', 'sleep_a', sleep_a)

    sleep_b = read('actions', 'sleep_b')
    b_bark = [
        (51, 60, 'LHHLBBSSDD'),
        (51, 61, 'LHHLLBSSDD'),
        (51, 62, 'LHLLBBSDDD'),
        (50, 63, 'HLLLBBSDDDB'),
        (50, 64, 'HLLLBSDDDBB'),
        (50, 65, 'HLLBSDDDBLL'),
        (50, 66, 'LLBBSDDDBLB'),
        (50, 67, 'LBBSSDDDBBB'),
        (50, 68, 'LBBSSDDDBBB'),
        (50, 69, 'LLBSSDDDDBB'),
        (50, 70, 'LLBBSSDDDDD'),
        (50, 71, 'HLLBSSDDDDD'),
        (50, 72, 'HLLBBSDDDDD'),
        (50, 73, 'HHLLBBSDDDD'),
        (50, 74, 'HHLLBBSDDDD'),
        (50, 75, 'HLLLBBSSDDD'),
        (50, 76, 'LLLLBBSSDDD'),
        (50, 77, 'LLLBBSSDDDD'),
        (50, 78, 'LLBBSSDDDDD'),
        (50, 79, 'LBBSSDDDDDD'),
        (50, 80, 'LBSSDDDDDDD'),
        (50, 81, 'LBSSDDDDBBB'),
        (50, 82, 'LBBSDDDBLLL'),
        (50, 83, 'HLBSDDDBLLL'),
        (50, 84, 'HLBSDDDBLLB'),
        (50, 85, 'HLBBSDDBLBB'),
        (50, 86, 'HLLBSDDBBBB'),
        (50, 87, 'HLLBSDDDBBB'),
        (50, 88, 'HLLBBSDDDBB'),
        (50, 89, 'HLLBBSSDDDB'),
        (50, 90, 'HLLLBBSSDDD'),
        (50, 91, 'LLLLBBSSDDD'),
        (50, 92, 'LLLBBSSDDDD'),
        (50, 93, 'LLBBSSDDDDB'),
        (50, 94, 'LLLBBSSDBLL'),
        (50, 95, 'HLLLBBSSBLL'),
        (50, 96, 'HLLLBBSSBLL'),
        (50, 97, 'HHLLBBSSDBL'),
        (50, 98, 'HHLLLBSSDBB'),
    ]
    for x, y, pixels in b_bark:
        put(sleep_b, x, y, pixels)
    save('actions', 'sleep_b', sleep_b)


if __name__ == '__main__':
    main()
