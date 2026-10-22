"""Regenerate fingerprint.bin from the upstream EasyRPG RTP ChipSet sheets (downloaded to a temp dir, never committed).

    python3 scripts/content/rtp-attribution/build_fingerprint.py
"""
from __future__ import annotations

import json
import struct
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rtp_match import FINGERPRINT, MAGIC, RTP_COMMIT, RTP_SHEETS, STRIDE, W, load_rgba, window_hashes  # noqa: E402


def main() -> None:
    entries: dict[int, int] = {}
    with tempfile.TemporaryDirectory() as tmp:
        for si, name in enumerate(RTP_SHEETS):
            url = f'https://raw.githubusercontent.com/EasyRPG/RTP/{RTP_COMMIT}/ChipSet/{name}.png'
            dst = Path(tmp) / f'{name}.png'
            urllib.request.urlretrieve(url, dst)
            a = load_rgba(dst)
            for flip in range(4):
                b = a
                if flip & 1:
                    b = b[:, ::-1]
                if flip & 2:
                    b = b[::-1]
                b = np.ascontiguousarray(b)
                ex, op = window_hashes(b)
                codes = b[..., :3].astype(np.int64) @ np.array([65536, 256, 1])
                for y in range(0, ex.shape[0], STRIDE):
                    for x in range(0, ex.shape[1], STRIDE):
                        o = op[y:y + W, x:x + W]
                        if o.sum() < 24 or len(np.unique(codes[y:y + W, x:x + W][o])) < 3:
                            continue
                        entries.setdefault(int(ex[y, x]), si)
            print(name, len(entries), flush=True)
    keys = np.array(sorted(entries), dtype='<u8')
    src = np.array([entries[int(k)] for k in keys], dtype=np.uint8)
    header = json.dumps({'count': len(keys), 'sheets': RTP_SHEETS, 'commit': RTP_COMMIT, 'window': W, 'stride': STRIDE}).encode()
    FINGERPRINT.write_bytes(MAGIC + struct.pack('<I', len(header)) + header + keys.tobytes() + src.tobytes())
    print('wrote', FINGERPRINT, len(keys), 'hashes')


if __name__ == '__main__':
    main()
