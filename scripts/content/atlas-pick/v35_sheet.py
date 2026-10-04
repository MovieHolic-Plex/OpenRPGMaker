#!/usr/bin/env python3
"""v35-A 5종을 x6 으로 나란히 본다(작업 중 눈 확인용). 출력: 인자 또는 /tmp/v35sheet.png"""
import os, sys
from PIL import Image
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tiledata', 'atlas-pick', 'candidates-modern')
SL = sys.argv[2:] or ['gn_delivery_scooter', 'mo_ped_signal', 'gn_bike_share', 'gn_street_stall', 'mo_sculpture']
ims = [Image.open(f'{R}/{s}/v35-A.png').convert('RGBA') for s in SL]
S = 6
W = sum(i.width for i in ims) * S + 20 * (len(ims) + 1); H = max(i.height for i in ims) * S + 10
c = Image.new('RGBA', (W, H), (190, 190, 190, 255)); x = 20
for i in ims:
    j = i.resize((i.width * S, i.height * S), Image.NEAREST); c.paste(j, (x, H - j.height - 5), j); x += j.width + 20
c.save(sys.argv[1] if len(sys.argv) > 1 else '/tmp/v35sheet.png')
