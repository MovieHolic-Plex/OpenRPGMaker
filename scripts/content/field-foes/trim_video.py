"""Cut the chase out of a runtime-QA webm: from the first map frame (after the dark boot loader) to ~2.5 s into battle.
usage: python3 trim_video.py <in.webm> <out.mp4>"""
import subprocess, sys
from PIL import Image, ImageStat

src, dst = sys.argv[1], sys.argv[2]
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).decode())
start = dur - 20
raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{start:.2f}", "-i", src, "-vf", "fps=20,scale=96:54", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
n = len(raw) // (96 * 54 * 3)
first = None
for i in range(n):
    im = Image.frombytes("RGB", (96, 54), raw[i * 96 * 54 * 3:(i + 1) * 96 * 54 * 3])
    r, g, b = ImageStat.Stat(im).mean
    if g > 70 and g > b + 10:  # forest map: bright green; loader screens are near-black
        first = i
        break
if first is None:
    sys.exit("map frame not found")
t0 = start + first / 20 + 0.1
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.2f}", "-i", src, "-t", f"{min(dur - t0, 11.5):.2f}",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", "-an", dst], check=True)
print(dst, f"{t0:.2f}s → {min(dur, t0 + 11.5):.2f}s")
