"""Extrae y fragmenta el texto del libro para la base de conocimiento del asistente.

Uso:  python -I scripts/kb_extract.py   (lo llama «npm run kb:build»)
Entrada: recursos_iniciales/Vendiendo_arquitectura_de_0_a_100_FINAL.pdf (no se publica)
Salida:  .kb/chunks.json (no se publica; contiene texto del libro)

Cada fragmento lleva capítulo y página para que el asistente pueda citar la fuente.
"""
import json
import re
import sys
from pathlib import Path

try:
    import pymupdf as fitz  # PyMuPDF >= 1.24
except ImportError:  # pragma: no cover
    import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "recursos_iniciales" / "Vendiendo_arquitectura_de_0_a_100_FINAL.pdf"
OUT = ROOT / ".kb" / "chunks.json"

# Página inicial (numeración impresa = página del PDF) de cada capítulo; 0 = preliminares.
CHAPTER_STARTS = [
    (0, 3), (1, 19), (2, 21), (3, 23), (4, 33), (5, 35), (6, 39), (7, 47), (8, 57), (9, 97),
    (10, 99), (11, 103), (12, 107), (13, 115), (14, 119), (15, 129), (16, 137), (17, 147),
    (18, 155), (19, 195),
]
TARGET = 1100   # caracteres por fragmento (~280 tokens)
OVERLAP = 180   # solape para no partir ideas
RUNNING_HEADER = re.compile(r"^\s*Vendiendo arquitectura de 0 a 100_?\s*$")


def chapter_for(page: int) -> int:
    current = 0
    for n, start in CHAPTER_STARTS:
        if page >= start:
            current = n
    return current


PAGE_FOOTER = re.compile(r"(?:\n▪ ?)+\n[^\n]+\n\d{1,3}\s*$")   # «▪ ▪ título del capítulo / folio»
SPACED_CAPS = re.compile(r"^\s*(?:[A-ZÁÉÍÓÚÑ0-9·] ){4,}[A-ZÁÉÍÓÚÑ0-9·]\s*$")  # rótulos «C O R T E  D E…»


def clean_page(text: str) -> str:
    text = PAGE_FOOTER.sub("", "\n" + text.rstrip())
    lines = []
    for line in text.splitlines():
        if RUNNING_HEADER.match(line) or re.fullmatch(r"\s*\d{1,3}\s*", line) or SPACED_CAPS.match(line):
            continue  # encabezado corrido, folio y rótulos espaciados
        lines.append(line.rstrip())
    text = "\n".join(lines)
    text = re.sub("[‐­-]\n(?=[a-záéíóúñü])", "", text)   # palabras partidas por guion
    text = re.sub(r"(?<![.:;!?»”\"])\n(?!\n|[▪•\-–] )", " ", text)    # une líneas de un mismo párrafo
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_chunks(paragraphs):
    """Agrupa párrafos (página, texto) en fragmentos de ~TARGET caracteres con solape."""
    chunks, buf, page = [], "", None
    for pg, para in paragraphs:
        if page is None:
            page = pg
        if len(buf) + len(para) + 1 > TARGET and buf:
            chunks.append((page, buf.strip()))
            tail = buf[-OVERLAP:]
            cut = max(tail.find(". "), 0)
            buf, page = tail[cut + 2 if cut else 0:] + " ", pg
        while len(para) > TARGET * 1.6:  # párrafo larguísimo: corta por oraciones
            cut = para.rfind(". ", 0, TARGET) + 1 or TARGET
            buf += para[:cut] + " "
            chunks.append((page, buf.strip()))
            buf, para, page = "", para[cut:].strip(), pg
        buf += para + "\n"
    if buf.strip():
        chunks.append((page, buf.strip()))
    return chunks


def main() -> int:
    if not PDF.exists():
        print(f"No se encuentra el PDF del libro: {PDF}", file=sys.stderr)
        return 1
    doc = fitz.open(PDF)
    by_chapter: dict[int, list[tuple[int, str]]] = {}
    for i in range(2, doc.page_count):  # 1-2: portada y página falsa
        page_no = i + 1
        raw = doc[i].get_text("text")
        if raw.count("....") > 6:
            continue  # páginas de índice: el mapa de capítulos ya va aparte
        text = clean_page(raw)
        if len(text) < 40:
            continue
        for para in re.split(r"\n\s*\n|\n(?=[▪•] )", text):
            para = re.sub(r"\s+", " ", para).strip()
            if len(para) >= 25:
                by_chapter.setdefault(chapter_for(page_no), []).append((page_no, para))

    out = []
    for ch in sorted(by_chapter):
        for page, text in split_chunks(by_chapter[ch]):
            out.append({"id": len(out), "ch": ch, "page": page, "text": text})

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    chars = sum(len(c["text"]) for c in out)
    print(f"kb_extract: {len(out)} fragmentos · {chars:,} caracteres · {len(by_chapter)} secciones")
    return 0


if __name__ == "__main__":
    sys.exit(main())
