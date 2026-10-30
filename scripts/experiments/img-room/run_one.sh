#!/bin/bash
# img-room-test 한 판: run_one.sh <boss|inn> <terra|opus> <A|B> <rep>
#   A = 지금 v2 경로(요청 글만). B = 칩셋 조각 판(palette) → 이미지 모델 목업 → 목업을 첫 요청에 붙여 v2 가 짓는다.
#   결과: $IMGROOM_RUNS/<cond><rep>/<arm>/<task>/ (기본 suite/rooms/runs-imgroom). run-room.sh 의 흐름을 따른다(준비→세션→after.json→measure-room).
set -u
TASK=$1; ARM=$2; COND=$3; REP=$4
WT=$(cd "$(dirname "$0")/../../.." && pwd)
ROOT=${SUITE_ROOT:-$HOME/z-project/assistant-whole-game}; R=$ROOT/suite/rooms
RUNS=${IMGROOM_RUNS:-$R/runs-imgroom}
G=$RUNS/$COND$REP/$ARM/$TASK
REFS=$RUNS/refs
export OPRN_SHARED_CONTENT_SQLITE=${OPRN_SHARED_CONTENT_SQLITE:-$RUNS/shared-content.base.sqlite}
trap 'rm -f $G/shared-content.sqlite $G/shared-content.sqlite-wal $G/shared-content.sqlite-shm' EXIT
SUFFIX=" 다른 맵은 만들지 말고 이 방 하나만 지어 줘."
case $TASK in
  inn) TEXT="작은 마을 여관 1층을 만들어 줘. 손님을 맞는 카운터와 밥 먹는 자리가 있는 곳이야.$SUFFIX" ;;
  boss) TEXT="성 지하 깊은 곳, 마왕이 기다리는 던전 보스 방을 만들어 줘. 입구에서 들어와 옥좌까지 가는 곳이야.$SUFFIX" ;;
  *) echo "unknown task"; exit 1 ;;
esac
cd $WT; [ -f dist/index.html ] || { echo "no dist"; exit 1; }
mkdir -p $G/session/inbox
[ -d $REFS ] || python3 scripts/experiments/img-room/gen_refs.py $REFS
IMG_ENV=""
if [ $COND = B ]; then
  if [ ! -f $G/mockup.png ]; then
    for try in 1 2 3; do
      timeout 600 bun scripts/experiments/img-room/gen_mockup.mts $TASK $REFS $G/mockup.png > $G/mockup.json 2> $G/mockup.err && break
      echo "mockup try $try failed: $(tail -c 300 $G/mockup.err)" >> $G/RUN.txt; sleep 30
    done
  fi
  [ -f $G/mockup.png ] || { echo "VOID: 목업 생성 실패" > $G/VOID.txt; exit 1; }
  python3 -c "from PIL import Image;im=Image.open('$G/mockup.png').convert('RGB');im.save('$G/mockup.jpg',quality=90)"
  TEXT="$TEXT

Build this room on the map with the chipset; match its structure, zones and landmark. The attached picture [mockup attached] is a mockup of this room drawn from this chipset's own pieces — follow its room outline (alcoves, side rooms, the L or two-part shape), where each zone sits, and where the landmark stands."
  IMG_ENV="OPRN_EXPERIMENT_USER_IMAGE=$G/mockup.jpg"
fi
[ -f $G/project/project.sqlite ] || bun src/harnesses/assistant-capability/node/wholeGamePrepare.ts $G "imgroom-$COND$REP-$ARM-$TASK" > $G/prepare.log 2>&1 || { echo "VOID: prepare 실패" > $G/VOID.txt; exit 1; }
[ -f $G/before.json ] || node -e "import('./src/harnesses/assistant-capability/node/editorDriver.mjs').then(m=>m.writeRuntimeProject('$G/project','$G/before.json'))" || exit 1
case $ARM in
  terra) ENG="--ai-config $RUNS/aiconfig-terra-high.json" ;;
  opus) ENG="--engine claude:claude-opus-5-5:medium" ;;
  *) echo "unknown arm"; exit 1 ;;
esac
echo "wt=$WT head=$(git rev-parse --short HEAD) arm=$ARM task=$TASK cond=$COND rep=$REP started=$(date -u +%FT%TZ)" >> $G/RUN.txt
T0=$(date +%s)
env $IMG_ENV HARNESS_HOST_LOG=$G/host.log OPRN_OPENAI_COMPAT_PATH=$HOME/.oprn-suite/openai-compat-endpoints.json OPRN_TURN_DIAG=1 HARNESS_DIST_DIR=dist setsid nohup node src/harnesses/assistant-capability/node/wholeGameSession.mjs --project-dir $G/project --out $G/session --v2 $ENG > $G/session-driver.log 2>&1 &
DRV=$!
printf '%s' "$TEXT" > $G/request.txt
python3 - "$G/session" "$G/request.txt" 30 <<'PY'
import json,sys,time,os
S,tf,to=sys.argv[1],sys.argv[2],int(sys.argv[3]); text=open(tf).read()
inbox=f"{S}/inbox"; log=open(f"{S}/../steps.log","a"); T0=time.time()
def state():
    try: return json.load(open(f"{S}/state.json"))
    except Exception: return {}
def wait_idle(after=-1):
    while True:
        s=state()
        if s.get("phase") in ("idle","awaiting-answer","stopped") and not os.listdir(inbox) and int(s.get("turns") or 0)>after: return s
        if time.time()-T0>to*60: log.write("timeout\n"); return s
        time.sleep(10)
n=0
def send(kind,body):
    global n; n+=1; open(f"{inbox}/{n:03d}.{kind}","w").write(body); log.write(f"{time.strftime('%T')} sent {n:03d}.{kind}: {body[:50]}\n"); log.flush(); time.sleep(30)
time.sleep(20)
s=wait_idle(); send("txt",text)
s=wait_idle(int(s.get("turns") or 0)); cards=0
while s.get("phase")=="awaiting-answer" and cards<2 and time.time()-T0<to*60:
    cards+=1; t=int(s.get("turns") or 0); send("txt","좋아, 네가 판단해서 그대로 진행해 줘."); s=wait_idle(t)
send("stop",""); log.write(f"done {round((time.time()-T0)/60,1)}min cards={cards}\n"); log.flush()
PY
for i in $(seq 1 60); do kill -0 $DRV 2>/dev/null || break; sleep 5; done
kill -0 $DRV 2>/dev/null && kill $DRV
echo "build_s=$(( $(date +%s) - T0 ))" >> $G/RUN.txt
node -e "import('./src/harnesses/assistant-capability/node/editorDriver.mjs').then(m=>m.writeRuntimeProject('$G/project','$G/after.json'))" || { echo "VOID: after.json 없음" > $G/VOID.txt; exit 1; }
SUITE_WT=$WT timeout 600 bun $R/measure-room.mts $G > $G/measure.log 2>&1; echo "measure exit $?" >> $G/RUN.txt
echo "done=$(date -u +%FT%TZ)" >> $G/RUN.txt
