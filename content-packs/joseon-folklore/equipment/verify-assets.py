#!/usr/bin/env python3
"""Individual saved-art inspection/reproduction smoke. Does not grant visual approval."""
from pathlib import Path
from PIL import Image, __version__
import hashlib
import json
import platform
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    assets=json.loads((ROOT/'assets.json').read_text())
    assert len(assets)==36
    files=sorted((ROOT/'icons').glob('*.png'))+[ROOT/'assets.json']+sorted((ROOT/'review').glob('*.png'))
    before={str(p.relative_to(ROOT)):sha(p) for p in files}
    subprocess.run([sys.executable,str(ROOT/'draw.py')],check=True)
    after={str(p.relative_to(ROOT)):sha(p) for p in files}
    assert before==after,'PNG or assets manifest changed during reproduction'
    checks=[]
    for a in assets:
        p=ROOT/a['sourcePath']; im=Image.open(p); im.load()
        assert im.size==(32,32) and im.mode=='RGBA'
        alpha=im.getchannel('A'); bbox=alpha.getbbox()
        assert set(alpha.tobytes())=={0,255}
        assert bbox[0]>0 and bbox[1]>0 and bbox[2]<32 and bbox[3]<32
        rgba=hashlib.sha256(im.tobytes()).hexdigest()
        assert rgba==a['rgbaSha256'] and sha(p)==a['sha256']
        checks.append(dict(file=a['sourcePath'],sha256=sha(p),rgbaSha256=rgba,
                           size=[32,32],mode='RGBA',alphaValues=[0,255],
                           occupiedBoundsExclusive=list(bbox),paletteColourCountIncludingTransparent=len(im.getcolors())))
    assert len({c['rgbaSha256'] for c in checks})==36
    pilot=json.loads((ROOT/'review/pilot-baseline.json').read_text())
    for old in pilot['assets']:
        assert next(a for a in assets if a['resourceId']==old['resourceId'])==old
    evidence=dict(command='python3 content-packs/joseon-folklore/equipment/verify-assets.py',
                  python=platform.python_version(),pillow=__version__,
                  byteIdenticalAfterRegeneration=True,preservedPilotIcons=8,
                  uniqueRgbaImages=36,savedFileSha256=after,
                  sourceSha256={f:sha(ROOT/f) for f in ['author.py','draw.py','verify-assets.py','run-smoke.mjs','smoke.mts']},
                  imageChecks=checks,userApproved=False)
    (ROOT/'review/reproducibility.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    print('36 PNGs decoded; 36 unique RGBA hashes; regeneration byte-identical; reviewed pilot eight preserved.')


if __name__=='__main__':
    main()
