"""줄 A 시트 묶기 + 참고문서 자료 생성. 번들 배선 없음(tiledata/sky-steam/ 에만 쓴다).
  python3 sky_a_pack.py   -> tiledata/sky-steam/sheet-A.png · sheet-A.json(사전: 조각별 원점·칸 수·kind·통행·프레임) ·
                             example-A.json(구름 섬 연결 + 비공정 탑승 정답 배열) · example-A-ok.png / example-A-bad.png (정상/오류) · 검증 결과 출력
관문 통과한 조각(status=pass)만 시트에 들어간다. 통행(walk)은 조각 그림에서 자동 계산: 한 칸의 화소 45% 이상이 풀 윗면 색(또는 나무 판자 윗면)이면 걷는다."""
from __future__ import annotations
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
import sky_a_all  # noqa: F401
import registry as R
from palette import RAMPS

OUT = os.path.join(R.REPO, 'tiledata', 'sky-steam'); T = 16; COLS = 24


WALK = {'sky-a-bridge': [[i, 1] for i in range(5)], 'sky-a-whale-pier': [[i, 0] for i in range(5)], 'sky-a-harbor': [[i, 2] for i in range(6)]}   # 판자 윗면 줄(손으로 정함, 조각 그림의 윗면 줄과 같다)


def walk_mask(im, ramps):
    a = np.array(im); w, h = im.size[0] // T, im.size[1] // T; cols = {tuple(c) for r in ramps for c in RAMPS[r]}
    m = []
    for cy in range(h):
        for cx in range(w):
            blk = a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T]
            hit = sum(tuple(px[:3]) in cols for row in blk for px in row if px[3])
            if hit >= 0.45 * T * T: m.append([cx, cy])
    return m


def build():
    ps = [p for p in R.pieces_of('A') if R.status_of(p) == 'pass']
    cells = []                                         # (piece, frame, im)
    for p in ps:
        for f in range(p['frames']): cells.append((p, f, R.render(p, f)))
    x = y = rowh = 0; place = {}; pos = []
    for p, f, im in cells:                              # 선반 채우기(칸 단위)
        w, h = im.size[0] // T, im.size[1] // T
        if x + w > COLS: x = 0; y += rowh; rowh = 0
        pos.append((p, f, im, x, y)); place.setdefault(p['id'], []).append((x, y)); x += w; rowh = max(rowh, h)
    H = y + rowh; sheet = Image.new('RGBA', (COLS * T, H * T), (0, 0, 0, 0))
    for p, f, im, cx, cy in pos: sheet.paste(im, (cx * T, cy * T))
    sheet.save(os.path.join(OUT, 'sheet-A.png'))
    d = {'schema': 'sky-steam/sheet/1', 'line': 'A', 'image': 'sheet-A.png', 'tileSize': T, 'tilesPerRow': COLS, 'rows': H, 'pieces': {}}
    for p in ps:
        im = R.render(p, 0); wk = WALK.get(p['id']) or (walk_mask(im, ('grass',)) if 'island' in p['tags'] else [])
        d['pieces'][p['id']] = dict(name=p['name'], w=p['w'], h=p['h'], kind=p['kind'], origins=place[p['id']], frames=p['frames'], solid=p['solid'], walk=wk, tags=p['tags'],
                                    cellIds=[[(place[p['id']][0][1] + j) * COLS + place[p['id']][0][0] + i for i in range(p['w'])] for j in range(p['h'])])
    json.dump(d, open(os.path.join(OUT, 'sheet-A.json'), 'w'), ensure_ascii=False, indent=1)
    return d, sheet


def compose(d, sheet, objs, W, H, bg='cloud'):
    """objs=[(id, cx, cy)] 를 구름 바다 위에 올린 그림(하위 = 구름 바다 칸 전체, 상위 = 조각 스탬프)."""
    img = Image.new('RGBA', (W * T, H * T)); sea = R.render(R.PIECES['sky-a-cloud-sea'], 0)
    for j in range(H):
        for i in range(W): img.paste(sea.crop(((i + j) % 4 * T, 0, (i + j) % 4 * T + T, T)), (i * T, j * T))
    for pid, cx, cy in objs:
        pc = d['pieces'][pid]; ox, oy = pc['origins'][0]
        img.alpha_composite(sheet.crop((ox * T, oy * T, (ox + pc['w']) * T, (oy + pc['h']) * T)), (cx * T, cy * T))
    return img


