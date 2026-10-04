#!/usr/bin/env python3
"""Promote a reviewed group's native cell metadata and precise asset bounds.

No project store writes; resource IDs and paths remain stable. Root runs this
after viewing exported pictures, never as a substitute for visual review.
"""
from pathlib import Path
import json, re, sys, hashlib
from PIL import Image
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
KEEP={'hydra-three','kappa-01','wolf-grey','bat-cave','skeleton-knight'}

def dump(path,value,compact=False):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=None if compact else 2,
                                separators=(',',':') if compact else None)+'\n')

def integrate(group):
    targets={e['slug']:e for e in json.loads((HERE/'manifest.json').read_text()) if e['group']==group and e['slug'] not in KEEP}
    report_path=ROOT/'verify-shots/monster-redraw-all'/group/'report.json'
    reports=json.loads(report_path.read_text())
    assert set(targets)=={r['slug'] for r in reports}
    descriptions=json.loads((HERE/(group+'-descriptions.json')).read_text())
    assert set(descriptions)>=set(targets),('missing descriptions',set(targets)-set(descriptions))
    metadata_path=ROOT/'src/assets/pixelEnemySheets.ts';metadata=metadata_path.read_text()
    catalog_path=ROOT/'src/assets/monsterCatalogData.json';catalog=json.loads(catalog_path.read_text())
    review_path=ROOT/'src/assets/monsterCatalogReview.json';review=json.loads(review_path.read_text())
    bounds_path=ROOT/'src/assets/battleContactBounds.json';bounds=json.loads(bounds_path.read_text())
    manifest_path=HERE.parent/'refresh/manifest.json';manifest=json.loads(manifest_path.read_text())
    for r in reports:
        slug=r['slug'];e=targets[slug];cell=e['cell']
        assert r['cell']==cell
        asset=ROOT/'public'/e['path']
        assert hashlib.sha256(asset.read_bytes()).hexdigest()==r['sheetSha256']
        old=next(v for v in manifest if v['slug']==slug);old['cell']=cell
        rows=metadata.splitlines();count=0
        for i,line in enumerate(rows):
            if 'path: "'+e['path']+'"' not in line:continue
            count+=1
            if re.search(r'cell: \d+',line):line=re.sub(r'cell: \d+',f'cell: {cell}',line)
            else:line=line.replace('motion:',f'cell: {cell}, motion:')
            rows[i]=line
        assert count==1,(slug,'metadata',count)
        metadata='\n'.join(rows)+'\n'
        catalog[e['resourceId']]['description']=descriptions[slug]
        review['entries'][e['resourceId']].update(sha256=r['portraitSha256'],nativeSheet=e['path'],
            nativeSheetSha256=r['sheetSha256'],cell=cell,observation=descriptions[slug],
            sourceWorkingTree=True,reviewEvidence='verify-shots/monster-redraw-all/SUMMARY.md',
            inspectionMethod='Fresh native pixel anatomy and all nine poses. Locally reviewed artwork; user acceptance is not implied.')
        bounds[e['path']]={'sha256':r['sheetSha256'],'cell':cell,
            **{k:[round(v/cell,6) for v in r['frames'][p]['bbox']] for k,p in [('idle','idle_a'),('strike','attack'),('attack','attack')]}}
        wrapper=HERE.parent/(slug+'.py')
        if wrapper.exists() and 'from registry import draw_entry' in wrapper.read_text():
            source=re.sub(r'CELL ?= ?\d+',f'CELL = {cell}',wrapper.read_text())
            source=re.sub(r'The editable drawing source is refresh/\w+\.py; old geometry is retired\.',
                          f'The editable drawing source is redraw/{group}.py; earlier geometry is retired.',source)
            wrapper.write_text(source)
    dump(manifest_path,manifest);dump(catalog_path,catalog);dump(review_path,review);dump(bounds_path,bounds,True)
    metadata_path.write_text(metadata)
    print(group,len(reports),'species integrated')

if __name__=='__main__':integrate(sys.argv[1])
