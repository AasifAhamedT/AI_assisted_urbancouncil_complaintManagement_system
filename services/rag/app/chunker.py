from __future__ import annotations

import re
from dataclasses import dataclass

from app.extractor import ExtractedUnit


@dataclass(frozen=True)
class TextChunk:
    id: str
    document_id: str
    document_title: str
    version: int
    location: str
    text: str


class DocumentChunker:
    def __init__(self, chunk_size: int, overlap: int) -> None:
        self._chunk_size = chunk_size
        self._overlap = min(overlap, chunk_size // 2)

    def chunk(self, document_id: str, document_title: str, version: int, units: list[ExtractedUnit]) -> list[TextChunk]:
        chunks: list[TextChunk] = []
        for unit in units:
            text = re.sub(r"\s+", " ", unit.text).strip()
            start = 0
            while start < len(text):
                end = min(start + self._chunk_size, len(text))
                if end < len(text):
                    boundary = text.rfind(" ", start + self._chunk_size // 2, end)
                    if boundary > start:
                        end = boundary
                value = text[start:end].strip()
                if value:
                    index = len(chunks) + 1
                    chunks.append(TextChunk(
                        id=f"{document_id}:v{version}:{index:05d}", document_id=document_id,
                        document_title=document_title, version=version, location=unit.location, text=value,
                    ))
                if end >= len(text):
                    break
                start = max(end - self._overlap, start + 1)
        return chunks
