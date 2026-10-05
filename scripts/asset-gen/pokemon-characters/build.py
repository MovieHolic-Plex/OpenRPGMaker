#!/usr/bin/env python3
"""Rebuild native characters: adopted original-game hero and hand-authored other roles."""
from pathlib import Path
from PIL import Image
import argparse,json,hashlib
from cast import ROLES,HEADS,palette
from field import render
from portraits import render as portrait,hero_back
from pixels import digest
from hero import PALETTE as HERO_PALETTE

HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True);parser.add_argument('--role',choices=[r.name for r in ROLES]);args=parser.parse_args()
args.out.mkdir(parents=True,exist_ok=True)
# Explicit width/row validation: authoring typos are errors, never cropped or resized.
for name,views in HEADS.items():
 for direction,rows in views.items():
  assert len(rows)==9,(name,direction)
  assert all(len(row)==10 for row in rows),(name,direction,rows)
manifest={'version':2,'author':'Codex / root','method':'python-native-pixel-authoring-with-reference-adoption','referenceAdoption':{'role':'hero','name':'Pokémon Emerald Brendan','source':'https://github.com/pret/pokeemerald/blob/master/graphics/object_events/pics/people/brendan/walking.png','sha256':digest(HERE/'references/brendan-walking.png'),'independentlyAuthored':False},'resizing':False,'quantization':False,'nativeFieldFrame':[16,32],'nativePortraitFrame':[64,64],'sources':{str(p.relative_to(HERE)):digest(p) for p in sorted([*HERE.glob('*.py'),HERE/'references/brendan-walking.png'])},'roles':[],'qualityRequiredRoles':['hero']}
for role in ROLES:
 if args.role and args.role!=role.name:continue
 folder=args.out/role.name;folder.mkdir(exist_ok=True)
 sheet=Image.new('RGBA',(48,128),(0,0,0,0))
 frames=[]
 for row,direction in enumerate(['up','right','down','left']):
  for col in range(3):
   frame=render(role,direction,col);frame.save(folder/f'{direction}-{col}.png');sheet.paste(frame,(col*16,row*32));frames.append(frame)
 sheet.save(folder/'charset.png')
 if role.name=='hero':
  (folder/'origin.txt').write_text('Lossless original-game reference adoption, requested ≥95% identity. Pokémon Emerald Brendan artwork by Nintendo/Game Freak/Creatures, from pret/pokeemerald. Native16x32 cells, background palette index0 transparent, original phase mapping and right-facing horizontal flip. No resizing, recoloring or quantization. NOT independently authored art. Source SHA in authoring.json and references/ATTRIBUTION.md.\n')
 else:
  (folder/'origin.txt').write_text(f'Original native Python pixel artwork, requested by user. Role={role.name}. Every primitive is placed on16x32; four authored head views, planted/swing legs, individual outfit. No image generation, resampling, palette conversion or imported artwork. Source scripts: scripts/asset-gen/pokemon-characters/. Source hashes in authoring.json.\n')
 portrait(role).save(folder/'portrait.png')
 (folder/'portrait-origin.txt').write_text(f'Original independently drawn64x64 Python trainer portrait. Role={role.name}. Artwork authored in portraits.py; not a crop or enlargement of the field sprite and not original Pokemon reference adoption.\n')
 colors={p[:3] for p in sheet.get_flattened_data() if p[3]}
 assert len(colors)<=15
 manifest['roles'].append({'role':role.name,'label':role.label,'charset':str(folder/'charset.png'),'charsetSha256':digest(folder/'charset.png'),'portrait':str(folder/'portrait.png'),'portraitSha256':digest(folder/'portrait.png'),'palette':HERO_PALETTE if role.name=='hero' else palette(role),'opaqueColors':len(colors)})
 # GIF only packs source pixels. Upscaling is performed by CSS in the review UI.
 palette_rgb=sorted(colors);indexes={rgb:i+1 for i,rgb in enumerate(palette_rgb)}
 pal=[0,0,0]+[v for rgb in palette_rgb for v in rgb];pal += [0]*(768-len(pal))
 gifs=[]
 for phase in [0,1,2,1]:
  rgba=Image.new('RGBA',(68,32),(0,0,0,0))
  for row in range(4):rgba.paste(frames[row*3+phase],(row*17,0))
  gif=Image.new('P',rgba.size);gif.putpalette(pal);gif.putdata([indexes[p[:3]] if p[3] else 0 for p in rgba.get_flattened_data()]);gifs.append(gif)
 gifs[0].save(folder/'walk.gif',save_all=True,append_images=gifs[1:],loop=0,duration=130 if role.name=='hero' else 80,transparency=0,background=0,disposal=2,optimize=False)
hero_back(ROLES[0]).save(args.out/'hero_back.png')
professor=next(r for r in ROLES if r.name=='professor')
clip=Image.new('RGBA',(384,64),(0,0,0,0))
for i,gesture in enumerate(['neutral','blink','talk','explain','beacon','farewell']):
 frame=portrait(professor,gesture);frame.save(args.out/f'professor-pose-{i}.png');clip.paste(frame,(i*64,0))
clip.save(args.out/'professor-clip.png')
(args.out/'professor-origin.txt').write_text('Native64x64 original Python professor poses: neutral, blink, talk, open palm, orb, wave. Source scripts: scripts/asset-gen/pokemon-characters/portraits.py. All poses share one unchanged stance and head anchor; arms, face and props are drawn at their final integer coordinates. No image generator, resize, grid inference or quantization.\n')
(args.out/'hero-back-origin.txt').write_text('Original64x64 Python waist-up player back. Every pixel cluster authored in portraits.py at its final native size; no enlargement of field sprite.\n')
manifest['professorClip']={'file':str(args.out/'professor-clip.png'),'sha256':digest(args.out/'professor-clip.png'),'frameSize':[64,64],'frameCount':6}
manifest['heroBack']={'file':str(args.out/'hero_back.png'),'sha256':digest(args.out/'hero_back.png')}
(args.out/'authoring.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'out':str(args.out),'roles':len(manifest['roles']),'method':manifest['method']}))
