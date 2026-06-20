#!/usr/bin/env python3
"""Prepare large material for unikit-memory knowledge-base research.

The script extracts text from local files, folders, and URLs, then writes
chunked markdown files plus a manifest. It intentionally leaves the output
directory for the caller to read and remove after the rule is written.
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import html
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


TOOL_MARKER_FILE = ".unikit-memory-material-prep.json"
TOOL_MARKER_NAME = "unikit/unikit-memory/material-prep"
TOOL_MARKER_VERSION = "1"

TEXT_EXTENSIONS = {
    ".adoc",
    ".c",
    ".cc",
    ".cpp",
    ".cs",
    ".css",
    ".csv",
    ".go",
    ".h",
    ".hpp",
    ".html",
    ".htm",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".md",
    ".php",
    ".py",
    ".rb",
    ".rs",
    ".rst",
    ".scss",
    ".sh",
    ".sql",
    ".svelte",
    ".swift",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
}

PDF_EXTENSIONS = {".pdf"}

# Book formats extracted with the standard library only (no new hard dependencies):
#   FB2  = xml.etree (+ zipfile for the .fb2.zip container)
#   EPUB = zipfile (+ the existing html_to_text helper, used carefully for headings)
BOOK_EXTENSIONS = {".fb2", ".epub"}

# Recognized-but-rejected: MOBI/AZW are binary/proprietary Kindle containers. We refuse
# them explicitly (with a "give me an EPUB export" message) instead of failing generically.
REJECTED_BOOK_EXTENSIONS = {".mobi", ".azw", ".azw3"}

# Archive safety caps (zip-bomb guard) — members are read into memory, never extracted
# to disk, so zip-slip cannot apply to on-disk paths; href resolution is still normalized.
MAX_ARCHIVE_TOTAL_BYTES = 200 * 1024 * 1024  # 200 MiB of uncompressed members per archive
MAX_ARCHIVE_MEMBERS = 10000

SKIP_DIRS = {
    ".cache",
    ".git",
    ".hg",
    ".next",
    ".nuxt",
    ".svn",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "vendor",
    "__pycache__",
}

SENSITIVE_DIR_NAMES = {
    ".unikit",
    ".aws",
    ".azure",
    ".claude",
    ".codex",
    ".config",
    ".cursor",
    ".gcp",
    ".github",
    ".kube",
    ".ssh",
    ".vscode",
    "credential",
    "credentials",
    "private",
    "secret",
    "secrets",
}

SENSITIVE_FILE_PATTERNS = (
    ".env",
    ".env.*",
    "*credential*",
    "*credentials*",
    "*password*",
    "*passwd*",
    "*private*",
    "*secret*",
    "*token*",
    "*.key",
    "*.key.*",
    "id_dsa*",
    "id_ecdsa*",
    "id_ed25519*",
    "id_rsa*",
    "known_hosts",
)


@dataclass
class ExtractedDocument:
    source: str
    title: str
    kind: str
    text: str
    # True only for structured sources whose extracted `text` is guaranteed to carry
    # markdown headings (#/##/###): .md, FB2, EPUB. Drives heading-aware chunking in
    # split_text(). False for PDF/HTML/plain-text/code, where `# ...` is not a heading
    # (e.g. Python/shell comments) — those fall back to the structure-blind greedy packer.
    has_headings: bool = False


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


def extract_pdf_with_python(path: Path) -> str | None:
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        pass

    try:
        from PyPDF2 import PdfReader  # type: ignore

        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        pass

    try:
        from pdfminer.high_level import extract_text  # type: ignore

        return extract_text(str(path))
    except Exception:
        return None


def extract_pdf(path: Path) -> str:
    text = extract_pdf_with_python(path)
    if text and text.strip():
        return text

    # Reached when the Python extractors are unavailable OR present but produced no
    # usable text — both fall through to pdftotext, which silently drops non-Latin
    # (Cyrillic) glyphs. Make that degradation loud instead of silent.
    print(
        f"WARN: Python PDF extractors unavailable or produced no text for {path}; "
        f"falling back to pdftotext — non-Latin (e.g. Cyrillic) text may be dropped. "
        f"For robust extraction install a Python PDF library: pip install pypdf",
        file=sys.stderr,
    )

    pdftotext = shutil.which("pdftotext")
    if pdftotext:
        result = subprocess.run(
            [pdftotext, "-layout", str(path), "-"],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout

    raise RuntimeError(
        f"Could not extract PDF text from {path}. Install pypdf, PyPDF2, pdfminer.six, or pdftotext."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Book extractors (FB2 / EPUB) — standard library only, no new hard dependencies.
# Both GUARANTEE markdown headings (#/##/###) in the returned text so the
# heading-aware chunker (split_text) can build a real ## TOC.
# ─────────────────────────────────────────────────────────────────────────────


def _local_name(tag: object) -> str:
    """Strip an `{namespace}` prefix from an ElementTree tag."""
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1]


def _element_text(elem) -> str:
    """All descendant text of an element, with whitespace collapsed."""
    return re.sub(r"\s+", " ", "".join(elem.itertext())).strip()


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


def convert_github_blob_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc != "github.com":
        return url

    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 5 and parts[2] == "blob":
        owner, repo, _, branch = parts[:4]
        rest = "/".join(parts[4:])
        raw_path = "/".join([owner, repo, branch, rest])
        return urllib.parse.urlunparse(("https", "raw.githubusercontent.com", raw_path, "", "", ""))

    return url


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


def download_url(url: str, work_dir: Path) -> Path:
    download_url_value = convert_github_blob_url(url)
    parsed = urllib.parse.urlparse(download_url_value)
    basename = Path(urllib.parse.unquote(parsed.path)).name or "downloaded-source"
    if "." not in basename:
        basename += ".html"
    target = work_dir / basename

    request = urllib.request.Request(
        download_url_value,
        headers={"User-Agent": "unikit-memory/1.0"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def is_allowed_folder_file(path: Path, root: Path) -> bool:
    try:
        visible_relative = path.relative_to(root)
    except ValueError:
        return False

    if has_hidden_part(visible_relative):
        return False
    if has_sensitive_part(visible_relative):
        return False
    if path.is_symlink():
        # Symlinks are never followed in this port (no opt-in flag).
        return False

    return True


def iter_folder_files(root: Path) -> Iterable[Path]:
    for current_root, dirs, files in os.walk(root):
        kept_dirs = []
        for dirname in sorted(dirs):
            dir_path = Path(current_root) / dirname
            if dir_path.is_symlink():
                continue
            if dirname in SKIP_DIRS:
                continue
            if is_hidden_name(dirname):
                continue
            if is_sensitive_dir_name(dirname):
                continue
            kept_dirs.append(dirname)
        dirs[:] = kept_dirs

        for filename in sorted(files):
            if is_hidden_name(filename):
                continue
            if is_sensitive_file_name(filename):
                continue
            path = Path(current_root) / filename
            if path.suffix.lower() in REJECTED_BOOK_EXTENSIONS:
                # Recognized-but-rejected inside a folder. Warn by name HERE (this is the
                # single warning channel for the folder case) and do NOT iterate it — that
                # keeps it from reaching extract_path's reject branch, whose RuntimeError
                # would surface a second warning via extract_source's catch.
                print(
                    f"warning: skipping {path} — MOBI/Kindle format is not supported; "
                    f"provide an EPUB export instead (coverage gap for this file)",
                    file=sys.stderr,
                )
                continue
            is_book = _book_kind(path) is not None
            allowed = is_book or path.suffix.lower() in TEXT_EXTENSIONS | PDF_EXTENSIONS
            if allowed and is_allowed_folder_file(path, root):
                yield path


def extract_path(path: Path, label: str | None = None) -> ExtractedDocument:
    suffix = path.suffix.lower()
    title = label or path.name

    # Book formats first — they own the structure-aware (heading-guaranteed) path and
    # must win over the generic text/zip routing (e.g. `.fb2.zip` whose suffix is `.zip`).
    book_kind = _book_kind(path)
    if book_kind == "fb2":
        return extract_fb2(path)
    if book_kind == "epub":
        return extract_epub(path)
    if suffix in REJECTED_BOOK_EXTENSIONS:
        raise RuntimeError(
            f"Cannot process MOBI/Kindle format ({suffix}) — it is a binary/proprietary "
            f"container this helper does not read. Provide an EPUB export instead: {path}"
        )

    if suffix in PDF_EXTENSIONS:
        text = extract_pdf(path)
        kind = "pdf"
        has_headings = False
    elif suffix in {".html", ".htm"}:
        text = html_to_text(read_text_file(path))
        kind = "html"
        has_headings = False
    elif suffix in TEXT_EXTENSIONS:
        text = read_text_file(path)
        kind = "text"
        # Only markdown carries real headings; `# ...` in .py/.sh/.rb is a comment, so
        # those (and every other code/plain-text extension) stay structure-blind.
        has_headings = suffix == ".md"
    else:
        raise RuntimeError(f"Unsupported file type: {path}")

    return ExtractedDocument(
        source=str(path),
        title=title,
        kind=kind,
        text=normalize_text(text),
        has_headings=has_headings,
    )


def extract_source(source: str, work_dir: Path) -> list[ExtractedDocument]:
    if re.match(r"^https?://", source):
        downloaded = download_url(source, work_dir)
        doc = extract_path(downloaded, label=source)
        doc.source = source
        return [doc]

    path = Path(source).expanduser().resolve()
    validate_explicit_source_path(path)

    if path.is_dir():
        docs = []
        for file_path in iter_folder_files(path):
            try:
                docs.append(extract_path(file_path))
            except RuntimeError as exc:
                print(f"warning: {exc}", file=sys.stderr)
        return docs

    if path.is_file():
        return [extract_path(path)]

    raise RuntimeError(f"Source not found: {source}")


_MD_HEADING_LINE_RE = re.compile(r"^(#{1,3}) +(\S.*?)\s*$")


def _greedy_pack(text: str, chunk_chars: int) -> list[str]:
    """Structure-blind blank-line greedy packer (the pre-heading behavior).

    Used as the fallback for sources without guaranteed headings (PDF, HTML,
    plain text, code) so nothing regresses.
    """
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        piece_len = len(paragraph) + 2
        if current and current_len + piece_len > chunk_chars:
            chunks.append("\n\n".join(current).strip())
            current = []
            current_len = 0
        if piece_len > chunk_chars:
            for start in range(0, len(paragraph), chunk_chars):
                chunks.append(paragraph[start : start + chunk_chars].strip())
            continue
        current.append(paragraph)
        current_len += piece_len

    if current:
        chunks.append("\n\n".join(current).strip())

    return [chunk for chunk in chunks if chunk]


def _split_into_sections(text: str) -> list[tuple[tuple[int, str] | None, str]]:
    """Split markdown into (heading, body) sections at #/##/### boundaries.

    A leading (None, body) section captures any preamble before the first
    heading. heading is a (level, title) tuple.
    """
    sections: list[tuple[tuple[int, str] | None, str]] = []
    cur_heading: tuple[int, str] | None = None
    cur_lines: list[str] = []

    def emit() -> None:
        body = "\n".join(cur_lines).strip()
        if cur_heading is not None or body:
            sections.append((cur_heading, body))

    for line in text.split("\n"):
        match = _MD_HEADING_LINE_RE.match(line)
        if match:
            emit()
            cur_heading = (len(match.group(1)), match.group(2).strip())
            cur_lines = []
        else:
            cur_lines.append(line)
    emit()
    return sections


def _emit_large_section(
    heading: tuple[int, str] | None,
    body: str,
    chunk_chars: int,
    chunks: list[str],
    heading_map: list[dict],
) -> None:
    """Split a single oversized section across several chunks, tagging
    continuations with `(cont. k/n)` and keeping the heading on each."""
    head_line = f"{'#' * heading[0]} {heading[1]}" if heading else ""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    pieces: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) > chunk_chars:
            for start in range(0, len(paragraph), chunk_chars):
                pieces.append(paragraph[start : start + chunk_chars].strip())
        else:
            pieces.append(paragraph)

    sub_chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for piece in pieces:
        piece_len = len(piece) + 2
        if current and current_len + piece_len > chunk_chars:
            sub_chunks.append("\n\n".join(current).strip())
            current = []
            current_len = 0
        current.append(piece)
        current_len += piece_len
    if current:
        sub_chunks.append("\n\n".join(current).strip())
    if not sub_chunks:
        sub_chunks = [""]

    total = len(sub_chunks)
    for index, sub in enumerate(sub_chunks, start=1):
        if index == 1:
            top = head_line
        elif head_line:
            top = f"{head_line} (cont. {index}/{total})"
        else:
            top = f"(cont. {index}/{total})"
        chunk_text = (top + ("\n\n" if top and sub else "") + sub).strip()
        chunks.append(chunk_text)
        if heading:
            heading_map.append(
                {
                    "level": heading[0],
                    "title": heading[1],
                    "chunk": len(chunks),
                    # The first sub-chunk is the section head, not a continuation.
                    "cont": None if total == 1 or index == 1 else f"{index}/{total}",
                }
            )


def _pack_sections(
    sections: list[tuple[tuple[int, str] | None, str]], chunk_chars: int
) -> tuple[list[str], list[dict]]:
    """Heading-aware greedy packer. A heading is never orphaned (it always
    travels with its body); small sections group up to chunk_chars; oversized
    ones are split with `(cont. k/n)` markers. Builds a heading→chunk map."""
    chunks: list[str] = []
    heading_map: list[dict] = []
    cur_parts: list[str] = []
    cur_len = 0

    def flush() -> None:
        nonlocal cur_parts, cur_len
        if cur_parts:
            chunks.append("\n\n".join(cur_parts).strip())
            cur_parts = []
            cur_len = 0

    for heading, body in sections:
        head_line = f"{'#' * heading[0]} {heading[1]}" if heading else ""
        seg = (head_line + ("\n\n" if head_line and body else "") + body).strip()
        if not seg:
            continue
        seg_len = len(seg) + 2
        if seg_len <= chunk_chars:
            if cur_parts and cur_len + seg_len > chunk_chars:
                flush()
            cur_parts.append(seg)
            cur_len += seg_len
            if heading:
                heading_map.append(
                    {
                        "level": heading[0],
                        "title": heading[1],
                        "chunk": len(chunks) + 1,  # the chunk this buffer will become
                        "cont": None,
                    }
                )
        else:
            flush()
            _emit_large_section(heading, body, chunk_chars, chunks, heading_map)

    flush()
    return chunks, heading_map


def split_text(
    text: str, chunk_chars: int, has_headings: bool = False
) -> tuple[list[str], list[dict]]:
    """Chunk `text`, returning (chunks, heading_map).

    heading_map maps each markdown heading to the 1-based chunk index it appears
    in: a list of {"level", "title", "chunk", "cont"} dicts. It is empty for
    structure-blind sources (has_headings=False or no headings present), which
    fall back to the legacy greedy packer so nothing regresses.
    """
    if not has_headings or not _has_markdown_heading(text):
        return _greedy_pack(text, chunk_chars), []
    return _pack_sections(_split_into_sections(text), chunk_chars)


def _format_breadcrumb(entries: list[dict]) -> str:
    parts = []
    for entry in entries:
        title = entry["title"]
        if entry.get("cont"):
            title = f"{title} (cont. {entry['cont']})"
        parts.append(title)
    return " > ".join(parts)


def write_chunks(docs: list[ExtractedDocument], out_dir: Path, chunk_chars: int) -> dict:
    chunks_dir = out_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "tool": TOOL_MARKER_NAME,
        "tool_version": TOOL_MARKER_VERSION,
        "marker_file": TOOL_MARKER_FILE,
        "chunk_chars": chunk_chars,
        "documents": [],
        "chunks": [],
        "toc": [],
    }

    chunk_index = 1
    for doc in docs:
        doc_hash = hashlib.sha256(doc.text.encode("utf-8", errors="ignore")).hexdigest()[:12]
        # heading_map is per-document — its chunk indices are local to this doc, so the
        # ## TOC and breadcrumbs never collapse identical headings from different books.
        doc_chunks, heading_map = split_text(doc.text, chunk_chars, doc.has_headings)
        doc_record = {
            "source": doc.source,
            "title": doc.title,
            "kind": doc.kind,
            "characters": len(doc.text),
            "sha256_12": doc_hash,
            "chunk_count": len(doc_chunks),
        }
        manifest["documents"].append(doc_record)

        headings_by_local_chunk: dict[int, list[dict]] = {}
        for entry in heading_map:
            headings_by_local_chunk.setdefault(entry["chunk"], []).append(entry)

        local_chunk_files: dict[int, str] = {}
        for local_index, chunk in enumerate(doc_chunks, start=1):
            slug = slugify(Path(doc.title).stem or f"source-{chunk_index}")
            filename = f"{chunk_index:04d}-{slug}.md"
            chunk_path = chunks_dir / filename
            # Forward slashes so source-index.md (## TOC + Chunks table) stays portable
            # regardless of the OS the helper runs on.
            relative = chunk_path.relative_to(out_dir).as_posix()
            local_chunk_files[local_index] = relative

            header = [
                f"# Chunk {chunk_index:04d}",
                "",
                f"Source: {doc.source}",
                f"Document chunk: {local_index}/{len(doc_chunks)}",
                f"Characters: {len(chunk)}",
            ]
            breadcrumb = _format_breadcrumb(headings_by_local_chunk.get(local_index, []))
            if breadcrumb:
                header.append(f"Headings: {breadcrumb}")
            header.extend(["", "---", "", chunk, ""])
            chunk_path.write_text("\n".join(header), encoding="utf-8")

            manifest["chunks"].append(
                {
                    "file": relative,
                    "source": doc.source,
                    "document_chunk": local_index,
                    "characters": len(chunk),
                }
            )
            chunk_index += 1

        # Per-document TOC block (resolved to chunk filenames). Skipped for sources
        # without headings (greedy fallback returns an empty heading_map).
        if heading_map:
            manifest["toc"].append(
                {
                    "document": doc.title or doc.source,
                    "source": doc.source,
                    "entries": [
                        {
                            "level": entry["level"],
                            "title": entry["title"],
                            "cont": entry["cont"],
                            "file": local_chunk_files.get(entry["chunk"], ""),
                        }
                        for entry in heading_map
                    ],
                }
            )

    return manifest


def write_index(out_dir: Path, manifest: dict) -> None:
    lines = [
        "# Source Index",
        "",
        "Read this file first, then open only the chunks needed for the target rule.",
        "",
        "## Documents",
        "",
        "| Source | Kind | Characters | Chunks |",
        "|--------|------|------------|--------|",
    ]

    for doc in manifest["documents"]:
        lines.append(
            f"| {doc['source']} | {doc['kind']} | {doc['characters']} | {doc['chunk_count']} |"
        )

    # ## TOC — heading → chunk file(s), grouped per document so identical headings from
    # different books never collapse. Present only for structure-aware sources (FB2 /
    # EPUB / markdown); omitted entirely for the greedy fallback so the table stays clean.
    toc = manifest.get("toc", [])
    if toc:
        lines.extend(["", "## TOC", ""])
        for block in toc:
            lines.append(f"### {block['document']}")
            lines.append("")
            for entry in block["entries"]:
                indent = "  " * (entry["level"] - 1)
                title = entry["title"]
                if entry.get("cont"):
                    title = f"{title} (cont. {entry['cont']})"
                lines.append(f"{indent}- {title} → `{entry['file']}`")
            lines.append("")

    lines.extend(["", "## Chunks", "", "| File | Source | Characters |", "|------|--------|------------|"])
    for chunk in manifest["chunks"]:
        lines.append(f"| {chunk['file']} | {chunk['source']} | {chunk['characters']} |")

    (out_dir / "source-index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def marker_path(out_dir: Path) -> Path:
    return out_dir / TOOL_MARKER_FILE


def has_valid_marker(out_dir: Path) -> bool:
    try:
        marker = json.loads(marker_path(out_dir).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return marker.get("tool") == TOOL_MARKER_NAME and marker.get("version") == TOOL_MARKER_VERSION


def write_marker(out_dir: Path) -> None:
    marker_path(out_dir).write_text(
        json.dumps(
            {
                "tool": TOOL_MARKER_NAME,
                "version": TOOL_MARKER_VERSION,
                "run_id": str(uuid.uuid4()),
                "ownership": "This directory is generated working output and may be removed by material-prep.py --cleanup.",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def prepare_output_dir(out_dir: Path) -> None:
    if out_dir.exists():
        if not out_dir.is_dir():
            raise RuntimeError(f"Output path exists and is not a directory: {out_dir}")

        has_entries = any(out_dir.iterdir())
        if has_entries and not has_valid_marker(out_dir):
            raise RuntimeError(
                f"Refusing to write into non-empty output directory without {TOOL_MARKER_FILE}: {out_dir}"
            )

        if has_valid_marker(out_dir):
            shutil.rmtree(out_dir)

    out_dir.mkdir(parents=True, exist_ok=True)
    write_marker(out_dir)


def cleanup_output(path_value: str) -> int:
    target = Path(path_value).expanduser().resolve()
    if not target.exists():
        print(f"Already removed: {target}")
        return 0

    if not target.is_dir():
        raise RuntimeError(f"Cleanup target is not a directory: {target}")

    if not has_valid_marker(target):
        raise RuntimeError(f"Refusing cleanup because {TOOL_MARKER_FILE} is missing or invalid: {target}")

    shutil.rmtree(target)
    print(f"Removed: {target}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract and chunk material for unikit-memory knowledge-base research.")
    parser.add_argument("sources", nargs="*", help="Local file, local directory, or URL.")
    parser.add_argument("--out", help="Output directory. Defaults to a new temp directory.")
    parser.add_argument("--chunk-chars", type=int, default=18000, help="Approximate max characters per chunk.")
    parser.add_argument("--cleanup", help="Remove an extraction output directory created by this script.")
    return parser.parse_args()


def main() -> int:
    # Make our own prints survive non-ASCII (Cyrillic) on legacy Windows consoles —
    # without this, a status line carrying a Cyrillic path can raise UnicodeEncodeError.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass

    args = parse_args()
    if args.cleanup:
        if args.sources:
            raise RuntimeError("--cleanup cannot be combined with sources.")
        return cleanup_output(args.cleanup)

    if not args.sources:
        raise RuntimeError("At least one source is required unless --cleanup is used.")

    out_dir = Path(args.out).expanduser().resolve() if args.out else Path(tempfile.mkdtemp(prefix="unikit-memory-"))
    prepare_output_dir(out_dir)

    with tempfile.TemporaryDirectory(prefix="unikit-memory-download-") as download_dir:
        docs: list[ExtractedDocument] = []
        for source in args.sources:
            docs.extend(extract_source(source, Path(download_dir)))

    docs = [doc for doc in docs if doc.text.strip()]
    if not docs:
        raise RuntimeError("No readable text extracted from sources.")

    manifest = write_chunks(docs, out_dir, args.chunk_chars)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_index(out_dir, manifest)

    print(f"Output: {out_dir}")
    print(f"Documents: {len(manifest['documents'])}")
    print(f"Chunks: {len(manifest['chunks'])}")
    print(f"Index: {out_dir / 'source-index.md'}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
