# 📈 Nadi Demokrasi — the Pulse of Democracy

**Malaysia's democracy, in numbers.** A reproducible, citable dashboard that
measures seven decades of general elections (1955–2022) with the standard tools
of political science.

🔗 **Live:** https://zachtheyek.github.io/nadi-demokrasi/

![Nadi Demokrasi](https://zachtheyek.github.io/nadi-demokrasi/og-default.png)

## The seven indicators

| Indicator | Formula | What it shows |
|-----------|---------|---------------|
| **Disproportionality** | Gallagher LSq = √(½ Σ(vᵢ−sᵢ)²) | How faithfully votes become seats (peaked 24.0 in 2004) |
| **Malapportionment** | MAL = ½ Σ\|1/n − eᵢ/E\| (Samuels–Snyder) | Unequal voters per seat — the *structural* distortion (8% → 18%, a record) |
| **Winner's seat bonus** | seat% − vote% | FPTP's reward to the largest bloc (+27pp → −1pp) |
| **Winner's vote share** | — | The end of the majority party (82% → 38%) |
| **Effective N of parties** | N = 1/Σpᵢ² (Laakso–Taagepera) | Fragmentation (1.5 → 3.6) |
| **Electoral volatility** | V = ½ Σ\|vᵢ,t − vᵢ,t₋₁\| (Pedersen) | The largest vote-share realignments (1959, 1990, 1999) |
| **Turnout** | ballots / electors | Participation (69–84%) |

Disproportionality (the total vote-to-seat gap) is decomposed into its two sources:
**malapportionment** (unequal districts) and the **winner's bonus** (the mechanical FPTP
reward). The sections are ordered to read that way.

Every number on the page (headline figures, chart points, the prose, the annotations,
the citation) is **recomputed from the source data** at build time — nothing is
hard-coded — so the dashboard updates itself as new elections are added. Each section
carries its formula in a collapsible "How it's measured" panel (real LaTeX, numbered
equations, with the variables explained in plain English).

## The story the numbers tell

For half a century, first-past-the-post turned modest vote leads into commanding
majorities — disproportionality above 20, seat bonuses of +25pp, a one-and-a-half
party system. After 2008 it unravelled: by 2022 no bloc held a majority of votes
*or* an outsized share of seats, fragmentation hit a record, and the system became,
almost by accident, more proportional.

## Limitations (read these)

These indicators describe the national party system honestly, but they do not measure
everything. The most important caveats — also shipped on the page, under **Method &
limitations**:

- **Malapportionment is now measured, but with its own limits.** The Samuels–Snyder
  index captures unequal *registered* electors per seat; it does not adjust for the gap
  between registered and voting-age population, and it does not say *which* bloc the
  unequal map favours. A partisan-bias / efficiency-gap measure (the gerrymandering
  question proper) is the natural next addition — the seat-level vote data is in the corpus.
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
  uncontested seats; turnout uses *registered* electors, so pre-2018 figures overstate
  participation among all eligible adults (before automatic registration).
- **Federal general elections only.** State elections, by-elections, and the timing
  differences for Sabah (joined 1963) and Sarawak (first federal vote 1969) are out of
  scope.
- **Party-system, not seats or people.** No seat-level competitiveness/marginality measure,
  and no descriptive representation (the corpus does carry candidate sex, ethnicity, and
  seat margins) — natural further dimensions, listed on the page too.

## Reproduce

```bash
npm install
npm run data    # compute_indicators.py reads ../meco-data/out -> public/data/indicators.{json,csv}
npm run dev
npm run build   # vite build + OG card
```

`npm run data` needs `pandas`, `pyarrow` and `numpy` and a local checkout of the
[`meco-data`](https://github.com/zachtheyek/meco-data) foundation as a sibling directory
(`../meco-data`). `scripts/compute_indicators.py` is ~120 lines and fully documents every
formula and unit choice. Data downloads (CSV + JSON) are linked from the page.

## Data & self-update

`public/data/` is **generated, not committed** (it is git-ignored). The site rebuilds
itself from the shared MECo foundation with no human in the loop:

- **`meco-data`** auto-refreshes from the upstream corpus **weekly** (Sun 20:07 UTC). If
  the upstream results change, it rebuilds `out/*.parquet` and commits.
- **This repo's `deploy.yml`** runs **weekly** (Sun 20:47 UTC), just after. It only
  rebuilds if the MECo foundation actually moved since the last deploy (it compares
  `meco-data`'s commit against the `data-version.txt` stamped into the live site);
  otherwise it does nothing. Every push and manual run always rebuilds.

**So in steady state there is nothing to do.** New election → `meco-data` picks it up →
this site redeploys the same day, numbers, charts and prose all updated.

**When a human *is* needed** (rare — only when an Action emails you a failed run):

| Situation | One-liner |
|-----------|-----------|
| Force a data refresh now | `make refresh` *(run in the `meco-data` repo)* |
| Upstream schema broke the build | fix `meco-data`'s `pipeline.py`, or wait a week |
| Force this site to rebuild | re-run **Deploy to GitHub Pages** (`workflow_dispatch`) or push |

GitHub's built-in failed-run emails are the alerting; there is no separate "run this now"
step in normal operation.

## Cite

Use the **❝ Cite this work** button on the page (APA + BibTeX, copy to clipboard). Please
also credit the underlying data — the Malaysian Election Corpus by Thevesh Thevananthan.

## Credit

All underlying data is the **Malaysian Election Corpus (MECo)** by
**[Thevesh Thevananthan](https://x.com/Thevesh)** ([electiondata.my](https://electiondata.my), CC0),
peer-reviewed in *Scientific Data* 13, 190 (2026). Not affiliated with the author.
Indicators follow Laakso–Taagepera (1979), Gallagher (1991), Pedersen (1979).

## Sibling projects

Part of a family of open, non-partisan tools built on the Malaysian Election Corpus:

- [**Undi Wrapped**](https://zachtheyek.github.io/undi-wrapped/) — your seat's election story, Wrapped-style
- [**Lompat**](https://zachtheyek.github.io/lompat/) — every party-hop since 1955 + the "frog" leaderboards
- [**Salasilah**](https://zachtheyek.github.io/salasilah/) — the family tree of parties & coalitions
- [**Undi Lain**](https://zachtheyek.github.io/undi-lain/) — re-run past elections under other voting systems
- [**Undi Generasi**](https://zachtheyek.github.io/undi-generasi/) — how Malaysia votes across generations

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
