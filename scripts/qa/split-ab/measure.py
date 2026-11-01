#!/usr/bin/env python3
"""Lead/worker split battery — one row per run (cost per role, calls, time, checks, judge scores) → <batch>/measure.json.

  python3 scripts/qa/split-ab/measure.py <batch dir>

Cost = tokens × public list price (per 1M): Opus 5.5 $4/$20 (cache read $0.20, write $5) · Haiku 5.5 $0.10/$0.50 (read $0.01,
write $0.125) · Gemini 3.8 Flash $0.75/$3.75 (read $0.075) · Gemini 4 Argon $2/$10 (read $0.10) · DeepSeek V4.1 Flash
$0.15/$0.60 (cache hit $0.003). Claude CLI calls (worker or lead) come from the teed stream: per turn `usage` (the
`modelUsage`/`total_cost_usd` there are per-session cumulative — not summed), plus the per-message usage of a turn cut by
the cap. Haiku is priced at Haiku list price (Claude Code bills it at Opus rates). The 8318 relay (Flash, Argon) reports
no usage: tokens are estimated from request characters ÷ 3.04 (calibrated on DeepSeek's reported usage, ±8 %), between
«prefix cached» and «nothing cached»; the midpoint is used and the row is marked 추정.
"""
import glob, json, os, re, statistics, sys
from datetime import datetime

L = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, "prompts.json")))
TASKS = {t["id"]: t for t in P["tasks"]}
PRICE = {
    "claude-opus-5-5": dict(inp=4, out=20, read=0.2, write=5),
    "claude-haiku-5-5": dict(inp=0.1, out=0.5, read=0.01, write=0.125),
    "gemini-3.8-flash": dict(inp=0.75, out=3.75, read=0.075, write=0),
    "gemini-4-argon": dict(inp=2, out=10, read=0.1, write=0),
    "deepseek-v4.1-flash": dict(inp=0.15, out=0.6, read=0.003, write=0),
}
CPT_IN, CPT_OUT = 3.04, 2.67


def price(model, inp=0, out=0, read=0, write=0):
    p = PRICE.get(model) or PRICE.get(re.sub(r"-high$", "", model or "")) or {}
    return (inp * p.get("inp", 0) + out * p.get("out", 0) + read * p.get("read", 0) + write * p.get("write", 0)) / 1e6


