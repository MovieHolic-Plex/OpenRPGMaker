#!/bin/bash
# walk-one.sh <arm> <prompt> <rep> [batch]  — run the walkthrough for one pulled run (binding in <batch>/bind/<arm>-<prompt>-<rep>.json)
set -u
A=$1; P=$2; R=$3; B=${4:-sab-1031}; L=~/z-project/assistant-whole-game/suite/script-ab/$B
cd ~/z-project/rpg-zzu-script-ab && timeout 1800 node scripts/qa/script-ab/walk.mjs --project-dir $L/$A/$P-$R/project --request $P \
  --bind $L/bind/$A-$P-$R.json --out $L/walk/$A-$P-$R --video --netns > $L/walk/$A-$P-$R.log 2>&1
grep -E "^(PASS|FAIL|walk )" $L/walk/$A-$P-$R.log
