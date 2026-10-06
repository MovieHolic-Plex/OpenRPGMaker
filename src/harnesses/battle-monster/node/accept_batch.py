"""Apply a user's explicit batch Allow through the running dashboard API.

This is delegated approval, not a claim that the user clicked fifty buttons.
Real current pixel checks and an independent visual keep are required first.
Existing Deny/Modify and subsequent user steering take precedence.
"""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
import urllib.request
import uuid
from pipeline import Harness, REPO, load, save, stamp, sha


class ReviewToken(HTMLParser):
    def __init__(self):
        super().__init__()
        self.value = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'meta' and values.get('name') == 'review-token':
            self.value = values.get('content')


def request(server, path, payload=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['X-Review-Token'] = token
        headers['Origin'] = server
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(server + path, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as response:
        body = response.read().decode()
    return json.loads(body) if path.startswith('/api/') else body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--authorization', type=Path, required=True)
    parser.add_argument('--server', default='http://127.0.0.1:18346')
    parser.add_argument('--seed', default=str(REPO / 'harness-data/battle-monster/seed.json'))
    parser.add_argument('--root', default=str(REPO / 'qa-runs/harnesses/battle-monster'))
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('monsters', nargs='*', help='Only these plan species; omitted means all currently ready plan results.')
    args = parser.parse_args()
    plan = load(args.plan)
    authorization = args.authorization.read_text(encoding='utf-8')
    original = plan['authorization']['originalUserText']
    if not original.strip() or original not in authorization:
        raise ValueError('The original user instruction must be retained in the authorization file.')
    if plan['authorization'].get('source') != 'current-thread-user-goal':
        raise ValueError('Explicit current-thread user authorization is required.')
    ids = [r['id'] for r in plan['roster']]
    if len(ids) != plan['count'] or len(set(ids)) != len(ids):
        raise ValueError('Plan count/species contract is invalid.')
    if set(args.monsters) - set(ids):
        raise ValueError('Only species explicitly listed in this batch can be accepted.')
    server = args.server.rstrip('/')
    token = ReviewToken()
    token.feed(request(server, '/'))
    if not token.value:
        raise ValueError('The running dashboard review session is unavailable.')
    state = request(server, '/api/state')
    items = {i['key']: i for i in state['items']}
    records = []
    for monster in args.monsters or ids:
        key = monster + '/' + plan['candidate']
        item = items.get(key)
        if not item or not item['ready'] or item['phase'] != 'suite':
            records.append({'key': key, 'state': 'not-ready'})
            continue
        if item['choice'] in ('deny', 'modify'):
            records.append({'key': key, 'state': 'user-steering-preserved', 'choice': item['choice']})
            continue
        h = Harness(argparse.Namespace(seed=args.seed, root=args.root, monster=monster, candidate=plan['candidate']))
        directory = h.directory()
        # Published source is immutable. Revalidate it read-only rather than
        # competing with the dashboard packer's preview writes/lock.
        report = load(directory / 'check-suite.json')
        _, _, source = h.pixels(directory, 'suite')
        if not source['pass'] or source['binding'] != report['binding']:
            raise ValueError('Published source failed current pixel validation: ' + key)
        if any(sha((directory / path).read_bytes()) != digest
               for path, digest in report['images'].items()):
            raise ValueError('Published review images changed: ' + key)
        review = h.current_critique(directory, 'suite', report)
        if not report['pass'] or not review or review['recommendation'] != 'keep':
            records.append({'key': key, 'state': 'not-passed'})
            continue
        if item['bindings']['suite'] != report['binding']:
            raise ValueError('Dashboard source changed: ' + key)
        proof = {'key': key, 'binding': report['binding'], 'reviewJob': review['jobId'],
                 'visualRecommendation': 'keep', 'authorizationSha256': sha(authorization.encode()),
                 'originalUserText': original, 'humanMouseClickClaim': False}
        if item['choice'] == 'allow':
            records.append({**proof, 'state': 'already-allowed'})
            continue
        # Stable ID makes a retry idempotent; never replay a human Deny/Modify.
        request_id = str(uuid.uuid5(uuid.NAMESPACE_URL, 'battle-monster-user-goal:'
            + sha(args.plan.read_bytes()) + ':' + key + ':' + report['binding']))
        note = '사용자 목표 위임: ' + original + '\n실제 픽셀 검사 및 독립 시각 검수 keep 확인 후 Allow 반영. 사용자 마우스 클릭으로 주장하지 않음.'
        response = request(server, '/api/decision', {
            'key': key, 'version': item['version'], 'action': 'allow',
            'note': note, 'requestId': request_id,
            'delegatedGoal': {'planSha256': sha(args.plan.read_bytes()), 'originalUserText': original},
        }, token.value)
        if response.get('saved') is not True:
            raise ValueError('Dashboard did not save delegated Allow: ' + key)
        records.append({**proof, 'state': 'allow-saved', 'requestId': request_id})
        save(args.out, {'at': stamp(), 'records': records})
        print(monster + ': delegated Allow saved', flush=True)
    save(args.out, {'at': stamp(), 'records': records})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
