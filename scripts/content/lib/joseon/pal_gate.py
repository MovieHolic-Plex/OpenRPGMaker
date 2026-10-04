"""조선 궁 내부 조각(pal_)만 관문(P·E·T·L·S·TR·V)을 돌려 요약한다(하네스 gate 는 카탈로그 전체라 길다). A(적대 리뷰)는 건너뛴다.
    python3 inb_gate.py [--all]     # --all: ok 줄도 출력"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'harness'))
import gate
rows, fails, warns, objs = gate.run(skip_a=True)
ins = [r for r in rows if r[0].startswith('pal_')]
bad = [r for r in ins if not r[2].startswith('ok')]
for n, c, st, info in (ins if '--all' in sys.argv else bad):
    print(f'{n:24s} {c:6s} {st}' + (f'  [{info}]' if info else ''))
nf = sum(1 for r in ins if r[2].startswith('FAIL'))
nw = sum(1 for r in ins if r[2].startswith('WARN'))
print(f'\npal_ 전체 {len(ins)} / FAIL {nf} / WARN {nw} (카탈로그 전체 FAIL {fails})')
