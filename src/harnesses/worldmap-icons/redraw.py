"""월드맵 아이콘 하네스 — 다시 그리기 판.

판(round) 하나 = 아이콘 하나 × 후보 N장(방향 A~E). 작업자(Codex CLI 기본)가 후보마다 `cand.png` 를 찍고,
깨짐 검사(크기·키색·허용 색) → 독립 검수자(review.md) → 불합격이면 이유를 들고 같은 작업자가 다시 그린다(최대 ATTEMPTS).
사용자가 화면에서 후보 하나를 고르면(decision=pick) 그 후보가 그 아이콘의 새 그림 후보로 기록된다 — 시트에 굽는 건 따로.
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

import harness as H

ROUNDS = H.DATA / 'rounds'
POOL_LOCK = H.DATA / 'pool.pid'
ATTEMPTS = int(os.environ.get('WMI_HARNESS_ATTEMPTS', '3'))
REPLACE_PER_ROUND = int(os.environ.get('WMI_HARNESS_REPLACE', '2'))   # 판의 후보 수 × 이 배수만큼 폐기분을 새 후보로 채운다
DRAW_EFFORT = os.environ.get('WMI_HARNESS_DRAW_EFFORT', 'high')   # medium 은 한 바퀴로 끝내 허접했다(2026-10-02)
ENGINE = os.environ.get('WMI_HARNESS_ENGINE', 'codex')   # codex | claude
CLAUDE_MODEL = os.environ.get('WMI_HARNESS_CLAUDE_MODEL', 'claude-sonnet-5-5')
DIRECTIONS = {
    'A': '원본 재조립 — 출발 그림의 건물·지붕·창·덤불 화소를 조각으로 떼어 정면 3/4 자리로 옮겨 붙인다. 옆면 열은 버리고 정면 벽 열·지붕 줄을 반복해 메운다',
    'B': '기준 맞추기 — 출발 그림의 화소를 재료로, 원본 EasyRPG 월드 시트의 같은 종류 칸(마을·성·탑)과 구조·명암 단 수·윤곽을 맞춘다',
    'C': '단순·또렷 — 출발 그림의 화소를 재료로, 1배에서 한눈에 읽히는 큰 실루엣 하나로 정리한다(조각 수를 줄인다)',
    'D': '설명 충실 — 출발 그림의 화소를 재료로, 설명 문장의 요소와 배치(가운데·앞뒤)를 빠짐없이 맞춘다',
    'E': '자유 배치 — 출발 그림의 화소를 재료로, 시점 계약만 지키고 이 장소를 가장 잘 보여 줄 새 배치',
}


def tables(c):
    c.executescript('''
      create table if not exists rounds(id integer primary key, item text, note text, base text, n int, created text);
      create table if not exists cands(id integer primary key, round int, letter text, direction text, status text,
                                       attempt int, pid int, started text, finished text, engine text,
                                       check_json text, verdict text, codes text, body text, log text);
    ''')


def cand_dir(rnd, letter):
    return ROUNDS / f'r{rnd}' / letter


def attempt_dir(rnd, letter, att):
    return cand_dir(rnd, letter) / f'a{att}'


# ─────────────────────────────── 판 열기 ───────────────────────────────
def open_round(item_id, note='', base='', n=5, letters=None):
    """base: '' = 지금 아이콘, 'r<판>/<글자>' = 그 후보에서 출발."""
    c = H.db()
    tables(c)
    if not c.execute('select 1 from items where id=?', (item_id,)).fetchone():
        raise ValueError('없는 아이콘: ' + item_id)
    n = max(1, min(5, int(n)))
    cur = c.execute('insert into rounds(item,note,base,n,created) values(?,?,?,?,?)', (item_id, note[:2000], base, n, H.now()))
    rid = cur.lastrowid
    for L in (letters or list(DIRECTIONS)[:n]):
        c.execute('insert into cands(round,letter,direction,status,attempt) values(?,?,?,?,?)', (rid, L, DIRECTIONS[L], 'queued', 1))
    c.commit()
    ensure_pool()
    return rid


# ─────────────────────────────── 지시문 ───────────────────────────────
def _base_paths(c, rnd):
    r = c.execute('select * from rounds where id=?', (rnd,)).fetchone()
    if r['base']:
        rr, L = r['base'].split('/')
        d = _final_dir(c, int(rr[1:]), L)
        return d / 'cand.png', d / 'icon-x8.png', d / 'ctx-x3.png'
    d = H.item_dir(r['item'])
    return d / 'icon.png', d / 'icon-x8.png', d / 'ctx-x3.png'


def _final_dir(c, rnd, L):
    a = c.execute('select attempt from cands where round=? and letter=?', (rnd, L)).fetchone()
    return attempt_dir(rnd, L, a['attempt'] if a else 1)


def _palette_file(set_id):
    import render
    p = H.DATA / f'palette-{set_id}.json'
    if not p.exists():
        p.write_text(json.dumps(sorted(render.palette_of(set_id))))
    return p


def _feedback(c, item_id, rnd, letter, att):
    out = []
    r = c.execute('select note from rounds where id=?', (rnd,)).fetchone()
    if r and r['note']:
        out.append(f'- 사용자 메모(이 판): {r["note"]}')
    dec = H._latest_decisions(c).get(item_id)
    if dec and dec['decision'] == 'reject':
        out.append(f'- 사용자가 지금 그림을 버린 이유: {", ".join(dec["reasons"]) or "(칩 없음)"} {dec["note"]}')
    rv = H._latest_reviews(c).get(item_id)
    if rv and rv.get('body'):
        b = rv['body']
        out.append(f'- 검수자가 지금 그림에 단 판정: {rv["verdict"]} {",".join(rv["codes"])} — {b.get("reasons", "")} / 고칠 것: {b.get("fix", "")}')
    # 같은 아이콘의 지난 판에서 사용자가 버린 후보
    for x in c.execute('select * from decisions where item=? and decision=? order by id', (item_id, 'drop')):
        out.append(f'- 지난 후보 {x["note"].split("|")[0]} 를 사용자가 버림: {", ".join(json.loads(x["reasons"] or "[]"))} {x["note"].split("|", 1)[-1]}')
    if att > 1:
        prev = attempt_dir(rnd, letter, att - 1)
        try:
            v = json.loads((prev / 'verdict.json').read_text())
            out.append(f'- **네 지난 시도(`{prev}/cand.png`, 8배 `{prev}/icon-x8.png`)가 검수에서 떨어졌다:** {",".join(v.get("codes") or [])} — '
                       f'{v.get("reasons", "")} / 고칠 것: {v.get("fix", "")}. 지난 시도에서 출발해 이것부터 고친다.')
        except (OSError, ValueError):
            pass
    return ('## 사용자·검수자가 남긴 것 (반드시 반영)\n' + '\n'.join(out)) if out else ''


def _anchors(c, item):
    acc = [k for k, v in H._latest_decisions(c).items() if v['decision'] == 'accept' and k.startswith(item['iset'] + '/')][:4]
    if not acc:
        return ''
    return '4. 사용자가 받은 같은 세트 아이콘(화풍 기준): ' + ', '.join(f'`{H.item_dir(a) / "icon-x8.png"}`' for a in acc)


def _draw_prompt(c, cand):
    rnd, L, att = cand['round'], cand['letter'], cand['attempt']
    r = c.execute('select * from rounds where id=?', (rnd,)).fetchone()
    it = c.execute('select * from items where id=?', (r['item'],)).fetchone()
    w, h = json.loads(it['cells'])
    base_png, base_x8, base_ctx = _base_paths(c, rnd)
    out = attempt_dir(rnd, L, att)
    out.mkdir(parents=True, exist_ok=True)
    if att > 1:
        prev = attempt_dir(rnd, L, att - 1) / 'cand.png'
        if prev.exists():
            shutil.copy(prev, out / 'start.png')
    rep = {'{SET}': it['iset'], '{NAME}': it['name'], '{ROLE}': it['role'], '{ROLE_NAME}': H.role_names().get(it['role'], it['role']),
           '{W}': str(w), '{H}': str(h), '{PW}': str(w * 16), '{PH}': str(h * 16), '{DESC}': it['descr'] or '(설명 없음)',
           '{LETTER}': L, '{DIRECTION}': cand['direction'], '{OUT}': str(out), '{REF}': str(H.REF),
           '{BASE_X8}': str(base_x8), '{BASE_PNG}': str(base_png), '{BASE_CTX}': str(base_ctx),
           '{ANCHORS}': _anchors(c, it), '{FEEDBACK}': _feedback(c, it['id'], rnd, L, att),
           '{PALETTE}': str(_palette_file(it['iset'])), '{HARNESS}': str(H.HERE / 'harness.py'),
           '{SET_RULE}': H.set_rule(it['iset'])}
    t = (H.HERE / 'draw.md').read_text(encoding='utf-8')
    for k, v in rep.items():
        t = t.replace(k, v)
    return t, out


def _review_prompt(c, cand):
    rnd, L, att = cand['round'], cand['letter'], cand['attempt']
    r = c.execute('select * from rounds where id=?', (rnd,)).fetchone()
    it = dict(c.execute('select * from items where id=?', (r['item'],)).fetchone())
    t = H._prompt(it)
    out = attempt_dir(rnd, L, att)
    t = t.replace(str(H.item_dir(it['id'])), str(out))
    base_png, base_x8, _ = _base_paths(c, rnd)
    t += (f'\n\n## 다시 그린 후보다\n출발 그림 `{base_x8}` 와 비교해, 시점은 계약대로 바뀌었는지와 **같은 장소로 읽히는지**도 본다. '
          f'출발 그림보다 1배에서 덜 읽히면 `READ` 로 떨어뜨린다. '
          f'출발 그림보다 **결이 거칠면**(기와 줄·벽돌 줄눈·창·명암 단이 사라졌거나, 큰 단색 사각형으로 면을 채워 블록 장난감처럼 보이면) `STYLE` 로 떨어뜨린다.\n')
    return t, out


# ─────────────────────────────── 깨짐 검사 · 미리보기 ───────────────────────────────
def check(out, item):
    import numpy as np
    from PIL import Image
    w, h = json.loads(item['cells'])
    p = Path(out) / 'cand.png'
    res = dict(ok=False, problems=[])
    if not p.exists():
        res['problems'].append('cand.png 가 없다')
        return res
    im = Image.open(p).convert('RGB')
    if im.size != (w * 16, h * 16):
        res['problems'].append(f'크기 {im.size} ≠ {(w * 16, h * 16)}')
    a = np.array(im).reshape(-1, 3)
    key, shd = (255, 103, 139), (254, 103, 139)
    is_key = np.all(a == key, axis=1)
    is_shd = np.all(a == shd, axis=1)
    if is_key.sum() == 0:
        res['problems'].append('키색 바탕이 없다(빈 칸이 투명이 안 된다)')
    solid = a[~is_key & ~is_shd]
    if len(solid) < 0.15 * len(a):
        res['problems'].append(f'그림 화소가 너무 적다({len(solid)}/{len(a)})')
    import render
    allowed = render.palette_of(item['iset'])
    cols = {tuple(x) for x in solid.tolist()}
    bad = cols - allowed
    nbad = int(sum(1 for x in solid.tolist() if tuple(x) in bad))
    res.update(colors=len(cols), off_palette_colors=len(bad), off_palette_px=nbad)
    if bad:
        res['problems'].append(f'허용 색표 밖 색 {len(bad)}개 · 화소 {nbad}개')
    res['ok'] = not res['problems']
    return res


def preview(out, item_id=None):
    """작업자 자가 확인: out/cand.png → icon-x8 · ctx-x3 · ctx-x1 · check.json"""
    import render
    out = Path(out)
    c = H.db()
    tables(c)
    if not item_id:
        rnd = int(out.parent.parent.name[1:])
        item_id = c.execute('select item from rounds where id=?', (rnd,)).fetchone()['item']
    it = c.execute('select * from items where id=?', (item_id,)).fetchone()
    res = check(out, it)
    if (out / 'cand.png').exists() and not any('크기' in p for p in res['problems']):
        render.render_candidate(it['iset'], it['name'], it['place'], out / 'cand.png', out, H.DATA / 'cache')
    (out / 'check.json').write_text(json.dumps(res, ensure_ascii=False, indent=1))
    print(json.dumps(res, ensure_ascii=False))
    return res


# ─────────────────────────────── 작업자 실행 ───────────────────────────────
def _spawn(prompt, log, extra_dirs):
    H.WORK.mkdir(parents=True, exist_ok=True)
    pf = log.with_suffix('.prompt.txt')
    pf.write_text(prompt, encoding='utf-8')
    if ENGINE == 'claude':
        env = dict(os.environ, PH_PROMPT=prompt, PH_MODEL=CLAUDE_MODEL, PH_EFFORT=DRAW_EFFORT,
                   PH_CLAUDE=shutil.which('claude') or os.path.expanduser('~/.local/bin/claude'), PH_DIRS=' '.join(map(str, extra_dirs)))
        cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" --dangerously-skip-permissions '
                              '--output-format text $(for d in $PH_DIRS; do printf -- "--add-dir %s " "$d"; done) '
                              '--strict-mcp-config --mcp-config \'{"mcpServers":{}}\' --setting-sources project,local '
                              '--disable-slash-commands --tools Read Write Edit Bash']
        return subprocess.Popen(cmd, cwd=H.WORK, env=env, stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                                stdin=subprocess.DEVNULL, start_new_session=True), f'claude:{CLAUDE_MODEL}:{DRAW_EFFORT}'
    cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', H.CODEX_MODEL,
           '-c', f'model_reasoning_effort="{DRAW_EFFORT}"', '--skip-git-repo-check', '-s', 'workspace-write']
    for d in extra_dirs:
        cmd += ['--add-dir', str(d)]
    cmd += ['-C', str(H.WORK), '-']
    return subprocess.Popen(cmd, cwd=H.WORK, stdin=open(pf, 'rb'), stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                            start_new_session=True), f'codex:{H.CODEX_MODEL}:{DRAW_EFFORT}'


def _start(c, cand):
    phase = cand['status']          # queued(그리기) | review_queued(검수)
    H.LOGS.mkdir(parents=True, exist_ok=True)
    tag = f'r{cand["round"]}-{cand["letter"]}-a{cand["attempt"]}'
    if phase == 'queued':
        prompt, out = _draw_prompt(c, cand)
        log = H.LOGS / f'{tag}.draw.log'
        p, eng = _spawn(prompt, log, [out, H.DATA, H.ROOT])
        c.execute('update cands set status=?, pid=?, started=?, engine=?, log=? where id=?', ('drawing', p.pid, H.now(), eng, str(log), cand['id']))
    else:
        prompt, out = _review_prompt(c, cand)
        try:
            (out / 'verdict.json').unlink()
        except OSError:
            pass
        log = H.LOGS / f'{tag}.review.log'
        p = _spawn(prompt, log, [out, H.DATA, H.ROOT])[0] if ENGINE == 'claude' else _spawn_review(prompt, log, out)
        c.execute('update cands set status=?, pid=? where id=?', ('reviewing', p.pid, cand['id']))
    c.commit()
    return p


def _spawn_review(prompt, log, out):
    pf = log.with_suffix('.prompt.txt')
    pf.write_text(prompt, encoding='utf-8')
    cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', H.CODEX_MODEL,
           '-c', f'model_reasoning_effort="{H.EFFORT}"', '--skip-git-repo-check', '-s', 'workspace-write',
           '--add-dir', str(out), '--add-dir', str(H.DATA), '--add-dir', str(H.ROOT), '-C', str(H.WORK), '-']
    return subprocess.Popen(cmd, cwd=H.WORK, stdin=open(pf, 'rb'), stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                            start_new_session=True)


def _after_draw(c, cand):
    out = attempt_dir(cand['round'], cand['letter'], cand['attempt'])
    r = c.execute('select item from rounds where id=?', (cand['round'],)).fetchone()
    try:
        res = preview(out, r['item'])
    except Exception as e:  # noqa: BLE001 — 미리보기가 죽어도 판은 계속
        res = dict(ok=False, problems=[f'미리보기 실패: {e}'])
    c.execute('update cands set check_json=? where id=?', (json.dumps(res, ensure_ascii=False), cand['id']))
    if res.get('ok'):
        c.execute('update cands set status=? where id=?', ('review_queued', cand['id']))
    else:
        _retry_or_finish(c, cand, f'깨짐 검사: {"; ".join(res["problems"])}', fail_status='broken')
    c.commit()


def _after_review(c, cand):
    out = attempt_dir(cand['round'], cand['letter'], cand['attempt'])
    try:
        v = json.loads((out / 'verdict.json').read_text())
    except (OSError, ValueError):
        v = None
    if not v:   # 검수 결과가 없으면 합격으로 치지 않는다
        c.execute('update cands set status=?, finished=? where id=?', ('discarded', H.now(), cand['id']))
        _replace(c, cand['round'])
        return
    verdict = str(v.get('verdict', '')).upper()
    c.execute('update cands set verdict=?, codes=?, body=? where id=?',
              (verdict, json.dumps(v.get('codes') or [], ensure_ascii=False), json.dumps(v, ensure_ascii=False), cand['id']))
    if verdict == 'PASS':
        c.execute('update cands set status=?, finished=? where id=?', ('done', H.now(), cand['id']))
    else:
        _retry_or_finish(c, cand, None, fail_status='done')


def _retry_or_finish(c, cand, problem, fail_status):
    if (cand.get('engine') or '').startswith(('render:', 'hand:')):
        # 렌더러가 찍은 후보(front.py)는 작업자가 없고, 옆면은 투영 규칙상 0px 이다(KX=0). 검수자가 떨어뜨려도 숨기지 않고
        # ✗ 와 이유를 달아 사용자가 고르게 둔다 — 실측: 「의심되면 FAIL」 검수자가 우진각 지붕 끝 경사면을 옆면으로 읽었다.
        c.execute('update cands set status=?, finished=? where id=?', ('done', H.now(), cand['id']))
        return
    if cand['attempt'] < ATTEMPTS:
        if problem:   # 깨짐 검사 실패도 다음 시도의 「지난 검수」로 넘긴다
            d = attempt_dir(cand['round'], cand['letter'], cand['attempt'])
            (d / 'verdict.json').write_text(json.dumps(dict(verdict='FAIL', codes=['BROKEN'], reasons=problem, fix=problem), ensure_ascii=False))
        c.execute('update cands set status=?, attempt=attempt+1, pid=null where id=?', ('queued', cand['id']))
    else:
        # 공격적 폐기(사용자 지시 2026-10-02): 끝까지 떨어진 후보는 고를 수 없게 버리고, 판 안에서 새 후보로 다시 그린다
        c.execute('update cands set status=?, finished=? where id=?', ('discarded', H.now(), cand['id']))
        _replace(c, cand['round'])


def _replace(c, rnd):
    r = c.execute('select n from rounds where id=?', (rnd,)).fetchone()
    gone = c.execute("select count(*) from cands where round=? and status='discarded'", (rnd,)).fetchone()[0]
    if gone > r['n'] * REPLACE_PER_ROUND:
        return
    used = {x['letter'] for x in c.execute('select letter from cands where round=?', (rnd,))}
    letter = next(ch for ch in 'FGHIJKLMNOPQRSTUVWXYZ' if ch not in used)
    base = list(DIRECTIONS.values())[(ord(letter) - ord('F')) % len(DIRECTIONS)]
    c.execute('insert into cands(round,letter,direction,status,attempt) values(?,?,?,?,?)',
              (rnd, letter, '다시 그림(앞 후보 폐기) · ' + base, 'queued', 1))


def add_hand(item_id, script, note=''):
    """감독이 손으로 고친 그림(hand/<이름>.py 가 <폴더>/cand.png 를 만든다)을 그 아이콘의 판에 후보 H… 로 올리고 검수에 넣는다.
    작업자가 없으므로 떨어져도 다시 그리지 않는다 — ✗ 와 이유를 단 채 사용자가 고른다."""
    c = H.db()
    tables(c)
    row = c.execute('select id from rounds where item=? order by id desc', (item_id,)).fetchone()
    rnd = row['id'] if row else open_round(item_id, note, '', 0, [])
    used = {x['letter'] for x in c.execute('select letter from cands where round=?', (rnd,))}
    L = next(ch for ch in 'HIJKLMNOPQ' if ch not in used)
    out = attempt_dir(rnd, L, 1)
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, str(script), str(out)], check=True)
    shutil.copy(script, out / 'draw.py')
    (out / 'note.txt').write_text(note + '\n', encoding='utf-8')
    res = preview(out, item_id)
    c.execute('insert into cands(round,letter,direction,status,attempt,engine,check_json,started) values(?,?,?,?,?,?,?,?)',
              (rnd, L, '감독 손수정 · ' + note, 'review_queued' if res['ok'] else 'broken', 1, 'hand:supervisor',
               json.dumps(res, ensure_ascii=False), H.now()))
    c.commit()
    ensure_pool()
    return f'r{rnd}/{L}'


def restrict(rounds=None):
    """엄격 검수를 이미 끝난(합격) 후보에 다시 적용한다 — 떨어지면 같은 작업자가 이유를 들고 다시 그리고, 끝내 떨어지면 폐기·대체."""
    c = H.db()
    tables(c)
    q = "select id from cands where status='done' and (verdict='PASS' or verdict is null)"
    ids = [r['id'] for r in c.execute(q) if not rounds or True]
    if rounds:
        ids = [r['id'] for r in c.execute(q + ' and round in (%s)' % ','.join('?' * len(rounds)), rounds)]
    for i in ids:
        c.execute("update cands set status='review_queued', verdict=null, codes=null, body=null where id=?", (i,))
    c.commit()
    ensure_pool()
    return len(ids)


def purge(sets, n=3, letters=('A', 'B', 'C')):
    """공격적 폐기(사용자 지시 2026-10-02): 사용자가 아직 정하지 않은 아이콘 중 투영 렌더러로 그린 세트(옆면이 반드시 생긴다)와
    엄격 검수에서 떨어진 것을 버림(client=harness-strict)으로 표시하고, 다시 그리기 판이 없으면 연다. 사용자가 받은 것은 건드리지 않는다."""
    c = H.db()
    tables(c)
    dec = H._latest_decisions(c)
    rv = H._latest_reviews(c)
    active = {r['item'] for r in c.execute("select distinct r.item from rounds r join cands x on x.round=r.id where x.status != 'discarded'")}
    opened, rejected = [], []
    strict = {r['item'] for r in c.execute("select item from decisions where client='harness-strict'")}
    for it in list(c.execute('select * from items order by iset, role, name')):
        if it['iset'] not in sets:
            continue
        if it['id'] in strict and it['id'] in dec and dec[it['id']]['decision'] == 'reject':
            if it['id'] not in active:   # 지난번에 버림만 적고 판을 못 연 것
                opened.append((it['id'], open_round(it['id'], '', '', n, list(letters))))
            continue
        if it['id'] in dec:
            continue
        v = rv.get(it['id'])
        proj = it['iset'] in PROJECTION_SETS
        if not proj and v and v['verdict'] == 'PASS':
            continue
        why = '투영 렌더러로 그린 세트 — 옆면이 반드시 생긴다' if proj else f"엄격 검수 불합격 {','.join(v['codes']) if v else '(검수 없음)'}"
        c.execute('insert into decisions(item,sha,decision,reasons,note,client,at) values(?,?,?,?,?,?,?)',
                  (it['id'], it['sha'], 'reject', json.dumps(['옆면 보임(아이소)'], ensure_ascii=False), why, 'harness-strict', H.now()))
        c.commit()
        rejected.append(it['id'])
        if it['id'] not in active:
            opened.append((it['id'], open_round(it['id'], '', '', n, list(letters))))
    c.commit()
    H.export()
    return rejected, opened


# 현대·SF 는 빠졌다: 사용자가 「현대는 옆면이 약간 보여도 괜찮다」고 했다(2026-10-02, SET_RULES 참고).
PROJECTION_SETS = ()   # 사막·동양풍도 빠졌다: 사용자 「before 로 놓는 것도 나쁘지 않다」(2026-10-02)


def _alive(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:   # 좀비(끝났는데 거두지 않은 자식)는 죽은 것으로
        with open(f'/proc/{pid}/stat') as f:
            return f.read().split()[2] != 'Z'
    except OSError:
        return False


def pool_alive():
    import fcntl
    try:
        f = open(H.DATA / 'pool.lock', 'w')
    except OSError:
        return False
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return True    # 누가 잡고 있다 = 일꾼이 돈다
    fcntl.flock(f, fcntl.LOCK_UN)
    f.close()
    return False


def ensure_pool():
    if pool_alive():
        return
    H.LOGS.mkdir(parents=True, exist_ok=True)
    subprocess.Popen([sys.executable, str(H.HERE / 'harness.py'), 'pool'], cwd=H.ROOT, start_new_session=True,
                     stdout=open(H.LOGS / 'pool.log', 'a'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)


def pool():
    import fcntl
    lockf = open(H.DATA / 'pool.lock', 'w')
    try:   # 일꾼은 하나만 — 판을 연달아 열면 ensure_pool 이 여러 번 불린다(2026-10-02 실측: 일꾼 4개가 같은 후보를 겹쳐 돌렸다)
        fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return
    POOL_LOCK.write_text(str(os.getpid()))
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    c = H.db()
    tables(c)
    # 이전 일꾼이 죽었으면 그리던 것은 다시 줄 세운다
    c.execute("update cands set status='queued' where status='drawing'")
    c.execute("update cands set status='review_queued' where status='reviewing'")
    c.commit()
    running = {}
    idle = 0
    while True:
        for cid, (p, t0) in list(running.items()):
            code = p.poll()
            if code is None and time.time() - t0 > H.TIMEOUT_S:
                p.kill()
                code = 'timeout'
            if code is None:
                continue
            del running[cid]
            cand = dict(c.execute('select * from cands where id=?', (cid,)).fetchone())
            print(H.now(), f'r{cand["round"]}-{cand["letter"]}-a{cand["attempt"]} {cand["status"]} 끝 (exit {code})', flush=True)
            if cand['status'] == 'drawing':
                _after_draw(c, cand)
            elif cand['status'] == 'reviewing':
                _after_review(c, cand)
            c.commit()
        waiting = [dict(r) for r in c.execute("select * from cands where status in ('queued','review_queued') order by round, letter")]
        for cand in waiting:
            if len(running) >= H.PAR:
                break
            if cand['id'] in running:
                continue
            p = _start(c, cand)
            running[cand['id']] = (p, time.time())
        if not running and not waiting:
            idle += 1
            if idle > 20:   # 1분 동안 할 일이 없으면 끝낸다(다음 판이 다시 띄운다)
                break
        else:
            idle = 0
        time.sleep(3)
    try:
        POOL_LOCK.unlink()
    except OSError:
        pass


# ─────────────────────────────── 화면 상태 ───────────────────────────────
def rounds_of(c, item_id):
    tables(c)
    picks = {x['note'].split('|')[0]: x['decision'] for x in c.execute(
        "select * from decisions where item=? and decision in ('pick','drop') order by id", (item_id,))}
    out = []
    for r in c.execute('select * from rounds where item=? order by id desc', (item_id,)):
        cands = []
        for x in c.execute('select * from cands where round=? order by letter', (r['id'],)):
            d = attempt_dir(r['id'], x['letter'], x['attempt'])
            key = f'r{r["id"]}/{x["letter"]}'
            cands.append(dict(key=key, letter=x['letter'], direction=x['direction'], status=x['status'], attempt=x['attempt'],
                              engine=x['engine'], verdict=x['verdict'], codes=json.loads(x['codes'] or '[]'),
                              body=json.loads(x['body']) if x['body'] else None,
                              check=json.loads(x['check_json']) if x['check_json'] else None,
                              has_img=(d / 'icon-x8.png').exists(), path=f'r{r["id"]}/{x["letter"]}/a{x["attempt"]}',
                              mark=picks.get(key)))
        out.append(dict(id=r['id'], note=r['note'], base=r['base'], created=r['created'], cands=cands))
    return out
