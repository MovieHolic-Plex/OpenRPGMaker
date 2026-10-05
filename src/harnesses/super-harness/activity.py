"""Read-only progress from persisted jobs, process identity and runner heartbeats.

Never return worker prompts, reasoning, log contents or shell commands.
"""
import json
import os
import re
import time
from pathlib import Path

import store
import art_feedback
import art_choices
import provider_retry

STEPS = ["공간 기획", "기획 검수", "재료 조사·검수", "칩 제작·검수", "공간 조립", "시각 검수", "조수 시험", "공용 등록"]
STAGE = {
    "discovered": (0, "기획 차례 대기"), "plan": (0, "공간 기획·텍스트 도면 작성"),
    "plan-review": (1, "기획·도면 독립 검수"), "survey": (2, "사용 가능한 칩 조사"),
    "material-review": (2, "필수 재료 독립 검수"), "art": (3, "부족한 칩 제작"),
    "art-native": (3, "그림 제작·원본 검수"), "art-layout-review": (3, "제작 전 배치도 검수"),
    "art-demo": (4, "실제 타일 공간 데모 조립"),
    "art-context-review": (3, "조립 그림 독립 검수"), "art-review": (3, "후보 선택·등록 확인"),
    "build": (4, "공간 조립·예제 렌더"), "review": (5, "완성 그림 적대적 검수"),
    "probe": (6, "조수 배치 시험"), "judge": (6, "조수 시험 판정"),
    "result-review": (7, "결과 Allow / Deny 대기"),
    "bake": (7, "공용 등록"), "done": (8, "공용 등록 완료"),
    "blocked": (-1, "자동 진행 중단"), "waiting": (-1, "선행 재료 대기"),
    "discarded": (-1, "폐기"), "unbake": (7, "공용 등록 해제"),
}

def stamp(value):
    try:
        return time.mktime(time.strptime(value, "%Y-%m-%dT%H:%M:%S"))
    except (ValueError, TypeError, OverflowError):
        return None


def process_alive(job):
    """A reused PID is not the original worker: verify its stdout log inode on Linux."""
    pid = job.get("pid")
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        if Path("/proc").is_dir():
            return os.path.samefile(f"/proc/{pid}/fd/1", job["log"])
        return True
    except (OSError, TypeError, KeyError):
        return False


def job_view(job, now):
    started = stamp(job.get("started"))
    try:
        modified = os.path.getmtime(job["log"])
    except (OSError, TypeError):
        modified = None
    label = STAGE.get(job["kind"], (-1, "작업 처리"))[1]
    if job["kind"] == "art":
        label = {"prepare": "그림 주문서·제작 입력 준비", "collect": "후보 그림·검수 결과 정리"}.get(job["tag"], label)
    if job['kind'] == 'art-layout-review' and str(job.get('tag', '')).startswith('format-'):
        label = '검수 응답 형식 보완'
    model = None
    effort = None
    try:
        with open(job["log"], encoding="utf-8", errors="replace") as log:
            # Only trusted CLI header fields before the prompt; never worker reasoning.
            header = log.read(2048).split("\nuser\n", 1)[0]
        found = re.search(r"^model: ([\w.:-]+)$", header, re.M)
        model = found.group(1) if found else None
        found = re.search(r"^reasoning effort: (\w+)$", header, re.M)
        effort = found.group(1) if found else None
    except (OSError, TypeError):
        pass
    reviewer = job.get("tag") if job.get("tag") in ("A", "B") else None
    return dict(id=job["id"], concept=job["concept"], kind=job["kind"], label=label, reviewer=reviewer,
                alive=process_alive(job), model=model, effort=effort, elapsedSeconds=max(0, int(now-started)) if started else None,
                outputAgeSeconds=max(0, int(now-modified)) if modified else None)


def runners(now):
    """Only fresh heartbeats with explicit membership establish a dedicated queue."""
    result = []
    for path in Path(store.DATA, "monitoring").glob("*/latest.json"):
        try:
            value = json.loads(path.read_text())
            at = stamp(value.get("at"))
            if at is None or not 0 <= now-at < 20:
                continue
            members = {c["id"] for c in value.get("concepts", [])}
            if members:
                result.append(dict(value, members=members))
        except (OSError, ValueError, KeyError, TypeError):
            continue
    return sorted(result, key=lambda r: (bool(r.get("draining")), -r.get("parallelSpaces", 1)))


def batches(now):
    return [r["members"] for r in runners(now)]


