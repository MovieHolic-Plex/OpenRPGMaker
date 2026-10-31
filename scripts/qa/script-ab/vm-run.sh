#!/bin/bash
# Script A/B PoC — one build on the VM: vm-run.sh <arm A|B> <prompt-id> <rep> <out-root>
#   Runs inside the VM release copy (cwd = repo copy). A = scripts on (default), B = OPRN_V2_SCRIPTS=0.
#   Same engine as the suite opus arm: local Claude CLI, claude-opus-5-5 medium. Sends prompt + protocol turns, then stop.
#   After the session: runtime project.json + qa-game check (validator findings). No judge here.
set -u
ARM=$1; PID=$2; REP=$3; ROOT=$4
WT=$PWD; HERE=$(cd "$(dirname "$0")" && pwd)
G=$ROOT/$ARM/$PID-$REP; mkdir -p $G/session/inbox
echo "arm=$ARM prompt=$PID rep=$REP wt=$WT dist=$(cat dist/.built-from) started=$(date -u +%FT%TZ)" >> $G/RUN.txt
[ -f $G/project/project.sqlite ] || bun src/harnesses/assistant-capability/node/wholeGamePrepare.ts $G "sab-$ARM-$PID-$REP" > $G/prepare.log 2>&1 || { echo prepare-failed >> $G/RUN.txt; exit 1; }
[ -f $HOME/.oprn-suite/claude-env.sh ] && . $HOME/.oprn-suite/claude-env.sh
if [ "$ARM" = B ]; then export OPRN_V2_SCRIPTS=0; else unset OPRN_V2_SCRIPTS; fi
OPRN_OPENAI_COMPAT_PATH=$HOME/.oprn-suite/openai-compat-endpoints.json OPRN_TURN_DIAG=1 HARNESS_DIST_DIR=dist setsid nohup node src/harnesses/assistant-capability/node/wholeGameSession.mjs \
  --project-dir $G/project --out $G/session --v2 --snapshots --engine claude:claude-opus-5-5:medium >> $G/session-driver.log 2>&1 < /dev/null &
echo $! > $G/driver.pid
python3 - "$G/session" "$PID" "$HERE/prompts.json" <<'PY'
import json,sys,time,os
S,pid,pf=sys.argv[1:4]
P=json.load(open(pf)); proto=P["protocol"]; text=[p["text"] for p in P["prompts"] if p["id"]==pid][0]
inbox=f"{S}/inbox"; log=open(f"{S}/../steps.log","a"); n=0
def state():
    try: return json.load(open(f"{S}/state.json"))
    except Exception: return {}
def wait_idle():
    t0=time.time()
    while True:
        s=state()
        if s.get("phase") in ("idle","awaiting-answer","stopped") and not os.listdir(inbox): return s
        if time.time()-t0>60*60: return s
        time.sleep(15)
def send(kind,body):
    global n; n+=1; open(f"{inbox}/{n:03d}.{kind}","w").write(body); log.write(f"{time.strftime('%T')} sent {n:03d}.{kind}: {body[:40]}\n"); log.flush(); time.sleep(40)
time.sleep(30); cards=0
for t in proto["turns"]:
    body=text if t=="prompt" else proto[t]
    s=wait_idle()
    while s.get("phase")=="awaiting-answer" and cards<proto["maxCardAnswers"]:
        cards+=1; send("txt",proto["card"]); s=wait_idle()
    send("txt",body)
s=wait_idle()
while s.get("phase")=="awaiting-answer" and cards<proto["maxCardAnswers"]:
    cards+=1; send("txt",proto["card"]); s=wait_idle()
send("stop",""); log.write("done\n")
PY
for i in $(seq 1 120); do kill -0 $(cat $G/driver.pid) 2>/dev/null || break; sleep 15; done
mkdir -p $G/check
node -e "import('./src/harnesses/assistant-capability/node/editorDriver.mjs').then(m=>m.writeRuntimeProject('$G/project','$G/check/project.json'))" 2>/dev/null
BRIEF=$(python3 -c "import json;P=json.load(open('$HERE/prompts.json'));print([p['text'] for p in P['prompts'] if p['id']=='$PID'][0])")
timeout 900 bun scripts/qa-game/check.mts --project $G/check/project.json --out $G/check --brief "$BRIEF" --quiet; echo "check exit $?" >> $G/RUN.txt
echo "finished=$(date -u +%FT%TZ)" >> $G/RUN.txt
