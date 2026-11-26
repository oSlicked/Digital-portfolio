"""Saves the lifetime loot achievements (Gold Grab, Elixir Escapade, Heroic Heist)
for each account. A new point is only added when a number changes, so a file
only grows when that account actually attacks."""
import json, os, sys, time, urllib.request, urllib.error

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
ACCOUNTS = {'#88RJQPR0P': 'loot.json', '#9ULLC0CYV': 'loot-9ULLC0CYV.json'}
KEYS = {'Gold Grab': 'g', 'Elixir Escapade': 'e', 'Heroic Heist': 'd'}

token = os.environ.get('COC_TOKEN', '').strip()
if not token:
    print('COC_API_TOKEN secret is not set yet, skipping'); sys.exit(0)

ok = 0
for TAG, name in ACCOUNTS.items():
    FILE = os.path.join(DATA, name)
    URL = 'https://cocproxy.royaleapi.dev/v1/players/' + TAG.replace('#', '%23')
    req = urllib.request.Request(URL, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            player = json.load(r)
    except Exception as e:
        print(TAG, 'API error', getattr(e, 'code', e)); continue
    point = {'t': int(time.time())}
    for a in player.get('achievements', []):
        k = KEYS.get(a.get('name'))
        if k: point[k] = a.get('value', 0)
    if len(point) < 4:
        print(TAG, 'loot achievements missing from the response'); continue
    point['th'] = player.get('townHallLevel')
    ok += 1
    try:
        data = json.load(open(FILE))
    except (FileNotFoundError, json.JSONDecodeError):
        data = {'tag': TAG, 'points': []}
    pts = data['points']
    last = pts[-1] if pts else None
    if last and all(last.get(k) == point[k] for k in 'ged'):
        print(TAG, 'no change since', last['t']); continue
    pts.append(point); print(TAG, 'saved', point)
    json.dump(data, open(FILE, 'w'), separators=(',', ':'))
if not ok:
    sys.exit(1)
