"""Astra professor dialogue bust, round 3 (2026-10-24 「다 별론데, 기존 다른 포트레잇과 비교해서 괜찮게」).
Same method as the rest of the cast (scripts/content/monsters/bake_astra_busts64.py): char-gen `command` image engine
(private codex image route) with the cast's own 'nat' prompt skeleton (48x48 art-pixel GBA bust, magenta background).
Differences from the 2026-10-23 professor: the reference sheet is two finished cast busts (style) + the walking sprite (identity),
and the identity line drops the glasses/stubble the walking sprite does not have and asks for a kind man about 50.
  python3 gen.py <variant: nat|sml> <out.png> [ref.png]
  python3 genx.py <base_raw.png> <happy|sad|angry|surprised> <out.png>
"""
import os, sys, time
from pathlib import Path
sys.path.insert(0, '/home/main/char-gen-public')
from chargen import imagegen
HERE = Path(__file__).resolve().parent
os.environ.setdefault('CHARGEN_IMAGE_CMD', f'python3 {HERE / "kaykai_cmd.py"} {{prompt}} {{ref}} {{out}} {{size}}')
var, out = sys.argv[1], sys.argv[2]
ref = Path(sys.argv[3] if len(sys.argv) > 3 else os.path.expanduser('~/astra-qa/prof3/ref-professor.png'))
STYLE = {
 'nat': "Draw it as a REAL low-resolution pixel-art sprite: the whole square picture is a grid of exactly 48 x 48 art pixels, each art pixel a solid flat square of one colour about 21 screen pixels wide (no anti-aliasing, no gradients, no dithering, no texture, no sub-pixel detail). At this tiny size every feature is placed pixel by pixel like a Game Boy Advance dialogue portrait: each eye about 4 art pixels wide and 5 tall (dark lash row on top, coloured iris, one white highlight pixel, a white pixel at the outer corner), eyebrows 3-4 pixels, the mouth 3-4 pixels, the nose one shadow pixel, a 1-pixel dark outline around the silhouette. The head (hair top to chin) is about 36 art pixels tall and fills the frame; shoulders run off the bottom edge.",
 'sml': "Draw it as a REAL low-resolution pixel-art sprite: the whole square picture is a grid of exactly 40 x 40 art pixels, each art pixel a solid flat square of one colour about 26 screen pixels wide (no anti-aliasing, no gradients, no dithering, no texture, no sub-pixel detail). At this tiny size every feature is placed pixel by pixel like a Game Boy Advance dialogue portrait: each eye about 4 art pixels wide and 5 tall (dark lash row on top, coloured iris, one white highlight pixel, a white pixel at the outer corner), eyebrows 3-4 pixels, the mouth 3-4 pixels, the nose one shadow pixel, a 1-pixel dark outline around the silhouette. The whole head INCLUDING all of the hair fits inside the picture with a 1-pixel margin at the top and sides; the head is about 30 art pixels tall; the collar and the top of the shoulders show at the bottom.",
}[var.rstrip('0123456789')]
AGE = os.environ.get('PROF_AGE') == 'older'
WHO = ("the professor, a kind, gentle scientist about 50 years old, clean-shaven (NO beard, NO stubble, NO moustache), NO glasses. "
       "Medium brown hair in a few big soft messy locks with one small cowlick on top, light grey hair at both temples, blue eyes, "
       "a warm calm smile, one or two tiny smile-line pixels at the outer eye corners (that is the only sign of age; no wrinkles elsewhere). "
       "White lab coat with wide lapels over a dark navy shirt, a small gold star badge on the chest.")
if AGE:
    WHO += (" He must read clearly as a middle-aged father figure, older than the mother in the reference, never as a teenager: "
            "a slightly longer face and a squarer jaw than the young characters, eyes a little narrower and calmer (iris 3 pixels tall, not 5), "
            "thicker straight eyebrows, the grey at the temples clearly visible, a relaxed gentle closed-mouth smile.")
prompt = f"""A dialogue portrait (head and shoulders, bust) of ONE character for a cute, friendly handheld monster-collecting RPG. {STYLE}
Look: friendly, warm, appealing, a little cute (not realistic, not semi-real, no detailed skin, no nose bridge, no lips, no teeth, no cheekbones, no beard stubble). Rounded soft face with a short rounded chin and a short neck. Head large in the frame (the head fills the top two thirds; the top of the hair is fully inside the picture with a small margin; shoulders run off the bottom edge). FRONT view, facing the viewer, at most a very slight turn, both eyes the same size and level. Big, friendly eyes (each about a fifth of the face width and taller than wide): dark upper lash line, a clearly coloured iris, a small white of the eye, and ONE white highlight; both eyes fully visible, no hair covering the eyes or brows; simple short eyebrows; nose = at most one tiny shadow mark; mouth = a short simple line, closed, gently smiling. Skin: one flat light tone and one flat shadow tone only. Hair: a few big solid locks with 3 tones and a dark outline. Clothes simple flat shapes, same colours as the reference.
Reference picture: the LEFT TWO portraits are other characters from the SAME game - copy their drawing style exactly (pixel size, outline colour and weight, eye construction, hair locks, flat shading, framing and head size); do NOT copy their identity. The small walking sprite on the RIGHT is THIS person - match his hair, colours and clothes.
Identity: {WHO}
Background: flat solid pure magenta #FF00FF everywhere outside the character. Square picture, the character centred. No text, no frame, no border, no props, nothing in the hands, no extra characters."""
Path(out).parent.mkdir(parents=True, exist_ok=True)
Path(out + '.prompt.txt').write_text(prompt)
t = time.time()
imagegen.generate('command', prompt, ref, Path(out), size='1024x1024')
print('done', var, out, round(time.time() - t), 's')
