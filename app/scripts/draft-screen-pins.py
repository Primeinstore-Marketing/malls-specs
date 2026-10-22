#!/usr/bin/env python3
"""
Regenerates app/lib/draftPins.ts — an automatic first-guess position for
every screen, so each one is on the map before anyone has placed it.

    python3 app/scripts/draft-screen-pins.py [--cache DIR]

For each screen, the rule below says how to find it, using shops and
places inside the mall from OpenStreetMap (via the Overpass API):

  store   — at a store with that name or brand            -> 'osm-draft'
            (two patterns: midway between the two stores)
  place   — at a named spot in the mall, e.g. a "Piazza"   -> 'osm-draft'
  food    — an OSM food court, else the densest cluster of
            restaurants / takeaways / cafés                -> 'estimated'
  (none)  — parked in the middle of the mall               -> 'placeholder'

Any rule that finds nothing falls back to a placeholder, so a screen is
never missing from the map. Confirmed positions in screenPins.ts always
win over these, so re-running this never undoes anyone's work.

--cache DIR reuses (and saves) the raw Overpass responses in DIR, which
saves a few minutes when tweaking the rules. Overpass is a shared free
service and is sometimes busy; failed malls are retried, then skipped
(their screens become placeholders).

Data © OpenStreetMap contributors, ODbL 1.0.
"""
import json
import math
import pathlib
import re
import subprocess
import sys
import time

APP = pathlib.Path(__file__).resolve().parent.parent
OUT = APP / 'lib' / 'draftPins.ts'
OVERPASS = 'https://overpass-api.de/api/interpreter'

# mall id -> [(spec id, rule)]. Malls with no map location (Loch Logan, the
# network-wide formats) aren't listed: there's nowhere to put them.
SCREENS = {
    'cresta': [
        ('spec-cresta-food-court', ('food',)),
        ('spec-cresta-mugg-bean-impact', ('store', r'mugg')),
        ('spec-cresta-woolworth-screen', ('store', r'woolworths')),
    ],
    'menlyn': [
        ('spec-menlyn-cape-union-mart', ('store', r'cape union')),
        ('spec-menlyn-food-court', ('food',)),
        ('spec-menlyn-earthchild', ('store', r'earth ?child')),
        ('spec-menlyn-yuppie-chef', ('store', r'yuppie ?chef')),
        ('spec-menlyn-cavendish-court', ('place', r'cavendish')),
        ('spec-menlyn-aviary-court', ('place', r'aviary')),
        ('spec-menlyn-sky', None),
    ],
    'monte-casino': [
        ('spec-monte-casino-exit-to-piazza', ('place', r'piazza')),
        ('spec-monte-casino-fego', ('store', r'fego')),
        ('spec-monte-casino-nikos', ('store', r'niko')),
        ('spec-monte-casino-grand-staircase', ('place', r'staircase')),
        ('spec-monte-casino-piazza', ('place', r'piazza')),
    ],
    'pavilion': [
        ('spec-pavilion-food-court', ('food',)),
        ('spec-pavilion-fountain-court', ('place', r'fountain')),
        ('spec-pavilion-full-pillar', None),
    ],
    'southgate': [
        ('spec-southgate-food-court-digi-impact', ('food',)),
        ('spec-southgate-foschini-digi-impact', ('store', r'foschini')),
    ],
    'tygervalley': [
        ('spec-tygervalley-food-court', ('food',)),
        ('spec-tygervalley-foschini', ('store', r'foschini')),
    ],
    'bayside': [('spec-bayside-digi-impact', None)],
    'boardwalk': [('spec-boardwalk', None)],
    'brooklyn': [('spec-brooklyn-mall', None)],
    'fourways': [
        ('spec-fourways-food-court', ('food',)),
        ('spec-fourways-pillars', None),
        ('spec-fourways-promo-court', ('place', r'promo')),
    ],
    'gardens': [('spec-gardens-digi-impact', None)],
    'gateway': [('spec-gateway-digi-impact', None)],
    'golden-acre': [('spec-golden-acre-impact', None)],
    'mimosa': [('spec-mimosa-mtvs-digi-engages', None)],
    'n1-city': [('spec-n1-city', None)],
    'paarl-mall': [('spec-paarl-mall-digi-impact', None)],
    'westgate': [('spec-westgate-mtvs-digi-engages', None)],
    'canal-walk': [
        ('spec-canal-walk-food-court', ('food',)),
        ('spec-canal-walk-centre-court', ('place', r'centre court')),
        ('spec-canal-walk-cube-court', ('place', r'cube')),
        ('spec-canal-walk-retail-right-packages', None),
        ('spec-canal-walk-retail-left-packages', None),
    ],
    'cape-gate': [
        ('spec-cape-gate-clicks-woolworths', ('store', r'^clicks', r'woolworths')),
        ('spec-cape-gate-checkers', ('store', r'checkers')),
        ('spec-capegate-food-court', ('food',)),
    ],
    'clearwater': [
        ('spec-clearwater-pick-n-pay', ('store', r'pick ?n ?pay')),
        ('spec-clearwater-food-court', ('food',)),
        ('spec-clearwater-mugg-bean', ('store', r'mugg')),
    ],
    'table-bay': [
        ('spec-table-bay-centre-court', ('place', r'centre court')),
        ('spec-table-bay-checkers-pick-n-pay', ('store', r'checkers', r'pick ?n ?pay')),
    ],
    'hype-park': [('spec-hype-park', None)],
    'rosebank': [
        ('spec-rosebank-mall', None),
        ('spec-rosebank-fnb-pillar', ('store', r'^fnb\b|first national')),
    ],
    'somerset': [('spec-somerset-mall', None)],
    'the-glen': [('spec-the-glen', None)],
    'woodlands': [('spec-woodlands', None)],
}

