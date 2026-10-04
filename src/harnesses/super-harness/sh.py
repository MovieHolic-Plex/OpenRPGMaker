#!/usr/bin/env python3
"""슈퍼하네스 — 조수가 모르는 낱말(미궁·카타콤…)을 에이전트가 스스로 찾아 개념 카드로 만들고, 적대 검수·조수 시험을 거쳐
공용 번들(src/assets/conceptCards.json)에 굽는다. 사람은 화면(http://mdc-server:18315/)에서 큐를 보고 교정·폐기만 한다.

  python3 src/harnesses/super-harness/unified.py run   # 기물·파생·공간 통합 (systemd --user super-harness.service)
  python3 src/harnesses/super-harness/sh.py status
  python3 src/harnesses/super-harness/sh.py add <id> <제목> [별칭…]
  python3 src/harnesses/super-harness/sh.py pause|resume

개념 한 장이 지나가는 길: discovered → plan → plan-review → survey → (art → art-review → survey) → material-review → build(카드+예제, codex) → review(적대 검수 2명) → probe(조수 시험 전/후 2판씩
+ 판정) → bake(PR·머지) → done. 반려되면 이유를 들고 build 로 돌아가고, 3번 넘게 반려되면 blocked.
에이전트 기본값: Codex CLI gpt-6.1-sol, reasoning medium (2026-10-03 사용자).
"""
import glob
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from functools import lru_cache
from urllib.parse import urlparse, parse_qs, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import store  # noqa: E402
import gates  # noqa: E402
import planning_details  # noqa: E402
import art_execution  # noqa: E402
import art_choices  # noqa: E402
import art_feedback  # noqa: E402
import art_layout  # noqa: E402

DATA = store.DATA
WORK = os.path.join(DATA, 'work')
PORT = int(os.environ.get('SUPER_HARNESS_PORT', '18315'))
CODEX = shutil.which('codex') or os.path.expanduser('~/.local/bin/codex')
BUN = shutil.which('bun') or os.path.expanduser('~/.bun/bin/bun')
MODEL = os.environ.get('SUPER_HARNESS_MODEL', 'gpt-6.1-sol')
EFFORT = os.environ.get('SUPER_HARNESS_EFFORT', 'medium')
BAKE_WT = os.environ.get('SUPER_HARNESS_BAKE_WT', os.path.abspath(os.path.join(ROOT, '..', 'rpg-zzu-super-bake')))
BRIEF = os.path.join(ROOT, 'scripts/qa-game/briefs/ember-mine-jrpg.json')
CODEX_TIMEOUT = int(os.environ.get('SUPER_HARNESS_CODEX_TIMEOUT', str(50 * 60)))
PROBE_TIMEOUT = int(os.environ.get('SUPER_HARNESS_PROBE_TIMEOUT', str(30 * 60)))
PROBE_RUNS = 2   # 전/후 각 2판
ENV = dict(os.environ, SUPER_HARNESS_CODEX_BIN=CODEX, PATH=os.pathsep.join([os.path.dirname(BUN), os.path.dirname(CODEX), os.path.expanduser('~/.local/bin'),
                                              '/usr/local/bin', '/usr/bin', '/bin', os.environ.get('PATH', '')]))

PROCS = {}   # job id → (Popen, deadline, meta)
BAKING = threading.Lock()


def cdir(cid, *parts):
    return os.path.join(DATA, 'concepts', cid, *parts)


def read_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def prompt_template(name):
    with open(os.path.join(HERE, 'prompts', name), encoding='utf-8') as f:
        return f.read()


def fill(template, **values):
    for k, v in values.items():
        template = template.replace('{{' + k + '}}', v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=2))
    return template


def object_particle(word):
    """「미궁을」/「하수도를」 — 받침 있으면 을."""
    ch = word.strip()[-1:] or 'x'
    code = ord(ch) - 0xAC00
    return '을' if 0 <= code < 11172 and code % 28 else '를'


# ───────────────────────── 작업 실행 ─────────────────────────

def start_proc(cid, kind, tag, cmd, cwd, log_path, timeout, meta, stdin_path=None):
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    jid = store.add_job(cid, kind, tag, log_path)
    p = subprocess.Popen(cmd, cwd=cwd, env=ENV, stdin=open(stdin_path, 'rb') if stdin_path else subprocess.DEVNULL,
                         stdout=open(log_path, 'w'), stderr=subprocess.STDOUT, start_new_session=True)
    store.update_job(jid, pid=p.pid)
    PROCS[jid] = (p, time.time() + timeout, dict(meta, kind=kind, tag=tag, concept=cid))
    store.log(cid, f'시작 — {kind} {tag}'.strip())
    return jid


def start_codex(cid, kind, tag, prompt, result_path, extra_dirs=(), write_root=None):
    os.makedirs(WORK, exist_ok=True)
    stamp = time.strftime('%m%d-%H%M%S')
    log_path = (cdir(cid, 'logs') if cid else os.path.join(DATA, 'logs')) + f'/{kind}-{tag}-{stamp}.log'
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    prompt_path = log_path[:-4] + '.prompt.md'
    with open(prompt_path, 'w', encoding='utf-8') as f:
        f.write(prompt)
    cmd = [CODEX, 'exec', '-m', MODEL, '-c', f'model_reasoning_effort="{EFFORT}"', '--skip-git-repo-check',
           '-s', 'workspace-write', '--add-dir', write_root or ROOT, '--add-dir', DATA]
    for d in extra_dirs:
        cmd += ['--add-dir', d]
    cmd += ['-C', WORK, '-']
    return start_proc(cid, kind, tag, cmd, WORK, log_path, CODEX_TIMEOUT, {'result': result_path}, stdin_path=prompt_path)


def running(kinds=None):
    return [m for (_, _, m) in PROCS.values() if kinds is None or m['kind'] in kinds]


def kill(jid):
    p, _, _ = PROCS.get(jid, (None, None, None))
    if p and p.poll() is None:
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except Exception:
            pass


def reap():
    for jid, (p, deadline, meta) in list(PROCS.items()):
        code = p.poll()
        if code is None and time.time() > deadline:
            kill(jid)
            store.log(meta['concept'], f'시간 초과 — {meta["kind"]} {meta["tag"]}')
            code = -9
        if code is None:
            continue
        del PROCS[jid]
        result = read_json(meta['result']) if meta.get('result') else None
        store.update_job(jid, status='done' if code == 0 else f'exit {code}', ended=store.now(),
                         result=result if result is not None else {'exit': code})
        try:
            if not meta.get('superseded'):
                HANDLERS[meta['kind']](meta, code, result)
        except Exception:
            store.log(meta['concept'], f'처리 오류 — {meta["kind"]}: {traceback.format_exc()[-600:]}')
            if meta['concept']:
                store.update_concept(meta['concept'], stage='blocked', status='idle', note=f'{meta["kind"]} 결과 처리 오류 — 로그 확인 필요')


def recover():
    """데몬이 다시 뜨면 돌던 작업은 잃은 것으로 치고 개념을 다시 대기열로."""
    for job in store.jobs("status='running'"):
        store.update_job(job['id'], status='lost', ended=store.now())
        if job['concept']:
            c = store.concept(job['concept'])
            if c and (c['stage'] in store.ACTIVE or c['stage'] == 'art'):
                store.update_concept(c['id'], status='queued')
    # Probe concepts stay running between child jobs; no previous process survives a service restart.
    for c in store.concepts("status='running'"):
        if c['stage'] in store.ACTIVE or c['stage'] == 'art':
            store.update_concept(c['id'], status='queued')


# ───────────────────────── 단계 처리 ─────────────────────────

def reject(cid, reasons, where):
    c = store.concept(cid)
    attempt = (c['attempt'] or 1) + 1
    limit = int(store.setting('max_attempts'))
    if attempt > limit:
        store.update_concept(cid, stage='blocked', status='idle', reasons=reasons, note=f'{where}에서 {limit}번 반려')
        store.log(cid, f'막힘 — {where}에서 {limit}번 반려: {"; ".join(reasons)[:300]}')
    else:
        store.update_concept(cid, stage='build', status='queued', attempt=attempt, reasons=reasons)
        store.log(cid, f'반려({where}) → 다시 만들기 {attempt}차: {"; ".join(reasons)[:300]}')


def verify_examples(cid):
    card = cdir(cid, 'card.json')
    out = cdir(cid, 'examples')
    if not os.path.exists(card):
        return {'ok': False, 'problems': ['card.json 이 없다']}
    shutil.rmtree(out, ignore_errors=True)
    proc = subprocess.run([BUN, 'src/harnesses/super-harness/node/example.mts', '--card', card, '--out', out, '--brief', BRIEF],
                          cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=600)
    report = read_json(os.path.join(out, 'check.json'))
    if report is None:
        return {'ok': False, 'problems': [f'예제 검사가 돌지 못했다: {(proc.stdout + proc.stderr)[-500:]}']}
    return report


def slug(text):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '-', str(text or '').lower())).strip('-')


def resolve_link(link, parent, priority, source):
    """카드가 적은 하위·선행 개념 하나 → 개념 id. 같은 id·제목·별칭이 이미 있으면 그것, 없으면 새로 넣는다."""
    if isinstance(link, str):
        link = {'id': link, 'title': link}
    if not isinstance(link, dict):
        return None
    cid, title = slug(link.get('id') or ''), str(link.get('title') or '').strip()
    names = {n.lower() for n in [cid, title, *[str(a) for a in link.get('aliases', [])]] if n}
    for c in store.concepts():
        if names & {a.lower() for a in [c['id'], c['title'], *c['aliases']]}:
            return c['id']
    if not cid or not title:
        return None
    aliases = [str(a) for a in link.get('aliases', []) if str(a).strip()] or [title]
    store.add_concept(cid, title, aliases, str(link.get('why', '')), source, priority, parent=parent)
    return cid


def spawn_children(cid):
    """시드 — 검수를 통과한 카드가 적은 하위 개념(층·구역)을 큐에 넣는다. 한 번만."""
    c = store.concept(cid)
    if not c or c.get('children_spawned'):
        return
    card = read_json(cdir(cid, 'card.json'), {}) or {}
    added = []
    for link in (card.get('children') or [])[:4]:
        before = {x['id'] for x in store.concepts()}
        child = resolve_link(link, cid, max(0.1, (c['priority'] or 0.5) - 0.05), 'seed')
        if child and child not in before:
            added.append(child)
    store.update_concept(cid, children_spawned=1)
    if added:
        store.log(cid, f'시드 — 하위 개념 {len(added)}개를 큐에 넣었다: {", ".join(added)}')


