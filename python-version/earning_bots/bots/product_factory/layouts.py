"""Printable page designs. Each layout function draws onto a Page; the same shapes become
the PDF and the preview images."""
from ...core.pdf import text_width

SIZES = {"A4": (595.28, 841.89), "US-Letter": (612.0, 792.0)}

THEMES = {
    "Sage":       {"accent": (104, 135, 104), "light": (231, 238, 229)},
    "Blush":      {"accent": (190, 118, 120), "light": (249, 233, 231)},
    "Navy":       {"accent": (38, 58, 98),    "light": (225, 230, 240)},
    "Terracotta": {"accent": (184, 96, 66),   "light": (247, 231, 222)},
    "Lavender":   {"accent": (128, 104, 164), "light": (238, 232, 246)},
    "Monochrome": {"accent": (38, 38, 38),    "light": (234, 234, 234)},
    "Ocean":      {"accent": (34, 112, 132),  "light": (224, 240, 243)},
    "Mustard":    {"accent": (176, 132, 30),  "light": (248, 239, 216)},
}
for _t in THEMES.values():
    _t.update({"ink": (55, 55, 55), "rule": (196, 196, 196)})


class Page:
    def __init__(self, size, theme):
        self.W, self.H = size
        self.th = theme
        self.m = 36
        self.g = 10
        self.shapes = []

    @property
    def inner_w(self):
        return self.W - 2 * self.m

    # primitives
    def rect(self, x, y, w, h, stroke=None, fill=None, lw=0.8):
        self.shapes.append({"t": "rect", "x": x, "y": y, "w": w, "h": h, "stroke": stroke, "fill": fill, "lw": lw})

    def line(self, x1, y1, x2, y2, color=None, lw=0.5, dash=False):
        self.shapes.append({"t": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                            "color": color or self.th["rule"], "lw": lw, "dash": dash})

    def circle(self, cx, cy, r, stroke=None, fill=None, lw=0.7):
        self.shapes.append({"t": "circle", "cx": cx, "cy": cy, "r": r, "stroke": stroke, "fill": fill, "lw": lw})

    def text(self, x, y, size, text, color=None, bold=False, align="left"):
        self.shapes.append({"t": "text", "x": x, "y": y, "s": size, "text": text,
                            "color": color or self.th["ink"], "bold": bold, "align": align})

    # building blocks
    def header(self, title, fields=()):
        m, acc = self.m, self.th["accent"]
        self.text(m, m + 24, 24, title, acc, bold=True)
        fw = 170
        base = m + 24 - 16 * (len(fields) - 1)
        for i, f in enumerate(fields):
            self.label(self.W - m - fw, base + 16 * i, f, fw)
        self.line(m, m + 36, self.W - m, m + 36, color=acc, lw=1.5)
        return m + 48

    def label(self, x, y, text, w):
        self.text(x, y, 7.5, text, bold=True)
        tw = text_width(text, 7.5, True)
        self.line(x + tw + 5, y + 1.5, x + w, y + 1.5, lw=0.6)

    def box(self, x, y, w, h, title=None):
        self.rect(x, y, w, h, stroke=self.th["accent"], lw=0.8)
        if not title:
            return y
        self.rect(x, y, w, 17, fill=self.th["light"])
        self.line(x, y + 17, x + w, y + 17, color=self.th["accent"], lw=0.5)
        self.text(x + 8, y + 11.8, 7.5, title, self.th["accent"], bold=True)
        return y + 17

    def lines(self, x, y, w, h, sp=18):
        yy = y + sp
        while yy <= y + h - 4:
            self.line(x + 8, yy, x + w - 8, yy)
            yy += sp

    def checklist(self, x, y, w, h, sp=18, items=()):
        yy, i = y + sp, 0
        while yy <= y + h - 4:
            self.rect(x + 8, yy - 8, 7, 7, stroke=self.th["accent"], lw=0.6)
            self.line(x + 21, yy, x + w - 8, yy)
            if i < len(items):
                self.text(x + 23, yy - 2.4, 8, items[i])
            i += 1
            yy += sp

    def table(self, x, y, w, h, headers, fracs=None, row_h=18, labels=(), head_h=18):
        fracs = fracs or [1 / len(headers)] * len(headers)
        xs = [x]
        for f in fracs:
            xs.append(xs[-1] + w * f)
        xs[-1] = x + w
        n = max(1, int((h - head_h) // row_h))
        bottom = y + head_h + n * row_h
        acc = self.th["accent"]
        self.rect(x, y, w, head_h, fill=self.th["light"])
        for i, head in enumerate(headers):
            colw = xs[i + 1] - xs[i]
            size = 7.5 if colw > 30 else 6
            if head:
                self.text((xs[i] + xs[i + 1]) / 2, y + head_h / 2 + size * 0.36, size, head, acc, bold=True,
                          align="center")
        for r in range(1, n):
            yy = y + head_h + r * row_h
            self.line(x, yy, x + w, yy)
        for i, lab in enumerate(labels[:n]):
            yy = y + head_h + i * row_h + row_h / 2 + 2.8
            self.text((xs[0] + xs[1]) / 2, yy, 7.5, lab, acc, bold=True, align="center")
        for cx in xs[1:-1]:
            self.line(cx, y, cx, bottom)
        self.line(x, y + head_h, x + w, y + head_h, color=acc, lw=0.6)
        self.rect(x, y, w, bottom - y, stroke=acc, lw=0.8)
        return bottom, n, xs


# ---- layouts --------------------------------------------------------------

DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]


def weekly_planner(p):
    y = p.header("WEEKLY PLANNER", ["WEEK OF"])
    m, g = p.m, p.g
    cw = (p.inner_w - g) / 2
    rh = (p.H - m - y - 3 * g) / 4
    for i in range(8):
        x, yy = m + (i % 2) * (cw + g), y + (i // 2) * (rh + g)
        if i < 7:
            top = p.box(x, yy, cw, rh, DAYS[i])
            p.lines(x, top, cw, rh - 17)
        else:
            top = p.box(x, yy, cw, rh, "TOP PRIORITIES")
            p.checklist(x, top, cw, rh - 17)


def daily_planner(p):
    y = p.header("DAILY PLANNER", ["DATE"])
    m, g, acc = p.m, p.g, p.th["accent"]
    lw = (p.inner_w - g) * 0.55
    rw, rx = p.inner_w - g - lw, m + lw + g
    hgt = p.H - m - y
    top = p.box(m, y, lw, hgt, "SCHEDULE")
    hours = [f"{h % 12 or 12} {'AM' if h < 12 else 'PM'}" for h in range(6, 22)]
    sp = (hgt - 17) / (len(hours) + 0.6)
    for i, hr in enumerate(hours):
        yy = top + (i + 1) * sp
        p.text(m + 8, yy - 4, 7, hr, acc, bold=True)
        p.line(m + 42, yy, m + lw - 8, yy)
    h1, h3, h4 = hgt * 0.17, hgt * 0.2, 46
    h2 = hgt - h1 - h3 - h4 - 3 * g
    yy = y
    t = p.box(rx, yy, rw, h1, "TOP 3 PRIORITIES")
    p.checklist(rx, t, rw, h1 - 17, sp=(h1 - 17 - 5) / 3)
    yy += h1 + g
    t = p.box(rx, yy, rw, h2, "TO DO")
    p.checklist(rx, t, rw, h2 - 17)
    yy += h2 + g
    t = p.box(rx, yy, rw, h3, "NOTES")
    p.lines(rx, t, rw, h3 - 17)
    yy += h3 + g
    t = p.box(rx, yy, rw, h4, "WATER")
    for i in range(8):
        p.circle(rx + 20 + i * ((rw - 40) / 7), t + (h4 - 17) / 2, 6.5, stroke=acc)


def habit_tracker(p):
    y = p.header("HABIT TRACKER", ["MONTH"])
    m, g, w = p.m, p.g, p.inner_w
    first = 110
    fracs = [first / w] + [(w - first) / w / 31] * 31
    th = (p.H - m - y) * 0.76
    bottom, _, _ = p.table(m, y, w, th, ["HABIT"] + [str(d) for d in range(1, 32)], fracs, row_h=(th - 18) / 15)
    rest = p.H - m - bottom - g
    top = p.box(m, bottom + g, w, rest, "NOTES & REFLECTION")
    p.lines(m, top, w, rest - 17)


def monthly_budget(p):
    y = p.header("MONTHLY BUDGET", ["MONTH"])
    m, g, w = p.m, p.g, p.inner_w
    bw, bh = (w - 2 * g) / 3, 50
    for i, lab in enumerate(["TOTAL INCOME", "TOTAL EXPENSES", "LEFT OVER"]):
        x = m + i * (bw + g)
        p.box(x, y, bw, bh, lab)
        p.line(x + 14, y + bh - 9, x + bw - 14, y + bh - 9)
    y += bh + g
    cw, avail = (w - g) / 2, p.H - m - y
    h1 = avail * 0.32
    p.table(m, y, cw, h1, ["INCOME SOURCE", "AMOUNT"], [0.64, 0.36])
    p.table(m, y + h1 + g, cw, avail - h1 - g, ["FIXED BILLS", "DUE", "AMOUNT", "PAID"], [0.4, 0.18, 0.24, 0.18])
    rx = m + cw + g
    h2 = avail * 0.68
    p.table(rx, y, cw, h2, ["SPENDING", "BUDGET", "ACTUAL"], [0.44, 0.28, 0.28])
    top = p.box(rx, y + h2 + g, cw, avail - h2 - g, "NOTES")
    p.lines(rx, top, cw, avail - h2 - g - 17)


def expense_tracker(p):
    y = p.header("EXPENSE TRACKER", ["MONTH"])
    m, w = p.m, p.inner_w
    p.table(m, y, w, p.H - m - y - 30, ["DATE", "DESCRIPTION", "CATEGORY", "AMOUNT"], [0.14, 0.44, 0.24, 0.18], row_h=20)
    p.label(p.W - m - 170, p.H - m - 4, "TOTAL", 170)


def meal_planner(p):
    y = p.header("MEAL PLANNER", ["WEEK OF"])
    m, g, w = p.m, p.g, p.inner_w
    h1 = (p.H - m - y) * 0.62
    p.table(m, y, w, h1, ["", "BREAKFAST", "LUNCH", "DINNER", "SNACKS"], [0.12] + [0.22] * 4,
            row_h=(h1 - 18) / 7, labels=[d[:3] for d in DAYS])
    rest = p.H - m - y - h1 - g
    top = p.box(m, y + h1 + g, w, rest, "GROCERY LIST")
    cw = w / 3
    for c in range(3):
        p.checklist(m + c * cw, top, cw, rest - 17)


def reading_log(p):
    y = p.header("READING LOG", ["YEAR"])
    m, w, acc = p.m, p.inner_w, p.th["accent"]
    row_h = 24
    bottom, n, xs = p.table(m, y, w, p.H - m - y, ["BOOK TITLE", "AUTHOR", "STARTED", "FINISHED", "RATING"],
                            [0.34, 0.24, 0.13, 0.13, 0.16], row_h=row_h)
    mid = (xs[4] + xs[5]) / 2
    for r in range(n):
        cy = y + 18 + r * row_h + row_h / 2
        for k in range(5):
            p.circle(mid + (k - 2) * 11, cy, 3.6, stroke=acc, lw=0.5)


def workout_log(p):
    y = p.header("WORKOUT LOG", ["DATE"])
    m, g, w, acc = p.m, p.g, p.inner_w, p.th["accent"]
    p.label(m, y + 8, "FOCUS", w * 0.48)
    p.label(m + w * 0.52, y + 8, "DURATION", w * 0.48)
    y += 22
    th = (p.H - m - y) * 0.72
    bottom, _, _ = p.table(m, y, w, th, ["EXERCISE", "SETS", "REPS", "WEIGHT", "NOTES"],
                           [0.34, 0.11, 0.11, 0.14, 0.30], row_h=22)
    rest = p.H - m - bottom - g
    lw = w * 0.62
    top = p.box(m, bottom + g, lw, rest, "HOW I FELT")
    p.lines(m, top, lw, rest - 17)
    rx, rw = m + lw + g, w - lw - g
    top = p.box(rx, bottom + g, rw, rest, "WATER")
    for i in range(8):
        cx = rx + rw / 5 * (i % 4 + 1)
        cy = top + (rest - 17) / 3 * (i // 4 + 1)
        p.circle(cx, cy, 8, stroke=acc)


CLEANING = {
    "DAILY": ["Make beds", "Wash dishes", "Wipe counters", "Sweep kitchen", "Tidy living room", "Laundry load",
              "Take out trash"],
    "WEEKLY": ["Vacuum floors", "Mop floors", "Clean bathrooms", "Change bed sheets", "Dust surfaces",
               "Clean mirrors", "Water plants"],
    "MONTHLY": ["Clean fridge", "Clean oven", "Wash windows", "Declutter closet", "Clean vents", "Wash curtains",
                "Deep clean bath"],
}


def cleaning_schedule(p):
    y = p.header("CLEANING SCHEDULE", ["WEEK OF"])
    m, g, w = p.m, p.g, p.inner_w
    h1 = (p.H - m - y) * 0.62
    cw = (w - 2 * g) / 3
    for i, (title, items) in enumerate(CLEANING.items()):
        x = m + i * (cw + g)
        top = p.box(x, y, cw, h1, title)
        p.checklist(x, top, cw, h1 - 17, items=items)
    rest = p.H - m - y - h1 - g
    top = p.box(m, y + h1 + g, w, rest, "EXTRA TASKS")
    p.checklist(m, top, w / 2, rest - 17)
    p.checklist(m + w / 2, top, w / 2, rest - 17)


def gratitude_journal(p):
    y = p.header("GRATITUDE JOURNAL", ["DATE"])
    m, g, w, acc = p.m, p.g, p.inner_w, p.th["accent"]
    avail = p.H - m - y - 4 * g
    fr = [0.22, 0.2, 0.15, 0.13, 0.30]
    titles = ["TODAY I AM GRATEFUL FOR", "BEST PART OF MY DAY", "TODAY'S AFFIRMATION", "MOOD", "TOMORROW I WILL"]
    yy = y
    for f, title in zip(fr, titles):
        h = avail * f
        top = p.box(m, yy, w, h, title)
        if title == "TODAY I AM GRATEFUL FOR":
            sp = (h - 17 - 5) / 3
            for i in range(3):
                ly = top + (i + 1) * sp
                p.text(m + 10, ly - 2.5, 9, f"{i + 1}.", acc, bold=True)
                p.line(m + 24, ly, m + w - 8, ly)
        elif title == "MOOD":
            moods = ["GREAT", "GOOD", "OKAY", "LOW", "ROUGH"]
            for i, mood in enumerate(moods):
                cx = m + w / 6 * (i + 1)
                p.circle(cx, top + (h - 17) * 0.42, 9, stroke=acc)
                p.text(cx, top + (h - 17) * 0.42 + 22, 7, mood, align="center")
        elif title == "TOMORROW I WILL":
            p.checklist(m, top, w, h - 17)
        else:
            p.lines(m, top, w, h - 17)
        yy += h + g


def savings_tracker(p):
    y = p.header("SAVINGS TRACKER", ["GOAL", "TARGET"])
    m, g, w, acc = p.m, p.g, p.inner_w, p.th["accent"]
    p.label(m, y + 8, "SAVING FOR", w * 0.48)
    p.label(m + w * 0.52, y + 8, "DEADLINE", w * 0.48)
    y += 22
    gh = (p.H - m - y) * 0.52
    top = p.box(m, y, w, gh, "COLOUR ONE CIRCLE FOR EVERY STEP SAVED")
    cell = min(w / 10, (gh - 17) / 10)
    ox = m + (w - cell * 10) / 2
    for i in range(100):
        cx = ox + cell * (i % 10) + cell / 2
        cy = top + cell * (i // 10) + cell / 2
        p.circle(cx, cy, cell * 0.38, stroke=acc, lw=0.6)
        p.text(cx, cy + cell * 0.09, cell * 0.24, str(i + 1), align="center")
    ty = y + gh + g
    p.table(m, ty, w, p.H - m - ty, ["DATE", "AMOUNT ADDED", "TOTAL SAVED", "NOTE"], [0.18, 0.24, 0.24, 0.34])


def todo_list(p):
    y = p.header("TO DO LIST", ["DATE"])
    m, g, w = p.m, p.g, p.inner_w
    h1 = (p.H - m - y) * 0.74
    cw = (w - g) / 2
    for i, title in enumerate(["MUST DO", "NICE TO DO"]):
        x = m + i * (cw + g)
        top = p.box(x, y, cw, h1, title)
        p.checklist(x, top, cw, h1 - 17)
    rest = p.H - m - y - h1 - g
    top = p.box(m, y + h1 + g, w, rest, "NOTES")
    p.lines(m, top, w, rest - 17)


LAYOUTS = {
    "weekly_planner": ("Weekly Planner", weekly_planner),
    "daily_planner": ("Daily Planner", daily_planner),
    "todo_list": ("To Do List", todo_list),
    "habit_tracker": ("Monthly Habit Tracker", habit_tracker),
    "monthly_budget": ("Monthly Budget", monthly_budget),
    "expense_tracker": ("Expense Tracker", expense_tracker),
    "savings_tracker": ("Savings Tracker (100-step challenge)", savings_tracker),
    "meal_planner": ("Weekly Meal Planner & Grocery List", meal_planner),
    "reading_log": ("Reading Log", reading_log),
    "workout_log": ("Workout Log", workout_log),
    "cleaning_schedule": ("Cleaning Schedule", cleaning_schedule),
    "gratitude_journal": ("Gratitude Journal Page", gratitude_journal),
}


def build_page(layout_key, size_name, theme_name):
    page = Page(SIZES[size_name], THEMES[theme_name])
    LAYOUTS[layout_key][1](page)
    return page
