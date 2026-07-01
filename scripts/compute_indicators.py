"""
Nadi Demokrasi — reproducible democracy indicators
===================================================
Computes, for every Malaysian FEDERAL general election (GE-00 1955 → GE-15 2022),
a small set of standard political-science indicators of the party system, with
fully-stated formulae and unit choices. The output is meant to be citable.

Unit of analysis: each election's *blocs* = coalition where a candidate ran in
one, otherwise the party itself (so non-aligned parties are their own bloc;
independents share the BEBAS bloc). Indicators:

  • Effective N of parties (Laakso–Taagepera): N = 1 / Σ pᵢ²
        - ENP_votes  uses vote shares pᵢ
        - ENP_seats  uses seat shares sᵢ
  • Gallagher disproportionality:  LSq = sqrt( ½ Σ (vᵢ − sᵢ)² )   (vᵢ, sᵢ in %)
  • Pedersen electoral volatility:  V = ½ Σ |vᵢ,t − vᵢ,t-1|  (matched blocs;
        coalition/party *renames* collapsed so relabelling isn't counted as churn)
  • Turnout, winner's vote% vs seat% (the "seat bonus"), number of blocs contesting.

Output: public/data/indicators.json, public/data/indicators.csv
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import numpy as np
import pandas as pd

# Path to the MECo foundation's `out/` dir. Defaults to the co-located sibling checkout used
# locally and in deploy.yml; override with MECO_OUT when the layout differs (e.g. drift-review CI).
FOUND = Path(os.environ.get("MECO_OUT", "../meco-data/out"))
OUT = Path("public/data")
OUT.mkdir(parents=True, exist_ok=True)

ballots = pd.read_parquet(FOUND / "ballots.parquet")
stats = pd.read_parquet(FOUND / "contests.parquet")
cs = pd.read_parquet(FOUND / "lookup_coalition_succession.parquet")
ps = pd.read_parquet(FOUND / "lookup_party_succession.parquet")
coal = pd.read_parquet(FOUND / "lookup_coalition.parquet").set_index("coalition_uid")["coalition"].to_dict()
party = pd.read_parquet(FOUND / "lookup_party.parquet").set_index("party_uid")["party"].to_dict()

# canonical id for cross-election matching (collapse pure renames only)
c_ren = dict(zip(cs[cs.type == "replace"].predecessor_uid, cs[cs.type == "replace"].successor_uid))
p_ren = dict(zip(ps[ps.type == "replace"].predecessor_uid, ps[ps.type == "replace"].successor_uid))
def canon(m, u):
    seen = set()
    while u in m and u not in seen:
        seen.add(u); u = m[u]
    return u

fed = ballots[ballots.seat.str.startswith("P.") & ballots.election.str.startswith("GE-")].copy()
fed["bloc_uid"] = np.where(fed.coalition_uid == "000-ALONE", "party:" + fed.party_uid, "coal:" + fed.coalition_uid)
fed["won"] = fed.result.isin(["won", "won_uncontested"])

def bloc_label(uid):
    if uid.startswith("coal:"):
        return coal.get(uid[5:], uid[5:])
    return party.get(uid[6:], uid[6:])  # strip "party:" and resolve to the party's short label

def bloc_canon(uid):
    if uid.startswith("coal:"):
        return "coal:" + canon(c_ren, uid[5:])
    return "party:" + canon(p_ren, uid[5:])

# --- Seat turnover: share of seats whose winning bloc changed vs the previous GE ----------
# Seat identity is NOT stable across delimitations, so we thread each current seat through
# history by boundary-based lineage (electiondata.my). For each current seat (slug) and each
# past GE, take the dominant ancestor contest's winning bloc (canonicalised so pure renames
# aren't counted as a flip), then compare consecutive elections over the seats present in both.
lineage = pd.read_parquet(FOUND / "seat_lineage.parquet")
fedc_all = stats[(stats.seat_type == "federal") & stats.election.str.startswith("GE-")].copy()
fedc_all["date"] = fedc_all["date"].astype(str)
lineage = lineage.assign(date=lineage["date"].astype(str))
cur = lineage.merge(fedc_all, on=["date", "state", "seat"], how="inner")
def _win_bloc(cu, pu):
    return ("coal:" + canon(c_ren, cu)) if (pd.notna(cu) and cu != "000-ALONE") else ("party:" + canon(p_ren, pu))
cur["wbloc"] = [_win_bloc(cu, pu) for cu, pu in zip(cur.win_coalition_uid, cur.win_party_uid)]
cur = cur.sort_values("votes_valid", ascending=False).drop_duplicates(["slug", "date"])  # dominant ancestor
by_date = {d: dict(zip(g.slug, g.wbloc)) for d, g in cur.groupby("date")}
elec_date = fedc_all.groupby("election").date.first().sort_values()
turnover_by_year, prev_d = {}, None
for elec, d in elec_date.items():
    if prev_d is not None and d in by_date and prev_d in by_date:
        now_m, prev_m = by_date[d], by_date[prev_d]
        common = set(now_m) & set(prev_m)
        if common:
            flips = sum(1 for s in common if now_m[s] != prev_m[s])
            turnover_by_year[int(d[:4])] = round(100.0 * flips / len(common), 1)
    prev_d = d

rows = []
prev_vote = None  # dict canon_uid -> vote share (fraction) of previous election
for elec, g in fed.groupby("election"):
    year = int(g.date.str[:4].iloc[0])
    total_votes = g.votes.sum()
    n_seats = g[["state", "seat"]].drop_duplicates().shape[0]
    by_bloc = g.groupby("bloc_uid").agg(votes=("votes", "sum"), seats=("won", "sum")).reset_index()
    by_bloc["v"] = by_bloc.votes / total_votes
    by_bloc["s"] = by_bloc.seats / n_seats
    v, s = by_bloc.v.values, by_bloc.s.values
    enp_v = 1.0 / np.sum(v ** 2)
    enp_s = 1.0 / np.sum(s ** 2)
    gallagher = np.sqrt(0.5 * np.sum((v * 100 - s * 100) ** 2))

    # Pedersen volatility vs previous election (matched on canonical bloc id)
    cur_vote = {}
    for _, r in by_bloc.iterrows():
        cu = bloc_canon(r.bloc_uid)
        cur_vote[cu] = cur_vote.get(cu, 0.0) + r.v
    volatility = None
    if prev_vote is not None:
        keys = set(cur_vote) | set(prev_vote)
        volatility = 0.5 * sum(abs(cur_vote.get(k, 0) - prev_vote.get(k, 0)) for k in keys) * 100
    prev_vote = cur_vote

    # winner = bloc with most seats
    win = by_bloc.loc[by_bloc.seats.idxmax()]
    # turnout (mean across contests) + malapportionment from the same federal contest table
    st = stats[(stats.election == elec) & (stats.seat_type == "federal")]
    turnout = float(st.voter_turnout.mean())

    # Malapportionment (Samuels–Snyder): MAL = ½ Σ |sᵢ − eᵢ| where every seat has an equal
    # share of seats sᵢ = 1/n but an unequal share of the electorate eᵢ = electorsᵢ / Σelectors.
    # It is the fraction of seats that would have to be reallocated to equalise voters per seat.
    electors = st.voters_total.dropna().values
    malapp = None
    if len(electors) > 1 and electors.sum() > 0:
        e_share = electors / electors.sum()
        malapp = float(0.5 * np.sum(np.abs(e_share - 1.0 / len(electors))) * 100)

    # top blocs by seats (drift-proof names for the narrative, e.g. the "three biggest blocs")
    tb = by_bloc[by_bloc.seats > 0].sort_values("seats", ascending=False)
    top_blocs = [{"label": bloc_label(r.bloc_uid), "seats": int(r.seats),
                  "seat_pc": round(float(r.s) * 100, 1)} for _, r in tb.head(5).iterrows()]

    # Descriptive representation: share of elected MPs who are women.
    women_pc = 100.0 * float((g[g.won].sex == "F").sum()) / n_seats
    # Ethnic makeup of the elected house (descriptive representation, purely a count).
    eth = g[g.won].ethnicity.value_counts()
    ethn = lambda *keys: 100.0 * float(sum(eth.get(k, 0) for k in keys)) / n_seats
    malay_pc, chinese_pc, indian_pc = ethn("Malay"), ethn("Chinese"), ethn("Indian")
    em_bumi_pc = ethn("Bumi Sabah", "Bumi Sarawak")   # East-Malaysian Bumiputera (from 1963/69)
    # Multi-cornered contests: mean candidates per seat, and share of 3+-cornered fights.
    cand_per_seat = float(st.n_candidates.mean())
    three_plus_pc = 100.0 * float((st.n_candidates >= 3).mean())
    # Competitiveness: share of federal seats won by a margin under 5 percentage points
    # (uncontested seats have no margin → counted as safe, which they are).
    marginal_pc = 100.0 * float((st.majority_perc < 5).sum()) / n_seats

    rows.append({
        "election": elec, "year": year, "n_seats": int(n_seats),
        "n_blocs": int((by_bloc.votes > 0).sum()),
        "enp_votes": round(float(enp_v), 2), "enp_seats": round(float(enp_s), 2),
        "gallagher": round(float(gallagher), 2),
        "malapportionment": (round(malapp, 2) if malapp is not None else None),
        "volatility": (round(float(volatility), 2) if volatility is not None else None),
        "turnover": turnover_by_year.get(year),
        "turnout": (round(turnout, 1) if not np.isnan(turnout) else None),
        "women_pc": round(women_pc, 1),
        "malay_pc": round(malay_pc, 1), "chinese_pc": round(chinese_pc, 1),
        "indian_pc": round(indian_pc, 1), "em_bumi_pc": round(em_bumi_pc, 1),
        "cand_per_seat": round(cand_per_seat, 2),
        "three_plus_pc": round(three_plus_pc, 1),
        "marginal_pc": round(marginal_pc, 1),
        "winner": bloc_label(win.bloc_uid),
        "winner_vote_pc": round(float(win.v) * 100, 1),
        "winner_seat_pc": round(float(win.s) * 100, 1),
        "winner_seat_bonus": round(float(win.s - win.v) * 100, 1),
        "top_blocs": top_blocs,
    })

df = pd.DataFrame(rows).sort_values("year")
# top_blocs is a nested list — keep it in the JSON only, not the flat CSV
df.drop(columns=["top_blocs"]).to_csv(OUT / "indicators.csv", index=False)
# dump from the rows list (proper None), not the DataFrame (which turns None into NaN
# and json.dumps would emit an invalid bare `NaN` token).
rows_sorted = sorted(rows, key=lambda r: r["year"])
(OUT / "indicators.json").write_text(json.dumps({"rows": rows_sorted}, separators=(",", ":"), allow_nan=False))

# Bundle the data + this script + a how-to into a single downloadable zip, so a reader can
# reproduce every figure on the page. Regenerated on each run.
import zipfile
from datetime import date, timezone, datetime
readme = f"""Nadi Demokrasi — reproducible democracy indicators for Malaysia
================================================================
Generated: {datetime.now(timezone.utc).date().isoformat()}

