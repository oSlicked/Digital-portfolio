"""Saves the lifetime loot achievements (Gold Grab, Elixir Escapade, Heroic Heist)
to data/loot.json. A new point is only added when a number changes, so the
file only grows when you actually attack."""
import json, os, sys, time, urllib.request, urllib.error

TAG = '#88RJQPR0P'
URL = 'https://cocproxy.royaleapi.dev/v1/players/' + TAG.replace('#', '%23')
FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'loot.json')
KEYS = {'Gold Grab': 'g', 'Elixir Escapade': 'e', 'Heroic Heist': 'd'}

token = os.environ.get('COC_TOKEN', '').strip()
if not token:
    print('COC_API_TOKEN secret is not set yet, skipping'); sys.exit(0)

req = urllib.request.Request(URL, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        player = json.load(r)
except urllib.error.HTTPError as e:
    print('API error', e.code, e.read()[:300]); sys.exit(1)

point = {'t': int(time.time())}
for a in player.get('achievements', []):
    k = KEYS.get(a.get('name'))
    if k: point[k] = a.get('value', 0)
if len(point) < 4:
    print('Loot achievements missing from the response'); sys.exit(1)
point['th'] = player.get('townHallLevel')

try:
    data = json.load(open(FILE))
except (FileNotFoundError, json.JSONDecodeError):
    data = {'tag': TAG, 'points': []}
pts = data['points']
last = pts[-1] if pts else None
if last and all(last.get(k) == point[k] for k in 'ged'):
    print('No change since', last['t'])
else:
    pts.append(point); print('Saved', point)
json.dump(data, open(FILE, 'w'), separators=(',', ':'))