FOOD_AMENITIES = {'fast_food', 'restaurant', 'cafe', 'food_court', 'ice_cream'}
CLUSTER_RADIUS_M = 50


def load_locations():
    text = (APP / 'lib' / 'mallLocations.ts').read_text()
    return json.loads(text[text.index('= {') + 2 : text.rindex(';')])


def overpass(mall_id, osm_id, cache):
    cached = cache / f'{mall_id}.json' if cache else None
    if cached and cached.exists():
        return json.loads(cached.read_text())['elements']
    kind = {'W': 'way', 'R': 'relation', 'N': 'node'}[osm_id[0]]
    number = osm_id[1:]
    area = (
        f'node({number})->.c;'
        if kind == 'node'
        else f'{kind}({number});map_to_area->.a;'
    )
    within = '(around.c:150)' if kind == 'node' else '(area.a)'
    query = (
        f'[out:json][timeout:60];{area}('
        f'nwr{within}[shop];nwr{within}[amenity];nwr{within}[indoor];'
        f'nwr{within}["name"~"court|piazza|staircase|fountain",i];'
        f');out tags center;'
    )
    for attempt in range(4):
        result = subprocess.run(
            ['curl', '-s', '--fail', '--max-time', '90', '-A', 'malls-specs/0.1', '--data-urlencode', f'data={query}', OVERPASS],
            capture_output=True,
        )
        if result.returncode == 0:
            if cached:
                cached.write_bytes(result.stdout)
            return json.loads(result.stdout)['elements']
        time.sleep(10 * (attempt + 1))
    print(f'  ! {mall_id}: Overpass unavailable — its screens will be placeholders')
    return []


def point_of(element):
    if 'lat' in element:
        return element['lon'], element['lat']
    center = element.get('center')
    return (center['lon'], center['lat']) if center else None


def label_of(element):
    tags = element.get('tags', {})
    return f"{tags.get('name') or tags.get('brand') or tags.get('amenity')} ({element['type']} {element['id']})"


def find_named(elements, pattern):
    rx = re.compile(pattern, re.I)
    hits = [
        e for e in elements
        if point_of(e) and rx.search(' '.join(e.get('tags', {}).get(k, '') for k in ('name', 'brand')))
    ]
    # Prefer an exact name match ("Pick n Pay" over "Pick n Pay Clothing"),
    # then an outline (way) over a point — it's usually the actual unit.
    hits.sort(
        key=lambda e: (
            not rx.fullmatch(e.get('tags', {}).get('name', '').strip()),
            e['type'] == 'node',
        )
    )
    return hits[0] if hits else None


def distance_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111320 * math.cos(lat), (a[1] - b[1]) * 110540)


