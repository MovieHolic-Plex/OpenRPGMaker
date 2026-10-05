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

STEPS = ["공간 기획", "기획 검수", "재료 조사·검수", "칩 제작·검수", "공간 조립", "시각 검수", "조수 시험", "공용 등록"]
STAGE = {
    "discovered": (0, "기획 차례 대기"), "plan": (0, "공간 기획·텍스트 도면 작성"),
    "plan-review": (1, "기획·도면 독립 검수"), "survey": (2, "사용 가능한 칩 조사"),
    "material-review": (2, "필수 재료 독립 검수"), "art": (3, "부족한 칩 제작"),
    "art-native": (3, "그림 제작·원본 검수"), "art-layout-review": (3, "제작 전 배치도 검수"),
    "art-context-review": (3, "조립 그림 독립 검수"), "art-review": (3, "후보 선택·등록 확인"),
    "build": (4, "공간 조립·예제 렌더"), "review": (5, "완성 그림 적대적 검수"),
    "probe": (6, "조수 배치 시험"), "judge": (6, "조수 시험 판정"),
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
    return dict(id=job["id"], concept=job["concept"], label=label, reviewer=reviewer,
                alive=process_alive(job), model=model, effort=effort, elapsedSeconds=max(0, int(now-started)) if started else None,
                outputAgeSeconds=max(0, int(now-modified)) if modified else None)


def batches(now):
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
                result.append(members)
        except (OSError, ValueError, KeyError, TypeError):
            continue
    return result


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
    managed = batches(now)
    paused = store.setting("paused") == "1"
    items = []
    for c in concepts:
        if cid and c["id"] != cid:
            continue
        own = [j for j in views if j["concept"] == c["id"]]
        live = [j for j in own if j["alive"]]
        group = next((g for g in managed if c["id"] in g), None)
        index, label = STAGE.get(c["stage"], (-1, c["stage"]))
        reason = ""
        action = "지금 누를 버튼은 없습니다. 단계가 끝나면 다음 판정을 확인합니다."
        if c["stage"] == "blocked":
            reason = c.get("note") or "검수 또는 결과 처리에서 멈췄습니다."
            action = "아래 반려 사유를 확인해 교정해야 합니다. 자동 재시작은 예약되지 않았습니다."
        elif c["stage"] == "art-review":
            action = "아래 후보의 선택 가능 여부와 등록 상태를 확인해 주세요."
        elif c["stage"] in ("done", "discarded"):
            action = "현재 실행 중인 단계가 없습니다."
        elif own and not live:
            reason = "실행 기록은 있지만 해당 작업 프로세스를 확인할 수 없습니다. 종료 처리 또는 복구 확인이 필요합니다."
            action = "진행 중으로 간주하지 않습니다. 실행기 확인이 필요합니다."
        elif not own and c["stage"] not in ("blocked", "done", "discarded", "art-review"):
            drawing = [j for j in views if j["alive"] and any(k["id"] == j["id"] and k["kind"] in ("art", "art-native") for k in jobs)]
            siblings = [j for j in views if j["alive"] and group and j["concept"] in group]
            if group and c["stage"] == "art" and drawing:
                reason = "칩 제작 자리를 기다립니다. 현재 사용: " + " · ".join(dict.fromkeys(j["title"] for j in drawing))
            elif group and siblings:
                reason = "지정 공간을 순서대로 처리 중입니다. 현재 작업: " + " · ".join(dict.fromkeys(j["title"] for j in siblings))
            elif group:
                reason = "지정 공간 실행기의 다음 단계 배정을 기다립니다."
            elif paused and c["status"] == "queued":
                reason = "전체 자동 큐가 멈춰 있습니다. 이 공간을 담당하는 실행기의 최근 활동은 확인되지 않았습니다."
                action = "전체 큐 재개는 다른 공간도 실행합니다. 이 공간만 계속할지 운영 상태를 확인해야 합니다."
            elif c["stage"] not in ("blocked", "done", "discarded", "art-review"):
                reason = "실행 작업이 없습니다. 다음 단계 배정 또는 선행 재료를 기다립니다."
        if live:
            next_step = "현재 결과 검수 → 통과하면 다음 단계, 반려면 피드백을 반영해 재시도"
        elif c["stage"] == "blocked":
            next_step = "막힘 원인 교정 → 해당 단계 재실행"
        elif c["stage"] in ("done", "discarded"):
            next_step = "예약된 다음 단계 없음"
        elif c["stage"] == "art-review":
            next_step = "선택·공용 등록·저장 근거 확인"
        else:
            next_step = label + " 실행 → 결과 검수"
        items.append(dict(id=c["id"], title=c["title"], stage=c["stage"], label=label, step=index,
                          state=c["status"], note=c.get("note") or "", jobs=own, managed=bool(group),
                          reason=reason, action=action, next=next_step,
                          planAttempt=c.get("plan_attempt", 1), artRevision=c.get("art_revision", 0),
                          artLimit=art_feedback.limits(store.DATA, c["id"])["maxRevisions"],
                          reasons=(c.get("reasons") or [])[:3],
                          events=events(c["id"]) if cid else []))
    return dict(at=now, paused=paused, steps=STEPS, jobs=views, items=items)
