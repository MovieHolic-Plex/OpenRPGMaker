"""Lossless adapter: approved32x32 frames -> runtime24x32 cells.
Only four fully transparent columns on each side are removed, never ink pixels.
"""
from pathlib import Path
from PIL import Image
import sys,json,hashlib
source,target=map(Path,sys.argv[1:3]);native=Image.open(source).convert('RGBA')
assert native.size==(96,128)
sheet=Image.new('RGBA',(288,256));compared=0
# Native rows down/left/right/up; runtime rows up/right/down/left.
for dest_row,source_row in enumerate([3,2,0,1]):
 for pose in range(3):
  frame=native.crop((pose*32,source_row*32,pose*32+32,source_row*32+32))
  assert frame.crop((0,0,4,32)).getchannel('A').getbbox() is None
  assert frame.crop((28,0,32,32)).getchannel('A').getbbox() is None
  cell=frame.crop((4,0,28,32));recovered=Image.new('RGBA',(32,32));recovered.paste(cell,(4,0))
  assert recovered.tobytes()==frame.tobytes(), 'Native pixels changed'
  compared+=32*32;sheet.paste(cell,(pose*24,dest_row*32))
target.parent.mkdir(parents=True,exist_ok=True);sheet.save(target)
print(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'adapterSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'native':[32,32],'runtimeCell':[24,32],'sheet':[288,256],'nativePixelsCompared':compared,'lossless':True,'removedTransparentColumns':[4,4],'sourceAnchor':[16,32],'runtimeAnchor':[12,32]}))
