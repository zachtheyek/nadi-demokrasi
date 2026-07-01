"""
Precompute district-shape compactness (Polsby–Popper) per delimitation.
=======================================================================
Boundaries change only ~once a decade (a gazetted redelineation), and the
parliamentary boundary GeoJSONs are NOT part of the meco-data parquet foundation
that the site's CI builds from. So this is a MANUAL, occasional step: run it when a
new redelineation lands, and commit the tiny result (`data/compactness.json`).
`compute_indicators.py` then reads that committed file and maps each election to the
delimitation in force — no GeoJSONs needed at build/CI time (mirrors how the seat
lineage is fetched once and committed).

Polsby–Popper compactness of a district = 4π·Area / Perimeter²  (1 = a perfect
circle; lower = more irregular/elongated). Area and perimeter are computed in a
local equirectangular projection (metres), which is accurate for Peninsular/East
Malaysia near the equator. MultiPolygon seats (islands) legitimately score lower.

Source GeoJSONs: the MECo maps corpus (delimitations), mirrored on the open data
lake `https://lake.electiondata.my/maps/delimitations/<region>_<year>_parlimen.geojson`.
By default we read a local cache; override with MAPS_DIR.
"""
from __future__ import annotations
import json, math, glob, os
from pathlib import Path

# a local cache of `<region>_<year>_parlimen.geojson` files (peninsular|sabah|sarawak).
MAPS_DIR = Path(os.environ.get("MAPS_DIR", "../../complete/undi-wrapped/.maps-cache"))
OUT = Path("data/compactness.json")


def _ring_area_perim(ring, kx, ky):
    pts = [(x * kx, y * ky) for x, y in ring]
    area = perim = 0.0
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]; x2, y2 = pts[i + 1]
        area += x1 * y2 - x2 * y1
        perim += math.hypot(x2 - x1, y2 - y1)
    return abs(area) / 2.0, perim


def _polygon_ap(rings, kx, ky):
    area, perim = _ring_area_perim(rings[0], kx, ky)   # outer ring
    for hole in rings[1:]:                              # subtract holes, add their edge length
        a, p = _ring_area_perim(hole, kx, ky)
        area -= a; perim += p
    return area, perim


def polsby_popper(geom):
    # local metres-per-degree scale at the feature's mean latitude
    lats = []
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        for ring in poly:
            lats += [pt[1] for pt in ring]
    if not lats:
        return None
    lat0 = sum(lats) / len(lats)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    area = perim = 0.0
    for poly in polys:
        a, p = _polygon_ap(poly, kx, ky)
        area += a; perim += p
    if perim <= 0:
        return None
    return min(4 * math.pi * area / (perim * perim), 1.0)   # cap tiny numeric overshoots at 1


def main():
    out = {"_meta": {"metric": "Polsby-Popper", "note": "mean over federal seats per delimitation"}}
    for path in sorted(glob.glob(str(MAPS_DIR / "*_parlimen.geojson"))):
        name = Path(path).stem              # e.g. "peninsular_2018_parlimen"
        region, year, _ = name.split("_")
        feats = json.load(open(path))["features"]
        pps = [pp for pp in (polsby_popper(f["geometry"]) for f in feats) if pp is not None]
        if not pps:
            continue
        out.setdefault(region, {})[year] = {"pp": round(sum(pps) / len(pps), 4), "n": len(pps)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2))
    regions = [k for k in out if not k.startswith("_")]
    print(f"wrote {OUT} — regions: {regions}")
    for r in regions:
        for y, rec in sorted(out[r].items()):
            print(f"  {r:11} {y}  PP={rec['pp']:.3f}  n={rec['n']}")


if __name__ == "__main__":
    main()
