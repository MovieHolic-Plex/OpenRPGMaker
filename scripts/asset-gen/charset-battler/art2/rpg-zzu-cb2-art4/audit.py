"""저장된 원본/시트/GIF를 다시 읽어 도트 계약과 포장 결과를 비교한다."""
from pathlib import Path
import hashlib
import itertools
import json
import sys
from PIL import Image, ImageChops, ImageSequence

sys.dont_write_bytecode = True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, OUT_DIR, CAST_DIR, palette

IDS=['actor2-6','actor2-7','actor3-1','actor3-2','actor3-3']
report={}
for cid in IDS:
    src=Path(SRC_DIR)/cid
    pal=set(palette(cid));used=set();masks={};pixel_differences=[]
    validation=json.loads((src/'_validation.json').read_text())
    sheets=[(Image.open(Path(OUT_DIR)/(cid+'.png')).convert('RGBA'),(144,384),[(p,c,r) for p,c,r,_ in POSES]),
      (Image.open(Path(CAST_DIR)/(cid+'.png')).convert('RGBA'),(144,336),
       [(f'cast_{ct}_{step}',step-1,r) for r,(ct,_) in enumerate(CAST_TYPES) for step in (1,2,3)])]
    for sheet,size,slots in sheets:
        assert sheet.size==size,(cid,sheet.size)
        for name,col,row in slots:
            im=Image.open(src/(name+'.png')).convert('RGBA')
            assert im.size==(48,48)
            assert set(im.getchannel('A').getdata())=={0,255}
            assert im.getbbox()[3]==45,(cid,name,'접지')
            assert hashlib.sha256(im.tobytes()).hexdigest()==validation['poses'][name]['sha256']
            used|={c[:3] for c in im.getdata() if c[3]}
            assert im.tobytes()==sheet.crop((48*col,48*row,48*(col+1),48*(row+1))).tobytes(),(cid,name,'포장 불일치')
            if name in validation['castJoints']:
                detail=validation['castJoints'][name]
                assert 1<=len(detail['light'])<=9
                hx,hy=detail['hand']
                assert all(max(abs(x-hx),abs(y-hy))<=6 for x,y in detail['light'])
                assert 0<im.getbbox()[0] and im.getbbox()[2]<48,(cid,name,'셀 경계 잘림')
                mask=im.getchannel('A')
                for p in detail['light']:mask.putpixel(tuple(p),0)
                masks[name]=mask
    assert len(used-pal)<=6,(cid,'추가색',used-pal)
    # 빛을 지운 실루엣도 단계별 일곱 종류가 모두 다르고, 각 종류의 세 칸이 다르다.
    for step in (1,2,3):
        names=[f'cast_{ct}_{step}' for ct,_ in CAST_TYPES]
        assert len({masks[n].tobytes() for n in names})==7
        for a,b in itertools.combinations(names,2):
            difference=ImageChops.difference(masks[a],masks[b])
            pixel_differences.append(sum(p>0 for p in difference.getdata()))
    for ct,_ in CAST_TYPES:
        normalized=[]
        for step in (1,2,3):
            mask=masks[f'cast_{ct}_{step}'];cut=mask.crop(mask.getbbox())
            normalized.append((cut.size,cut.tobytes()))
        assert len(set(normalized))==3,(cid,ct,'단순 위치 이동')
    gif=Image.open(src/'_cast.gif')
    assert gif.size==(1344,210) and gif.n_frames==3
    durations=[fr.info['duration'] for fr in ImageSequence.Iterator(gif)]
    assert durations==[160,160,160]
    report[cid]=dict(cells=45,castCells=21,extraColors=len(used-pal),groundY=44,
        sheetPixelMatch=True,castSilhouettesPerStep=7,minSilhouetteDifferencePixels=min(pixel_differences),
        gifSize=list(gif.size),gifDurationsMs=durations,handLightPixels=[3,5,9])
(HERE/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('225칸 / 시트 10장 / GIF 5개 재읽기 검사 통과')
print(json.dumps(report,ensure_ascii=False,indent=2))