Contents
  indicators.csv          one row per federal general election (1955- ), flat table
  indicators.json         the same rows, plus each election's top blocs by seats
  compute_indicators.py   the exact script that produced them

Every figure on https://zachtheyek.github.io/nadi-demokrasi/ is computed from these
files — nothing on the page is hand-entered.

Reproduce
  1. Clone the data foundation next to this folder:
       git clone https://github.com/zachtheyek/meco-data
  2. pip install pandas pyarrow numpy
  3. python compute_indicators.py         # writes public/data/indicators.{{csv,json}}
     (or point it elsewhere with MECO_OUT=/path/to/meco-data/out)

Source & credit
  All underlying data is the Malaysian Election Corpus (MECo) by Thevesh Thevananthan,
  https://electiondata.my — CC0, peer-reviewed in Scientific Data 13, 190 (2026).
  Indicators follow Laakso-Taagepera (1979), Gallagher (1991), Pedersen (1979) and
  Samuels-Snyder (2001). Dashboard code: MIT. This bundle: same terms as the sources.
"""
with zipfile.ZipFile(OUT / "nadi-demokrasi-data.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write(OUT / "indicators.csv", "indicators.csv")
    z.write(OUT / "indicators.json", "indicators.json")
    z.write(Path(__file__), "compute_indicators.py")
    z.writestr("README.txt", readme)

pd.set_option("display.width", 220)
print(df[["year", "winner", "winner_vote_pc", "winner_seat_pc", "winner_seat_bonus", "gallagher",
          "malapportionment", "enp_seats", "volatility", "turnout", "women_pc", "cand_per_seat", "marginal_pc"]].to_string(index=False))
