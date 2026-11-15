from __future__ import annotations

import json
from pathlib import Path
from threading import RLock

from pydantic import TypeAdapter

from app.models import KnowledgeDocument


class DocumentManifestRepository:
    def __init__(self, root: Path) -> None:
        self._root = root.resolve()
        self._root.mkdir(parents=True, exist_ok=True)
        self._path = self._root / "manifest.json"
        self._adapter: TypeAdapter[list[KnowledgeDocument]] = TypeAdapter(list[KnowledgeDocument])
        self._lock = RLock()

    def list_documents(self) -> list[KnowledgeDocument]:
        with self._lock:
            return sorted(self._read(), key=lambda item: item.updated_at, reverse=True)

    def get(self, document_id: str) -> KnowledgeDocument | None:
        return next((item for item in self.list_documents() if item.id == document_id), None)

    def save(self, document: KnowledgeDocument) -> None:
        with self._lock:
            documents = self._read()
            for index, existing in enumerate(documents):
                if existing.id == document.id:
                    documents[index] = document
                    break
            else:
                documents.append(document)
            temporary = self._path.with_suffix(".tmp")
            temporary.write_text(
                self._adapter.dump_json(documents, by_alias=True, indent=2).decode("utf-8"),
                encoding="utf-8",
            )
            temporary.replace(self._path)

    def _read(self) -> list[KnowledgeDocument]:
        if not self._path.exists():
            return []
        raw = json.loads(self._path.read_text(encoding="utf-8"))
        return self._adapter.validate_python(raw)


class AuthorizedDocumentStore:
    def __init__(self, root: Path) -> None:
        self._root = root.resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def save(self, document_id: str, version: int, filename: str, content: bytes) -> Path:
        extension = Path(filename).suffix.casefold()
        directory = self._root / document_id
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"v{version}{extension}"
        path.write_bytes(content)
        return path