def hold_for_requirements(cid):
    """선행 개념(학교 복도 → 학교)이 아직 안 구워졌으면 기다린다. 없는 선행 개념은 높은 우선으로 새로 넣는다. 반환: 기다리는가."""
    c = store.concept(cid)
    card = read_json(cdir(cid, 'card.json'), {}) or {}
    req_ids = []
    for link in card.get('requires') or []:
        rid = resolve_link(link, None, (c['priority'] or 0.5) + 0.3, 'requires')
        if rid and rid != cid and cid not in ((store.concept(rid) or {}).get('requires') or []):   # 서로 기다리면 영영 안 돈다
            req_ids.append(rid)
            r = store.concept(rid)
            if r and r['stage'] == 'discovered' and (r['priority'] or 0) < (c['priority'] or 0.5) + 0.3:
                store.update_concept(rid, priority=(c['priority'] or 0.5) + 0.3)
    store.update_concept(cid, requires=req_ids)
    pending = [r for r in req_ids if (store.concept(r) or {}).get('stage') not in ('done', 'discarded', 'blocked')]
    if pending:
        store.update_concept(cid, stage='waiting', status='idle', note=f'선행 개념 기다림: {", ".join(pending)}')
        store.log(cid, f'선행 개념이 아직 없다 → 기다림: {", ".join(pending)}')
        return True
    return False


def release_waiting():
    for c in store.concepts("stage='waiting'"):
        reqs = [store.concept(r) for r in c['requires']]
        if any(r and r['stage'] not in ('done', 'discarded', 'blocked') for r in reqs):
            continue
        done = [r['title'] for r in reqs if r and r['stage'] == 'done']
        lost = [r['title'] for r in reqs if r and r['stage'] != 'done']
        reasons = []
        if done:
            reasons.append(f'선행 개념 「{"」「".join(done)}」 카드가 구워졌다 — 그 카드의 재료·변형·크기에 맞춰 이 카드를 다시 맞춰라 (src/assets/conceptCards.json)')
        if lost:
            reasons.append(f'선행 개념 「{"」「".join(lost)}」 는 막히거나 버려졌다 — requires 에서 빼고 이 카드만으로 지어지게 하라')
        store.update_concept(c['id'], stage='build', status='queued', reasons=reasons, note='')
        store.log(c['id'], '선행 개념이 끝났다 → 다시 만들기')


def on_discover(meta, code, result):
    added = 0
    existing = store.concepts()
    known = {a.lower() for c in existing for a in [c['id'], c['title'], *c['aliases']]}
    for item in result if isinstance(result, list) else []:
        cid = re.sub(r'[^a-z0-9-]', '-', str(item.get('id', '')).lower()).strip('-')
        title = str(item.get('title', '')).strip()
        aliases = [str(a) for a in item.get('aliases', []) if str(a).strip()]
        if not cid or not title or title.lower() in known or cid in known:
            continue
        if store.add_concept(cid, title, aliases or [title], str(item.get('why', '')), str(item.get('source', 'vocab')),
                             float(item.get('priority', 0.5))):
            added += 1
            known.update(a.lower() for a in [cid, title, *aliases])
    store.log(None, f'발견 작업 끝 — 새 개념 {added}개')
    store.set_setting('last_discover', str(time.time()))


def on_build(meta, code, result):
    cid = meta['concept']
    if code != 0:
        reject(cid, ['작성 작업이 정상 종료되지 않았다'], '만들기')
        return
    if not require_materials(cid):
        return
    report = verify_examples(cid)
    write_json(cdir(cid, 'verify.json'), report)
    for gap in read_json(cdir(cid, 'gaps.json'), []) or []:
        if isinstance(gap, dict) and gap.get('what'):
            store.add_gap(cid, str(gap.get('kind', '')), str(gap['what']), str(gap.get('route', '')),
                          gap.get('item') if isinstance(gap.get('item'), dict) else None)
    card = read_json(cdir(cid, 'card.json'))
    if card and card.get('aliases'):
        store.update_concept(cid, aliases=card['aliases'])
    if card:
        parent = card.get('parent')
        if parent:
            store.update_concept(cid, parent=resolve_link(parent, None, 0.6, 'requires') if isinstance(parent, dict) else slug(parent))
    if card and card.get('needsArt'):
        store.update_concept(cid, stage='survey', status='queued', note='제작 중 새 부족분 발견 — 재료 조사로 돌아감')
        return
    if report.get('ok'):
        if hold_for_requirements(cid):
            return
        store.update_concept(cid, stage='review', status='queued', reasons=[])
        store.log(cid, '만들기 끝 — 예제 검사 통과, 적대 검수로')
    else:
        reject(cid, report.get('problems', [])[:12], '예제 검사')


def on_review(meta, code, result):
    cid = meta['concept']
    c = store.concept(cid)
    attempt = c['attempt']
    if code != 0:
        write_json(cdir(cid, 'reviews', f'{meta["tag"]}.json'), {'verdict': 'FAIL', 'reasons': ['검수 작업 비정상 종료']})
    reviews = {k: read_json(cdir(cid, 'reviews', f'{attempt}-{k}.json')) for k in ('A', 'B')}
    if any(running(['review']) and m['concept'] == cid for m in running(['review'])):
        return
    if any(v is None for v in reviews.values()):
        reject(cid, ['검수자가 판정 파일을 남기지 않았다'], '적대 검수')
        return
    reasons = gates.visual_report(cdir(cid), reviews)['problems']
    reasons += [f'[{k}] {r}' for k, v in reviews.items() if v.get('verdict') != 'PASS' for r in v.get('reasons', [])]
    if reasons:
        reject(cid, reasons[:12], '적대 검수')
    else:
        store.update_concept(cid, stage='probe', status='queued', reasons=[])
        store.log(cid, '적대 검수 2명 통과 → 조수 시험')
        spawn_children(cid)


def on_probe(meta, code, result):
    cid, run_dir = meta['concept'], meta['run']
    subprocess.run([BUN, 'src/harnesses/super-harness/node/probe-score.mts', '--run', run_dir, '--out', os.path.join(run_dir, 'score')],
                   cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=600)
    store.log(cid, f'조수 시험 한 판 끝 — {os.path.basename(run_dir)}')


def on_judge(meta, code, result):
    cid = meta['concept']
    c = store.concept(cid)
    before, after = probe_scores(cid, c['attempt'])
    reasons = []
    if code != 0 or not result or result.get('verdict') != 'PASS':
        reasons += (result or {}).get('reasons') or ['판정자가 판정을 남기지 않았다']
    # 결정적 관문 — 판정자가 통과시켜도 숫자가 나빠지면 굽지 않는다.
    if after and not all(s.get('conceptNote') for s in after):
        reasons.append('조수 시험에서 개념 카드 노트가 붙지 않았다(별칭이 요청 문장과 안 맞음)')
    if before and after and sum(s.get('gimmicksWithoutEvents', 0) for s in after) > sum(s.get('gimmicksWithoutEvents', 0) for s in before):
        reasons.append('카드를 붙인 뒤 이벤트 없는 장치 그림이 더 많아졌다')
    if after and sum(s.get('newMaps', 0) for s in after) == 0:
        reasons.append('카드를 붙인 조수가 맵을 하나도 만들지 못했다')
    if reasons:
        reject(cid, reasons[:12], '조수 시험')
    else:
        store.update_concept(cid, stage='bake', status='queued', reasons=[])
        store.log(cid, f'조수 시험 통과 → 굽기: {(result or {}).get("summary", "")[:200]}')


def on_bake(meta, code, result):
    pass   # 굽기는 스레드에서 끝까지 처리한다(bake_thread).


HANDLERS = {'plan': lambda *a: on_plan(*a), 'plan-review': lambda *a: on_plan_review(*a), 'survey': lambda *a: on_survey(*a), 'material-review': lambda *a: on_material_review(*a), 'art': lambda *a: on_art(*a), 'art-native': lambda *a: on_art_native(*a), 'art-layout-review': lambda *a: on_art_layout_review(*a), 'art-context-review': lambda *a: on_art_context_review(*a), 'discover': on_discover, 'build': on_build, 'review': on_review, 'probe': on_probe, 'judge': on_judge, 'bake': on_bake}


def probe_scores(cid, attempt):
    base = [read_json(os.path.join(d, 'score', 'score.json')) for d in sorted(glob.glob(cdir(cid, 'probe', 'base-*')))]
    after = [read_json(os.path.join(d, 'score', 'score.json')) for d in sorted(glob.glob(cdir(cid, 'probe', f'a{attempt}-*')))]
    return [s for s in base if s], [s for s in after if s]


# ───────────────────────── 작업 시작 ─────────────────────────

def concept_context(c):
    return {k: c.get(k) for k in ('id', 'title', 'aliases', 'why', 'source', 'attempt', 'parent')}


def start_discover():
    existing = [{'id': c['id'], 'title': c['title'], 'stage': c['stage'], 'note': c['note']} for c in store.concepts()]
    seed = read_json(os.path.join(ROOT, 'harness-data/super-harness/seed.json'), {})
    findings = scan_failures()
    result = os.path.join(DATA, 'discover', f'{time.strftime("%m%d-%H%M%S")}.json')
    prompt = fill(prompt_template('discover.md'), ROOT=ROOT, RESULT=result, EXISTING=existing, SEED=seed, FINDINGS=findings)
    start_codex(None, 'discover', '', prompt, result)


def scan_failures():
    """조수 실패 흔적 — 공용 검색 0건 낱말, 배치 품질 수리 턴이 돈 요청. qa-runs(저장소)와 슈퍼하네스 시험 폴더를 본다."""
    zero, repairs = {}, []
    roots = glob.glob(os.path.join(ROOT, 'qa-runs', '*')) + glob.glob(cdir('*', 'probe', '*'))
    for run in roots[-300:]:
        for line in open(os.path.join(run, 'tools.jsonl'), encoding='utf-8', errors='ignore') if os.path.exists(os.path.join(run, 'tools.jsonl')) else []:
            try:
                call = json.loads(line)
            except Exception:
                continue
            if call.get('name') == 'list_spatial_designs' and '공용 0건' in str(call.get('summary', '')):
                q = str((call.get('args') or {}).get('query', '')).strip()
                if q:
                    zero[q] = zero.get(q, 0) + 1
        ev = os.path.join(run, 'events.ndjson')
        if os.path.exists(ev) and 'layout_quality' in open(ev, encoding='utf-8', errors='ignore').read():
            instr = os.path.join(run, 'instruction.txt')
            repairs.append(open(instr, encoding='utf-8', errors='ignore').read()[:120] if os.path.exists(instr) else os.path.basename(run))
    return {'zeroHitSearches': sorted(zero.items(), key=lambda kv: -kv[1])[:40], 'layoutRepairRequests': repairs[-40:]}


def worldviews():
    seed = read_json(os.path.join(ROOT, 'harness-data/super-harness/seed.json'), {}) or {}
    return {'worldviews': seed.get('worldviews', []), 'borrowStructure': seed.get('borrowStructure')}


