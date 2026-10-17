"""적대 시각 QA 장면 4개(거리·정거장 복도·연구실·달 기지) — 원본 해상도로 굽는다.
    python3 sf_qa_scenes.py <out_dir> [tag]"""
import sys, os
from sf_scene import Scene, save


def street():
    s = Scene(32, 22, ground=('sidewalk', None))
    s.fill('asphalt', 0, 0, 32, 9)                         # 건물 뒤 = 어두운 뒷골목(보도 광장 위에 뜬 건물 X)
    s.auto('at-road', 0, 12, 32, 4)                       # 4줄 도로
    s.over('crosswalk', 14, 12, 3, 4, v=1)
    s.over('lane-dash', 0, 13, 14, 1, v=0) if False else None
    # 북쪽 건물 줄(아래 끝 = 9행) — 서로 1칸 띄운다
    s.put('street-tower-s', 0, 4); s.put('street-noodle-shop', 5, 6); s.put('street-tower-m', 10, 2); s.put('street-arcade', 16, 6)
    s.put('street-club', 22, 6); s.put('street-clinic', 28, 6)
    # 북쪽 보도(10~11행)
    for x in (4, 15, 27): s.put('street-lamp-post', x, 9)
    s.put('vending', 9, 9); s.put('street-vending-cyan', 21, 9); s.put('street-trash-bin', 20, 10); s.put('street-bench-neon', 24, 10)
    s.put('street-planter-neon', 31, 10); s.put('street-puddle-neon', 7, 11)
    # 도로 위 탈것
    s.put('pod-car', 3, 12); s.put('street-pod-taxi', 20, 14); s.put('street-hover-bike', 27, 12)
    # 남쪽 보도(16~17행) + 남쪽 노점·가판
    s.put('street-market-stall-a', 2, 16); s.put('street-market-stall-b', 5, 16); s.put('street-kiosk', 9, 16)
    s.put('street-neon-billboard', 18, 16); s.put('street-transit-stop', 23, 16); s.put('street-bollard', 13, 16); s.put('street-bollard', 17, 17)
    s.put('street-manhole', 30, 17); s.put('street-crate-pile', 28, 16)
    s.put('street-apartment', 1, 18) if False else None
    return s


def corridor():
    s = Scene(26, 16, ground=('deck-plate', None))
    s.auto('at-wall-hull', 0, 0, 26, 1)                    # 북벽 = 천장 1줄 + 앞면 띠 2줄
    s.fill('wall-face-hull', 1, 1, 24, 2); s.fill('wall-face-viewport', 8, 1, 6, 2)
    for x in range(1, 25): s.ground[1][x] = (s.ground[1][x][0], (x % 4)); s.ground[2][x] = (s.ground[2][x][0], 4 + (x % 4))
    s.auto('at-wall-hull', 0, 1, 1, 15); s.auto('at-wall-hull', 25, 1, 1, 15)
    s.auto('at-wall-hull', 0, 13, 26, 3); s.unauto('at-wall-hull', 11, 13, 4, 3)
    s.fill('deck-lane-h', 1, 8, 24, 1)
    s.auto('at-lightline', 3, 6, 20, 1)
    s.put('airlock-inner', 3, 1); s.put('elevator-door', 19, 1)
    s.put('wall-screen-a', 6, 2); s.put('wall-screen-b', 16, 2); s.put('vent-grill', 22, 2)
    s.put('locker-row', 1, 3) if False else None
    s.put('locker', 1, 4); s.put('locker', 2, 4); s.put('bench', 6, 4); s.put('cargo-crate', 22, 10); s.put('cargo-pallet', 20, 11)
    s.put('fire-extinguisher', 15, 2); s.put('pipe-cluster', 23, 3); s.put('hatch-floor', 12, 10); s.put('server-rack', 2, 10)
    s.put('vending-int', 17, 3)
    return s


def lab():
    s = Scene(22, 15, ground=('lab-floor', None))
    s.auto('at-wall-white', 0, 0, 22, 1)
    s.fill('wall-face-white', 1, 1, 20, 2)
    for x in range(1, 21): s.ground[1][x] = (s.ground[1][x][0], (x % 4)); s.ground[2][x] = (s.ground[2][x][0], 4 + (x % 4))
    s.auto('at-wall-white', 0, 1, 1, 14); s.auto('at-wall-white', 21, 1, 1, 14)
    s.auto('at-wall-white', 0, 13, 22, 2); s.unauto('at-wall-white', 9, 13, 3, 2)
    s.put('fume-hood', 2, 1); s.put('lab-bench', 5, 3); s.put('lab-sink-bench', 9, 3); s.put('specimen-tank', 13, 2); s.put('specimen-tank', 14, 2)
    s.put('wall-screen-c', 16, 2); s.put('server-rack', 18, 2); s.put('server-rack', 19, 2)
    s.put('analysis-console', 3, 7); s.put('microscope-station', 6, 7); s.put('centrifuge', 7, 7)
    s.put('holo-table', 10, 7); s.put('med-bed', 15, 7); s.put('med-scanner', 18, 7)
    s.put('stool', 4, 8); s.put('crew-chair', 12, 9); s.put('hydroponic-rack', 2, 10); s.put('planter-box', 15, 11); s.put('rug-hex', 9, 10)
    return s


def moonbase():
    s = Scene(32, 20, ground=('regolith', None))
    s.auto('at-regolith-path', 2, 12, 28, 2); s.auto('at-regolith-path', 14, 4, 2, 8)
    s.put('hab-dome', 2, 6); s.put('hab-module', 7, 8); s.put('lab-module', 17, 7); s.put('greenhouse-dome', 23, 7)
    s.put('tube-h', 11, 9) if False else None
    s.put('solar-array', 2, 1); s.put('solar-array', 6, 1); s.put('dish', 11, 0); s.put('antenna-mast', 28, 2)
    s.put('rover', 9, 14); s.put('landing-pad', 20, 15); s.put('shuttle', 20, 14) if False else None
    s.put('fuel-tank', 26, 15); s.put('crate-stack', 3, 15); s.put('rock-regolith-l', 13, 16); s.put('boulder-cluster', 28, 17)
    s.put('rock-regolith-s', 17, 2); s.put('crater', 6, 17); s.put('beacon', 19, 14); s.put('beacon', 24, 14)
    return s


SCENES = dict(street=street, corridor=corridor, lab=lab, moonbase=moonbase)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sfqa'; tag = sys.argv[2] if len(sys.argv) > 2 else 'before'
    os.makedirs(out, exist_ok=True)
    for k, f in SCENES.items():
        sc = f(); im = sc.render(); save(im, os.path.join(out, '%s-%s.png' % (k, tag)), z=3)
        print(k, im.size, 'overlaps', sc.occupancy()[:6])
