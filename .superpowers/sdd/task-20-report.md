# Task 20 — review gate

## Round 1 fix wave: F1-F8 + headed FPS evidence

Branch `next/showcase`, worktree `medgalaxy-next`, one commit
(`fix(gate): round-1 review findings F1-F8 + headed FPS evidence`).
Verification: `npx vite build` green, `npx vitest run` green (124 tests, 12
files; 5 new). Harness shots re-shot with the `fix2-` prefix, every PNG read
back and judged, drive methods recorded per finding below.

### F1 — dead Time Machine invitation (MAJOR)

Three parts, all landed.

**(a) `src/components/ui/HintChips.jsx`.** The "Try the Time Machine" chip now
calls `startTimeMachine(true)` (the narrated tour, the same thing the film's
auto-tour offers) and then dismisses itself. The other two chips teach a
gesture nobody can perform for the viewer, so dismissal remains all they do.

*Evidence, `fix2-hint-chip-starts-tour.png`:* real `page.mouse.click` on the
chip's own rect, 250 ms after `finishOverture()` — well inside the auto-tour's
1.5 s arming delay, so the timer cannot be what fired. `tmPhase` goes
`idle -> tour`, `tmTourSeen` latches true, `tmCaption` is the tour's opening
line ("35 years of attention, year by year."), and the shot shows the rail,
the 1990 numeral and the header button in its active state.

**(b) `src/components/TimeMachine.jsx`, consumed vs preempted.** The old effect
set `tourRanRef = true` at *arming* time, so if the 1.5 s timer came due while
a node was selected (or a mode, the spotlight, a story, roulette, a live
supernova), the guard clauses returned and the narrated tour was marked spent
without a single frame of it playing — and since the film only ever armed
once, it could never play again in that session. The rule is now two pure,
exported functions, `tourPreempted(state)` and
`tourGate(state, consumed) -> 'consumed' | 'preempted' | 'run'`; only `'run'`
consumes the slot, and a new subscription re-arms on the edge where the field
stops being busy (same 1.5 s pause, so the invitation never lands on top of
the gesture that freed the frame).

*Unit test* (`tests/timeMachineTour.test.js`, new `describe` block, 5 tests):
every takeover reads `'preempted'`, a settled supernova does not, the
preempt-then-free sequence leaves the slot unspent and then runs, and once
spent it is `'consumed'` forever.

*Live evidence* (headless run, states polled): with a node selected across the
hand-over, `tmPhase` stayed `idle` and `tmTourSeen` stayed false through the
timer; `deselect()` then produced `tmPhase: 'tour'` 1.5 s later. On a free
field the auto-tour still fires exactly once and does not re-fire after the
viewer closes it.

**(c) `src/components/ui/Header.jsx`.** New store flag `tmTourSeen`, latched by
`startTimeMachine(auto)` for any narrated start (film, chip or button). The
header's toggle passes `!tmTourSeen`, so the first press in a session where no
tour has run delivers the decade story and every later press is the plain
scrubber. Mobile's menu item uses the same handler.

*Live evidence:* with the auto-tour preempted, first header press -> `'tour'`;
close, second press -> `'scrub'`.

### F2 — release caption vs story chips collision (MAJOR)

Sequenced, not nudged. `releaseCues` in `src/components/OvertureSequence.jsx`
now reveals the bottom band (hint chips + story chips) at `endAt - 0.4`,
*after* the "Explore the gap." caption's own null cue at `endAt - 0.7` and
after `OvertureCaption`'s 200 ms exit fade. `StoryChips` gates on `hintsShown`
alongside `uiRevealed` (`finishOverture` sets `hintsShown`, so a film that ends
early still lands the chips).

