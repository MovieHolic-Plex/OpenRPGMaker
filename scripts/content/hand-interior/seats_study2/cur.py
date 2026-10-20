# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,importlib
sys.path.insert(0,'/home/main/z-project/rpg-zzu-interior-seats-34/scripts/content/interior-plus')
import loader, iplib
REG=loader.load(['arena']); import arena; importlib.reload(arena)
def r(fn):
    p=dict(REG.pieces['curule seat']); p.pop('_img',None); p['fn']=getattr(arena,fn); return iplib.render(p)
if __name__=='__main__':
    for fn in sys.argv[1:]:
        im=r(fn); im.save(f'/tmp/seats34/study2/atlas/{fn}.png'); print(fn, im.size, im.getbbox())
