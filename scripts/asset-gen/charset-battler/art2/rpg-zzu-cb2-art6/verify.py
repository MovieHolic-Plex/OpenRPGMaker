"""저장된 셀·배포 시트·GIF를 다시 읽어 도트 계약과 패킹을 확인한다."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, OUT_DIR, CAST_DIR, palette

report={}
for n in range(2,8):
    cid=f'actor4-{n}';directory=Path(SRC_DIR)/cid
    native=set(palette(cid));extra=set();checks=0
    sheet=Image.open(Path(OUT_DIR)/f'{cid}.png').convert('RGBA')
    cast_sheet=Image.open(Path(CAST_DIR)/f'{cid}.png').convert('RGBA')
    assert sheet.size==(144,384)
    assert cast_sheet.size==(144,336)
    coords=[(pid,col,row,sheet) for pid,col,row,_ in POSES]
    coords += [(f'cast_{ct}_{step}',step-1,row,cast_sheet)
               for row,(ct,_) in enumerate(CAST_TYPES) for step in (1,2,3)]
    unique=[];silhouettes=[]
    for key,col,row,atlas in coords:
        im=Image.open(directory/f'{key}.png').convert('RGBA')
        assert im.size==(48,48),(cid,key)
        assert {p[3] for p in im.getdata()}<={0,255},(cid,key)
        assert im.getbbox()[3]==45,(cid,key,im.getbbox())
        assert im.tobytes()==atlas.crop((col*48,row*48,col*48+48,row*48+48)).tobytes(),(cid,key)
        colors={p[:3] for p in im.getdata() if p[3]}
        extra |= colors-native
        if key.startswith('cast_') and key.rsplit('_',1)[-1].isdigit():
            unique.append(im.tobytes());silhouettes.append(im.getchannel('A').tobytes())
            # 새 빛 색은 손 주위에만 있으며 하나의 셀에서 9픽셀을 넘지 않는다.
            lit=[(x,y) for y in range(48) for x in range(48)
                 if im.getpixel((x,y))[3] and im.getpixel((x,y))[:3] not in native]
            assert len(lit)<=9,(cid,key,len(lit))
            grip=json.loads((HERE/'audit.json').read_text())[cid]['poses'][key]['glow_hand']
            assert all(max(abs(x-grip[0]),abs(y-grip[1]))<=4 for x,y in lit),(cid,key)
            assert im.getbbox()[0]>0 and im.getbbox()[2]<48,(cid,key,'가장자리 잘림')
        checks+=1
    assert len(extra)==6,(cid,extra)
    assert len(set(unique))==21 and len(set(silhouettes))==21,cid
    gif=Image.open(directory/'_cast.gif')
    assert gif.n_frames==21 and gif.size==(192,212),cid
    for i in range(21):
        gif.seek(i)
        assert gif.info['duration']==160,(cid,i)
        ct=CAST_TYPES[i//3][0];step=i%3+1
        expected=Image.new('RGB',(192,212),(43,47,60))
        ImageDraw.Draw(expected).text((6,3),f'{ct} {step}',fill=(235,237,245))
        cell=Image.open(directory/f'cast_{ct}_{step}.png').convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
        expected.paste(cell,(0,20),cell)
        assert gif.convert('RGB').tobytes()==expected.tobytes(),(cid,i,'GIF 팔레트/순서')
    parallel=Image.open(directory/'_cast_parallel.gif')
    assert parallel.n_frames==3 and parallel.size==(1344,212),cid
    report[cid]=dict(cells=checks,cast_frames=21,unique_silhouettes=21,extra_colors=len(extra),
                    ground_row=44,alpha=[0,255],sheet_matches=True,gif_frames=21,
                    gif_ms=160,gif_scale=4,gif_pixels_exact=True)
    print(cid,'45칸·시트 일치·시전 21 실루엣·GIF 21×160ms 통과')
(HERE/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
