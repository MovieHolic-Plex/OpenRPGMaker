"""실제 저작 격자를 보존하고 걷기 전파 전후·픽셀 출처·PNG/GIF를 다시 읽는다."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

import audit as A
import chr as C
import harness as H


def render(pal, frames, folder):
    C.sheet_keyed(pal, frames).save(folder / 'sheet.png')
    C.alpha_views(pal, frames, folder)
    C.gif_walk(pal, frames, folder / 'walk.gif', lawn=H.LAWN)
    result = A.roundtrip(pal, frames, folder)
    if result['keyedPngMismatchPixels'] or len(result['diagnosticGifMismatchedSteps']) != 3 or any(result['diagnosticGifMismatchedSteps'].values()):
        raise ValueError('전후 PNG/GIF 픽셀 대조 실패')
    return result


def compare_gif(pal, before, after, file):
    images = []
    for step in (0, 1, 2, 1):
        bg = C._bg(120, 88, None, 'checker')
        for di, direction in enumerate(C.DIRS):
            bg.alpha_composite(C.frame_rgba(pal, before[direction, step]), (di * 32, 10))
            bg.alpha_composite(C.frame_rgba(pal, after[direction, step]), (di * 32, 54))
        image = C.up(bg.convert('RGB'), 4)
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 479, 31), fill='#202228')
        draw.rectangle((0, 176, 479, 207), fill='#202228')
        draw.text((8, 8), 'BEFORE   up / right / down / left', fill='white')
        draw.text((8, 184), 'AFTER    up / right / down / left', fill='white')
        images.append(image)
    C._save_gif(images, file, 170)


def verify_walk(run, out):
    if Path(run).name != run or run in ('.', '..'):
        raise ValueError('실행 이름을 지정하세요')
    root = H.run_dir(run)
    if not (root / 'manifest.json').is_file():
        raise ValueError('실행 manifest가 없습니다')
    manifest = json.loads((root / 'manifest.json').read_text())
    out = Path(out).resolve()
    protected = (H.ROOT, H.DATA / 'runs', H.INPUTS, H.ACCEPTED_LOCAL)
    if any(out.is_relative_to(p.resolve()) for p in protected):
        raise ValueError('QA 그림은 저장소·실제 후보·참고 원본·남김 폴더 밖에 보관하세요')
    candidates = sorted(w for w in root.glob('*__*') if (w / 'meta.json').exists())
    expected = {row['key'] for row in manifest['characters']}
    present = {json.loads((w / 'meta.json').read_text())['brief'] for w in candidates}
    if not expected or expected - present:
        raise ValueError('manifest의 후보 격자가 모두 있어야 걷기 QA를 확정합니다')
    out.mkdir(parents=True, exist_ok=True)
    report = dict(run=run, version=C.WALK_VERSION, at=H.now(), candidates=[], originals=[],
                  implementationSha256=hashlib.sha256((H.HERE / 'chr.py').read_bytes()).hexdigest())
    for sheet in H.BASE_SHEETS:
        for slot in range(8):
            pal, frames = H.base_of(f'{sheet}:{slot}')
            if C.propagate(frames, frames, pal, pal) != frames:
                raise ValueError(f'RTP 원본 걷기가 달라졌습니다: {sheet}:{slot}')
            report['originals'].append(f'{sheet}:{slot}')
    for w in candidates:
        meta = json.loads((w / 'meta.json').read_text())
        if H._alive(meta.get('pid')) or not (w / 'out.chr.txt').is_file():
            raise ValueError(f'저작 중인 후보를 QA로 확정하지 않습니다: {w.name}')
        raw = (w / 'out.chr.txt').read_bytes()
        pal, _, before = C.parse(raw.decode())
        base = H.base_of(meta['base'])
        target = out / w.name
        first, last = target / 'before', target / 'after'
        first.mkdir(parents=True, exist_ok=True)
        last.mkdir(parents=True, exist_ok=True)
        (first / 'out.chr.txt').write_bytes(raw)
        (last / 'out.chr.txt').write_bytes(raw)
        after = H.propagate_file(last / 'out.chr.txt', meta['base'])
        ap, _, reloaded = C.load(last / 'out.chr.txt')
        transfers = json.loads((last / 'walk-transfer.json').read_text())
        if ap != pal or reloaded != after or any(after[d, 1] != before[d, 1] for d in C.DIRS):
            raise ValueError('저작된 팔레트/정지 프레임 또는 걷기 저장 재읽기가 달라졌습니다')
        if hashlib.sha256((last / 'out.chr.txt').read_bytes()).hexdigest() != transfers['outputSha256']:
            raise ValueError('걸음 출처 기록이 현재 격자와 일치하지 않습니다')
        changes = []
        traced = {(tuple(t['frame'].split()), tuple(t['destination'])): t for t in transfers['transferred']}
        for key, rows in before.items():
            for y in range(C.FH):
                for x in range(C.FW):
                    if rows[y][x] == after[key][y][x]:
                        continue
                    source = traced.get(((key[0], str(key[1])), (x, y)))
                    if not source or rows[y][x] != '.' or before[key[0], 1][source['source'][1]][source['source'][0]] != after[key][y][x]:
                        raise ValueError('변경된 걷기 픽셀이 실제 정지 그림으로 추적되지 않습니다')
                    changes.append(source)
        before_gate = C.gate(pal, before, base, strength=meta.get('strength', 'free'))
        after_gate = C.gate(pal, after, base, strength=meta.get('strength', 'free'))
        standing_defects = C.opacity_defects(pal, {k: v for k, v in before.items() if k[1] == 1}, base)
        if not standing_defects and before_gate['discard'] and after_gate['discard']:
            raise ValueError(f'걷기에서 새로 생긴 결손이 남았습니다: {w.name}')
        if before_gate['ok'] and not after_gate['ok']:
            raise ValueError(f'정상 후보에 새 검사 실패가 생겼습니다: {w.name}')
        before_files, after_files = render(pal, before, first), render(pal, after, last)
        if changes:
            compare_gif(pal, before, after, target / 'compare.gif')
            proof = Image.new('RGB', (888, 800), '#202228')
            draw = ImageDraw.Draw(proof)
            for i, background in enumerate(('checker', 'white', 'black')):
                x = i * 296 + 8
                draw.text((x, 6), f'BEFORE / AFTER ({background})', fill='white')
                proof.paste(C.up(A.composite(pal, before, background), 3), (x, 26))
                proof.paste(C.up(A.composite(pal, after, background), 3), (x, 410))
            proof.save(target / 'compare.png')
        row = dict(id=f'{run}/{w.name}', name=H._desc(w).get('label', w.name), base=meta['base'],
                   sourceSha256=hashlib.sha256(raw).hexdigest(), standingUnchanged=True, paletteUnchanged=True,
                   changedPixels=len(changes), provenance=transfers, beforeGate=before_gate, afterGate=after_gate,
                   standingDefects=standing_defects, beforeFiles=before_files, afterFiles=after_files,
                   beforeMotion=C.stats(pal, before)['motion'], afterMotion=C.stats(pal, after)['motion'])
        report['candidates'].append(row)
        if (w / 'out.chr.txt').read_bytes() != raw:
            raise ValueError('QA 중 원본 후보가 바뀌었습니다')
        print(json.dumps(dict(candidate=w.name, changed=len(changes), beforeOk=before_gate['ok'], afterOk=after_gate['ok'])), flush=True)
    report.update(count=len(report['candidates']), frames=len(report['candidates']) * 12,
                  beforeBlocked=sum(not r['beforeGate']['ok'] for r in report['candidates']),
                  afterBlocked=sum(not r['afterGate']['ok'] for r in report['candidates']),
                  changedCandidates=sum(bool(r['changedPixels']) for r in report['candidates']),
                  changedPixels=sum(r['changedPixels'] for r in report['candidates']))
    H.write_json_atomic(out / 'walk-qa.json', report)
    lines = ['# 걷기 전파 전후 QA', '', f"{report['count']}종 / {report['frames']}프레임 · 결손 {report['beforeBlocked']}→{report['afterBlocked']}종 · 변경 {report['changedCandidates']}종/{report['changedPixels']}px · RTP 원본 {len(report['originals'])}명 완전 일치.",
             '', '팔레트·정지 네 방향·실제 후보·사용자 선택은 보존. 모든 변경은 저작된 정지 그림의 정확한 픽셀로 추적. 전후 PNG ±8 및 세 배경 GIF 재읽기 불일치 0.', '', '| 후보 | 전→후 | 전달 픽셀 | 근거 |', '|---|---|---|---|']
    for row in report['candidates']:
        if row['changedPixels'] or not row['afterGate']['ok']:
            name = row['id'].split('/')[-1]
            link = f'[PNG]({name}/compare.png) · [GIF]({name}/compare.gif)' if row['changedPixels'] else '정지 저작 결손 — 차단 유지'
            lines.append(f"| {row['name']} ({name}) | {row['beforeGate']['ok']}→{row['afterGate']['ok']} | {row['changedPixels']} | {link} |")
    (out / 'SUMMARY.md').write_text('\n'.join(lines) + '\n')
    return {key: report[key] for key in ('count', 'frames', 'beforeBlocked', 'afterBlocked', 'changedCandidates', 'changedPixels')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(verify_walk(args.run, args.out)))