*Evidence, `fix2-release-no-collision.png` (1440x900) and
`fix2-release-mobile.png` (375x812, isMobile+hasTouch):* the band rects were
sampled at seven held frames across the release beat. Desktop: caption visible
at t=12.6/13.5/14.5/15.5 with chips opacity 0 at every one; chips first visible
at t=16.1 with no caption in the DOM. Mobile: identical pattern, and it is the
one that needed it — the mobile caption sheet occupies 667-722 px against the
chip grid's 686-780 px, so the two would overlap if they ever coexisted, and
they never do. Both screenshots show the chips band alone, no caption.

### F3 — StoryChips desktop wrap

`width: 'max-content'` on the container (mobile keeps its 92vw from the Task 17
sweep), with the same Task-17 comment convention as `HintChips.jsx`. Same
Chromium shrink-to-fit trap: at 1440px, half the containing block is 720px
against the ~1054px the seven chips need, so every label wrapped to two lines.

*Evidence:* in `fix2-release-no-collision.png` each chip is a single line
("Most Researched", "Rich vs Poor", "See the Mismatch"); measured button height
36px (was 2 rows) and the row spans 193 -> 1247px.

### F4 — beat-2 ignition ambiguity

**(a) Sepsis micro-label.** `src/components/ui/OvertureMicroLabels.jsx` was
beat-1 only; it now carries a per-entry beat, and beat 2 gets one label,
desktop only, in the same data-line style, keyed to the hero caption itself
(the only caption carrying a `heroLine`, so it works on the compressed/skip
path too). Opacity moved from the container to each label, since the two groups
are no longer on at the same time, and a fading-out label no longer occupies a
collision slot. Copy: `Sepsis · 248,989 papers` — the papers side of the ratio,
because the caption is already saying 11 million deaths.

