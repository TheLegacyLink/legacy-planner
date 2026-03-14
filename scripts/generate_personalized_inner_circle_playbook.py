#!/usr/bin/env python3
"""
Generate a personalized Inner Circle VIP onboarding PDF with QR codes.
"""

from pathlib import Path
import argparse
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.graphics.barcode import qr, createBarcodeDrawing


def clean(v: str) -> str:
    return str(v or '').strip()


def make_qr_cell(url: str, label: str):
    if not url:
        return Paragraph(f"<b>{label}</b><br/>Not provided", STYLES['small'])

    size = 1.05 * inch
    try:
        d = createBarcodeDrawing('QR', value=url, barLevel='M', width=size, height=size)
    except Exception:
        widget = qr.QrCodeWidget(url)
        bounds = widget.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        from reportlab.graphics.shapes import Drawing  # local import fallback
        d = Drawing(size, size)
        d.add(widget)
        d.scale(size / w, size / h)

    return Table(
        [[Paragraph(f"<b>{label}</b>", STYLES['small'])], [d], [Paragraph(url, STYLES['tiny'])]],
        colWidths=[2.0 * inch]
    )


def page_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#0B1020'))
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor('#293243'))
    canvas.setLineWidth(0.8)
    canvas.line(34, 742, letter[0] - 34, 742)
    canvas.setFillColor(colors.HexColor('#93A0B5'))
    canvas.setFont('Helvetica', 8)
    canvas.drawString(34, 20, 'The Legacy Link • Personalized VIP Onboarding')
    canvas.drawRightString(letter[0] - 34, 20, f'Page {doc.page}')
    canvas.restoreState()


def build(args):
    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out),
        pagesize=letter,
        leftMargin=34,
        rightMargin=34,
        topMargin=44,
        bottomMargin=30,
        title='Legacy Link VIP Playbook',
        author='The Legacy Link',
    )

    story = []

    story.append(Paragraph('THE LEGACY LINK', STYLES['muted']))
    story.append(Paragraph('Personalized Inner Circle VIP Access', STYLES['title']))
    story.append(Paragraph('Your custom onboarding quickstart with direct QR shortcuts.', STYLES['sub']))

    info_rows = [
        ['Agent Name', clean(args.name) or 'Not provided'],
        ['Hub Login Email', clean(args.email) or 'Not provided'],
        ['Coach Name', clean(args.coach) or 'Legacy Link Coach'],
    ]
    info = Table(info_rows, colWidths=[1.6 * inch, 4.9 * inch])
    info.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#111827')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#E5E7EB')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2A3142')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#2A3142')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(info)
    story.append(Spacer(1, 12))

    story.append(Paragraph('Step Order (Do in this order)', STYLES['h1']))
    steps = [
        '1) Sign your Inner Circle contract',
        '2) Join Telegram and post your quick intro',
        '3) Join Legacy Link App (CRM)',
        '4) Log into your Inner Circle Hub',
        '5) Complete your first 72-hour execution sprint',
    ]
    for s in steps:
        story.append(Paragraph(f'• {s}', STYLES['body']))

    story.append(Spacer(1, 10))
    story.append(Paragraph('VIP QR Quick Access', STYLES['h1']))

    qr_table = Table([
        [
            make_qr_cell(clean(args.hub), 'Hub'),
            make_qr_cell(clean(args.app), 'App'),
            make_qr_cell(clean(args.contract), 'Contract'),
        ],
        [
            make_qr_cell(clean(args.telegram), 'Telegram'),
            make_qr_cell(clean(args.playbook), 'Playbook'),
            make_qr_cell(clean(args.sponsorship), 'Sponsorship'),
        ],
    ], colWidths=[2.2 * inch, 2.2 * inch, 2.2 * inch])
    qr_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#111827')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2A3142')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#2A3142')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(qr_table)

    story.append(Spacer(1, 12))
    story.append(Paragraph('Daily Standard (Non-Negotiables)', STYLES['h1']))
    standards = [
        'Work new leads',
        'Follow up warm leads',
        'Book at least one conversation',
        'Post one piece of content',
        'Update tracker before end of day',
    ]
    for s in standards:
        story.append(Paragraph(f'• {s}', STYLES['body']))

    story.append(Spacer(1, 8))
    story.append(Paragraph('Need help? support@thelegacylink.com', STYLES['sub']))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--output', required=True)
    p.add_argument('--name', default='')
    p.add_argument('--email', default='')
    p.add_argument('--coach', default='')
    p.add_argument('--hub', default='')
    p.add_argument('--app', default='')
    p.add_argument('--contract', default='')
    p.add_argument('--telegram', default='')
    p.add_argument('--playbook', default='')
    p.add_argument('--sponsorship', default='')
    return p.parse_args()


BASE = getSampleStyleSheet()
STYLES = {
    'title': ParagraphStyle('title', parent=BASE['Title'], fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=colors.HexColor('#E6D1A6'), spaceAfter=8),
    'sub': ParagraphStyle('sub', parent=BASE['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=colors.HexColor('#9CA3AF'), spaceAfter=8),
    'muted': ParagraphStyle('muted', parent=BASE['Normal'], fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#9CA3AF'), spaceAfter=3),
    'h1': ParagraphStyle('h1', parent=BASE['Heading1'], fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=colors.HexColor('#C8A96B'), spaceBefore=6, spaceAfter=5),
    'body': ParagraphStyle('body', parent=BASE['Normal'], fontName='Helvetica', fontSize=10.5, leading=14.5, textColor=colors.HexColor('#E5E7EB'), spaceAfter=3),
    'small': ParagraphStyle('small', parent=BASE['Normal'], fontName='Helvetica', fontSize=9, leading=11, textColor=colors.HexColor('#E5E7EB'), spaceAfter=3),
    'tiny': ParagraphStyle('tiny', parent=BASE['Normal'], fontName='Helvetica', fontSize=7, leading=9, textColor=colors.HexColor('#9CA3AF')),
}


if __name__ == '__main__':
    args = parse_args()
    build(args)
    print(f'Generated: {args.output}')
