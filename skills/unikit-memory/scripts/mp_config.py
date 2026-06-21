#!/usr/bin/env python3
"""Configuration constants and the shared ExtractedDocument record.

Foundation module for material-prep — it imports no sibling modules. Holds the
extension sets, archive-safety caps, skip/sensitive name lists, the tool marker
identity, and the ExtractedDocument dataclass passed between the extract and
output stages.
"""

from __future__ import annotations

from dataclasses import dataclass


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
