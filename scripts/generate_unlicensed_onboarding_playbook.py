#!/usr/bin/env python3
"""Generate polished Unlicensed Agent onboarding playbook PDF."""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy-link-unlicensed-onboarding-playbook.pdf'


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
    canvas.drawString(34, 20, 'The Legacy Link • Unlicensed Agent Onboarding Playbook')
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
      title='Legacy Link Unlicensed Agent Onboarding Playbook',
      author='The Legacy Link'
    )

    story=[]
    story.append(Paragraph('THE LEGACY LINK', st['tiny']))
    story.append(Paragraph('Unlicensed Agent Onboarding Playbook', st['title']))
    story.append(Paragraph('Professional launch sequence for newly unlicensed agents. Follow in order and execute daily.', st['sub']))

    story.append(section('Step 1 — Access SOP Instructions + Welcome Email', [
      'Open your Welcome Email and save your required links.',
      'Open SOP instructions and complete checklist items in order.',
      'Confirm your login access before moving to next steps.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 2 — Complete Contract + Required Profile Setup', [
      'Complete onboarding agreement/profile setup first.',
      'Complete all required profile fields accurately.',
      'Upload/confirm required onboarding items before submitting.',
      'If blocked, send support a screenshot and short issue summary.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 3 — Join Legacy Link App (CRM)', [
      'Join app: https://legacylink.app/',
      'Confirm profile setup and basic access.',
      'Track all notes, follow-up, and activity inside CRM.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 4 — Community + Skool Training', [
      'Join Skool: https://www.skool.com/legacylink/about',
      'Complete required onboarding and training actions.',
      'Stay active and responsive while onboarding is in progress.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 5 — Pre-Licensing Onboarding (Jamal Leads This)', [
      'Jamal leads pre-licensing onboarding for all unlicensed agents.',
      'This is true regardless of referral/upline.',
      'Expect outreach from Jamal within 1–3 business days to start pre-licensing.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 6 — Daily Execution Standards', [
      'Work new leads daily.',
      'Follow up warm leads daily.',
      'Book at least one conversation daily.',
      'Use script framework and coach feedback daily.',
      'Keep CRM notes clean and updated same day.'
    ], st))

    story.append(Spacer(1,12))
    story.append(Paragraph('<b>Quality Standard</b>', st['h']))
    story.append(Paragraph('• No lead without notes', st['b']))
    story.append(Paragraph('• No same-day activity left unlogged', st['b']))
    story.append(Paragraph('• No skipped follow-up without reason', st['b']))

    story.append(Spacer(1,8))
    story.append(Paragraph('<b>Support:</b> support@thelegacylink.com', st['b']))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
