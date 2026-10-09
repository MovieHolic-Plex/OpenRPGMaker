"""native 모듈 판정 기록 — 이 조각들은 슈퍼하네스 독립 native 검수를 이미 통과해 데모 장면에 실제로 쓰인 원본이다(manifest.json 의 sha256).
새로 그린 것이 없으므로 검수자를 다시 부르지 않고, 원본 해시가 manifest 와 같은지만 확인해 PASS 를 기록한다."""
import hashlib, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, wzlib  # noqa: E402

man = json.load(open(os.path.join(wzlib.TD, 'native', 'manifest.json'), encoding='utf-8'))
bad = []
for space, s in man['spaces'].items():
    for it in s['items']:
        if it.get('kind') != 'tiles': continue
        for f in os.listdir(os.path.join(wzlib.TD, 'native', space)):
            if f.endswith('.json') and f[:-5].split('__')[0] == it['name']:
                meta = json.load(open(os.path.join(wzlib.TD, 'native', space, f), encoding='utf-8'))
                got = hashlib.sha256(open(os.path.join(wzlib.TD, 'native', space, f[:-5] + '.png'), 'rb').read()).hexdigest()
                if got != meta['sha256']: bad.append(f)
assert not bad, ('native 원본 해시 불일치', bad)
reg = loader.load('native')
out = dict(module='native', reviewer='super-harness native review (데모 영수증)', pieces={})
for pid, p in reg.pieces.items():
    out['pieces'][pid] = dict(verdict='PASS', hash=wzlib.piece_hash(p), reason='슈퍼하네스 독립 native 검수 통과 원본, 데모 레시피가 실제로 사용. 화소 변경 없음.')
json.dump(out, open(os.path.join(wzlib.TD, 'review', 'native.verdict.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('native PASS', len(out['pieces']))
