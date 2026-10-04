"""12프레임 alpha 재현 자료. 사용자 선택/격자/프로젝트 DB는 수정하지 않는다."""
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

import chr as C
import harness as H


def composite(pal, frames, background='checker'):
    sheet = C.sheet_rgba(pal, frames)
    bg = C._bg(*sheet.size, None, background)
    bg.alpha_composite(sheet)
    return bg.convert('RGB')


def roundtrip(pal, frames, views):
    """출하 키 PNG의 ±8 판정 후 RGBA를 실제 격자와 대조한다."""
    expected = C.sheet_rgba(pal, frames)
    png = Image.open(views / 'sheet.png').convert('RGBA')
    if png.size != expected.size:
        raise ValueError('출하 PNG 크기 불일치')
    actual, source = png.load(), expected.load()
    mismatches = 0
    for y in range(png.height):
        for x in range(png.width):
            rgb, a = actual[x, y], source[x, y]
            alpha = 0 if all(abs(rgb[i] - C.KEY[i]) <= C.KEY_TOLERANCE for i in range(3)) else rgb[3]
            mismatches += alpha != a[3] or bool(alpha and rgb[:3] != a[:3])
    gifs = {}
    for background in ('checker', 'white', 'black'):
        file = views / f'walk_{background}.gif'
        if not file.exists():
            continue
        with Image.open(file) as gif:
            # 동일한 연속 프레임은 GIF가 합칠 수 있으므로 인덱스 대신 시간으로 비교한다.
            timeline, end = [], 0
            for index in range(gif.n_frames):
                gif.seek(index)
                end += gif.info.get('duration', 170)
                timeline.append((end, gif.convert('RGB').copy()))
            errors = 0
            for index, step in enumerate((0, 1, 2, 1)):
                bg = C._bg(120, 40, None, background)
                for di, direction in enumerate(C.DIRS):
                    bg.alpha_composite(C.frame_rgba(pal, frames[direction, step]), (di * 32, 4))
                actual = next(frame for end, frame in timeline if end > index * 170)
                diff = ImageChops.difference(actual, C.up(bg.convert('RGB'), 4))
                errors += bool(diff.getbbox())
            gifs[background] = errors
    return dict(keyedPngMismatchPixels=mismatches, diagnosticGifMismatchedSteps=gifs)


