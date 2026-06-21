#!/usr/bin/env python3
"""Book extractors (FB2 / EPUB) — standard library only, no new hard dependencies.

Both extractors GUARANTEE markdown headings (#/##/###) in the returned text so the
heading-aware chunker (mp_chunk.split_text) can build a real ## TOC. Sits beside
mp_chunk one layer above mp_safety; it owns the `_HEADING_RE` module regex.
"""

from __future__ import annotations

import html
import posixpath
import re
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

from mp_config import ExtractedDocument, MAX_ARCHIVE_TOTAL_BYTES
from mp_safety import (
    _decode_bytes,
    _has_markdown_heading,
    _open_archive,
    _parse_xml_secure,
    _safe_zip_read,
    normalize_text,
)


def _local_name(tag: object) -> str:
    """Strip an `{namespace}` prefix from an ElementTree tag."""
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1]


def _element_text(elem) -> str:
    """All descendant text of an element, with whitespace collapsed."""
    return re.sub(r"\s+", " ", "".join(elem.itertext())).strip()


def _read_fb2_bytes(path: Path) -> bytes:
    """Return raw FB2 XML bytes, transparently unwrapping a `.fb2.zip` container."""
    if path.name.lower().endswith(".zip"):
        with _open_archive(path) as archive:
            members = [n for n in archive.namelist() if n.lower().endswith(".fb2")]
            if not members:
                raise RuntimeError(f"No .fb2 entry inside archive: {path}")
            return _safe_zip_read(archive, members[0], [MAX_ARCHIVE_TOTAL_BYTES])
    return path.read_bytes()


def _fb2_render(node, depth: int, lines: list[str]) -> None:
    """Recursively render an FB2 <body>/<section> subtree into markdown lines.

    <section> nesting depth maps to heading level (capped at ###). The section's
    own <title> becomes the heading; every other leaf element contributes body
    text. <title> elements are skipped here because the enclosing section/body
    already emitted them as a heading.
    """
    for child in node:
        name = _local_name(child.tag)
        if name == "section":
            title = ""
            for grandchild in child:
                if _local_name(grandchild.tag) == "title":
                    title = _element_text(grandchild)
                    break
            if title:
                lines.append("")
                lines.append(f"{'#' * min(depth, 3)} {title}")
                lines.append("")
            _fb2_render(child, depth + 1, lines)
        elif name == "title":
            continue
        else:
            text = _element_text(child)
            if text:
                lines.append(text)
                lines.append("")


def extract_fb2(path: Path) -> ExtractedDocument:
    raw = _read_fb2_bytes(path)
    try:
        root = _parse_xml_secure(raw)
    except (ET.ParseError, ValueError) as exc:
        raise RuntimeError(f"Malformed FB2 (XML parse failed) in {path}: {exc}")

    book_title = ""
    for elem in root.iter():
        if _local_name(elem.tag) == "book-title":
            book_title = _element_text(elem)
            break

    bodies = [e for e in root if _local_name(e.tag) == "body"]
    if not bodies:
        bodies = [e for e in root.iter() if _local_name(e.tag) == "body"]
    if not bodies:
        raise RuntimeError(f"FB2 has no <body> content: {path}")

    lines: list[str] = []
    if book_title:
        lines.extend([f"# {book_title}", ""])
    try:
        for body in bodies:
            body_title = ""
            for child in body:
                if _local_name(child.tag) == "title":
                    body_title = _element_text(child)
                    break
            if body_title and body_title != book_title:
                lines.extend([f"## {body_title}", ""])
            _fb2_render(body, 2, lines)
    except RecursionError as exc:
        raise RuntimeError(f"FB2 nesting too deep to render in {path}: {exc}")

    text = normalize_text("\n".join(lines))
    if not _has_markdown_heading(text):
        # Contract: FB2 output always carries at least one heading.
        text = normalize_text(f"# {book_title or path.stem}\n\n{text}")

    return ExtractedDocument(
        source=str(path),
        title=book_title or path.name,
        kind="fb2",
        text=text,
        has_headings=True,
    )


_HEADING_RE = re.compile(r"(?is)<h([1-3])\b[^>]*>(.*?)</h\1>")


