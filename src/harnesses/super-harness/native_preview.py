"""Deploy a portable draft on the local player server, including its asset base."""
import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[3]


def atomic(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(value)
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def deploy(packet, preview, note):
    packet, preview = packet.resolve(), preview.resolve()
    if preview.parent != ROOT / 'qa-runs':
        raise ValueError('Preview must be a direct child of this checkout qa-runs')
    source = packet / 'project.oprn.json'
    content = source.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    proof = json.loads((packet / 'draft-project-proof.json').read_text())
    if proof.get('sha256') != digest or not proof.get('authoringValid'):
        raise ValueError('Draft project does not match its preparation proof')
    title = json.loads(content)['meta']['title']
    public = ROOT / 'public/assets'
    for name in ('easyrpg-chipset-exterior.png', 'dialogue-frame.png'):
        if not (public / name).is_file():
            raise ValueError('Missing player resource: ' + name)
    preview.mkdir(parents=True, exist_ok=True)
    assets = preview / 'assets'
    if assets.exists() or assets.is_symlink():
        if assets.resolve() != public.resolve():
            raise ValueError('Preview assets already point at another resource directory')
    else:
        assets.symlink_to(os.path.relpath(public, preview), target_is_directory=True)
    boot = json.dumps({'projectUrl': './project.json', 'saveNamespace': 'native-draft-' + digest[:16]})
    document = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>' + html.escape(title) + '</title><style>'
                '.draft-note{position:fixed;z-index:2147483647;right:8px;top:8px;max-width:min(420px,85vw);padding:10px 14px;'
                'background:#172329ed;color:#f2ece0;border:1px solid #687773;border-radius:8px;font:13px/1.6 sans-serif}'
                '.draft-note summary{cursor:pointer;font-weight:bold}.draft-note p{margin:5px 0}</style></head><body>'
                '<details class="draft-note"><summary>제작 중 · 플레이 초안 안내</summary>'
                '<p>방향키 이동 · Enter 또는 Z 조사 · Esc 취소</p><p>' + html.escape(note) + '</p></details>'
                '<div id="app"></div><script>window.__OPENRPG_BOOT__=' + boot + ';</script>'
                '<script type="module" src="/src/player/exportEntry.ts"></script></body></html>')
    atomic(preview / 'project.json', content)
    atomic(preview / 'index.html', document.encode())
    result = {'status': 'draft-not-complete', 'project': str(source), 'sha256': digest,
              'preview': str(preview), 'assets': str(assets.resolve()), 'canonicalReload': False}
    atomic(preview / 'deployment.json', (json.dumps(result, indent=2) + '\n').encode())
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--packet', type=Path, required=True)
    parser.add_argument('--preview-dir', type=Path, required=True)
    parser.add_argument('--note', required=True)
    args = parser.parse_args()
    print(json.dumps(deploy(args.packet, args.preview_dir, args.note), ensure_ascii=False))
