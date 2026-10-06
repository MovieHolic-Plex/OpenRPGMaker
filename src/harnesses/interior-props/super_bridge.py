"""슈퍼하네싱의 읽기 연결. 다른 워크트리의 실행기/DB/승인에는 쓰지 않는다."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import sqlite3
import threading
import time
import urllib.request
import urllib.parse
import zipfile

import sys
if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    __package__ = 'src.harnesses.interior-props'
from . import shared_publish

_LOCK = threading.Lock()
_STATUS = {}
_PACK = {}
_SPACE_LIST = None


def attach_space(provider):
    """The unified host supplies its own gallery; no loopback HTTP or second server."""
    global _SPACE_LIST
    _SPACE_LIST = provider
    _STATUS.clear()


def origin():
    return os.environ.get('SUPER_HARNESS_ORIGIN', 'http://127.0.0.1:18315').rstrip('/')


def shared_file():
    return Path(os.environ.get('OPRN_SHARED_CONTENT_SQLITE', str(
        Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'oprn/shared-content.sqlite'))).resolve()


def shared_row(payload=False):
    file = shared_file()
    if not file.is_file():
        return None
    with sqlite3.connect(file.as_uri() + '?mode=ro', uri=True, timeout=3) as db:
        columns = 'revision, updated_at' + (', payload' if payload else '')
        return db.execute(f'SELECT {columns} FROM content_libraries WHERE id=?',
                          (shared_publish.LIBRARY,)).fetchone()


def status():
    # 여러 창이 열려도 기존 서버에 무거운 /api/state를 요청하지 않는다.
    with _LOCK:
        if time.monotonic() - _STATUS.get('at', -100) > 10:
            try:
                if _SPACE_LIST:
                    data = _SPACE_LIST()
                else:
                    req = urllib.request.Request(origin() + '/api/list', headers={'Accept': 'application/json'})
                    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
                    with opener.open(req, timeout=2) as response:
                        data = json.loads(response.read(1024 * 1024))
                items = data['items']
                result = dict(online=True, paused=data.get('paused'), concepts=len(items),
                              running=sum(bool(i.get('running')) for i in items))
            except (OSError, ValueError, KeyError, TypeError):
                result = dict(online=False, error='공간·개념 서버에 연결할 수 없습니다.')
            _STATUS.update(at=time.monotonic(), result=result)
        space = dict(_STATUS['result'])
    publication = shared_publish.status()
    try:
        row = shared_row()
        shared = dict(available=bool(row), library=shared_publish.LIBRARY,
                      revision=row[0] if row else None, updated=row[1] if row else None)
    except sqlite3.Error:
        shared = dict(available=False, error='공용 재료 DB를 읽을 수 없습니다.')
    return dict(space=space, shared=shared, publication=publication,
                unified=bool(_SPACE_LIST), spacePort=urllib.parse.urlsplit(origin()).port or 80)


def material_pack():
    """공용 SQLite의 실제 행만 판본에 묶어 읽는다. 미선택 후보는 내보내지 않는다."""
    with _LOCK:
        row = shared_row()
        if not row:
            raise FileNotFoundError('공용에 등록된 기물이 없습니다.')
        if _PACK.get('revision') == row[0]:
            return _PACK
        row = shared_row(payload=True)  # 판본·본문을 같은 SELECT에서 고정
        revision, updated, payload = row
        if hashlib.sha256(payload.encode()).hexdigest() != revision:
            raise ValueError('공용 재료의 판본 해시가 맞지 않습니다.')
        library = json.loads(payload)
        tid = 'shared_hand_interior_harness'
        tileset = library['tilesets'][tid]
        entries = {}
        for kit in tileset['structureKits']:
            object_id = f'kit:{tid}/{kit["id"]}'
            entries[kit['id']] = dict(name=kit['name'], width=kit['width'], height=kit['height'],
                                      binding=dict(tool='stamp_object', field='objectId', id=object_id), kit=kit)
        catalog = dict(version=1, libraryId=shared_publish.LIBRARY, revision=revision, updated=updated,
                       tilesetId=tid, projectDefaults=library.get('projectDefaults'), kits=entries)
        files = {'catalog.json': json.dumps(catalog, ensure_ascii=False, indent=2).encode(),
                 'library.json': payload.encode(),
                 'tileset.json': json.dumps(tileset, ensure_ascii=False, indent=2).encode()}
        asset = library['assets'][tileset['image']['id']]
        files['atlas.png'] = base64.b64decode(asset['dataUrl'].split(',', 1)[1], validate=True)
        reference_index = []
        for ci, category in enumerate(tileset.get('referenceDocuments', [])):
            category_index = dict(id=category['id'], name=category['name'], documents=[], images=[])
            for di, doc in enumerate(category.get('documents', [])):
                name = f'references/{ci}-{di}.md'
                files[name] = doc['markdown'].encode()
                category_index['documents'].append(dict(id=doc['id'], name=doc['name'], path=name))
            for ii, image in enumerate(category.get('images', [])):
                data_url = image['dataUrl']
                if not data_url.startswith('data:image/png;base64,'):
                    raise ValueError('공용 참고 이미지가 내장 PNG가 아닙니다.')
                name = f'references/{ci}-image-{ii}.png'
                files[name] = base64.b64decode(data_url.split(',', 1)[1], validate=True)
                category_index['images'].append(dict(id=image['id'], name=image.get('name'), path=name))
            reference_index.append(category_index)
        files['references/index.json'] = json.dumps(reference_index, ensure_ascii=False, indent=2).encode()
        files['README.md'] = (
            '# 슈퍼하네싱 공용 재료\n\n'
            f'라이브러리: {shared_publish.LIBRARY}\n판본: {revision}\n타일셋: {tid}\n\n'
            '공용 SQLite에 게시된 실제 팩의 고정 사본입니다. 사용자가 고른 후보만 반영되어 있습니다.\n'
            'catalog.json의 kits 항목에 실제 stamp_object binding과 킷 정의가 있습니다.\n'
            '원래 library.json과 atlas.png, 참고문서를 함께 보존합니다.\n'
            '기존 슈퍼하네스의 재료 근거로 쓰려면 해당 작업 워크트리 안에 압축을 풀고,\n'
            'catalog JSON pointer·atlas·해당 용도 문서의 실제 파일 해시를 materials.json에 연결합니다.\n'
            '이 팩은 앱 번들의 atlas_biome_interior와 다른 번호입니다.\n'
            '새 프로젝트 또는 공용 목록을 다시 읽은 프로젝트에서 이 타일셋을 확인합니다.\n'
            'build_hand_interior_room의 고정 사양에 새 킷 id를 넘기지 않습니다.\n'
            '공용 등록은 공간 기획·시대별 재료·독립 검수의 승인을 대신하지 않습니다.\n'
        ).encode()
        hashes = {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
        files['receipt.json'] = json.dumps(dict(libraryId=shared_publish.LIBRARY, revision=revision,
                                                hashes=hashes), indent=2).encode()
        out = io.BytesIO()
        with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                archive.writestr(name, data)
        _PACK.clear()
        _PACK.update(revision=revision, catalog=catalog, zip=out.getvalue())
        return _PACK


def handle(h, method, parts):
    if method != 'GET' or parts[:2] != ['api', 'super-harness']:
        return False
    try:
        if parts == ['api', 'super-harness', 'status']:
            h.send(200, json.dumps(status(), ensure_ascii=False))
        elif parts == ['api', 'super-harness', 'materials']:
            h.send(200, json.dumps(material_pack()['catalog'], ensure_ascii=False))
        elif parts == ['api', 'super-harness', 'materials.zip']:
            data = material_pack()['zip']
            h.send_response(200)
            h.send_header('Content-Type', 'application/zip')
            h.send_header('Content-Disposition', 'attachment; filename="super-harness-materials.zip"')
            h.send_header('Cache-Control', 'no-store')
            h.send_header('Content-Length', str(len(data)))
            h.end_headers(); h.wfile.write(data)
        else:
            return False
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as error:
        h.send(503, json.dumps({'error': str(error)[:200]}, ensure_ascii=False))
    return True