def inventory(skip=None):
    out = []
    for c in store.concepts("stage NOT IN ('discarded')"):
        if c['id'] == skip:
            continue
        card = cdir(c['id'], 'card.json')
        out.append({'id': c['id'], 'title': c['title'], 'aliases': c['aliases'][:6], 'stage': c['stage'], 'parent': c.get('parent'),
                    'card': card if os.path.exists(card) else None})
    return out


def require_planning(cid):
    report = gates.planning_report(cdir(cid))
    if report['ok']:
        return True
    store.update_concept(cid, stage='plan', status='queued', note='공간 기획 관문 미통과', reasons=report['problems'])
    return False


def reject_planning(cid, reasons):
    c = store.concept(cid)
    attempt = c['plan_attempt'] + 1
    blocked = attempt > int(store.setting('max_attempts'))
    store.update_concept(cid, stage='blocked' if blocked else 'plan', status='idle' if blocked else 'queued',
                         plan_attempt=attempt, reasons=reasons[:16], note='기획 검수 반려 — 수정 필요')
    store.log(cid, '기획 반려 → ' + ('막힘' if blocked else f'기획 {attempt}차 수정'))


def start_plan(c):
    cid = c['id']
    os.makedirs(cdir(cid), exist_ok=True)
    # Preserve earlier planning and judgments for inspection; new reviews cannot reuse them.
    paths = [cdir(cid, 'planning.json'), cdir(cid, 'planning.md')] + glob.glob(cdir(cid, 'planning-reviews', '*.json'))
    existing = [p for p in paths if os.path.isfile(p)]
    if existing:
        archive = cdir(cid, 'history', f'planning-{time.time_ns()}')
        os.makedirs(archive, exist_ok=True)
        for path in existing:
            shutil.copy2(path, os.path.join(archive, os.path.basename(path)))
    for path in glob.glob(cdir(cid, 'planning-reviews', '*.json')):
        os.remove(path)
    prompt = fill(prompt_template('planning.md'), ROOT=ROOT, CDIR=cdir(cid), CONCEPT=concept_context(c),
                  FEEDBACK=c['feedback'], REASONS=c['reasons'], WORLDVIEWS=worldviews(), SPACE=prompt_template('space-design.md'))
    start_codex(cid, 'plan', f'p{c["plan_attempt"]}', prompt, cdir(cid, 'planning.json'))
    store.update_concept(cid, status='running', note='공간 기획·텍스트 도면 작성 중')


def on_plan(meta, code, result):
    cid = meta['concept']
    report = gates.planning_report(cdir(cid), approved=False)
    if code != 0 or not report['ok']:
        reject_planning(cid, report['problems'] or ['기획 작업 비정상 종료'])
        return
    planning_details.render(cdir(cid))
    with open(cdir(cid, 'planning.md'), 'w') as f:
        f.write(gates.planning_markdown(cdir(cid)))
    store.update_concept(cid, stage='plan-review', status='queued', reasons=[], note='텍스트 도면 기계 확인 완료 — 적대적 기획 검수 대기')


def start_plan_reviews(c):
    cid = c['id']
    report = gates.planning_report(cdir(cid), approved=False)
    if not report['ok']:
        reject_planning(cid, report['problems'])
        return
    planning_details.render(cdir(cid))
    with open(cdir(cid, 'planning.md'), 'w') as f:
        f.write(gates.planning_markdown(cdir(cid)))
    for label, focus in (('A', '공간의 정체성·시대·활동·구역 구성'), ('B', '텍스트 도면의 동선·경계·축척·필수 재료')):
        result = cdir(cid, 'planning-reviews', label + '.json')
        os.makedirs(os.path.dirname(result), exist_ok=True)
        if os.path.exists(result):
            os.remove(result)
        prompt = fill(prompt_template('planning-review.md'), CDIR=cdir(cid), CONCEPT=concept_context(c), FEEDBACK=c['feedback'],
                      LABEL=label, FOCUS=focus, REPORT=report, RESULT=result)
        start_codex(cid, 'plan-review', label, prompt, result)
    store.update_concept(cid, status='running', note='기획 적대적 검수 A/B')


def on_plan_review(meta, code, result):
    cid = meta['concept']
    if code != 0:
        write_json(cdir(cid, 'planning-reviews', meta['tag'] + '.json'), {'verdict': 'FAIL', 'reasons': ['검수 작업 비정상 종료']})
    if any(m['concept'] == cid for m in running(['plan-review'])):
        return
    report = gates.planning_report(cdir(cid))
    if not report['ok']:
        reasons = list(report['problems'])
        for label in ('A', 'B'):
            review = read_json(cdir(cid, 'planning-reviews', label + '.json'), {}) or {}
            if isinstance(review, dict):
                reasons = [f'[{label}] {r}' for r in review.get('reasons', [])] + reasons
        reject_planning(cid, reasons)
        return
    store.update_concept(cid, stage='survey', status='queued', reasons=[], note='기획·텍스트 도면 A/B 승인 — 필수 재료 조사')
    store.log(cid, '기획 적대적 검수 2명 통과 → 재료 조사')


def require_materials(cid):
    if not require_planning(cid):
        return False
    report = gates.material_report(cdir(cid))
    if report['ok']:
        return True
    store.update_concept(cid, stage='survey', status='queued', note='재료 관문 미통과', reasons=report['problems'])
    return False


def start_survey(c):
    cid = c['id']
    if not require_planning(cid):
        return
    os.makedirs(cdir(cid), exist_ok=True)
    prompt = fill(prompt_template('materials.md'), ROOT=ROOT, CDIR=cdir(cid), CONCEPT=concept_context(c), WORLDVIEWS=worldviews())
    start_codex(cid, 'survey', f'a{c["attempt"]}', prompt, cdir(cid, 'materials.json'))
    store.update_concept(cid, status='running')


def on_survey(meta, code, result):
    cid = meta['concept']
    if not require_planning(cid):
        return
    if code != 0 or not isinstance(result, dict) or result.get('version') != gates.VERSION or not result.get('variants'):
        store.update_concept(cid, stage='blocked', status='idle', note='재료 조사 실패 — 다시 조사 필요')
        return
    report = gates.material_report(cdir(cid), approved=False)
    write_json(cdir(cid, 'material-check.json'), report)
    for gap in read_json(cdir(cid, 'gaps.json'), []) or []:
        if isinstance(gap, dict) and gap.get('what'):
            store.add_gap(cid, gap.get('kind', ''), gap['what'], gap.get('route', ''), gap.get('item'))
    if report['missing']:
        store.update_concept(cid, stage='art', status='queued', note=f'필수 재료 {len(report["missing"])}건 — 칩 제작 대기', reasons=report['problems'])
    elif not report['ok']:
        store.update_concept(cid, stage='blocked', status='idle', note='재료 근거를 확인할 수 없음', reasons=report['problems'])
    else:
        store.update_concept(cid, stage='material-review', status='queued', reasons=[])
    store.log(cid, '재료 조사 완료 — ' + ('칩 제작 필요' if report['missing'] else '독립 재료 검수'))


def start_material_review(c):
    if not require_planning(c['id']):
        return
    report = gates.material_report(cdir(c['id']), approved=False)
    if not report['ok']:
        store.update_concept(c['id'], stage='survey', status='queued', reasons=report['problems'])
        return
    prompt = fill(prompt_template('material-review.md'), ROOT=ROOT, CDIR=cdir(c['id']), REPORT=report)
    review_path = cdir(c['id'], 'material-review.json')
    if os.path.exists(review_path):
        os.remove(review_path)
    start_codex(c['id'], 'material-review', 'inventory', prompt, review_path)
    store.update_concept(c['id'], status='running')


def on_material_review(meta, code, result):
    cid = meta['concept']
    if not require_planning(cid):
        return
    report = gates.material_report(cdir(cid))
    if code == 0 and report['ok']:
        store.update_concept(cid, stage='build', status='queued', reasons=[], note='재료 준비·시대·조립 가능성 확인 완료')
    else:
        store.update_concept(cid, stage='blocked', status='idle', reasons=report['problems'] + ((result or {}).get('reasons') or []), note='재료 검수 반려 — 자료 보완 후 재조사')


def start_art(c):
    cid = c['id']
    if not require_planning(cid):
        return
    # 그림 저작은 다른 작업자의 소스와 섞이지 않도록 전용 워크트리에서만 한다.
    wt = os.path.join(DATA, 'art-worktrees', cid)
    if not os.path.exists(os.path.join(wt, '.git')):
        os.makedirs(os.path.dirname(wt), exist_ok=True)
        subprocess.run(['git', 'worktree', 'add', '--detach', wt, 'HEAD'], cwd=ROOT, check=True, capture_output=True)
    if not os.path.exists(os.path.join(wt, 'node_modules')):
        subprocess.run(['npm', 'run', 'wt', '--', 'adopt', 'super-art-' + cid, '--path', wt], cwd=ROOT, check=True, capture_output=True)
    previous = cdir(cid, 'art-result.json')
    if os.path.isfile(previous):
        os.replace(previous, cdir(cid, 'art-result.previous.json'))
    feedback = read_json(cdir(cid, 'art-feedback.json'), {}) or {}
    prior_layout = read_json(cdir(cid, 'art-layout-review.json'), {}) or {}
    template = 'art-layout-repair.md' if prior_layout.get('verdict') == 'FAIL' else 'art.md'
    prompt = fill(prompt_template(template), ROOT=wt, CDIR=cdir(cid), CONCEPT=concept_context(c),
                  ART_FEEDBACK=feedback, ART_LIMITS=art_feedback.limits(DATA, cid),
                  ART_MODEL_OVERRIDE=json.loads(store.setting('art_model_overrides') or '{}').get(cid))
    start_codex(cid, 'art', 'prepare', prompt, cdir(cid, 'art-result.json'), write_root=wt)
    store.update_concept(cid, status='running', note='전용 하네스로 칩 후보 제작 중')


