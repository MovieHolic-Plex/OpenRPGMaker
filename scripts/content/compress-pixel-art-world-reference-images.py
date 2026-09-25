"""Losslessly encode reference attachments; leave actual game asset bytes untouched."""
import base64
import io
import json
import pathlib
import sys
from PIL import Image

path = pathlib.Path(sys.argv[1])
value = json.loads(path.read_text())
cache = {}
before = 0
after = 0

def encode(url):
    global before, after
    if not isinstance(url, str) or not url.startswith('data:image/'):
        return url
    if url in cache:
        return cache[url]
    source = Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGBA')
    output = io.BytesIO()
    source.save(output, format='WEBP', lossless=True, exact=True, method=4)
    decoded = Image.open(io.BytesIO(output.getvalue())).convert('RGBA')
    if decoded.size != source.size or decoded.tobytes() != source.tobytes():
        raise ValueError('Reference compression changed pixels')
    result = 'data:image/webp;base64,' + base64.b64encode(output.getvalue()).decode()
    if len(result) >= len(url):
        result = url
    before += len(url)
    after += len(result)
    cache[url] = result
    return result

def references(owner):
    for category in owner.get('referenceDocuments', []):
        for image in category['images']:
            image['dataUrl'] = encode(image['dataUrl'])
            if image['dataUrl'].startswith('data:image/webp;'):
                image['name'] = str(pathlib.PurePath(image['name']).with_suffix('.webp'))

for tile in value['tilesets'].values():
    references(tile)
    for kit in tile.get('structureKits', []):
        references(kit)
for place in value['places'].values():
    references(place)
for region in value.get('regions', {}).values():
    references(region)
    region['preview'] = encode(region['preview'])
for key, url in value['previews'].items():
    value['previews'][key] = encode(url)
path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
print(json.dumps({'uniqueReferenceImages': len(cache), 'beforeBase64Bytes': before, 'afterBase64Bytes': after, 'identicalDecodedPixels': True}))
