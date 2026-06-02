import json

# Data from screenshots
alltime_screenshot = {
    "171896": ("Louis Silva", 137),
    "155077": ("Akash", 134),
    "130686": ("Mikey Bonz", 132),
    "cobra-mock": ("Cobra Entity", 116),
    "48888": ("Michael Makarovvicious 48888", 110),
    "170715": ("Clark Turechad 170715", 107),
    "48079": ("Yasseen Riviera | 48079", 103),
    "12623": ("winston wir | 12623", 101),
    "70941": ("Chloe Veneta | 70941", 100),
    "alikagan-mock": ("Alikagan", 93),
    "61783": ("Quaresma | Dona ~ | 61783", 89),
    "dick-supplier-mock": ("Dick Supplier", 86),
    "82934": ("SUKUNA MAKAROVVICIOUS | 82934", 86),
    "172247": ("Dryhes Mattis 172247", 81),
    "101254": ("Melissa MakarovVicious | 101254", 81),
    "3572": ("Lokmane Bonz | 3572", 77),
    "116365": ("Calm Vicious 116365", 74),
    "127353": ("Franz Barnicht | 127353", 72),
    "gardy-mock": ("Gardy", 71),
    "7386": ("Bruno Dior | 7386", 70),
    "110116": ("Prem Cullen | 110116", 70),
    "152194": ("Calvin Reyy | 152194", 68),
    "43022": ("Aditya/Fake Vicious 43022", 67),
    "can-mock": ("can", 64),
    "harry-mock": ("[Harry]", 64)
}

weekly_screenshot = {
    "70941": 60,
    "170715": 56,
    "155077": 50,
    "101254": 49,
    "cobra-mock": 46,
    "82934": 37,
    "48888": 36,
    "alikagan-mock": 33,
    "harry-mock": 33,
    "24644": 30,
    "61783": 29,
    "152194": 26,
    "133338": 25,
    "110116": 24,
    "dick-supplier-mock": 23,
    "171896": 20,
    "116365": 19,
    "48079": 19
}

db_path = 'backend/data/db.json'
with open(db_path, 'r', encoding='utf-8') as f:
    db = json.load(f)

updated = False

# We map players in the DB to their respective ID in screenshot data
for m in db['members']:
    did = m['discordId']
    
    # 1. Update All-Time Kills
    if did in alltime_screenshot:
        name, kills = alltime_screenshot[did]
        if m.get('kills') != kills:
            print(f"Updating kills for {m['username']} ({did}): {m.get('kills')} -> {kills}")
            m['kills'] = kills
            updated = True
            
    # 2. Update Weekly Kills
    if did in weekly_screenshot:
        weekly_kills = weekly_screenshot[did]
        if m.get('weeklyKills') != weekly_kills:
            print(f"Updating weeklyKills for {m['username']} ({did}): {m.get('weeklyKills')} -> {weekly_kills}")
            m['weeklyKills'] = weekly_kills
            updated = True

if updated:
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2)
    print("Database updated successfully.")
else:
    print("All values in the database already match the screenshots perfectly.")
