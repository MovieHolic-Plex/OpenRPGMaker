"""좌표로 직접 찍은 픽셀만 적용하는 선택적 저작 도구. 걷기를 합성하지 않는다."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

import chr as C

MODE = 'pixel-patches-v1'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def atomic(path, raw):
    fd, tmp = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        Path(tmp).unlink(missing_ok=True)


def render_patch(raw, patch):
    if not isinstance(patch, dict) or set(patch) - {'version', 'sourceSha256', 'palette', 'ops'}:
        raise ValueError('patch는 version/sourceSha256/palette/ops만 사용합니다')
    if type(patch.get('version')) is not int or patch['version'] != 1 or patch.get('sourceSha256') != sha(raw):
        raise ValueError('patch 버전 또는 현재 격자의 sourceSha256이 다릅니다')
    pal, notes, frames = C.parse(raw.decode('utf-8'))
    if errors := C.structural_errors(pal, frames):
        raise C.GridError('; '.join(errors[:5]))
    colors = patch.get('palette', {})
    if not isinstance(colors, dict):
        raise ValueError('palette는 {글자: "#rrggbb"} 객체입니다')
    for ch, color in colors.items():
        if (not isinstance(ch, str) or len(ch) != 1 or not ch.isascii()
                or not ch.isprintable() or ch.isspace() or ch in ('.', '#')):
            raise ValueError('새 팔레트 글자는 .과 #을 제외한 출력 가능한 ASCII 한 글자입니다')
        if not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
            raise ValueError('팔레트 색은 #rrggbb입니다')
        rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
        if all(abs(a - b) <= C.KEY_TOLERANCE for a, b in zip(rgb, C.KEY)):
            raise ValueError('투명 키 색과 ±8 범위는 몸체 색으로 사용할 수 없습니다')
        pal[ch] = rgb
    ops = patch.get('ops', [])
    if not isinstance(ops, list) or len(ops) > 10000 or (not ops and not colors):
        raise ValueError('ops는 직접 찍을 픽셀 묶음 목록이며 최대 10000개입니다')
    changed = {}
    for op in ops:
        if not isinstance(op, dict) or set(op) - {'frame', 'x', 'y', 'pixels', 'before'}:
            raise ValueError('픽셀 명령은 frame/x/y/pixels/before만 사용합니다')
        frame = op.get('frame')
        if not isinstance(frame, str) or not (m := re.fullmatch(r'(up|right|down|left) ([012])', frame)):
            raise ValueError('frame은 "down 1"처럼 방향과 자세를 지정합니다')
        key = (m[1], int(m[2]))
        x, y, pixels = op.get('x'), op.get('y'), op.get('pixels')
        if type(x) is not int or type(y) is not int or not isinstance(pixels, str) or not pixels:
            raise ValueError('x/y는 정수, pixels는 직접 작성한 색 글자열입니다')
        if not 0 <= y < C.FH or not 0 <= x < C.FW or x + len(pixels) > C.FW:
            raise ValueError('픽셀 명령이 24×32 프레임 밖으로 나갑니다')
        if any(ch not in pal for ch in pixels):
            raise ValueError('팔레트에 없는 색 글자가 있습니다')
        row = frames[key][y]
        before = row[x:x + len(pixels)]
        if 'before' in op and op['before'] != before:
            raise ValueError('before와 현재 픽셀이 다릅니다')
        count = sum(pal[a] != pal[b] for a, b in zip(before, pixels))
        if count:
            changed[frame] = changed.get(frame, 0) + count
        frames[key][y] = row[:x] + pixels + row[x + len(pixels):]
    if errors := C.structural_errors(pal, frames):
        raise C.GridError('; '.join(errors[:5]))
    return C.dump(pal, notes, frames).encode('utf-8'), changed


def replay(grid, base, require_all=True):
    journal_path = grid.parent / 'pixel-edits.json'
    journal_raw = journal_path.read_bytes()
    journal = json.loads(journal_raw)
    raw = base.read_bytes()
    if journal.get('version') != 1 or journal.get('baseSha256') != sha(raw):
        raise ValueError('좌표 저작 기록의 원본 해시가 다릅니다')
    entries = journal.get('entries')
    if not isinstance(entries, list) or not entries:
        raise ValueError('좌표 저작 기록이 비어 있습니다')
    changed = {}
    for entry in entries:
        patch_raw = json.dumps(entry['patch'], ensure_ascii=False, sort_keys=True).encode('utf-8')
        if entry['patchSha256'] != sha(patch_raw) or entry['sourceSha256'] != sha(raw):
            raise ValueError('좌표 저작 기록의 순서 또는 patch 해시가 다릅니다')
        raw, counts = render_patch(raw, entry['patch'])
        if entry['targetSha256'] != sha(raw) or entry['changedPixels'] != counts:
            raise ValueError('좌표 저작 기록을 다시 적용한 결과가 다릅니다')
        for frame, count in counts.items():
            changed[frame] = changed.get(frame, 0) + count
    if raw != grid.read_bytes():
        raise ValueError('최종 격자가 좌표 명령을 다시 적용한 결과와 다릅니다')
    expected = {f'{d} {f}' for d in C.DIRS for f in range(3)}
    if require_all and set(changed) != expected:
        raise ValueError('좌표로 직접 저작하지 않은 프레임: ' + ', '.join(sorted(expected - set(changed))))
    return dict(mode=MODE, baseSha256=journal['baseSha256'], sourceSha256=sha(raw),
                journalSha256=sha(journal_raw), steps=len(entries), frames=changed)


def apply(grid, patch_path, base):
    if grid.name != 'out.chr.txt' or grid.resolve() == base.resolve():
        raise ValueError('원본을 보존하고 out.chr.txt에만 좌표를 적용합니다')
    with (grid.parent / '.pixel-edit.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        journal_path = grid.parent / 'pixel-edits.json'
        raw = grid.read_bytes()
        if journal_path.exists():
            replay(grid, base, require_all=False)
            journal = json.loads(journal_path.read_text())
        else:
            if raw != base.read_bytes():
                raise ValueError('첫 patch는 base.chr.txt를 그대로 복사한 격자에서 시작합니다')
            journal = dict(version=1, baseSha256=sha(raw), entries=[])
        patch = json.loads(patch_path.read_text(encoding='utf-8'))
        after, changed = render_patch(raw, patch)
        patch_raw = json.dumps(patch, ensure_ascii=False, sort_keys=True).encode('utf-8')
        journal['entries'].append(dict(sourceSha256=sha(raw), targetSha256=sha(after),
                                      patchSha256=sha(patch_raw), patch=patch, changedPixels=changed))
        atomic(grid, after)
        atomic(journal_path, (json.dumps(journal, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
        return dict(sourceSha256=sha(after), changedPixels=changed, steps=len(journal['entries']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    inspect = sub.add_parser('inspect')
    inspect.add_argument('grid', type=Path)
    inspect.add_argument('--frame', nargs=2, metavar=('DIRECTION', 'POSE'))
    edit = sub.add_parser('apply')
    edit.add_argument('grid', type=Path)
    edit.add_argument('patch', type=Path)
    edit.add_argument('--base', type=Path)
    verify = sub.add_parser('verify')
    verify.add_argument('grid', type=Path)
    verify.add_argument('--base', type=Path)
    args = parser.parse_args()
    if args.command == 'inspect':
        raw = args.grid.read_bytes()
        pal, _, frames = C.parse(raw.decode('utf-8'))
        print(json.dumps(dict(sourceSha256=sha(raw), palette={ch: ('transparent' if rgb is None else '#%02x%02x%02x' % rgb)
                                                            for ch, rgb in pal.items()}), ensure_ascii=False))
        if args.frame:
            key = (args.frame[0], int(args.frame[1]))
            if key not in frames:
                raise ValueError('알 수 없는 프레임입니다')
            print('    000000000011111111112222\n    012345678901234567890123')
            for y, row in enumerate(frames[key]):
                print(f'{y:02d}: {row}')
    else:
        base = args.base or args.grid.parent / 'base.chr.txt'
        result = apply(args.grid, args.patch, base) if args.command == 'apply' else replay(args.grid, base)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
