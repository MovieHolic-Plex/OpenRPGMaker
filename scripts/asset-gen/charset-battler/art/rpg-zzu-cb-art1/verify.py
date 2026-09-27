"""저작 결과의 포맷·팔레트·발·정본 걷기·GIF·패킹을 가볍게 확인한다."""
from pathlib import Path
import sys
sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paint import IDS, EXTRA, SEQUENCES
from cb_lib import POSES, SRC_DIR, OUT_DIR, palette, validate, place, walk_frame, build_sheet
from PIL import Image

for cid in IDS:
    folder=Path(SRC_DIR)/cid
    pal=set(palette(cid)); extra=set()
    for pose,*_ in POSES:
        im=Image.open(folder/f'{pose}.png').convert('RGBA')
        assert not validate(cid,pose,im),(cid,pose)
        assert im.getbbox()[3]==45,(cid,pose,'발')
        assert im.getbbox()[0]>0 and im.getbbox()[2]<48,(cid,pose,'가로 여백',im.getbbox())
        assert set(im.getchannel('A').get_flattened_data())<={0,255}
        extra|={c[:3] for c in im.get_flattened_data() if c[3]}-pal
        if pose in ('walk_a','walk_b','walk_c','front'):
            ref=place(walk_frame(cid,'down' if pose=='front' else 'left',1 if pose=='front' else 'abc'.index(pose[-1])))
            assert im.tobytes()==ref.tobytes(),(cid,pose,'원본 보존')
    assert extra<=set(EXTRA) and len(extra)<=6,(cid,extra)
    gif=Image.open(folder/'_motion.gif'); assert gif.n_frames==16
    for frame in range(gif.n_frames):
        gif.seek(frame); assert gif.info['duration']==120
    assert gif.size==(192,212)
    strip=Image.open(folder/'_motion.png'); assert strip.size==(3072,212)
    sheet=Image.open(Path(OUT_DIR)/f'{cid}.png'); assert sheet.size==(144,384)
    expected,report=build_sheet(cid); assert sheet.tobytes()==expected.tobytes()
    print(f'{cid}: 포즈 24 / 원본 그대로 4 / 추가색 {len(extra)} / 여백·바닥·알파 / 시트 / GIF 16×120ms 통과')
