#!/usr/bin/env python3
"""Generate Legacy Link Pathways SOP PDF using the standard internal branded template."""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy_link_pathways_sop.pdf'
OUT_V2 = ROOT / 'public' / 'docs' / 'onboarding' / 'legacy_link_pathways_sop-v2.pdf'


def styles():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('title', parent=base['Title'], fontName='Helvetica-Bold', fontSize=23, leading=27, textColor=colors.HexColor('#E6D1A6'), spaceAfter=8),
        'sub': ParagraphStyle('sub', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=colors.HexColor('#9CA3AF'), spaceAfter=10),
        'h': ParagraphStyle('h', parent=base['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=colors.HexColor('#C8A96B'), spaceBefore=6, spaceAfter=4),
        'b': ParagraphStyle('b', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14.5, textColor=colors.HexColor('#E5E7EB'), spaceAfter=3),
        'tiny': ParagraphStyle('tiny', parent=base['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#9CA3AF'), spaceAfter=2),
        'cell_h': ParagraphStyle('cell_h', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=colors.HexColor('#E6D1A6')),
        'cell': ParagraphStyle('cell', parent=base['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#E5E7EB')),
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
    canvas.drawString(34, 20, 'The Legacy Link • JumpStart, Sponsorship & Standard Path SOP')
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


def info_table(st):
    header = [Paragraph('<b>PATH</b>', st['cell_h']), Paragraph('<b>WHO IT FITS</b>', st['cell_h']), Paragraph('<b>HOW IT WORKS</b>', st['cell_h']), Paragraph('<b>KEY NOTE</b>', st['cell_h'])]
    rows = [
        header,
        [
            Paragraph('JumpStart', st['cell']),
            Paragraph('Someone who wants a faster ramp and is comfortable with a higher-support launch option.', st['cell']),
            Paragraph('Optional path. May be funded through a separate paid JumpStart option or, if independently suitable and elected, through a separate personal protection decision.', st['cell']),
            Paragraph('Do not present this as “buy a policy to join.”', st['cell']),
        ],
        [
            Paragraph('Sponsorship', st['cell']),
            Paragraph('Someone who wants company-sponsored startup help and understands the ramp is slower.', st['cell']),
            Paragraph('Starts at the entry comp level. Company-sponsored support follows current sponsorship terms.', st['cell']),
            Paragraph('Good fit when someone needs a lower-friction start.', st['cell']),
        ],
        [
            Paragraph('Standard / No Policy', st['cell']),
            Paragraph('Someone who wants to join without JumpStart or Sponsorship funding.', st['cell']),
            Paragraph('They still move forward with licensing, contracting, onboarding, and the standard path.', st['cell']),
            Paragraph('No policy is required to join Legacy Link.', st['cell']),
        ]
    ]
    t = Table(rows, colWidths=[1.12 * inch, 1.6 * inch, 2.35 * inch, 1.68 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F2937')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#111827')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#334155')),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


def qa_table(st):
    header = [Paragraph('<b>QUESTION</b>', st['cell_h']), Paragraph('<b>ANSWER</b>', st['cell_h'])]
    rows = [
        header,
        [Paragraph('Do I have to do a policy to do JumpStart?', st['cell']), Paragraph('No. JumpStart can be entered through a separate paid option as well. A policy is never required to join Legacy Link, and any personal policy review must remain optional, suitable, and affordable.', st['cell'])],
        [Paragraph('Can I still join if I do not want JumpStart or Sponsorship?', st['cell']), Paragraph('Yes. The Standard / No Policy path is still a valid path forward.', st['cell'])],
        [Paragraph('What is the difference between JumpStart and Sponsorship?', st['cell']), Paragraph('JumpStart is the higher-support launch path. Sponsorship is the slower-ramp, company-sponsored path that starts at the entry compensation level.', st['cell'])],
        [Paragraph('If I choose Sponsorship, does that mean I am not part of the company?', st['cell']), Paragraph('No. All three paths are part of Legacy Link. The difference is simply how the person starts and what support structure fits them best.', st['cell'])],
        [Paragraph('What if I want to think about it?', st['cell']), Paragraph('That is fine. The presenter should explain the paths clearly, answer questions, and let the person choose the path that fits their current situation.', st['cell'])],
        [Paragraph('Can someone change paths later?', st['cell']), Paragraph('Company policy can allow changes later if approved. The initial goal is simply to place the person in the path that best fits them right now.', st['cell'])],
    ]
    t = Table(rows, colWidths=[2.6 * inch, 4.15 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F2937')),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#111827')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#334155')),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


def build(out_path: Path):
    st = styles()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=letter,
        leftMargin=34,
        rightMargin=34,
        topMargin=44,
        bottomMargin=30,
        title='JumpStart, Sponsorship & Standard Path',
        author='The Legacy Link'
    )

    story = []
    story.append(Paragraph('THE LEGACY LINK', st['tiny']))
    story.append(Paragraph('JumpStart, Sponsorship & Standard Path', st['title']))
    story.append(Paragraph('Internal presentation SOP and FAQ for explaining the three starting paths clearly, simply, and in a compliance-conscious way.', st['sub']))

    story.append(section('Core Rule', [
        'Joining Legacy Link is not contingent on purchasing a policy.',
        'A personal policy review is always optional, separate, and only considered if it is suitable and affordable.',
        'Use this to guide the conversation — not to force a policy decision.',
        'Prepared for internal training and onboarding conversations.'
    ], st, bg='#2B1212'))
    story.append(Spacer(1, 8))

    story.append(section('1) Presenter Order of Operation', [
        'Use the same order every time.',
        'Start with the agency opportunity, not the policy.',
        'Explain that there are three ways to start.',
        'State clearly that no policy is required to join.',
        'Only discuss personal coverage if the person wants to explore it and it appears suitable.',
        'Match the person to the path that fits their situation, timeline, and budget.'
    ], st, bg='#13261A'))
    story.append(Spacer(1, 6))
    story.append(section('Simple Opener', [
        '“You can still move forward with Legacy Link even if you do not do a personal policy. We simply want to show you the available paths, explain the difference, and help you choose the path that fits you best.”'
    ], st))
    story.append(Spacer(1, 8))

    story.append(Paragraph('<b>2) The three paths at a glance</b>', st['h']))
    story.append(info_table(st))
    story.append(Spacer(1, 8))

    story.append(section('3) Path-by-Path Breakdown — JumpStart Path', [
        'How to explain it: “JumpStart is the higher-support launch path. It is optional. It is meant for someone who wants a more accelerated start and is comfortable with a structured launch package.”',
        'Important: Keep the business support package separate from any personal policy discussion.',
        'If a personal policy is explored, it must be optional, suitable, and affordable.'
    ], st, bg='#13261A'))
    story.append(Spacer(1, 6))

    story.append(section('Suggested JumpStart Funding Language', [
        '“There are two ways to participate in JumpStart. One is a separate paid JumpStart option, currently being considered in the range of $497 or $997 per month, with final pricing subject to approval. The other is an optional personal protection review if it is independently suitable and you elect to move forward. Either way, joining the company itself is never contingent on purchasing a policy.”'
    ], st))
    story.append(Spacer(1, 6))

    story.append(section('Sponsorship Path', [
        '“Sponsorship is the slower-ramp option. The company sponsors approved startup support under current program terms, and sponsorship participants begin at the entry compensation level. It is a strong option for someone who wants to get started with less upfront friction.”'
    ], st))
    story.append(Spacer(1, 6))

    story.append(section('Standard / No Policy Path', [
        '“This person does not want JumpStart and does not want Sponsorship. That is okay. They can still move forward with the standard onboarding path. No policy is required to join Legacy Link.”'
    ], st))
    story.append(Spacer(1, 6))

    story.append(section('Do Not Say This', [
        'Avoid language like: “Do a policy and you get better comp,” “Buy your own policy and you get more leads,” or “You need a policy to move faster.”',
        'Keep coverage separate from agency eligibility and keep program support tied to written program terms, not to the purchase of insurance.'
    ], st, bg='#2B1212'))
    story.append(Spacer(1, 8))

    story.append(Paragraph('<b>4) Q&A for Common Questions</b>', st['h']))
    story.append(qa_table(st))
    story.append(Spacer(1, 8))

    story.append(section('Final Reminder for Presenters', [
        'Keep the conversation simple.',
        'Explain the three paths.',
        'Make it clear that no policy is required to join.',
        'Only discuss personal coverage if the person wants to explore it and it appears suitable.',
        'The goal is clarity, not pressure.'
    ], st, bg='#13261A'))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


def main():
    build(OUT)
    build(OUT_V2)
    # keep root copy updated for local convenience
    root_copy = ROOT / 'legacy_link_pathways_sop.pdf'
    root_copy.write_bytes(OUT.read_bytes())
    print(f'Generated: {OUT}')
    print(f'Generated: {OUT_V2}')


if __name__ == '__main__':
    main()
