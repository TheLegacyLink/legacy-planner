#!/usr/bin/env python3
"""Apply Legacy Link branded overlay to an existing PDF without changing content."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Tuple

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = Path('/Users/emaniai/openclaw/workspace/Legacy-planner/legacy_link_pathways_sop.pdf')
DEFAULT_OUTPUT = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy_link_pathways_sop.pdf'
DEFAULT_BACKUP = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy_link_pathways_sop-original.pdf'


def build_overlay(page_w: float, page_h: float, title: str, page_num: int, total_pages: int) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))

    # Outer frame
    c.setStrokeColor(colors.HexColor('#2A3142'))
    c.setLineWidth(0.8)
    c.rect(18, 18, page_w - 36, page_h - 36, stroke=1, fill=0)

    # Premium header strip
    c.setFillColor(colors.HexColor('#0B1020'))
    c.rect(18, page_h - 36, page_w - 36, 18, stroke=0, fill=1)

    # Top accent line + left accent rail
    c.setStrokeColor(colors.HexColor('#C8A96B'))
    c.setLineWidth(1.15)
    c.line(30, page_h - 28, page_w - 30, page_h - 28)
    c.line(28, 30, 28, page_h - 30)

    # Watermark (very subtle)
    c.saveState()
    try:
        c.setFillAlpha(0.06)
    except Exception:
        pass
    c.setFillColor(colors.HexColor('#94A3B8'))
    c.setFont('Helvetica-Bold', 40)
    c.translate(page_w / 2, page_h / 2)
    c.rotate(35)
    c.drawCentredString(0, 0, 'THE LEGACY LINK')
    c.restoreState()

    # Footer line + footer labels
    c.setStrokeColor(colors.HexColor('#2A3142'))
    c.setLineWidth(0.8)
    c.line(30, 30, page_w - 30, 30)

    c.setFillColor(colors.HexColor('#6B7280'))
    c.setFont('Helvetica', 8)
    c.drawString(30, 18, f'The Legacy Link • {title}')
    c.drawRightString(page_w - 30, 18, f'Page {page_num} of {total_pages}')

    c.save()
    return buf.getvalue()


def enhance_pdf(input_path: Path, output_path: Path, title: str = 'Pathways SOP') -> Tuple[int, Path]:
    reader = PdfReader(str(input_path))
    writer = PdfWriter()

    for i, page in enumerate(reader.pages, start=1):
        w = float(page.mediabox.width)
        h = float(page.mediabox.height)

        overlay_pdf = PdfReader(io.BytesIO(build_overlay(w, h, title, i, len(reader.pages))))
        overlay_page = overlay_pdf.pages[0]

        page.merge_page(overlay_page)
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('wb') as f:
        writer.write(f)

    return len(reader.pages), output_path


def main():
    in_path = DEFAULT_INPUT
    out_path = DEFAULT_OUTPUT
    backup_path = DEFAULT_BACKUP

    if not in_path.exists():
        raise SystemExit(f'Input PDF not found: {in_path}')

    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_bytes(in_path.read_bytes())

    pages, out = enhance_pdf(in_path, out_path, title='Legacy Link Pathways SOP')

    # Also write a root copy for quick access if needed.
    root_copy = ROOT / 'legacy_link_pathways_sop.pdf'
    root_copy.write_bytes(out.read_bytes())

    print(f'Enhanced pages: {pages}')
    print(f'Output: {out}')
    print(f'Backup: {backup_path}')
    print(f'Root copy: {root_copy}')


if __name__ == '__main__':
    main()
