# 📈 Nadi Demokrasi — the Pulse of Democracy

**Malaysia's democracy, in numbers.** A reproducible, citable dashboard that
measures seven decades of general elections (1955–2022) with the standard tools
of political science.

🔗 **Live:** https://zachtheyek.github.io/nadi-demokrasi/

![Nadi Demokrasi](https://zachtheyek.github.io/nadi-demokrasi/og-default.png?v=4)

## The fourteen indicators

| Indicator                   | Formula                                  | What it shows                                                                                   |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Disproportionality**      | Gallagher LSq = √(½ Σ(vᵢ−sᵢ)²)           | How faithfully votes become seats (peaked 24.0 in 2004)                                         |
| **Winner's seat bonus**     | seat% − vote%                            | FPTP's reward to the largest bloc (+27pp → −1pp)                                                |
| **Malapportionment**        | MAL = ½ Σ\|1/n − eᵢ/E\| (Samuels–Snyder) | Unequal voters per seat — the _structural_ distortion (8% → 18%, a record)                      |
| **Map bias**                | 100·(ē − ēᵥᵥ) / ē                        | _Who_ the unequal map favours — the winner's seats vs the average (+22% in 2013 → −32% in 2022) |
| **District shapes**         | Polsby–Popper = 4πA / P²                 | Boundary compactness / gerrymandering signal (0.38 → 0.30, least compact on record)             |
| **Winner's vote share**     | —                                        | The end of the majority party (82% → 38%)                                                       |
| **Effective N of parties**  | N = 1/Σpᵢ² (Laakso–Taagepera)            | Fragmentation (1.5 → 3.6)                                                                       |
| **Multi-cornered contests** | mean candidates / seat                   | Straight fights → crowded ballots (2.0 → 4.3; 96% now 3+-cornered)                              |
| **Electoral volatility**    | V = ½ Σ\|vᵢ,t − vᵢ,t₋₁\| (Pedersen)      | The largest vote-share realignments (1959, 1990, 1999)                                          |
| **Seat turnover**           | share of seats that flip (via lineage)   | Seats changing hands — 53% in 2022, 39% in 2008                                                 |
| **Marginal seats**          | share won by < 5 pp                      | Competitiveness — how close the contests are (2% → 16–18%)                                      |
| **Turnout**                 | ballots / electors                       | Participation (69–84%)                                                                          |
| **Women in Parliament**     | share of women MPs                       | Descriptive representation (1.9% → 13.1%, below the ~30% benchmark)                             |
| **Ethnic makeup**           | share of MPs by ethnicity                | Who sits — ethnic-Chinese MPs 29% → 20% (descriptive)                                           |

Disproportionality (the total vote-to-seat gap) is decomposed into its two sources:
**malapportionment** (unequal districts) and the **winner's bonus** (the mechanical FPTP
reward). The essay then probes how the boundaries themselves are drawn — **who** the unequal
map favours (_map bias_) and how irregular the district shapes are (_compactness_, a
gerrymandering signal) — before reading on in narrative order: the winner's grip and the party
system, the crowding and closeness of contests, then participation and representation.

Every number on the page (headline figures, chart points, the prose, the annotations,
the citation) is **recomputed from the source data** at build time — nothing is
hard-coded — so the dashboard updates itself as new elections are added. Each section
carries its formula in a collapsible "How it's measured" panel (real LaTeX, numbered
equations, with the variables explained in plain English).

## The story the numbers tell

For half a century, first-past-the-post turned modest vote leads into commanding
majorities — disproportionality above 20, seat bonuses of +25pp, a one-and-a-half
party system. After 2008 it unravelled: by 2022 no bloc held a majority of votes
_or_ an outsized share of seats, fragmentation hit a record, and the system became,
almost by accident, more proportional.

## Limitations (read these)

These indicators describe the national party system honestly, but they do not measure
everything. The most important caveats — also shipped on the page, under **Method &
limitations**:

- **The gerrymandering question is partly, not fully, answered.** Unequal district _sizes_
  are covered by **malapportionment** and **map bias** (whose seats are smaller — who the map
  favours), and irregular district _shapes_ by **compactness** (Polsby–Popper). What stays out
  are the textbook partisan-symmetry measures — the _efficiency gap_ and _partisan bias_ — which
  are defined for two-party competition; Malaysia's multi-bloc, multi-cornered contests give no
  clean two-side wasted-vote split or 50/50 counterfactual, so they aren't sound as a single
  number here. Malapportionment itself uses _registered_ electors, so it doesn't adjust for the
  gap between the registered and the voting-age population; and low compactness can be innocent
  (coastlines, rivers, East-Malaysian geography) — a signal, not proof of intent.
- **Gallagher still reports the total.** The disproportionality score bundles both the
  winner's bonus and malapportionment; the two are shown separately, but the corpus does
  not let us cleanly attribute every Gallagher point to one source or the other.
- **Vote volatility ≠ seat upheaval.** Pedersen volatility tracks vote-share movement
  between blocs. A result like 2008 can transform parliament while moving relatively
  few votes, so the chart understates seat-level "earthquakes". Read it alongside the
  seat bonus.
- **The bloc is the unit, and that is a choice.** Effective-parties and Gallagher use
  coalitions (how governments form), not individual parties; a party-level reading
  gives higher fragmentation and different disproportionality.
