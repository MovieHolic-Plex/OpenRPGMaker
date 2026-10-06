#!/usr/bin/env python3
"""jp_city 적대적 검증 관문 — 굽기·게시 전에 **다른 모델 검수자**가 그림·지도·검사 보고를 깎아내리듯 본다.

  python3 scripts/content/jp-city/gate/adversarial_gate.py run   --stage school --files a.png b.png out/report.json --focus "학교 교정"
  python3 scripts/content/jp-city/gate/adversarial_gate.py check --stage school          # 통과 판정 + 파일 해시 일치가 아니면 종료 코드 1
  python3 scripts/content/jp-city/gate/adversarial_gate.py show  --stage school

- 검수자 = `claude -p --model opus --effort medium`(감독과 다른 세션, 도구는 Read 만 쓰게 지시). 판정 JSON 을 받아
  `tiledata/jp-city/gates/<stage>.json` 에 **파일 sha256 과 함께** 적는다. 그림·보고가 한 바이트라도 바뀌면 `check` 가 실패한다
  → 고친 뒤에는 다시 `run` 해야 한다(판정은 손으로 고치지 않는다).
- 통과 조건: blocker·major 0건. minor 는 기록만.
- 게시 스크립트(maps/*.mjs --publish)·PR 전에 `check` 를 부른다.
"""
import argparse, hashlib, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
GATE_DIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'gates')

RUBRIC = """너는 **적대적 검수자**다. 이 산출물을 통과시키지 않을 이유를 찾는 것이 일이다. 칭찬·총평은 쓰지 마라.
대상: 번들 칩셋 jp_city(일본 동네, 16px 칸, modern3 팔레트, 손 도트)로 만든 그림·지도·검사 보고.
기준(근거 문서를 먼저 Read 하라):
- `tiledata/jp-city/research/README.md` — 실제 일본 거리의 신호와 「흔한 실수」(보도 붙인 주택가, 전선 없음, 새 집 기와, 원통 우체통, 중앙선 있는 생활도로, 담장 일직선, 붉은 등 남발, 휘어 오른 기와, 가로 현수막 노보리 …). 좌측통행.
- 시점: 정면 고정 3/4 — **윗면이 면으로 보이고 + 화면 아래쪽(남쪽) 면**. 옆면(아이소)·위에서 내려다본 평면·정면만 보이는 것은 결함.
- 화풍: 윤곽 sumi, 빛 왼쪽 위, 명암 단계가 뚜렷(뿌연 색 금지), 알파 0/255. 기존 승인 그림(`tiledata/jp-city/blocks/buildings/*.png`, `tiledata/jp-city/blocks/street_hand/_all-x2.png`)과 같은 게임으로 보여야 한다.
- 축척: 한 칸 ≈ 1m, 사람 16×24px, 문 16×28px, 한 층 32px. 차 길이 5칸, 버스 9칸, 생활도로 폭 4칸.
- 지도: 목적 있는 배치(구역 용도·동선), 막힌 문·막힌 길, 겹쳐 잘린 그림, 층 순서 오류(전선·전봇대가 지붕 밑에 깔림 등), 빈 땅이 넓게 남음, 같은 소품 기계적 반복.
- 검사 보고(JSON)가 있으면 수치를 의심하고, 그림과 보고가 맞지 않는 곳을 찾아라.
각 결함은 **어디인지**(파일·좌표 또는 위치 묘사)와 **어떻게 고칠지**를 구체적으로.
severity: blocker(게시하면 안 됨) / major(고쳐야 통과) / minor(기록).
반드시 마지막에 아래 형식의 JSON 코드 블록 하나로 끝내라:
```json
{"verdict": "pass" 또는 "fail", "findings": [{"severity": "blocker|major|minor", "file": "경로", "where": "...", "problem": "...", "fix": "..."}]}
```
blocker·major 가 하나라도 있으면 verdict 는 fail 이다."""


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def rel(p):
    return os.path.relpath(os.path.abspath(p), ROOT)


def gate_path(stage):
    return os.path.join(GATE_DIR, f'{stage}.json')


