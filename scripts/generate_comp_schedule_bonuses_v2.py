#!/usr/bin/env python3
"""Generate Legacy Link Comp Schedule + Bonuses v2 (layout + full v1 content merged)."""

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

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
        'tiny': ParagraphStyle('tiny', parent=base['Normal'], fontName='Helvetica', fontSize=8.8, leading=11.2, textColor=colors.HexColor('#AAB5C8'), spaceAfter=2),
        'title': ParagraphStyle('title', parent=base['Title'], fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=colors.HexColor('#E6D1A6'), spaceAfter=8),
        'sub': ParagraphStyle('sub', parent=base['Normal'], fontName='Helvetica', fontSize=10.5, leading=14, textColor=colors.HexColor('#AAB5C8'), spaceAfter=8),
        'h': ParagraphStyle('h', parent=base['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=colors.HexColor('#C8A96B'), spaceBefore=4, spaceAfter=4),
        'body': ParagraphStyle('body', parent=base['Normal'], fontName='Helvetica', fontSize=10.3, leading=14.3, textColor=colors.HexColor('#E5E7EB'), spaceAfter=3),
    }


def dark_box(title, rows, st):
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


def producer_track_table(rows):
    t = Table(rows, colWidths=[0.7 * inch, 2.2 * inch, 1.0 * inch, 2.85 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#111827')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#E5E7EB')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2A3142')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#2A3142')),
        ('FONTSIZE', (0, 0), (-1, -1), 9.7),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return t


def bonus_table(rows):
    t = Table(rows, colWidths=[3.4 * inch, 3.35 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#111827')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#E5E7EB')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2A3142')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#2A3142')),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
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
    story.append(Paragraph('THE LEGACY LINK', st['tiny']))
    story.append(Paragraph('Comp Schedule + Bonuses (v2)', st['title']))
    story.append(Paragraph('Merged with full producer-track content. Effective January 2025.', st['sub']))
    story.append(Paragraph('Website: <b>https://thelegacylink.com</b>', st['body']))
    story.append(Spacer(1, 6))

    story.append(dark_box('Overview', [
        '• Built for producers who want a clear ladder to climb.',
        '• Promotion standard: hit next level monthly personal AP for 3 consecutive months.',
        '• Placement standard: maintain quality so production counts as net placed AP.',
        '• Designed to reward consistency, not one-off spikes.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('Core Definitions', [
        '• Consecutive 3-month requirement: next-level AP target must be hit for 3 consecutive calendar months.',
        '• Placement requirement: minimum 75% placement ratio recommended for promotion consideration.',
        '• Good standing: compliance, licensing, carrier, and internal standards must remain clean.',
        '• Promotion timing: once streak is verified, upgrade becomes effective on first day of following month.',
        '• Bonus qualification: bonus releases are based on net placed AP only.'
    ], st))
    story.append(PageBreak())

    story.append(Paragraph('PERSONAL PRODUCER TRACK (Levels 1–7)', st['h']))
    story.append(producer_track_table([
        ['Level', 'Title', 'Comp', 'Monthly Personal AP'],
        ['1', 'Link Startup / Sponsorship', '50%', 'Entry point / newly contracted'],
        ['2', 'Foundation Writer', '55%', '$2,000 monthly personal AP'],
        ['3', 'Momentum Builder', '60%', '$3,500 monthly personal AP'],
        ['4', 'Chainbreaker Producer', '65%', '$5,000 monthly personal AP'],
        ['5', 'Legacy Closer', '70%', '$6,500 monthly personal AP'],
        ['6', 'Wealth Driver', '75%', '$8,000 monthly personal AP'],
        ['7', 'Dynasty Producer', '80%', '$10,000 monthly personal AP'],
    ]))
    story.append(Spacer(1, 10))

    story.append(Paragraph('PERSONAL PRODUCER TRACK (Levels 8–14)', st['h']))
    story.append(producer_track_table([
        ['Level', 'Title', 'Comp', 'Monthly Personal AP'],
        ['8', 'Legacy Architect', '85%', '$12,500 monthly personal AP'],
        ['9', 'Powerhouse Producer / Agency Owner', '90%', '$15,000 monthly personal AP'],
        ['10', 'Blueprint Leader', '95%', '$18,000 monthly personal AP'],
        ['11', 'Empire Producer', '100%', '$22,000 monthly personal AP'],
        ['12', 'Pinnacle Builder', '105%', '$27,000 monthly personal AP'],
        ['13', 'Legacy Icon', '110%', '$33,000 monthly personal AP'],
        ['14', 'Legacy Titan', '115%', '$40,000 monthly personal AP'],
    ]))
    story.append(Spacer(1, 8))

    story.append(dark_box('Upgrade Principle', [
        '• To move up one level, hit the next level AP requirement for 3 consecutive months.',
        '• Keep business placed and remain in good standing.',
        '• One big month alone does not trigger upgrade.',
        '• 90% level note: Powerhouse Producer / Agency Owner is first major elite jump.'
    ], st))

    story.append(PageBreak())
    story.append(Paragraph('INCENTIVES & BONUSES', st['h']))
    story.append(Paragraph('Rolling 90-day net placed AP bonus release framework', st['sub']))
    story.append(bonus_table([
        ['Rolling 90-Day Net Placed AP', 'Bonus Release'],
        ['$6,000', '$200'],
        ['$12,000', '$400'],
        ['$24,000', '$800'],
        ['$36,000', '$1,200'],
        ['$60,000', '$2,000'],
        ['$90,000', '$3,000'],
        ['$120,000', '$4,000'],
    ]))
    story.append(Spacer(1, 8))

    story.append(dark_box('Bonus Recovery Policy (Recommended)', [
        '• Bonus releases are earned on net placed AP, not raw submitted AP.',
        '• If qualifying business remains on books and milestone still clears, bonus stands.',
        '• If enough business chargebacks/lapses/rescinds and milestone no longer clears, bonus can be reversed or offset against future commission/bonus.',
        '• Example: producer receives $400 at $12,000 milestone, then falls below milestone after chargebacks; company may recover/offset $400 under policy.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('Next Steps (Simple Operating Rhythm)', [
        '1) Submit — write business consistently and focus on annualized premium.',
        '2) Place — protect placement so production counts as net placed AP.',
        '3) Repeat — hit benchmark for 3 consecutive months in a row.',
        '4) Promote — upgrade effective following month once verified.'
    ], st))

    story.append(PageBreak())
    story.append(Paragraph('LEGACY LINK FAQ — PERSONAL PRODUCTION, COMPENSATION, GETTING STARTED', st['h']))

    story.append(dark_box('How do I move up in comp?', [
        '• Hit the required monthly AP for the next level and maintain it for 3 consecutive months.',
        '• Each month must qualify on its own. One big month does not make up for a missed month.',
        '• Streak starts from the first qualifying month.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('What counts toward promotion?', [
        '• Net placed AP counts (approved, issued, placed, and on the books).',
        '• AP is based on personal production.',
        '• Pending business does not count.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('How many policies does AP usually take?', [
        '• It depends on case size. Bigger policies = fewer closes. Smaller policies = more closes.',
        '• Use a range target, not one exact policy count.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('How often are comp levels reviewed?', [
        '• Monthly review using a rolling 3-month lookback.',
        '• If one month is missed, streak resets.',
        '• No automatic grace period; any exception is company discretion only.'
    ], st))

    story.append(PageBreak())

    story.append(dark_box('What is good standing?', [
        '• Compliance clear, license active, carrier status active, no unresolved issues.',
        '• Policy business must remain on the books.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('Bonuses: timing and adjustments', [
        '• Bonuses are paid after milestone verification and good-standing placed business.',
        '• Bonuses can be reduced, reversed, or offset if business lapses, cancels, chargebacks, falls off books, or no longer supports milestone.',
        '• Chargebacks affect bonuses only (not comp level).',
        '• Current policy: once promoted, comp level does not step down.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('Licensed and Unlicensed Paths', [
        '• Joining Legacy Link is NOT contingent on purchasing a policy.',
        '• Lead by Example is optional; value is selling what you personally own (if you have an insurance need per contract).',
        '• Unlicensed agents do not earn insurance commissions during pre-licensing.',
        '• Licensed lead start: contracting complete + onboarding complete + systems setup complete + cleared to work.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('If bonus policy is declined, what path applies?', [
        '• Licensed path: contracting support → onboarding → leads when cleared.',
        '• Unlicensed path: 1 hour community service → pre-licensing → licensing → contracting → onboarding → leads.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('Simple compensation example (50% comp)', [
        '• Example AP: $100 monthly premium × 12 = $1,200 AP.',
        '• Total commission at 50% comp: $1,200 × 50% = $600.',
        '• Typical split: 75% advance ($450) + 25% holdback ($150) paid later (months 10–12).',
        '• Holdback exists because policy must persist on books for 12 months.'
    ], st))
    story.append(Spacer(1, 8))

    story.append(dark_box('What is a chargeback?', [
        '• A chargeback happens when policy does not stay active long enough and commission is taken back.',
        '• Recovery can come from future commissions, bonuses, or other earnings.'
    ], st))

    story.append(Spacer(1, 10))
    story.append(Paragraph('Support: support@thelegacylink.com', st['body']))
    story.append(Paragraph('Prepared for internal Legacy Link use. Structure can evolve with compensation policy updates.', st['tiny']))

    doc.build(story, onFirstPage=page_bg, onLaterPages=page_bg)


if __name__ == '__main__':
    build()
    print(f'Generated: {OUT}')
