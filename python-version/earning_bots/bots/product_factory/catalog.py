"""What the Product Factory can make: bundles of pages, their listing copy, tags and prices.
Every bundle x every colour theme is a separate product (10 x 8 = 80 to start).
Add a bundle here, or a theme in layouts.THEMES, to grow the catalogue."""

BUNDLES = {
    "planner": {
        "name": "Weekly & Daily Planner Bundle",
        "pages": ["weekly_planner", "daily_planner", "todo_list"],
        "price": 4.90,
        "intro": "Plan your week, run your days and clear your to-do list with this clean, undated planner set.",
        "tags": ["weekly planner", "daily planner", "printable planner", "planner pdf", "undated planner",
                 "planner insert", "to do list", "productivity", "planner pages", "a4 planner"],
    },
    "budget": {
        "name": "Budget Planner Bundle",
        "pages": ["monthly_budget", "expense_tracker", "savings_tracker"],
        "price": 5.90,
        "intro": "Take control of your money: plan the month, track every expense and watch your savings grow.",
        "tags": ["budget planner", "monthly budget", "expense tracker", "savings tracker", "finance planner",
                 "budget template", "bill tracker", "money planner", "budget printable", "savings challenge"],
    },
    "habit": {
        "name": "Habit Tracker & Gratitude Pages",
        "pages": ["habit_tracker", "gratitude_journal"],
        "price": 3.90,
        "intro": "Build better habits one day at a time, and end each day noticing what went well.",
        "tags": ["habit tracker", "monthly tracker", "goal tracker", "self care planner", "habit printable",
                 "gratitude journal", "routine tracker", "wellness planner", "bullet journal", "daily habits"],
    },
    "meal": {
        "name": "Meal Planner & Grocery List",
        "pages": ["meal_planner"],
        "price": 3.50,
        "intro": "Plan a week of meals in minutes and shop with a ready-made grocery checklist.",
        "tags": ["meal planner", "grocery list", "menu planner", "weekly meal plan", "meal prep",
                 "food planner", "shopping list", "kitchen printable", "family meal plan", "dinner planner"],
    },
    "reading": {
        "name": "Reading Log & Book Tracker",
        "pages": ["reading_log"],
        "price": 3.20,
        "intro": "Keep track of every book you read this year, with start and finish dates and a 5-star rating.",
        "tags": ["reading log", "reading journal", "book tracker", "book lover gift", "reading tracker",
                 "book journal", "bookish printable", "reading challenge", "book review", "library log"],
    },
    "fitness": {
        "name": "Workout Log & Fitness Tracker",
        "pages": ["workout_log", "habit_tracker"],
        "price": 3.90,
        "intro": "Log every workout, sets, reps and weights, and keep your fitness habits on track all month.",
        "tags": ["workout log", "fitness planner", "gym tracker", "exercise log", "fitness journal",
                 "workout planner", "habit tracker", "training log", "health tracker", "gym printable"],
    },
    "cleaning": {
        "name": "Cleaning Schedule & Chore Checklist",
        "pages": ["cleaning_schedule", "todo_list"],
        "price": 3.20,
        "intro": "Keep your home under control with daily, weekly and monthly cleaning checklists.",
        "tags": ["cleaning schedule", "cleaning checklist", "chore chart", "home organization", "cleaning planner",
                 "house chores", "weekly cleaning", "household planner", "to do list", "home printable"],
    },
    "gratitude": {
        "name": "Daily Gratitude Journal Page",
        "pages": ["gratitude_journal"],
        "price": 2.90,
        "intro": "A calm, five-minute daily page for gratitude, affirmations and a quick mood check-in.",
        "tags": ["gratitude journal", "daily journal", "mindfulness", "self care journal", "journal pages",
                 "journal printable", "positive mindset", "five minute journal", "reflection journal",
                 "morning journal"],
    },
    "savings": {
        "name": "100-Step Savings Challenge Tracker",
        "pages": ["savings_tracker"],
        "price": 2.90,
        "intro": "Make saving fun: colour in a circle every time you put money aside and log every deposit.",
        "tags": ["savings tracker", "savings challenge", "money saving", "savings goal", "100 envelope",
                 "finance tracker", "debt free", "budget printable", "saving printable", "money tracker"],
    },
    "life": {
        "name": "Ultimate Life Planner Bundle",
        "pages": ["weekly_planner", "daily_planner", "todo_list", "habit_tracker", "monthly_budget",
                  "expense_tracker", "savings_tracker", "meal_planner", "reading_log", "workout_log",
                  "cleaning_schedule", "gratitude_journal"],
        "price": 9.90,
        "intro": "Everything in one download: 12 planner pages for your time, money, home, health and goals.",
        "tags": ["life planner", "printable planner", "planner bundle", "budget planner", "habit tracker",
                 "meal planner", "weekly planner", "daily planner", "undated planner", "planner pdf"],
    },
}


def clean_tags(tags, theme):
    out = []
    for t in list(tags) + [f"{theme.lower()} planner", "printable pdf", "instant download"]:
        t = t.strip().lower()
        if t and len(t) <= 20 and t not in out:
            out.append(t)
    return out[:13]


def listing_copy(bundle_key, theme, page_names, price):
    b = BUNDLES[bundle_key]
    n = len(page_names)
    title = f"{b['name']}, {theme} Minimalist Printable, A4 & US Letter PDF, Undated, Instant Download"
    if len(title) > 140:
        title = f"{b['name']}, {theme} Printable PDF, A4 & US Letter"
    included = "\n".join(f"- {name}" for name in page_names)
    description = f"""{b['intro']}

WHAT'S INCLUDED
{included}
- {n} page{'s' if n != 1 else ''}, each in A4 and US Letter size (2 PDF files)
- {theme} colour theme with a clean, minimalist design
- Undated, so you can use it any year and print it as often as you like

HOW IT WORKS
1. Buy and download the files instantly
2. Open the PDF on your computer, tablet or phone
3. Print at home or at a print shop, as many copies as you need
4. Or write on it digitally in a note-taking app that supports PDF annotation

PLEASE NOTE
- This is a digital download. No physical item will be shipped.
- Colours can look slightly different depending on your screen and printer.
- For personal use only. Please do not share or resell the files.
"""
    return {
        "title": title,
        "short_name": f"{b['name']} ({theme})",
        "description": description,
        "tags": clean_tags(b["tags"], theme),
        "price": round(price, 2),
    }