def on_art(meta, code, result):
    cid = meta['concept']
    wt = os.path.realpath(os.path.join(DATA, 'art-worktrees', cid))
    result = result if isinstance(result, dict) else {}
    if code == 0 and result.get('execution') and meta.get('tag') != 'collect':
        try:
            request = dict(result['execution'])
            # Models are chosen by the user/supervisor, never by a preparation worker.
            request.pop('modelOverride', None)
            request.pop('repairLimits', None)
            feedback = read_json(cdir(cid, 'art-feedback.json'), {}) or {}
            if (store.concept(cid).get('art_revision') or 0) > 0:
                if request.get('feedbackSha256') != gates.digest(cdir(cid, 'art-feedback.json')):
                    raise ValueError('재생성 준비에 현재 검수 피드백 해시가 필요합니다.')
                request['repairLimits'] = art_feedback.limits(DATA, cid)
            override = json.loads(store.setting('art_model_overrides') or '{}').get(cid)
            if override:
                request['modelOverride'] = override
            art_execution.prepare(wt, request)
            request_path = cdir(cid, 'art-execution.json')
            write_json(request_path, request)
            layout = art_layout.build_input(wt, request)
            write_json(cdir(cid, 'art-layout-input.json'), layout)
            store.update_concept(cid, stage='art-layout-review', status='queued', note='제작 전 배치·비례·여백 적대적 검수 대기')
        except (OSError, ValueError, TypeError, KeyError) as error:
            store.update_concept(cid, stage='blocked', status='idle', note='그림 실행 준비 오류', reasons=[str(error)])
        return
    if code == 0 and result.get('candidates'):
        try:
            if meta.get('tag') != 'collect': raise ValueError('native 실행 없이 후보를 직접 반환할 수 없습니다.')
            art_layout.require_completed(wt, read_json(cdir(cid, 'art-execution.json')), read_json(cdir(cid, 'art-layout-input.json')))
        except (OSError, ValueError, KeyError, TypeError) as error:
            store.update_concept(cid, stage='blocked', status='idle', note='후보 수집의 도면 승인 근거 불일치', reasons=[str(error)])
            return
    candidates = result.get('candidates') or []
    valid = code == 0 and isinstance(candidates, list) and bool(candidates)
    if not isinstance(candidates, list):
        candidates = []
    allowed = {'interior-props', 'modern-chipset', 'joseon-baram', 'jp-city'}
    for candidate in candidates:
        if not isinstance(candidate, dict):
            valid = False
            continue
        if candidate.get('harness') not in allowed:
            valid = False
        images = candidate.get('images') or []
        if not isinstance(images, list):
            valid = False
            images = []
        refs = [candidate.get('receipt')] + images
        if len(refs) < 2:
            valid = False
        for ref in refs:
            try:
                path = os.path.realpath(os.path.join(wt, ref['path']))
                if not path.startswith(wt + os.sep) or gates.digest(path) != ref['sha256']:
                    valid = False
                elif ref == candidate.get('receipt') and not isinstance(read_json(path), (dict, list)):
                    valid = False
                elif ref in images:
                    from PIL import Image
                    with Image.open(path) as image:
                        image.verify()
            except (OSError, TypeError, KeyError, ValueError):
                valid = False
    if valid:
        try:
            art_choices.prepare(DATA, cid)
        except (OSError, ValueError, KeyError, StopIteration) as error:
            store.log(cid, '선택 예시 준비 필요: ' + str(error))
            store.update_concept(cid, stage='blocked', status='idle', note='조립 예시 준비 오류', reasons=[str(error)])
            return
        advance_art_review(cid)
    else:
        store.update_concept(cid, stage='blocked', status='idle', note='칩 제작 미완료 — 하네스 결과·그림 근거 없음', reasons=(result or {}).get('reasons') or ['art-result.json에 실제 후보와 하네스 검사 근거가 필요함'])
    store.log(cid, '칩 제작 결과 — ' + (store.concept(cid)['note'] if valid else '미완료'))



def advance_art_review(cid):
    state = art_choices.view(DATA, cid)
    if not state['groups']:
        store.update_concept(cid, stage='blocked', status='idle', note='선택 예시 어댑터 필요 — 실제 후보를 보존함')
    elif all(any(c['ready'] for c in g['candidates']) for g in state['groups']):
        store.update_concept(cid, stage='art-review', status='idle', reasons=[], note='부품·조립 검수 완료 — 사람 선택 필요')
    else:
        request = art_feedback.review_input(DATA, cid)
        if request['groups']:
            store.update_concept(cid, stage='art-context-review', status='queued', art_review_attempt=0,
                                 note='새 후보 조립 예시 독립 검수 대기')
        else:
            art_feedback.queue_repair(DATA, cid)


def start_art_context_review(c):
    cid = c['id']
    request = art_feedback.review_input(DATA, cid)
    if not request['groups']:
        advance_art_review(cid)
        return
    attempt = (c.get('art_review_attempt') or 0) + 1
    input_path = cdir(cid, 'art-context-input.json')
    output_path = cdir(cid, 'art-context-result.json')
    write_json(input_path, request)
    if os.path.exists(output_path): os.remove(output_path)
    prompt = fill(prompt_template('art-context-review.md'), CDIR=cdir(cid), INPUT=input_path,
                  OUTPUT=output_path, ROOT=request['root'])
    jid = start_codex(cid, 'art-context-review', f'r{c.get("art_revision", 0)}-v{attempt}', prompt, output_path)
    PROCS[jid][2]['context_input'] = request
    store.update_concept(cid, status='running', art_review_attempt=attempt, note='조립 예시 독립 검수 중')


def on_art_context_review(meta, code, result):
    cid = meta['concept']
    if store.concept(cid)['stage'] != 'art-context-review': return
    try:
        if code != 0: raise ValueError(f'조립 검수 작업 종료 {code}')
        request = meta.get('context_input') or read_json(cdir(cid, 'art-context-input.json'))
        report = art_feedback.validate_review(DATA, cid, result, request)
    except (ValueError, OSError, KeyError, TypeError) as error:
        c = store.concept(cid)
        retry = (c.get('art_review_attempt') or 0) < 2
        store.update_concept(cid, stage='art-context-review' if retry else 'blocked', status='queued' if retry else 'idle',
                             note='조립 검수 결과 재확인 대기' if retry else '조립 검수 실행 오류 — 2회 실패', reasons=[str(error)])
        store.log(cid, str(error))
        return
    art_feedback.write(cdir(cid, 'art-context-history', request['manifestSha256'] + '.json'), report)
    current = read_json(cdir(cid, 'art-context-review.json'), {}) or {}
    merged = current.setdefault('groups', {})
    for gid, candidates in report['groups'].items(): merged.setdefault(gid, {}).update(candidates)
    current['version'] = 1
    write_json(cdir(cid, 'art-context-review.json'), current)
    state = art_choices.view(DATA, cid)
    if all(any(c['ready'] for c in g['candidates']) for g in state['groups']):
        store.update_concept(cid, stage='art-review', status='idle', reasons=[], note='부품·조립 검수 완료 — 사람 선택 필요')
        store.log(cid, '조립 검수 통과 → 사람 선택')
    else:
        art_feedback.queue_repair(DATA, cid)


def start_art_layout_review(c):
    cid = c['id']
    request = read_json(cdir(cid, 'art-execution.json'))
    wt = os.path.join(DATA, 'art-worktrees', cid)
    try:
        layout = art_layout.build_input(wt, request)
    except (OSError, ValueError, TypeError, KeyError) as error:
        store.update_concept(cid, stage='blocked', status='idle', note='제작 전 도면 입력 변경/오류', reasons=[str(error)])
        return
    write_json(cdir(cid, 'art-layout-input.json'), layout)
    output = cdir(cid, 'art-layout-review.json')
    if os.path.exists(output): os.remove(output)
    prompt = fill(prompt_template('art-layout-review.md'), INPUT=cdir(cid, 'art-layout-input.json'), OUTPUT=output,
                  FEEDBACK=read_json(cdir(cid, 'art-feedback.json'), {}), ROOT=wt)
    start_codex(cid, 'art-layout-review', 'layout', prompt, output)
    store.update_concept(cid, status='running', note='제작 전 도면의 비례·여백·구성 검수 중')


def on_art_layout_review(meta, code, result):
    cid = meta['concept']
    try:
        if code != 0: raise ValueError('도면 검수 실행 실패')
        request = read_json(cdir(cid, 'art-execution.json'))
        wt = os.path.join(DATA, 'art-worktrees', cid)
        layout = art_layout.build_input(wt, request)
        art_layout.validate_verdict(result, layout['fingerprint'], art_layout.LAYOUT_CHECKS)
        write_json(cdir(cid, 'art-layout-history', layout['fingerprint'] + '.json'), result)
        if result['verdict'] == 'FAIL':
            history = read_json(cdir(cid, 'art-layout-rejections.json'), [])
            history.append(result)
            write_json(cdir(cid, 'art-layout-rejections.json'), history)
            # Two preparation corrections per art revision, then stop. No drawing attempt spent.
            revision = store.concept(cid).get('art_revision', 0)
            count = sum(r.get('revision') == revision for r in history[:-1]) + 1
            history[-1]['revision'] = revision
            write_json(cdir(cid, 'art-layout-rejections.json'), history)
            store.update_concept(cid, stage='art' if count < 3 else 'blocked', status='queued' if count < 3 else 'idle',
                note='도면 반려 — 배치 명세부터 수정' if count < 3 else '도면 3회 반려 — 확인 필요', reasons=result.get('reasons', []))
            return
        request['layoutApproval'] = cdir(cid, 'art-layout-review.json')
        write_json(cdir(cid, 'art-execution.json'), request)
        art_layout.require_approval(wt, request)
        art_execution.prepare(wt, request)
        native_result = cdir(cid, 'art-execution-result.json')
        if os.path.exists(native_result): os.remove(native_result)
        start_proc(cid, 'art-native', 'drawing', [sys.executable, os.path.join(HERE, 'art_execution.py'),
                   wt, cdir(cid, 'art-execution.json'), native_result], ROOT, cdir(cid, 'logs', 'art-native.log'), CODEX_TIMEOUT * 2,
                   {'result': native_result})
        store.update_concept(cid, stage='art', status='running', reasons=[], note='도면 검수 통과 — 후보 제작·독립 검수')
    except (OSError, ValueError, TypeError, KeyError) as error:
        store.update_concept(cid, stage='blocked', status='idle', note='제작 전 도면 검수 오류', reasons=[str(error)])


def on_art_native(meta, code, result):
    cid = meta['concept']
    wt = os.path.join(DATA, 'art-worktrees', cid)
    if code != 0 or not isinstance(result, dict) or result.get('exitCode') != 0:
        store.update_concept(cid, stage='blocked', status='idle', note='그림 하네스 실행 실패',
                             reasons=[f'실행 종료 {code}; logs/art-native.log 확인'])
        return
    prompt = fill(prompt_template('art-collect.md'), ROOT=wt, CDIR=cdir(cid))
    start_codex(cid, 'art', 'collect', prompt, cdir(cid, 'art-result.json'), write_root=wt)
    store.update_concept(cid, status='running', note='실제 후보 그림·검수 결과 정리 중')


def start_build(c):
    cid = c['id']
    if not require_materials(cid):
        return
    os.makedirs(cdir(cid), exist_ok=True)
    prev = read_json(cdir(cid, 'card.json'))
    prompt = fill(prompt_template('build.md'), ROOT=ROOT, CDIR=cdir(cid), CONCEPT=concept_context(c), REASONS=c['reasons'],
                  FEEDBACK=c['feedback'], PREVIOUS=('있음 — ' + cdir(cid, 'card.json') + ' 를 고쳐라') if prev else '없음 — 처음 만든다',
                  BRIEF=BRIEF, INVENTORY=inventory(cid), SPACE=prompt_template('space-design.md'), WORLDVIEWS=worldviews(), BAKED=os.path.join(BAKE_WT if os.path.isdir(BAKE_WT) else ROOT, 'src/assets/conceptCards.json'))
    start_codex(cid, 'build', f'a{c["attempt"]}', prompt, cdir(cid, 'card.json'))
    store.update_concept(cid, status='running')


