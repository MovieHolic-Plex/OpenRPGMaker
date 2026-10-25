"""building-kit massing 건물 그림을 그리기 스크립트로 다시 만들고, 커밋된 그림과 바이트가 같은지 확인한다.

    python3 scripts/content/building-kit/massing/regen.py [id …] [--check]

work/<id>/draw.py 가 harness-data/building-kit/massing/art/<id>.txt|json 을 다시 쓴다(난수 없음). --check 는 다시 쓰기 전 내용을
기억해 두었다가 바이트·화소 해시를 비교하고, 하나라도 다르면 종료코드 1. 저장소 루트에서 돌린다(스크립트가 상대 경로를 쓴다).
"""
import hashlib
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = HERE.rsplit('/scripts/content/building-kit/', 1)[0]
WORK = os.path.join(HERE, 'work')
ART = os.path.join(ROOT, 'harness-data', 'building-kit', 'massing', 'art')
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'building-kit'))


def pixel_sha(bid):
    import massing as M
    return M.pixel_sha(bid)


def main(argv):
    check = '--check' in argv
    ids = [a for a in argv if not a.startswith('-')] or sorted(d for d in os.listdir(WORK) if os.path.isfile(os.path.join(WORK, d, 'draw.py')))
    bad = []
    for bid in ids:
        files = [os.path.join(ART, f'{bid}.{e}') for e in ('txt', 'json')]
        before = [open(f, 'rb').read() if os.path.exists(f) else None for f in files]
        psha = pixel_sha(bid) if check and before[0] is not None else None
        r = subprocess.run([sys.executable, os.path.join(WORK, bid, 'draw.py')], cwd=ROOT, capture_output=True, text=True,
                           env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        if r.returncode:
            bad.append(bid)
            print(f'  FAIL {bid}: draw.py 종료코드 {r.returncode}\n{r.stderr[-1500:]}')
            continue
        after = [open(f, 'rb').read() for f in files]
        if check:
            same = [a == b for a, b in zip(before, after)]
            ps2 = pixel_sha(bid)
            ok = all(same) and psha == ps2
            if not ok:
                bad.append(bid)
            print(f'  {"same" if ok else "DIFF"} {bid:16} txt={"=" if same[0] else "≠"} json={"=" if same[1] else "≠"} '
                  f'pixel {ps2[:12]}{"" if psha == ps2 else " (was " + str(psha)[:12] + ")"} sha256(txt) {hashlib.sha256(after[0]).hexdigest()[:12]}')
        else:
            print(f'  wrote {bid}')
    print(f'{len(ids) - len(bad)}/{len(ids)} {"같음" if check else "완료"}' + (f' · 다름/실패 {bad}' if bad else ''))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