def food_court(elements):
    court = [e for e in elements if e.get('tags', {}).get('amenity') == 'food_court' and point_of(e)]
    if court:
        return point_of(court[0]), f'OSM food court ({court[0]["type"]} {court[0]["id"]})'
    food = [point_of(e) for e in elements if e.get('tags', {}).get('amenity') in FOOD_AMENITIES and point_of(e)]
    if len(food) < 3:
        return None
    best = max(food, key=lambda p: sum(distance_m(p, q) <= CLUSTER_RADIUS_M for q in food))
    cluster = [q for q in food if distance_m(best, q) <= CLUSTER_RADIUS_M]
    if len(cluster) < 3:
        return None
    lng = sum(q[0] for q in cluster) / len(cluster)
    lat = sum(q[1] for q in cluster) / len(cluster)
    return (lng, lat), f'centre of {len(cluster)} food outlets within {CLUSTER_RADIUS_M} m of each other'


def placeholder_positions(center, bounds, count):
    """Parks screens in a ring around the mall centre, sized to the mall, so
    they stay inside it without piling on top of each other."""
    if count == 1:
        return [center]
    (west, south), (east, north) = bounds
    half_extent_m = min(distance_m((west, center[1]), (east, center[1])), distance_m((center[0], south), (center[0], north))) / 2
    radius_m = max(18, min(90, half_extent_m * 0.45))
    out = []
    for i in range(count):
        angle = 2 * math.pi * i / count - math.pi / 2
        dx = radius_m * math.cos(angle) / (111320 * math.cos(math.radians(center[1])))
        dy = -radius_m * math.sin(angle) / 110540
        out.append((center[0] + dx, center[1] + dy))
    return out


def main():
    cache = None
    if '--cache' in sys.argv:
        cache = pathlib.Path(sys.argv[sys.argv.index('--cache') + 1])
        cache.mkdir(parents=True, exist_ok=True)
    locations = load_locations()
    pins = {}
    tally = {'osm-draft': 0, 'estimated': 0, 'placeholder': 0}

    for mall_id, screens in SCREENS.items():
        location = locations.get(mall_id)
        if not location:
            print(f'  ! {mall_id}: no map location — skipped')
            continue
        elements = overpass(mall_id, location['osm'], cache) if any(rule for _, rule in screens) else []
        unresolved = []

        for spec_id, rule in screens:
            found = None
            if rule and rule[0] in ('store', 'place'):
                matches = [find_named(elements, pattern) for pattern in rule[1:]]
                if all(matches):
                    points = [point_of(m) for m in matches]
                    found = (
                        (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)),
                        'osm-draft',
                        ' and '.join(label_of(m) for m in matches)
                        + (' — midway between them' if len(matches) > 1 else ''),
                    )
            elif rule and rule[0] == 'food':
                result = food_court(elements)
                if result:
                    found = (result[0], 'estimated', result[1])

            if found:
                (lng, lat), source, note = found
                pins[spec_id] = {'lng': round(lng, 6), 'lat': round(lat, 6), 'source': source, 'note': note}
                tally[source] += 1
            else:
                unresolved.append(spec_id)

        for spec_id, (lng, lat) in zip(unresolved, placeholder_positions(location['center'], location['bounds'], len(unresolved))):
            pins[spec_id] = {
                'lng': round(lng, 6),
                'lat': round(lat, 6),
                'source': 'placeholder',
                'note': 'no location data — parked in the middle of the mall',
            }
            tally['placeholder'] += 1

        found_here = [s for s, _ in screens if pins[s]['source'] != 'placeholder']
        print(f'  {mall_id:13} {len(found_here)}/{len(screens)} located')
        if not cache:
            time.sleep(3)

    OUT.write_text(
        '/**\n'
        ' * GENERATED by app/scripts/draft-screen-pins.py — do not edit by hand.\n'
        ' * Automatic first-guess positions; confirmed pins in screenPins.ts win.\n'
        ' * Data © OpenStreetMap contributors, ODbL 1.0.\n'
        ' */\n\n'
        "import type { ScreenPin } from './screenPins';\n\n"
        'export const DRAFT_PINS: Readonly<Record<string, ScreenPin>> = '
        + json.dumps(pins, indent=2, ensure_ascii=False)
        + ';\n'
    )
    print(f"Wrote {len(pins)} pins: {tally['osm-draft']} at stores, {tally['estimated']} estimated, "
          f"{tally['placeholder']} placeholders -> {OUT}")


if __name__ == '__main__':
    main()