def events(cid):
    output = []
    for event in store.recent_log(5, cid):
        text = event["text"]
        if text.startswith("시작 — "):
            parts = text[len("시작 — "):].split()
            label = STAGE.get(parts[0], (-1, "작업"))[1] if parts else "작업"
            text = label + " 시작" + (" · 검수자 " + parts[1] if len(parts) > 1 and parts[1] in ("A", "B") else "")
        output.append(dict(at=event["at"], text=text))
    for job in store.jobs("concept=? AND ended IS NOT NULL", (cid,), limit=5):
        label = STAGE.get(job["kind"], (-1, "작업"))[1]
        suffix = "실행 종료 · 합격 여부는 후속 판정에서 확인" if job["status"] == "done" else "실행 오류 · 복구 확인 필요"
        output.append(dict(at=job["ended"], text=label + " " + suffix))
    return sorted(output, key=lambda e: e["at"], reverse=True)[:6]


def snapshot(cid=None):
    now = time.time()
    concepts = store.concepts()
    names = {c["id"]: c["title"] for c in concepts}
    jobs = store.jobs("status='running'")
    views = [dict(job_view(j, now), title=names.get(j["concept"], "공간 탐색")) for j in jobs]
    managed = runners(now)
    paused = store.setting("paused") == "1"
    retries = provider_retry.rows()
    items = []
    for c in concepts:
        if cid and c["id"] != cid:
            continue
        own = [j for j in views if j["concept"] == c["id"]]
        live = [j for j in own if j["alive"]]
        runner = next((g for g in managed if c["id"] in g["members"]), None)
        group = runner["members"] if runner else None
        index, label = STAGE.get(c["stage"], (-1, c["stage"]))
        if live:
            label = live[0]['label']
        elif c['stage'] == 'art':
            label = '도면 반려에 따른 배치 명세 수정' if c.get('note', '').startswith('도면 반려') else '그림 주문서·제작 입력 준비'
        reason, wait_kind, waiting_for = "", None, []
        action = "지금 누를 버튼은 없습니다. 단계가 끝나면 다음 판정을 확인합니다."
        retry = [r for r in retries if r['concept']==c['id'] and r['status'] in ('pending','claiming')]
        if retry:
            nearest=min(retry, key=lambda r:r['due'])
            wait_kind='provider-backoff'
            label='자동 재시도 대기' if not live else label + ' · 일부 요청 재시도 대기'
            cause={'rate-limit':'모델 요청 한도(429)', 'context-overflow':'모델 문맥 초과', 'provider-unavailable':'모델 공급자 일시 오류'}.get(nearest['reason'], '일시 오류')
            reason=cause + ' · ' + (time.strftime('%H:%M:%S',time.localtime(nearest['due'])) + ' 자동 재시도' if nearest['due']>now else '재시도 시각 도달 · 작업 자리가 나면 자동 재개')
            action='누를 버튼은 없습니다. 기존 그림·선택·품질 수정 횟수를 유지하고 자동 재개합니다.'
        elif c["stage"] == "blocked":
            wait_kind = "operator-attention"
            reason = c.get("note") or "검수 또는 결과 처리에서 멈췄습니다."
            action = "운영 조치가 필요합니다. 기존 예시와 사용자 결정은 보존됩니다."
        elif c["stage"] == "art-review":
            try:
                choices = art_choices.view(store.DATA, c['id'])
                if choices.get('installationProgress') and not choices['installation']:
                    wait_kind = 'runtime-verification'
                    reason = '공용 칩셋 등록과 실제 프로젝트 저장·재로드 완료. 플레이어에서의 최종 동작 확인이 남았습니다.'
                    action = '사용자 추가 선택은 필요 없습니다. 저장된 맵의 보행·가림 확인 후 완료 처리합니다.'
                    label = '맵 저장 완료 · 플레이 확인 남음'
                elif choices['complete'] and not choices['installation']:
                    wait_kind = 'integration-missing'
                    reason = '선택은 끝났지만 공용 등록·조립을 잇는 실행 단계가 없습니다. 워커 차례를 기다리는 상태가 아닙니다.'
                    action = '사용자 추가 선택 없이 운영에서 연결을 구현해야 합니다.'
                    label = '공용 등록 연결 필요 · 실행 예약 없음'
                elif choices['installation']:
                    action = '선택 구역의 등록·저장 근거를 확인했습니다.'
                else:
                    wait_kind = 'user-decision'
                    action = '예시를 보고 Allow / Deny만 눌러 주세요.'
            except (OSError, ValueError, KeyError, TypeError):
                wait_kind = 'operator-attention'
                reason = '예시 자료를 확인하지 못했습니다. 실행 대기로 간주하지 않습니다.'

        elif c["stage"] == "result-review":
            wait_kind = "user-decision"
            action = "결과를 보고 수정 / Allow / Deny를 선택해 주세요."
        elif c["stage"] in ("done", "discarded"):
            action = "현재 실행 중인 단계가 없습니다."
        elif own and not live:
            wait_kind = "operator-attention"
            reason = "실행 기록은 있지만 해당 작업 프로세스를 확인할 수 없습니다. 종료 처리 또는 복구 확인이 필요합니다."
            action = "진행 중으로 간주하지 않습니다. 실행기 확인이 필요합니다."
        elif not own and c["stage"] not in ("blocked", "done", "discarded", "art-review"):
            siblings = [j for j in views if j['alive'] and group and j['concept'] in group]
            if runner and runner.get('parallelSpaces', 1) > 1:
                wait_kind = runner.get('waits', {}).get(c['id'], 'scheduling')
                reason = {
                    'completion-priority': '먼저 만든 공간의 데모·검수·등록을 마무리하고 새 제작을 배정합니다.',
                    'space-capacity': f"공간 {runner['parallelSpaces']}개가 동시에 작업 중입니다. 빈 슬롯에 배정합니다.",
                    'worker-capacity': '검수 작업자를 포함한 동시 실행 한도에 도달했습니다.',
                    'shared-stage': '공용 조립·시험·반영 단계의 충돌을 막기 위해 실행 중 작업의 종료를 기다립니다.',
                }.get(wait_kind, '공간별 병렬 실행기가 다음 단계를 배정 중입니다.')
                action = '사용자 입력 없이 실행기가 배정합니다.'
                if wait_kind != 'scheduling':
                    waiting_for = [{'id': j['id'], 'concept': j['concept'], 'title': j['title'], 'step': j['label']} for j in siblings]
            elif group and siblings:
                wait_kind = 'pipeline-order'
                waiting_for = [{'id': j['id'], 'concept': j['concept'], 'title': j['title'], 'step': j['label']} for j in siblings]
                reason = '전용 실행기가 한 단계씩 처리합니다. 현재: ' + ' · '.join(dict.fromkeys(j['title'] + ' / ' + j['label'] for j in siblings))
                action = '앞 단계가 끝나면 이 공간의 ' + label + '을 배정합니다. 사용자 입력은 없습니다.'
            elif group:
                wait_kind = 'scheduling'
                reason = '전용 실행기는 살아 있으며 다음 단계 배정을 기다립니다.'
            elif paused and c['status'] == 'queued':
                wait_kind = 'global-pause'
                reason = '전체 자동 큐가 일시 정지되어 있고 이 공간은 별도 실행기에 배정되지 않았습니다.'
                action = '워커 부족이 아니라 실행 범위 밖입니다. 사용자 선택 요청은 없습니다.'
            else:
                wait_kind = 'unassigned'
                reason = '실행 중인 작업이나 이 공간을 맡은 전용 실행기를 확인하지 못했습니다.'
        if retry:
            next_step = '예정 시각/작업 자리 확인 → 같은 단계 자동 재개'
        elif live:
            next_step = "현재 결과 검수 → 통과하면 다음 단계, 반려면 피드백을 반영해 재시도"
        elif c["stage"] == "blocked":
            next_step = "막힘 원인 교정 → 해당 단계 재실행"
        elif c["stage"] in ("done", "discarded"):
            next_step = "예약된 다음 단계 없음"
        elif wait_kind == "runtime-verification":
            next_step = "저장된 맵의 플레이어 보행·가림 확인"
        elif wait_kind == "integration-missing":
            next_step = "공용 등록·조립 실행 연결 구현 필요 (예약 없음)"
        elif c["stage"] == "art-review":
            next_step = "예시 Allow / Deny"
        else:
            next_step = label + " 실행 → 결과 검수"
        items.append(dict(id=c["id"], title=c["title"], stage=c["stage"], label=label, step=index,
                          state=c["status"], note=c.get("note") or "", jobs=own, managed=bool(group),
                          reason=reason, action=action, next=next_step, retryAt=min((r['due'] for r in retry), default=None), retryCount=max((r['count'] for r in retry), default=0), waitKind=wait_kind, waitingFor=waiting_for,
                          planAttempt=c.get("plan_attempt", 1), artRevision=c.get("art_revision", 0),
                          artLimit=art_feedback.limits(store.DATA, c["id"])["maxRevisions"],
                          reasons=(c.get("reasons") or [])[:3],
                          events=events(c["id"]) if cid else []))
    alive = [j for j in views if j['alive']]
    return dict(at=now, paused=paused, steps=STEPS, jobs=views, items=items,
                limits={'spaces': max((r.get('parallelSpaces', 1) for r in managed if not r.get('draining')), default=0),
                        'jobs': int(store.setting('max_codex'))},
                workers={'active': len(alive), 'nativeDrawing': sum(j['kind'] == 'art-native' for j in alive),
                         'preparing': sum(j['kind'] == 'art' for j in alive),
                         'reviewing': sum(j['kind'] in ('plan-review','material-review','art-layout-review','art-context-review','review','judge') for j in alive)})