def run(stage, files, focus, model, effort, timeout):
    files = [rel(f) for f in files]
    for f in files:
        if not os.path.exists(os.path.join(ROOT, f)): sys.exit(f'파일 없음: {f}')
    hashes = {f: sha(os.path.join(ROOT, f)) for f in files}
    prev = None
    if os.path.exists(gate_path(stage)):
        prev = json.load(open(gate_path(stage), encoding='utf-8'))
    prompt = RUBRIC + f"\n\n## 이번 단계: {stage}\n{focus}\n\n## 볼 파일(전부 Read 로 직접 열어 본다 — 그림은 확대해서 칸 단위로)\n" + '\n'.join(f'- `{f}`' for f in files)
    if prev and prev.get('findings'):
        prompt += '\n\n## 지난 판정의 지적(고쳐졌는지 하나씩 확인하라 — 안 고쳐졌으면 다시 지적)\n' + '\n'.join(
            f"- [{x.get('severity')}] {x.get('where', '')}: {x.get('problem', '')}" for x in prev['findings'] if x.get('severity') in ('blocker', 'major'))
    t0 = time.time()
    r = subprocess.run(['claude', '-p', prompt, '--model', model, '--effort', effort, '--dangerously-skip-permissions', '--output-format', 'text'],
                       cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    out = r.stdout
    m = re.findall(r'```json\s*(\{.*?\})\s*```', out, re.S)
    if not m: sys.exit('검수자 응답에 판정 JSON 이 없다:\n' + out[-2000:] + r.stderr[-1000:])
    v = json.loads(m[-1])
    hard = [x for x in v.get('findings', []) if x.get('severity') in ('blocker', 'major')]
    verdict = 'pass' if not hard else 'fail'
    rec = dict(stage=stage, verdict=verdict, reviewerVerdict=v.get('verdict'), reviewer=f'claude -p --model {model} --effort {effort}',
               rounds=(prev.get('rounds', 0) if prev else 0) + 1, seconds=round(time.time() - t0), focus=focus, files=hashes,
               findings=v.get('findings', []), report=out.strip()[-12000:])
    os.makedirs(GATE_DIR, exist_ok=True)
    with open(gate_path(stage), 'w', encoding='utf-8') as f: f.write(json.dumps(rec, ensure_ascii=False, indent=1) + '\n')
    show(stage)
    return 0 if verdict == 'pass' else 2


def check(stage):
    p = gate_path(stage)
    if not os.path.exists(p): print(f'✗ 관문 {stage}: 판정 없음 — run 먼저'); return 1
    rec = json.load(open(p, encoding='utf-8'))
    bad = [f for f, h in rec['files'].items() if not os.path.exists(os.path.join(ROOT, f)) or sha(os.path.join(ROOT, f)) != h]
    if bad: print(f'✗ 관문 {stage}: 판정 뒤 바뀐 파일 {len(bad)} — 다시 run: ' + ', '.join(bad[:6])); return 1
    if rec['verdict'] != 'pass': print(f'✗ 관문 {stage}: fail (blocker·major {sum(1 for x in rec["findings"] if x["severity"] in ("blocker", "major"))})'); return 1
    print(f'✓ 관문 {stage}: pass · {rec["rounds"]}회차 · 파일 {len(rec["files"])} · minor {sum(1 for x in rec["findings"] if x["severity"] == "minor")}')
    return 0


def show(stage):
    rec = json.load(open(gate_path(stage), encoding='utf-8'))
    print(f'관문 {stage}: {rec["verdict"]} ({rec["rounds"]}회차, {rec["seconds"]}s)')
    for x in rec['findings']:
        print(f"  [{x.get('severity')}] {x.get('file', '')} {x.get('where', '')}\n      문제: {x.get('problem', '')}\n      고침: {x.get('fix', '')}")


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run', 'check', 'show'])
    ap.add_argument('--stage', required=True)
    ap.add_argument('--files', nargs='*', default=[])
    ap.add_argument('--focus', default='')
    ap.add_argument('--model', default='opus')
    ap.add_argument('--effort', default='medium')
    ap.add_argument('--timeout', type=int, default=1800)
    a = ap.parse_args()
    if a.cmd == 'run': sys.exit(run(a.stage, a.files, a.focus, a.model, a.effort, a.timeout))
    if a.cmd == 'check': sys.exit(check(a.stage))
    show(a.stage)
