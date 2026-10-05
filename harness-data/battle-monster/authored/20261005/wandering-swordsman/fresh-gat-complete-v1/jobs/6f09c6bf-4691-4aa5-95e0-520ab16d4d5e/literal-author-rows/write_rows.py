"""Serialize authored row strips; only transparent right/bottom padding is added.

No source frame is read, copied, transformed, or used to generate another frame.
All colored pixels are the literal strings in the authoring calls.
"""
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1]

def write(name, rows):
    rows = rows.strip('\n').splitlines()
    if len(rows) > 64 or any(len(r) > 64 for r in rows):
        raise ValueError(f'Row serialization overflow in {name}')
    text = '\n'.join(r.ljust(64, '.') for r in rows)
    text += '\n' + ('\n'.join(['.' * 64] * (64 - len(rows))) + '\n' if len(rows) < 64 else '')
    (SOURCE / name).write_text(text, encoding='ascii')
