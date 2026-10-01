#!/usr/bin/env python3
"""성곽 도시 v7 — 팔각 성벽·가로 배치 마을. cities-v7/*.png 를 쓴다(city_v7.py)."""
import os, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from PIL import Image
import city_v7 as C

OUT = HERE / 'cities-v7'
OUT.mkdir(exist_ok=True)
for name, fn in (('capital-96', C.capital), ('fort-64', C.fort), ('harbor-80x64', C.harbor)):
    a = fn()
    Image.fromarray(a).save(OUT / (name + '.png'))
    print(name, a.shape)
