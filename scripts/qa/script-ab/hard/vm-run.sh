#!/bin/bash
# Hard-logic battery — one run on the VM:  vm-run.sh <arm stage|opus|haiku> <id> <rep> <out-root>
#   cwd = the VM release copy (origin/main build). arm «stage»: <id> = stage id (puzzle|stealth|town); builds the frozen
#   stage checkpoint (maps + named events, no logic) from an empty project, then freezes it (AI history cleared).
#   Other arms: <id> = mechanic id; copy <out-root>/checkpoints/<stage of mechanic>/frozen, send ONLY the logic request
#   (+ ≤4 card auto-answers), stop. Engine from prompts.json engines[arm]. Cap HARD_CAP_MIN (default 15; stage 35).
set -u
ARM=$1; ID=$2; REP=$3; ROOT=$4
WT=$PWD; HERE=$(cd "$(dirname "$0")" && pwd); PF=$HERE/prompts.json
if [ "$ARM" = stage ]; then G=$ROOT/checkpoints/$ID; KEY=stage; CAP_MIN=${HARD_STAGE_CAP_MIN:-35}; ENGINE=$(python3 -c "import json;print(json.load(open('$PF'))['engines']['opus'])")
else G=$ROOT/$ARM/$ID-$REP; KEY=mechanics; CAP_MIN=${HARD_CAP_MIN:-15}; ENGINE=$(python3 -c "import json;print(json.load(open('$PF'))['engines']['$ARM'])")
  STAGE=$(python3 -c "import json;print([m['stage'] for m in json.load(open('$PF'))['mechanics'] if m['id']=='$ID'][0])"); fi
mkdir -p $G/session/inbox
echo "arm=$ARM id=$ID rep=$REP wt=$WT dist=$(cat dist/.built-from) engine=$ENGINE started=$(date -u +%FT%TZ)" >> $G/RUN.txt
if [ ! -f $G/project/project.sqlite ]; then
  if [ "$ARM" = stage ]; then bun src/harnesses/assistant-capability/node/wholeGamePrepare.ts $G "hard-stage-$ID" > $G/prepare.log 2>&1 || { echo prepare-failed >> $G/RUN.txt; exit 1; }
  else [ -f $ROOT/checkpoints/$STAGE/frozen/project.sqlite ] || { echo no-checkpoint >> $G/RUN.txt; exit 1; }
       mkdir -p $G/project && cp -a $ROOT/checkpoints/$STAGE/frozen/. $G/project/ && cp $ROOT/checkpoints/$STAGE/fixture.json $G/ 2>/dev/null; fi
fi
[ -f $HOME/.oprn-suite/claude-env.sh ] && . $HOME/.oprn-suite/claude-env.sh
unset OPRN_V2_SCRIPTS
DEADLINE_MS=$(( $(date +%s) * 1000 + (CAP_MIN - 1) * 60000 )); echo "deadline_ms=$DEADLINE_MS cap_min=$CAP_MIN" >> $G/RUN.txt
OPRN_OPENAI_COMPAT_PATH=$HOME/.oprn-suite/openai-compat-endpoints.json OPRN_TURN_DIAG=1 HARNESS_DIST_DIR=dist setsid nohup node src/harnesses/assistant-capability/node/wholeGameSession.mjs \
  --project-dir $G/project --out $G/session --v2 --snapshots --engine $ENGINE --deadline-ms $DEADLINE_MS >> $G/session-driver.log 2>&1 < /dev/null &
echo $! > $G/driver.pid
python3 - "$G/session" "$ID" "$PF" "$DEADLINE_MS" "$KEY" <<'PY'
import json,sys,time,os
S,mid,pf,deadline,key=sys.argv[1:6]; deadline=int(deadline)/1000
P=json.load(open(pf)); proto=P["protocol"]; text=[p["text"] for p in P[key] if p["id"]==mid][0]
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
if [ "$ARM" = stage ]; then
  rm -rf $G/frozen && cp -a $G/project $G/frozen && node $HERE/freeze.mjs $G/frozen/project.sqlite >> $G/RUN.txt 2>&1
fi
echo "finished=$(date -u +%FT%TZ)" >> $G/RUN.txt