def start_reviews(c):
    cid = c['id']
    if not require_materials(cid):
        return
    try:
        gates.visual_manifest(cdir(cid))
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        reject(cid, [f'시각 검수 입력 생성 실패: {error}'], '시각 검수 준비')
        return
    for k, focus in (('A', prompt_template('review-a.md')), ('B', prompt_template('review-b.md'))):
        result = cdir(cid, 'reviews', f'{c["attempt"]}-{k}.json')
        os.makedirs(os.path.dirname(result), exist_ok=True)
        if os.path.exists(result):
            os.remove(result)
        prompt = fill(prompt_template('review.md'), ROOT=ROOT, CDIR=cdir(cid), CONCEPT=concept_context(c), FOCUS=focus, RESULT=result,
                      SPACE=prompt_template('space-design.md'), WORLDVIEWS=worldviews())
        start_codex(cid, 'review', f'{c["attempt"]}-{k}', prompt, result)
    store.update_concept(cid, status='running')


def probe_text(cid, c):
    """조수 시험 문장은 늘 맨 요청(「미궁을 만들어줘」) — 사용자가 실제로 치는 말이다. 작업자가 카드에 힌트 섞인 문장을
    적어도 쓰지 않는다(힌트가 기준 판까지 도와 카드 효과를 가린다)."""
    return f'{c["title"]}{object_particle(c["title"])} 만들어줘'


def step_probe(c):
    """전(기준) 2판은 개념당 한 번, 후 2판은 시도마다. 다 끝나면 판정."""
    cid, attempt = c['id'], c['attempt']
    if not require_visual(c):
        return
    # A rebuilt card at the same attempt must never reuse an earlier after/judge result.
    current = read_json(cdir(cid, 'visual-input.json'), {})['fingerprint']
    receipt = cdir(cid, f'probe-input-a{attempt}.json')
    if (read_json(receipt, {}) or {}).get('fingerprint') != current:
        old = glob.glob(cdir(cid, 'probe', f'a{attempt}-*')) + glob.glob(cdir(cid, f'judge-a{attempt}.json'))
        if old:
            archive = cdir(cid, 'history', f'probe-a{attempt}-{time.time_ns()}')
            os.makedirs(archive, exist_ok=True)
            for path in old:
                shutil.move(path, os.path.join(archive, os.path.basename(path)))
        write_json(receipt, {'fingerprint': current})
    text = probe_text(cid, c)
    wanted = [(f'base-{k}', False) for k in range(1, PROBE_RUNS + 1)] + [(f'a{attempt}-{k}', True) for k in range(1, PROBE_RUNS + 1)]
    busy = {m['tag'] for m in running(['probe']) if m['concept'] == cid}
    pending = False
    for tag, with_card in wanted:
        run_dir = cdir(cid, 'probe', tag)
        if os.path.exists(os.path.join(run_dir, 'score', 'score.json')):
            continue
        pending = True
        if tag in busy or len(running(['probe'])) >= int(store.setting('max_probe')):
            continue
        shutil.rmtree(run_dir, ignore_errors=True)
        cmd = [BUN, 'scripts/qa-game/cli.mts', 'gen', '--brief', BRIEF, '--out', run_dir, '--text', text, '--no-check']
        if with_card:
            cmd += ['--concept-card', cdir(cid, 'card.json')]
        start_proc(cid, 'probe', tag, cmd, ROOT, run_dir + '.log', PROBE_TIMEOUT, {'run': run_dir})
        busy.add(tag)
    store.update_concept(cid, status='running')
    if pending or any(m['concept'] == cid for m in running(['probe', 'judge'])):
        return
    if os.path.exists(cdir(cid, f'judge-a{attempt}.json')):
        return
    before, after = probe_scores(cid, attempt)
    result = cdir(cid, f'judge-a{attempt}.json')
    prompt = fill(prompt_template('judge.md'), ROOT=ROOT, CDIR=cdir(cid), CONCEPT=concept_context(c), TEXT=text,
                  BEFORE=before, AFTER=after, ATTEMPT=str(attempt), RESULT=result)
    start_codex(cid, 'judge', f'a{attempt}', prompt, result)


def require_visual(c):
    if not require_materials(c['id']):
        return False
    reviews = {k: read_json(cdir(c['id'], 'reviews', f'{c["attempt"]}-{k}.json')) for k in ('A', 'B')}
    report = gates.visual_report(cdir(c['id']), reviews)
    if report['ok']:
        return True
    store.update_concept(c['id'], stage='review', status='queued', reasons=report['problems'])
    return False


def start_bake(c, remove=False):
    if not remove and not require_visual(c):
        return
    if not BAKING.acquire(blocking=False):
        return
    cid = c['id']
    store.update_concept(cid, status='running')
    log_path = cdir(cid, 'logs', f'bake-{time.strftime("%m%d-%H%M%S")}.log')
    jid = store.add_job(cid, 'bake', 'remove' if remove else '', log_path)

    def work():
        try:
            pr = bake(cid, remove, log_path)
            store.update_job(jid, status='done', ended=store.now(), result={'pr': pr})
            if remove:
                store.update_concept(cid, stage='discarded', status='idle', pr=pr)
                store.log(cid, f'번들에서 뺐다 — {pr}')
            else:
                store.update_concept(cid, stage='done', status='idle', pr=pr)
                store.log(cid, f'구움 — {pr}')
        except Exception as e:
            store.update_job(jid, status='failed', ended=store.now(), result={'error': str(e)[-800:]})
            store.update_concept(cid, status='queued', note=f'굽기 실패: {str(e)[-300:]}')
            store.log(cid, f'굽기 실패 — {str(e)[-300:]}')
            time.sleep(600)   # 같은 실패를 바로 되풀이하지 않는다
        finally:
            BAKING.release()
    threading.Thread(target=work, daemon=True).start()


def git(args, log_path, cwd=None):
    with open(log_path, 'a') as log:
        log.write('$ git ' + ' '.join(args) + '\n')
        proc = subprocess.run(['git', *args], cwd=cwd or BAKE_WT, env=ENV, stdout=log, stderr=subprocess.STDOUT, text=True, timeout=600)
    if proc.returncode:
        raise RuntimeError(f'git {" ".join(args)} 실패({proc.returncode}) — {log_path}')


def sh(cmd, log_path, cwd=None):
    with open(log_path, 'a') as log:
        log.write('$ ' + ' '.join(cmd) + '\n')
        proc = subprocess.run(cmd, cwd=cwd or BAKE_WT, env=ENV, capture_output=True, text=True, timeout=600)
        log.write(proc.stdout + proc.stderr)
    if proc.returncode:
        raise RuntimeError(f'{cmd[0]} {cmd[1] if len(cmd) > 1 else ""} 실패 — {(proc.stdout + proc.stderr)[-300:]}')
    return proc.stdout.strip()


def bake(cid, remove, log_path):
    """origin/main 위 새 브랜치에 카드(와 예제 그림)를 넣고 PR → 머지. 반환: PR 주소."""
    if not remove and not require_visual(store.concept(cid)):
        raise RuntimeError('재료·시각 관문 미통과 — 배포 금지')
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    if not os.path.isdir(BAKE_WT):
        git(['worktree', 'add', '--detach', BAKE_WT, 'origin/main'], log_path, cwd=ROOT)
    git(['fetch', '-q', 'origin', 'main'], log_path)
    git(['reset', '-q', '--hard'], log_path)
    git(['clean', '-fdq', 'src/assets', 'public/assets/concept-cards'], log_path)
    branch = f'super-harness/{"unbake" if remove else "bake"}-{cid}-{time.strftime("%m%d%H%M")}'
    git(['checkout', '-q', '-B', branch, 'origin/main'], log_path)
    if not os.path.exists(os.path.join(BAKE_WT, 'src/ai/conceptCards.ts')):
        raise RuntimeError('main 에 개념 카드 연결(src/ai/conceptCards.ts)이 아직 없다')
    bundle_path = os.path.join(BAKE_WT, 'src/assets/conceptCards.json')
    bundle = read_json(bundle_path, {'version': 1, 'cards': []})
    cards = [card for card in bundle.get('cards', []) if card.get('id') != cid]
    img_dir = os.path.join(BAKE_WT, 'public/assets/concept-cards', cid)
    shutil.rmtree(img_dir, ignore_errors=True)
    calls_path = os.path.join(BAKE_WT, 'src/assets/conceptCardExamples', f'{cid}.json')
    if os.path.exists(calls_path):
        os.remove(calls_path)
    c = store.concept(cid)
    if not remove:
        card = read_json(cdir(cid, 'card.json'))
        check = read_json(cdir(cid, 'examples', 'check.json'), {}) or {}
        os.makedirs(img_dir, exist_ok=True)
        for ex in check.get('examples', []):
            if not ex.get('maps'):
                continue
            src = cdir(cid, 'examples', ex['maps'][0]['png'])
            name = f'{ex["variant"]}--{ex["example"]}.png'
            if os.path.exists(src):
                shutil.copyfile(src, os.path.join(img_dir, name))
                for variant in card.get('variants', []):
                    if variant.get('id') != ex['variant']:
                        continue
                    for example in variant.get('examples', []):
                        if example.get('id') == ex['example']:
                            example['image'] = f'/assets/concept-cards/{cid}/{name}'
        # 예제 호출은 따로 둔다 — 80×80 평면은 수천 자라 첫 번들·조수 노트에 실을 수 없다(build_concept_example 가 지연 로드).
        calls = {}
        for variant in card.get('variants', []):
            for example in variant.get('examples', []):
                if example.get('calls'):
                    calls[f'{variant["id"]}/{example["id"]}'] = example.pop('calls')
        os.makedirs(os.path.dirname(calls_path), exist_ok=True)
        write_json(calls_path, calls)
        if isinstance(card.get('parent'), dict):
            card['parent'] = c.get('parent') or slug(card['parent'].get('id'))
        card['requires'] = [r for r in (c.get('requires') or [])]
        if not card['requires']:
            card.pop('requires')
        card['bakedAt'] = store.now()
        card.pop('probeText', None)
        cards.append(card)
    bundle['cards'] = sorted(cards, key=lambda card: card.get('id', ''))
    write_json(bundle_path, bundle)
    git(['add', '-A', 'src/assets/conceptCards.json', 'src/assets/conceptCardExamples', 'public/assets/concept-cards'], log_path)
    verb = '뺀다' if remove else '굽는다'
    body = f'슈퍼하네스(codex {MODEL} {EFFORT})가 만들고 적대 검수 2명·조수 시험을 통과한 카드.' if not remove else '사용자 폐기.'
    git(['-c', 'user.name=super-harness', '-c', 'user.email=super-harness@oprn.local', 'commit', '-q', '-m',
         f'feat(concept-cards): 「{c["title"]}」 개념 카드를 {verb}\n\n{body}'], log_path)
    git(['push', '-q', '-u', 'origin', branch], log_path)
    time.sleep(20)   # 푸시하면 자동화가 PR 을 열고 머지하는 경우가 있다 — 잠깐 기다렸다 상태를 본다.
    pr = sh(['gh', 'pr', 'list', '--head', branch, '--state', 'all', '--json', 'url,state', '--jq', '.[0] | "\\(.url) \\(.state)"'], log_path)
    if not pr or pr == 'null null':
        url = sh(['gh', 'pr', 'create', '--base', 'main', '--head', branch, '--title', f'feat(concept-cards): 「{c["title"]}」 개념 카드를 {verb}',
                  '--body', body + '\n\n화면: http://mdc-server:18315/'], log_path)
        state = 'OPEN'
    else:
        url, state = pr.split(' ', 1)
    if state != 'MERGED':
        number = url.rstrip('/').split('/')[-1]
        sh(['gh', 'pr', 'merge', number, '--merge', '--subject', f'merge: integrate PR #{number} into main'], log_path)
    return url