def _xhtml_to_markdown(raw: str) -> str:
    """Convert an EPUB spine XHTML document to text, preserving <h1..h3> as
    markdown headings. The plain `html_to_text` strips *all* tags (including
    headings); here headings are promoted first, then the rest is flattened.
    """
    raw = re.sub(r"(?is)<(script|style)\b.*?>.*?</\1>", " ", raw)

    def _heading_sub(match: "re.Match[str]") -> str:
        level = int(match.group(1))
        inner = re.sub(r"(?s)<[^>]+>", " ", match.group(2))
        inner = re.sub(r"\s+", " ", html.unescape(inner)).strip()
        return f"\n\n{'#' * level} {inner}\n\n" if inner else " "

    raw = _HEADING_RE.sub(_heading_sub, raw)
    # Promote block boundaries to newlines so paragraphs survive the tag strip.
    raw = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    raw = re.sub(r"(?i)</(p|div|section|article|li|tr|blockquote)\s*>", "\n", raw)
    body = re.sub(r"(?s)<[^>]+>", " ", raw)
    body = html.unescape(body)
    return re.sub(r"[ \t]{2,}", " ", body)


def _epub_member(opf_dir: str, href: str) -> str:
    """Resolve a manifest href (relative to the OPF dir) to a normalized zip
    member name, rejecting any path that would escape the archive root."""
    href = urllib.parse.unquote(href.split("#", 1)[0])
    member = posixpath.normpath(posixpath.join(opf_dir, href))
    if member.startswith("..") or member.startswith("/"):
        raise RuntimeError(f"EPUB manifest href escapes the archive root: {href}")
    return member


def extract_epub(path: Path) -> ExtractedDocument:
    with _open_archive(path) as archive:
        names = set(archive.namelist())
        budget = [MAX_ARCHIVE_TOTAL_BYTES]

        container_name = "META-INF/container.xml"
        if container_name not in names:
            raise RuntimeError(f"EPUB missing {container_name}: {path}")
        try:
            container = _parse_xml_secure(_safe_zip_read(archive, container_name, budget))
        except (ET.ParseError, ValueError) as exc:
            raise RuntimeError(f"EPUB has malformed container.xml in {path}: {exc}")

        opf_path = ""
        for elem in container.iter():
            if _local_name(elem.tag) == "rootfile":
                opf_path = (elem.get("full-path") or "").strip()
                if opf_path:
                    break
        if not opf_path:
            raise RuntimeError(f"EPUB container.xml has no rootfile path: {path}")
        opf_path = posixpath.normpath(opf_path)
        if opf_path not in names:
            raise RuntimeError(f"EPUB OPF package not found ({opf_path}): {path}")

        try:
            opf = _parse_xml_secure(_safe_zip_read(archive, opf_path, budget))
        except (ET.ParseError, ValueError) as exc:
            raise RuntimeError(f"EPUB has malformed OPF package in {path}: {exc}")

        manifest: dict[str, str] = {}
        spine: list[str] = []
        book_title = ""
        for elem in opf.iter():
            name = _local_name(elem.tag)
            if name == "item":
                item_id = elem.get("id")
                href = elem.get("href")
                if item_id and href:
                    manifest[item_id] = href
            elif name == "itemref":
                idref = elem.get("idref")
                if idref:
                    spine.append(idref)
            elif name == "title" and not book_title:  # dc:title
                book_title = _element_text(elem)

        opf_dir = posixpath.dirname(opf_path)
        parts: list[str] = []
        for idref in spine:
            href = manifest.get(idref)
            if not href:
                continue
            member = _epub_member(opf_dir, href)
            if member not in names:
                continue
            chapter = _xhtml_to_markdown(_decode_bytes(_safe_zip_read(archive, member, budget))).strip()
            if chapter:
                parts.append(chapter)

    body_text = normalize_text("\n\n".join(parts))
    if not body_text:
        raise RuntimeError(f"EPUB produced no readable text: {path}")
    if not _has_markdown_heading(body_text):
        body_text = normalize_text(f"# {book_title or path.stem}\n\n{body_text}")

    return ExtractedDocument(
        source=str(path),
        title=book_title or path.name,
        kind="epub",
        text=body_text,
        has_headings=True,
    )


def _book_kind(path: Path) -> str | None:
    """Return "fb2"/"epub" for a supported book file, else None.

    Detected by name (not a single `.suffix`) so the composite `.fb2.zip`
    container — whose `Path.suffix` is `.zip` — is routed to the FB2 extractor.
    """
    name = path.name.lower()
    if name.endswith(".fb2.zip") or name.endswith(".fb2"):
        return "fb2"
    if name.endswith(".epub"):
        return "epub"
    return None
