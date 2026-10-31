#!/bin/bash
# Script A/B PoC — pull finished VM runs to this box: pull.sh [batch=sab-1031]
set -u
. ~/z-project/assistant-whole-game/suite/remote/config.sh
B=${1:-sab-1031}; L=~/z-project/assistant-whole-game/suite/script-ab/$B; mkdir -p $L
RRSYNC="env LD_LIBRARY_PATH=$RBASE/sys/usr/lib/aarch64-linux-gnu:$RBASE/sys/lib/aarch64-linux-gnu $RBASE/bin/rsync"
rsync -a -e "ssh ${SSHO[*]}" --rsync-path="$RRSYNC" --exclude='shared-content.sqlite*' --exclude='snapshots/' $VM:$RBASE/script-ab/$B/ $L/
echo "pulled → $L"
