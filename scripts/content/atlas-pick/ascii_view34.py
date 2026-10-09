"""G열: E(Sonnet 손질본)를 3/4 시점 계약(modern-style-bible §10)대로 Sonnet 5.5(medium)이 다시 찍는다.

생성 그림은 정면·옆모습이라 변환만으로는 시점이 안 바뀐다 — 윗면을 새로 그려 넣는 단계.
나무·주인공은 계약상 예외(EXEMPT)라 E 그대로 둔다.
  python3 scripts/content/atlas-pick/ascii_view34.py run
  python3 scripts/content/atlas-pick/ascii_view34.py render
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ascii_post import to_img, zoom_grid, hexrgb  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
D = ROOT / 'tiledata/atlas-pick/ascii-pixelize'
V = D / 'view34'

# 새 캔버스(가로×세로)와 계약 수치
JOBS = {
    'vending_red': ((16, 30), 'prop', '자판기 1칸짜리 상자. 윗면 T=6px(위에서 본 뚜껑 판: 가장 밝은 단, 뒤 가장자리 1px 어둠선), 그 아래 앞면 F=24px(진열창·버튼·배출구). T/F 0.22~0.60.'),
    'vending_blue': ((16, 30), 'prop', '자판기 1칸짜리 상자. 윗면 T=6px(위에서 본 뚜껑 판), 그 아래 앞면 F=24px. T/F 0.22~0.60.'),
    'taxi': ((56, 32), 'vehicle', '가로(왼쪽이 앞)로 달리는 택시. 옆면 + 위에서 보이는 윗면 3면(보닛·지붕·트렁크). 지붕 윗면은 보닛·트렁크보다 높이 솟아 윗선이 계단이 된다(단차 5px 이상). 지붕 윗면 T 약 7px, 옆면 F 약 22~25px. 지붕 위 택시 표시등은 지붕 판 위에 선다. 바퀴는 옆면 아래.'),
    'guardrail': ((48, 16), 'prop', '가드레일. 레일 띠의 윗면 T=3px(위에서 본 밝은 판)과 앞면 F=6~8px(두 줄 레일), 기둥 머리 윗면 2px. T/F 0.3~0.5.'),
    'traffic_light': ((32, 48), 'exempt', '신호등. 신호 상자는 윗면 3px(위에서 본 판, 앞면보다 밝게) + 앞면(세 등). 기둥 머리 꼭대기도 윗면 2px. 팔은 위에서 보이는 윗줄 1px 밝게.'),
    'street_lamp': ((16, 40), 'exempt', '가로등. 등갓은 윗면 2~3px(위에서 본 판) + 앞면, 받침대는 윗면 2px + 앞면. 기둥은 그대로.'),
}

PROMPT = """너는 16px 도트 작가다. 이미 손질된 도트를 **3/4 시점**으로 고쳐 찍는다. 도구는 Read·Write 만 쓴다.

3/4 시점(쯔꾸르식 탑다운 RPG 맵): 바닥은 위에서 본 판이고, 물건은 **위에서 보이는 윗면 + 그 아래 앞면** 두 면으로 그린다.
옆면은 그리지 않는다(오른쪽 끝 1px 어둠만 허용). 윗면이 없거나 1~3px 띠뿐인 「정면 도면」은 틀린 그림이다. 빛은 왼쪽 위라 윗면이 가장 밝다.

대상: {name}. {spec}
1. Read {zoom} — 지금 도트(정면·옆모습, 12배 확대).
2. Read {txt} — 지금 도트의 글자 격자({w0}열 × {h0}줄). 한 글자 = 한 픽셀, '.' = 투명.
   색 글자(어두움→밝음): {legend}
3. 새 캔버스는 **{w}열 × {h}줄**. 캔버스 맨 아래 줄이 바닥(앞면 밑변). 지금 앞면 그림(창·버튼·바퀴 등 정보)을 최대한 살려 아래에 두고, 그 위에 윗면을 새로 그린다. 앞면이 줄어야 하면 비율을 지켜 다시 찍는다.
4. Write {out} 에 격자만 쓴다. 쓴 뒤 반드시 Read 로 다시 열어 줄 수({h})와 모든 줄 글자 수({w})를 세고, 틀리면 고쳐 다시 Write.
5. Write {notes} 에 윗면을 어떻게 넣었는지 한국어 3줄.

