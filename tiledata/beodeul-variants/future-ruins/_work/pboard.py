import sys, os, json; sys.path.insert(0,'.'); sys.path.insert(0,'_work')
from PIL import Image
from board import board
meta=json.load(open('partmeta.json'))
items=[(n, Image.open('parts/%s.png'%n)) for n in meta]
board(items[:20],'_work/pb1.png',scale=2,cols=5)
board(items[20:44],'_work/pb2.png',scale=3,cols=8)
board(items[44:],'_work/pb3.png',scale=4,cols=7)
