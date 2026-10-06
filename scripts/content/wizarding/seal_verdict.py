"""검수자의 판정(review/<모듈>.judgments.json)을 현재 그림 해시에 묶어 review/<모듈>.verdict.json 으로 봉인한다.
  python3 scripts/content/wizarding/seal_verdict.py <모듈>
judgments.json 형식: {"<id>": {"verdict": "PASS"|"FAIL", "reason": "근거(무엇으로 읽히나·시점·축척·화풍)"}, ...}
조각·오토타일·캐릭터 id 모두 같은 표에 둔다. 판정이 없는 id 는 미검수로 남는다(굽기에서 빠진다). 그림을 고치면 해시가 바뀌어 다시 검수해야 한다."""
import datetime, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, wzlib, bake_wz  # noqa: E402

mod = sys.argv[1]
reg = loader.load(mod)
J = json.load(open(os.path.join(wzlib.TD, 'review', f'{mod}.judgments.json'), encoding='utf-8'))
out = dict(module=mod, sealed=datetime.datetime.now().astimezone().isoformat(), reviewer=J.pop('_reviewer', 'independent reviewer'),
           pieces={}, autotiles={}, characters={})
unknown = []
for k, j in J.items():
    if k.startswith('_'): continue
    if k in reg.pieces: sect, h = 'pieces', wzlib.piece_hash(reg.pieces[k])
    elif k in reg.autotiles: sect, h = 'autotiles', bake_wz.auto_hash(reg.autotiles[k])
    elif k in reg.characters: sect, h = 'characters', bake_wz.char_hash(reg.characters[k])
    else: unknown.append(k); continue
    v = str(j.get('verdict', '')).upper()
    assert v in ('PASS', 'FAIL'), (k, v)
    out[sect][k] = dict(verdict=v, hash=h, reason=str(j.get('reason', ''))[:600])
allids = set(reg.pieces) | set(reg.autotiles) | set(reg.characters)
missing = sorted(allids - set(J))
json.dump(out, open(os.path.join(wzlib.TD, 'review', f'{mod}.verdict.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = {s: sum(1 for v in out[s].values() if v['verdict'] == 'PASS') for s in ('pieces', 'autotiles', 'characters')}
f = sum(1 for s in ('pieces', 'autotiles', 'characters') for v in out[s].values() if v['verdict'] == 'FAIL')
print(f'{mod}: PASS {n} · FAIL {f} · 판정 없음 {len(missing)} {missing[:10]} · 모르는 id {unknown[:10]}')
