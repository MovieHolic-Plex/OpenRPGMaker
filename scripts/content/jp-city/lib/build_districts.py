"""지구 6장(시부야·시모키타·신주쿠·아사쿠사·아키하바라·야나카)을 jpenv.OUT 의 시트·카탈로그로 다시 조립한다(행인 없음).
  python3 build_districts.py        # → jpenv.DISTRICTS_OUT (기본 tiledata/jp-city/districts)
각 d_<지구>.py 는 독립 프로세스로 병렬 실행한다. 시트·카탈로그가 먼저 있어야 한다(bake_source.py)."""
import subprocess, sys, os
import jpenv
DISTRICTS = ('shibuya', 'shimokita', 'shinjuku', 'asakusa', 'akiba', 'yanaka')
def main():
    ps = [(d, subprocess.Popen([sys.executable, os.path.join(jpenv.LIB, f'd_{d}.py')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)) for d in DISTRICTS]
    bad = 0
    for d, p in ps:
        out = p.communicate()[0]; print(f'== {d} (exit {p.returncode})'); print(out.rstrip()); bad += p.returncode != 0
    return 1 if bad else 0
if __name__ == '__main__': sys.exit(main())