- **East-Malaysia coalition fluidity.** Sabah/Sarawak parties have shifted between
  federal coalitions repeatedly; the rename-collapsing rule handles clean successions
  but not every partial realignment.
- **Uncontested seats and the turnout denominator.** Early elections had many
  uncontested seats; turnout uses _registered_ electors, so pre-2021 figures overstate
  participation among all eligible adults (before automatic registration).
- **Federal general elections only.** State elections, by-elections, and the timing
  differences for Sabah (joined 1963) and Sarawak (first federal vote 1969) are out of
  scope.
- **Marginal seats measure closeness, not two-way competitiveness.** A sub-5-point margin can be a
  genuine cliffhanger _or_ a multi-cornered split; the marginal-seat share does not distinguish them.
- **Representation is descriptive, not substantive.** Women's and ethnic makeup count _who sits_, not
  how they vote or whom they serve; ethnic makeup also reflects the electorate's own composition and
  electoral geography, not a verdict on any community.
- **Seat turnover is threaded, not exact.** Seats are matched across delimitations to their dominant
  boundary ancestor, so the flip count is approximate in redelineation years.
- **Turnout by age** needs the individual voter rolls (not this corpus) — see
  [Undi Generasi](https://zachtheyek.github.io/undi-generasi/).

## Reproduce

```bash
npm install
npm run data    # compute_indicators.py reads ../meco-data/out -> public/data/indicators.{json,csv}
npm run dev
npm run build   # vite build + OG card
```

`npm run data` needs `pandas`, `pyarrow` and `numpy` and a local checkout of the
[`meco-data`](https://github.com/zachtheyek/meco-data) foundation as a sibling directory
(`../meco-data`). `scripts/compute_indicators.py` fully documents every formula and unit choice;
it does **not** draw the charts — it only turns MECo into the small `indicators` table the
dashboard renders from. District-shape compactness is precomputed once per delimitation into the
committed `data/compactness.json` (by `scripts/compute_compactness.py`, which needs the boundary
GeoJSONs — boundaries change only ~once a decade). Data downloads (CSV + JSON + both scripts) are
linked from the page.

## Data & refresh (human-gated)

`public/data/` is **generated, not committed** (git-ignored) — the deploy recomputes it from the
MECo foundation. Unlike the sibling projects, **Nadi Demokrasi does not auto-publish new data**:
each refresh needs editorial curation (the prose, the analysis, the chart annotations), so a new
election is always reviewed by a human before it goes live.

- **`meco-data`** auto-refreshes from the upstream corpus **weekly**; if the results change it
  rebuilds `out/*.parquet` and commits.
- **`deploy.yml`** (on push + manual dispatch) builds the site **pinned to the MECo commit in
  `DATA_VERSION`** — the version the prose was last reconciled against, _not_ meco-data's HEAD. So an
  ordinary code push can never publish unreconciled data.
- **`drift-review.yml`** runs **weekly**: if meco-data has moved past `DATA_VERSION`, it regenerates
  the figures, runs Claude to reconcile the hand-written copy against the new numbers, bumps
  `DATA_VERSION`, and opens **one pull request**. **Merging that PR is what publishes the new data** —
  so you always review a new election first. In steady state (no new data) it is a no-op.

**When a human is needed:**

| Situation                               | What to do                                                      |
| --------------------------------------- | --------------------------------------------------------------- |
| A new election / upstream correction    | Review & merge the drift-review PR — that _is_ the refresh      |
| Force the data-change check now         | re-run **Claude Drift Review** (`workflow_dispatch`)            |
| Republish the current (reconciled) data | re-run **Deploy to GitHub Pages** (`workflow_dispatch`) or push |
| Upstream schema broke the build         | fix `meco-data`'s `pipeline.py`                                 |

GitHub's failed-run emails are the alerting.

## Cite

Use the **❝ Cite** button on the page (APA + BibTeX, copy to clipboard). Please
also credit the underlying data — the Malaysian Election Corpus by Thevesh Thevananthan.

## Credit

All underlying data is the **Malaysian Election Corpus (MECo)** by
**[Thevesh Thevananthan](https://x.com/Thevesh)** ([electiondata.my](https://electiondata.my), CC0),
peer-reviewed in _Scientific Data_ 13, 190 (2026). Not affiliated with the author.
Indicators follow Laakso–Taagepera (1979), Gallagher (1991), Pedersen (1979),
Samuels–Snyder (2001) and Polsby–Popper (1991).

## Sibling projects

Part of a family of open, non-partisan tools built on the Malaysian Election Corpus:

- [**Undi Wrapped**](https://zachtheyek.github.io/undi-wrapped/) — your seat's election story, Wrapped-style
- [**Lompat**](https://zachtheyek.github.io/lompat/) — every party-hop since 1955 + the "frog" leaderboards
- [**Salasilah**](https://zachtheyek.github.io/salasilah/) — the family tree of parties & coalitions
- [**Undi Lain**](https://zachtheyek.github.io/undi-lain/) — re-run past elections under other voting systems
- [**Undi Generasi**](https://zachtheyek.github.io/undi-generasi/) — how Malaysia votes across generations

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