def audit(run, out, refresh_previews=False):
    root = H.run_dir(run)
    if Path(run).name != run or run in ('.', '..') or not (root / 'manifest.json').is_file():
        raise ValueError('manifest가 있는 실행 이름을 지정하세요')
    out = Path(out).resolve()
    if out.is_relative_to(H.ROOT.resolve()):
        raise ValueError('업로드 파생 QA 그림은 저장소 밖에 보관하세요')
    out.mkdir(parents=True, exist_ok=True)
    decisions = H._decisions()
    report = dict(run=run, at=H.now(), alphaPolicy=C.ALPHA_POLICY_VERSION,
                  backgrounds=['checker', 'white', 'black'], candidates=[], unfinished=[])
    contacts = []
    for w in sorted(root.glob('*__*')):
        if not (w / 'meta.json').exists():
            continue
        meta = json.loads((w / 'meta.json').read_text())
        if H._alive(meta.get('pid')) or not (w / 'out.chr.txt').exists():
            report['unfinished'].append(w.name)
            continue
        raw = (w / 'out.chr.txt').read_bytes()
        pal, _, frames = C.parse(raw.decode())
        base = H.base_of(meta['base'])
        gate = C.gate(pal, frames, base, strength=meta.get('strength', 'free'))
        gate.update(sourceSha256=hashlib.sha256(raw).hexdigest(),
                    baseSha256=hashlib.sha256(C.dump(base[0], {}, base[1]).encode()).hexdigest(),
                    strength=meta.get('strength', 'free'))
        if refresh_previews:
            C.alpha_views(pal, frames, w / 'views')
            # 진단 중 격자가 바뀌면 새 그림에 옛 진단 이미지를 결부하지 않는다.
            if (w / 'out.chr.txt').read_bytes() != raw:
                raise ValueError(f'진단 중 격자가 바뀌었습니다: {w.name}')
            H.write_json_atomic(w / 'views' / 'alpha-render.json', dict(H.binding(gate), previewVersion=C.ALPHA_PREVIEW_VERSION))
        record = dict(id=f'{run}/{w.name}', name=H._desc(w).get('label', w.name), base=meta['base'],
                      inspected=H.binding(gate), decision=decisions.get(f'{run}/{w.name}'), gate=gate,
                      files=roundtrip(pal, frames, w / 'views'), evidence=None)
        record['animationMode'] = meta.get('animationMode', 'legacy')
        if record['animationMode'] == H.FRAME_AUTHOR_MODE:
            record['modelFramesFresh'] = H.model_frames_fresh(w, gate)
            record['frameAuthor'] = json.loads((w / 'model-frames.json').read_text()) if (w / 'model-frames.json').exists() else None
        # 원본과 후보를 같은 배경/배율로 비교하고 모든 결손 좌표를 표시한다.
        if gate['fatal']:
            proof = Image.new('RGB', (1120, 820), '#202228')
            draw = ImageDraw.Draw(proof)
            for i, bg in enumerate(report['backgrounds']):
                x = 8 + i * 372
                draw.text((x, 6), f'ORIGINAL / GENERATED ({bg})', fill='white')
                proof.paste(C.up(composite(*base, bg), 2), (x, 30))
                candidate = composite(pal, frames, bg)
                marker = ImageDraw.Draw(candidate)
                for defect in gate['fatal']:
                    if defect.get('frame'):
                        direction, frame = defect['frame'].split()
                        for xx, yy in defect.get('pixels', []):
                            marker.point((int(frame) * C.FW + xx, C.DIRS.index(direction) * C.FH + yy), fill='#ff3030')
                proof.paste(C.up(candidate, 3), (x + 148, 30))
                proof.paste(C.up(composite(pal, frames, bg), 3), (x + 148, 424))
            name = f'{w.name}.png'
            proof.save(out / name)
            record['evidence'] = name
        n = len(report['candidates']) + 1
        contacts.append((n, composite(pal, frames), not gate['ok']))
        report['candidates'].append(record)
    for start in range(0, len(contacts), 8):
        page = Image.new('RGB', (960, 872), '#202228')
        draw = ImageDraw.Draw(page)
        for offset, (n, sheet, failed) in enumerate(contacts[start:start + 8]):
            x, y = offset % 4 * 240 + 8, offset // 4 * 436 + 26
            draw.text((x, y - 20), f'{n:03} ' + ('ALPHA FAIL' if failed else 'needs human review'), fill='#ff9494' if failed else 'white')
            page.paste(C.up(sheet, 3), (x, y))
        page.save(out / f'contact-{start // 8 + 1:02}.png')
    report.update(count=len(report['candidates']), frames=len(report['candidates']) * 12,
                  blocked=sum(not row['gate']['ok'] for row in report['candidates']),
                  pngMismatches=sum(row['files']['keyedPngMismatchPixels'] for row in report['candidates']),
                  diagnosticGifMismatches=sum(sum(row['files']['diagnosticGifMismatchedSteps'].values()) for row in report['candidates']))
    H.write_json_atomic(out / 'audit.json', report)
    lines = [f'# Alpha audit: {run}', '', f"{report['count']} candidates / {report['frames']} frames; blocked {report['blocked']}; PNG pixel mismatches {report['pngMismatches']}; diagnostic GIF mismatched steps {report['diagnosticGifMismatches']}.",
             '', 'Mechanical PASS still needs human visual review. Raw grids and human decisions are preserved.', '', '| Candidate | Defects | Evidence |', '|---|---|---|']
    for row in report['candidates']:
        if row['gate']['fatal']:
            lines.append(f"| {row['name']} ({row['id'].split('/')[-1]}) | {'; '.join(d['what'] for d in row['gate']['fatal'])} | [{row['evidence']}]({row['evidence']}) |")
    (out / 'SUMMARY.md').write_text('\n'.join(lines) + '\n')
    return {key: report[key] for key in ('run', 'count', 'frames', 'blocked', 'pngMismatches', 'diagnosticGifMismatches', 'unfinished')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', required=True)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--refresh-previews', action='store_true', help='동일 픽셀의 고대비 GIF만 추가한다')
    args = parser.parse_args()
    target = args.out or H.DATA / 'evidence' / (datetime.now().strftime('%Y%m%d-%H%M%S') + '-alpha')
    print(json.dumps(audit(args.run, target, args.refresh_previews), ensure_ascii=False))
