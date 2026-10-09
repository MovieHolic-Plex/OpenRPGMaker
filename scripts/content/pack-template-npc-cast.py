"""Lossless role-slot adapter. Approval belongs to the caller's pinned selection.

16x32 source cells are centered in 24x32 runtime cells, with no resampling.
The previously shipped hero is preserved byte-for-byte in slot zero.
"""
from pathlib import Path
from PIL import Image
import sys, json, hashlib, base64, io

selection_path, harness_path, cache_path, output, atlas_path = map(Path, sys.argv[1:6])
selection = json.loads(selection_path.read_text())
assert selection['source'] == 'explicit-user-message'
selected = {c['role']: c for c in selection['candidates']}
roles = ['hero', 'rival', 'professor', 'nurse', 'merchant', 'mother', 'resident', 'gym_leader',
         'company_agent', 'captain', 'worker', 'explorer', 'student', 'ranger', 'moon_leader', 'hiker']
cache = json.loads(cache_path.read_text())
output.mkdir(parents=True, exist_ok=True)
checks = []
for group in range(2):
    key = f'oprn_emerald_field_cast_{group+1}'
    old_bytes = base64.b64decode(cache['assets']['uploaded'][key]['dataUrl'].split(',')[1])
    original = Image.open(io.BytesIO(old_bytes)).convert('RGBA')
    assert original.size == (288, 256)
    result = Image.new('RGBA', (288, 256))
    for slot in range(8):
        role = roles[group*8+slot]
        ox, oy = (slot % 4)*72, (slot // 4)*128
        if role == 'hero':
            result.paste(original.crop((ox, oy, ox+72, oy+128)), (ox, oy))
            continue
        candidate = selected[role]
        path = harness_path / '.data/candidates' / candidate['id'] / 'charset.png'
        assert hashlib.sha256(path.read_bytes()).hexdigest() == candidate['sourceSha256']
        source = Image.open(path).convert('RGBA')
        assert source.size == (48, 128)
        for row in range(4):
            for col in range(3):
                cell = source.crop((col*16, row*32, col*16+16, row*32+32))
                result.paste(cell, (ox+col*24+4, oy+row*32))
                recovered = result.crop((ox+col*24+4, oy+row*32, ox+col*24+20, oy+row*32+32))
                assert recovered.tobytes() == cell.tobytes(), role
                assert result.crop((ox+col*24, oy+row*32, ox+col*24+4, oy+row*32+32)).getchannel('A').getbbox() is None
                assert result.crop((ox+col*24+20, oy+row*32, ox+col*24+24, oy+row*32+32)).getchannel('A').getbbox() is None
        checks.append({'role': role, 'candidate': candidate['id'], 'sourceSha256': candidate['sourceSha256'], 'posesCompared': 12})
    if group == 0:
        assert result.crop((0, 0, 72, 128)).tobytes() == original.crop((0, 0, 72, 128)).tobytes()
    result.save(output / f'cast-{group+1}.png')
# Reuse the authoritative rectangular wooden notice board, not an arrow-shaped
# character prop. It is an existing public atlas tile, copied without redrawing.
atlas = Image.open(atlas_path).convert('RGBA')
tile = atlas.crop(((582 % 16)*16, (582 // 16)*16, (582 % 16+1)*16, (582 // 16+1)*16))
notice = Image.new('RGBA', (288, 256))
for row in range(8):
    for col in range(12):
        notice.paste(tile, (col*24+4, row*32+16))
notice.save(output / 'notice-board.png')
print(json.dumps({'lossless': True, 'resizing': False, 'nativeCell': [16, 32], 'runtimeCell': [24, 32], 'transparentPadding': [4, 4], 'heroPreserved': True, 'roles': checks, 'noticeBoard': {'source': str(atlas_path), 'tile': 582, 'atlasSha256': hashlib.sha256(atlas_path.read_bytes()).hexdigest(), 'resizing': False}}))