**(b) The competing flare.** The brief's stated mechanism does not hold, and I
checked rather than assumed: at the hero-caption frame `fx.glowSuppress` is
already exactly 1, `GlowSprites` opacity is `glowOpacity * (1 - glowSuppress)`
= 0 and its group is `visible: false`, so no glow sprite is on screen. By
projection, the competing teal-white flare at (876,151) in rg1-07 is **COPD's
own ignite core** (ignite weight 0.895 against sepsis's 1.0), not a sprite:
pinning `fx.ignite` to 0 removes both flares entirely (COPD box peak
255 -> 140, mean 84 -> 4.3).

So the damp went where the flare actually is, still inside OvertureSequence's
ignite path: a new `fx.igniteContrast` channel (sceneRefs -> DiseaseNodes
uniform -> both fragment shaders, `ig = pow(vIgnite, igniteContrast) *
igniteAmount`). The hero's weight is exactly 1.0, so `pow` leaves sepsis
untouched and pulls only the field behind it. The channel ramps 1 -> 3.0 over
suppression -> hero caption, so the separation is complete on the frame that
names the hero, and it is film-only (`ignite` is 0 outside the film;
`finishOverture` and the mount effect both reset it to 1).

*Measured A/B* (same session, `igniteContrast` pinned to 1 to reproduce the
pre-fix frame; 120px boxes; t=8.2, the hero-caption frame):

| | sepsis mean | COPD mean | COPD/sepsis | COPD bright px |
|---|---:|---:|---:|---:|
| before (k=1) | 125.9 | 110.2 | 0.88 | 3,388 |
| after (k=3.0) | 125.0 | 64.8 | 0.52 | 1,193 |

At the ignite landing (t=9.6) COPD drops from a blown-out white core
(peak 255, 532 bright px) to a modest red sphere (322 bright px) while sepsis
is unmoved (68.9 -> 68.5 mean). A mid-field sample moves 44.3 -> 41.9, i.e. the
smolder the beat is about survives; the ignite *weights* are untouched data.

*Evidence, `fix2-beat2-sepsis-label.png`:* one named white-hot hero with the
label beside it, the competitor a small point.

### F5 — Time Machine label discipline

`src/components/NodeLabels.jsx`, update loop split into two passes over
mount-allocated scratch arrays (the cap is a comparison across the field, so
nothing can be drawn until every screen radius for the frame is known).

- **Header exclusion zone:** labels never draw above y=90 once `uiRevealed` is
  true (header row 44px + filter bar 78px + margin; 8px before the reveal).
  A label whose node sits below the line rides down to it; one whose node is
  inside the band stands down.
- **Cap:** while `tmPhase !== 'idle'`, the biggest 40 by screen radius survive;
  hover, selection and the finale focus are exempt.
- **Dim:** when `tmFocusIdx >= 0`, non-focus labels take `opacity * 0.25` and
  the focus takes 1 (also exempt from the tiny-radius cull, since the closing
  shot is about reading exactly that small node's name).

*Evidence, `fix2-tm-labels.png`* (tour pause 1): 40 of 153 labels visible,
minimum label top 269px. *`fix2-finale-isolation.png`* (finale, flatline):
41 visible (40 + the exempt focus), minimum top exactly 90px (the clamp), 40
dimmed and exactly one at full strength — "Rheumatic Heart Disease", inside its
reticle. That is the rg1-25/30 dilution resolved.

### F6 — natural-end scrub handover

`TimeMachine.jsx`: the natural-end branch parks a `handoverAt` stamp
(`clock + 2.5`); the scrub branch sets the same `caps.handover` chip the
interrupt path uses once it comes due, and only if the finale is still the
frame (any input in the meantime has already run the window-level handover).
The isolation itself is deliberately *not* released here: the closing shot is
the point, and TimeRail's first scrub still clears it, exactly as before.

*Evidence, `fix2-natural-handover.png`:* seek to 5.85, `resume()`, then poll —
at the natural end `tmPhase: 'scrub'` with the flatline caption and focus 49
still held; 2.5 s later the caption is `["Scrub the decades."]` with
`handover: true` and focus still 49. Shot shows the chip with the reticle and
the dimmed field behind it.

### F7 — mobile hero framing

`OvertureSequence.jsx` gets `SEAT.morphPortrait` (beat 2's seat pulled back
1.35x), chosen at timeline-build time by frame shape (`innerHeight >
innerWidth`), not by input device — a portrait window is what cannot hold the
desktop framing, since the 60 degree field is vertical and 375x812 leaves
barely 30 degrees across. Both the normal and the compressed timelines use it,
so the harness's analytic seek and live playback agree.

*Evidence, `fix2-mobile-hero.png` + projection at t=9.6:* sepsis moves from
x=323 (r=14.7, halo clipped by the bezel) to **x=286, right edge 297, 78px of
margin**; the whole field's x-extent goes from -14..387 (clipped both sides) to
43..331 inside a 375px frame.

### F8 — duplicate exit controls

`TimeRail.jsx`'s floating "✕ Time Machine" mode chip is now mobile-only. On
desktop the header's own button is in frame and already reads "✕ Time Machine"
while the machine is up, so the chip was a second identical control 40px below
it. Mobile keeps it (the header collapses to Menu there, two taps deep).

*Evidence, `fix2-desktop-single-exit.png`:* exactly one button matching
/Time Machine/ in the DOM, the header's, at top:16. `fix2-mobile-exit-chip.png`
confirms mobile still has its chip at top:56.

### HARNESS — `--headed` + on-display FPS

`tools/verify.mjs` takes `--headed` (`headless: false`); everything else is
unchanged, so `--shot`/`--eval` also work on the real compositor. Two spot
checks were run and recorded in `docs/verify/perf-matrix.md` section 5
(`git add -f`, the directory is gitignored):

| Scenario | FPS | Gate |
|---|---:|---:|
| HIGH, at rest (post-film) | 120 | >=55 PASS |
| HIGH, beat 2 (the morph), 5 s from `seek(6.0)` | 120 | >=55 PASS |

This machine's display reports `2304 x 1296 @ 120.00Hz`, so 120 is the vsync
ceiling, not an artifact: both scenarios hold full refresh on the real
compositor. It confirms the headless matrix was not hiding a regression; it
does not replace those rows.

### Deviations from the brief

1. **F4b mechanism.** The brief said the competing flare was "the biggest glow
   sprite" and to suppress sprites harder via `fx.glowSuppress`. That channel
   is already saturated at 1 during beat-2 ignite and the sprites are already
   invisible, so the prescribed change would have been a literal no-op. The
   flare is COPD's own ignite core (verified by projection and by pinning
   `fx.ignite` to 0), so the damp is a new per-node contrast channel in the
   same ignite path. Numbers above.
2. **F6 scope.** "Exactly like the interrupt path" was read as *the caption*,
   not the focus release: the interrupt path clears `tmFocusIdx` because the
   viewer just took the instrument, whereas at the natural end nobody has
   touched anything and the held closing shot is the designed frame. The
   handover chip goes up over the isolation; the first scrub still releases it.
3. **F7 gate.** Portrait aspect rather than `isMob()` (the brief allowed
   either); a coarse-pointer tablet in landscape has the width the desktop seat
   assumes and keeps it.
4. **F2 gate flag.** Rather than adding a fourth reveal flag, `hintsShown` is
   now the bottom-band gate for both rows (documented at both call sites).

### Known-good, unchanged

The film's beat clock, holds and captions; the ignite/ember weights; the tour
board; every mobile width fix from Task 17. The `>500 kB` chunk warning is the
pre-existing one from Task 19.

---

## Data-integrity fix wave (round-2 depth findings)

Every figure below was re-verified against its primary document during this
pass; the quoted strings are the figures as printed there.

### P0 — four mortality attributions reconciled (data/diseases.json)

| Disease | Was | Now | Primary source, as printed |
|---|---|---|---|
| Malaria | 608,000 (2024) | **610,000** (2024) | WHO *World malaria report 2025*, executive summary p1: "an estimated 282 million cases and 610 000 deaths worldwide in 2024" |
| Tuberculosis | 1,250,000 (2024) | **1,230,000** (2024) | WHO *Global tuberculosis report 2025* factsheet: "Globally in 2024, TB caused an estimated 1.23 million deaths, including 150 000 people with HIV, compared with 1.25 million in 2023" (the old value was the 2023 figure) |
| COVID-19 | 250,000 (2023) | **294,000** (2023) | WHO COVID-19 dashboard global daily data: `New_deaths` summed over 2023 = 294,000. Verified twice, independently: the `Cumulative_deaths` column delta across 2023 gives the same 294,000. The round-2 reviewer's 318,570 does not reproduce against the current dashboard export. |
| Ebola | 32 (2025) | **49** (2025) | WHO DON, 1 Dec 2025 (DRC Kasai): "a total of 64 cases (53 confirmed, 11 probable), including 45 deaths (CFR 70.3%)". Uganda MoH / WHO, 26 Apr 2025 (Sudan virus): 12 confirmed + 2 probable cases "including four deaths". 45 + 4 = 49. Episodic note kept. |

### P1 — connections layer regenerated from live PubMed (736 pairs)

`scripts/regenerate_connections.py` (new) mirrors `refresh_pubmed.py` exactly:
same `pubmed_count`, same `data/search-overrides.json` terms, same
`MedGalaxy-Refresh/1.0` UA, same 0.35s rate limit, resumable via a progress
cache. For each existing pair it queries `(<termA>) AND (<termB>)` all-time,
matching the all-time semantics of the `papers` field the score divides by.

- 736/736 fetched, 0 failures, ~7 min.
- **0 pairs dropped**: the invariant's zero-co-occurrence risk did not
  materialise, minimum real count is 3 (Guinea Worm x River Blindness); the
  maximum is 326,154 (COVID-19 x Pneumonia).
- sharedPapers now min 3 / median 2,266 / max 326,154, 688 distinct values.
  The authored set had 53 distinct values across 736 pairs, every one a
  multiple of 100.
- Authored vs real: median 0.77x, worst 120x. 288 pairs were overstated, 448
  understated.
- **Layout verdict: composition holds.** Recomputing the top-7-per-node layout
  edge set both ways: 590 -> 619 layout edges, 87% of the union shared;
  same-category share of layout edges 57.6% -> 56.5%; zero isolated nodes;
  degree distribution unchanged (min 3 / median 7 / max 42, since the curated
  pair list is untouched). Screenshot `fix3-galaxy-post-connections.png` reads
  the same as `baseline.png`: category clusters intact, no clumping, no voids.
- **`trend` removed entirely.** The per-pair up/stable/down was authored, is
  not derivable from one count query, and was rendered as a coloured arrow
  directly beside the now-measured count. Only two consumers existed:
  `Sidebar.jsx` (removed) and the unimported legacy artifact `MedGalaxy.jsx`
  (removed there too). The field is gone from `data/connections.json`, so
  nothing can re-adopt it by accident; a new invariant asserts the key set.
- Methodology's Connections section now states the counts are live PubMed
  co-occurrence queries reproducible by hand, refreshed by that script rather
  than by the weekly Action, **and** that the pair list itself is curated, not
  an exhaustive all-pairs sweep. That second admission was not requested and is
  the more exposed one.

### P1 — provenance accounting made true (17 relabels + 4 corrections)

The "N of 153" claim was already derived at runtime; it now reads 118 of 153
(was 139 before this pass) because the exceptions grew from 14 to 35. Added a
derived `globocanCount` so the prose's "all 19 cancers" also cannot drift.

- **All 19 cancers** carry GLOBOCAN 2022 values and now say so (17 were
  labelled WHO GHE 2021; the reviewer found 16). Every one re-checked against
  the archived IARC GLOBOCAN 2022 world fact sheet (v1.1, 08.02.2024), each
  matching to the nearest thousand: lung 1 817 469, colorectum 904 019, liver
  758 725, breast 666 103, stomach 660 175, pancreas 467 409, oesophagus
  445 391, prostate 397 430, cervix 348 874, leukaemia 305 405, NHL 250 679,
  brain/CNS 248 500, bladder 220 596, ovary 206 956, kidney 155 953, myeloma
  121 388, corpus uteri 97 723, melanoma 58 667, thyroid 47 507. Note the live
  GCO URL now serves GLOBOCAN **2024**; the 2022 sheet came from the Wayback
  snapshot of the same URL, which is why the label pins the vintage.
- **Stroke** -> IHME GBD 2021. GBD 2021 (Lancet Neurol 2024;23:973-1003):
  "In 2021, stroke was the third most common GBD level 3 cause of death (7.3
  million [95% UI 6.6-7.8] deaths)". Value unchanged.
