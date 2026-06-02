import json

with open('backend/data/db.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

for idx, m in enumerate(db['members']):
    print(f"{idx+1}: ID={m.get('discordId')} | User={m.get('username')} | Nick={m.get('nickname')} | Kills={m.get('kills')} | WeeklyKills={m.get('weeklyKills')}")
