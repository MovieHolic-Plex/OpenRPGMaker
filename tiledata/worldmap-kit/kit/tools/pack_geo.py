#!/usr/bin/env python3
"""Natural Earth(퍼블릭 도메인) 원본 GeoJSON → 키트가 읽는 작은 묶음 geo/*.json.gz.

  python3 kit/tools/pack_geo.py <원본 폴더>
원본(https://github.com/nvkelso/natural-earth-vector/tree/master/geojson):
  ne_50m_land · ne_50m_lakes · ne_50m_rivers_lake_centerlines · ne_10m_geography_regions_polys
높이: NOAA ETOPO1(자유 재배포) 0.25° 표본 — ERDDAP 에서 받은 etopo_q.nc
  https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude[(-89.875):15:(89.875)][(-179.875):15:(179.875)]
  → geo/elev.npy.gz (uint8, 30m 단위, 바다·0m 이하 = 0, 위도 오름차순 720 × 경도 1440)
좌표는 0.01° 로 반올림하고 shapely 로 단순화한다(지도 한 칸이 보통 0.2° 이상이라 눈에 안 띈다).
"""
import gzip
import json
import os
import sys

from shapely.geometry import shape, mapping

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ne'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'geo')
REGION_KINDS = {'Range/mtn': 'range', 'Desert': 'desert', 'Plateau': 'plateau', 'Basin': 'basin',
                'Tundra': 'tundra', 'Wetlands': 'wetland', 'Plain': 'plain', 'Lowland': 'plain'}


def rnd(geom):
    def r(c):
        if not c:
            return []
        if isinstance(c[0], (int, float)):
            return [round(c[0], 2), round(c[1], 2)]
        return [r(x) for x in c]
    g = mapping(geom)
    return dict(type=g['type'], coordinates=r(g['coordinates']))


def load(name):
    with open(os.path.join(SRC, name + '.geojson')) as f:
        return json.load(f)['features']


def polys(geom):
    """Polygon/MultiPolygon → 고리 목록 [[바깥], [구멍]...] 의 목록."""
    g = rnd(geom)
    return g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]


def lines(geom):
    g = rnd(geom)
    return g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]


def write(name, data):
    p = os.path.join(OUT, name + '.json.gz')
    with gzip.open(p, 'wt', compresslevel=9) as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(name, os.path.getsize(p))


land = [polys(shape(f['geometry']).simplify(.02)) for f in load('ne_50m_land')]
write('land', [p for ps in land for p in ps])
lakes = [dict(name=f['properties'].get('name'), name_ko=f['properties'].get('name_ko'), rank=f['properties'].get('scalerank'),
              polys=polys(shape(f['geometry']).simplify(.02))) for f in load('ne_50m_lakes')]
write('lakes', lakes)
rivers = []
for f in load('ne_50m_rivers_lake_centerlines'):
    p = f['properties']
    if p.get('featurecla') != 'River':
        continue
    g = shape(f['geometry'])
    if g.is_empty:
        continue
    rivers.append(dict(name=p.get('name'), rank=p.get('scalerank'), lines=lines(shape(f['geometry']).simplify(.02))))
write('rivers', rivers)
regions = []
for f in load('ne_10m_geography_regions_polys'):
    p = f['properties']
    kind = REGION_KINDS.get(p['FEATURECLA'])
    if not kind:
        continue
    regions.append(dict(kind=kind, name=p['NAME'], name_ko=p.get('NAME_KO'), rank=p['SCALERANK'],
                        polys=polys(shape(f['geometry']).simplify(.05))))
write('regions', regions)

import numpy as np
import scipy.io
nc = scipy.io.netcdf_file(os.path.join(SRC, 'etopo_q.nc'), 'r', mmap=False)
alt = np.asarray(nc.variables['altitude'][:], dtype=np.int32)
q = np.clip(np.round(alt / 30.0), 0, 255).astype(np.uint8)
p = os.path.join(OUT, 'elev.npy.gz')
with gzip.open(p, 'wb', compresslevel=9) as f:
    np.save(f, q)
print('elev', q.shape, os.path.getsize(p))
