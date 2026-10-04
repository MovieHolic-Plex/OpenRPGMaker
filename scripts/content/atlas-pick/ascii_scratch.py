"""F열: Sonnet 5.5(medium)이 원본 그림 없이 처음부터 글자 격자로 바로 찍는다.

C·E 와 같은 크기·같은 색 글자(물건별 10색)를 쓰게 해서 나란히 비교한다. 생성 그림은 보여 주지 않는다.
  python3 scripts/content/atlas-pick/ascii_scratch.py run      # claude -p 9개 병렬
  python3 scripts/content/atlas-pick/ascii_scratch.py render
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ascii_post import to_img, zoom_grid, hexrgb  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
D = ROOT / 'tiledata/atlas-pick/ascii-pixelize'
S = D / 'fresh'

DESC = {
    'tree_sakura': '벚나무 가로수. 분홍 꽃 수관(둥근 덩어리 여럿), 갈색 줄기, 밑동 풀. 캔버스 전체 크기로.',
    'tree_green': '초록 활엽 가로수. 잎 덩어리 여럿으로 된 둥근 수관, 갈색 줄기, 밑동 풀.',
    'vending_red': '빨간 음료 자판기 정면. 위 진열창에 음료 병 두 줄, 오른쪽 버튼·동전 투입구, 아래 배출구.',
    'vending_blue': '파란 음료 자판기 정면. 위 진열창에 음료 두 줄, 오른쪽 버튼, 아래 배출구.',
    'street_lamp': '가로등. 가는 금속 기둥이 위에서 왼쪽으로 휘고 끝에 등갓과 노란 불빛, 아래 받침.',
    'traffic_light': '신호등. 왼쪽 세로 기둥, 위에서 오른쪽으로 뻗은 팔에 가로 신호등 상자(초록·노랑·빨강 세 등, 빨강 켜짐).',
    'hero': '현대 청년 주인공, 정면으로 선 모습. 검은 짧은 머리, 남색 재킷, 흰 셔츠, 남색 바지, 흰 운동화.',
    'taxi': '노란 택시 옆모습(왼쪽이 앞). 지붕 위 택시 표시등, 창 두 개, 앞뒤 바퀴, 앞등·뒷등.',
    'guardrail': '도로 가드레일 옆모습. 가로로 긴 금속 레일 두 줄 띠, 양 끝 기둥 두 개.',
}

PROMPT = """너는 16px 도트 작가다. 참고 그림 없이 처음부터 도트를 찍는다. 도구는 Read·Write 만 쓴다.

대상: {name} — {desc}
캔버스: {w}열 × {h}줄(한 글자 = 한 픽셀). '.' = 투명. 현대 도시 RPG 맵 소품, 빛은 왼쪽 위.
쓸 수 있는 색 글자(어두움→밝음, 이것만): {legend}
물건 크기 감각: 주인공이 16×24, 자판기 16×26, 택시 56×24, 가로수 32×48. 캔버스 아래 줄이 바닥이다.

할 일: 격자를 Write {out} 에 쓴다(격자만, 다른 글 없이). 쓴 뒤 반드시 Read 로 다시 열어 줄 수({h})와 모든 줄의 글자 수({w})를 세어 확인하고, 틀리면 고쳐 다시 Write 한다.
그다음 Write {notes} 에 어떻게 찍었는지 한국어 3줄.

도트 기준: 바깥 윤곽은 끊김 없는 한 겹(가장 어두운 글자), 넓은 면은 깨끗하게, 명암은 왼쪽 위 밝음·오른쪽 아래 어두움 2~3단, 1~2px 정보(창·불빛·버튼·얼굴·바퀴)는 읽히게. 외톨이 점·체크무늬 얼룩 금지.
"""


def prompts():
    res = json.loads((D / 'result.json').read_text(encoding='utf-8'))
    rel = lambda p: str(p.relative_to(ROOT))
    for r in res:
        n = r['name']
        leg = ', '.join(f"'{k}'={v}" for k, v in sorted(r['legend'].items(), key=lambda kv: sum(hexrgb(kv[1]))))
        (S / f'{n}.prompt.md').write_text(PROMPT.format(
            name=n, desc=DESC[n], w=r['target'][0], h=r['target'][1], legend=leg,
            out=rel(S / f'{n}.txt'), notes=rel(S / f'{n}.notes.md')), encoding='utf-8')
    return [r['name'] for r in res]


def run_one(n):
    r = subprocess.run(['claude', '-p', '--model', 'sonnet', '--effort', 'medium',
                        '--allowedTools', 'Read,Write', '--output-format', 'json',
                        (S / f'{n}.prompt.md').read_text(encoding='utf-8')],
                       cwd=ROOT, capture_output=True, text=True, timeout=1800)
    (S / f'{n}.run.json').write_text(r.stdout or r.stderr, encoding='utf-8')
    return n, r.returncode


def render():
    res = json.loads((D / 'result.json').read_text(encoding='utf-8'))
    out = []
    for r in res:
        n = r['name']; f = S / f'{n}.txt'
        if not f.exists():
            out.append({'name': n, 'error': 'no output'}); continue
        rows = f.read_text(encoding='utf-8').strip('\n').split('\n')
        tw, th = r['target']
        shape_ok = len(rows) == th and all(len(a) == tw for a in rows)
        padded = 0
        if not shape_ok and len(rows) == th and all(tw - 2 <= len(a) <= tw for a in rows):
            # 줄 길이가 1~2자 모자란 줄만 양쪽에 '.' 를 반씩 채운다(감독자 보정, 결과에 표시)
            fixed = []
            for a in rows:
                k = tw - len(a); padded += k > 0
                fixed.append('.' * (k // 2) + a + '.' * (k - k // 2))
            rows, shape_ok = fixed, True
        bad = sorted({c for a in rows for c in a if c != '.' and c not in r['legend']})
        if shape_ok and not bad:
            to_img('\n'.join(rows), r['legend']).save(S / f'{n}-scratch.png')
        cost = None
        try:
            cost = json.loads((S / f'{n}.run.json').read_text(encoding='utf-8')).get('total_cost_usd')
        except Exception:
            pass
        out.append({'name': n, 'shape_ok': shape_ok, 'padded_rows': padded, 'bad_chars': bad, 'cost_usd': cost})
    (S / 'scratch-result.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for o in out:
        print(o)


if __name__ == '__main__':
    if sys.argv[1] == 'run':
        jobs = prompts()
        with ThreadPoolExecutor(9) as ex:
            for n, rc in ex.map(run_one, jobs):
                print(n, rc, flush=True)
    render()