같은 글자만 쓴다. 외곽선은 끊김 없는 한 겹, 외톨이 점·체크무늬 금지.
"""


def prompts():
    res = {r['name']: r for r in json.loads((D / 'result.json').read_text(encoding='utf-8'))}
    rel = lambda p: str(p.relative_to(ROOT))
    for n, ((w, h), _, spec) in JOBS.items():
        r = res[n]
        txt = D / 'post' / f'{n}.txt'
        rows = txt.read_text(encoding='utf-8').strip('\n').split('\n')
        leg = ', '.join(f"'{k}'={v}" for k, v in sorted(r['legend'].items(), key=lambda kv: sum(hexrgb(kv[1]))))
        (V / f'{n}.prompt.md').write_text(PROMPT.format(
            name=n, spec=spec, zoom=rel(D / 'post' / f'{n}-zoom.png'), txt=rel(txt), w0=len(rows[0]), h0=len(rows),
            legend=leg, w=w, h=h, out=rel(V / f'{n}.txt'), notes=rel(V / f'{n}.notes.md')), encoding='utf-8')
        zoom_grid(to_img('\n'.join(rows), r['legend'])).save(D / 'post' / f'{n}-zoom.png')
    return list(JOBS)


def run_one(n):
    r = subprocess.run(['claude', '-p', '--model', 'sonnet', '--effort', 'medium',
                        '--allowedTools', 'Read,Write', '--output-format', 'json',
                        (V / f'{n}.prompt.md').read_text(encoding='utf-8')],
                       cwd=ROOT, capture_output=True, text=True, timeout=1800)
    (V / f'{n}.run.json').write_text(r.stdout or r.stderr, encoding='utf-8')
    return n, r.returncode


def render():
    res = {r['name']: r for r in json.loads((D / 'result.json').read_text(encoding='utf-8'))}
    out = []
    for n, ((tw, th), cls, _) in JOBS.items():
        f = V / f'{n}.txt'
        if not f.exists():
            out.append({'name': n, 'error': 'no output'}); continue
        rows = f.read_text(encoding='utf-8').strip('\n').split('\n')
        shape_ok = len(rows) == th and all(len(a) == tw for a in rows)
        padded = 0
        if not shape_ok and len(rows) == th and all(tw - 2 <= len(a) <= tw for a in rows):
            # 1~2자 모자란 줄만 양쪽에 '.' 를 반씩 채운다(감독자 보정, 결과에 표시)
            fixed = []
            for a in rows:
                k = tw - len(a); padded += k > 0
                fixed.append('.' * (k // 2) + a + '.' * (k - k // 2))
            rows, shape_ok = fixed, True
        bad = sorted({c for a in rows for c in a if c != '.' and c not in res[n]['legend']})
        check = None
        if shape_ok and not bad:
            png = V / f'{n}-view34.png'
            to_img('\n'.join(rows), res[n]['legend']).save(png)
            if cls != 'exempt':
                c = subprocess.run(['python3', 'scripts/content/atlas-pick/view34_check.py', f'{png}:{cls}'],
                                   cwd=ROOT, capture_output=True, text=True)
                check = (c.stdout or c.stderr).strip().splitlines()[-1:] if (c.stdout or c.stderr) else None
        cost = None
        try:
            cost = json.loads((V / f'{n}.run.json').read_text(encoding='utf-8')).get('total_cost_usd')
        except Exception:
            pass
        out.append({'name': n, 'size': [tw, th], 'shape_ok': shape_ok, 'padded_rows': padded, 'bad_chars': bad, 'check': check, 'cost_usd': cost})
    (V / 'view34-result.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for o in out:
        print(o)


if __name__ == '__main__':
    if sys.argv[1] == 'run':
        jobs = prompts()
        with ThreadPoolExecutor(len(jobs)) as ex:
            for n, rc in ex.map(run_one, jobs):
                print(n, rc, flush=True)
    render()
