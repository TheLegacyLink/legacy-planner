#!/usr/bin/env python3
"""Generate polished Unlicensed Agent onboarding playbook PDF."""

from pathlib import Path
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'legacy_link_pathways_sop.pdf'
OUT2 = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy-link-unlicensed-onboarding-playbook.pdf'


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


def linkify(text=''):
    raw = str(text or '')

    def repl(match):
        url = match.group(0)
        return f'<u><font color="#60A5FA">{url}</font></u>'

    return re.sub(r'https?://\S+', repl, raw)


def section(title, bullets, st):
    rows = [[Paragraph(f'<b>{title}</b>', st['h'])]]
    for b in bullets:
        rows.append([Paragraph(f'• {linkify(b)}', st['b'])])
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

    story.append(section('Step 1 — Back Office Access + Welcome Instructions', [
      'Open your Welcome Email and save your required links.',
      'Start here: https://innercirclelink.com/start',
      'Sign in and follow the guided onboarding steps shown in the system.',
      'Confirm your back office access is active before moving to Step 2.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 2 — Community + Skool Training', [
      'Join Skool: https://www.skool.com/legacylink/about',
      'Complete required onboarding and training actions.',
      'Stay active and responsive while onboarding is in progress.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 3 — Start Your Pre-Licensing', [
      'Log in to your back office, enter your full mailing address in the Pre-Licensing section, and click Confirm.',
      'Your course credentials will be delivered to your email within 24 hours — fully paid for by The Legacy Link.',
      'Once you receive your login, head straight to the course and start studying.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 4 — Required YouTube Task', [
      'Watch "Whatever It Takes": https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX',
      'Leave a comment on the video to confirm completion.'
    ], st)); story.append(Spacer(1,8))

    story.append(PageBreak())
    story.append(section('Step 5 — Community Service (Required)', [
      'Community service is a required part of the Sponsorship Program — a minimum of 1 hour per month.',
      'This is your commitment to the community that supports your growth.',
      'The following all count toward your monthly requirement:',
      '\u2014 Donating to Goodwill, Salvation Army, or a similar organization',
      '\u2014 Volunteering at a church, mosque, or place of worship',
      '\u2014 Helping someone in need — a neighbor, a stranger, or a family member',
      '\u2014 Providing a free service that you would normally charge for'
    ], st)); story.append(Spacer(1,12))

    story.append(section('Upline Support (Use the Help Button)', [
      'Use Help / Messages in back office to contact your upline directly.',
      'Unlicensed onboarding messages route through your assigned upline flow.',
      'Response SLA: 1 business day (Monday–Friday).',
      'Weekends are excluded from SLA timing.',
      'If no upline response by end of next business day, the issue is escalated internally to support.'
    ], st))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)

    # Also copy to public/docs path
    import shutil
    OUT2.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(OUT), str(OUT2))


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
    print(f'Copied to: {OUT2}')
