#!/usr/bin/env python3
"""Generate polished Licensed Agent onboarding playbook PDF."""

from pathlib import Path
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy-link-licensed-onboarding-playbook.pdf'


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
    canvas.drawString(34, 20, 'The Legacy Link • Licensed Agent Onboarding Playbook')
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
        # If bullet already contains HTML tags (e.g. <a href>), don't run linkify
        if '<a ' in b or '<font ' in b:
            rows.append([Paragraph(f'\u2022 {b}', st['b'])])
        else:
            rows.append([Paragraph(f'\u2022 {linkify(b)}', st['b'])])
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
        title='Legacy Link Licensed Agent Onboarding Playbook',
        author='The Legacy Link'
    )

    story = []
    story.append(Paragraph('THE LEGACY LINK', st['tiny']))
    story.append(Paragraph('Licensed Agent Onboarding Playbook', st['title']))
    story.append(Paragraph('Professional launch sequence for newly licensed agents. Follow in order and execute daily.', st['sub']))

    story.append(section('Step 1 — Back Office Access + Welcome Instructions', [
        'Open your Welcome Email and save your required links.',
        'Start here: https://innercirclelink.com/start',
        'Sign in and follow the guided onboarding steps shown in the system.',
        'If prompted, complete contracting before continuing.',
        'Confirm your back office access is active before moving to Step 2.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 2 — Contracting', [
        'Part A — Pinnacle Group (P.Group) / Business Partners (Mutual of Omaha, Transamerica, Foresters, American National): https://surelc.surancebay.com/producer/?gaId=190',
        'Part B — InvestaLink (F&amp;G + National Life Group): <a href="https://surelc.surancebay.com/sbweb/login.jsp?branch=InvestaLink&amp;branchEditable=off&amp;branchRequired=on&amp;branchVisible=on&amp;gaId=168&amp;gaName=AIP%20Marketing%20Alliance" color="#60A5FA"><u>Click here to complete your contracting with F&amp;G and National Life Group</u></a>',
        'Part C — Video tutorial on the contracting process: <a href="https://www.loom.com/share/79354f8de2334697ba53cc5b0ff80c86?sid=b88fafc3-96a0-4d6a-9918-f396f0047603" color="#60A5FA"><u>Click here to watch the contracting tutorial</u></a>',
        'National Life Group only: after completing the SureLC step, look out for a follow-up email within 48 hours (1–2 business days) to complete an additional required form.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 3 — E&O Activated', [
        'Purchase and activate E&O before production: https://buy.stripe.com/dRm6oH25qe7521Cg4b3ZK0m',
        'E&O includes a 90-day free period (as applicable) before paid billing starts.',
        'Confirm active coverage details are saved in your records.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 4 — Core Product Training Completed', [
        'Complete your core product training sequence on each carrier platform.',
        'Training resources are available directly on carrier websites (for example: National Life Group, F&G, Mutual of Omaha).',
        'Be prepared to explain product basics clearly and confidently.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 5 — CRM + Calendar + Dialer Setup', [
        'Open setup video: https://youtu.be/u3_fIRH8c0w',
        'Complete CRM, calendar, and dialer setup before active production.',
        'Track all notes and follow-up actions in CRM the same day.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 6 — Script Roleplay Certification', [
        'Complete script roleplay certification with your trainer/upline.',
        'Apply coaching feedback until script delivery is consistent.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 7 — Required YouTube Task', [
      'Watch "Whatever It Takes": https://youtu.be/SVvU9SvCH9o?si=nzgjgEa7DfGQlxmX',
      'Leave a comment on the video as part of onboarding completion.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Step 8 — Automated Milestones (System Tracked)', [
        'First Policy Submitted (auto-updates from policy submissions).',
        'First Policy Placed (auto-updates when first policy is approved).',
        'These milestones are automated and do not require manual marking.'
    ], st)); story.append(Spacer(1,8))

    story.append(section('Daily Execution Standards', [
        'Work new leads daily.',
        'Follow up warm leads daily.',
        'Use script framework and coach feedback daily.',
        'Keep CRM notes clean and updated same day.'
    ], st))

    story.append(Spacer(1, 12))
    story.append(Paragraph('<b>Quality Standard</b>', st['h']))
    story.append(Paragraph('• No lead without notes', st['b']))
    story.append(Paragraph('• No same-day activity left unlogged', st['b']))
    story.append(Paragraph('• No skipped follow-up without reason', st['b']))

    story.append(Spacer(1, 8))
    story.append(section('Lead Activation Requirement', [
        'Licensed agents start receiving leads after full onboarding is complete.',
        'Licensed agents must complete their first hour of community service before lead activation.'
    ], st))

    story.append(Spacer(1, 8))
    story.append(section('Lead Distribution and Program Pathways', [
        'Full Sponsorship Path (policy portion completed): 60 fresh leads in total + full JumpStart access and support.',
        'If you are consistently contacting and following up with leads but have not closed yet, the company may drip additional leads to support your success.',
        'Alternate Path (policy declined / not accepted / not suitable): 20 older leads + drip-based delivery + continued onboarding support.'
    ], st))

    story.append(PageBreak())
    story.append(section('Upline Support (Use the Help Button)', [
        'Use Help / Messages in back office to contact your upline directly.',
        'Response SLA: 1 business day (Monday–Friday).',
        'Weekends are excluded from SLA timing.',
        'If no upline response by end of next business day, the issue is escalated internally to support.'
    ], st))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
