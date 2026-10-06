"""Wait for explicitly declared native hosts before reviewing attached props."""
import hashlib
import json
from pathlib import Path


def inspect(run, rows, data, candidate_path):
    """Return (waiting reasons, ready evidence); invalid dependencies raise."""
    seed = Path(data) / 'seed.json'
    config = json.loads(seed.read_text()) if seed.is_file() else {}
    mapping = config.get('reviewDependencies', {})
    if not isinstance(mapping, dict):
        raise ValueError('reviewDependencies must be an item -> dependency list map')
    specs = mapping.get(run['item'], [])
    if not isinstance(specs, list):
        raise ValueError('reviewDependencies item must be a list')
    waiting, evidence = [], []
    for spec in specs:
        if not isinstance(spec, dict) or not spec.get('item') or not spec.get('candidate'):
            raise ValueError('review dependency needs explicit item and candidate')
        matches = [r for r in rows if r['item'] == spec['item']
                   and f"h{r['round']}-{r['letter']}" == spec['candidate']]
        if len(matches) != 1 or matches[0]['id'] == run['id']:
            raise ValueError('missing/ambiguous/self review dependency: ' + str(spec))
        host = matches[0]
        if host['status'] in ('queued', 'running'):
            waiting.append(spec['item']); continue
        review = json.loads(host.get('review') or '{}')
        if host['status'] != 'done' or not host.get('ok') or review.get('verdict') != 'PASS':
            raise ValueError('host has not passed native review: ' + str(spec))
        path = Path(candidate_path(host))
        from PIL import Image
        with Image.open(path) as image:
            if image.convert('RGBA').getchannel('A').getbbox() is None:
                raise ValueError('transparent host placeholder: ' + str(path))
        evidence.append(dict(item=host['item'], candidate=spec['candidate'],
                             path=str(path.resolve()), sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    return waiting, evidence


def prompt(evidence):
    if not evidence: return ''
    return ('\n## 실제 제작된 받침 후보 — 검수 필수 자료\n'
            '아래 원본 PNG를 직접 열어 소품의 실제 설치면·접촉을 확인한다. '
            'v5.png 빈 자리나 이전 ctx-cand의 임시 받침은 이 후보의 근거가 아니다. '
            '이 목록은 받침 제작 검수 완료 근거이며 소품의 접촉 합격을 대신하지 않는다. '
            '좌표가 맞지 않는 이전 맥락 그림은 승인 근거로 쓰지 않는다.\n'
            + json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
