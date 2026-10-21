"""jp_city 3/4 관문 — 이미 출하된 그림의 동결 목록(grandfathered, 2026-10-21).

왜: 판정 프로필이 바뀌면(ca6aaa9c55194dc5 → 4d8774b517f41638, 미보정) 옛 프로필 영수증이 전부 무효가 되어
이미 시트에 구워 출하한 street_hand·조립 표본·시설 실내 그림 309장 때문에 bake_jp.py 가 통째로 막혔다.
미보정 프로필로 수천 번 다시 판정해도 아무것도 증명하지 못한다(감독 결정 2026-10-21).

규칙(면제가 아니라 동결):
  · origin/main 의 특정 커밋(frozenAt)에서 관문이 보던 그림의 화소 해시를 그대로 적어 둔다.
  · 그 해시와 화소가 한 점도 다르지 않고, 그 화소 해시에 「어느 프로필이든」 통과(pass) 영수증이 있을 때만 통과로 센다(상태 'grandfathered').
  · 한 화소라도 바뀌면 동결이 풀리고, 새 그림과 같은 기준(현재 프로필 통과 · 서명된 사람 허용 · 위임 허용+Opus VQA 영수증)을 거친다.
    bake 는 이 경우 큰 소리로 알린다(gate_kinds.check_all → loud).
  · 목록에는 덧붙이지 않는다. 새 그림을 이 목록에 넣는 것은 관문 우회다 — freeze 는 한 번만 돌렸다.

  python3 scripts/content/jp-city/gate_grandfather.py            # 지금 체크아웃에서 동결 목록과 대조(모델 호출 없음)
  python3 scripts/content/jp-city/gate_grandfather.py freeze     # (한 번만) origin/main 체크아웃에서 목록을 쓴다
"""
from __future__ import annotations
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
PATH = os.path.join(REPO, 'tiledata', 'jp-city', 'gate-grandfathered.json')
sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
sys.path.insert(0, HERE)

_CACHE = None


def load() -> dict:
    """{'frozenAt': commit, 'entries': {key: {sha, kind, profile, path}}, 'bySha': {sha: key}}. 파일이 없으면 빈 목록."""
    global _CACHE
    if _CACHE is not None: return _CACHE
    if not os.path.exists(PATH):
        _CACHE = dict(frozenAt=None, entries={}, bySha={}); return _CACHE
    d = json.load(open(PATH, encoding='utf-8'))
    d['bySha'] = {e['sha']: k for k, e in d['entries'].items()}
    _CACHE = d
    return d


def is_grandfathered(sha: str, kind: str, receipt: dict | None) -> bool:
    """화소 해시가 동결 목록에 있고, 같은 종류이며, 그 해시의 영수증이 (어느 프로필이든) 통과일 때만."""
    d = load()
    key = d['bySha'].get(sha)
    if not key or not receipt: return False
    e = d['entries'][key]
    return e['kind'] == kind and receipt.get('kind') == kind and receipt.get('verdict') == 'pass'


def changed(key: str, sha: str) -> str | None:
    """동결 목록의 key 인데 화소 해시가 다르면 옛 해시를 돌려준다(아니면 None)."""
    e = load()['entries'].get(key)
    return e['sha'] if e and e['sha'] != sha else None


def targets():
    """관문(gate_kinds.state)이 보는 그림 전부: (key, png, kind). 부품은 품은 조립 그림·방 조각으로 본다."""
    import gate_kinds as GK
    out = []
    for kid in GK.gate_kits():
        if GK.is_part(kid): continue
        out.append((kid, os.path.join(GK.GATE_DIR, kid + '.png'), GK.kind_of(kid)))
    for tag, mod in (('asm', 'gate_assembled'), ('room', 'gate_rooms')):
        m = __import__(mod)
        if not os.path.exists(m.MANIFEST): continue
        for name, e in json.load(open(m.MANIFEST, encoding='utf-8')).items():
            out.append((f'{tag}:{name}', e['png'], 'structure'))
    for _b, kid, png, kind in GK.inst_items():
        if kind == 'part': continue
        out.append((kid, png, kind))
    return out


def freeze() -> None:
    import object_gate as OG
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    om = subprocess.run(['git', 'rev-parse', 'origin/main'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    if head != om: sys.exit(f'freeze 는 origin/main 체크아웃에서만 돌린다(HEAD {head[:10]} ≠ origin/main {om[:10]})')
    if os.path.exists(PATH): sys.exit(f'이미 동결됨: {PATH} — 덧붙이지 않는다')
    entries, skipped = {}, {}
    for key, png, kind in targets():
        if not os.path.exists(png): skipped[key] = '그림 파일 없음'; continue
        sha = OG.pixel_sha256(png)
        rc = OG.read_receipt(sha)
        if not rc: skipped[key] = '영수증 없음'; continue
        if rc.get('kind') != kind: skipped[key] = f"영수증 종류 {rc.get('kind')} ≠ {kind}"; continue
        if rc.get('verdict') != 'pass': skipped[key] = f"영수증 불합격({rc.get('profileHash')})"; continue
        entries[key] = dict(sha=sha, kind=kind, profile=rc.get('profileHash'), path=os.path.relpath(png, REPO) if png.startswith(REPO) else os.path.basename(png))
    doc = dict(schema='jp-gate-grandfathered/1', frozenAt=om, date='2026-10-21',
               rule='화소 해시가 같고 그 해시에 어느 프로필이든 통과 영수증이 있을 때만 통과. 한 화소라도 바뀌면 새 그림 기준. 덧붙이기 금지.',
               decidedBy='supervisor (user delegated object-gate decisions 2026-10-21)', entries=dict(sorted(entries.items())), notFrozen=dict(sorted(skipped.items())))
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1); f.write('\n')
    print(f'동결 {len(entries)} · 제외 {len(skipped)} → {os.path.relpath(PATH, REPO)} (origin/main {om[:10]})')
    for k, why in list(skipped.items())[:20]: print(f'  제외 {k}: {why}')


def compare() -> int:
    import object_gate as OG
    d = load(); same = diff = 0
    for key, png, _kind in targets():
        e = d['entries'].get(key)
        if not e or not os.path.exists(png): continue
        if OG.pixel_sha256(png) == e['sha']: same += 1
        else: diff += 1; print(f'  화소 바뀜: {key}')
    print(f"동결 {len(d['entries'])} · 그대로 {same} · 바뀜 {diff} (frozenAt {str(d['frozenAt'])[:10]})")
    return diff


if __name__ == '__main__':
    if sys.argv[1:] == ['freeze']: freeze()
    else: compare()
