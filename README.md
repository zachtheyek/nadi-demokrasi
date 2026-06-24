# 📈 Nadi Demokrasi — the Pulse of Democracy

**Malaysia's democracy, in numbers.** A reproducible, citable dashboard that
measures seven decades of general elections (1955–2022) with the standard tools
of political science.

🔗 **Live:** https://zachtheyek.github.io/nadi-demokrasi/

![Nadi Demokrasi](https://zachtheyek.github.io/nadi-demokrasi/og-default.png)

## The six indicators

| Indicator | Formula | What it shows |
|-----------|---------|---------------|
| **Disproportionality** | Gallagher LSq = √(½ Σ(vᵢ−sᵢ)²) | How faithfully votes become seats (peaked 24.0 in 2004) |
| **Winner's seat bonus** | seat% − vote% | FPTP's reward to the largest bloc (+27pp → −1pp) |
| **Effective N of parties** | N = 1/Σpᵢ² (Laakso–Taagepera) | Fragmentation (1.5 → 3.6) |
| **Electoral volatility** | V = ½ Σ\|vᵢ,t − vᵢ,t₋₁\| (Pedersen) | The realignment earthquakes (1969, 1999, 2008, 2022) |
| **Turnout** | ballots / electors | Participation (69–84%) |
| **Winner's vote share** | — | The end of the majority party (82% → 38%) |

## The story the numbers tell

For half a century, first-past-the-post turned modest vote leads into commanding
majorities — disproportionality above 20, seat bonuses of +25pp, a one-and-a-half
party system. After 2008 it unravelled: by 2022 no bloc held a majority of votes
*or* an outsized share of seats, fragmentation hit a record, and the system became,
almost by accident, more proportional.

## Reproduce

```bash
npm install
npm run data    # compute_indicators.py → public/data/indicators.{json,csv}
npm run dev
npm run build
```

`scripts/compute_indicators.py` is ~120 lines and fully documents every formula
and unit choice. Data downloads (CSV + JSON) are linked from the page footer.

## Credit

All underlying data is the **Malaysian Election Corpus (MECo)** by
**[Thevesh Thevananthan](https://electiondata.my)** (CC0), peer-reviewed in
*Scientific Data* 13, 190 (2026). Not affiliated with the author.
Indicators follow Laakso–Taagepera (1979), Gallagher (1991), Pedersen (1979).

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
