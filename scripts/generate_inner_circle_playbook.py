#!/usr/bin/env python3
"""
Generate a premium-styled Inner Circle onboarding playbook PDF.

Output:
  public/docs/inner-circle/legacy-link-inner-circle-onboarding-playbook-v2.pdf
"""

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "docs" / "inner-circle" / "legacy-link-inner-circle-onboarding-playbook-v2.pdf"


def brand_palette():
    return {
        "bg": colors.HexColor("#0B1020"),
        "bg_soft": colors.HexColor("#111827"),
        "ink": colors.HexColor("#E5E7EB"),
        "muted": colors.HexColor("#9CA3AF"),
        "gold": colors.HexColor("#C8A96B"),
        "gold_soft": colors.HexColor("#E6D1A6"),
        "line": colors.HexColor("#2A3142"),
        "accent": colors.HexColor("#1E3A8A"),
        "success": colors.HexColor("#16A34A"),
    }


def styles(p):
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=30,
            textColor=p["gold_soft"],
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=p["muted"],
            spaceAfter=16,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=p["gold"],
            spaceBefore=8,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=p["gold_soft"],
            spaceBefore=6,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=p["ink"],
            spaceAfter=7,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=p["muted"],
            spaceAfter=4,
        ),
        "check": ParagraphStyle(
            "check",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=p["ink"],
            leftIndent=14,
            bulletIndent=2,
            spaceAfter=4,
        ),
    }


