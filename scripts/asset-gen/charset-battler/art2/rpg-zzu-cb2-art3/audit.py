"""저장된 원화·패킹 시트·GIF를 다시 열어 도트 계약을 검사한다."""
import json
from pathlib import Path
import sys
from PIL import Image, ImageChops
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, OUT_DIR, CAST_DIR, palette

IDS=['actor4-0','actor2-2','actor2-3','actor2-4','actor2-5']
report={}
for cid in IDS:
    root=Path(SRC_DIR)/cid
    pal=set(palette(cid));used=set()
    art=json.loads((root/'_cast_art.json').read_text())
    cast_sheet=Image.open(Path(CAST_DIR)/f'{cid}.png').convert('RGBA')
    combat_sheet=Image.open(Path(OUT_DIR)/f'{cid}.png').convert('RGBA')
    assert cast_sheet.size==(144,336)
    assert combat_sheet.size==(144,384)
    records=[(pid,col,row,combat_sheet) for pid,col,row,_ in POSES]
    records += [(f'cast_{kind}_{step}',step-1,row,cast_sheet) for row,(kind,_) in enumerate(CAST_TYPES) for step in (1,2,3)]
    masks=[]
    for pid,col,row,sheet in records:
        im=Image.open(root/f'{pid}.png').convert('RGBA')
        assert im.size==(48,48),(cid,pid)
        assert set(im.getchannel('A').getdata())<={0,255},(cid,pid)
        assert im.getbbox()[3]==45,(cid,pid,im.getbbox())
        assert sheet.crop((col*48,row*48,col*48+48,row*48+48)).tobytes()==im.tobytes(),(cid,pid,'패킹 불일치')
        used.update(c[:3] for c in im.getdata() if c[3])
        if pid in art['lights']:
            r=art['lights'][pid]
            assert r['count'] in (3,6,9) and len(r['pixels'])==r['count']
            for x,y in r['pixels']:
                assert min(max(abs(x-hx),abs(y-hy)) for hx,hy in r['hands'])<=6,(cid,pid,'빛 위치')
            mask=im.getchannel('A')
            for xy in r['pixels']:mask.putpixel(tuple(xy),0)
            masks.append(mask.tobytes())
    assert len(used-pal)<=6,(cid,used-pal)
    assert len(set(masks))==21,(cid,'동일 시전 실루엣')
    gif=Image.open(root/'_cast.gif')
    assert gif.size==(1344,212) and gif.n_frames==3
    for step in (1,2,3):
        gif.seek(step-1)
        assert gif.info['duration']==160
        frame=gif.convert('RGB')
        for col,(kind,_) in enumerate(CAST_TYPES):
            im=Image.open(root/f'cast_{kind}_{step}.png').convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
            expected=Image.new('RGB',(192,192),(52,56,72));expected.paste(im,(0,0),im)
            actual=frame.crop((col*192,20,col*192+192,212))
            assert not ImageChops.difference(expected,actual).getbbox(),(cid,kind,step,'GIF 픽셀 불일치')
    walk=[Image.open(root/f'walk_{p}.png').tobytes() for p in 'abc']
    assert len(set(walk))==3
    attacks=[Image.open(root/f'{p}.png').tobytes() for p in ('attack_windup','attack_strike','attack','attack_follow')]
    assert len(set(attacks))==4
    report[cid]={'sourceCells':45,'castCells':21,'uniqueCastSilhouettesWithoutLight':21,'combatCells':24,'groundY':44,'alpha':[0,255],'extraColors':sorted(used-pal),'sheetsMatchSources':True,'gif':{'size':[1344,212],'frames':3,'frameMs':160,'exactNearest4x':True},'weapon':art['weapon'],'lightPixelCounts':[3,6,9],'maximumLightDistanceFromHand':6}
    print(cid,'원화 45칸 / 시트 일치 / GIF 픽셀·160ms / 손빛·고유 실루엣 통과')
(HERE/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
