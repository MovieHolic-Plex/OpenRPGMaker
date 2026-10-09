"""Reproduce the ten candidates from retained explicit final pixel grids."""
from PIL import Image
import json,hashlib
from native_author import ROOT

def main():
 records=json.loads((ROOT/'harness-data/beodeul-building-review/round6-detail-sources.json').read_text())
 assert len(records)==10
 for r in records:
  palette={k:tuple(bytes.fromhex(v)) for k,v in r['palette'].items()};im=Image.new('RGBA',(r['width'],r['height']));assert len(r['rows'])==r['height']
  for y,row in enumerate(r['rows']):
   assert len(row)==r['width']
   for x,c in enumerate(row):im.putpixel((x,y),palette[c])
  p=ROOT/'public/assets/beodeul-architecture'/('review-'+r['id']+'.png');im.save(p);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sourcePngHash']
 print('10 final grids reproduced; source PNG hashes match')
if __name__=='__main__':main()
