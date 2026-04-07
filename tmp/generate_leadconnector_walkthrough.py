from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1280, 720
out_dir = Path('/Users/emaniai/.openclaw/workspace/legacy-planner/tmp/gifframes')
out_dir.mkdir(parents=True, exist_ok=True)

slides = [
    ("LeadConnector Quick Start", "60-second setup walkthrough for The Legacy Link agents"),
    ("1) Check Your Email", "Look for your LeadConnector invite and temporary password email."),
    ("2) Open Password Email", "Click the setup link and create a secure password."),
    ("3) Sign In", "Go to app.thelegacylink.com and sign in with your email + new password."),
    ("4) Dashboard Overview", "Use the left menu to navigate Contacts, Conversations, and Opportunities."),
    ("5) Open Contacts", "Click Contacts to view all assigned leads and customer records."),
    ("6) Select a Contact", "Open a lead record to view phone, email, notes, and timeline."),
    ("7) Dial a Lead", "Click the phone icon to place a call directly from LeadConnector."),
    ("8) Send a Message", "Use Conversations to send SMS and follow up fast."),
    ("9) Log Notes", "After each call/text, add notes so your pipeline stays clean."),
    ("10) Daily Execution", "Contact leads daily, follow up, and keep your CRM updated."),
    ("You’re Ready", "Launch now: https://app.thelegacylink.com/")
]

# colors
bg_top = (12, 23, 48)
bg_bottom = (6, 12, 28)
accent = (245, 132, 38)
accent2 = (76, 132, 255)
white = (243, 246, 255)
muted = (168, 181, 206)
panel = (17, 27, 52)
panel2 = (20, 34, 64)

try:
    title_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 58)
    step_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 44)
    body_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 30)
    small_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 24)
except Exception:
    title_font = ImageFont.load_default()
    step_font = ImageFont.load_default()
    body_font = ImageFont.load_default()
    small_font = ImageFont.load_default()

for i, (title, body) in enumerate(slides, start=1):
    im = Image.new('RGB', (W, H), (0,0,0))
    d = ImageDraw.Draw(im)

    # gradient bg
    for y in range(H):
        t = y / H
        r = int(bg_top[0] * (1-t) + bg_bottom[0] * t)
        g = int(bg_top[1] * (1-t) + bg_bottom[1] * t)
        b = int(bg_top[2] * (1-t) + bg_bottom[2] * t)
        d.line([(0,y),(W,y)], fill=(r,g,b))

    # top brand bar
    d.rounded_rectangle((42, 24, W-42, 100), radius=20, fill=(10,18,38), outline=(52,78,130), width=2)
    d.text((64, 46), 'THE LEGACY LINK', font=small_font, fill=white)
    d.text((W-290, 46), 'LeadConnector SOP', font=small_font, fill=muted)

    # main card
    d.rounded_rectangle((60, 130, W-60, H-58), radius=28, fill=panel, outline=(55,87,150), width=2)

    # left content panel
    d.rounded_rectangle((88, 170, 760, H-92), radius=20, fill=panel2, outline=(76,110,178), width=2)

    # right mock UI panel
    d.rounded_rectangle((790, 170, W-90, H-92), radius=20, fill=(12,20,42), outline=(65,98,164), width=2)

    # title
    tf = title_font if i == 1 or i == len(slides) else step_font
    d.text((116, 214), title, font=tf, fill=white)
    d.text((116, 292), body, font=body_font, fill=muted)

    # callout badges
    d.rounded_rectangle((116, 362, 420, 414), radius=14, fill=(17,45,88), outline=accent2, width=2)
    d.text((134, 376), 'Simple • Premium • Fast', font=small_font, fill=(198,220,255))

    d.rounded_rectangle((116, 430, 500, 482), radius=14, fill=(62,33,12), outline=accent, width=2)
    d.text((134, 444), 'White-Label: app.thelegacylink.com', font=small_font, fill=(255,215,178))

    # mock ui elements on right
    d.rounded_rectangle((820, 200, W-120, 245), radius=10, fill=(18,33,62), outline=(72,109,182), width=1)
    d.text((836, 214), 'LeadConnector', font=small_font, fill=white)

    # sidebar
    d.rounded_rectangle((820, 260, 930, H-120), radius=10, fill=(16,30,56), outline=(57,90,150), width=1)
    items = ['Dashboard','Contacts','Conversations','Opportunities','Settings']
    for idx, item in enumerate(items):
        y = 284 + idx*58
        fill = (245,132,38) if ('Contacts' in item and i in [6,7]) or ('Conversations' in item and i in [8]) else (180,194,224)
        d.text((836, y), item, font=small_font, fill=fill)

    # content blocks
    d.rounded_rectangle((950, 260, W-120, 338), radius=10, fill=(22,38,69), outline=(57,90,150), width=1)
    d.text((968, 286), 'Lead Record', font=small_font, fill=white)

    d.rounded_rectangle((950, 352, W-120, 430), radius=10, fill=(22,38,69), outline=(57,90,150), width=1)
    d.text((968, 378), 'Dial / Message', font=small_font, fill=white)

    d.rounded_rectangle((950, 444, W-120, 522), radius=10, fill=(22,38,69), outline=(57,90,150), width=1)
    d.text((968, 470), 'Notes / Timeline', font=small_font, fill=white)

    # step counter
    d.rounded_rectangle((W-210, H-78, W-90, H-40), radius=12, fill=(10,24,49), outline=(66,100,165), width=1)
    d.text((W-193, H-68), f'{i:02d} / {len(slides):02d}', font=small_font, fill=(186,205,246))

    im.save(out_dir / f'slide_{i:02d}.png')

print('Generated slides:', len(slides))
