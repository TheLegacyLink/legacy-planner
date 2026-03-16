#!/usr/bin/env python3
"""Generate polished Sponsorship Application Call SOP PDF."""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy-link-sponsorship-phone-application-sop.pdf'
CONTRACT_URL = 'https://innercirclelink.com/contract-agreement'
APPLICATION_URL = 'https://innercirclelink.com/sponsorship-application'


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
    canvas.line(34, 742, letter[0] - 34, 742)
    canvas.setFillColor(colors.HexColor('#9CA3AF'))
    canvas.setFont('Helvetica', 8)
    canvas.drawString(34, 20, 'The Legacy Link • Sponsorship Application Call SOP')
    canvas.drawRightString(letter[0] - 34, 20, f'Page {doc.page}')
    canvas.restoreState()


def section(title, bullets, st, bg='#111827'):
    rows = [[Paragraph(f'<b>{title}</b>', st['h'])]]
    for b in bullets:
        rows.append([Paragraph(f'• {b}', st['b'])])
    t = Table(rows, colWidths=[6.75 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg)),
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
        title='Legacy Link Sponsorship Application Call SOP',
        author='The Legacy Link'
    )

    story = []
    story.append(Paragraph('THE LEGACY LINK', st['tiny']))
    story.append(Paragraph('Sponsorship Application Call SOP', st['title']))
    story.append(Paragraph('Required workflow for sponsorship application calls.', st['sub']))

    story.append(section('Non-Negotiable Rule (No Exceptions)', [
        'Joining the agency is NOT contingent on purchasing/submitting a policy.',
        'Contract must be completed first.',
        'Do not proceed to starting the application until contract is signed.',
        f'Required Contract Link: {CONTRACT_URL}',
        f'Required Application Link: {APPLICATION_URL}'
    ], st, bg='#2B1212'))
    story.append(Spacer(1, 8))

    story.append(section('Approved Applicant Routing (Applies to Everyone Approved)', [
        'This routing applies to every approved applicant.',
        'If someone is licensed and decides not to do the bonus policy, help them with the contracting process.',
        'If someone is unlicensed and decides not to do the bonus policy, they must complete one-hour community service before pre-licensing starts.'
    ], st, bg='#13261A'))
    story.append(Spacer(1, 8))

    story.append(section('Step 1 — Pre-Call Setup', [
        'Confirm Zoom is open and working.',
        'Confirm your camera is on and environment is professional.',
        'Confirm audio quality is clear.',
        'Have contract link ready to send.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 2 — Professional Introduction', [
        'Introduce yourself clearly (name + agency + purpose).',
        'Be polite, calm, and professional.',
        'Confirm prospect can hear and see you.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 3 — Explain Process + Expectations', [
        'Explain what will happen on the call.',
        'Explain next steps in plain language.',
        'Clearly state that joining the agency is not contingent on doing a policy.',
        'Confirm understanding before moving forward.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 4 — Contract Signature + Suitability Check (Mandatory)', [
        f'Send contract link: {CONTRACT_URL}',
        'Walk them through signing while on the call.',
        'Confirm contract is fully signed before continuing.',
        'Check suitability: confirm whether this prospect is suitable to move forward with the sponsorship application.'
    ], st, bg='#13261A'))
    story.append(Spacer(1, 8))

    story.append(section('Step 5 — Application Submission (After Contract Only)', [
        'Proceed only after contract completion and suitability confirmation.',
        f'Agent must submit the app on the Legacy Link website here: {APPLICATION_URL}',
        'Do not submit this on the insurance carrier website.',
        'Complete sponsorship application accurately.',
        'Review all fields before final submit.',
        'If prospect is not suitable or decides they do not need a policy, agent still submits the app on the Legacy Link website so onboarding can begin.',
        'In that case, click the button indicating they are not moving forward with the company insurance policy.',
        'Confirm successful submission and next steps.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(section('Step 6 — Close Out + Next Steps', [
        'Thank them for their time.',
        f'Let them know to submit the app here: {APPLICATION_URL}',
        'Reconfirm timeline and follow-up process.',
        'Check in within the next 48 hours to make sure everything is moving smoothly.'
    ], st))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
