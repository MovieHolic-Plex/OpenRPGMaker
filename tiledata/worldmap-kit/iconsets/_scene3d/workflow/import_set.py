"""스크래치 세트(~/wmi-sets/<id>)를 워크트리 iconsets/<id> 로 옮기고, 경로를 상대 경로로 바꾸고, 저장소 안에서 다시 빌드해 시트가 같은지 본다."""
import shutil, subprocess, sys, hashlib
from pathlib import Path
WT = Path('/home/main/z-project/rpg-zzu-worldmap-iconsets/tiledata/worldmap-kit/iconsets')
ABS = "'/home/main/z-project/rpg-zzu-worldmap-iconsets/tiledata/worldmap-kit/iconsets/_scene3d'"
REL = "str(Path(__file__).resolve().parent.parent / '_scene3d')"
sid = sys.argv[1]
src, dst = Path.home() / 'wmi-sets' / sid, WT / sid
h0 = hashlib.sha1((src / 'sheet.png').read_bytes()).hexdigest()
if dst.exists():
    shutil.rmtree(dst)
dst.mkdir()
for f in src.iterdir():
    if f.name in ('__pycache__', 'SET.md') or f.name.startswith('.'):
        continue
    if f.is_dir():
        shutil.copytree(f, dst / f.name)
    elif f.suffix == '.py':
        t = f.read_text()
        if 'from pathlib import Path' not in t:
            t = t.replace('import sys\n', 'import sys\nfrom pathlib import Path\n', 1)
        t = t.replace(ABS, REL)
        assert ABS not in t
        (dst / f.name).write_text(t)
    else:
        shutil.copy(f, dst / f.name)
r = subprocess.run([sys.executable, 'build.py'], cwd=dst, capture_output=True, text=True)
print(r.stdout.strip()[-300:], r.stderr.strip()[-500:])
h1 = hashlib.sha1((dst / 'sheet.png').read_bytes()).hexdigest()
print('sheet same' if h0 == h1 else 'SHEET DIFFERS')
