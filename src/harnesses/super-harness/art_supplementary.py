"""Hash-bound review evidence; never overrides candidate or scene verdicts."""
from pathlib import Path
import json
import art_choices


def verify(data, cid, entries):
    data = Path(data).resolve()
    root = data / 'art-worktrees' / cid
    for entry in entries:
        art_choices.verified(root, entry['source'])
        if not str(entry.get('scope', '')).strip() or not entry.get('files'):
            raise ValueError('보충 검수 근거에 범위와 원본 파일이 필요합니다.')
        for ref in entry['files']:
            path = (data / ref['path']).resolve()
            if not path.is_relative_to(data) or art_choices.digest(path) != ref['sha256']:
                raise ValueError('보충 검수 근거 경로/해시 불일치: ' + str(path))
    return entries


def load(data, cid):
    path = Path(data) / 'concepts' / cid / 'art-supplementary-evidence.json'
    if not path.is_file():
        return []
    entries = json.loads(path.read_text())
    if not isinstance(entries, list):
        raise ValueError('보충 검수 근거는 목록이어야 합니다.')
    return verify(data, cid, entries)


def prompt(data, cid):
    entries = load(data, cid)
    if not entries:
        return ''
    return ('\n## 별도 검수의 보충 근거\nDATA 루트: ' + str(data)
            + '\n아래 원본 파일을 읽고 검수 범위를 확인한다. 새 공간의 배치·시점·벽·동작 합격을 '
            '대신하지 않는다. 과거 FAIL을 삭제하거나 이 자료만으로 PASS를 만들지 않는다. '
            '같은 원본의 기술적 재검수와 실제 그림 변경을 구별하여 불필요한 재제작을 피한다.\n'
            + '목록: ' + str(Path(data) / 'concepts' / cid / 'art-supplementary-evidence.json')
            + '\n먼저 receipt와 requiredNativeVerdicts를 읽고 해당 범위의 contextEvidence 비교 그림을 확인한다.')