# ───────────────────────── 한 박자 ─────────────────────────

def tick():
    reap()
    if store.setting('paused') == '1':
        return
    max_codex = int(store.setting('max_codex'))
    # 하루 상한은 없다(2026-10-04 사용자) — 동시 실행 수만 지킨다.
    codex_free = lambda need=1: len(running(['discover', 'plan', 'plan-review', 'survey', 'material-review', 'art', 'art-layout-review', 'art-context-review', 'build', 'review', 'judge'])) + need <= max_codex

    release_waiting()
    active = store.concepts("stage IN ('plan','plan-review','survey','material-review','art-layout-review','art-context-review','build','review','probe','bake','unbake')")
    for c in store.concepts("stage='discovered'"):
        if len([a for a in active if a['stage'] != 'bake']) >= int(store.setting('max_active')):
            break
        store.update_concept(c['id'], stage='plan', status='queued')
        store.log(c['id'], '큐에서 꺼냄 → 공간 기획')
        active.append(store.concept(c['id']))

    waiting = len(store.concepts("stage='discovered'"))
    last = float(store.setting('last_discover') or 0)
    if waiting < int(store.setting('min_waiting')) and not running(['discover']) and time.time() - last > 60 * int(store.setting('discover_every_min')) and codex_free():
        store.set_setting('last_discover', str(time.time()))
        start_discover()

    for c in store.concepts("stage='art' AND status='queued'"):
        if len(running(['art', 'art-native'])) >= int(store.setting('max_art')) or not codex_free():
            break
        start_art(c)

    # Revalidation can queue many concepts at once; admit at most max_active, retaining running work.
    publishing = [c for c in active if c['stage'] in ('bake', 'unbake')]
    candidates = sorted((c for c in active if c['stage'] not in ('bake', 'unbake')),
                        key=lambda c: (c['status'] != 'running', -(c['priority'] or 0)))
    for c in publishing + candidates[:int(store.setting('max_active'))]:
        if c['status'] != 'running' and any(m['concept'] == c['id'] for m in running()):
            continue
        if c['status'] == 'running' and c['stage'] != 'probe':
            continue
        if c['stage'] == 'plan' and codex_free():
            start_plan(c)
        elif c['stage'] == 'plan-review' and codex_free(2):
            start_plan_reviews(c)
        elif c['stage'] == 'survey' and codex_free():
            start_survey(c)
        elif c['stage'] == 'material-review' and codex_free():
            start_material_review(c)
        elif c['stage'] == 'art-layout-review' and codex_free():
            start_art_layout_review(c)
        elif c['stage'] == 'art-context-review' and codex_free():
            start_art_context_review(c)
        elif c['stage'] == 'build' and codex_free():
            start_build(c)
        elif c['stage'] == 'review' and codex_free(2):
            start_reviews(c)
        elif c['stage'] == 'probe' and (codex_free() or running(['probe'])):
            step_probe(c)
        elif c['stage'] == 'bake':
            start_bake(c)
        elif c['stage'] == 'unbake':
            start_bake(c, remove=True)


def daemon():
    store.init()
    recover()
    store.log(None, f'데몬 시작 — codex {MODEL} {EFFORT}')
    while True:
        try:
            tick()
        except Exception:
            store.log(None, f'박자 오류: {traceback.format_exc()[-800:]}')
        time.sleep(15)


# ───────────────────────── 화면 ─────────────────────────

def concept_detail(c):
    cid = c['id']
    d = dict(c)
    d['planning'] = read_json(cdir(cid, 'planning.json'))
    d['planningReviews'] = {k: read_json(cdir(cid, 'planning-reviews', k + '.json')) for k in ('A', 'B')}
    d['card'] = read_json(cdir(cid, 'card.json'))
    d['gaps'] = read_json(cdir(cid, 'gaps.json'))
    d['verify'] = read_json(cdir(cid, 'verify.json'))
    d['check'] = read_json(cdir(cid, 'examples', 'check.json'))
    d['reviews'] = {os.path.basename(p)[:-5]: read_json(p) for p in sorted(glob.glob(cdir(cid, 'reviews', '*.json')))}
    d['judges'] = {os.path.basename(p)[:-5]: read_json(p) for p in sorted(glob.glob(cdir(cid, 'judge-*.json')))}
    probes = {}
    for run in sorted(glob.glob(cdir(cid, 'probe', '*'))):
        if os.path.isdir(run):
            probes[os.path.basename(run)] = read_json(os.path.join(run, 'score', 'score.json'))
    d['probes'] = probes
    d['probeText'] = probe_text(cid, c) if d['card'] else None
    d['log'] = store.recent_log(60, cid)
    return d


def state():
    concepts = store.concepts()
    return {
        'now': store.now(), 'model': MODEL, 'effort': EFFORT,
        'settings': {k: store.setting(k) for k in store.DEFAULT_SETTINGS},
        'today': {'codex': store.started_today(['discover', 'survey', 'material-review', 'build', 'review', 'judge']), 'probe': store.started_today(['probe'])},
        'running': [{'id': jid, **{k: v for k, v in m.items() if k in ('kind', 'tag', 'concept')}} for jid, (_, _, m) in PROCS.items()],
        'concepts': [concept_detail(c) for c in concepts],
        'gaps': store.gaps(),
        'log': store.recent_log(120),
        'jobs': store.jobs(limit=60),
    }


def action(body):
    cid, kind, text = body.get('cid'), body.get('action'), str(body.get('text', '')).strip()
    if kind in ('pause', 'resume'):
        store.set_setting('paused', '1' if kind == 'pause' else '0')
        store.log(None, '사람: 전체 멈춤' if kind == 'pause' else '사람: 다시 돌림')
        return {'ok': True}
    c = store.concept(cid) if cid else None
    if not c:
        return {'ok': False, 'error': '개념이 없다'}
    if kind in ('choose-art', 'clear-art'):
        try:
            return {'ok': True, 'choices': art_choices.choose(DATA, cid, body)}
        except (ValueError, KeyError, OSError) as error:
            return {'ok': False, 'error': str(error)}
    if kind == 'recheck-materials':
        if any(m['concept'] == cid for _, _, m in PROCS.values()):
            return {'ok': False, 'error': '진행 중인 작업을 먼저 멈춰 주세요'}
        if not require_planning(cid):
            return {'ok': True}
        store.update_concept(cid, stage='survey', status='queued', note='사람 요청: 공용 등록된 재료 다시 확인', reasons=[])
        return {'ok': True}
    if kind == 'fix':
        if not text:
            return {'ok': False, 'error': '무엇을 고칠지 적어 주세요'}
        for jid, (_, _, m) in list(PROCS.items()):
            if m['concept'] == cid:
                m['superseded'] = True
                kill(jid)
        store.update_concept(cid, stage='plan', status='queued', attempt=1, plan_attempt=1, feedback=c['feedback'] + [{'at': store.now(), 'text': text}], reasons=[])
        store.log(cid, f'사람 교정: {text}')
    elif kind == 'discard':
        for jid, (_, _, m) in list(PROCS.items()):
            if m['concept'] == cid:
                m['superseded'] = True
                kill(jid)
        baked = c['stage'] == 'done' or bool(c['pr'])
        store.update_concept(cid, stage='unbake' if baked else 'discarded', status='queued' if baked else 'idle',
                             note=f'사람 폐기: {text}' if text else '사람 폐기')
        store.log(cid, f'사람 폐기{" — 번들에서 빼는 PR 로" if baked else ""}: {text}')
    elif kind == 'priority':
        store.update_concept(cid, priority=(c['priority'] or 0) + float(body.get('delta', 0.2)))
    elif kind == 'retry':
        if any(m['concept'] == cid for m in running()):
            return {'ok': False, 'error': '진행 중인 작업이 있어 재시작할 수 없습니다'}
        store.update_concept(cid, stage='plan', status='queued', attempt=1, plan_attempt=1, reasons=[])
        store.log(cid, '사람: 처음부터 다시')
    else:
        return {'ok': False, 'error': f'모르는 동작 {kind}'}
    return {'ok': True}


# ── 갤러리(사람용 화면) — 그림 한 장 + 한 줄 상태 + 한 줄 설명. 가볍게. ──
THUMBS = os.path.join(DATA, 'thumbs')
GROUP = {'plan': 'work', 'plan-review': 'work', 'survey': 'work', 'material-review': 'work', 'art-review': 'pick', 'art-layout-review': 'work', 'art-context-review': 'work', 'done': 'done', 'discovered': 'wait', 'waiting': 'wait', 'art': 'wait', 'blocked': 'stop', 'discarded': 'stop'}


def first_sentence(text, limit=90):
    text = re.sub(r'\s+', ' ', str(text or '')).strip()
    m = re.match(r'(.+?[.。!?]|.+?다\.)(\s|$)', text)
    text = m.group(1) if m else text
    return text if len(text) <= limit else text[:limit - 1] + '…'


