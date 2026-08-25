"""
Codebase Retrieval Service

Implements a lightweight code-aware retrieval pipeline:
1. File indexing: reads all source files in the project
2. Keyword matching: scores files by error token presence
3. File path relevance: boosts auth-related files for auth errors
4. Error token matching: regex patterns for common error signatures
5. File path resolution: resolves target repository file path from evidence

Returns the most relevant code snippets without sending the entire codebase.
"""
import os
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# File extensions to index
INDEXED_EXTENSIONS = {".py", ".js", ".ts", ".java", ".go", ".rs", ".rb", ".php"}

# Directories to skip
SKIP_DIRS = {"__pycache__", ".pytest_cache", ".venv", "venv", "node_modules", ".git", "dist", "build"}

# Maximum characters per file to index
MAX_FILE_CHARS = 8000

# Path relevance keywords: if error contains these, boost files whose paths contain matching terms
PATH_RELEVANCE_MAP = {
    "auth": ["auth", "login", "jwt", "token", "credentials", "session"],
    "db": ["database", "db", "model", "schema", "migration", "sql"],
    "api": ["api", "route", "endpoint", "handler", "view", "controller"],
    "test": ["test", "spec"],
    "config": ["config", "settings", "env", "environment"],
}


class CodebaseRetriever:
    """
    Lightweight codebase-aware retrieval for error analysis.
    
    Does NOT use embeddings or vector databases - uses fast keyword/regex matching
    for maximum reliability and speed in demo environments.
    """

    def __init__(self, project_path: str):
        self.project_path = os.path.abspath(project_path)
        self.file_index: Dict[str, str] = {}  # path -> content
        self._indexed = False

    def index_files(self) -> None:
        """Scan and index all source files in the project."""
        self.file_index = {}

        if not os.path.exists(self.project_path):
            logger.warning(f"[Retriever] Project path not found: {self.project_path}")
            return

        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for fname in files:
                _, ext = os.path.splitext(fname)
                if ext not in INDEXED_EXTENSIONS:
                    continue
                full_path = os.path.join(root, fname)
                rel_path = os.path.relpath(full_path, self.project_path).replace("\\", "/")
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(MAX_FILE_CHARS)
                    self.file_index[rel_path] = content
                except Exception as e:
                    logger.debug(f"[Retriever] Could not read {full_path}: {e}")

        self._indexed = True
        logger.info(f"[Retriever] Indexed {len(self.file_index)} files from {self.project_path}")

    def retrieve(self, error_text: str, max_files: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieve the most relevant code files/snippets for a given error.
        
        Args:
            error_text: The error message/stack trace to analyze
            max_files: Maximum number of files to return
            
        Returns:
            List of dicts with 'file', 'content', 'relevance', 'matched_lines'
        """
        if not self._indexed:
            self.index_files()

        if not self.file_index:
            return []

        # Tokenize error text
        tokens = self._extract_tokens(error_text)
        scored = []

        for rel_path, content in self.file_index.items():
            score = self._score_file(rel_path, content, tokens, error_text)
            if score > 0:
                matched_lines = self._find_matched_lines(content, tokens)
                # Extract relevant snippet
                snippet = self._extract_snippet(content, matched_lines, tokens)
                scored.append({
                    "file": rel_path,
                    "content": snippet,
                    "relevance": round(score, 3),
                    "matched_lines": matched_lines[:5]
                })

        # Sort by relevance descending
        scored.sort(key=lambda x: x["relevance"], reverse=True)
        return scored[:max_files]

    def resolve_file(
        self,
        raw_file: Optional[str] = None,
        error_text: str = "",
        retrieved_files: Optional[List[str]] = None,
        selected_file: Optional[str] = None
    ) -> str:
        """
        Resolve a target repository file path from available evidence.
        Never returns 'unknown' if a real matching file exists in the project.
        """
        if not self._indexed:
            self.index_files()

        def clean_rel(path_str: str) -> str:
            if not path_str:
                return ""
            c = str(path_str).replace("demo-project/", "").replace("demo-project\\", "").strip()
            c = c.lstrip("/\\").replace("\\", "/")
            if ":" in c:
                parts = c.split(":")
                if parts[-1].isdigit():
                    c = ":".join(parts[:-1])
            return c.strip()

        def exists_rel(path_str: str) -> bool:
            c = clean_rel(path_str)
            if not c or c.lower() in ["unknown", "none", "null", "undefined"]:
                return False
            abs_p = os.path.abspath(os.path.join(self.project_path, c))
            return abs_p.startswith(self.project_path) and os.path.isfile(abs_p)

        # 1. Try raw_file from analyzer
        if raw_file and exists_rel(raw_file):
            return clean_rel(raw_file)

        # 2. Try selected_file if provided
        if selected_file and exists_rel(selected_file):
            return clean_rel(selected_file)

        # 3. Search error_text for filename regex matches
        if error_text:
            matches = re.findall(r'(?:File\s+["\']?|in\s+)?([a-zA-Z0-9_\-\/\\]+\.(?:py|js|ts|java|go|rs))', error_text)
            for m in matches:
                if exists_rel(m):
                    return clean_rel(m)
                base = os.path.basename(clean_rel(m))
                for indexed_rel in self.file_index.keys():
                    if os.path.basename(indexed_rel) == base:
                        return indexed_rel

        # 4. Check retrieved_files list
        if retrieved_files:
            for rf in retrieved_files:
                if exists_rel(rf):
                    return clean_rel(rf)

        # 5. Run retriever to find top matching file
        if error_text:
            results = self.retrieve(error_text, max_files=1)
            if results and exists_rel(results[0]["file"]):
                return clean_rel(results[0]["file"])

        # 6. Fallback to first non-test source file in project
        source_files = [f for f in self.file_index.keys() if "test" not in f.lower()]
        if source_files:
            return source_files[0]
        elif self.file_index:
            return list(self.file_index.keys())[0]

        return "unknown"

    def _extract_tokens(self, error_text: str) -> List[str]:
        """Extract meaningful tokens from error text."""
        raw_tokens = re.split(r"[\s,;:\"'()[\]{}\\|<>]+", error_text)
        tokens = []
        for t in raw_tokens:
            t = t.strip("._-/\\")
            if len(t) >= 3 and not t.isdigit():
                tokens.append(t.lower())

        file_refs = re.findall(r"[\w\-]+\.py", error_text)
        for ref in file_refs:
            name = ref.replace(".py", "")
            if name not in tokens:
                tokens.append(name)

        func_refs = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{3,}", error_text)
        for ref in func_refs[:10]:
            if ref.lower() not in tokens:
                tokens.append(ref.lower())

        return list(set(tokens))

    def _score_file(self, path: str, content: str, tokens: List[str], error_text: str) -> float:
        """Score a file for relevance to the error."""
        score = 0.0
        content_lower = content.lower()
        path_lower = path.lower()

        for token in tokens:
            count = content_lower.count(token)
            if count > 0:
                score += min(count * 0.5, 3.0)

        error_lower = error_text.lower()
        for category, category_tokens in PATH_RELEVANCE_MAP.items():
            if any(ct in error_lower for ct in category_tokens):
                if any(ct in path_lower for ct in category_tokens):
                    score += 3.0

        filename = os.path.basename(path)
        if filename in error_text or filename.replace(".py", "") in error_text:
            score += 5.0

        line_refs = re.findall(r":(\d+)", error_text)
        if line_refs and any(token in path_lower for token in tokens):
            score += 1.0

        if "test" in path_lower:
            score *= 0.7

        return score

    def _find_matched_lines(self, content: str, tokens: List[str]) -> List[str]:
        """Find lines in content that match any token."""
        matched = []
        for i, line in enumerate(content.split("\n"), 1):
            line_lower = line.lower()
            if any(token in line_lower for token in tokens):
                matched.append(f"L{i}: {line.strip()}")
        return matched

    def _extract_snippet(self, content: str, matched_lines: List[str], tokens: List[str]) -> str:
        """Extract a relevant snippet around matched lines."""
        if not matched_lines:
            return content[:2000]

        lines = content.split("\n")
        first_match_idx = 0
        for i, line in enumerate(lines):
            line_lower = line.lower()
            if any(token in line_lower for token in tokens):
                first_match_idx = i
                break

        start = max(0, first_match_idx - 20)
        end = min(len(lines), first_match_idx + 30)
        snippet = "\n".join(lines[start:end])

        return snippet[:3000]
