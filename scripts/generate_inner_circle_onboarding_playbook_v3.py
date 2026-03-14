#!/usr/bin/env python3
"""Generate polished Inner Circle onboarding playbook v3 (premium layout, no password in PDF)."""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'docs' / 'inner-circle' / 'legacy-link-inner-circle-onboarding-playbook-v3.pdf'


def styles():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('title', parent=base['Title'], fontName='Helvetica-Bold', fontSize=23, leading=27, textColor=colors.HexColor('#E6D1A6'), spaceAfter=8),
        'sub': ParagraphStyle('sub', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=colors.HexColor('#9CA3AF'), spaceAfter=10),
        'h': ParagraphStyle('h', parent=base['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=colors.HexColor('#C8A96B'), spaceBefore=6, spaceAfter=4),
        'b': ParagraphStyle('b', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14.5, textColor=colors.HexColor('#E5E7EB'), spaceAfter=3),
        'tiny': ParagraphStyle('tiny', parent=base['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#9CA3AF'), spaceAfter=2),
    }


def page_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#0B1020'))
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor('#2A3142'))
    canvas.setLineWidth(0.8)
    canvas.line(34, 742, letter[0]-34, 742)
    canvas.setFillColor(colors.HexColor('#9CA3AF'))
    canvas.setFont('Helvetica', 8)
    canvas.drawString(34, 20, 'The Legacy Link • Inner Circle Onboarding Playbook v3')
    canvas.drawRightString(letter[0]-34, 20, f'Page {doc.page}')
    canvas.restoreState()


def section(title, bullets, st):
    rows = [[Paragraph(f'<b>{title}</b>', st['h'])]]
    for b in bullets:
        rows.append([Paragraph(f'• {b}', st['b'])])
    t = Table(rows, colWidths=[6.75*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#111827')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#2A3142')),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
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
        title='Legacy Link Inner Circle Onboarding Playbook v3',
        author='The Legacy Link'
    )

    story = []
    story.append(Paragraph('THE LEGACY LINK', st['tiny']))
    story.append(Paragraph('Inner Circle Onboarding Playbook', st['title']))
    story.append(Paragraph('Premium launch sequence for Inner Circle agents. Same core info, cleaner elite format.', st['sub']))

    story.append(section('Start Here (Onboarding Steps)', [
        'Review and complete Inner Circle contract first: https://innercirclelink.com/inner-circle-contract',
        'Join Telegram group: https://t.me/+9GyGIETNM1QxZWRh',
        'Join Legacy Link App (CRM): https://legacylink.app/',
        'Log into Inner Circle Hub: https://innercirclelink.com/inner-circle-hub',
        'Use your personal sponsor link to share (provided in your welcome email).',
        'Hub login credentials are provided in your welcome email for security.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Your First 72 Hours', [
        'Review Fast Start inside the Hub.',
        'Open scripts and run your first role-play.',
        'Log your first daily production activity in tracker.',
        'Confirm onboarding communication channel with your coach.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Daily Execution Standards', [
        'Work new leads daily.',
        'Follow up warm leads daily.',
        'Book at least one conversation daily.',
        'Post one piece of content daily.',
        'Update CRM and tracker before end of day.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Quick Links', [
        'Inner Circle Hub: https://innercirclelink.com/inner-circle-hub',
        'Legacy Link App: https://legacylink.app/',
        'Telegram: https://t.me/+9GyGIETNM1QxZWRh',
        'Support: support@thelegacylink.com'
    ], st))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
