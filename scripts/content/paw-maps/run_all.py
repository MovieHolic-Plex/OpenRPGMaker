# 모든 맵 생성기(mNN_*.py)를 차례로 실행하고 사용 시트 합계를 출력한다.
import glob, os, runpy, json, sys, traceback
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
only = sys.argv[1:]
ok, bad = [], []
for f in sorted(glob.glob(HERE + '/m[0-9][0-9]_*.py')):
    mid = os.path.basename(f)[:-3]
    if only and not any(mid.startswith(o) for o in only): continue
    try: runpy.run_path(f, run_name='__main__'); ok.append(mid)
    except Exception as e: bad.append((mid, repr(e))); traceback.print_exc()
used = set()
for j in glob.glob('/home/main/claude-viz/paw-maps/m*.json'): used |= {s.split('#')[0] for s in json.load(open(j))['sheets']}
print(f'OK {len(ok)} FAIL {len(bad)} distinct-sheets {len(used)}')
for b in bad: print('FAIL', *b)
