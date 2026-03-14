#!/usr/bin/env python3
"""Generate Legacy Link Comp Schedule + Bonuses v2 PDF."""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy-link-comp-schedule-bonuses-v2.pdf'


def page_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#0B1020'))
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor('#2A3142'))
    canvas.setLineWidth(0.8)
    canvas.line(34, 742, letter[0] - 34, 742)
    canvas.setFillColor(colors.HexColor('#9CA3AF'))
    canvas.setFont('Helvetica', 8)
    canvas.drawString(34, 20, 'The Legacy Link • Comp Schedule + Bonuses v2')
    canvas.drawRightString(letter[0] - 34, 20, f'Page {doc.page}')
    canvas.restoreState()


def styles():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('title', parent=base['Title'], fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=colors.HexColor('#E6D1A6'), spaceAfter=8),
        'sub': ParagraphStyle('sub', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=colors.HexColor('#AAB5C8'), spaceAfter=10),
        'h': ParagraphStyle('h', parent=base['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=colors.HexColor('#C8A96B'), spaceBefore=6, spaceAfter=4),
        'body': ParagraphStyle('body', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14.5, textColor=colors.HexColor('#E5E7EB'), spaceAfter=3),
        'small': ParagraphStyle('small', parent=base['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#AAB5C8'), spaceAfter=2),
    }


def box(title, rows, st):
    data = [[Paragraph(f'<b>{title}</b>', st['h'])]] + [[Paragraph(r, st['body'])] for r in rows]
    t = Table(data, colWidths=[6.75 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#111827')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2A3142')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return t


def build():
    st = styles()
    OUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=34,
        rightMargin=34,
        topMargin=44,
        bottomMargin=30,
        title='Legacy Link Comp Schedule + Bonuses v2',
        author='The Legacy Link'
    )

    story = []
    story.append(Paragraph('THE LEGACY LINK', st['small']))
    story.append(Paragraph('Comp Schedule + Bonuses (v2)', st['title']))
    story.append(Paragraph('Reference guide for agent payout categories and bonus opportunities.', st['sub']))
    story.append(Paragraph('Website: <b>https://thelegacylink.com</b>', st['body']))
    story.append(Spacer(1, 8))

    story.append(box('Core Compensation Categories', [
        '• Sponsorship Policy: flat payout model (fixed amount per approved policy event).',
        '• Bonus Policy: flat bonus payout model tied to qualified conditions.',
        '• Inner Circle Policy: premium flat payout model for qualified IC pathway.',
        '• Regular Policy: commission-based structure per policy type and carrier terms.',
        '• Juvenile Policy: dedicated commission model with reduced payout profile.'
    ], st))
    story.append(Spacer(1, 8))

    table = Table([
        ['Category', 'Model', 'Notes'],
        ['Sponsorship', 'Flat', 'Used in sponsorship pipeline milestones'],
        ['Bonus', 'Flat', 'Triggered by eligible bonus criteria'],
        ['Inner Circle', 'Flat', 'Premium IC payout class'],
        ['Regular', 'Commission', 'Carrier/policy dependent'],
        ['Juvenile', 'Commission', 'Specialized juvenile policy class'],
    ], colWidths=[1.6 * inch, 1.4 * inch, 3.75 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#111827')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#E5E7EB')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2A3142')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#2A3142')),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 8))

    story.append(box('Performance Bonus Layering (Guidance)', [
        '• Maintain daily execution consistency (new leads + follow-up + booked conversations).',
        '• Keep CRM data clean and same-day updated for qualification visibility.',
        '• Stay active in approved workflow steps to avoid payout delays.',
        '• Use coach review checkpoints weekly to optimize close and bonus conversion.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(box('Important Notes', [
        '• Final payout amounts and timing follow current company policy and carrier rules.',
        '• This guide is operational reference, not a legal/tax document.',
        '• For current policy specifics, use your onboarding docs + coach directives.'
    ], st))

    story.append(Spacer(1, 10))
    story.append(Paragraph('Support: support@thelegacylink.com', st['body']))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
