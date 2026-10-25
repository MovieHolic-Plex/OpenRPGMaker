import sys, os
sys.path.insert(0, '/home/main/z-project/rpg-zzu-village-art/scripts/content/wasteland-ruins')
import wl_all, wl_core as C
from PIL import Image
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
NEW = ['hut-sheet', 'lean-doors', 'hut-tyre', 'shack-2f', 'hut-stove', 'market-shelter', 'wash-line', 'crates-plastic']
OLD = ['shack-a', 'shack-b', 'shack-c', 'lean-to', 'container-home', 'tent-tarp', 'stall-a', 'stall-b', 'crates', 'drums', 'tyres']
im = lambda i: Image.fromarray(C.render(C.PIECES[i]), 'RGBA')
for z, n in ((1, 'new-vs-existing-1x.png'), (3, 'new-vs-existing-3x.png')):
    W = 560
    ims = [im(i) for i in NEW] + [Image.new('RGBA', (W, 4))] + [im(i) for i in OLD]
    C.board(ims, os.path.join(out, n), W=W, z=z, bg=(96, 74, 58, 255))
for i in NEW:
    a = C.gate_array(C.PIECES[i]); g = Image.fromarray(a, 'RGBA')
    bg = Image.new('RGBA', g.size, (96, 74, 58, 255)); bg.alpha_composite(g)
    bg.resize((g.width * 4, g.height * 4), Image.NEAREST).save(os.path.join(out, i + '-gate-4x.png'))
# dense packing demo: new pieces packed tight on dirt at 2x
import wl_ground as G
print(out)
