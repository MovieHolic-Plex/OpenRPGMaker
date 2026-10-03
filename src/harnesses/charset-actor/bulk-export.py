"""완성 후보를 에디터 업로드용 8칸 CharSet과 관찰 카탈로그로 묶는다.

python3 bulk-export.py RUN
사용자 결정·프로젝트·공용 라이브러리는 수정하지 않는다.
"""
import argparse
import base64
import hashlib
import json
import math
import shutil
import tempfile
import zipfile
import uuid
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import harness as H
import chr as C


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, data):
    H.write_json_atomic(path, data)


def finish_discard(root, record):
    alias = root / record['dir']
    physical = alias.resolve()
    dest = Path(record['archive'])
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and physical.exists():
        raise ValueError(f'폐기 보관 대상 충돌: {dest}')
    if physical.exists():
        physical.rename(dest)
    if alias.is_symlink():
        alias.unlink()
    if not dest.exists():
        raise ValueError(f'폐기 원본을 찾을 수 없음: {record["key"]}')
    record['state'] = 'complete'


def contact(rows, dest, columns=10):
    font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 14)
    im = Image.new('RGB', (columns * 160, math.ceil(len(rows) / columns) * 164 + 50), '#17161b')
    draw = ImageDraw.Draw(im)
    draw.text((16, 12), f'GPT 6.1 sol · high / {len(rows)} characters', font=font, fill='#dddbea')
    for i, row in enumerate(rows):
        x, y = i % columns * 160, i // columns * 164 + 50
        draw.rounded_rectangle((x + 3, y + 3, x + 156, y + 160), radius=6, fill='#25242c')
        sprite = row['front'].resize((72, 96), Image.Resampling.NEAREST)
        im.paste(sprite, (x + 44, y + 8), sprite)
        draw.text((x + 10, y + 111), f'{row["number"]:03d} {row["genre"]}', font=font, fill='#aeb5c9')
        draw.text((x + 10, y + 132), f'{row["role"]} ({row["gender"]})', font=font, fill='#eeebf5')
    im.save(dest)