- **Pneumonia** -> IHME GBD 2021 (lower respiratory infections), and the value
  moved 2,200,000 -> **2,180,000**. GBD 2021 LRI (Lancet Infect Dis
  2024;24:974-1002) prints "2.18 million deaths (1.98-2.36)". The brief said to
  keep 2.2M; `fmt()` still renders 2,180,000 as "2.2M", so the display is
  unchanged while the stored value now matches the source exactly. The caveat
  paragraph also now says the category excludes COVID-19 deaths by
  construction, which the GBD figure does.
- **Measles** -> 108,000 (2021) was the **2023** estimate (107,500) carrying a
  2021 label. Rather than relabel a stale vintage while malaria and TB carry
  2024, it moves to the current one: **95,000 (2024)**, WHO, 28 Nov 2025: "an
  estimated 95 000 people, mostly children younger than 5 years of age, died
  due to measles in 2024".
- **Hepatitis C** -> 242,000 relabelled from GHE 2021 to WHO *Global hepatitis
  report 2024*, year 2022, which prints "242 000 (197 000-288 000) deaths" for
  2022 in Fig. 2.2. Worth knowing: the same report's prose says "hepatitis C
  244 000 deaths (17% of all viral hepatitis deaths)". The stored value matches
  the figure, not the prose; both are 2022.
