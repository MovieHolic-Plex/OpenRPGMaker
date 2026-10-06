"""Observe approved native action orders without changing production or verdicts."""
import json
import os
from pathlib import Path
import time

import gates


def read(path):
    return json.loads(path.read_text()) if path.is_file() else {}


def snapshot(data, cid):
    root = (Path(data) / 'art-worktrees' / cid).resolve()
    folder = Path(data) / 'concepts' / cid
    result = []
    try:
        ref = read(folder / 'art-actor-actions-next.json').get('manifest')
        if not ref: return result
        manifest = (root / ref['path']).resolve()
        layout = read(folder / 'art-layout-input.json')
        if (not manifest.is_relative_to(root) or gates.digest(manifest) != ref['sha256']
                or ref not in layout.get('layout', {}).get('sources', [])):
            return result
        active = read(folder / 'art-actor-actions.json')
        old = {order['actor']: order for order in active.get('orders', [])}
        for order in read(manifest).get('orders', []):
            if order == old.get(order['actor']): continue
            out, request = Path(order['out']).resolve(), Path(order['request']).resolve()
            if not out.is_relative_to(root) or not request.is_relative_to(root): continue
            request_ref = dict(path=str(request.relative_to(root)), sha256=gates.digest(request))
            if request_ref not in layout['layout']['sources']: continue
            attempts = sorted(out.glob('attempts/*/producer.json'), key=lambda p: int(p.parent.name))
            meta = read(attempts[-1]) if attempts else {}
            alive = False
            if meta.get('pid') and 'exitCode' not in meta:
                try: os.kill(meta['pid'], 0); alive = True
                except ProcessLookupError: pass
            phase = '제작 중' if alive else ('실행 확인 필요' if meta else '제작 대기')
            receipt = read(out / 'receipt.json')
            if receipt.get('ok') and receipt.get('contractSha256') == request_ref['sha256']:
                phase = '납품 확인 중'
            elif meta.get('exitCode') not in (None, 0): phase = '실행 실패'
            report = read(out / 'views/report.json')
            pixels = out / 'actions.px.json'
            rendered = len(report.get('frames', [])) if (pixels.is_file()
                and (out / 'views/sheet.png').is_file()
                and report.get('sourceSha256') == gates.digest(pixels)) else 0
            log = attempts[-1].parent / 'worker.log' if attempts else None
            result.append(dict(actor=order['actor'], phase=phase, alive=alive,
                attempt=meta.get('attempt'), model=(meta.get('model') or {}).get('label'),
                rendered=rendered, total=sum(p['frames'] for p in read(request)['poses']),
                outputAgeSeconds=max(0, int(time.time()-log.stat().st_mtime)) if log and log.is_file() else None))
    except (OSError, ValueError, KeyError, TypeError):
        return result
    return result
