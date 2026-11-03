#!/bin/bash
# Lead/worker split battery — one run on the VM:  vm-run.sh <arm> <task> <rep> <out-root>
#   cwd = the VM release copy (this branch's build). Arm = engine flags + optional OPRN_V2_SPLIT lead (prompts.json arms).
#   Copies <out-root>/checkpoints/<task cp>/frozen, sends ONLY the task request (+ ≤4 card auto-answers), stops at the cap.
#   Usage survives the cap: every claude CLI call (worker and lead) is teed to <run>/claude-stream.jsonl; API workers write
#   OPRN_CALL_LOG <run>/calls.jsonl (lead calls carry role:"lead"). Cap SPLIT_CAP_MIN (default 15).
set -u
ARM=$1; TASK=$2; REP=$3; ROOT=$4
WT=$PWD; HERE=$(cd "$(dirname "$0")" && pwd); PF=$HERE/prompts.json; GAMES=/home/ubuntu/z-project/assistant-whole-game/games
G=$ROOT/$ARM/$TASK-$REP; mkdir -p $G/session/inbox
read CP ENGINE LEAD <<< "$(python3 -c "
import json;P=json.load(open('$PF'));t=[t for t in P['tasks'] if t['id']=='$TASK'][0];a=P['arms']['$ARM']
print(t['cp'], a['engine'].replace('\$G','$GAMES').replace(' ','|'), a['lead'] or '-')")"
ENGINE=${ENGINE//|/ }
echo "arm=$ARM task=$TASK rep=$REP cp=$CP wt=$WT dist=$(cat dist/.built-from) engine=$ENGINE lead=$LEAD started=$(date -u +%FT%TZ)" >> $G/RUN.txt
if [ ! -f $G/project/project.sqlite ]; then
  [ -f $ROOT/checkpoints/$CP/frozen/project.sqlite ] || { echo no-checkpoint >> $G/RUN.txt; exit 1; }
  mkdir -p $G/project && cp -a $ROOT/checkpoints/$CP/frozen/. $G/project/ && cp $ROOT/checkpoints/$CP/fixture.json $G/ 2>/dev/null
fi
[ -f $HOME/.oprn-suite/claude-env.sh ] && . $HOME/.oprn-suite/claude-env.sh
unset OPRN_V2_SCRIPTS OPRN_V2_SPLIT
[ "$LEAD" != - ] && export OPRN_V2_SPLIT="lead:$LEAD"
REAL_CLAUDE=$(command -v claude); mkdir -p $G/bin
printf '#!/bin/bash\nexec "%s" "$@" > >(tee -a "%s")\n' "$REAL_CLAUDE" "$G/claude-stream.jsonl" > $G/bin/claude-tee; chmod +x $G/bin/claude-tee
export OPRN_LOCAL_CLI_CLAUDE=$G/bin/claude-tee
CAP_MIN=${SPLIT_CAP_MIN:-15}; DEADLINE_MS=$(( $(date +%s) * 1000 + (CAP_MIN - 1) * 60000 )); echo "deadline_ms=$DEADLINE_MS cap_min=$CAP_MIN" >> $G/RUN.txt
OPRN_CALL_LOG=$G/calls.jsonl OPRN_OPENAI_COMPAT_PATH=$HOME/.oprn-suite/openai-compat-endpoints.json OPRN_TURN_DIAG=1 HARNESS_DIST_DIR=dist setsid nohup node src/harnesses/assistant-capability/node/wholeGameSession.mjs \
  --project-dir $G/project --out $G/session --v2 $ENGINE --deadline-ms $DEADLINE_MS >> $G/session-driver.log 2>&1 < /dev/null &
echo $! > $G/driver.pid
python3 - "$G/session" "$TASK" "$PF" "$DEADLINE_MS" <<'PY'
import json,sys,time,os
S,tid,pf,deadline=sys.argv[1:5]; deadline=int(deadline)/1000
P=json.load(open(pf)); proto=P["protocol"]; text=[t["text"] for t in P["tasks"] if t["id"]==tid][0]
inbox=f"{S}/inbox"; log=open(f"{S}/../steps.log","a"); n=0
def state():
    try: return json.load(open(f"{S}/state.json"))
    except Exception: return {}
def wait_idle():
    while True:
        s=state()
        if s.get("phase") in ("idle","awaiting-answer","stopped") and not os.listdir(inbox): return s
        if time.time()>deadline+120: return s
        time.sleep(10)
def send(kind,body):
    global n; n+=1; open(f"{inbox}/{n:03d}.{kind}","w").write(body); log.write(f"{time.strftime('%T')} sent {n:03d}.{kind}: {body[:40]}\n"); log.flush(); time.sleep(30)
time.sleep(20); cards=0
s=wait_idle(); send("txt",text)
s=wait_idle()
while s.get("phase")=="awaiting-answer" and cards<proto["maxCardAnswers"] and time.time()<deadline:
    cards+=1; send("txt",proto["card"]); s=wait_idle()
send("stop",""); log.write("done\n")
PY
for i in $(seq 1 60); do kill -0 $(cat $G/driver.pid) 2>/dev/null || break; sleep 10; done
mkdir -p $G/check
node -e "import('./src/harnesses/assistant-capability/node/editorDriver.mjs').then(m=>m.writeRuntimeProject('$G/project','$G/check/project.json'))" 2>/dev/null
timeout 600 bun scripts/qa-game/check.mts --project $G/check/project.json --out $G/check --quiet > /dev/null 2>&1; echo "check exit $?" >> $G/RUN.txt
echo "finished=$(date -u +%FT%TZ)" >> $G/RUN.txt
