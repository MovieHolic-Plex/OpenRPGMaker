"""그림 납품 파일의 셀·팔레트·시퀀스 계약을 검사한다. 앱 테스트를 실행하지 않는다."""
from pathlib import Path
import sys, json, hashlib
sys.dont_write_bytecode = True
from PIL import Image
from draw import Artist, CONFIG, EXTRA, POSES, SRC_DIR, SEQUENCES, TOOL, place, walk_frame

report={}
for n in CONFIG:
    a=Artist(n); directory=Path(SRC_DIR)/a.cid
    sheet=Image.open(TOOL.parents[2]/'public/assets/generated/charset-battlers'/f'{a.cid}.png').convert('RGBA')
    assert sheet.size==(144,384)
    colors=set(); hashes=set(); all_ground=[]
    for pose,col,row,_ in POSES:
        im=Image.open(directory/f'{pose}.png').convert('RGBA')
        assert im.size==(48,48),(a.cid,pose)
        assert set(im.getchannel('A').get_flattened_data())<={0,255},(a.cid,pose,'알파')
        assert im.getbbox()[3]==45,(a.cid,pose,'기준선')
        all_ground.append(im.getbbox()[3]-1)
        assert im.tobytes()==sheet.crop((col*48,row*48,col*48+48,row*48+48)).tobytes(),(a.cid,pose,'시트 좌표')
        colors.update(c[:3] for c in im.get_flattened_data() if c[3])
        hashes.add(hashlib.sha256(im.tobytes()).hexdigest())
        if pose.startswith('walk_'):
            assert im.tobytes()==place(walk_frame(a.cid,'left','abc'.index(pose[-1]))).tobytes(),(a.cid,pose,'원본 걷기')
        if pose=='front':
            assert im.tobytes()==place(walk_frame(a.cid,'down',1)).tobytes(),(a.cid,pose,'원본 정면')
    added=colors-set(a.colors)
    assert len(added)<=6 and added<=set(EXTRA),(a.cid,'추가색')
    assert len(hashes)==24,(a.cid,'중복 포즈')
    sequence=[p for _,frames in SEQUENCES for p in frames]
    strip=Image.open(directory/'_motion.png').convert('RGB')
    assert strip.size==(192*len(sequence),212)
    gif=Image.open(directory/'_motion.gif')
    assert gif.n_frames==len(sequence)==16
    for i,pose in enumerate(sequence):
        gif.seek(i)
        assert gif.info['duration']==120,(a.cid,i,'GIF 간격')
        assert gif.convert('RGB').tobytes()==strip.crop((192*i,0,192*(i+1),212)).tobytes(),(a.cid,i,'GIF 순서')
        expected=Image.new('RGB',(192,192),(43,47,60))
        cell=Image.open(directory/f'{pose}.png').convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
        expected.paste(cell,(0,0),cell)
        assert expected.tobytes()==strip.crop((192*i,20,192*(i+1),212)).tobytes(),(a.cid,i,'4배 최근접')
    report[a.cid]={'poses':24,'redrawn':20,'source_walk_and_front':4,'ground_y':sorted(set(all_ground)),'extra_colors':sorted(added),'unique_poses':len(hashes),'sheet_size':list(sheet.size),'gif_frames':gif.n_frames,'duration_ms':120,'motion_order':sequence,'all_checks':'통과'}
    print(f'{a.cid}: 셀·색상·기준선·시트 좌표·원본 걷기·GIF 16칸 통과')
Path(__file__).with_name('audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
