"""Validate gallery deliverables and package them without raw fixtures or screenshot frames."""
from pathlib import Path
from PIL import Image
import json, zipfile, subprocess
root=Path('.omo/evidence/atmosphere-30')
catalog=json.loads((root/'catalog.json').read_text())
assert len(catalog)==30 and len({p['id'] for p in catalog})==30
results=[]
for p in catalog:
    receipt=json.loads((root/p['id']/'receipt.json').read_text())
    assert receipt['errors']==[] and receipt['frames']==60
    assert any(s['rms']>0.00001 for s in receipt['samples'])
    assert all(s['state']=='running' and s['peak']<0.99 for s in receipt['samples'])
    results.append(receipt)
gifs=[]
for path in sorted(root.glob('*.gif')):
    image=Image.open(path)
    duration=0
    for i in range(image.n_frames):
        image.seek(i);duration+=image.info.get('duration',0)
    assert image.n_frames==60 and duration==5760,(path,image.n_frames,duration)
    gifs.append({'file':path.name,'frames':image.n_frames,'durationMs':duration,'size':image.size})
assert len(gifs)==36
for p in catalog:
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(root/(p['id']+'.mp3'))]).decode().strip())
    assert duration>1.5,(p['id'],duration)
page=root/'gallery.html'
assert page.exists()
markup=page.read_text()
assert markup.count('<audio controls')==30
# Keep listening comparisons manageable: only the selected clip plays.
markup=markup.replace('</main></html>','</main><script>document.addEventListener("play",event=>{if(event.target.tagName==="AUDIO")document.querySelectorAll("audio").forEach(a=>{if(a!==event.target)a.pause()})},true)</script></html>')
page.write_text(markup)
(root/'SUMMARY.json').write_text(json.dumps({'presetCount':30,'gifs':gifs,'captures':results},ensure_ascii=False,indent=2))
archive=root/'atmosphere-30-gallery.zip'
files=[page,root/'README.md',root/'catalog.json',root/'SUMMARY.json',*root.glob('*.gif'),*root.glob('*.mp3'),*root.glob('*/receipt.json')]
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as z:
    for file in files:z.write(file,file.relative_to(root))
print(f'Validated 30 presets, 36 GIFs, 30 audio clips. Package: {archive} ({archive.stat().st_size/1024/1024:.1f} MiB)')
