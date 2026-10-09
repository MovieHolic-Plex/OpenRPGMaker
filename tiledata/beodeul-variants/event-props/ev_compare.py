# compare-ref.png — 2배로 [버들항 기준 | 이벤트 소품] 을 나란히(WAVE-BRIEF-2 필수 QA 1).
# 왼쪽 기준: 버들항 pz 소품(현자 석상·분수·가로등·노점·걸이 간판·상자), city6 포룸 광장, 성채 지하묘지 방,
# 빛·불 기준 조각(volcano-field 신전 화로, cultist-tower 보라 화로, time-rift 포털·빛 수정, aqueduct 횃불), future-ruins 신호기.
import os
from PIL import Image, ImageDraw
from ev_base import *
import pz


def _row(ims, gap=4, bg=(84, 120, 64, 255)):
    W = sum(i.width for i in ims) + gap * (len(ims) + 1); H = max(i.height for i in ims) + gap * 2
    o = Image.new('RGBA', (W, H), bg); x = gap
    for i in ims: o.alpha_composite(i, (x, H - gap - i.height)); x += i.width + gap
    return o


def _f0(n, P): im = P[n]; return im.crop((0, 0, im.width // 4, im.height)) if n.endswith('-strip') else im


def _ref(path): return Image.open(os.path.join(VAR, path)).convert('RGBA')


def compare(P, full, oa, ob, out=None):
    S2 = 2
    pzp = [pz.fin(pz.P[k][0]()) for k in ('현자 석상', '작은 분수', '쌍등 가로등', '걸이 간판: 여관', '걸이 간판: 약방', '입간판 (분필)', '통·상자·자루 더미', '나무 벤치')]
    ours_town = [_f0(n, P) for n in ('statue_guard', 'heal_spring-strip', 'sign_post', 'inn_sign', 'shop_sign', 'notice_board', 'chest_wood', 'chest_wood_open', 'chest_iron', 'chest_gold', 'block_push')]
    city = Image.open(os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_base.png')).convert('RGBA').crop((880, 560, 1200, 780))
    cc = _ref('castle-catacombs/render-1x.png').crop((40, 260, 360, 490))
    light_ref = [_ref(p) for p in ('volcano-field/parts/temple_brazier.png', 'cultist-tower/parts/brazier_purple.png', 'aqueduct-sewer/parts/torch_wall.png',
                                   'deep-forest-path/parts/campfire.png', 'time-rift/parts/light-crystal.png', 'time-rift/parts/portal-blue.png',
                                   'ancient-forest/parts/spring-basin.png')]
    ours_light = [_f0(n, P) for n in ('brazier-strip', 'torch_wall-strip', 'campfire-strip', 'save_crystal-strip', 'save_crystal_off', 'crystal_switch_blue',
                                       'crystal_switch_red', 'portal_gate-strip', 'evfloor_warp_pad-strip', 'evfloor_warp_pad_off')]
    mech_ref = [_ref(p) for p in ('future-ruins/parts/signal_post_on.png', 'future-ruins/parts/signal_post_off.png', 'future-ruins/parts/storage_tank.png',
                                  'graveyard-crypt/parts/iron_door.png', 'tower-interior/parts/lever_post.png', 'tower-interior/parts/treasure_chest.png')]
    ours_mech = [_f0(n, P) for n in ('signal_post_red', 'signal_post_green', 'landing_pad', 'door_iron_closed', 'door_wood_closed',
                                      'door_seal_closed-strip', 'door_iron_open', 'lever_off', 'lever_on', 'evfloor_plate_off', 'evfloor_plate_on')]
    dun = full.crop((oa[0], oa[1], oa[0] + 256, oa[1] + 192)); twn = full.crop((ob[0], ob[1], ob[0] + 384, ob[1] + 256))
    rows = [('beodeul pz props: statue, fountain, lamp, bracket signs, crates (ref)', _row(pzp), 'event-props: guard statue, heal spring, signs, notice board, chests, block', _row(ours_town)),
            ('beodeul city6: forum plaza (ref)', city, 'event-props: town square scene (beodeul houses/trees + our props)', twn),
            ('castle-catacombs: room, torches, braziers (ref)', cc, 'event-props: dungeon entrance room scene', dun),
            ('fire / glow parts: volcano, cultist, aqueduct, forest, time-rift, ancient-forest (ref)', _row(light_ref, bg=(60, 58, 68, 255)),
             'event-props: brazier, torch, campfire, save crystal, switches, portal, warp pad', _row(ours_light, bg=(60, 58, 68, 255))),
            ('machine / door parts: future-ruins signals, tank, crypt iron door, lever, chest (ref)', _row(mech_ref, bg=(60, 58, 68, 255)),
             'event-props: signals, landing pad, doors, levers, floor plates', _row(ours_mech, bg=(60, 58, 68, 255)))]
    pw = max(max(a.width, b.width) for _, a, _, b in rows) * S2
    oh = sum(max(a.height, b.height) * S2 + 22 for _, a, _, b in rows) + 8
    o = Image.new('RGBA', (pw * 2 + 30, oh), (28, 28, 34, 255)); d = ImageDraw.Draw(o)
    y = 8
    for (la, a, lb, b) in rows:
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        o.alpha_composite(a.resize((a.width * S2, a.height * S2), Image.NEAREST), (10, y + 14))
        o.alpha_composite(b.resize((b.width * S2, b.height * S2), Image.NEAREST), (pw + 20, y + 14))
        y += max(a.height, b.height) * S2 + 22
    o.convert('RGB').save(out or os.path.join(HERE, 'compare-ref.png'))
    return o
