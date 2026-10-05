from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
PALETTE=json.loads((ROOT/'palette.json').read_text())
def author(name, start, rows, directory='poses', patches=()):
    canvas=[list('.'*64) for _ in range(64)]
    for y, row in enumerate(rows.strip().splitlines(),start):
        x, pixels=row.strip().split(' ',1)
        x=int(x)
        assert 1<=x and x+len(pixels)<=63,(name,y,x,pixels)
        canvas[y][x:x+len(pixels)]=pixels
    for x,y,pixels in patches:
        assert 1<=x and x+len(pixels)<=63
        canvas[y][x:x+len(pixels)]=pixels
    path=ROOT/directory/(name+'.pxgrid')
    path.parent.mkdir(exist_ok=True)
    path.write_text('\n'.join(''.join(r) for r in canvas)+'\n')
def decode(path):
    rows=path.read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows),path
    assert all(c=='.' or c in PALETTE for row in rows for c in row),path
    assert all(c=='.' for c in rows[0]+rows[61]+rows[62]+rows[63]),path
    assert all(r[0]==r[63]=='.' for r in rows),path
    im=Image.new('RGBA',(64,64))
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c!='.': im.putpixel((x,y),tuple(bytes.fromhex(PALETTE[c][1:]))+(255,))
    return im

author('idle_a',8,'''
27 OOOOOOOOO
25 OHHJJJHHHHOO
24 OHJJJHHHHHHHHO
24 OHJJHHHHHHHHHHO
23 OHHHHHHHHHHHHOHO
23 OHHHHHHHHHHHTTTO
23 OHHHHHHHHHTUUUTTO
23 OHHHHHHHTUUUUUTTO
23 OHHHHHHTTUUSUTSSTO
23 OHHHHHTUUUUUUUUUTO
24 OHHHHTUUUVOUUVOUTO
24 OHHHHTUUUTTUUTTTTO
24 OHHHHTUUUTTUUTTTTO
24 OHHHHTTTTTUUUTTTSO
24 OHHHHSDEEEFFETTSO
23 OHJHHODEEEFFFEESO
23 OHJHHOODDEEEEDDO
23 OJHJO..ONNPPNNMO
23 OHJHO.ONPPPNNMMDO
22 OHJHOODGGIFFDNMDEO
22 OJHJOFGGGIFFEDDDDEO
22 OHHOFIGGGFFEDDDEFFEO..........VW
21 OHJOGIIGGFFEDEEFGGFO...........VWV
21 OJHOGIIGFFEDEEFFFFFEO.........VWV
21 OHOFIIGFFEDDEEFFEEDO.........VWV
21 OHOFGGFFEDDEEFFEDO..........VWV
22 OHOFGFFEDDEEFFEDO........VWV
22 ONOFEEDDEEFFEDO.........VWV
23 OPOEDDEEFFDDDO.........VWV
24 OODDEEFDDDEFO........VWV
25 ODEEFFDDEEFFO.......VWV
25 OEEFFDDEEFFFO.....OVWK
25 ODEDDDDDEFFIVUTVOOVKO
25 ODDMNNNMDEEIUTTSOHHO
25 ODMNPPPNMMDEOSSO
25 ODEEEEDDDEFIIVUTO
25 OEFGGFEDDEFFUTSSOJKK
24 OEFGGFEDDEFFFOOO..KVV
24 OFGGFFEDDEFFFO..KVV
23 OEFGFFEDOEEFFFO...KVV
23 OFGFFEDO.OEFFFO....KVV
22 OEFGFFEO..OEFFFO....KVW
22 OFGFFEDO..OEFGFO.....KW
22 OFGFEDO....OFGFO
22 OEFFEDO....OFGFO
22 OEFEDO.....OFEFO
23 ODDEO......ODEDO
23 OHJHO......OHJHO
23 OHJHO......OHHHHO
22 OHJJHO......OHJHHO
21 OHHHHHO.....OHHHHHO
21 OHOOOOO.....OHOOOOO
21 OOOOOOO.....OOOOOOO
''')
if __name__=='__main__':
    idle=decode(ROOT/'poses/idle_a.pxgrid')
    idle.save(ROOT/'progress/idle.png')
    idle.resize((512,512),Image.Resampling.NEAREST).save(ROOT/'progress/idle-8x.png')
    idle.crop((21,7,46,30)).resize((200,184),Image.Resampling.NEAREST).save(ROOT/'progress/face.png')
