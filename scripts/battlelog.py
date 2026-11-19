"""Saves every attack from the Clash of Clans battle log to data/attacks.json.

The official battle log only keeps recent battles, so this runs on a schedule
and adds anything new. Each attack is saved once (keyed by time + opponent).
Defenses are skipped. The API key stays in the COC_API_TOKEN GitHub secret and
goes through the RoyaleAPI proxy, so the key is whitelisted for 45.79.218.79.
"""
import json, os, sys, time, calendar, urllib.request, urllib.error
from datetime import datetime, timezone

TAGS = ['#88RJQPR0P']          # add more accounts here if you want them combined
BASE = 'https://cocproxy.royaleapi.dev/v1/players/'
FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'attacks.json')
KEEP = 20000                    # plenty of years of attacks; oldest drop off after this

token = os.environ.get('COC_TOKEN', '').strip()
if not token:
    print('COC_API_TOKEN secret is not set yet, skipping'); sys.exit(0)


def get(tag):
    url = BASE + tag.replace('#', '%23') + '/battlelog'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.load(r)
    return body.get('items', body) if isinstance(body, dict) else body


def ts(s):
    """API time like 20261119T212700.000Z (ISO also accepted) to epoch seconds."""
    if not s: return None
    for f in ('%Y%m%dT%H%M%S.%fZ', '%Y%m%dT%H%M%SZ', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ'):
        try: return calendar.timegm(datetime.strptime(s, f).timetuple())
        except ValueError: pass
    return None


def res(v):
    """lootedResources is a list of {name, amount}; also accept a {gold, elixir, darkElixir} dict."""
    out = {'g': 0, 'e': 0, 'd': 0}
    items = v.items() if isinstance(v, dict) else ((x.get('name', ''), x.get('amount', 0)) for x in (v or []))
    for name, amt in items:
        n = str(name).lower().replace(' ', '').replace('_', '')
        k = {'gold': 'g', 'elixir': 'e', 'darkelixir': 'd'}.get(n)  # skips SourElixir and others
        if k: out[k] += int(amt or 0)
    return out


try:
    data = json.load(open(FILE))
except (FileNotFoundError, json.JSONDecodeError):
    data = {'attacks': [], 'gaps': []}
data.setdefault('attacks', []); data.setdefault('gaps', [])
seen = {a['k'] for a in data['attacks']}
added, status = 0, {}

for tag in TAGS:
    try:
        log = get(tag)
    except urllib.error.HTTPError as e:
        msg = e.read()[:300].decode('utf8', 'replace')
        print(tag, 'API error', e.code, msg)
        status[tag] = {'ok': False, 'code': e.code}
        continue
    except Exception as e:  # network trouble: try again next run
        print(tag, 'request failed', e); status[tag] = {'ok': False}; continue

    times = [ts(b.get('battleTimestamp')) for b in log]
    times = [t for t in times if t]
    print(f'{tag}: {len(log)} battles in log, {sum(1 for b in log if b.get("attack"))} attacks,',
          'oldest', datetime.fromtimestamp(min(times), timezone.utc) if times else None,
          'newest', datetime.fromtimestamp(max(times), timezone.utc) if times else None)
    if log:  # field check in the run log (no secrets in here)
        print('fields:', sorted(log[0].keys()))
        print('battle types:', sorted({str(b.get('battleType')) for b in log}))
        for b in [x for x in log if x.get('attack')][-2:]:
            print('raw loot:', b.get('battleTimestamp'), b.get('lootedResources'), 'extra:', b.get('extraLootedResources'), 'avail:', b.get('availableLoot'))
        print('resource names:', sorted({r.get('name') for b in log for r in (b.get('lootedResources') or []) if isinstance(r, dict)}))
    status[tag] = {'ok': True, 'size': len(log)}

    # Possible missed attacks: our newest saved attack is older than everything in the log
    mine = [a['t'] for a in data['attacks'] if a.get('a', TAGS[0]) == tag]
    if mine and times and max(mine) < min(times):
        data['gaps'].append({'a': tag, 'from': max(mine), 'to': min(times)})
        print('Gap: battle log no longer reaches back to the last saved attack')

    for b in log:
        if not b.get('attack'): continue
        t = ts(b.get('battleTimestamp'))
        if not t: continue
        k = f"{tag}|{t}|{b.get('opponentPlayerTag', b.get('opponentName', ''))}"
        if k in seen: continue
        seen.add(k); added += 1
        loot, bonus = res(b.get('lootedResources')), res(b.get('extraLootedResources'))
        row = {'k': k, 't': t, 'type': b.get('battleType'),
               'o': b.get('opponentName'), 'th': b.get('opponentTownHallLevel'),
               's': b.get('stars', 0), 'p': b.get('destructionPercentage', 0),
               'dur': b.get('battleTime'),
               'g': loot['g'], 'e': loot['e'], 'd': loot['d'],
               'bg': bonus['g'], 'be': bonus['e'], 'bd': bonus['d']}
        if len(TAGS) > 1: row['a'] = tag
        data['attacks'].append(row)

data['attacks'].sort(key=lambda a: a['t'], reverse=True)
data['attacks'] = data['attacks'][:KEEP]
data['gaps'] = data['gaps'][-50:]
data['tags'] = TAGS
if added or not os.path.exists(FILE) or data.get('status') != status:
    data['status'] = status
    data['saved'] = int(time.time())
    os.makedirs(os.path.dirname(FILE), exist_ok=True)
    json.dump(data, open(FILE, 'w'), separators=(',', ':'))
print('New attacks saved:', added)
if status and not any(s['ok'] for s in status.values()):
    sys.exit(1)
