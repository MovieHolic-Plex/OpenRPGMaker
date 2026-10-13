"""조립 관문 그림 — 혼자서는 윗면을 보일 수 없는 부품(실내 벽 묶음의 북벽·모서리·띠·남벽 갓·문·창, 애니메이션 프레임 포함)을
그 부품을 화소 그대로 품은 방 한 칸 그림으로 object-gate(kind structure)에 낸다. jp-city gate_assembled.py 와 같은 규칙:
부품을 한 화소라도 다시 그리면 조립 그림의 해시가 바뀌어 덮임이 풀린다(굽기가 다시 렌더해 영수증을 찾는다).

  assembled() → [dict(label, kind, img, covers=[(piece_id, frame), ...])]
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
import loader, gmlib
from PIL import Image

ROOMS = dict(m=('manor', 'gm-fl-parquet-a', '저택 다마스크 벽지 방'), s=('stone', 'gm-fl-flag-a', '지하 마름돌 방'), g=('gallery', 'gm-fl-marble-a', '미술관 회벽 방'))


def _pieces():
    out = {}
    for m in ('int_walls', 'int_floors'):
        out.update(loader.load(m).pieces)
    return out


def assembled():
    P = _pieces(); res = []
    for k, (sid, floor, ko) in ROOMS.items():
        pre = f'gm-w{k}-'
        north = [(pre + 'nw', 0), (pre + 'n', 0), (pre + 'n-window', 0)] + [(pre + 'n-lightning', f) for f in range(3)] \
            + [(pre + 'n-sconce', f) for f in range(3)] + [(pre + 'door1', 0), (pre + 'door2', 0), (pre + 'n', 0), (pre + 'ne', 0)]
        W = sum(P[i]['w'] for i, _ in north); H = 7
        img = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0)); covers = set()
        fl = gmlib.render_piece(P[floor], 0).img()
        for y in range(4, H - 1):
            for x in range(1, W - 1): img.alpha_composite(fl, (x * 16, y * 16))
        x = 0
        for pid, f in north:
            img.alpha_composite(gmlib.render_piece(P[pid], f).img(), (x * 16, 0)); covers.add((pid, f)); x += P[pid]['w']
        for y in range(4, H - 1):
            img.alpha_composite(gmlib.render_piece(P[pre + 'w'], 0).img(), (0, y * 16))
            img.alpha_composite(gmlib.render_piece(P[pre + 'e'], 0).img(), ((W - 1) * 16, y * 16))
        img.alpha_composite(gmlib.render_piece(P[pre + 'sw'], 0).img(), (0, (H - 1) * 16))
        img.alpha_composite(gmlib.render_piece(P[pre + 'se'], 0).img(), ((W - 1) * 16, (H - 1) * 16))
        for x in range(1, W - 1): img.alpha_composite(gmlib.render_piece(P[pre + 's'], 0).img(), (x * 16, (H - 1) * 16))
        covers |= {(pre + s, 0) for s in ('w', 'e', 'sw', 'se', 's')}
        res.append(dict(label=f'gothic_manor/assembled/room-{sid}', kind='structure', img=img,
                        name=f'{ko}(벽 고리·문·창·촛대 프레임 조립 — 위에서 본 방 한 칸)', covers=sorted(covers)))
        fp = pre + 'n-fireplace'
        if fp in P:                                   # 벽난로 벽 부품: 프레임 셋을 나란히 품은 작은 방(따로 영수증 — 떨어져도 큰 방 덮임은 그대로)
            row = [(pre + 'nw', 0)] + [(fp, f) for f in range(3)] + [(pre + 'ne', 0)]
            W2 = sum(P[i]['w'] for i, _ in row); im2 = Image.new('RGBA', (W2 * 16, 8 * 16), (0, 0, 0, 0)); cv2 = set()
            for y in range(4, 7):
                for x in range(1, W2 - 1): im2.alpha_composite(fl, (x * 16, y * 16))
            x = 0
            for pid, f in row:
                im2.alpha_composite(gmlib.render_piece(P[pid], f).img(), (x * 16, 0)); cv2.add((pid, f)); x += P[pid]['w']
            for y in range(4, 7):
                im2.alpha_composite(gmlib.render_piece(P[pre + 'w'], 0).img(), (0, y * 16)); im2.alpha_composite(gmlib.render_piece(P[pre + 'e'], 0).img(), ((W2 - 1) * 16, y * 16))
            im2.alpha_composite(gmlib.render_piece(P[pre + 'sw'], 0).img(), (0, 7 * 16)); im2.alpha_composite(gmlib.render_piece(P[pre + 'se'], 0).img(), ((W2 - 1) * 16, 7 * 16))
            for x in range(1, W2 - 1): im2.alpha_composite(gmlib.render_piece(P[pre + 's'], 0).img(), (x * 16, 7 * 16))
            res.append(dict(label=f'gothic_manor/assembled/hearth-{sid}', kind='structure', img=im2,
                            name=f'{ko}에 벽난로를 박은 방 한 칸(불꽃 프레임 셋을 나란히 — 위에서 본 방)', covers=sorted(cv2)))
    return res


if __name__ == '__main__':
    for a in assembled():
        p = os.path.expanduser(f"~/gothic-scratch/{a['label'].split('/')[-1]}.png"); a['img'].save(p); print(p, a['img'].size, len(a['covers']))