- Three cancer rows are broader than their labels (colon = colorectum, lymphoma
  = NHL only, brain = brain and CNS). Added to the caveats section rather than
  left for a reviewer to find.

### P1 — flagship metric description corrected

`refresh_pubmed.py:71` stores the **undated all-time** count, so "PubMed's own
count ... summed across 35 years" was false for all 153 records. The panel now
says: papers is the all-time count from a single esearch query with no date
filter; the sparkline is a separate per-year series over 1990-2024.

While checking this I found the two do not merely differ, they can invert: for
six diseases the windowed series sums **above** the all-time total
(hepatitis-c +4,136, ptsd +1,566, adhd +698, nafld +474, norovirus +76,
covid-19 +589). Demonstrated the cause directly against PubMed rather than
assuming it: "Hepatitis C" for 2019+2020+2021 as three per-year queries returns
12,679, the same span as one range query returns 11,594. Per-year date
filtering counts a record in every year its publication dates name. Both the
panel and a per-disease sidebar footnote now say so.

### P2 #8 — point-of-display sourcing

- New `src/utils/mortalityLabel.js` derives a compact per-disease label from
  `mortalitySource`/`mortalityYear`. The blanket "WHO Deaths/yr" (wrong for
  every IHME, IARC, UNAIDS and CDC row) becomes "Deaths/yr · GHE 2021",
  "· GLOBOCAN 2022", "· GBD 2021", "· WMR 2024", "· UNAIDS 2024",
  "· US only, CDC 2023" (West Nile), "· outbreak records 2025" (Ebola),
  "· WHO reported 2023" (COVID), "· GBD 2017, sepsis-associated". The year is
  always the year the figure describes, never the report's year.
