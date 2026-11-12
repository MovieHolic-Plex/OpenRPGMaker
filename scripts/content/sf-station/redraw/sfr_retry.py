"""깨진 그림에 한 번 더(계약 §2): 결함을 영어로 적어 같은 프롬프트 끝에 붙이고 __3 으로 부른다. 이미 둘째 호출을 쓴 단위는 부르지 않는다.
usage: python3 sfr_retry.py retry.json   (retry.json = {"unit id": "defect text" | {"defect": "...", "text": "새 설명(선택)"}})"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
import sfr_draw as D
H = D.H
todo = json.load(open(sys.argv[1]))
byid = {o['id']: o for o in D.D['objects']}


def one(item):
    uid, spec = item
    o = byid[uid]
    if os.path.exists(f'{H}/shots/{uid}__2.json') or os.path.exists(f'{H}/shots/{uid}__3.json'):
        D.log(f'SKIP {uid}: second call already used'); return
    defect = spec if isinstance(spec, str) else spec['defect']
    p = open(f'{H}/prompts/{uid}.txt', encoding='utf-8').read()
    if not os.path.exists(f'{H}/prompts/{uid}.first.txt'): open(f'{H}/prompts/{uid}.first.txt', 'w', encoding='utf-8').write(p)
    else: p = open(f'{H}/prompts/{uid}.first.txt', encoding='utf-8').read()
    add = '\n== YOUR PREVIOUS ATTEMPT AT THIS PICTURE WAS REJECTED ==\nDefect: ' + defect + '\nThis is the last attempt. Fix exactly this defect and keep everything else of the brief.\n'
    p = p.replace('\n== OUTPUT FORMAT (strict) ==', add + '\n== OUTPUT FORMAT (strict) ==')
    open(f'{H}/prompts/{uid}.txt', 'w', encoding='utf-8').write(p)
    d = D.call(o, 3)
    if d is None: return
    r = D.L.read_answer(o, (d.get('cli') or {}).get('result'))
    D.log(f'RETRY {uid}: picture={r["lenientOk"]} strict={r["strictOk"]} {r["strictErrors"][:3]}')


with ThreadPoolExecutor(4) as ex: list(ex.map(one, todo.items()))
n, usd = D.spent(); D.log(f'done: {n} calls, ${usd:.2f}')
