# 전투 배경 특수 7장 — 장소 그림 함수 복사본 만들기.
#   python3 vendor.py  → src/<장소>/ 에 그 장소의 그림 모듈(make_* 제외)과 vendor/ 를 복사한다.
# 원본 장소 폴더는 읽기만 한다. 복사본은 두 단 깊은 곳(battle-bg-special/src/<장소>/)에 있으므로
# 상대 경로 `(HERE, '..'` · `(_ME, '..'` 앞에 '..' 두 개를 더해 원래 가리키던 공용 폴더를 그대로 가리키게 한다.
import os, re, shutil
ME = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(ME, '..'))
PLACES = ['ghost-train', 'opera-stage', 'veldt-coliseum', 'cultist-tower', 'desert-castle',
          'prehistoric-village', 'wasteland-world']
SKIP = re.compile(r'^(make_|compare_ref|preview)')

def patch(src):
    return re.sub(r"\((HERE|_ME), '\.\.'", r"(\1, '..', '..', '..'", src)

def copy_dir(a, b):
    os.makedirs(b, exist_ok=True)
    for f in sorted(os.listdir(a)):
        if f.endswith('.py') and not SKIP.match(f):
            with open(os.path.join(a, f), encoding='utf-8') as fh: s = fh.read()
            with open(os.path.join(b, f), 'w', encoding='utf-8') as fh: fh.write(patch(s))

for p in PLACES:
    dst = os.path.join(ME, 'src', p)
    if os.path.isdir(dst): shutil.rmtree(dst)
    copy_dir(os.path.join(VAR, p), dst)
    v = os.path.join(VAR, p, 'vendor')
    if os.path.isdir(v): copy_dir(v, os.path.join(dst, 'vendor'))
    print(p, len(os.listdir(dst)))
