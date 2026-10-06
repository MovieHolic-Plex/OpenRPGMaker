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
from pathlib import Path
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
import art_demo
import art_batches
import keyword_seeds
import theme_production
import production_strategy
import finish_priority
import provider_retry
import art_choices  # noqa: E402
import art_feedback  # noqa: E402
import art_repair  # noqa: E402
import art_layout  # noqa: E402
import art_acceptance  # noqa: E402
import activity  # noqa: E402
import space_decisions  # noqa: E402

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
    path = os.fspath(path)
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
    saved = dict(meta, kind=kind, tag=tag, concept=cid, invocation={'cmd':cmd,'cwd':str(cwd),'log':str(log_path),'timeout':timeout,'stdin':str(stdin_path) if stdin_path else None})
    if cid and (theme:=theme_production.context(cid)):
        saved.update(themePolicyHash=theme['policyHash'],themeBriefSha256=theme['briefSha256'])
    write_json(os.path.join(DATA, 'job-invocations', str(jid)+'.json'), saved)
    try:
        with open(log_path, 'w') as output:
            source = open(stdin_path, 'rb') if stdin_path else None
            try:
                p = subprocess.Popen(cmd, cwd=cwd, env=ENV, stdin=source or subprocess.DEVNULL,
                                     stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
            finally:
                if source: source.close()
    except Exception:
        store.update_job(jid, status='launch-failed', ended=store.now())
        raise
    store.update_job(jid, pid=p.pid)
    PROCS[jid] = (p, time.time() + timeout, saved)
    store.log(cid, f'시작 — {kind} {tag}'.strip())
    return jid


def start_codex(cid, kind, tag, prompt, result_path, extra_dirs=(), write_root=None):
    if cid:prompt+=production_strategy.instructions(cid)+theme_production.instructions(cid)
    # Separate scratch/output roots even for simultaneous A/B reviewers.
    work = os.path.join(WORK, cid or '_discovery', kind + '-' + tag)
    os.makedirs(work, exist_ok=True)
    stamp = time.strftime('%m%d-%H%M%S')
    log_path = (cdir(cid, 'logs') if cid else os.path.join(DATA, 'logs')) + f'/{kind}-{tag}-{stamp}.log'
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    prompt_path = log_path[:-4] + '.prompt.md'
    with open(prompt_path, 'w', encoding='utf-8') as f:
        f.write(prompt)
    cmd = [CODEX, 'exec', '-m', MODEL, '-c', f'model_reasoning_effort="{EFFORT}"', '--skip-git-repo-check',
           '-s', 'workspace-write', '--add-dir', cdir(cid) if cid else DATA]
    if write_root or kind in ('build', 'review', 'judge', 'discover'):
        cmd += ['--add-dir', write_root or ROOT]
    for d in extra_dirs:
        cmd += ['--add-dir', d]
    cmd += ['-C', work, '-']
    return start_proc(cid, kind, tag, cmd, work, log_path, CODEX_TIMEOUT, {'result': result_path}, stdin_path=prompt_path)


def running(kinds=None, include_waiting=True):
    return [m for m in [*(m for _,_,m in PROCS.values()), *(provider_retry.pending_meta() if include_waiting else [])] if kinds is None or m['kind'] in kinds]


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
        try:
            if meta.get('concept') and not theme_production.current(meta['concept'],meta):
                provider_retry.cancel(meta['concept'])
                theme_production.ensure(store.concept(meta['concept']))
                store.log(meta['concept'],'이전 테마 정책의 결과는 기록으로 보존 · 새 전용 세트 기준 적용')
                continue
            if not meta.get('superseded'):
                if provider_retry.capture(sys.modules[__name__], jid, meta, code): continue
                provider_retry.finished(meta)
                HANDLERS[meta['kind']](meta, code, result)
        except Exception as error:
            store.log(meta['concept'], f'처리 오류 — {meta["kind"]}: {traceback.format_exc()[-600:]}')
            if meta['concept']:
                store.update_concept(meta['concept'], stage='blocked', status='idle',
                                     note=f'{meta["kind"]} 결과 처리 오류 — 로그 확인 필요',
                                     reasons=[f'{type(error).__name__}: {error}'])
        finally:
            # Persist terminal status only after result handling. Other scoped
            # runners use running rows as reservations; a premature done row
            # lets a successor replace hash-bound inputs during collection.
            store.update_job(jid, status='done' if code == 0 else f'exit {code}', ended=store.now(),
                             result=result if result is not None else {'exit': code})


def recover():
    """Recover dead workers; independent runners retain ownership of live jobs."""
    jobs = store.jobs("status='running'")
    live = {job["id"] for job in jobs if activity.process_alive(job)}
    surviving = {job["concept"] for job in jobs if job["id"] in live}
    for job in jobs:
        if job["id"] in live:
            continue
        store.update_job(job['id'], status='lost', ended=store.now())
        if job['concept']:
            c = store.concept(job['concept'])
            if c and c['id'] not in surviving and (c['stage'] in store.ACTIVE or c['stage'] == 'art'):
                store.update_concept(c['id'], status='queued')
    # A separate runner may survive an HTTP/daemon service restart.
    for c in store.concepts("status='running'"):
        if c["id"] in surviving:
            continue
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


def release_waiting(ids=None):
    for c in store.concepts("stage='waiting'"):
        if ids is not None and c['id'] not in ids: continue
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
        snapshot = space_decisions.result_view(DATA, c, example_images(cid))
        if not snapshot['images']:
            reject(cid, ['사용자가 확인할 결과 이미지가 없다'], '결과 확인 준비')
            return
        write_json(cdir(cid, 'result-review.json'), snapshot)
        store.update_concept(cid, stage='result-review', status='idle', reasons=[], note='결과를 확인해 주세요')
        store.log(cid, '조수 시험 통과 → 사용자 결과 Allow / Deny 대기')


def on_bake(meta, code, result):
    pass   # 굽기는 스레드에서 끝까지 처리한다(bake_thread).


HANDLERS = {'theme-concept-review': theme_production.theme_concepts.on_result, 'theme-plan': theme_production.on_result, 'theme-review': theme_production.on_result, 'seed-discover': keyword_seeds.on_result, 'plan': lambda *a: on_plan(*a), 'plan-review': lambda *a: on_plan_review(*a), 'survey': lambda *a: on_survey(*a), 'material-review': lambda *a: on_material_review(*a), 'art': lambda *a: on_art(*a), 'art-native': lambda *a: on_art_native(*a), 'art-demo': lambda *a: on_art_demo(*a), 'art-layout-review': lambda *a: on_art_layout_review(*a), 'art-context-review': lambda *a: on_art_context_review(*a), 'discover': on_discover, 'build': on_build, 'review': on_review, 'probe': on_probe, 'judge': on_judge, 'bake': on_bake}


def probe_scores(cid, attempt):
    base = [read_json(os.path.join(d, 'score', 'score.json')) for d in sorted(glob.glob(cdir(cid, 'probe', 'base-*')))]
    after = [read_json(os.path.join(d, 'score', 'score.json')) for d in sorted(glob.glob(cdir(cid, 'probe', f'a{attempt}-*')))]
    return [s for s in base if s], [s for s in after if s]


# ───────────────────────── 작업 시작 ─────────────────────────

def concept_context(c):
    result={k: c.get(k) for k in ('id', 'title', 'aliases', 'why', 'source', 'attempt', 'parent')}
    result['themeProduction']=theme_production.context(c['id'])
    return result


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
    blocked = attempt > int(store.setting('max_art_revisions') if theme_production.policy(cid) else store.setting('max_attempts'))
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
        if read_json(previous, {}).get('candidates'):
            os.replace(previous, cdir(cid, 'art-result.previous.json'))
        else:
            os.remove(previous)
    import reference_source
    reference_source.ensure(DATA, cid)
    art_feedback.ensure_layout_feedback(DATA, cid)
    feedback = read_json(cdir(cid, 'art-feedback.json'), {}) or {}
    prior_layout = read_json(cdir(cid, 'art-layout-review.json'), {}) or {}
    template = 'art-layout-repair.md' if prior_layout.get('verdict') == 'FAIL' or feedback.get('policy') else 'art.md'
    prompt = fill(prompt_template(template), ROOT=wt, CDIR=cdir(cid), CONCEPT=concept_context(c),
                  ART_FEEDBACK=feedback, ART_LIMITS=art_feedback.limits(DATA, cid),
                  ART_LAYOUT_MODULE=os.path.join(HERE, 'art_layout.py'),
                  ART_MODEL_OVERRIDE=json.loads(store.setting('art_model_overrides') or '{}').get(cid))
    # Art worktrees can predate a repaired review contract. Give preparation a
    # frozen current protocol without mutating any already-running native job.
    protocol = Path(ROOT) / 'src/harnesses/interior-props/review.md'
    protocol_copy = Path(wt) / 'art-output/protocols' / gates.digest(protocol) / 'native-review.md'
    protocol_copy.parent.mkdir(parents=True, exist_ok=True)
    if not protocol_copy.exists(): shutil.copyfile(protocol, protocol_copy)
    prompt += ('\n소품 하네스를 준비하는 경우 현재 감독의 검수 프로토콜을 읽고 실제 native 검수 경로에 반영한다: '
               + str(protocol_copy) + '\n칸별 topMin/비율보다 가구 예시 3행을 우선하는 옛 검수 문구를 유지하지 않는다. '
               '커스텀 장면 검수와 역할 경계는 보존한다. 실제 검수 템플릿/코드의 변경을 새 layout.sources에 결합하고 '
               '독립 검수를 받는다. 기존 PNG나 판정을 변경하지 않는다.\n')
    prompt += art_choices.example_feedback_prompt(c)
    acceptance = art_acceptance.contract(cdir(cid))
    if acceptance:
        prompt += '\n고정 합격 계약이 이전 반려 의견보다 우선합니다. 필수 결함을 수정하고 권고만으로 재설계 범위를 늘리지 마세요. 계약 파일을 변경하지 마세요. 준비 결과 형식은 그대로 유지합니다.\n' + json.dumps(acceptance, ensure_ascii=False)
    start_codex(cid, 'art', 'prepare', prompt, cdir(cid, 'art-result.json'), write_root=wt)
    store.update_concept(cid, status='running', note='형태·시점 명세와 제작 주문서 준비 중')


def on_art(meta, code, result):
    cid = meta['concept']
    wt = os.path.realpath(os.path.join(DATA, 'art-worktrees', cid))
    result = result if isinstance(result, dict) else {}
    if code == 0 and result.get('preparedExecution') and not result.get('execution') and meta.get('tag') != 'collect':
        # Prepared independent native batches can run while other specialized
        # adapters are being implemented. Full requirement coverage still gates assembly.
        write_json(cdir(cid,'art-pending-materials.json'),{
            'reasons':result.get('reasons',[]),'implementationRequired':result.get('implementationRequired'),
            'themeCoverage':result.get('themeCoverage',{}),'at':store.now()})
        result=dict(result,execution=result['preparedExecution'])
    if code == 0 and result.get('execution') and meta.get('tag') != 'collect':
        try:
            request = dict(result['execution'])
            # Models are chosen by the user/supervisor, never by a preparation worker.
            request.pop('modelOverride', None)
            request.pop('repairLimits', None)
            if request.get('resumeMode') not in ('collect-existing', 'review'): request.pop('resumeMode', None)
            if request.get('resumeMode') == 'review': art_execution.require_review_queue(wt, request)
            if request.get('resumeMode') == 'collect-existing' and art_execution.native_errors(wt, request):
                raise ValueError('기존 후보 재사용은 완료된 native 검사 근거가 필요합니다.')
            art_layout.freeze_generated_previews(wt, request)
            feedback = read_json(cdir(cid, 'art-feedback.json'), {}) or {}
            if (store.concept(cid).get('art_revision') or 0) > 0:
                if request.get('feedbackSha256') != gates.digest(cdir(cid, 'art-feedback.json')):
                    raise ValueError('재생성 준비에 현재 검수 피드백 해시가 필요합니다.')
                request['repairLimits'] = art_feedback.limits(DATA, cid)
            override = json.loads(store.setting('art_model_overrides') or '{}').get(cid)
            if override:
                request['modelOverride'] = override
            art_acceptance.bind(wt, cdir(cid), request)
            if request.get('resumeMode') != 'collect-existing': art_execution.prepare(wt, request)
            request_path = cdir(cid, 'art-execution.json')
            write_json(request_path, request)
            layout = art_layout.build_input(wt, request)
            art_repair.require_preparation(wt, Path(cdir(cid)), layout['layout'], feedback)
            art_demo.validate_preserved_sources(DATA, cid, layout, result)
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
            result = art_batches.collect(DATA, cid, result)
            components = art_choices.prepare(DATA, cid)
            missing = art_batches.queue_missing(DATA, cid, result, components)
            if missing:
                stopped = missing['repeated']
                store.update_concept(cid, stage='blocked' if stopped else 'art', status='idle' if stopped else 'queued',
                    note='누락 재료 제작이 진전되지 않음 · 기존 칩 보존' if stopped else '기존 칩 보존 · 누락 재료 추가 제작 대기',
                    reasons=['제작 필요: ' + ', '.join(missing['missing'])])
                store.log(cid, '전용 세트 누적 제작: 확보 ' + str(len(missing['covered'])) + ' / 미제작 ' + str(len(missing['missing'])))
                return
        except (OSError, ValueError, KeyError, TypeError, StopIteration) as error:
            store.log(cid, '선택 예시 준비 필요: ' + str(error))
            store.update_concept(cid, stage='blocked', status='idle', note='조립 예시 준비 오류', reasons=[str(error)])
            return
        advance_art_review(cid)
    else:
        store.update_concept(cid, stage='blocked', status='idle', note='칩 제작 미완료 — 하네스 결과·그림 근거 없음', reasons=(result or {}).get('reasons') or ['art-result.json에 실제 후보와 하네스 검사 근거가 필요함'])
    store.log(cid, '칩 제작 결과 — ' + (store.concept(cid)['note'] if valid else '미완료'))



def advance_art_review(cid):
    if art_demo.required(DATA, cid):
        store.update_concept(cid, stage='art-demo', status='queued', note='실제 타일로 공간 전체 데모 조립 대기')
        return
    state = art_choices.view(DATA, cid)
    if art_repair.finish_calibration(DATA, cid, state, write_json, art_feedback.limits): return
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


def start_art_demo(c):
    cid = c['id']
    try:
        inputs = art_demo.prepare(DATA, cid)
        output = cdir(cid, 'art-demo-result.json')
        if os.path.exists(output): os.remove(output)
        prompt = fill(prompt_template('art-demo.md'), INPUT=cdir(cid, 'art-demo-input.json'), OUTPUT=output, ROOT=inputs['root'], RENDERER=os.path.join(HERE, 'art_demo.py'))
        prompt += art_choices.example_feedback_prompt(c)
        error = read_json(cdir(cid, 'art-demo-error.json'), {})
        if error: prompt += '\n지난 데모 조립의 기술 오류를 고친다: ' + json.dumps(error, ensure_ascii=False)
        start_codex(cid, 'art-demo', 'assemble', prompt, output, write_root=inputs['root'])
        store.update_concept(cid, status='running', reasons=[], note='실제 타일로 공간 전체 데모 조립 중')
    except (ValueError, OSError, KeyError, TypeError) as error:
        if theme_production.policy(cid):
            # Missing theme material returns to production with the actual failure;
            # never relax coverage or reset the user's repair limit.
            count=c.get('art_revision',0)+1
            exhausted=count>art_feedback.limits(DATA,cid)['maxRevisions']
            write_json(cdir(cid,'theme-material-feedback.json'),dict(error=str(error),revision=count))
            store.update_concept(cid,stage='blocked' if exhausted else 'art',status='idle' if exhausted else 'queued',
                                 art_revision=c.get('art_revision',0) if exhausted else count,
                                 note='전용 재료 수정 한도 도달' if exhausted else '전용 세트 누락 재료 보완 · 조립 전 제작으로 복귀',reasons=[str(error)])
        else:
            store.update_concept(cid, stage='blocked', status='idle', note='데모 입력 준비 오류', reasons=[str(error)])


def on_art_demo(meta, code, result):
    cid = meta['concept']
    if store.concept(cid)['stage'] != 'art-demo': return
    try:
        if code != 0: raise ValueError(f'데모 조립 작업 종료 {code}')
        art_demo.accept(DATA, cid, result)
    except (ValueError, OSError, KeyError, TypeError) as error:
        generation = read_json(cdir(cid, 'art-demo-input.json'), {}).get('generation')
        attempts = read_json(cdir(cid, 'art-demo-errors.json'), {}) or {}
        count = attempts.get(generation, 0) + 1
        attempts[generation] = count
        write_json(cdir(cid, 'art-demo-errors.json'), attempts)
        write_json(cdir(cid, 'art-demo-error.json'), {'error': str(error), 'attempt': count, 'result': result})
        store.update_concept(cid, stage='art-demo' if count < 3 else 'blocked', status='queued' if count < 3 else 'idle',
                             note='데모 조립 오류 수정 대기' if count < 3 else '데모 조립 실행 오류', reasons=[str(error)])
        return
    store.log(cid, '실제 타일 공간 전체 데모 렌더 완료 → 독립 검수')
    advance_art_review(cid)


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
    prompt += art_acceptance.instructions(request.get('acceptance'))
    prompt += art_choices.example_feedback_prompt(c)
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
        if meta.get('adjudication'):
            for candidates in report['groups'].values():
                for candidate in candidates.values():
                    art_acceptance.validate(candidate, request.get('acceptance'), art_layout.SCENE_CHECKS, True)
    except (ValueError, OSError, KeyError, TypeError) as error:
        c = store.concept(cid)
        retry = (c.get('art_review_attempt') or 0) < 2
        store.update_concept(cid, stage='art-context-review' if retry else 'blocked', status='queued' if retry else 'idle',
                             note='조립 검수 결과 재확인 대기' if retry else '조립 검수 실행 오류 — 2회 실패', reasons=[str(error)])
        store.log(cid, str(error))
        return
    if request.get('acceptance') and not meta.get('adjudication') and any(
            r['verdict'] == 'FAIL' for candidates in report['groups'].values() for r in candidates.values()):
        first = cdir(cid, 'art-context-first-verdict.json')
        write_json(first, report)
        write_json(cdir(cid, 'art-context-history', request['manifestSha256'] + f'-first-{time.time_ns()}.json'), report)
        output = cdir(cid, 'art-context-adjudication.json')
        if os.path.exists(output): os.remove(output)
        dispute = {'firstVerdict': report, 'approvedLayoutVerdict': read_json(cdir(cid, 'art-layout-review.json'))}
        prompt = fill(prompt_template('art-context-review.md'), CDIR=cdir(cid), INPUT=cdir(cid, 'art-context-input.json'),
                      OUTPUT=output, ROOT=request['root']) + art_acceptance.instructions(request['acceptance'], dispute)
        jid = start_codex(cid, 'art-context-review', 'adjudicate', prompt, output)
        PROCS[jid][2].update(context_input=request, adjudication=True)
        store.update_concept(cid, note='최종 반려 독립 재판정 — 고정 합격 조건 대조 중')
        return
    art_feedback.write(cdir(cid, 'art-context-history', request['manifestSha256'] + '.json'), report)
    write_json(cdir(cid, 'art-context-result.json'), report)
    current = read_json(cdir(cid, 'art-context-review.json'), {}) or {}
    merged = current.setdefault('groups', {})
    for gid, candidates in report['groups'].items(): merged.setdefault(gid, {}).update(candidates)
    current['version'] = 1
    write_json(cdir(cid, 'art-context-review.json'), current)
    if art_demo.required(DATA, cid):
        advance_art_review(cid)
        return
    state = art_choices.view(DATA, cid)
    if art_repair.finish_calibration(DATA, cid, state, write_json, art_feedback.limits): return
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
        if art_acceptance.contract(cdir(cid)) != layout.get('acceptance'):
            raise ValueError('현재 고정 합격 계약으로 실행 요청을 다시 준비해야 합니다.')
    except (OSError, ValueError, TypeError, KeyError) as error:
        store.update_concept(cid, stage='blocked', status='idle', note='제작 전 도면 입력 변경/오류', reasons=[str(error)])
        return
    write_json(cdir(cid, 'art-layout-input.json'), layout)
    output = cdir(cid, 'art-layout-review.json')
    if os.path.exists(output): os.remove(output)
    prompt = fill(prompt_template('art-layout-review.md'), INPUT=cdir(cid, 'art-layout-input.json'), OUTPUT=output,
                  FEEDBACK=read_json(cdir(cid, 'art-feedback.json'), {}), ROOT=wt)
    prior = art_acceptance.prior_layout_pass(cdir(cid), layout)
    prompt += art_acceptance.instructions(layout.get('acceptance'))
    if prior: prompt += '\n동일 도면의 기존 합격 근거: ' + json.dumps(prior, ensure_ascii=False)
    start_codex(cid, 'art-layout-review', 'layout', prompt, output)
    store.update_concept(cid, status='running', note='제작 전 도면의 비례·여백·구성 검수 중')


def repair_art_layout_response(meta, result, layout, error):
    """Ask the reviewer to complete its response, retaining every existing verdict/evidence."""
    cid = meta['concept']
    attempt = int(meta.get('format_attempt', 0))
    original = meta.get('format_original', result)
    stamp = str(time.time_ns())
    write_json(cdir(cid, 'art-layout-response-errors', stamp + '.json'),
               {'at': store.now(), 'attempt': attempt, 'error': str(error), 'response': result,
                'original': original, 'fingerprint': layout['fingerprint']})
    if attempt >= 2:
        store.update_concept(cid, stage='blocked', status='idle',
                             note='검수 응답 보완 2회 실패 — 확인 필요', reasons=[str(error)])
        store.log(cid, '검수 응답 보완 중단 — 원본과 오류를 보존했습니다: ' + str(error))
        return
    output = cdir(cid, 'art-layout-response-errors', stamp + '-corrected.json')
    prompt = fill(prompt_template('art-layout-review.md'), INPUT=cdir(cid, 'art-layout-input.json'),
                  OUTPUT=output, ROOT=layout['root'], FEEDBACK=read_json(cdir(cid, 'art-feedback.json'), {}))
    prompt += art_acceptance.instructions(layout.get('acceptance'))
    prompt += ('\n## 이전 검수 응답 보완\n원본의 fingerprint/gateVersion/verdict/checks/reasons와 이미 작성한 '
               '수정 대상·문제·변경·보존 내용은 그대로 유지한다. 빠진 수정 지시 내용은 입력을 다시 확인하여 채운다. '
               'type은 같은 값의 category로 바꿀 수 있다. 판정을 뒤집거나 근거를 줄이지 않는다. '
               '그림·도면·계약 파일은 수정하지 않고 위 OUTPUT에 완전한 JSON 하나만 쓴다.\n'
               + '오류: ' + str(error) + '\n원본: ' + json.dumps(original, ensure_ascii=False))
    jid = start_codex(cid, 'art-layout-review', 'format-' + str(attempt + 1), prompt, output)
    PROCS[jid][2].update(format_attempt=attempt + 1, format_original=original,
                         adjudication=bool(meta.get('adjudication')))
    store.update_concept(cid, stage='art-layout-review', status='running',
                         note=f'검수 응답 보완 중 ({attempt + 1}/2) — 그림 수정 횟수 유지', reasons=[str(error)])
    store.log(cid, f'검수 응답 보완 {attempt + 1}/2 시작: {error}')


def on_art_layout_review(meta, code, result):
    cid = meta['concept']
    try:
        if code != 0: raise ValueError('도면 검수 실행 실패')
        request = read_json(cdir(cid, 'art-execution.json'))
        wt = os.path.join(DATA, 'art-worktrees', cid)
        layout = art_layout.build_input(wt, request)
        raw = json.loads(json.dumps(result))
        try:
            if meta.get('format_attempt'):
                art_layout.preserve_verdict(meta.get('format_original'), result)
            art_layout.validate_verdict(result, layout['fingerprint'], art_layout.LAYOUT_CHECKS)
        except art_layout.ReviewFormatError as error:
            repair_art_layout_response(meta, result, layout, error)
            return
        if raw != result:
            write_json(cdir(cid, 'art-layout-response-errors', str(time.time_ns()) + '-normalized.json'),
                       {'original': raw, 'normalized': result, 'fingerprint': layout['fingerprint']})
            store.log(cid, '검수 응답 표기 정규화 — 판정·근거·수정 지시 보존')
        art_acceptance.validate(result, layout.get('acceptance'), art_layout.LAYOUT_CHECKS, meta.get('adjudication', False))
        prior = art_acceptance.prior_layout_pass(cdir(cid), layout)
        if prior and result['verdict'] == 'FAIL' and not meta.get('adjudication'):
            first = cdir(cid, 'art-layout-first-verdict.json')
            write_json(first, result)
            write_json(cdir(cid, 'art-layout-history', layout['fingerprint'] + f'-first-{time.time_ns()}.json'), result)
            output = cdir(cid, 'art-layout-adjudication.json')
            if os.path.exists(output): os.remove(output)
            prompt = fill(prompt_template('art-layout-review.md'), INPUT=cdir(cid, 'art-layout-input.json'),
                          OUTPUT=output, FEEDBACK=read_json(cdir(cid, 'art-feedback.json'), {}), ROOT=wt)
            prompt += art_acceptance.instructions(layout['acceptance'], {'priorPass': prior, 'newFailure': result})
            jid = start_codex(cid, 'art-layout-review', 'adjudicate', prompt, output)
            PROCS[jid][2]['adjudication'] = True
            store.update_concept(cid, note='동일 도면 PASS 번복 — 독립 재판정 중')
            return
        result['semanticFingerprint'] = art_acceptance.semantic_fingerprint(layout['layout'])
        write_json(cdir(cid, 'art-layout-review.json'), result)
        write_json(cdir(cid, 'art-layout-history', layout['fingerprint'] + f'-{time.time_ns()}.json'), result)
        if result['verdict'] == 'FAIL':
            history = read_json(cdir(cid, 'art-layout-rejections.json'), [])
            history.append(result)
            write_json(cdir(cid, 'art-layout-rejections.json'), history)
            art_feedback.ensure_layout_feedback(DATA, cid)
            # Bound preparation repairs separately; never reset a drawing revision.
            revision = store.concept(cid).get('art_revision', 0)
            count = sum(r.get('revision') == revision for r in history[:-1]) + 1
            history[-1]['revision'] = revision
            write_json(cdir(cid, 'art-layout-rejections.json'), history)
            limit = art_feedback.limits(DATA, cid)['maxRevisions']
            store.update_concept(cid, stage='art' if count < limit else 'blocked', status='queued' if count < limit else 'idle',
                note='도면 반려 — 배치 명세부터 수정' if count < limit else f'도면 수정 {limit}회 소진 — 운영 복구 필요', reasons=result.get('reasons', []))
            store.log(cid, '도면 반려 → 배치 명세 수정 대기' if count < limit else '도면 수정 반복 한도 도달 — 운영 복구 필요')
            return
        request['layoutApproval'] = cdir(cid, 'art-layout-review.json')
        write_json(cdir(cid, 'art-execution.json'), request)
        art_layout.require_approval(wt, request)
        art_repair.require_preparation(wt, Path(cdir(cid)), layout['layout'], read_json(cdir(cid, 'art-feedback.json'), {}))
        if request.get('resumeMode')=='collect-existing':
            if art_execution.native_errors(wt,request): raise ValueError('완료되지 않은 native 결과는 수집 재개 불가')
            on_art_native({'concept':cid},0,{'exitCode':0})
            return
        technical = request.get('resumeMode')=='technical'
        review_resume = request.get('resumeMode')=='review'
        if review_resume: art_execution.require_review_queue(wt, request)
        if not technical: art_execution.prepare(wt, request)
        native_result = cdir(cid, 'art-execution-result.json')
        if os.path.exists(native_result): os.remove(native_result)
        if technical or review_resume: write_json(Path(native_result).with_suffix('.approved.json'), art_layout.require_approval(wt, request))
        start_proc(cid, 'art-native', 'drawing', [sys.executable, os.path.join(HERE, 'art_execution.py'),
                   wt, cdir(cid, 'art-execution.json'), native_result] + (['--resume-technical'] if technical else ['--resume-review'] if review_resume else []), ROOT, cdir(cid, 'logs', 'art-native.log'), CODEX_TIMEOUT * 2,
                   {'result': native_result})
        store.update_concept(cid, stage='art', status='running', reasons=[], note='도면 검수 통과 — 후보 제작·독립 검수')
    except (OSError, ValueError, TypeError, KeyError) as error:
        store.update_concept(cid, stage='blocked', status='idle', note='제작 전 도면 검수 오류', reasons=[str(error)])


def on_art_native(meta, code, result):
    cid = meta['concept']
    wt = os.path.join(DATA, 'art-worktrees', cid)
    if code != 0 or not isinstance(result, dict) or result.get('exitCode') != 0:
        store.update_concept(cid, stage='blocked', status='idle', note='그림 하네스 실행 실패',
                             reasons=(result.get('nativeErrors') if isinstance(result, dict) else None) or [f'실행 종료 {code}; logs/art-native.log 확인'])
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
    if not remove:
        snapshot = space_decisions.result_view(DATA, c, example_images(c['id']))
        allowed = next((e for e in reversed(c.get('feedback', [])) if e.get('kind') == 'result-decision'), {})
        if not snapshot['images'] or allowed.get('decision') != 'allow' or allowed.get('fingerprint') != snapshot['fingerprint']:
            write_json(cdir(c['id'], 'result-review.json'), snapshot)
            store.update_concept(c['id'], stage='result-review', status='idle', note='결과 확인 필요')
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
    theme_production.tick(sys.modules[__name__],[c['id'] for c in store.concepts()],int(store.setting('max_active')))
    for c in store.concepts():theme_production.ensure(c)
    provider_retry.tick(sys.modules[__name__])
    max_codex = int(store.setting('max_codex'))
    keyword_seeds.tick(sys.modules[__name__])
    # 하루 상한은 없다(2026-10-04 사용자) — 동시 실행 수만 지킨다.
    codex_free = lambda need=1: len(running(['theme-plan', 'theme-review', 'theme-concept-review', 'seed-discover', 'discover', 'plan', 'plan-review', 'survey', 'material-review', 'art', 'art-layout-review', 'art-context-review', 'art-demo', 'build', 'review', 'judge'], include_waiting=False)) + need <= max_codex

    release_waiting()
    active = store.concepts("stage IN ('plan','plan-review','survey','material-review','art-layout-review','art-context-review','art-demo','build','review','probe','bake','unbake')")
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
        if finish_priority.reason(c) or provider_retry.pending(c['id']): continue
        if len(running(['art', 'art-native'], include_waiting=False)) >= int(store.setting('max_art')) or not codex_free():
            break
        start_art(c)

    # Revalidation can queue many concepts at once; admit at most max_active, retaining running work.
    publishing = [c for c in active if c['stage'] in ('bake', 'unbake')]
    candidates = sorted((c for c in active if c['stage'] not in ('bake', 'unbake')),
                        key=lambda c: (c['status'] != 'running',c['id'] not in finish_priority.preferred(), -(c['priority'] or 0)))
    for c in publishing + candidates[:int(store.setting('max_active'))]:
        if finish_priority.reason(c) or provider_retry.pending(c['id']): continue
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
        elif c['stage'] == 'art-demo' and codex_free():
            start_art_demo(c)
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
    if kind == 'theme-concept-decision':
        try:return theme_production.theme_concepts.action(body)
        except (KeyError,ValueError,OSError) as error:return {'ok':False,'error':str(error)}
    if kind in ('start-seed', 'pause-seed', 'resume-seed'):
        try:
            return keyword_seeds.action(body)
        except (ValueError, TypeError) as error:
            return {'ok': False, 'error': str(error)}
    c = store.concept(cid) if cid else None
    if not c:
        return {'ok': False, 'error': '개념이 없다'}
    if kind in ('decide-example', 'decide-result'):
        try:
            if kind == 'decide-example':
                return {'ok': True, 'choices': space_decisions.decide_example(DATA, cid, body)}
            return space_decisions.decide_result(DATA, cid, body, example_images(cid))
        except (ValueError, KeyError, OSError, TypeError) as error:
            return {'ok': False, 'error': str(error)}
    if kind == 'evaluate-art':
        try:
            return {'ok': True, 'choices': art_choices.evaluate(DATA, cid, body)}
        except (ValueError, KeyError, OSError, TypeError) as error:
            return {'ok': False, 'error': str(error)}
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
GROUP = {'result-review': 'pick', 'plan': 'work', 'plan-review': 'work', 'survey': 'work', 'material-review': 'work', 'art-review': 'pick', 'art-layout-review': 'work', 'art-context-review': 'work', 'art-demo': 'work', 'done': 'done', 'discovered': 'wait', 'waiting': 'wait', 'art': 'wait', 'blocked': 'stop', 'discarded': 'stop'}


def first_sentence(text, limit=90):
    text = re.sub(r'\s+', ' ', str(text or '')).strip()
    m = re.match(r'(.+?[.。!?]|.+?다\.)(\s|$)', text)
    text = m.group(1) if m else text
    return text if len(text) <= limit else text[:limit - 1] + '…'


def plain_status(c):
    if c.get('status') == 'retry-wait': return c.get('note') or '공급자 오류 · 자동 재시도 대기'
    stage, n = c['stage'], c['attempt'] or 1
    if stage == 'theme-wait':
        return '전용 세트 공통 기획·검수 중'
    if stage == 'result-review':
        return '완성된 결과 확인 · Allow / Deny'
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
    if stage == 'art-demo':
        return '실제 타일 공간 데모 조립 중' if c['status'] == 'running' else '공간 데모 조립 대기'
    if stage == 'art-context-review':
        return '조립 예시 독립 검수 중' if c['status'] == 'running' else '조립 예시 검수 대기'
    if stage == 'art-review':
        try:
            choices = art_choices.view(DATA, c['id'])
        except (ValueError, OSError, KeyError, TypeError):
            return '선택 자료 확인 필요'
        if choices.get('blocked'): return '후보 수정 필요 · 현재 선택 불가'
        if choices.get('installation'): return '선택 구역 완성 · 공용 등록·맵 저장 완료'
        if choices.get('installationProgress'): return '공용 등록·맵 저장 완료 · 플레이 확인 남음'
        if choices.get('demo') and choices['complete']: return '공간 데모 Allow 저장 완료'
        return '공용 등록 연결 필요 · 실행 예약 없음' if choices['complete'] else f'예시 확인 필요 · {choices["selectedCount"]}/{choices["total"]} 채택' if choices['total'] else '선택 예시 준비 필요'
    if stage == 'art':
        if c['status'] == 'running':
            active = store.jobs("concept=? AND status='running'", (c['id'],))
            if any(j['kind'] == 'art-native' and activity.process_alive(j) for j in active):
                return '실제 칩 제작·검수 중'
            return '그림 주문서·제작 입력 준비 중'
        return '도면 반려 · 배치 명세 수정 차례 대기' if c.get('note', '').startswith('도면 반려') else '그림 주문서·제작 입력 준비 차례 대기'
    if stage == 'build':
        return f'고치는 중 ({n}번째)' if c['reasons'] or n > 1 else '만드는 중'
    return {'review': '검수 중', 'probe': '조수에게 시켜 보는 중', 'bake': '에디터에 넣는 중', 'unbake': '에디터에서 빼는 중',
            'done': '완성 · 에디터에 들어감', 'blocked': '운영 점검 필요 · 사용자 입력 없음', 'discarded': '폐기'}.get(stage, stage)


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


def demo_images(cid):
    manifest = read_json(cdir(cid, 'art-choices.json'), {}) or {}
    if manifest.get('demoVersion') != 1: return []
    root = os.path.join(DATA, 'art-worktrees', cid)
    return [im for g in manifest.get('groups', []) for c in g['candidates']
            for im in verified_images(root, c['images'], '실제 타일 공간 데모 · 검수 상태 확인', '공간 데모')]


def candidate_images(cid):
    result = read_json(cdir(cid, 'art-result.json'), {}) or {}
    if not isinstance(result, dict) or not isinstance(result.get('candidates'), list):
        return []
    root = os.path.join(DATA, 'art-worktrees', cid)
    return [image for candidate in result['candidates'] if isinstance(candidate, dict)
            for image in verified_images(root, candidate.get('images'), '칩 후보 · 선택 전', '칩 후보')]


def before_build(c):
    return c['stage'] in ('plan', 'plan-review', 'survey', 'material-review', 'art', 'art-review', 'art-layout-review', 'art-context-review', 'art-demo') or (
        c['stage'] == 'blocked' and not gates.material_report(cdir(c['id']))['ok'])


def gallery_list():
    items = []
    for c in store.concepts():
        card = read_json(cdir(c['id'], 'card.json'), {}) or {}
        if before_build(c):
            imgs = demo_images(c['id']) or candidate_images(c['id']) or planning_images(c['id'])
        else:
            imgs = example_images(c['id'])
        status = plain_status(c)
        group = 'stop' if status.startswith('후보 수정 필요') else 'stop' if c['stage'] == 'art-review' and status.startswith('공용 등록 연결 필요') else GROUP.get(c['stage'], 'work')
        needs_user, choices = False, {}
        if c['stage'] in ('art-review', 'result-review'):
            try:
                if c['stage'] == 'art-review':
                    choices = art_choices.view(DATA, c['id'])
                    needs_user = not choices['complete'] and any(
                        any(v['eligible'] and v.get('decision') != 'deny' for v in g['candidates'])
                        and not any(v['selected'] for v in g['candidates']) for g in choices['groups'])
                else:
                    needs_user = space_decisions.result_view(DATA, c, imgs)['canDecide']
            except (ValueError, KeyError, OSError, TypeError):
                status = '그림 자료 운영 점검 · 사용자 입력 없음'
        operator = c['stage'] == 'blocked' or (c['stage'] in ('art-review', 'result-review') and not choices.get('installation'))
        owner = 'user' if needs_user else 'operator' if operator else 'harness'
        items.append({'needsUser': needs_user, 'owner': owner, 'id': c['id'], 'title': c['title'], 'stage': c['stage'], 'group': group,
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
            'resultReview': space_decisions.result_view(DATA, c, imgs) if c['stage'] in ('result-review', 'done') else None,
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
        policy = feedback.get('policy', {})
        if policy:
            labels = {'asset': '칩 그림 수정', 'assembly': '배치 수정', 'spec': '형태·시점 명세 재설계', 'integration': '합격 표본으로 공간 재조립'}
            L += [f'**수정 경로:** {labels.get(policy.get("route"), "재검토")} · ' + ('작은 시점 표본' if policy.get('phase') == 'calibration' else '공간 조립'), '', policy.get('reason', ''), '']
            if policy.get('repeatedChecks'): L += ['반복 불합격 항목: ' + ', '.join(policy['repeatedChecks']), '']
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
        if url.path in ('/art-choice.js', '/keyword-seeds.js'):
            with open(os.path.join(HERE, 'web', url.path[1:]), 'rb') as f:
                return self.send(200, f.read(), 'text/javascript; charset=utf-8')
        if url.path == '/markdown.js':
            try:
                return self.send(200, markdown_module(), 'text/javascript; charset=utf-8')
            except subprocess.SubprocessError:
                return self.send(500, {'error': '문서 표시기를 불러오지 못했습니다.'})
        q = parse_qs(url.query)
        if url.path == '/api/activity':
            return self.send(200, activity.snapshot(q.get('id', [None])[0]))
        if url.path == '/api/seeds':
            return self.send(200, keyword_seeds.snapshot())
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
