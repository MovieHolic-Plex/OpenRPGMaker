"""Attach configured canonical reference exports before starting art preparation."""
import hashlib
import json
from pathlib import Path


def ensure(data, cid):
    target=Path(data)/'concepts'/cid/'reference-source.json'
    if target.exists(): return
    catalog=Path(data)/'reference-catalog.json'
    if not catalog.exists(): return
    supplied=json.loads(catalog.read_text()); sources=[]
    for entry in supplied['sources']:
        provenance=Path(entry['provenance']); source=Path(entry['snapshot'])
        receipt=json.loads(provenance.read_text())
        if not receipt.get('projectId') or hashlib.sha256(source.read_bytes()).hexdigest()!=receipt['sha256']:
            raise ValueError('정본 참고자료 출처/스냅샷 해시 불일치')
        indexes=[]
        for folder in entry['referenceDirectories']:
            index=Path(folder)/'INDEX.json'
            manifest=json.loads(index.read_text())
            for category in manifest['categories']:
                for document in category.get('documents',[]):
                    if not (Path(folder)/category['id']/document['file']).is_file():
                        raise ValueError('추출 참고문서 누락: '+document['file'])
            indexes.append(dict(directory=folder,indexSha256=hashlib.sha256(index.read_bytes()).hexdigest(),tilesetId=manifest['tilesetId']))
        sources.append(dict(provenance=str(provenance),projectId=receipt['projectId'],revision=receipt.get('revision'),references=indexes))
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(dict(sources=sources,instruction='정본 SQLite에서 읽어 번들 소유 참고문서를 복원한 추출본. 해당 타일셋/용도의 INDEX.json, MD 전 페이지와 실제 이미지를 확인한다. 이 경로는 참고 출처이며 새 콘텐츠 설치 대상이 아니다.'),ensure_ascii=False,indent=2))
