#!/usr/bin/env python3
"""버들항 변형 20곳 — 사용자가 고른(BEFORE/AFTER) 조각·맵 렌더를 저장소 tiledata/beodeul-variants/ 로 옮긴다.

정본 = ~/.local/share/oprn/beodeul-pick/picks.sqlite (current: item_id → choice before|after|redo)
  item_id = var<n>/<장소>/parts/<파일>.png 또는 var<n>/<장소>/render-1x.png
  after/없음(안 고름) → 각 변형 워크트리의 현재 파일  ~/.t3/worktrees/rpg-zzu/beodeul-var<n>/tiledata/beodeul-variants/<장소>/…
  before             → 재작업 전 사본               ~/.local/share/oprn/beodeul-pick/before/var<n>/<장소>/…
  redo               → 뺀다(다시 그리는 중). 다시 그린 뒤(파일 mtime > 고른 시각) 아직 안 고른 것도 뺀다.
  var6 은 재작업 중이라 통째로 뺀다(VARS 에 없다). 다시 그리기가 끝나면 이 스크립트를 다시 돌린다.

  python3 scripts/content/beodeul-picks/install_picks.py [--dry]

산출: tiledata/beodeul-variants/<장소>/parts/*.png · render-1x.png (고른 것만, 옛 사본은 지운다),
      장소의 plan.md·parts.md·grid.json (AFTER 워크트리 것), picks.json(정본 스냅숏), MANIFEST.md(항목별 판정).
다음 단계: python3 scripts/content/beodeul-picks/bake_picks.py (시트·키트·참고문서에 굽기).
"""
import argparse, glob, hashlib, json, os, shutil, sqlite3, time

HOME = os.path.expanduser('~')
DATA = os.path.join(HOME, '.local/share/oprn/beodeul-pick')
BEFORE = os.path.join(DATA, 'before')
WT = os.path.join(HOME, '.t3/worktrees/rpg-zzu')
DB = os.path.join(DATA, 'picks.sqlite')
VARS = {1: '마을', 2: '기후 마을', 3: '던전', 4: '특수 던전', 5: '필드'}  # var6: 재작업 중 — 제외
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DEST = os.path.join(REPO, 'tiledata', 'beodeul-variants')
META_FILES = ('plan.md', 'parts.md', 'grid.json')


def after_root(n):
    return os.path.join(WT, f'beodeul-var{n}', 'tiledata', 'beodeul-variants')


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()


def load_picks():
    c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    return {r[0]: {'choice': r[1], 'note': r[2] or '', 'ts': r[3]} for r in c.execute('select item_id, choice, note, ts from current')}


def resolve():
    picks = load_picks()
    out = []
    for n in VARS:
        rels = set()
        for root in (os.path.join(BEFORE, f'var{n}'), after_root(n)):
            for p in glob.glob(os.path.join(root, '*', 'parts', '*.png')) + glob.glob(os.path.join(root, '*', 'render-1x.png')):
                rels.add(os.path.relpath(p, root))
        for rel in sorted(rels):
            place = rel.split('/')[0]
            if place.startswith('_'):
                continue
            iid = f'var{n}/{rel}'
            b = os.path.join(BEFORE, f'var{n}', rel)
            a = os.path.join(after_root(n), rel)
            pk = picks.get(iid)
            choice = pk['choice'] if pk else None
            item = dict(id=iid, var=n, place=place, rel=rel, kind='map' if rel.endswith('render-1x.png') else 'part',
                        choice=choice, note=pk['note'] if pk else '', src=None, status='')
            if choice == 'redo':
                pending = os.path.exists(a) and os.path.getmtime(a) > (pk['ts'] or 0)
                item['status'] = 'excluded-redo-repick' if pending else 'excluded-redo'
            elif choice == 'before':
                item['src'], item['status'] = (b, 'before') if os.path.exists(b) else (None, 'excluded-missing-before')
            else:
                tag = 'after' if choice == 'after' else 'unpicked-after'
                item['src'], item['status'] = (a, tag) if os.path.exists(a) else (None, 'excluded-gone')
            out.append(item)
    return picks, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()
    picks, items = resolve()
    kept = [i for i in items if i['src']]
    places = sorted({(i['var'], i['place']) for i in items})
    counts = {}
    for i in items:
        counts[i['status']] = counts.get(i['status'], 0) + 1
    print('items', len(items), counts)
    if args.dry:
        return
    for n, place in places:
        d = os.path.join(DEST, place)
        os.makedirs(d, exist_ok=True)
        # 옛 사본(앞 PR 의 parts·렌더)은 지우고 고른 것만 둔다
        shutil.rmtree(os.path.join(d, 'parts'), ignore_errors=True)
        for old in glob.glob(os.path.join(d, 'render-*.png')) + glob.glob(os.path.join(d, 'before-render-*.png')):
            os.remove(old)
        os.makedirs(os.path.join(d, 'parts'), exist_ok=True)
        for m in META_FILES:
            s = os.path.join(after_root(n), place, m)
            if os.path.exists(s):
                shutil.copy2(s, os.path.join(d, m))
    for i in kept:
        dst = os.path.join(DEST, i['rel'])
        shutil.copy2(i['src'], dst)
        i['sha1'] = sha(dst)
    snap = {'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'source': DB, 'excludedVars': [6],
            'picks': picks, 'items': [{k: v for k, v in i.items() if k != 'src'} for i in items]}
    with open(os.path.join(DEST, 'picks.json'), 'w', encoding='utf-8') as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    lines = ['# 버들항 변형 — 고른 조각 설치 목록 (install_picks.py 가 쓴다, 손으로 고치지 말 것)', '',
             f'생성 {snap["generatedAt"]} · 정본 `~/.local/share/oprn/beodeul-pick/picks.sqlite` · var6 제외(재작업 중)', '',
             '| 판정 | 수 |', '|---|---|'] + [f'| {k} | {v} |' for k, v in sorted(counts.items())] + ['',
             '판정: `after`=AFTER 고름 · `unpicked-after`=안 고름(AFTER 로 둠) · `before`=BEFORE 사본 복원 · `excluded-redo`=둘 다 별로(다시 그리는 중) · '
             '`excluded-redo-repick`=다시 그렸고 아직 안 고름 · `excluded-gone`=AFTER 에 없음', '',
             '| 항목 | 판정 | 메모 |', '|---|---|---|']
    lines += [f'| {i["id"]} | {i["status"]} | {i["note"].replace("|", "/")} |' for i in items]
    with open(os.path.join(DEST, 'MANIFEST.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('installed', len(kept), 'files into', DEST)


if __name__ == '__main__':
    main()
