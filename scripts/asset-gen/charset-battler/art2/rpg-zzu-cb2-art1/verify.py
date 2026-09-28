"""저장된 담당 시트와 원본 칸·확인용 GIF의 일치를 직접 검사한다."""
from pathlib import Path
import sys, json
sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draw import IDS, EXTRA, HERE
from cb_lib import POSES, CAST_TYPES, SRC_DIR, OUT_DIR, CAST_DIR, palette
from PIL import Image, ImageChops

report={}
for cid in IDS:
    folder=Path(SRC_DIR)/cid
    battle=Image.open(Path(OUT_DIR)/f'{cid}.png').convert('RGBA')
    spells=Image.open(Path(CAST_DIR)/f'{cid}.png').convert('RGBA')
    assert battle.size==(144,384)
    assert spells.size==(144,336)
    cells=[(name,col,row,battle) for name,col,row,_ in POSES]
    cells += [(f'cast_{ct}_{step}',step-1,row,spells) for row,(ct,_) in enumerate(CAST_TYPES) for step in (1,2,3)]
    used=set()
    for name,col,row,sheet in cells:
        im=Image.open(folder/f'{name}.png').convert('RGBA')
        assert im.size==(48,48),(cid,name,'크기')
        assert im.getbbox()[3]==45,(cid,name,'발44')
        assert set(im.getchannel('A').get_flattened_data())=={0,255},(cid,name,'알파')
        assert im.tobytes()==sheet.crop((col*48,row*48,(col+1)*48,(row+1)*48)).tobytes(),(cid,name,'패킹')
        used|={c[:3] for c in im.get_flattened_data() if c[3]}
    extras=used-set(palette(cid))
    assert extras<=set(EXTRA) and len(extras)<=6,(cid,'팔레트')
    gif=Image.open(folder/'_cast.gif')
    assert gif.n_frames==3 and gif.size==(192,1470)
    for step in (1,2,3):
        gif.seek(step-1)
        assert gif.info['duration']==160
        for row,(ct,_) in enumerate(CAST_TYPES):
            source=Image.open(folder/f'cast_{ct}_{step}.png').convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
            expected=Image.new('RGB',(192,192),(42,46,59));expected.paste(source,(0,0),source)
            actual=gif.convert('RGB').crop((0,row*210+18,192,row*210+210))
            assert not ImageChops.difference(expected,actual).getbbox(),(cid,ct,step,'GIF 도트/색')
    report[cid]={'disk_cells':len(cells),'packed_cells_match':True,'gif_frames':3,'frame_ms':160,'nearest_scale':4,'extra_colors':len(extras)}
    print(cid,'디스크 45칸/시트 패킹/GIF 160ms·4배·무손실 통과')
(HERE/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