def claude_usage(path):
    """{model: {calls, input, output, read, write, cut}} from the teed CLI stream."""
    out = {}
    if not os.path.exists(path):
        return out
    sess_model, pending = {}, {}
    def acc(model):
        return out.setdefault(model, dict(calls=0, input=0, output=0, read=0, write=0, cut=0))
    for line in open(path, errors="replace"):
        try:
            j = json.loads(line)
        except Exception:
            continue
        sid = j.get("session_id")
        if j.get("type") == "assistant":
            m = j["message"]; u = m.get("usage") or {}
            sess_model[sid] = m.get("model")
            cur = pending.setdefault(sid, {})
            prev = cur.get(m["id"], {})
            cur[m["id"]] = {k: max(prev.get(k, 0), u.get(k, 0) or 0) for k in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")}
        elif j.get("type") == "result":
            model = next(iter(j.get("modelUsage") or {}), None) or sess_model.get(sid)
            u = j.get("usage") or {}
            a = acc(model)
            a["calls"] += len(pending.get(sid, {})) or 1
            a["input"] += u.get("input_tokens", 0); a["output"] += u.get("output_tokens", 0)
            a["read"] += u.get("cache_read_input_tokens", 0); a["write"] += u.get("cache_creation_input_tokens", 0)
            pending[sid] = {}
    for sid, msgs in pending.items():          # turn cut by the cap: per-message usage (output is a lower bound)
        if not msgs: continue
        a = acc(sess_model.get(sid)); a["cut"] += 1; a["calls"] += len(msgs)
        for u in msgs.values():
            a["input"] += u["input_tokens"]; a["output"] += u["output_tokens"]; a["read"] += u["cache_read_input_tokens"]; a["write"] += u["cache_creation_input_tokens"]
    return out


def api_calls(path, role=None):
    rows = []
    if os.path.exists(path):
        for line in open(path, errors="replace"):
            try:
                j = json.loads(line)
            except Exception:
                continue
            if (j.get("role") or None) == role:
                rows.append(j)
    return rows


def api_cost(rows, model):
    """(cost, estimated?) for API calls of one model."""
    if not rows:
        return 0.0, False
    us = [r.get("usage") or {} for r in rows]
    reported = sum((u.get("input") or 0) + (u.get("cacheRead") or 0) for u in us)
    if reported > 1000 * len(rows) * 0.5:
        c = sum(price(model, u.get("input") or 0, u.get("output") or 0, u.get("cacheRead") or 0, u.get("cacheWrite") or 0) for u in us)
        return c, False
    tin = sum(r.get("totalChars") or 0 for r in rows) / CPT_IN
    tpre = sum((r.get("systemChars") or 0) + (r.get("toolsChars") or 0) for r in rows) / CPT_IN
    out = r_out = sum(((r.get("out") or {}).get("text", 0) + (r.get("out") or {}).get("thinking", 0) + (r.get("out") or {}).get("toolArgs", 0)) for r in rows) / CPT_OUT
    hi = price(model, tin, out); lo = price(model, tin - tpre, out, tpre)
    return (lo + hi) / 2, True


def run_row(d):
    arm = os.path.basename(os.path.dirname(d)); tr = os.path.basename(d); task, rep = tr.rsplit("-", 1)
    A = P["arms"].get(arm, {}); T = TASKS.get(task, {})
    worker = A.get("worker"); lead_spec = A.get("lead")
    lead_model = (re.split(r"[:/]", lead_spec.split("@")[0])[-2] if lead_spec and lead_spec.startswith("claude:") else lead_spec.split("/")[-1].split("@")[0]) if lead_spec else None
    r = dict(arm=arm, task=task, rep=int(rep), group=T.get("group"), worker=worker, lead=lead_model)
    run = open(f"{d}/RUN.txt").read() if os.path.exists(f"{d}/RUN.txt") else ""
    st = re.search(r"started=(\S+)", run); fi = re.search(r"finished=(\S+)", run)
    # session time: sum of turn elapsed (model work), else wall clock
    turns = [json.load(open(f)) for f in sorted(glob.glob(f"{d}/session/turns/*.json"))]
    ms = sum(t.get("elapsedMs") or 0 for t in turns)
    r["min"] = round(ms / 60000, 1) if ms else (round((datetime.fromisoformat(fi.group(1).rstrip("Z")) - datetime.fromisoformat(st.group(1).rstrip("Z"))).total_seconds() / 60, 1) if st and fi else None)
    r["outcome"] = ",".join(sorted({str(t.get("outcome")) for t in turns})) or "none"
    tc = [c for t in turns for c in (t.get("toolCalls") or []) if c.get("type") == "tool_end"]
    r["tools"] = len(tc); r["toolFails"] = sum(1 for c in tc if not c.get("ok"))
    notes = [n for t in turns for n in (t.get("statusNotes") or []) if isinstance(n, str)]
    r["leadPlan"] = any("리드 계획" in n and "실패" not in n and "비어" not in n for n in notes)
    r["leadReviews"] = sum(1 for n in notes if n.startswith("v2.split.review") or "리드 검토" in n)
    # cost per role
    cu = claude_usage(f"{d}/claude-stream.jsonl")
    wc = lc = 0.0; wcalls = lcalls = 0; est = False
    for model, u in cu.items():
        c = price(model, u["input"], u["output"], u["read"], u["write"])
        if lead_model and model == lead_model: lc += c; lcalls += u["calls"]
        else: wc += c; wcalls += u["calls"]
    if worker and not worker.startswith("claude-"):
        rows = api_calls(f"{d}/calls.jsonl"); c, e = api_cost(rows, worker); wc += c; wcalls += len(rows); est |= e
    if lead_model and not lead_model.startswith("claude-"):
        rows = api_calls(f"{d}/calls.jsonl", "lead")
        tin = sum(x.get("totalChars") or 0 for x in rows) / CPT_IN; tout = sum((x.get("out") or {}).get("text", 0) for x in rows) / CPT_OUT
        lc += price(lead_model, tin, tout); lcalls += len(rows); est = True
    r.update(costWorker=round(wc, 4), costLead=round(lc, 4), cost=round(wc + lc, 4), callsWorker=wcalls, callsLead=lcalls, estimated=est,
             cut=sum(u["cut"] for u in cu.values()))
    # checks
    w = f"{L}/walk/{arm}__{task}__{rep}/walk.json"
    j = f"{L}/judge/{arm}__{task}__{rep}.json"
    J = json.load(open(j)) if os.path.exists(j) else None
    if os.path.exists(w):
        ch = json.load(open(w))["checks"]; r["checksPass"] = sum(1 for c in ch if c["pass"]); r["checksN"] = len(ch); r["checksSrc"] = "play"
        r["checksFail"] = [c["id"] for c in ch if not c["pass"]]
    elif J:
        ch = J.get("checklist") or []; r["checksPass"] = sum(1 for c in ch if c.get("pass")); r["checksN"] = len(T.get("accept") or ch); r["checksSrc"] = "judge"
        r["checksFail"] = [str(c.get("item")) for c in ch if not c.get("pass")]
    if J:
        r.update(fidelity=J.get("fidelity"), works=J.get("works"), dialogue=J.get("dialogue"), staging=J.get("staging"),
                 defects=len((J.get("structure") or {}).get("defects") or []), falseDone=bool((J.get("structure") or {}).get("falseDone")), summary=J.get("summary"))
        if os.path.exists(w):   # judge checklist too (logic requests: play checks are the completeness source)
            r["judgeChecks"] = sum(1 for c in J.get("checklist") or [] if c.get("pass"))
    rd = f"{L}/readability/{arm}__{task}__{rep}.json"
    if os.path.exists(rd): r["readability"] = json.load(open(rd)).get("score")
    return r


rows = [run_row(os.path.dirname(p)) for p in sorted(glob.glob(f"{L}/*/*/.pulled"))]
json.dump({"rows": rows, "at": datetime.now().isoformat()}, open(f"{L}/measure.json", "w"), ensure_ascii=False, indent=1)
for r in rows:
    print(f"{r['arm']:15} {r['task']:8} {r['rep']} ${r['cost']:.3f} (W {r['costWorker']:.3f} L {r['costLead']:.3f}){' 추정' if r['estimated'] else ''} calls {r['callsWorker']}+{r['callsLead']} "
          f"{r['min']}m tools {r['tools']}/{r['toolFails']}✗ checks {r.get('checksPass','-')}/{r.get('checksN','-')}({r.get('checksSrc','-')}) fid {r.get('fidelity','-')} read {r.get('readability','-')} {r['outcome']}")