def walkset(d, objs):
    s = set()
    for pid, cx, cy in objs:
        for wx, wy in d['pieces'][pid]['walk']: s.add((cx + wx, cy + wy))
    return s


def validate(d, ex):
    """오류 코드 목록(빈 목록 = 통과). 구조·통행만 본다(이벤트 실행·미적 품질은 아님)."""
    err = []; ws = walkset(d, ex['objs'])
    for a, b in ex['links']:                                           # 연결 규칙: 걷는 칸이 4방향으로 이어져야 한다
        seen = {tuple(a)}; q = [tuple(a)]
        while q:
            x, y = q.pop()
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in ws and n not in seen: seen.add(n); q.append(n)
        if tuple(b) not in seen: err.append(f'NOT_CONNECTED {a}->{b}')
    ev = ex['boardEvent']; cell = tuple(ev['at'])
    if cell not in ws: err.append(f'EVENT_NOT_WALKABLE {cell}')
    deck = {(ex['airship'][1] + dx, ex['airship'][2] + dy) for dx, dy in d['pieces']['sky-a-airship']['deckCells']}
    if not any((cell[0] + dx, cell[1] + dy) in deck for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): err.append(f'EVENT_NOT_ADJACENT_DECK {cell}')
    for pid, cx, cy in ex['objs']:
        if cx < 0 or cy < 0 or cx + d['pieces'][pid]['w'] > ex['w'] or cy + d['pieces'][pid]['h'] > ex['h']: err.append(f'OUT_OF_MAP {pid}')
    return err


def main():
    d, sheet = build()
    d['pieces']['sky-a-airship']['deckCells'] = [[1, 2], [2, 2], [3, 2], [4, 2]]          # 갑판 윗면 줄(선체 안): 탑승 칸은 이 칸과 4방향 인접
    json.dump(d, open(os.path.join(OUT, 'sheet-A.json'), 'w'), ensure_ascii=False, indent=1)
    W, H = 28, 10
    ok = dict(w=W, h=H, objs=[['sky-a-island-m', 0, 4], ['sky-a-bridge', 5, 3], ['sky-a-island-s', 9, 4], ['sky-a-bridge', 12, 3], ['sky-a-whale-pier', 16, 4], ['sky-a-airship', 20, 2]])
    ok['airship'] = ['sky-a-airship', 20, 2]
    ok['boardEvent'] = dict(at=[20, 4], face='right', action='transfer:airship-map', note='고래 선착장 오른쪽 끝 칸에서 오른쪽(비공정 갑판 칸)을 보고 탑승')
    ok['links'] = [[[1, 4], [11, 4]], [[11, 4], [20, 4]]]
    bad = json.loads(json.dumps(ok)); bad['objs'][1] = ['sky-a-bridge', 5, 7]            # 다리가 섬 높이에서 떨어짐
    bad['boardEvent']['at'] = [18, 4]                                                     # 걷는 칸이지만 갑판과 안 닿음
    bad['objs'].append(['sky-a-island-s', 26, 8])                                          # 지도 밖으로 나감
    for name, ex in (('ok', ok), ('bad', bad)):
        img = compose(d, sheet, [tuple(o) for o in ex['objs']], W, H); dr = ImageDraw.Draw(img)
        ex_ws = walkset(d, [tuple(o) for o in ex['objs']])
        for (x, y) in ex_ws: dr.rectangle((x * T + 6, y * T + 6, x * T + 9, y * T + 9), fill=(255, 80, 60, 255) if name == 'bad' else (255, 255, 255, 255))
        ex_ = ex['boardEvent']['at']; dr.rectangle((ex_[0] * T, ex_[1] * T, ex_[0] * T + 15, ex_[1] * T + 15), outline=(255, 0, 255, 255))
        img.save(os.path.join(OUT, f'example-A-{name}.png'))
        ex['errors'] = validate(d, ex); print(name, 'errors:', ex['errors'])
    json.dump(dict(ok=ok, bad=bad), open(os.path.join(OUT, 'example-A.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__': main()