def box(text, st, p, bg=None):
    t = Table([[Paragraph(text, st)]], colWidths=[6.7 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg or p["bg_soft"]),
                ("BOX", (0, 0), (-1, -1), 1, p["line"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def page_decor(canvas, doc):
    p = brand_palette()
    canvas.saveState()
    canvas.setFillColor(p["bg"])
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setStrokeColor(p["line"])
    canvas.setLineWidth(0.8)
    canvas.line(36, 740, letter[0] - 36, 740)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(p["muted"])
    canvas.drawString(36, 20, "The Legacy Link • Inner Circle Playbook")
    canvas.drawRightString(letter[0] - 36, 20, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf():
    p = brand_palette()
    st = styles(p)

    OUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=34,
        title="Legacy Link Inner Circle Onboarding Playbook",
        author="The Legacy Link",
    )

    story = []

    # Cover
    story.append(Paragraph("THE LEGACY LINK", st["small"]))
    story.append(Paragraph("Inner Circle Onboarding Playbook", st["title"]))
    story.append(
        Paragraph(
            "Premium Edition • Designed to help new Inner Circle agents activate fast, execute daily, and scale with structure.",
            st["subtitle"],
        )
    )
    story.append(
        box(
            "<b>How to use this playbook:</b><br/>"
            "1) Follow each section in order.<br/>"
            "2) Complete the 24-hour activation first.<br/>"
            "3) Use the daily standard every day for 30 days.<br/>"
            "4) Keep this PDF open during onboarding calls.",
            st["body"],
            p,
            bg=colors.HexColor("#121B34"),
        )
    )
    story.append(Spacer(1, 16))
    story.append(Paragraph("Quick Links", st["h2"]))
    story.append(Paragraph("• Inner Circle Hub: https://innercirclelink.com/inner-circle-hub", st["body"]))
    story.append(Paragraph("• Legacy Link App: https://legacylink.app/", st["body"]))
    story.append(Paragraph("• Support: support@thelegacylink.com", st["body"]))

    story.append(PageBreak())

    # 24-hour activation
    story.append(Paragraph("Section 1 — 24-Hour Activation", st["h1"]))
    story.append(Paragraph("Complete this in your first day. Speed creates momentum.", st["body"]))
    checks = [
        "Access your Inner Circle Hub login and confirm you can open every tab.",
        "Join Legacy Link App and confirm your account is fully active.",
        "Read this playbook front to back once before taking action.",
        "Set your daily execution window (minimum 2 focused hours).",
        "Load scripts and run your first live role-play.",
        "Confirm your onboarding communication channel with your coach/advisor.",
    ]
    for item in checks:
        story.append(Paragraph(f"• {item}", st["check"]))

    story.append(Spacer(1, 8))
    story.append(
        box(
            "<b>Pro Tip:</b> Don’t optimize too early. First, get reps. Then improve.",
            st["body"],
            p,
            bg=colors.HexColor("#142028"),
        )
    )

    # 14-day sprint
    story.append(Spacer(1, 16))
    story.append(Paragraph("Section 2 — First 14 Days Sprint", st["h1"]))
    story.append(Paragraph("Use this cadence to build consistency and confidence fast.", st["body"]))

    sprint_rows = [
        ["Days 1–3", "Environment setup, script reps, and first conversations booked."],
        ["Days 4–7", "Daily follow-up rhythm, stronger objections handling, more booked calls."],
        ["Days 8–10", "Increase volume and improve show-up quality with tighter confirmation."],
        ["Days 11–14", "Push applications, tighten close process, clean up pipeline."],
    ]
    t = Table(sprint_rows, colWidths=[1.4 * inch, 5.3 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), p["bg_soft"]),
                ("TEXTCOLOR", (0, 0), (-1, -1), p["ink"]),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("LEADING", (0, 0), (-1, -1), 14),
                ("BOX", (0, 0), (-1, -1), 1, p["line"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, p["line"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(t)

    story.append(PageBreak())

    # Daily standard
    story.append(Paragraph("Section 3 — Daily Execution Standard", st["h1"]))
    story.append(
        Paragraph(
            "If you only follow one page every day, make it this one.",
            st["body"],
        )
    )

    daily = [
        "Work new leads",
        "Follow up warm leads",
        "Book at least one conversation",
        "Post one piece of content",
        "Update tracker before end of day",
    ]
    for item in daily:
        story.append(Paragraph(f"• {item}", st["check"]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Minimum Quality Standard", st["h2"]))
    story.append(Paragraph("• All contacts logged with notes", st["check"]))
    story.append(Paragraph("• Every booked call has confirmation + reminder", st["check"]))
    story.append(Paragraph("• No lead untouched for more than 48 hours", st["check"]))

    story.append(Spacer(1, 8))
    story.append(
        box(
            "<b>Momentum Rule:</b> Consistency beats intensity. "
            "Win the day first. Then stack days into weeks.",
            st["body"],
            p,
            bg=colors.HexColor("#1D1A0E"),
        )
    )

    # Metrics and rewards snapshot
    story.append(Spacer(1, 16))
    story.append(Paragraph("Section 4 — KPI + Rewards Snapshot", st["h1"]))
    story.append(Paragraph("Track progress with objective numbers, not feelings.", st["body"]))

    rewards_rows = [
        ["Action", "Points"],
        ["Sponsorship Submitted", "1"],
        ["Booked", "3"],
        ["F&G Submitted", "10"],
        ["F&G Approved", "500"],
    ]
    rw = Table(rewards_rows, colWidths=[4.7 * inch, 2.0 * inch])
    rw.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), p["accent"]),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), p["bg_soft"]),
                ("TEXTCOLOR", (0, 1), (-1, -1), p["ink"]),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 1, p["line"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, p["line"]),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(rw)

    story.append(Spacer(1, 10))
    story.append(Paragraph("Suggested weekly review:", st["h2"]))
    story.append(Paragraph("• Total conversations started", st["check"]))
    story.append(Paragraph("• Booked conversations", st["check"]))
    story.append(Paragraph("• Applications submitted", st["check"]))
    story.append(Paragraph("• Approval outcomes and bottlenecks", st["check"]))

    story.append(PageBreak())

    # Onboarding handoff and support
    story.append(Paragraph("Section 5 — Communication + Support", st["h1"]))
    story.append(Paragraph("Use this to stay connected and avoid stalled progress.", st["body"]))

    story.append(Paragraph("Primary support", st["h2"]))
    story.append(Paragraph("• Email: support@thelegacylink.com", st["body"]))
    story.append(Paragraph("• Inner Circle Hub: https://innercirclelink.com/inner-circle-hub", st["body"]))
    story.append(Paragraph("• Legacy Link App: https://legacylink.app/", st["body"]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Escalation when blocked", st["h2"]))
    story.append(Paragraph("1) Share screenshot + exact issue", st["check"]))
    story.append(Paragraph("2) Include what you already tried", st["check"]))
    story.append(Paragraph("3) Include urgency and next deadline", st["check"]))

    story.append(Spacer(1, 12))
    story.append(
        box(
            "<b>Final Note:</b> This playbook is your baseline system. "
            "Execution creates confidence, confidence creates production, production creates freedom.",
            st["body"],
            p,
            bg=colors.HexColor("#142B1A"),
        )
    )

    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)


if __name__ == "__main__":
    build_pdf()
    print(f"Generated: {OUT}")
