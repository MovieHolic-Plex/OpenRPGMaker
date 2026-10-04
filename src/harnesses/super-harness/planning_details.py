"""Tile-scale detail plans and matching interfaces for coarse spatial plans."""
from pathlib import Path
import json

SIDES = {'north': (0, -1), 'south': (0, 1), 'west': (-1, 0), 'east': (1, 0)}


def required(variant):
    rows = variant.get('diagram') or []
    return variant.get('cellScale', 1) > 1 or len(rows) > 60 or (rows and len(rows[0]) > 60)


def validate(folder, variant):
    import gates
    errors = []
    details = variant.get('details') or []
    if not details:
        return ['큰 공간은 전체 배치도와 1타일 축척의 세부 구역 도면이 필요함'] if required(variant) else []
    if required(variant) and len(details) < 2:
        errors.append('큰 공간은 두 구역 이상으로 나눠 세부 도면을 작성해야 함')
    ids = {d['id'] for d in details}
    if len(ids) != len(details):
        errors.append('세부 구역 id 중복')
    parent_symbols = {z['symbol'] for z in variant['zones']}
    covered, occupied, ports, links = set(), set(), {}, {name: set() for name in ids}
    scale = variant['cellScale']
    overview = variant['diagram']
    total_w, total_h = len(overview[0]) * scale, len(overview) * scale
    for d in details:
        name = d['id']
        zones = set(d.get('parentZones') or [])
        if not zones or not zones <= parent_symbols:
            errors.append(f'{name}: 전체 배치도의 어느 구역을 상세화하는지 없음/불일치')
        covered |= zones
        child = {**variant, **d, 'cellScale': 1}
        child.pop('details', None)
        report = gates._planning_report(folder, False, {'version': gates.PLAN_VERSION, 'concept': Path(folder).name, 'variants': [child]}, detail=True)
        errors += [f'{name}: {e}' for e in report['problems']]
        rows = d['diagram']
        w, h = len(rows[0]), len(rows)
        origin = d.get('origin') or []
        if len(origin) != 2 or any(type(v) is not int or v < 0 for v in origin):
            errors.append(f'{name}: 실제 타일 좌표 origin [x,y]가 필요함')
            continue
        ox, oy = origin
        if ox + w > total_w or oy + h > total_h:
            errors.append(f'{name}: 전체 배치 범위 밖의 상세 도면')
        bounds = {(ox+x, oy+y) for y in range(h) for x in range(w)}
        if occupied & bounds:
            errors.append(f'{name}: 다른 세부 구역과 좌표 범위가 겹침')
        occupied |= bounds
        marked = set()
        for p in d.get('ports', []):
            pid = f'{name}/{p["id"]}'
            side, offset, width = p.get('side'), p.get('offset'), p.get('width')
            if pid in ports or side not in SIDES or type(offset) is not int or type(width) is not int or offset < 0 or width < 1:
                errors.append(f'{name}: 연결부 id/방향/폭/위치 오류')
                continue
            if offset + width > (w if side in ('north','south') else h):
                errors.append(f'{pid}: 연결부가 경계 길이보다 큼')
                continue
            cells = ([(offset+i, 0 if side == 'north' else h-1) for i in range(width)] if side in ('north','south')
                     else [(0 if side == 'west' else w-1, offset+i) for i in range(width)])
            if any(rows[y][x] not in 'EX' for x,y in cells) or marked & set(cells):
                errors.append(f'{pid}: 연결부는 겹치지 않는 경계 E/X 칸이어야 함')
            marked |= set(cells)
            if p.get('kind') not in ('walk','vehicle','water') or type(p.get('level')) is not int:
                errors.append(f'{pid}: 보행/차량/수로 구분과 높이 level이 필요함')
            ports[pid] = {**p, 'detail': name, 'cells': {(ox+x,oy+y) for x,y in cells}}
        openings = {(x,y) for y,row in enumerate(rows) for x,ch in enumerate(row) if ch in 'EX' and (x in (0,w-1) or y in (0,h-1))}
        if openings != marked:
            errors.append(f'{name}: 선언하지 않은 출입구 또는 빠진 연결부')
    if covered != parent_symbols:
        errors.append('전체 배치도의 구역 중 세부 도면에서 빠진 구역이 있음')
    for pid,p in ports.items():
        dest = p.get('connectsTo')
        if dest == 'outside':
            if any(overview[y//scale][x//scale] not in 'EX' for x,y in p['cells'] if 0 <= x < total_w and 0 <= y < total_h):
                errors.append(f'{pid}: 전체 배치도에 없는 외부 출입구')
            continue
        peer = ports.get(dest)
        if not peer or peer.get('connectsTo') != pid:
            errors.append(f'{pid}: 반대편 구역의 상호 연결 선언이 없음')
            continue
        dx,dy = SIDES[p['side']]
        if {(x+dx,y+dy) for x,y in p['cells']} != peer['cells'] or SIDES[peer['side']] != (-dx,-dy):
            errors.append(f'{pid}: 반대편 연결부의 실제 좌표/방향 불일치')
        if any(p[k] != peer[k] for k in ('width','kind','level')):
            errors.append(f'{pid}: 양쪽 연결부 폭·용도·높이 불일치')
        links[p['detail']].add(peer['detail'])
    if ids:
        reached, pending = set(), [next(iter(ids))]
        while pending:
            name = pending.pop()
            if name in reached: continue
            reached.add(name);pending.extend(links[name] - reached)
        if reached != ids:
            errors.append('세부 구역들을 합쳤을 때 서로 연결되지 않음')
    return errors


def render(folder):
    """Produce diagram previews, explicitly labeled schematics, never tile-map evidence."""
    import gates
    from PIL import Image, ImageDraw, ImageFont
    folder = Path(folder)
    plan = gates.read(folder / 'planning.json', {})
    report = gates.planning_report(folder, approved=False)
    outputs = []
    colors = ['#405d85','#557951','#956947','#74639b','#387e84','#8a586d','#827947']
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 14)
    for v in plan.get('variants', []):
        for part in [v, *v.get('details', [])]:
            rows = part['diagram'];cell=22;w=max(520,len(rows[0])*cell+40);h=len(rows)*cell+84
            im=Image.new('RGB',(w,h),'#161a21');draw=ImageDraw.Draw(im)
            label = 'OVERVIEW' if part is v else 'DETAIL / 1 TILE'
            draw.text((20,10),f'PLANNING DIAGRAM / {label}',fill='#f1c66c',font=font)
            draw.text((20,31),str(part['id']),fill='#e4e8f0',font=font)
            symbols=sorted(set(''.join(rows))-set('#.+EX'))
            palette={symbol:colors[i%len(colors)] for i,symbol in enumerate(symbols)}
            for y,row in enumerate(rows):
                for x,ch in enumerate(row):
                    color=palette.get(ch,{'#':'#252c36','.':'#657081','+':'#ab8647','E':'#2f9b76','X':'#ae6276'}.get(ch,'#657081'))
                    box=(20+x*cell,60+y*cell,20+(x+1)*cell-1,60+(y+1)*cell-1)
                    draw.rectangle(box,fill=color)
                    if ch!='#':draw.text((box[0]+6,box[1]+3),ch,fill='#ffffff',font=font)
            relative=Path('planning-visual')/(gates.fingerprint([v['id'],part['id']])[:16]+'.png')
            target=folder/relative;target.parent.mkdir(exist_ok=True);im.save(target)
            outputs.append({'path':str(relative),'label':part.get('title') or part['id'],'sha256':gates.digest(target)})
    manifest={'fingerprint':report['fingerprint'],'images':outputs}
    (folder/'planning-visual.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    return manifest
