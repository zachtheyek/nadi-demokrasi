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
from pathlib import Path
import numpy as np
import pandas as pd

FOUND = Path("../meco-data/out")
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

    rows.append({
        "election": elec, "year": year, "n_seats": int(n_seats),
        "n_blocs": int((by_bloc.votes > 0).sum()),
        "enp_votes": round(float(enp_v), 2), "enp_seats": round(float(enp_s), 2),
        "gallagher": round(float(gallagher), 2),
        "malapportionment": (round(malapp, 2) if malapp is not None else None),
        "volatility": (round(float(volatility), 2) if volatility is not None else None),
        "turnout": (round(turnout, 1) if not np.isnan(turnout) else None),
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

pd.set_option("display.width", 200)
print(df[["year", "winner", "winner_vote_pc", "winner_seat_pc", "winner_seat_bonus",
          "gallagher", "malapportionment", "enp_votes", "enp_seats", "volatility", "turnout"]].to_string(index=False))
