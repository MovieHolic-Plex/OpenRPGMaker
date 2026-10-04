"""Host authoring renders the committed human selections; candidate sheets stay in the harness."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from kit_common import KitError


class SelectedIcons:
    def __init__(self, manifest):
        self.root = Path(manifest).resolve().parent
        data = json.loads(Path(manifest).read_text())
        if any(item.get('decision') not in ('accept', 'pick') for item in data['icons']):
            raise KitError('선택 manifest에 사람이 받거나 고르지 않은 아이콘이 있다')
        self.icons = {item['id']: item for item in data['icons']}

    def selection(self, iconset, assign, ic, sky_site):
        sites = dict(ic)
        name, x, y, w, h = sky_site
        sites[name] = (x, y, w, h)
        rendered, pending = [], []
        for name, (x, y, w, h) in sites.items():
            if name not in assign:
                continue
            key = iconset.id + '/' + assign[name]
            item = self.icons.get(key)
            site = dict(placeId=name, iconId=key, x=x, y=y, width=w, height=h)
            if not item:
                pending.append(dict(site, reason='human-selection-required'))
            elif (item['width'], item['height']) != (w, h):
                pending.append(dict(site, reason='footprint-mismatch'))
            else:
                rendered.append(dict(site, sha256=item['sha256']))
        return dict(mode='human-selected', rendered=rendered, pending=pending)

    def paste(self, image, selection):
        result = Image.fromarray(image).convert('RGBA')
        for site in selection['rendered']:
            item = self.icons[site['iconId']]
            source = (self.root / item['source']).resolve()
            if not source.is_relative_to(self.root):
                raise KitError('선택 아이콘 경로가 자료 폴더 밖이다: ' + item['id'])
            if hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
                raise KitError('선택 아이콘 그림 해시가 다르다: ' + item['id'])
            with Image.open(source) as opened:
                icon = opened.convert('RGBA')
                if icon.size != (site['width'] * 16, site['height'] * 16):
                    raise KitError('선택 아이콘의 실제 크기가 다르다: ' + item['id'])
                result.alpha_composite(icon, (site['x'] * 16, site['y'] * 16))
        return np.asarray(result.convert('RGB'))