def plain_status(c):
    stage, n = c['stage'], c['attempt'] or 1
    if stage == 'discovered':
        return '차례 기다림'
    if stage == 'waiting':
        names = [(store.concept(r) or {}).get('title', r) for r in c['requires']]
        return f'「{"」「".join(names)}」 먼저 만드는 중'
    if stage == 'plan':
        return f'공간 기획·텍스트 도면 작성 ({c["plan_attempt"]}차)'
    if stage == 'plan-review':
        return '기획·텍스트 도면 적대적 검수'
    if stage == 'survey':
        return '재료 조사 — 맵 제작 전'
    if stage == 'material-review':
        return '시대·필수 칩 독립 검수'
    if stage == 'art-layout-review':
        return '제작 전 배치·비례·여백 검수'
    if stage == 'art-context-review':
        return '조립 예시 독립 검수 중' if c['status'] == 'running' else '조립 예시 검수 대기'
    if stage == 'art-review':
        try:
            choices = art_choices.view(DATA, c['id'])
        except (ValueError, OSError, KeyError, TypeError):
            return '선택 자료 확인 필요'
        if choices.get('blocked'): return '후보 수정 필요 · 현재 선택 불가'
        return '선택 완료 · 공용 등록 필요' if choices['complete'] else f'내 선택 필요 · {choices["selectedCount"]}/{choices["total"]} 선택' if choices['total'] else '선택 예시 준비 필요'
    if stage == 'art':
        if c.get('art_revision'):
            return f'피드백 반영 재생성 {c["art_revision"]}차 ' + ('진행 중' if c['status'] == 'running' else '대기 · 전체 멈춤' if store.setting('paused') == '1' else '대기')
        orders = [g for g in store.gaps() if g['concept'] == c['id'] and g.get('item')]
        return '칩 후보 제작 중' if c['status'] == 'running' else f'부족분 {len(orders)}건 — 칩 제작 대기'
    if stage == 'build':
        return f'고치는 중 ({n}번째)' if c['reasons'] or n > 1 else '만드는 중'
    return {'review': '검수 중', 'probe': '조수에게 시켜 보는 중', 'bake': '에디터에 넣는 중', 'unbake': '에디터에서 빼는 중',
            'done': '완성 · 에디터에 들어감', 'blocked': '막힘 — 봐 주세요', 'discarded': '폐기'}.get(stage, stage)


def example_images(cid):
    check = read_json(cdir(cid, 'examples', 'check.json'), {}) or {}
    out = []
    for ex in check.get('examples', []):
        for m in ex.get('maps', []):
            path = cdir(cid, 'examples', m['png'])
            if os.path.exists(path):
                out.append({'path': os.path.relpath(path, DATA), 'label': f'{ex.get("title", "")} · {m.get("width")}×{m.get("height")}',
                            'v': int(os.path.getmtime(path))})
    return out


def concept_about(c, card):
    planning = read_json(cdir(c['id'], 'planning.json'), {}) or {}
    variants = planning.get('variants', []) if isinstance(planning, dict) else []
    purposes = [v['purpose'] for v in variants if isinstance(v, dict) and isinstance(v.get('purpose'), str) and v['purpose'].strip()]
    if purposes:
        return ' '.join(purposes)
    if c['stage'] in ('plan', 'plan-review'):
        return '공간의 용도·구역·동선을 새 기획과 텍스트 도면으로 확인할 예정입니다.'
    return card.get('summary') or c['why']


def verified_images(root, refs, label, kind):
    root = os.path.realpath(root)
    images = []
    if not isinstance(refs, list):
        return images
    for ref in refs:
        try:
            path = os.path.realpath(os.path.join(root, ref['path']))
            if path.startswith(root + os.sep) and os.path.isfile(path) and gates.digest(path) == ref.get('sha256'):
                images.append({'path': os.path.relpath(path, DATA), 'label': ref.get('label') or label,
                               'kind': kind, 'v': int(os.path.getmtime(path))})
        except (OSError, TypeError, KeyError):
            continue
    return images


def planning_images(cid):
    manifest = read_json(cdir(cid, 'planning-visual.json'), {}) or {}
    if not isinstance(manifest, dict) or manifest.get('fingerprint') != gates.planning_report(cdir(cid), approved=False)['fingerprint']:
        return []
    return verified_images(cdir(cid), manifest.get('images'), '기획도', '기획도')


def candidate_images(cid):
    result = read_json(cdir(cid, 'art-result.json'), {}) or {}
    if not isinstance(result, dict) or not isinstance(result.get('candidates'), list):
        return []
    root = os.path.join(DATA, 'art-worktrees', cid)
    return [image for candidate in result['candidates'] if isinstance(candidate, dict)
            for image in verified_images(root, candidate.get('images'), '칩 후보 · 선택 전', '칩 후보')]


def before_build(c):
    return c['stage'] in ('plan', 'plan-review', 'survey', 'material-review', 'art', 'art-review', 'art-layout-review', 'art-context-review') or (
        c['stage'] == 'blocked' and not gates.material_report(cdir(c['id']))['ok'])


def gallery_list():
    items = []
    for c in store.concepts():
        card = read_json(cdir(c['id'], 'card.json'), {}) or {}
        if before_build(c):
            imgs = candidate_images(c['id']) or planning_images(c['id'])
        else:
            imgs = example_images(c['id'])
        status = plain_status(c)
        group = 'stop' if status.startswith('후보 수정 필요') else 'wait' if c['stage'] == 'art-review' and status.startswith('선택 완료') else GROUP.get(c['stage'], 'work')
        items.append({'id': c['id'], 'title': c['title'], 'stage': c['stage'], 'group': group,
                      'running': c['status'] == 'running', 'status': status,
                      'about': first_sentence(concept_about(c, card)), 'updated': c['updated'],
                      'thumb': imgs[0] if imgs else None, 'pr': c['pr'], 'parent': c.get('parent')})
    paused = store.setting('paused') == '1'
    return {'paused': paused, 'items': items}


def gallery_detail(cid):
    c = store.concept(cid)
    if not c:
        return None
    card = read_json(cdir(cid, 'card.json'), {}) or {}
    imgs = example_images(cid) if not before_build(c) else []
    # 조수에게 실제로 시킨 결과(카드 붙여서) — 마지막 시도.
    tried = []
    for run in sorted(glob.glob(cdir(cid, 'probe', f'a{c["attempt"]}-*'))):
        score = read_json(os.path.join(run, 'score', 'score.json'), {}) or {}
        for m in score.get('maps', [])[:2]:
            path = os.path.join(run, 'score', m['png']) if os.path.exists(os.path.join(run, 'score', m['png'])) else os.path.join(run, m['png'])
            if os.path.exists(path):
                tried.append({'path': os.path.relpath(path, DATA), 'label': f'조수가 지은 맵 · {m.get("width", "")}×{m.get("height", "")}', 'v': int(os.path.getmtime(path))})
    if before_build(c):
        tried = []
    orders = [g['item'] for g in store.gaps() if g['concept'] == cid and g.get('item')]
    variants = [f'{v.get("title", "")} — {v.get("worldview", "")}{" · " + v["size"] if v.get("size") else ""}' for v in card.get('variants', [])]
    kids = [{'id': k['id'], 'title': k['title']} for k in store.concepts('parent=?', (cid,))]
    return {'id': cid, 'title': c['title'], 'status': plain_status(c), 'stage': c['stage'],
            'about': concept_about(c, card), 'variants': variants, 'images': imgs[:8], 'tried': tried[:4],
            'why': [re.sub(r'^\[[AB]\]\s*', '', r) for r in (c['reasons'] or [])][:3],
            'orders': [{'ko': o.get('ko') or o.get('id'), 'size': f'{o["w"]}×{o["h"]}칸' if o.get('w') and o.get('h') else '', 'desc': first_sentence(o.get('desc'), 120)} for o in orders][:20],
            'feedback': [f['text'] for f in c['feedback']][-3:], 'pr': c['pr'],
            'parent': (store.concept(c['parent']) or {}).get('title') if c.get('parent') else None, 'children': kids}


# ── 읽는 문서(마크다운) — 사람이 읽기 쉽게. 화면도 이걸 그대로 그린다. ──
def md_img(im, width=900):
    from urllib.parse import quote
    return f'![{im["label"]}](/thumb?p={quote(im["path"])}&w={width}&v={im["v"]})'


def md_cell(text):
    return str(text or '').replace('|', '／').replace('\n', ' ')


