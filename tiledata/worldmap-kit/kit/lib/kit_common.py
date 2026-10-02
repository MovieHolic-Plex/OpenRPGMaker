#!/usr/bin/env python3
"""월드맵 키트 공통: 폴더 규약, 역할 표·아이콘 세트·여정 템플릿 읽기와 짝 검사, 아이콘 고르기."""
import json
import zlib
from pathlib import Path

import numpy as np
from PIL import Image

LIB = Path(__file__).resolve().parent
KIT = LIB.parent
WM = KIT.parent
SHADOW_KEY = (254, 103, 139)


class KitError(Exception):
    """사용자가 고칠 수 있는 입력 오류(역할 없음·칸 수 불일치 등). 명령줄은 이것만 짧게 보여 주고 끝낸다."""


def load_json(path):
    path = Path(path)
    if not path.exists():
        raise KitError('파일이 없다: %s' % path)
    return json.loads(path.read_text(encoding='utf-8'))


def load_roles():
    d = load_json(KIT / 'roles.json')
    return {r['id']: dict(r, cells=tuple(r['cells'])) for r in d['roles']}, d


def load_journey(jid):
    d = load_json(WM / 'journeys' / (jid + '.json'))
    if d.get('schema') != 'worldmap-journey/1':
        raise KitError('journeys/%s.json: schema 가 worldmap-journey/1 이 아니다' % jid)
    ids = [p['id'] for p in d['places']]
    if len(set(ids)) != len(ids):
        raise KitError('journeys/%s.json: 장소 id 가 겹친다' % jid)
    return d


class IconSet:
    def __init__(self, sid):
        # sid 가 경로(폴더가 실제로 있는 것)면 그 폴더를, 아니면 iconsets/<sid> 를 연다 — 새 세트를 저장소에 넣기 전에 시험할 수 있다
        if ('/' in sid or sid.startswith('.')) and Path(sid).is_dir():
            self.dir = Path(sid).resolve()
            sid = self.dir.name
        else:
            self.dir = WM / 'iconsets' / sid
        self.id = sid
        self.manifest = load_json(self.dir / 'manifest.json')
        m = self.manifest
        for k in ('id', 'name', 'tile', 'key', 'sheet', 'icons'):
            if k not in m:
                raise KitError('iconsets/%s/manifest.json: %r 항목이 없다' % (sid, k))
        if m['id'] != sid:
            raise KitError('iconsets/%s/manifest.json: id(%s) 가 폴더 이름과 다르다' % (sid, m['id']))
        if m['tile'] != 16:
            raise KitError('iconsets/%s: tile 은 16 만 지원한다' % sid)
        self.key = tuple(m['key'])
        self.sheet_path = self.dir / m['sheet']
        if not self.sheet_path.exists():
            raise KitError('iconsets/%s: 시트가 없다 (%s)' % (sid, m['sheet']))
        self.sheet = np.array(Image.open(self.sheet_path).convert('RGB'), np.uint8)
        self.shadow_key = tuple(m.get('shadow_key', SHADOW_KEY))
        self.icons = {}
        for ic in m['icons']:
            if ic['name'] in self.icons:
                raise KitError('iconsets/%s: 아이콘 이름이 겹친다 (%s)' % (sid, ic['name']))
            w, h = ic['cells']
            if (ic['col'] + w) * 16 > self.sheet.shape[1] or (ic['row'] + h) * 16 > self.sheet.shape[0]:
                raise KitError('iconsets/%s: 아이콘 %s 가 시트 밖이다' % (sid, ic['name']))
            self.icons[ic['name']] = dict(ic, _own=True)
        self.pins = dict(m.get('pins', {}))
        self.kind = m.get('kind', 'land')
        # 부분 세트(extends): 바탕 세트의 아이콘을 함께 가진다 — 이 세트에 없는 역할도 지도에 놓을 수 있게.
        # 바탕 아이콘은 바탕 시트에서 잘라 온다(_base). 이름이 겹치면 이 세트 것이 이긴다.
        self.base = IconSet(m['extends']) if m.get('extends') else None
        if self.base:
            for n, ic in self.base.icons.items():
                if n not in self.icons:
                    self.icons[n] = dict(ic, _own=False)

    def array(self, name):
        ic = self.icons[name]
        if not ic.get('_own', True) and self.base:
            return self.base.array(name)
        w, h = ic['cells']
        return self.sheet[ic['row'] * 16:(ic['row'] + h) * 16, ic['col'] * 16:(ic['col'] + w) * 16]

    def fitting(self, role, cells):
        """역할의 칸 수와 같은 아이콘만(이름순). 칸 수가 다르면 지형 발자국과 어긋나므로 배치할 수 없다."""
        return sorted((n for n, ic in self.icons.items() if ic['role'] == role and tuple(ic['cells']) == tuple(cells)))


def choose_icon(place, iconset, roles):
    """장소에 놓을 아이콘: 세트의 pins[장소 id] 가 있으면 그것, 없으면 역할의 맞는 변형 중 crc32(장소 id) 로 결정(실행마다 같다)."""
    role = roles[place['role']]
    cands = iconset.fitting(place['role'], role['cells'])
    pin = iconset.pins.get(place['id'])
    if pin is not None:
        if pin not in cands:
            raise KitError('iconsets/%s: pins[%s]=%s 가 역할 %s(%dx%d)의 맞는 아이콘이 아니다' % (iconset.id, place['id'], pin, place['role'], *role['cells']))
        return pin
    return cands[zlib.crc32(place['id'].encode('utf-8')) % len(cands)]


def validate_combo(roles, journey, iconset):
    """여정 템플릿의 모든 장소 역할을 아이콘 세트가 칸 수대로 채우는지. 모자라면 KitError(무엇이 모자란지 전부)."""
    errs = []
    need = {}
    for p in journey['places']:
        if p['role'] not in roles:
            errs.append('여정 %s: 장소 %s 의 역할 %r 가 roles.json 에 없다' % (journey['id'], p['id'], p['role']))
            continue
        need.setdefault(p['role'], []).append(p['id'])
    for role, places in sorted(need.items()):
        if role not in roles:
            continue
        cells = roles[role]['cells']
        if not iconset.fitting(role, cells):
            have = [(n, tuple(ic['cells'])) for n, ic in iconset.icons.items() if ic['role'] == role]
            errs.append('아이콘 세트 %s 에 역할 %s(%dx%d)가 없다 — 필요한 장소: %s%s' % (
                iconset.id, role, cells[0], cells[1], ', '.join(places), ('; 칸 수가 다른 후보: %s' % have) if have else ''))
    for pid, icon in iconset.pins.items():
        if icon not in iconset.icons:
            errs.append('아이콘 세트 %s: pins[%s]=%s 아이콘이 없다' % (iconset.id, pid, icon))
    for n, ic in iconset.icons.items():
        if ic['role'] not in roles:
            errs.append('아이콘 세트 %s: 아이콘 %s 의 역할 %r 가 roles.json 에 없다' % (iconset.id, n, ic['role']))
    if errs:
        raise KitError('\n'.join(errs))


def assign_icons(roles, journey, iconset):
    validate_combo(roles, journey, iconset)
    return {p['id']: choose_icon(p, iconset, roles) for p in journey['places']}
