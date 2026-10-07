"""Pack the user-approved theme-cast-v1 walkers into per-theme field sheets.

Only candidates with a live browser Allow are packed: each one goes through the casting
harness `build`, which refuses pending/denied/superseded candidates. Nothing is approved here.

Output: public/assets/emerald-monster/cast/theme-cast.json
  assets: oprn_emerald_field_cast_<theme> (288x256, 24x32 cells, same layout as the stock cast)
  slots:  {<theme>: {resident_m|resident_f|trainer: {sheet, index}}}
16x32 native cells are centered in 24x32 runtime cells without resampling (pack-template-npc-cast.py).

    python3 scripts/content/pack-theme-cast.py [--data ~/.local/share/oprn/pokemon-character-casting]
"""
from pathlib import Path
from PIL import Image
import argparse, base64, io, json, subprocess, sys, tempfile

ROOT = Path(__file__).resolve().parents[2]
SLOT_ORDER = ['resident_m', 'resident_f', 'trainer']
THEME_NAMES = {'desert': '사막', 'snow': '설원', 'coast': '해안'}

parser = argparse.ArgumentParser()
parser.add_argument('--data', default=str(Path.home() / '.local/share/oprn/pokemon-character-casting'))
parser.add_argument('--wave', default='theme-cast-v1')
parser.add_argument('--out', default=str(ROOT / 'public/assets/emerald-monster/cast/theme-cast.json'))
args = parser.parse_args()

wave = json.loads((Path(args.data) / 'waves' / f'{args.wave}.json').read_text())
sheets: dict[str, Image.Image] = {}
slots: dict[str, dict] = {}
provenance = []
for candidate_id in wave['candidateIds']:
    role = candidate_id.rsplit('-', 1)[0]
    theme, part = role.split('_', 1)
    if part not in SLOT_ORDER:
        raise SystemExit(f'unknown theme role {role}')
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'build'
        built = subprocess.run(['node', str(ROOT / 'src/harnesses/pokemon-character-casting/node/cli.mjs'), 'build',
                                '--id', candidate_id, '--out', str(out), '--data', args.data],
                               capture_output=True, text=True, cwd=ROOT)
        if built.returncode != 0:
            reason = [line for line in built.stderr.splitlines() if line.strip() and 'Warning' not in line and 'trace-warnings' not in line]
            print(f'skip {candidate_id}: {reason[-1] if reason else "no live Allow"}', file=sys.stderr)
            continue
        # charset.png 가 승인된 수정본이다(template.png 원작·changes.png 수정 위치는 비교용).
        native_path = out / 'charset.png'
        source = Image.open(native_path).convert('RGBA')
        if source.size != (48, 128):
            raise SystemExit(f'{candidate_id}: charset.png is {source.size}, expected native 48x128')
        approval = json.loads((out / 'human-approval.json').read_text())
    index = SLOT_ORDER.index(part)
    sheet = sheets.setdefault(theme, Image.new('RGBA', (288, 256)))
    ox, oy = (index % 4) * 72, (index // 4) * 128
    for row in range(4):
        for col in range(3):
            cell = source.crop((col * 16, row * 32, col * 16 + 16, row * 32 + 32))
            sheet.paste(cell, (ox + col * 24 + 4, oy + row * 32))
            assert sheet.crop((ox + col * 24 + 4, oy + row * 32, ox + col * 24 + 20, oy + row * 32 + 32)).tobytes() == cell.tobytes()
    asset_id = f'oprn_emerald_field_cast_{theme}'
    slots.setdefault(theme, {})[part] = {'sheet': asset_id, 'index': index}
    provenance.append({'candidate': candidate_id, 'theme': theme, 'role': part, 'decisionSeq': approval.get('seq'),
                       'packageSha256': approval.get('packageSha256')})

assets = {}
for theme, image in sheets.items():
    buffer = io.BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    asset_id = f'oprn_emerald_field_cast_{theme}'
    assets[asset_id] = {'id': asset_id, 'kind': 'charset', 'name': f'비취섬 필드 인물 · {THEME_NAMES.get(theme, theme)}',
                        'dataUrl': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode(),
                        'meta': {'width': 288, 'height': 256, 'frameWidth': 24, 'frameHeight': 32, 'frames': 96}}
Path(args.out).write_text(json.dumps({'assets': assets, 'slots': slots, 'provenance': provenance}, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'packed': len(provenance), 'themes': sorted(slots), 'skipped': len(wave['candidateIds']) - len(provenance)}))