- The deaths tile now spans both sidebar columns. This was needed for the
  longest label to stay on one line at 11px, and it also removes the orphan
  fifth tile: the grid is now 2 / 1 / 2 instead of 2 / 2 / 1-and-a-gap.
- Sparkline footnote (above) fires generically on `sum(yearlyPapers) > papers`.
- Sepsis `memorableFact` overreach fixed. "Surveys consistently show that fewer
  than half of the general public in high-income countries have heard of
  sepsis" is not supportable: campaign-driven awareness has since passed half
  in the US, UK and Germany. Replaced with the specific primary result
  (Rubulotta et al., Crit Care Med 2009;37:167-70, n=6,021: "a mean of 88% of
  interviewees had never heard of the term 'sepsis'. In Germany 53% of people
  knew the word") plus an explicit note that awareness has risen where
  campaigns ran.

### Verification

- `npx vitest run`: **13 files, 135 tests, all pass** (was 124; +11). The
  corrections test is rewritten to assert value **and** year **and** source
  together for 13 diseases, so a number can no longer drift from its citation
  without failing. New: every-cancer-is-GLOBOCAN, every-disease-has-a-source,
  connections-are-not-round-numbers, connections-carry-no-trend, and 7
  `mortalityLabel` tests including a 40-char width bound over all 153 records.
- `npx vite build`: green (2.55s). The >500 kB chunk warning is the
  pre-existing Task 19 one.
- Harness shots in `docs/verify/`: `fix3-galaxy-post-connections`,
  `fix3-sidebar-sources` (malaria / west-nile-virus / breast-cancer stitched,
  plus the three singles), `fix3-methodology-provenance` and
  `-provenance-table`, `fix3-sparkline-footnote`. All read as intended.

### Judgement calls worth flagging

1. COVID 2023 is **294,000**, not the reviewer's 318,570. Two independent
   reductions of WHO's own export agree on 294,000; I could not reproduce
   318,570 by any method.
2. Measles moved vintage rather than being relabelled in place, so the panel's
   claim that the named annual-report diseases carry their most current figures
   stays true.
3. Pneumonia's stored value moved 20,000 against the brief's "keep 2.2M",
   because the rendered string is "2.2M" either way and only one of the two
   values matches what GBD prints.
4. `trend` was deleted rather than kept as an unused key. Nothing needed it,
   and an authored field sitting beside measured ones invites the next reader
   to trust it.
