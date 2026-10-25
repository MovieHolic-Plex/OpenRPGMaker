"""expression edit of a picked base candidate through char-gen's image engine. usage: genx.py <base_raw.png> <expr> <out.png>"""
import sys, os, time
sys.path.insert(0, '/home/main/char-gen-public')
from pathlib import Path
from chargen import imagegen
os.environ.setdefault('CHARGEN_IMAGE_CMD', f'python3 {Path(__file__).resolve().parent / "kaykai_cmd.py"} {{prompt}} {{ref}} {{out}} {{size}}')
base, expr, out = sys.argv[1:4]
DESC = {
 'happy': 'HAPPY: a big cheerful smile with the mouth open (a small open D-shaped mouth showing a little red inside), the eyes closed into happy upward arcs (^ ^), eyebrows raised and relaxed, a light blush on the cheeks',
 'sad': 'SAD: eyebrows slanted up toward the middle of the forehead, the eyes half-lidded and looking a little down, the mouth a small downturned frown',
 'angry': 'ANGRY / DETERMINED: eyebrows slanted sharply down toward the nose, narrowed eyes with the iris still visible, the mouth a tense frown, set jaw',
 'surprised': 'SURPRISED: eyebrows raised high, the eyes wide open and round with small pupils and more white showing, the mouth a small open round "O"',
 'serious': 'SERIOUS: flat straight eyebrows lowered slightly, calm steady eyes, the mouth a short firm straight line (not smiling)',
}[expr]
prompt = f"""Edit the attached pixel-art dialogue portrait. Return the SAME picture: identical square size, identical pixel grid (same art-pixel size), identical framing and position, identical hair, clothes, colours and the same flat magenta #FF00FF background. Change ONLY the facial expression - the eyebrows, the eyes and the mouth - to: {DESC}.
Keep the same clean, friendly Game Boy Advance style: each feature drawn with a few solid square pixels, no extra lines, no shading noise, no tears, no sweat drops, no symbols, no text."""
t = time.time()
imagegen.generate('command', prompt, Path(base), Path(out), size='1024x1024')
print('done', base, expr, round(time.time() - t), 's')
