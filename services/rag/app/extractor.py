from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import ClassVar
from zipfile import BadZipFile, ZipFile

from docx import Document
from pypdf import PdfReader

from app.errors import RagError


@dataclass(frozen=True)
class ExtractedUnit:
    text: str
    location: str


class DocumentExtractor:
    allowed_media_types: ClassVar[dict[str, str]] = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "text/plain": ".txt",
    }

    def validate(self, filename: str, media_type: str, content: bytes, maximum_bytes: int) -> None:
        normalized = filename.strip()
        if not normalized or len(normalized) > 255 or "/" in normalized or "\\" in normalized or "\0" in normalized:
            raise RagError(400, "INVALID_DOCUMENT_FILENAME", "The document filename is invalid.")
        if not content:
            raise RagError(400, "EMPTY_DOCUMENT", "The uploaded document is empty.")
        if len(content) > maximum_bytes:
            raise RagError(413, "DOCUMENT_TOO_LARGE", "The uploaded document is too large.")
        extension = self.allowed_media_types.get(media_type)
        if extension is None:
            raise RagError(415, "DOCUMENT_TYPE_NOT_SUPPORTED", "Only PDF, DOCX, and UTF-8 text documents are supported.")
        if not normalized.casefold().endswith(extension):
            raise RagError(415, "DOCUMENT_TYPE_MISMATCH", "The filename and media type do not match.")
        if media_type == "application/pdf" and not content.startswith(b"%PDF-"):
            raise RagError(415, "DOCUMENT_TYPE_MISMATCH", "The file content is not a valid PDF document.")
        if media_type.endswith("wordprocessingml.document"):
            self._validate_docx(content)
        if media_type == "text/plain":
            self._decode_text(content)

    def extract(self, media_type: str, content: bytes) -> list[ExtractedUnit]:
        try:
            if media_type == "application/pdf":
                units = [
                    ExtractedUnit(text=page.extract_text() or "", location=f"Page {index}")
                    for index, page in enumerate(PdfReader(BytesIO(content)).pages, start=1)
                ]
            elif media_type.endswith("wordprocessingml.document"):
                paragraphs = [item.text.strip() for item in Document(BytesIO(content)).paragraphs if item.text.strip()]
                units = [ExtractedUnit(text=text, location=f"Section {index}") for index, text in enumerate(paragraphs, start=1)]
            else:
                units = [ExtractedUnit(text=self._decode_text(content), location="Text document")]
        except RagError:
            raise
        except Exception as error:
            raise RagError(422, "DOCUMENT_EXTRACTION_FAILED", "Text could not be extracted from the document.") from error
        if not any(unit.text.strip() for unit in units):
            raise RagError(422, "DOCUMENT_HAS_NO_TEXT", "The document does not contain extractable text.")
        return units

    def _validate_docx(self, content: bytes) -> None:
        try:
            with ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    raise RagError(415, "DOCUMENT_TYPE_MISMATCH", "The file content is not a valid DOCX document.")
        except BadZipFile as error:
            raise RagError(415, "DOCUMENT_TYPE_MISMATCH", "The file content is not a valid DOCX document.") from error

    def _decode_text(self, content: bytes) -> str:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise RagError(415, "DOCUMENT_TEXT_ENCODING_INVALID", "Text documents must use UTF-8 encoding.") from error
        if "\0" in text:
            raise RagError(415, "DOCUMENT_TYPE_MISMATCH", "The file content is not a plain-text document.")
        return text
