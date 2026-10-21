#!/bin/bash
# usage: post-loop.sh <run dir> <attempt>   — score + film + frames for every finished attempt, until killed
R=$1; N=${2:-1}
cd "$(dirname "$0")/../../../.."
while true; do
  for d in $R/*/attempt-$N; do
    c=$(basename $(dirname $d))
    [ -f $d/result.json ] || continue
    [ -f $d/score.json ] || timeout 900 node src/harnesses/assistant-capability/node/sceneLessons.mjs score --out $R --case $c --attempt $N > $d/score-log.txt 2>&1
    if [ ! -d $d/film ] && [ -f $d/live.json ]; then
      timeout 600 node src/harnesses/assistant-capability/node/sceneFilm.mjs --out $R --case $c --attempt $N --seconds 150 > $d/film-log.txt 2>&1
    fi
    if [ -f $d/film/film.mp4 ] && [ ! -d $d/film/frames ]; then mkdir -p $d/film/frames; ffmpeg -loglevel error -y -i $d/film/film.mp4 -vf fps=1/2 $d/film/frames/f%02d.png; fi
    if [ -f $d/film/film.mp4 ] && [ ! -d $d/film/dense ]; then node src/harnesses/assistant-capability/node/sceneDenseFrames.mjs $d > /dev/null 2>&1; fi
  done
  sleep 60
done
