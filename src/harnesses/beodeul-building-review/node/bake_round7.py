"""Reproduce the 25 candidates from retained explicit final palette grids."""
from PIL import Image
import json,hashlib
from native_author import ROOT

def main():
 records=json.loads((ROOT/'harness-data/beodeul-building-review/round7-detail-sources.json').read_text())
 assert len(records)==25
 for r in records:
  palette={k:tuple(bytes.fromhex(v)) for k,v in r['palette'].items()}
  im=Image.new('RGBA',(r['width'],r['height']))
  assert len(r['rows'])==r['height'] and r['width']%16==r['height']%16==0
  for y,row in enumerate(r['rows']):
   cells=row.split();assert len(cells)==r['width']
   for x,c in enumerate(cells):im.putpixel((x,y),palette[c])
  p=ROOT/'public/assets/beodeul-architecture'/('review-'+r['id']+'.png')
  im.save(p);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sourcePngHash']
 print('25 final grids reproduced; source PNG hashes match')
if __name__=='__main__':main()