def concept_markdown(cid):
    d = gallery_detail(cid)
    if not d:
        return None
    c = store.concept(cid)
    card = read_json(cdir(cid, 'card.json'), {}) or {}
    L = [f'# {d["title"]}', '', f'**상태** {d["status"]}' + (f' · 「{d["parent"]}」의 하위' if d['parent'] else '') + (f' · [PR]({d["pr"]})' if d['pr'] else ''), '']
    L += ['> ' + line for line in str(d['about']).splitlines()] + ['']
    layout_input = read_json(cdir(cid, 'art-layout-input.json'), {}) or {}
    if layout_input:
        layout = layout_input.get('layout', {})
        review = read_json(cdir(cid, 'art-layout-review.json'), {}) or {}
        verdict = review.get('verdict', '검수 대기') if review.get('fingerprint') == layout_input.get('fingerprint') else '검수 대기'
        L += ['## 이번 표본 도면 · 제작 전 검수', '', f'판정: **{verdict}**', '', '```text', *layout.get('grid', []), '```', '']
        L += [f'- {symbol}: {item.get("purpose", "")}' for symbol, item in layout.get('legend', {}).items()]
        L += ['', '| 검수 항목 | 판정 | 근거 |', '|---|---|---|']
        if review.get('fingerprint') == layout_input.get('fingerprint'):
            L += [f'| {md_cell(k)} | {md_cell(v.get("verdict"))} | {md_cell(v.get("evidence"))} |' for k, v in review.get('checks', {}).items()]
        L += ['']
    feedback = read_json(cdir(cid, 'art-feedback.json'), {}) or {}
    if feedback:
        L += ['## 검수 피드백 → 자동 수정', '', f'수정 차수: {feedback.get("revision")} / {feedback.get("limits", {}).get("maxRevisions")} · {c.get("note", "")}', '']
        for repair in feedback.get('repairs', []):
            L += [f'### {repair.get("group")} / {repair.get("candidate")}', '']
            for fix in repair.get('fixes', []):
                L += [f'- **{fix.get("target")}**: {fix.get("problem")}', f'  - 변경: {fix.get("change")}', f'  - 유지: {fix.get("keep")}']
        L += ['']
    art = read_json(cdir(cid, 'art-result.json'), {}) or {}
    if art:
        L += ['## 칩 제작 결과', '']
        for candidate in art.get('candidates', []):
            L += [f'- 담당: **{md_cell(candidate.get("harness"))}** · 후보: {md_cell(candidate.get("selection"))}']
            for image in verified_images(os.path.join(DATA, 'art-worktrees', cid), candidate.get('images'), '칩 후보 · 사람 선택 전', '칩 후보'):
                L += ['', md_img(image), '']
        L += [f'- 남은 일: {text}' for text in art.get('remaining', [])] + ['']
    diagrams = planning_images(cid)
    if diagrams:
        L += ['## 기획 도면 이미지', '', '> 구역·연결을 보여주는 기획도입니다. 실제 칩으로 시공한 맵 그림은 다음 단계에서 별도로 만듭니다.', '']
        L += [md_img(im) for im in diagrams] + ['']
    L += [gates.planning_markdown(cdir(cid)), '']
    plan = read_json(cdir(cid, 'materials.json'), {}) or {}
    if before_build(c):
        L += ['> 맵 제작 전 관문입니다. 이전 초안은 보존되어 있지만 기획·도면과 재료 준비가 승인되기 전에는 예제 맵으로 표시하지 않습니다.', '']
    for variant in plan.get('variants', []):
        L += [f'## 재료 준비 — {variant.get("id", "")}', '', '| 필요한 재료 | 준비 | 역할 |', '|---|---|---|']
        L += [f'| {md_cell(r.get("what"))} | {"재고 근거 있음" if r.get("available") else "제작 필요"} | {md_cell(r.get("role"))} |' for r in variant.get('requirements', [])] + ['']
    if c['reasons']:
        L += ['## 지금 고치는 이유', ''] + [f'- {w}' for w in c['reasons']] + ['']
    if d['images']:
        L += ['## 예제 맵', ''] + [md_img(im) for im in d['images']] + ['']
    if d['tried']:
        L += ['## 조수에게 「만들어줘」라고 시켜 본 결과', ''] + [md_img(im) for im in d['tried']] + ['']
    for v in card.get('variants', []):
        prefix = '이전 초안 변형' if before_build(c) else '변형'
        L += [f'## {prefix} — {v.get("title", "")}', '']
        meta = [v.get('worldview'), v.get('size') and f'크기 {v["size"]}', v.get('tilesetId') and f'칩셋 `{v["tilesetId"]}`']
        L += ['· '.join(m for m in meta if m), '']
        if v.get('build'):
            L += [f'**짓는 법** {v["build"]}', '']
        if v.get('structure'):
            L += ['### 구조', ''] + [f'- {s}' for s in v['structure']] + ['']
        if v.get('include'):
            L += ['### 재료', '', '| 무엇 | 까는 방식 | 어떻게 |', '|---|---|---|']
            L += [f'| {md_cell(m.get("what"))} | {"이벤트" if m.get("as") == "event" else "그림"} | {md_cell(m.get("how"))} |' for m in v['include']] + ['']
        if v.get('exclude'):
            L += ['### 넣지 않는 것', ''] + [f'- {s}' for s in v['exclude']] + ['']
        if v.get('emptiness'):
            L += [f'**빈칸** {v["emptiness"]}', '']
    orders = [g for g in store.gaps() if g['concept'] == cid]
    if orders:
        L += [f'## 그림·도구 주문 {len(orders)}건', '']
        for g in orders:
            it = g.get('item') or {}
            size = f' · {it["w"]}×{it["h"]}칸' if it.get('w') and it.get('h') else ''
            L += [f'- **{it.get("ko") or g["what"]}**{size} — {it.get("desc") or g["what"]} _(→ {g["route"] or "?"})_']
        L += ['']
    if d['children']:
        L += ['## 여기서 자란 개념', '', ' · '.join(f'[{k["title"]}](/?concept={k["id"]})' for k in d['children']), '']
    if d['feedback']:
        L += ['## 내가 준 교정', ''] + [f'- {f}' for f in d['feedback']] + ['']
    log = store.recent_log(12, cid)
    if log:
        L += ['## 최근 기록', ''] + [f'- `{e["at"][5:16]}` {e["text"]}' for e in log] + ['']
    return '\n'.join(L)


def concept_world(cid):
    card = read_json(cdir(cid, 'card.json'), {}) or {}
    for v in card.get('variants', []):
        if v.get('worldviewId'):
            return v['worldviewId']
    return 'unknown'


def orders_markdown():
    names = {w['id']: w['ko'] for w in worldviews()['worldviews']}
    names['unknown'] = '세계관 미정'
    groups = {}
    for g in store.gaps():
        groups.setdefault(concept_world(g['concept']), {}).setdefault(g['concept'], []).append(g)
    total = sum(len(v) for w in groups.values() for v in w.values())
    art = sum(1 for w in groups.values() for v in w.values() for g in v if g.get('item'))
    L = ['# 그림 주문서', '', f'개념 카드를 만들다 「에디터에 없어서 못 짓는다」고 적은 것 **{total}건** — 그중 그릴 수 있게 주문서가 붙은 그림 **{art}건**.', '',
         '> 재료 조사 → 전용 하네스의 칩 후보 제작 → 사람 선택·공용 등록 → 재료 재검수 순서로 진행한다. 중지 중에는 새 작업을 실행하지 않는다.', '']
    for wid in sorted(groups, key=lambda k: -sum(len(v) for v in groups[k].values())):
        L += [f'## {names.get(wid, wid)} — {sum(len(v) for v in groups[wid].values())}건', '']
        for cid, gs in sorted(groups[wid].items(), key=lambda kv: -len(kv[1])):
            title = (store.concept(cid) or {}).get('title', cid)
            L += [f'### [{title}](/?concept={cid}) ({len(gs)})', '', '| 그림 | 크기 | 종류 | 모습 | 맡을 곳 |', '|---|---|---|---|---|']
            for g in gs:
                it = g.get('item') or {}
                size = f'{it["w"]}×{it["h"]}' if it.get('w') and it.get('h') else ''
                L.append(f'| **{md_cell(it.get("ko") or g["what"][:40])}** | {size} | {md_cell(it.get("category") or g["kind"])} | {md_cell(it.get("desc") or g["what"])} | `{md_cell(g["route"])}` |')
            L.append('')
    return '\n'.join(L)


def thumb_bytes(rel, width):
    src = os.path.realpath(os.path.join(DATA, rel))
    if not src.startswith(os.path.realpath(DATA) + os.sep) or not os.path.isfile(src):
        return None
    width = max(120, min(int(width or 360), 1600))
    key = re.sub(r'[^A-Za-z0-9_.-]', '_', rel) + f'.{width}.{os.stat(src).st_mtime_ns}.png'
    out = os.path.join(THUMBS, key)
    if not os.path.exists(out):
        from PIL import Image
        os.makedirs(THUMBS, exist_ok=True)
        with Image.open(src) as im:
            rgba = im.convert('RGBA')
            im = Image.new('RGB', rgba.size, '#20252e')
            im.paste(rgba, mask=rgba.getchannel('A'))
            if im.width > width:
                im = im.resize((width, max(1, round(im.height * width / im.width))), Image.Resampling.BOX)
            im.save(out + '.tmp.png', optimize=True)
        os.replace(out + '.tmp.png', out)
    with open(out, 'rb') as f:
        return f.read()


@lru_cache(maxsize=1)
def markdown_module():
    """편집기의 안전한 DOM 마크다운 표시기를 재사용한다. 데몬당 한 번만 변환한다."""
    return subprocess.run([BUN, 'build', os.path.join(ROOT, 'src/util/markdown.ts'), '--target=browser'],
                          capture_output=True, check=True, timeout=15).stdout


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body, ctype='application/json; charset=utf-8', cache=None):
        data = body if isinstance(body, bytes) else (json.dumps(body, ensure_ascii=False) if not isinstance(body, str) else body).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', cache or 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in ('/', '/index.html', '/orders', '/detail'):
            page = 'gallery.html' if url.path != '/detail' else 'index.html'
            with open(os.path.join(HERE, 'web', page), 'rb') as f:
                return self.send(200, f.read(), 'text/html; charset=utf-8')
        if url.path == '/art-choice.js':
            with open(os.path.join(HERE, 'web', 'art-choice.js'), 'rb') as f:
                return self.send(200, f.read(), 'text/javascript; charset=utf-8')
        if url.path == '/markdown.js':
            try:
                return self.send(200, markdown_module(), 'text/javascript; charset=utf-8')
            except subprocess.SubprocessError:
                return self.send(500, {'error': '문서 표시기를 불러오지 못했습니다.'})
        q = parse_qs(url.query)
        if url.path == '/api/list':
            return self.send(200, gallery_list())
        if url.path == '/api/art-choices':
            try:
                return self.send(200, art_choices.view(DATA, q.get('id', [''])[0]))
            except (ValueError, OSError, KeyError) as error:
                return self.send(404, {'error': str(error)})
        if url.path == '/api/concept':
            d = gallery_detail(q.get('id', [''])[0])
            return self.send(200 if d else 404, d or {'error': 'not found'})
        if url.path.startswith('/md/'):
            name = unquote(url.path[4:])
            text = orders_markdown() if name == 'orders.md' else concept_markdown(name[:-3]) if name.endswith('.md') else None
            return self.send(200, text, 'text/plain; charset=utf-8') if text else self.send(404, {'error': 'not found'})
        if url.path == '/thumb':
            data = thumb_bytes(unquote(q.get('p', [''])[0]), q.get('w', ['360'])[0])
            return self.send(200, data, 'image/png', 'public, max-age=86400') if data else self.send(404, {'error': 'not found'})
        if url.path == '/api/state':
            return self.send(200, state())
        if url.path == '/api/joblog':
            job = store.jobs('id=?', (int(parse_qs(url.query).get('id', ['0'])[0]),))
            if not job or not job[0]['log'] or not os.path.exists(job[0]['log']):
                return self.send(404, {'error': 'no log'})
            with open(job[0]['log'], 'rb') as f:
                f.seek(0, 2); size = f.tell(); f.seek(max(0, size - 12000))
                return self.send(200, f.read(), 'text/plain; charset=utf-8')
        if url.path.startswith('/data/'):
            path = os.path.realpath(os.path.join(DATA, unquote(url.path[6:])))
            if not path.startswith(os.path.realpath(DATA) + os.sep) or not os.path.isfile(path):
                return self.send(404, {'error': 'not found'})
            ctype = 'image/png' if path.endswith('.png') else 'application/json; charset=utf-8' if path.endswith('.json') else 'text/plain; charset=utf-8'
            with open(path, 'rb') as f:
                return self.send(200, f.read(), ctype)
        return self.send(404, {'error': 'not found'})

    def do_POST(self):
        if urlparse(self.path).path != '/api/action':
            return self.send(404, {'error': 'not found'})
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        return self.send(200, action(body))


def serve():
    store.init()
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()


def main(argv):
    cmd = argv[0] if argv else 'status'
    store.init()
    if cmd == 'run':
        threading.Thread(target=serve, daemon=True).start()
        daemon()
    elif cmd == 'serve':
        serve()
    elif cmd == 'add':
        cid, title, *aliases = argv[1:]
        print(store.add_concept(cid, title, aliases or [title], '사람이 넣음', 'manual', 1.0))
    elif cmd in ('pause', 'resume'):
        print(action({'action': cmd}))
    elif cmd == 'status':
        for c in store.concepts():
            print(f'{c["stage"]:10} {c["status"]:8} a{c["attempt"]} {c["id"]:24} {c["title"]}  {c["pr"] or ""}')
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