def export(run, discard_failed=False):
    root = H.run_dir(run)
    manifest = json.loads((root / 'manifest.json').read_text())
    jobs = manifest['characters']
    loaded = []
    missing = []
    decisions = H._decisions()
    discarded_file = root / 'discarded.json'
    discarded = json.loads(discarded_file.read_text())['characters'] if discarded_file.exists() else []
    for record in discarded:
        if record.get('state') == 'pending':
            finish_discard(root, record)
            write_json(discarded_file, dict(run=run, gateVersion=C.GATE_VERSION, characters=discarded))
    discarded_keys = {r['key'] for r in discarded}
    excluded = []
    for number, row in enumerate(jobs, 1):
        if row['key'] in discarded_keys:
            continue
        w = root / f'{row["key"]}__gpt-r1'
        if not all((w / f).exists() for f in ('out.chr.txt', 'meta.json')):
            missing.append(row['key'])
            continue
        gate = H.current_gate(w)
        review = H.read_verdict(w, gate)
        decision = decisions.get(f'{run}/{w.name}', {}).get('decision')
        q = H.quality(w, decision, gate, review)
        if q['pending']:
            missing.append(row['key'])
            continue  # 검수 갱신 대기는 불량 폐기와 다르다.
        if not q['eligible']:
            excluded.append(dict(key=row['key'], dir=w.name, reasons=q['reasons'], gate=gate,
                                 review=review, decision=decision))
            continue
        pal, _, frames = C.load(w / 'out.chr.txt')
        if not (w / 'desc.json').exists():
            missing.append(row['key'])
            continue
        meta = json.loads((w / 'meta.json').read_text())
        if (meta['model'], meta['effort']) != ('gpt-6.1-sol', 'high'):
            raise ValueError('작업자 모델이 지시와 다름')
        desc = json.loads((w / 'desc.json').read_text())
        loaded.append(dict(row, number=number, folder=w, rgba=C.sheet_rgba(pal, frames),
                           front=C.frame_rgba(pal, frames[('down', 1)]), description=desc,
                           gate=gate, review=review, meta=meta))
    if missing:
        raise ValueError(f'완료되지 않은 후보 {len(missing)}명: {missing[:10]}')
    hashes = [digest(r['rgba'].tobytes()) for r in loaded]
    if len(set(hashes)) != len(loaded):
        raise ValueError('동일한 그림이 중복됨')
    out = Path(tempfile.mkdtemp(prefix='.pack-', dir=root))
    original = manifest.get('sourceOriginal')
    if original:
        shutil.copy(original, out / 'source-original.png')
    (out / 'charsets').mkdir(exist_ok=True)
    (out / 'transparent').mkdir(exist_ok=True)
    (out / 'grids').mkdir(exist_ok=True)
    catalog, assets, readback = [], {}, []
    for offset in range(0, len(loaded), 8):
        group = loaded[offset:offset + 8]
        sheet_number = offset // 8 + 1
        filename = f'MixedRPG{sheet_number:02d}.png'
        rgba = Image.new('RGBA', (288, 256))
        for slot, row in enumerate(group):
            rgba.paste(row['rgba'], (slot % 4 * 72, slot // 4 * 128))
        rgba.save(out / 'transparent' / filename)
        bg = Image.new('RGBA', (288, 256), C.KEY + (255,))
        bg.alpha_composite(rgba)
        bg.convert('RGB').save(out / 'charsets' / filename)
        # 편집기의 색 키 허용 오차(각 RGB 채널 ±8)까지 적용해 실제 픽셀이 사라지지 않는지 읽는다.
        keyed = Image.open(out / 'charsets' / filename).convert('RGB')
        restored = Image.new('RGBA', keyed.size)
        restored.putdata([(0, 0, 0, 0) if all(abs(rgb[i] - C.KEY[i]) <= 8 for i in range(3))
                          else (*rgb, 255) for rgb in keyed.getdata()])
        if restored.tobytes() != rgba.tobytes():
            raise ValueError(f'편집기 색 키 처리에서 원래 픽셀이 변함: {filename}')
        asset_id = f'shared_charset_mixed100_{sheet_number:02d}'
        png_bytes = (out / 'charsets' / filename).read_bytes()
        assets[asset_id] = dict(id=asset_id, name=f'혼합 RPG 검수 통과 · {sheet_number:02d}', kind='charset',
                                dataUrl='data:image/png;base64,' + base64.b64encode(png_bytes).decode(),
                                meta=dict(width=288, height=256, frameWidth=24, frameHeight=32, transparentColor='#009392'))
        reopened = Image.open(out / 'transparent' / filename).convert('RGBA')
        for slot, row in enumerate(group):
            x, y = slot % 4 * 72, slot // 4 * 128
            if reopened.crop((x, y, x + 72, y + 128)).tobytes() != row['rgba'].tobytes():
                raise ValueError('패킹 재로드 불일치')
            readback.append(dict(key=row['key'], file=filename, slot=slot, rgbaSha256=digest(row['rgba'].tobytes())))
            shutil.copy(row['folder'] / 'out.chr.txt', out / 'grids' / f'{row["key"]}.chr.txt')
            catalog.append(dict(id=row['key'], number=row['number'], genre=row['genre'], intendedRole=row['role'],
                                intendedGender=row['gender'], intendedAge=row['age'], textureKey=asset_id,
                                characterIndex=slot, charset=f'charsets/{filename}', sourceBase=row['base'],
                                **row['description'], generation=dict(model='gpt-6.1-sol', effort='high', rounds=1),
                                quality=dict(mechanical=row['gate'], visual=row['review']),
                                acceptance=decisions.get(f'{run}/{row["folder"].name}', {}).get('decision', 'undecided')))
        for slot in range(len(group), 8):
            x, y = slot % 4 * 72, slot // 4 * 128
            if reopened.crop((x, y, x + 72, y + 128)).getbbox():
                raise ValueError('마지막 시트 빈 칸에 픽셀이 있음')
    library = dict(version=1, projectDefaults=True, roots=[], places={}, tilesets={}, maps={}, previews={},
                   assets=assets, sourceProjectId=f'charset-harness:{run}')
    write_json(out / 'editor-assets.json', library)
    write_json(out / 'characters.json', dict(run=run, count=len(catalog), genres=dict(Counter(r['genre'] for r in catalog)),
                                            frame=dict(width=24, height=32, directions=list(C.DIRS), walk=[0, 1, 2, 1]),
                                            characters=catalog))
    preview_rows = [dict(name=r['name'], label=r['description']['label'], genre=r['genre'],
                         role=r['description']['role'], tags=r['description']['tags'],
                         appearance=r['description']['appearance'], fits=r['description']['fits'],
                         file=f'MixedRPG{i // 8 + 1:02d}.png', slot=i % 8,
                         score=r['review']['score'], verdict=r['review']['verdict'], mechanical=r['gate']['ok'])
                    for i, r in enumerate(loaded)]
    html = (H.HERE / 'bulk-catalog.html').read_text(encoding='utf-8')
    html = html.replace('__CHARACTERS__', json.dumps(preview_rows, ensure_ascii=False).replace('<', '\\u003c'))
    html = html.replace('__COUNT__', str(len(loaded))).replace('__GENRES__',
                        ' · '.join(f'{g} {n}' for g, n in Counter(r['genre'] for r in loaded).items()))
    (out / 'index.html').write_text(html, encoding='utf-8')
    (out / 'SOURCE.md').write_text(f'''# 원본과 산출물

원본 첨부 그림: `{manifest['sourceOriginal']}`. 원본 파일의 아래 출처 문구도 원본에 보존했다.
원본에 적힌 제작자: 창조도시 뱀신의교주. 원본에 적힌 주소: http://blog.naver.com/c0930jh
새 칩의 sourceBase는 characters.json에 기록했다. 별도 라이선스 부여는 하지 않는다.
변형: GPT 6.1 sol high, 서 있는 4방향 직접 격자 편집. 걸음은 원본 동작에서 전파했다.
관찰 설명·독립 시각 검수: Claude Sonnet 5.5 medium. 사용자 받기 결정은 이 팩 제작과 별개다.
''', encoding='utf-8')
    (out / 'README.md').write_text(f'''# 여러 장르 RPG 캐릭터 {len(catalog)}명

- {' / '.join(f'{g} {n}' for g, n in Counter(r['genre'] for r in loaded).items())}. 원본 {len(jobs)}종에서 품질 검사를 통과한 {len(loaded)}종만 포함한다.
- `charsets/`: 에디터 자료 보관함에 **캐릭터칩(CharSet)**으로 올릴 288×256 PNG {len(assets)}장.
- 시트 1장당 8명(4열×2행), 1명당 72×128. 미사용 칸은 비어 있다.
- 1프레임 24×32. 행은 up/right/down/left, 열은 걸음 0/1/2. 가운데 열이 서 있는 자세.
- 배경 키 색 #009392. `transparent/`에는 같은 시트의 RGBA 투명본이 있다.
- `characters.json`: {len(loaded)}명 이름·실제로 관찰한 외형·검색 태그·시트와 칸 번호·검수 판정.
- `index.html`: 서버 없이 열 수 있는 검색·4방향 걷기 카탈로그. ZIP을 먼저 풀고 연다.
- `editor-assets.json`: 로컬 공용 자산 게시 API용 자산 팩. 이 내보내기만으로 설치되지는 않는다.
- `grids/`: {len(loaded)}명 원본 격자. `SOURCE.md`: 첨부 원본의 출처와 모델 기록.
- `source-original.png`: 아래 제작자 출처 문구를 포함한 첨부 원본.
- 기계 검사 v{C.GATE_VERSION}와 시각 검수 PASS만 내보낸다. 사용자 버림·결손·미검수는 제외한다.
- 사용자가 직접 받은 결과는 비치명적 시각 지적만 예외로 할 수 있다. 몸체 결손은 받았어도 제외한다.
''', encoding='utf-8')
    contact(loaded, out / 'contact-validated.png')
    for genre in manifest['genres']:
        group = [r for r in loaded if r['genre'] == genre]
        if group:
            contact(group, out / f'contact-{genre}.png', columns=5)
    summary = dict(run=run, count=len(catalog), frames=len(catalog) * 12, sheets=len(assets),
                   editorColorKeyTolerance=8, editorColorKeyReadback=True,
                   uniqueSprites=len(set(hashes)), mechanicalPass=sum(r['gate']['ok'] for r in loaded),
                   visualVerdicts=dict(Counter(r['review']['verdict'] for r in loaded)),
                   genres=dict(Counter(r['genre'] for r in loaded)), packedReadback=readback,
                   gateVersion=C.GATE_VERSION, planned=len(jobs), excluded=discarded + excluded)
    archive = out.with_name(out.name + '.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zip:
        for file in sorted(out.rglob('*')):
            if file.is_file():
                zip.write(file, file.relative_to(out))
    # 옛 불량 팩과 원본은 공개 runs 밖에 보관한다. 새 폴더는 빈 상태에서 만들었으므로 옛 시트가 섞이지 않는다.
    backup = H.DATA / 'quarantine' / run / 'exports' / (H.now().replace(':', '') + '-' + uuid.uuid4().hex[:8])
    backup.mkdir(parents=True, exist_ok=True)
    for name in ['pack', 'mixed-rpg-100.zip', 'mixed-rpg-validated.zip', 'catalog.json',
                 'export-readback.json', 'archive-readback.json', 'early-eight.png', 'early-variety.png',
                 *[p.name for p in root.glob('contact-*.png')]]:
        old = root / name
        if old.exists() or old.is_symlink():
            shutil.move(str(old), backup / name)
    out.rename(root / 'pack')
    archive.rename(root / 'mixed-rpg-validated.zip')
    # 이전에 공유한 링크도 검수된 동일 파일로 연결한다.
    (root / 'mixed-rpg-100.zip').symlink_to('mixed-rpg-validated.zip')
    shutil.copy(root / 'pack' / 'contact-validated.png', root / 'contact-validated.png')
    shutil.copy(root / 'pack' / 'contact-validated.png', root / 'contact-100.png')
    for image in (root / 'pack').glob('contact-*.png'):
        if image.name != 'contact-validated.png':
            shutil.copy(image, root / image.name)
    if discard_failed:
        for row in excluded:
            dest = H.DATA / 'quarantine' / run / 'characters' / row['dir']
            if dest.exists():
                raise ValueError(f'폐기 보관 대상 충돌: {dest}')
            row.update(archive=str(dest), at=H.now(), state='pending')
        discarded.extend(excluded)
        write_json(discarded_file, dict(run=run, gateVersion=C.GATE_VERSION, characters=discarded))
        for row in excluded:
            finish_discard(root, row)
            write_json(discarded_file, dict(run=run, gateVersion=C.GATE_VERSION, characters=discarded))
        H.export_decisions()
    write_json(root / 'export-readback.json', summary)
    write_json(root / 'catalog.json', dict(run=run, count=len(catalog), planned=len(jobs), characters=catalog))
    print(json.dumps({k: v for k, v in summary.items() if k not in ('packedReadback', 'excluded')}, ensure_ascii=False))
    print(f'제외 {len(summary["excluded"])}명 / 팩: {root / "mixed-rpg-validated.zip"}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run')
    parser.add_argument('--discard-failed', action='store_true', help='제외 결과를 공개 runs 밖에 옮겨 후보에서 버린다')
    args = parser.parse_args()
    with H.run_lock(H.run_dir(args.run)):
        export(args.run, args.discard_failed)
