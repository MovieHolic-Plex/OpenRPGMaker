#!/bin/sh
# 사용: ./zoom.sh <bg> id… → /tmp/pi-zoom.png (8배)
BG=$1; shift
Z=${Z:-8} W=${W:-1600} BG=$BG python3 pi_all.py sheet "$@" >/dev/null && mv /tmp/pi-all.png /tmp/pi-zoom.png && echo /tmp/pi-zoom.png
