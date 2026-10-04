# 우리 쪽 후보 그림을 PNG 로 굽는다(우리 그림이라 저장소 커밋 가능). REFMAP 은 여기서 다루지 않는다.
# 저장소 루트에서: python3 scripts/content/pixel-harness/export_ours.py
#   → tiledata/pixel-harness/ours/refmap32-<소품>.png (refmap-study 32px 견본 소품 16종)
#   → tiledata/pixel-harness/ours/refmap32-room-empty.png (소품 없는 방: 벽·바닥·천장 테·문)
#   → tiledata/pixel-harness/ours/refmap32-room.png (소품 놓은 방)
import os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
STUDY = os.path.join(ROOT, 'tiledata/hand-interior/refmap-study')
OUT = os.path.join(ROOT, 'tiledata/pixel-harness/ours')
sys.path.insert(0, STUDY)

def main():
    os.makedirs(OUT, exist_ok=True)
    cwd = os.getcwd(); os.chdir(ROOT)
    try:
        import propsr, roomr
        for k, p in propsr.all_props().items():
            p.im.save(os.path.join(OUT, f"refmap32-{k.replace(' ', '-')}.png"))
        roomr.render().save(os.path.join(OUT, 'refmap32-room-empty.png'))
        roomr.room().save(os.path.join(OUT, 'refmap32-room.png'))
    finally:
        os.chdir(cwd)
    print('ok', sorted(os.listdir(OUT)))

if __name__ == '__main__':
    main()
