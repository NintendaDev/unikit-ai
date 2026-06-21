#!/usr/bin/env python3
"""Generic text, path, XML, and archive safety helpers.

Sits one layer above mp_config and below the chunk/book extractors. Holds the
hidden/sensitive path predicates, text decoding/normalization, the HTML→text
flattener, the generic `_has_markdown_heading` probe (kept here — not in
mp_books — so mp_chunk can use it without pulling in the book extractors), and
the XML/zip hardening (DOCTYPE refusal, zip-bomb budget).
"""

from __future__ import annotations

import fnmatch
import html
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from mp_config import (
    MAX_ARCHIVE_MEMBERS,
    SENSITIVE_DIR_NAMES,
    SENSITIVE_FILE_PATTERNS,
)


def is_hidden_name(name: str) -> bool:
    return name.startswith(".") and name not in {".", ".."}


def is_sensitive_dir_name(name: str) -> bool:
    return name.lower() in SENSITIVE_DIR_NAMES


def is_sensitive_file_name(name: str) -> bool:
    lowered = name.lower()
    return any(fnmatch.fnmatchcase(lowered, pattern) for pattern in SENSITIVE_FILE_PATTERNS)


def has_hidden_part(path: Path) -> bool:
    return any(is_hidden_name(part) for part in path.parts)


def has_sensitive_part(path: Path) -> bool:
    return any(is_sensitive_dir_name(part) for part in path.parts[:-1]) or is_sensitive_file_name(path.name)


def slugify(value: str, fallback: str = "source") -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value[:80] or fallback


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()


def _decode_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1251", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def read_text_file(path: Path) -> str:
    return _decode_bytes(path.read_bytes())


def html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    raw = html.unescape(raw)
    return re.sub(r"[ \t]{2,}", " ", raw)


def _has_markdown_heading(text: str) -> bool:
    return re.search(r"(?m)^#{1,3} \S", text) is not None


def _xml_prolog_has_doctype(data: bytes) -> bool:
    """True if the XML prolog declares a DOCTYPE.

    Scans only the prolog (a DOCTYPE legally precedes the root element), skipping
    the optional XML declaration / processing instructions and comments — so it
    neither scans the whole payload nor false-rejects a literal `<!DOCTYPE` that
    appears later inside CDATA or text.
    """
    index = 3 if data[:3] == b"\xef\xbb\xbf" else 0  # skip a UTF-8 BOM
    size = len(data)
    while index < size:
        if data[index:index + 1].isspace():
            index += 1
        elif data.startswith(b"<?", index):  # XML declaration / processing instruction
            end = data.find(b"?>", index)
            if end == -1:
                return False
            index = end + 2
        elif data.startswith(b"<!--", index):  # comment
            end = data.find(b"-->", index)
            if end == -1:
                return False
            index = end + 3
        elif data[index:index + 9].upper() == b"<!DOCTYPE":
            return True
        else:
            return False  # reached the root element (or non-prolog content)
    return False


def _parse_xml_secure(data: bytes):
    """Parse XML with external-entity / billion-laughs protection.

    Prefers defusedxml when installed; otherwise uses xml.etree but refuses any
    document carrying a DOCTYPE/DTD. Without a DTD there are no custom entity
    definitions (no billion-laughs), and xml.etree never fetches external
    entities by default (no XXE). Only used for FB2, EPUB container.xml, and the
    OPF package — none of which legitimately need a DOCTYPE.
    """
    try:
        import defusedxml.ElementTree as _defused_et  # type: ignore

        return _defused_et.fromstring(data)
    except ImportError:
        pass

    if _xml_prolog_has_doctype(data):
        raise RuntimeError("XML declares a DOCTYPE/DTD — refused (entity-expansion / XXE guard)")
    return ET.fromstring(data)


def _open_archive(path: Path) -> zipfile.ZipFile:
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise RuntimeError(f"Not a valid ZIP archive: {path} ({exc})")
    if len(archive.namelist()) > MAX_ARCHIVE_MEMBERS:
        archive.close()
        raise RuntimeError(f"Archive has too many members (zip-bomb guard): {path}")
    return archive


def _safe_zip_read(archive: zipfile.ZipFile, name: str, budget: list[int]) -> bytes:
    """Read one archive member into memory, enforcing a running size budget."""
    try:
        info = archive.getinfo(name)
    except KeyError:
        raise RuntimeError(f"Missing archive member: {name}")
    if info.file_size > budget[0]:
        raise RuntimeError(f"Archive member exceeds size budget (zip-bomb guard): {name}")
    data = archive.read(name)
    budget[0] -= len(data)
    if budget[0] < 0:
        raise RuntimeError("Archive uncompressed size exceeds the safety cap (zip-bomb guard)")
    return data


def validate_explicit_source_path(path: Path) -> None:
    sensitive_parts = [
        part
        for index, part in enumerate(path.parts)
        if is_sensitive_dir_name(part) and not (index == 1 and path.parts[0] == "/" and part == "private")
    ]
    if sensitive_parts or is_sensitive_file_name(path.name):
        raise RuntimeError(
            f"Refusing sensitive-looking source path: {path}"
        )
