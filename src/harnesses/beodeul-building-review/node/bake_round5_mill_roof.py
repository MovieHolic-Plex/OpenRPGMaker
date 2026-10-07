"""Bake the mill's authored roof grid; retain the old body's exact RGBA pixels."""
import json,hashlib
from PIL import Image
from native_author import ROOT,native

def main():
 record=json.loads((ROOT/'harness-data/beodeul-building-review/round5-mill-roof.json').read_text())
 im=native(record['oldRecipe']['components'][0]['source']);body=im.crop((0,56,64,144)).tobytes()
 palette={key:tuple(bytes.fromhex(value)) for key,value in record['roofPalette'].items()}
 assert len(record['roofRows'])==56
 for y,row in enumerate(record['roofRows']):
  assert len(row)==64
  for x,value in enumerate(row):im.putpixel((x,y),palette[value])
 assert im.crop((0,56,64,144)).tobytes()==body
 path=ROOT/'public/assets/beodeul-architecture/review-r5-mill-round-roof.png';im.save(path)
 expected=record['newRecipe']['nativeAssetHashes']['review-r5-mill-round-roof'];assert hashlib.sha256(path.read_bytes()).hexdigest()==expected
 print('roof grid baked; body below y56 unchanged; source SHA matches')
if __name__=='__main__':main()
