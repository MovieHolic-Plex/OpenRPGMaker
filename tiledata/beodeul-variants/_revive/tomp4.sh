#!/bin/bash
# usage: tomp4.sh <mapId>
d=/home/main/z-project/rpg-zzu-fs2-revive/verify-shots/beodeul-wave-places/runtime/$1
f=$(ls $d/*.webm | head -1)
t=$(ffmpeg -loglevel error -i "$f" -vf fps=4,scale=64:48,format=gray -f rawvideo - | python3 -c "
import sys
b=sys.stdin.buffer.read();n=64*48
m=[sum(b[i*n:(i+1)*n])/n for i in range(len(b)//n)]
last=max([i for i,v in enumerate(m) if v<25] or [-1])
print(max(0,(last+1)/4))")
echo "$1 start=$t"
nice ffmpeg -y -loglevel error -ss "$t" -i "$f" -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart /home/main/claude-viz/fs2-revive-$1.mp4
