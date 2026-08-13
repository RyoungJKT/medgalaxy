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

---

## Round 2 fix wave: craft, mobile, hero exclusivity, peak cue, favicon

Branch `next/showcase`, worktree `medgalaxy-next`, one commit
(`fix(gate): round-2 craft wave, mobile labels, hero exclusivity, peak cue, favicon`).
Verification: `npx vitest run` green (153 tests, 14 files; 16 new),
`npx vite build` green (2.46s, same pre-existing chunk-size warning). Shots
carry the `fix4-` prefix and every one was read back and judged; each fix
below records its drive method and, where a number was claimed, an A/B
measured by reverting only that file and re-running the same harness call.

### P1 #5: mobile tour label budget (src/components/NodeLabels.jsx)

Two changes plus a new pure module, `src/utils/labelLayout.js`:

1. **The cap is the frame's, not the desktop's.** `labelCap(viewportWidth)` =
   `clamp(round(width/36), 12, 40)`. At 1440px it returns exactly the 40 the
   Time Machine always used, so the desktop tour is byte-for-byte unchanged;
   at 375px it returns 12. Below 768px the cap also applies at rest, which is
   the idle clutter A (r2a-m-05) and C (r2c-rest) both flagged.
2. **Greedy screen-space collision culling**, on every path below 768px.
   Candidates are sorted by screen radius, each is placed only if its rect
   clears every rect already placed, and hover/selection/the finale's focus
   are pinned so the frame's own subject can never lose its name. Label rects
   are computed from the font each label will actually be drawn at:
   `width = chars * fontSize * 0.6` (the mono advance, verified against the
   live layer: a 13-character name at 5px measures 39.0px, estimate 39.0) and
   `height = max(14, fontSize * 1.5)` (Chromium's normal line box for this
   stack, also measured live: 10.5px at 5px, 18px at 12px). The first pass
   used `fontSize + 2` and left one overlapping pair at three pauses, which
   is how the line-box factor got measured rather than assumed.

`labelCap`, `labelWidth`, `labelHeight`, `rectsOverlap` and `cullOverlaps`
are pure and unit tested (`tests/labelLayout.test.js`, 14 tests: the desktop
40 is pinned, pinned candidates survive both budget and collision, ordering
is priority, `collide: false` is the wide-frame path, and a 153-label 375px
field culls to a provably non-overlapping set).

*Evidence, measured in-page over all six tour pauses at 375px (count the
visible label rects, count intersecting pairs, count rects below the rail
line), before = `git show HEAD:` of this one file:*

| | labels | overlapping pairs |
|---|---:|---:|
| before, six tour pauses | 40 each | 18 / 15 / 11 / 10 / 9 / 8 |
| after, six tour pauses | 12 each | 0 / 0 / 0 / 0 / 0 / 0 (twice, two runs) |
| before, at rest | 152 | 133 |
| after, at rest | 12 | 0 |

Desktop is unchanged: 40 labels at every tour pause, 150 at rest, no cull.
Shot `fix4-mob-tour-labels.png` (the 1996 pause at 375px): twelve names, none
touching, none over the rail.

### P1 #6: mobile thesis frame

**(a) White-hot hero on the instanceColor path** (`HighlightSystem.jsx`). The
LOW-tier flat grade drained to graphite and then lerped every ignited node
toward the same ember red, so the thesis frame was two similar red dots. It
now mirrors the shader's exclusivity: temperature in `plasma.frag` is radial
position times the node's own weight, and only the exact 1.0-weight node can
reach the white-hot core, so on the flat path (no radial term) the node whose
weight is 1.0 lerps on to `#fff3e0` on the shader's own `temp^3` curve while
everything below stays ember. Sepsis is the unique 1.0 (next is COPD at
0.895, checked against the live weights).

**(b) The sepsis micro-label ships on mobile** (`OvertureMicroLabels.jsx`).
Beat 1's pair stays desktop-only; beat 2's single label is enabled everywhere
at 9px, and is clamped above the caption sheet's *measured* top edge (the
sheet now carries `data-mg-overture-caption`, read live because the thesis
card grows a line and an odometer as it lands, so a constant would be wrong
at the one moment that matters).

*Evidence, `fix4-mob-hero.png` against the existing `fix2-mobile-hero.png`,
same drive (`__overture.seek(9.6)` at 375x812, LOW tier):* before, two
similar red-orange dots and no name; after, one white-hot node with
"Sepsis · 248,989 papers" beside it and the rest of the field ember. Measured
in-page: the label sits at y 402-416 with the caption sheet's top at 586, so
it clears by 170px.

### P2 #7: the 2021 peak recenter (src/components/TimeMachine.jsx)

The peak pause now fires its own `camera-node` cue on covid-19 with no
`factor`, the finale's pattern: a fly to the designed overview distance
rather than a relative pull off wherever the tour's three compounded push-ins
(HIV 0.80, HIV 0.62, the detonation 0.85) left the camera.

This one only reproduces on the live path, which is exactly why earlier
rounds missed it: a harness seek replays only the last camera cue, computed
off an unpushed seat, so the compounding never happens under `__tour.seek`.
Both readings below therefore play the tour for real (`seek(0)`, `resume()`,
wait out 18.7s of holds and legs) and measure projected on-screen radii at
the pause.

| | camera distance | COVID-19 | Heart Disease | heart / covid |
|---|---:|---:|---:|---:|
| before | 168 | 48.2 px | 61.4 px | **1.27** |
| after | 1121.9 | 17.2 px | 9.3 px | **0.54** |

*Shots `fix4-peak-2021-before.png` and `fix4-peak-2021.png`:* before, heart
disease is a huge orange sphere cropped by the right edge of the frame while
COVID sits small and centered, under "Attention can move this fast."; after,
COVID is centered and is the largest node in frame, with the whole 2021 field
visible. A new unit test also pins the claim the shot is making: COVID-19 is
strictly the biggest node of the peak year across all 153 diseases.

### P3 #10: bottom exclusion zone (NodeLabels.jsx + TimeRail.jsx)

`TimeRail` now exports `railBandHeight(mob)`, derived from its own layout
constants (container offset + year numeral + margin + the 44px track hit
area) = 128px on a phone, 132 on desktop, so the label layer cannot drift out
of sync with the rail the way a hand-copied constant would. NodeLabels
mirrors the `y >= 90` header rule against it, plus an 8px margin: a label
whose node is above the rail rides up to the line, one whose node is inside
the band stands down entirely. Active only while `tmPhase !== 'idle'`, since
that is the only time the rail exists.

*Evidence:* the baseline was marginal rather than harmless, which matches two
reviewers seeing it live and no harness shot catching it. Desktop, per pause,
lowest label bottom vs the rail line at 768: before 654 / 701 / **764** /
637 / 629 / 669; after 651 / 696 / **756** / 629 / 622 / 662, with the clamp
line at 760. The HIV-fade pause (the deepest push-in) sat 4px off the rail
before and is now held 4px clear of the clamp.

### P3 #11: hero exclusivity at mid-ignite (plasma.frag.glsl, pulse.frag.glsl)

`igniteContrast` damps the field but does not stop it crossing the bloom
threshold. Both shaders now scale (not clip, so nothing shifts hue) the
ignite output of any node whose weight is not exactly 1.0 so its luminance
stays under the composer's `luminanceThreshold` of 1.0, for exactly the
window `igniteContrast` is up. No new uniform: the channel that already means
"the hero is the only subject" carries it, ramping in with the same curve
(1 before the burn, 3 by the hero caption, held through release) and going
inert with `ignite` when the film ends.

*Evidence, 120px boxes around sepsis and COPD, before = `git show HEAD:` of
the two shader files, same seeks:*

| t | sepsis mean / peak / bright px | COPD mean / peak / bright px |
|---|---|---|
| 8.2 before (the hero-naming frame) | 124.8 / 255 / 1963 | **67.7 / 255 / 450** |
| 8.2 after | 124.4 / 255 / 1965 | **12.2 / 145 / 0** |
| 8.0, 8.6, 9.0 before | 12.3 / 23.6 / 49.3 mean | 3.9 / 5.7 / 7.1 mean |
| 8.0, 8.6, 9.0 after | 12.3 / 23.5 / 49.3 mean | 3.9 / 5.7 / 7.1 mean |

The defect is a transient on the hero-caption frame itself, not the ignite
landing, which is why `seek(9.6)` never showed it and `r2c-hero.png` did: the
before ratio there is 0.54, within noise of the 0.52 Reviewers A and C
measured independently. After, sepsis is untouched to within a pixel count of
2 in 1965 and COPD has zero pixels over the bright threshold. Away from that
frame nothing moves at all, so the mid-field smolder is intact.

*Shots `fix4-hero-hold-bloom-before.png` and `fix4-hero-hold-bloom.png`:*
before, sepsis blooms white and COPD blooms a cyan-teal halo top-center;
after, one blooming node and COPD is a plain ember sphere.
`fix4-release-unaffected.png` confirms full category color returns at release.

### P3 #12: HIV sparkline (TimeMachine.jsx, TourSparkline.jsx)

The HIV-fade pause caption carries a `sparklineCeiling` (its own series max,
still with a zero baseline); the finale deliberately does not, because there
flatness is the argument. `TourSparkline` prefers the per-pause ceiling and
falls back to the shared `maxYearly`.

*Evidence:* against the shared ceiling the whole 35-year HIV series spanned
5.3 percent of the box (1.3px of 24); against its own it spans 65 percent
(15.5px). Both bounds are pinned in a unit test. Shots
`fix4-hiv-sparkline-before-zoom.png` and `fix4-hiv-sparkline-zoom.png` (3x,
same clip): before, a dead-flat line; after, a climb, a plateau and a decline
with the playhead on the falling side. Full frame:
`fix4-hiv-sparkline.png`.

### P3 #13: favicon (public/favicon.png, index.html)

A 32x32 PNG generated from a small deterministic script (pure Node, zlib plus
hand-written PNG chunks, no image dependency): one glowing node on the app's
own `#06080d`, white core into the `#22c55e` corona the pre-React shell's
brand dot already uses. Declared as `rel="icon"` plus `apple-touch-icon`.

*Evidence:* a run that records every response and console message reports
`/favicon.png` 200, zero 404s of any kind, zero console errors, and
`link[rel=icon]` resolving to it. `dist/favicon.png` is emitted by the build.
Shot `fix4-favicon.png` is the icon as served, magnified.

### P2 #9: mobile performance evidence (measurement only)

Three headed LOW-tier runs at 375x812 appended to
`docs/verify/perf-matrix.md` as section 5b: at rest 120 fps, beat-2 morph
120 fps, Time Machine travel leg (1996 -> 2019, 6 year-steps) 120 fps, all
against a >=55 gate on a 120Hz display. The leg run was repeated with a shot
(`fix4-mob-tm-leg.png`) whose rail reads 2019 at the end of the FPS window,
proving the window covered travel and not a hold. Same ceiling-reading caveat
as section 5, stated there.

### Judgement calls worth flagging

1. **The bloom ceiling rides `igniteContrast` rather than a new uniform.**
   The alternative was a dedicated `heroExclusive` channel. The contrast
   channel already has exactly the right lifetime and meaning, and a second
   channel would have been a second thing to keep in sync with the film.
   The cost is that the ramp's shape is tied to `HERO_CONTRAST` being 3;
   the clamp saturates at any value at or above 3 and is documented as such.
2. **The collision cull is narrow-frame only.** Applying it on desktop would
   change a frame two reviewers have already accepted, and the cost is a
   per-frame sort the wide path does not need. The budget still applies on
   both.
3. **Culling is greedy by screen radius, not an optimal packing.** A label
   dropped for colliding with a bigger neighbour is the intended reading
   order (the bigger node is the more important one), and greedy is O(n·k)
   with k <= 12 on the frame that needs it.
4. **The peak cue reuses the finale's factor-less recenter** rather than a
   new "reset push-ins" concept. One camera vocabulary, already tested.
5. **`fix4-*-before.png` shots are kept** beside their afters. Three of the
   five findings only reproduce under a specific drive (live tour, the
   hero-caption frame, the shared ceiling), so the before is the part of the
   evidence that is hard to re-obtain later.

---

## Round 3 fix wave: label ranking, rest culling, hivFade framing, favicon.ico, reduced-motion odometer

Branch `next/showcase`, worktree `medgalaxy-next`, one commit
(`fix(gate): round-3 label ranking, rest culling, hivFade framing, favicon.ico,
reduced-motion odometer`). Verification: `npx vitest run` green (158 tests, 14
files; 5 new), `npx vite build` green (2.5-2.7s, same pre-existing chunk-size
warning). Shots carry the `fix5-` prefix; every one was read back and judged,
and each numeric claim below was measured live against the running app (a
headless Chrome harness driving `window._store`/`window.__tour`/`window.__tm`,
the same dev-hook pattern `tools/verify.mjs` already uses), not inferred from
the diff.

### Finding 1 (MOST-CITED): Time Machine label ranking used the wrong radius

`src/components/NodeLabels.jsx`. The label layer's priority (and its
tiny-label cull) was computed from `nR(diseases[i].papers)`, the all-time
radius, regardless of whether the Time Machine was up, while the node itself
draws at `sceneRefs.tm.radiusAt(i)`, the per-year interpolated radius
(`DiseaseNodes.jsx`'s own render loop). A disease with a huge all-time total
but zero papers in the year on screen (COVID-19, most obviously, in any year
before it existed) still ranked as if it were the biggest node in the galaxy.

Fix: while `tmPhase !== 'idle'`, `nodeR` (and therefore `screenR`, which feeds
both `c.pri` in the budget/cull pass and the existing `screenR < 0.3` tiny-label
cull) is read from `sceneRefs.tm.radiusAt(i)` instead of `nR(papers)`. No new
threshold was needed for "invisible nodes don't get labels": the existing
0.3px cull already does that once it is fed the real per-year radius, since a
disease at the Time Machine's zero-papers floor (`ZERO_RY = 0.05` in
`timeMachineData.js`) projects to a screen radius far under it.

*Evidence, live (headless, `window.__tm.radiusAt`):*

| Pause | COVID-19 true radius | Diseases with bigger radius that year | Label visible before | Label visible after |
|---|---:|---:|---|---|
| 1996 (hivSurge) | 0.05 (the zero floor) | 152 of 152 | **true** (bug) | **false** |
| 2021 (peak) | 18 (the ceiling) | 0 of 152 | true | true (unchanged, correctly) |

At 1996 COVID-19 is, by true per-year radius, the *least* prominent node in
the galaxy, yet the old ranking (all-time papers) kept its label on screen
through every frame of the tour, the empty-1996 defect the finding names.
Shot `fix5-tm-1996.png`: the 1996 pause, "HIV research climbed with the
epidemic.", no COVID-19 label anywhere in the 40 shown.

At 2021 COVID-19 was already the single biggest node under both metrics
(all-time paper rank 7, true-radius rank 0), so its own presence never
depended on this fix; the "typographic hierarchy contradicts the caption"
part of the finding is about the *rest* of the cap's membership. Comparing the
true-radius top 40 against the all-time-papers top 40 at the 2021 frame finds
exactly the swap the finding describes: **Congenital Heart Defects** and
**Stomach Cancer** (true 2021 radius 4.08 / 3.92) would have held a slot under
the old ranking despite two other diseases having a bigger true 2021 radius
that day, **Metabolic Syndrome** and **Multiple Sclerosis** (4.55 / 4.31),
which the fix now promotes into the cap instead. Shot `fix5-tm-2021.png`:
"Attention can move this fast. 141,958 COVID-19 papers in 2021 alone.",
COVID-19 labeled and (per the table above) ranked first by the metric that now
drives the cap.

### Finding 2: desktop rest-frame label soup

`src/components/NodeLabels.jsx` + `src/utils/labelLayout.js`. The budget/cull
pass only ran `if (tmActive || narrow)`, so a 1440px idle galaxy was exempt
from both the cap and the collision cull the tour and narrow frames already
had, and measured 117 labels with 20 overlapping pairs live.

Fix: the pass now always runs, every phase, every viewport width; only the cap
differs. The tour keeps `labelCap`'s desktop-width 40 unchanged (still the
narrative argument: a handful of nodes changing size). Rest at a wide
viewport gets a new `restCap(viewportWidth)` (`src/utils/labelLayout.js`,
same clamp shape as `labelCap`: `round(width/20)` clamped to `[60, 80]`, so
1440px lands at 72). Narrow frames keep `labelCap` at both phases exactly as
Task 20 round 2 left them (12-40), since a separate rest number there would
just be the same number, and mobile's own before/after (12 labels, 0
overlaps, both phases) was re-measured live and is unchanged. `cullOverlaps`
is now called with `collide` always true (its own default), so the desktop
tour also culls collisions for the first time; the round-2 judgement call
that kept it narrow-only is explicitly overridden by this finding.

*Evidence, live, desktop 1440px:*

| | labels | overlapping pairs |
|---|---:|---:|
| rest, before (this pass never ran) | 117 | 20 |
| rest, after | 72 | **0** |

72 sits inside the review's 60-80 target band. Shot `fix5-rest-labels.png`:
the settled rest frame, dense but with visibly separated names, `tmPhase`
confirmed `'idle'` at capture time (the auto-tour's one-shot was deliberately
spent and the machine stopped before measuring, so the 1.5s arm timer could
not fire mid-shot and silently swap the frame to the tour's 40-cap instead of
rest's 72). 8 new `labelLayout.test.js` tests pin `restCap`'s band, ceiling,
floor, and that it is never smaller than `labelCap` at any desktop width.

### Finding 3: hivFade caption leaned on a weak snapshot

`src/components/TimeMachine.jsx`, `caps.hivFade`. The data line compared HIV's
peak (7,534 papers, 2014) against a fixed pause year, 2019 (6,849), a 9.1%
dip that undersells "attention faded," since papers moved both up and down
across the pause's own 1996-2019 travel window and 2019 was not the series'
low point.

Fix: compare the peak against the latest year on file instead (2024: 6,050,
a 19.7% decline from peak), the honest, stronger reading the same series
supports, still fully derived at build time from `yearlyPapers` (no
hard-coded 2019 anywhere in the new string) plus the store's own
`hiv.mortality` (630,000, UNAIDS 2024).

*New caption, verified live via `window._store.getState().tmCaption` at the
hivFade pause:*

> Attention faded long before the epidemic did.
> HIV/AIDS papers peaked at 7,534 in 2014. 630,000 people still die of it
> every year.

Shot `fix5-hivfade.png` confirms the same text on screen. `tests/
timeMachineTour.test.js` updated: the old assertions pinning the 2019
snapshot are replaced with one pinning the peak-year phrase and the mortality
figure, plus a new test asserting the string no longer contains "2019" or its
figure at all, so a regression there would mean the weak framing crept back
in.

### Finding 4: residual /favicon.ico 404

Chrome and Safari request `/favicon.ico` directly regardless of the
`<link rel="icon">` PNG declaration round 2 already fixed (P3 #13), a
browser-level fallback, not something the HTML controls. `public/favicon.ico`
generated from the existing `public/favicon.png` via `sips -s format ico`
(a real 32x32 ICO resource, not a renamed PNG, confirmed via `file`:
"MS Windows icon resource"). `index.html` gets an explicit
`<link rel="shortcut icon" href="/favicon.ico">` alongside the existing PNG
link, and the build copies it to `dist/favicon.ico` automatically (Vite's
`public/` passthrough, same as the PNG).

*Evidence, live (response listener on a fresh page load):* `GET
/favicon.ico` returns `200`, `Content-Type: image/x-icon`, zero console 404s
matching `favicon`. `curl -I` against the dev server confirms the same
status and mime type independently of the browser run.

### Finding 5: Odometer digits still animated under reduced motion

`src/components/ui/Odometer.jsx`. The digit-column strip's `transform`
transition (`DUR.slow`, 480ms) ran unconditionally; `prefers-reduced-motion`
was never read anywhere in the component. Fix: the inner strip carries a new
`mg-odometer-col` class, and the component's existing injected `<style>` block
(already used for the unit-label crossfade keyframes) gets a
`@media (prefers-reduced-motion: reduce) { .mg-odometer-col { transition:
none !important; } }` rule, a live media query rather than a one-time
`matchMedia` read, so it also tracks the OS setting changing mid-session, and
`!important` is required because the inline `transition` declaration would
otherwise win on specificity.

*Evidence, live, both with an actual Odometer mounted (the overture's hero
caption, `window.__overture.seek(9.6)`, 8 digit columns on screen):*

| | `transitionDuration` (computed) |
|---|---|
| normal | 0.48s |
| `prefers-reduced-motion: reduce` | **0s** |

The first probe (a synthetic detached element, no Odometer actually mounted)
read a false pass at 0.5s: the class rule only exists in the DOM once an
Odometer instance has rendered its own `<style>` tag, so the check was
retried against a real mounted instance and is what the table above reports.

### Finding 6: TourSparkline.jsx:51 craft nit

`src/components/ui/TourSparkline.jsx`. `diseaseId` mixed two different
"nothing to draw" sentinels: the mobile/no-caption branch used `null`, but a
pause without a `sparklineFor` field (four of the six) left
`tmCaption.sparklineFor` genuinely `undefined`, so `diseaseId` itself flipped
between `undefined` and `null` across pauses that both mean "no sparkline."
Since `diseaseId` sits in the driving effect's dependency array, this meant
the effect (which starts/stops the sparkline's own rAF loop) could tear down
and rebuild for a transition that was a no-op from the viewer's side. Fixed
with a single nullish-coalescing normalization,
`mob ? null : (tmCaption?.sparklineFor ?? null)`, matching the optional-
chaining idiom already used elsewhere in this codebase (`NodeLabels.jsx`'s
`hoveredNode?.index ?? -1`).

*Evidence, live:* the sparkline still renders correctly at both of its two
pauses post-fix, hivFade (`opacity: 1`, a real polyline with rising/falling
points) and the finale's flatline (`opacity: 1`), confirming the
normalization didn't change which pauses draw a sparkline, only the
consistency of the "no sparkline" state between them.

### Finding 7: mobile hint chips 9px legibility

`src/components/ui/HintChips.jsx`. Mobile chip text was smaller than desktop's
(9px vs 10px) at `#94a3b8`, the first30 review's held-back reason. Bumped to
11px at `#cbd5e1` (desktop unchanged at 10px/`#94a3b8`).

This alone widened the three-chip row from 348px to 408px, overflowing both
edges of a 375px viewport (measured live, before/after); the row is
`width: max-content` inside a `left:50%` / `translateX(-50%)` container (Task
17), so the extra width was invisible until actually measured. Mobile padding
(`10px` horizontal) and gap (`6px`) were trimmed to `5px`/`3px` to bring the
row back to 372px, fitting again with a small margin. Desktop padding/gap are
untouched.

*Evidence, live (`getComputedStyle` + `getBoundingClientRect` on the chip
row, 375px viewport):*

| | font | color | row width | fits 375px? |
|---|---:|---|---:|---|
| before | 9px | `#94a3b8` | 348px | yes |
| font bump alone (intermediate) | 11px | `#cbd5e1` | 408px | **no, overflows 16.5px each side** |
| after (padding/gap trimmed) | 11px | `#cbd5e1` | 372px | yes |

Shot `fix5-mob-hints.png`: all three chips fully on screen, "Try the Time
Machine" no longer clipped at the right edge.

### Verification

- `npx vitest run`: **14 files, 158 tests, all pass** (was 153; +5: 4 new
  `restCap` tests plus the hivFade regression test; one existing hivFade test
  rewritten for the new caption text).
- `npx vite build`: green (~2.5s). Same pre-existing >500 kB chunk warning
  from Task 19.
- Harness shots in `docs/verify/`, `fix5-` prefix: `fix5-tm-1996`,
  `fix5-tm-2021`, `fix5-rest-labels`, `fix5-hivfade`, `fix5-mob-hints`, plus
  `fix5-odometer-reduced-motion` (finding 5 has no named shot in the
  verification contract but was checked and shot anyway). All read back and
  judged against the numbers above.
- `data/*.json` untouched, per the round's own constraint (a parallel audit
  owns that tree), confirmed via `git status` before committing.

### Judgement calls worth flagging

1. **Finding 1's "minimum current radius" clause needed no new code.** The
   existing `screenR < 0.3` cull already does this once fed the correct
   radius; adding a second, redundant threshold would have been two numbers
   to keep in sync instead of one.
2. **`restCap` is a new named budget, not a parameter on `labelCap`.** The two
   have different shapes (12-40 scaled by /36, 60-80 scaled by /20) driven by
   different arguments (a story's attention budget vs. idle's "well
   populated but readable"); folding them into one function with a mode flag
   would have made the desktop-tour-unchanged guarantee harder to read at the
   call site.
3. **Finding 7 grew a second, unrequested change** (the padding/gap trim).
   The font bump alone regressed the row past the viewport edge, measured,
   not assumed, so leaving it unfixed would have shipped a new clipping bug
   in the same commit that fixed the legibility one the finding named.
4. **The odometer fix uses a live media query, not a one-time `matchMedia`
   read.** Other components in this codebase (`TimeMachine.jsx`'s
   `reducedRef`) read `matchMedia` once on mount, which is correct for a
   value only consulted at a scripted moment (the tour's own start). The
   digit transition is consulted continuously (every value change, for the
   life of the session), so a live CSS rule tracks a mid-session OS setting
   change where a mount-time ref would not.

## Round 4 data wave: full 153-row mortality provenance reconciliation

Branch `next/showcase`, worktree `medgalaxy-next`, one commit
(`fix(data): full 153-row mortality provenance reconciliation + audit
manifest guard`). Input: the completed 153-row audit (39 keep, 61 relabel,
23 correct, 30 flag), applied under the controller's policy, with the applied
truth written to `data/mortality-audit.json` and made permanent by a test.

### What was applied

- **keep (39):** untouched. Where the audit restated value/year/source on a
  keep row, the applier asserted it equalled what was stored; nothing
  mismatched.
- **relabel (61):** source string replaced with the one the value actually
  came from (year/value carried where the row named them, always equal to
  what was stored, so no relabel moved a number). The bulk of these are rows
  that held an IHME GBD or single-study figure while citing WHO GHE 2021 for
  a cause line the GHE workbook does not contain.
- **correct (23):** value, year and source replaced together. Largest moves:
  endocarditis 17,000 -> 78,000 (GBD 2021 infective endocarditis; the stored
  figure was ~4.5x low), multiple sclerosis 4,700 -> 16,300 (a US-only count
  wearing a global citation), leishmaniasis 26,000 -> 5,800 (the withdrawn
  fact-sheet range floor -> the GHE 2021 line), preeclampsia 76,000 -> 38,000
  (advocacy figure -> GBD maternal hypertensive disorders), tetanus
  35,000 -> 21,400, dengue 40,000 -> 24,000, ebola 49 -> 2,013, anorexia
  nervosa 1,500 -> 270, down syndrome 21,000 -> 27,500, chronic kidney
  disease 1.3M -> 1.4M (the stored value was the GHE 2019 vintage),
  Alzheimer's 1.90M -> 1.95M, asthma 455,000 -> 442,000, influenza
  400,000 -> 389,000, chikungunya 500 -> 186, plague 300 -> 100, leprosy
  0 -> 230, gout 0 -> 3,400 (both rows where the cited source publishes a
  nonzero line, so a zero could not stand under that citation).
- **flag (30):** stored value kept, source replaced with the audit's honest
  wording, year kept where the audit gave one and removed where it did not
  (10 rows now carry no `mortalityYear` at all).

Two controller-decided note alternatives: **colon-cancer** keeps 904,000 but
is renamed to "Colorectal Cancer" with source "IARC GLOBOCAN 2022
(colorectum incl. anus)", since 904,000 is GLOBOCAN's colorectum total, not
colon alone; **ebola** takes the audit's ongoing-outbreak row (2,013 deaths
as of 11 Aug 2026, 2026 Bundibugyo epidemic, PHEIC 16 May 2026), which
already reflected the outbreak the round-3 reviewer cited, so no separate web
check was needed.

Three flag rows (`huntingtons-disease`, `traumatic-brain-injury`,
`prion-disease`) carried no top-level source in the audit; their wording was
taken from the "honest label wording" clause in each row's note and
reconciled with the policy that a flag row keeps its stored value, so TBI
reads "no WHO GHE or IHME GBD cause line (injury deaths are coded to external
causes); modeled literature estimate, not a WHO or IHME figure" rather than
claiming a source for its 500,000.

### The manifest and its guard

`data/mortality-audit.json` records, per id: value, year, source, action,
url, confidence, checked ("2026-08-12"). `tests/dataInvariants.test.js`
replaces the old hand-listed corrections test with three:

1. every disease's `(mortality, mortalityYear ?? null, mortalitySource)`
   equals the manifest's `(value, year ?? null, source)` — this is what
   proves the full application, and it permanently guards the default pool;
2. the manifest itself carries a known action, a source, a confidence and the
   check date for all 153 rows, and the action counts are exactly
   39/61/23/30;
3. no flagged row's source starts with a WHO GHE or IHME GBD attribution, and
   every one of them classifies as no-global-estimate.

Plus a rewritten year invariant: source is always present, year may be
absent, and the yearless set is asserted by name (the 10 flag rows above).

### Sidebar label (src/utils/mortalityLabel.js)

Restructured into one `classify()` with named-source rules first and the
no-estimate class second, so a source that publishes a figure and then notes
a gap keeps its attribution (WHO's typhoid fact sheet publishes 110,000 and
says typhoid has no GHE cause line: it reads "WHO fact sheet 2019", not "no
global estimate"). New short forms: `WHO fact sheet`, `WHO outbreak reports`,
`reported, WHO/ECDC`, `WHO surveillance`, `GRAM/GBD`, and a generic
`modelled, <first author>` for single studies (Costa, Ali, Paget, Lopman).
The year is now appended, not interpolated, so a row with no year renders
`GBD, all LRI` rather than inventing one. Flag-class rows read
`Deaths/yr · no global estimate` whether the stored value is 0 or a
region-only number, which is the point of those rows. All 153 labels stay
within the 40-character single-line budget the tile allows.

### Methodology panel

The provenance table already derived from the data, so it picked the whole
audit up on its own (136 rows now differ from the shared default, up from a
handful). Added: one derived sentence naming the no-global-estimate class
("For 46 of the 153 diseases no authority publishes a global death estimate
at all..."), a "none" year cell for the 10 yearless rows, and a rewritten
counts paragraph, because the old one claimed "everything else defaults to
WHO Global Health Estimates 2021" when the default now covers 17 rows. The
four bucket counts (23 GHE / 19 GLOBOCAN / 38 GBD / 46 no-estimate, 27 on a
programme report, fact sheet or single study) are all derived and disjoint;
`globocanCount` is anchored to `^IARC GLOBOCAN` precisely so the HPV row,
whose no-estimate wording mentions GLOBOCAN, is not counted twice. The colon
and ebola caveat sentences were updated to match the renamed row and the
ongoing epidemic. `src/components/ui/Legend.jsx`'s footer credit no longer
says "WHO GHE 2021 and per-disease sources" (it now says "deaths:
per-disease sources"), since GHE is no longer the majority source.

Eight passages in `data/disease-insights.json` quoted a mortality figure the
audit moved (leishmaniasis 26,000, brain 249,000, endocarditis 17,000,
Alzheimer's 1.9M, MS 4,700, CKD 1.3M, preeclampsia 76,000, tetanus 35,000).
Each was updated to the audited number in place, so the prose cannot
contradict the tile above it.

### Verification

- `npx vitest run`: 166 tests, 14 files, green (was 124/12 at round 1).
- `npx vite build`: green.
- Python cross-check: all 153 rows in `data/diseases.json` match the
  manifest triple, 0 mismatches; action counts 39/61/23/30 confirmed.
- Harness `fix6-` shots, all read back and judged:
  `fix6-sidebar-flag` (Buruli Ulcer: "Deaths/yr · no global estimate", value
  N/A, one line), `fix6-sidebar-relabel` (Rabies: "Deaths/yr · WHO fact sheet
  2015", 59K), `fix6-colorectal` (+ `-search`: sidebar and node label read
  "Colorectal Cancer", typing "Colorect" surfaces it in the dropdown),
  `fix6-methodology` (+ `-table`, `-none`: the derived sentence, the 136-row
  table, and a "none" year cell rendering cleanly), `fix6-deaths-view`
  (mortality sizing with the Time Machine stopped: sepsis 11M largest, then
  heart disease, stroke, COPD, pneumonia, Alzheimer's, lung cancer, type 2
  diabetes; 45 rows at zero, no console errors).

### Judgement calls worth flagging

1. **The no-estimate caption is classified off the source string, not off a
   new data field.** The wording in `data/diseases.json` stays the single
   place the truth is written down, and the panel and the sidebar read the
   same predicate, so the panel's count cannot drift from what the tiles say.
2. **Named source beats no-estimate wording.** Ordering the rules the other
   way captioned typhoid, which has a published WHO estimate, as having none.
   That ordering is now the thing the typhoid assertion in
   `tests/mortalityLabel.test.js` protects.
3. **Zero-value rows whose source publishes a zero keep the bare
   "Deaths/yr".** Only rows where nobody publishes anything earn the caption;
   captioning WHO's published zero for trachoma or ADHD as "no global
   estimate" would be the same class of error the audit was run to kill.
4. **The 46 that read "no global estimate" is wider than the audit's 30
   flags**, because 16 relabel rows landed on the same honest wording (no
   cause line, zero as a modeling boundary). The panel counts what the
   display actually shows rather than an audit-internal category the viewer
   cannot see.
5. **The insights prose was corrected, though the brief only named the colon
   entry.** Eight entries quoted numbers the audit moved; leaving them would
   have put a contradicted figure two inches below the corrected tile, which
   is exactly the credibility failure this pass exists to remove.

## Round 5 punch-list wave: covid export refresh, tooltip truth, colon alias, chagas year

Four non-blocking items left after the gate shipped at 9.06. One commit
(`fix(polish): ship punch-list, covid export refresh, tooltip truth, colon
alias, chagas year`).

### 1 — COVID-19 2023 deaths: 294,000 -> 318,570

Downloaded the live WHO global data export directly
(`https://srhdpeuwpubsa.blob.core.windows.net/whdh/COVID/WHO-COVID-19-global-data.csv`,
the file `data.who.int/dashboards/covid19/deaths` actually serves; the old
`covid19.who.int/WHO-COVID-19-global-data.csv` URL now 404s to an HTML shell)
and summed `New_deaths` over every row with `Date_reported` in `2023-01-01`
through `2023-12-31`: **318,570**, across 12,720 country-day rows, matching
the round-4 reviewer's export exactly. `data/diseases.json` and
`data/mortality-audit.json`'s `covid-19` rows both now carry `"mortality":
318570` / `"value": 318570` and the source string `"WHO COVID-19 dashboard
export, reported deaths 2023 (retrieved Aug 2026); reporting has since
largely ceased"`. The audit action moved `keep` -> `correct` (the number
changed, not just the wording), so `tests/dataInvariants.test.js`'s action
tally and its covid-19 spot-check both needed updating to match — both
edited in place rather than left to rot against a manifest they no longer
described.

*Evidence, sidebar readback:* selected COVID-19 via search, sidebar tile
reads "Deaths/yr · WHO reported 2023" / "319K" (the tile's own `fmt()`
rounding of 318,570).

### 2 — Mortality toggle tooltip

`src/components/ui/Header.jsx`'s `SizeToggle` (the live component; the
near-identical copy inside the unused, unimported `src/MedGalaxy.jsx` was
left alone) read "Node size scaled by annual deaths reported by WHO" —
false for the 114 of 153 rows whose figure comes from IHME, IARC, UNAIDS,
CDC or a single study, not WHO. Reworded to "Node size scaled by annual
deaths, per-disease sources shown in each sidebar", the exact string
specified. Not length-matched to the old string (79 vs 51 characters) because
the brief's literal text took precedence over the length note, and the
tooltip box already wraps at `width: 220`.

*Evidence, tooltip readback:* clicked Mortality, tooltip renders the new
sentence in place, three lines, no clipping.

### 3 — Colon Cancer alias

`data/diseases.json`'s `colon-cancer` entry gained `"aliases": ["Colon
Cancer"]`. Rather than patch only `SearchDropdown.jsx`, added one shared
predicate, `matchesSearch(d, sq)` in `src/utils/helpers.js` (label match,
falling back to any alias match), and pointed all three places that filter
or highlight by `searchQuery` at it: `SearchDropdown.jsx` (the dropdown
list), `HighlightSystem.jsx` (the 3D scene's dim/highlight pass), and
`store.js`'s `startRoulette` (roulette eligibility). Before this, only the
dropdown would have matched "colon" had it been patched alone — the 3D
highlight and the roulette pool would have silently stayed unmatched,
which is exactly the kind of inconsistency a reviewer would have caught next
round. The dropdown still renders `d.label` ("Colorectal Cancer"), never the
alias, so the canonical name is what a searcher sees.

*Evidence, dropdown readback:* typed "colon" in the header search box,
dropdown shows exactly one result, "Colorectal Cancer".

### 4 — Chagas mortalityYear

`data/diseases.json`'s chagas row borrowed 2026 — the fact sheet's revision
date ("updated April 2026"), not a year its ~10,000 estimate describes.
Every other yearless row in this dataset omits the `mortalityYear` key
entirely (confirmed against `buruli-ulcer` and eight others); the key is now
omitted for chagas too, rather than set to `null`, matching that convention
and `tests/methodology.test.js`'s `typeof d.mortalityYear === 'number'`
check for any row that carries the field at all. `mortality-audit.json`'s
`year` stayed `null` (its existing convention for every yearless row, chagas
included) — only `diseases.json`'s key needed removing.

This reopened `tests/dataInvariants.test.js`'s "every disease carries a
mortality source, and a year wherever a year exists" test, which had
asserted *every* yearless row is both audit-flagged and matches
`isNoGlobalEstimate()` — true for the other ten, false for chagas, which
carries a real, named, published WHO estimate that simply has no reference
year. Added a one-off carve-out for `id === 'chagas'` (asserts `action ===
'correct'` and `isNoGlobalEstimate() === false` instead) and added `'chagas'`
to the test's pinned, alphabetically-sorted yearless-id list.

*Evidence, sidebar readback:* selected Chagas Disease via search; the deaths
tile reads "Deaths/yr · WHO fact sheet" (no year, no crash, one line) —
`mortalitySourceLabel`'s existing null-year handling (already exercised by
`tests/mortalityLabel.test.js` for IHME GBD with a null year) needed no
changes to render this cleanly.

### Verification

- `npx vitest run`: 166 tests, 14 files, green.
- `npx vite build`: green.
- Live app (`npx vite --port 5280`, Browser-pane MCP against the interactive
  scene, not a scripted harness this round): `fix7-covid-sidebar` (COVID-19
  tile: "Deaths/yr · WHO reported 2023", "319K"), `fix7-tooltip` (Mortality
  toggle tooltip shows the new sentence), `fix7-colon-search` (typing "colon"
  surfaces "Colorectal Cancer" and only that row), all three read back and
  judged as above; chagas sidebar also spot-checked live.

### Judgement calls worth flagging

1. **The audit action for covid-19 changed from `keep` to `correct`**, which
   the brief didn't explicitly call for but the invariant test enforces
   consistently for every other row whose value moved — `keep` would have
   quietly mislabeled a corrected figure as one that needed no correction.
2. **The alias predicate was wired into all three search-matching call
   sites, not just `SearchDropdown`.** The brief named the dropdown
   specifically, but the app has exactly one `searchQuery` in the store and
   three places read it; wiring only one would have made "colon" work in the
   list but not in the scene it's supposed to be finding.
3. **`mortalityYear` is omitted for chagas, not set to `null`**, because
   that's what every other yearless row in the dataset already does and
   `nonDefaultMortalitySources`'s field-type check expects — `null` would
   have been a new, inconsistent representation of the same "no year" fact.

## Round 6: user feedback — the Time Machine's per-year size mapping

**Report:** "During the Time Machine's HIV story (the 1996 tour pause and
manual scrubbing through the 90s-2000s), the HIV sphere grows too subtly as
the slider moves forward. It should grow obviously."

### Root cause, and why the obvious fix is the wrong one

`nRY(c, maxYearly)` in `src/utils/timeMachineData.js` was
`0.25 + (c / maxYearly)^0.5 * (18 - 0.25)`, normalized against the single
global maximum: COVID-19's 141,958 papers in 2021. HIV/AIDS climbs 2,659
papers a year in 1990 to 7,534 at its 2014 peak — a 2.83x rise, the entire
subject of the tour's two HIV pauses — and that landed as radius 2.68 to
4.34. A 1.62x change across twenty-four years of slider travel reads as "the
same node."

The brief's first candidate (drop the exponent to ~0.32-0.38) makes it
**worse**, and measurably so. A power curve is scale-invariant: the radius
ratio between any two counts is exactly `(c2/c1)^exponent` regardless of what
ceiling it is normalized against, so the ceiling cannot affect it at all and
a *smaller* exponent shrinks it. Measured over HIV's own 1990 -> 2014 span:

| exponent | HIV 1990 -> 2014 radius | ratio |
|---|---|---|
| 0.32 | 5.22 -> 7.19 | **1.38x** |
| 0.38 | 4.17 -> 6.07 | **1.46x** |
| 0.5 (shipped) | 2.68 -> 4.34 | **1.62x** |
| 0.7 | 1.35 -> 2.52 | 1.87x |
| 0.85 | 0.99 -> 1.94 | 1.97x |

A 2x radius change out of a 2.83x count change needs an exponent of at least
`ln(2)/ln(2.83) = 0.67`. So the exponent has to go **up**. But at exponent
0.85 against the 141,958 ceiling HIV is a 1-2 radius speck — which is where
the second candidate, the percentile ceiling, earns its place: it is what
gives the absolute size back. Both moves are needed, and they are the two the
brief listed, just not in the directions the brief expected.

### The mapping that shipped

A **90th-percentile knee with a linear tail**, computed from the data:

```
knee = 90th percentile of all 5,355 (disease, year) yearly counts = 7,238
c <= knee : f = 0.38 * (c / knee)^0.85
c >  knee : f = 0.38 + 0.62 * (c - knee) / (maxYearly - knee)
radius    = 0.25 + f * (18 - 0.25)          zero -> 0.05 floor, unchanged
```

90 percent of all yearly counts now share 38 percent of the radius range;
they shared 22.6 percent before. `maxYearly` still reaches exactly 18, so the
Time Machine's biggest node is unchanged and still far below the
cumulative-view giants (`helpers.js` `MX` is 55).

**The tail is linear, not clamped, on purpose.** A clamp at the knee would
tie COVID-19's 94,633 papers in 2020 with pneumonia's 77,289 at the same
radius, breaking the honesty invariant that a bigger count is always a bigger
node. Linear is also the least compressive bounded tail available, which is
why it *preserves* the detonation's top-end separation instead of blunting
it. Three alternatives were computed and rejected on measured numbers: a
Hill/saturating shoulder (COVID's 2020 lead over pneumonia collapses to
3.4 percent), a power-law tail with a matched exponent (6.0 percent), and a
pure log curve (median node shrinks 1.82 -> 1.04, and HIV never gets its
absolute size back). Linear holds 11.1 percent.

The knee is derived from the table at build time, not transcribed, so the
weekly PubMed refresh moves it with the distribution it describes.

### Measured results

**HIV growth, real rendered pixels.** Both frames captured at the tour's own
1996 HIV pause camera (`__tour.seek(1)` after a `camera-home` snap, so the
pause's 0.80 push-in multiplies the designed overview seat and not whatever
the intro left behind), camera then frozen while only the scrub year changes.
Diameter measured off the screenshots themselves: luminance walk out from
HIV's projected centre to the half-way point between core and local
background.

| | 1990 | 2014 (HIV's peak) | ratio |
|---|---|---|---|
| before (`hivfix-1990-before`, `hivfix-2014-before`) | **5.0 px** | **8.0 px** | **1.60x** |
| after (`hivfix-1990-after`, `hivfix-2014-after`) | **6.0 px** | **13.5 px** | **2.25x** |

Model radius 3.13 -> 7.02 and the analytic projection (2.25x) agree with the
pixel walk to within 0.01x, so the measurement is not a thresholding
artifact. Acceptance criterion 1 (~2x) met at 2.25x.

**COVID's detonation stays the biggest beat** (`hivfix-2020-covid`). Top three
radii in 2020: **covid-19 14.13 | pneumonia 12.72 | heart-disease 12.34**.
COVID leads the field by 11.1 percent, slightly *more* than the 10.5 percent
it led by before — the knee did not blunt it. Its 2019 -> 2020 jump goes from
0.69 to 14.13, a **20.6x** single-year change against **14.0x** before, and it
remains the single largest year-over-year change in the whole 153 x 35 table
by both ratio and absolute delta (asserted in the suite, not just observed).
Worth flagging honestly: pneumonia's own 2020 spike *is* COVID pneumonia, so
"a wide margin" over every other 2020 node was never true of this data under
any monotone mapping — it was 10.5 percent before this change and is 11.1
percent after, and the detonation reads as the biggest beat because of the
*change*, the push-in, the shockwave and the flash, not a solo silhouette.

**RHD's flatline is intact** (`hivfix-rhd-finale`). Its radius across all 35
years now spans 0.47 to 1.03 (span 0.56); it spanned 0.68 to 1.37 (span 0.69)
before, so the finale's flat line is if anything flatter. Focus isolation,
in-world sparkline and caption all render as before.

**Natural tour run** (`hivfix-tour-growth-a/b`), tour started at pause 0 and
resumed, frames grabbed by polling the live tour year: 1994.02 -> 1996.00,
HIV radius 4.18 -> 4.96 (4.7 px -> 5.3 px at the overview camera the leg
travels at, 1.14x over two tour-years). Across the whole 1990 -> 1996 leg the
pause is built on, radius goes 3.13 -> 4.96, **1.59x**, against 1.30x before.

### Consumers checked

- **`TourSparkline`** reads `data.maxYearly` as the finale's sparkline
  ceiling. `maxYearly` is still the true global maximum — only the radius
  curve's *knee* is new, and it is returned as a separate `data.knee` — so the
  sparkline ceiling and the radius ceiling stay decoupled and the finale's
  flat line is unchanged. `timeMachineTour.test.js`'s two ceiling assertions
  pass untouched.
- **Methodology panel, "Size mapping" section:** describes only the main
  papers/mortality curve and cites `src/utils/helpers.js` and
  `src/utils/constants.js` explicitly. It never described the Time Machine's
  per-year curve, so it stays truthful with no edit. Verified by reading the
  section and grepping the panel for any Time Machine reference (none).

### Tests

`tests/timeMachine.test.js`: the two `nRY` pins now pass `data.knee`; every
semantic assertion was kept and passes unchanged (covid 2020 > 10x covid
2019, RHD max radius small, the 2020 movers ranking). Four tests added:

1. HIV 1990 -> peak radius ratio >= 2, plus absolute-size floors so a future
   change cannot satisfy the ratio by shrinking both ends into invisibility.
2. COVID is 2020's biggest node, leads #2 by > 1.10x, and its 2019 -> 2020
   jump is the largest year-over-year change in the table by both delta and
   ratio.
3. `nRY` strictly monotone over ~420 sampled counts spanning 0..maxYearly,
   including the three cells straddling the knee.
4. The same invariant against the built table: every (disease, year) cell
   sorted by count, radius never falls, equal counts give equal radii.

Plus a knee test pinning it to `kneeYearly` of the same cells, `< maxYearly/10`,
and the knee landing at 38 percent of the range.

### Verification

- `npx vitest run`: **171 tests, 14 files, green** (166 before, 5 added).
- `npx vite build`: green.
- Shots in `docs/verify/`: `hivfix-1990-before`, `hivfix-2014-before`,
  `hivfix-1990-after`, `hivfix-2014-after`, `hivfix-2020-covid`,
  `hivfix-rhd-finale`, `hivfix-tour-growth-a`, `hivfix-tour-growth-b`.

### Judgement calls worth flagging

1. **The exponent went up, not down.** The brief's cheapest candidate
   (0.5 -> ~0.32-0.38) is directionally wrong for this acceptance criterion,
   for the scale-invariance reason above; the measured table is in this
   report so the reasoning is checkable rather than asserted.
2. **The percentile ceiling is a knee, not a clamp.** The brief described
   "counts above the ceiling clamping to max radius"; that would have broken
   the monotonicity requirement stated three lines later in the same brief
   (COVID and pneumonia would tie in 2020). The linear tail keeps both.
3. **The knee sits at the 90th percentile, not the 97th-99th.** Higher knees
   were computed and are worse on the criterion that matters most after
   HIV: at p95 COVID's 2020 lead drops to 7.6 percent and at p97 to 6.4
   percent, below the 10.5 percent it had before. p90 is the highest-contrast
   choice that leaves the detonation stronger than it shipped.
4. **The mid-range of the galaxy is visibly bigger in the Time Machine now**
   (the 75th-97th percentile of yearly counts grows 35-50 percent; counts
   below the median shrink). That is the dynamic range being handed back, and
   it is bounded: the largest node is still exactly 18, and the normal view's
   own ceiling is 55, so the Time Machine still never looks bigger than the
   galaxy it sits inside.

---

# Round 7, wave 1: the ending restage (addendum 1, section 1)

Implements `docs/direction/2026-08-13-addendum-1.md` section 1 (ending
restage) plus amendments A1 and A3, closing delta-list items 1, 5 and 8.
Sections 2, 3 and 4 belong to later waves and are untouched:
`timeMachineData.js` curve constants, the tour's timeline legs, and
`IntroSequence`/the assembly are all exactly as they were.

## What changed

**The film ends at home.** The shipped sequence was film, then tour, then a
permanent park: the tour set `tmPhase` to `'scrub'`, held the finale's
isolation and caption, and 2.5 s later printed "Scrub the decades." Nothing
ever released it. `FINALE_HANDOVER = 2.5` and that chip are gone from the
automatic path. In their place, `FINALE_HOLD = 2.6` seconds after the
flatline cue, a 2.60 s exit choreography runs and lands the viewer on the
home screen with the Time Machine in the header.

The choreography table lives in `src/utils/motion.js` as `TM_EXIT`, not
inside any one component, because five files read it: the engine, the rail,
the hint row, the header and the tests. Every channel is the addendum's own
offset. `exitDelay(t0, atMs)` recomputes each staged delay against the live
clock on every render, so a component that re-renders mid-exit (a hint
dismissed, a caption cleared) does not restart a delay that has already
elapsed.

**The interrupted-tour exception is intact and now explicit in the code.**
Any input mid-tour still hands the scrubber over at the year on screen and
drops the exit cue, so the rail stays with the viewer until they close it.
The exit only ever runs from a tour that reached its own end untouched.

**Amendment A1, `arrival(x)`.** The addendum's closed form of the world
spring, in `motion.js`, with both endpoints exact rather than approximate.
That is load-bearing: the two blends lerp between the per-year radius and the
settled papers/mortality radius, so an arrival returning 0.999 at x=1 would
leave every node a hair off the mapping on the frame the blend ends. At x=1
the numerator is `1 - Math.exp(-5) * 6` and the denominator
`1 - 6 * Math.exp(-5)`; IEEE-754 multiplication is commutative, so those are
bit-identical and the ratio is exactly 1. `arrival` clamps to [0,1], which is
what makes delta-8's "no radius outside the two endpoints" true by
construction instead of by sampling.

`staggeredArrival(t, L)` applies the morph's existing mass-weighted lag to
that curve. The addendum's exit table names `staggeredEase` while amendment
A1 and the entry blend name `arrival()`; this one function satisfies both
readings, with the same endpoint guarantee (offset/L normalization means
`(1 - LAG_LEAD*(1-L))/L >= 1` for every `L <= 1`).

**Re-entry is an instrument, not a rerun.** The camera does not move; a new
`tm.enter` channel blends radii 0 to 1 over 650 ms under the same lag
factors, replacing the hard swap that was the one ugly cut left in the piece;
the rail comes in on its existing 240 ms expo.out with the playhead parked on
the last year; one runtime-derived chip reads "drag the rail. 1990 to 2024."
with both years off `data.yearStart` and `data.nYears`; and a 9px `#64748b`
"replay the decade story" button at the rail's left end calls
`startTimeMachine(true)`. Closing again runs the same 1.10 s blend home with
no glide and no pulse.

**The second handover is the first.** `easeGlide`, `SEAT`, `handoverSpeed`,
`sramp`, `HANDOVER_LEAD`, `HANDOVER_DECAY` and `REST_ROTATE_SPEED` are now
exported from `OvertureSequence.jsx` and imported by the exit rather than
restated. Additive `export` keywords only; no behavior in the film changed.

**Sound.** `play('release', { gainDb: -4 })` — `synthRelease` gained an
optional `gainDb` trim rather than a second voice.

## Two defects found by the harness, and fixed

1. **The handover decay was truncated.** The driver stopped at the exit's
   2.60 s landing, but the glide ends at 1.75 s and its decay runs a full
   second past that, to 2.75 s. The galaxy was left turning at 0.3203
   instead of `REST_ROTATE_SPEED` 0.3 — a delta-5 failure. The driver now
   separates `landed` (end of the choreography) from `done` (end of the
   driver) and keeps stepping the handover alone through 2.75 s.
2. **The handover ended before it began.** The "no glide to hand over from"
   fallback fired on every frame before the camera channel dispatches at
   t = 0.15, marking the handover finished 1.6 s early. It is now gated on
   `reduced || ex.fired.has('camera')`: before 0.15 s the glide has merely
   not been dispatched yet, which is not the same thing as never existing.

Both were only visible by sampling `controls.autoRotateSpeed` in the browser.
Neither would have been caught by the unit tests, and the second one silently
disabled the entire feature delta-5 exists to protect.

## Two disclosed deviations

- **Story chip stagger.** The table asks for the chrome row to fade in over
  240 ms with a 40 ms per-chip stagger. `StoryChips.jsx` shows and hides the
  whole row with one 400 ms container transition and is outside this wave's
  file set, so the exit stages *when* the row returns (t = 1.30) and leaves
  its existing fade alone. The stagger is a `StoryChips` change, not a
  Time Machine one.
- **`HighlightSystem` dim release.** Implemented, but through a new
  `tmIsoIdx`/`tmIsoDim` pair rather than by ramping `tmFocusIdx` itself:
  `tmFocusIdx` still clears on the exit's first frame exactly as the table
  says (everything else keys off it, including the rail's reticle, which
  should leave with the rail), and the isolation's 480 ms sine.inOut ramp
  outlives it on the new pair. `tmIsoDim` is quantized to 1/50 so the ramp
  costs about thirty instance-color repaints rather than one per frame.

## Verification

`npx vitest run`: **200 passed** (15 files), up from 171. New:
`tests/timeMachineExit.test.js` (20) and 9 added to `tests/motion.test.js`.
`npx vite build`: green.

Unit coverage worth naming: `arrival` is checked against the addendum's
formula transcribed independently in the test, at 201 points; both endpoints
are asserted with `toBe`, not `toBeCloseTo`; the blend endpoint invariant is
asserted for all 153 diseases in both directions; and `finaleExitAt` is
asserted against the flatline cue the built timeline actually carries, plus a
decade-only fallback file.

Browser (`tools/verify.mjs` against :5280, headless Chrome 1440x900):

| check | result |
|---|---|
| **delta 1** — fresh load, `setIntroStarted`, 60 s untouched | **PASS**. `tmPhase 'idle'`, `tmFocusIdx -1`, `tmCaption null`, `sizeMode 'papers'`, `uiRevealed`+`hintsShown` true, `storyVisible` true, `autoRotate` true, `autoRotateSpeed` exactly 0.3, `tm.active` false, `tm.exit` 0, `glowSuppress` 0, `ember` 1. Timeline: tour at 22.1 s, exit at 55.3 s, landed 57.9 s — inside the 60 s window with the *shipped* 33.35 s tour, and wave 2's staircase only widens that margin. |
| **delta 5** — `autoRotateSpeed` after the glide | **PASS**. 0.6003 held from arming (1.45 s) through the end of the glide (1.75 s), then monotone 0.5988 → 0.5919 → 0.5534 → 0.4502 → 0.3470 → **0.3000 at exactly 1.0 s later**. |
| **delta 8** — header re-entry from a custom camera | **PASS**. Camera delta over 1.0 s: **0.000000 absolute, 0.0000% of radius**. `tmPhase 'scrub'`, `tmFocusIdx -1`, chip `drag the rail. 1990 to 2024.`, `tmCaption null` after 2.6 s. Entry blend measured 690 ms against 650 ms specified. Replay button 9px `rgb(100,116,139)`, left edge 460 against the rail track's 460. |
| **interrupted tour** | **PASS**. Input at the finale (`tmFocusIdx 49`) → `'scrub'` + "Scrub the decades." within 60 ms; over the next 10 s (past where the exit cue would have fallen) `tmExitAt` stayed 0, phase never left `'scrub'`, rail still up. |
| **skip during exit** | **PASS**. Input at 0.5 s (`tm.exit` 0.309): mode → `'fast'`, chrome up on the same frame, landed in 253 ms, terminal state byte-identical to a watched exit (camera radius 1120 both ways, `autoRotateSpeed` 0.3, pulse cancelled). |
| **reduced motion** (`--reduced`) | **PASS**. No glide dispatched, camera jumped to the rest seat, three 300 ms dissolves (at 120 ms: `tm.exit` 0.405, `glowSuppress` 0.304; all landed by 520 ms), static ring instead of the pulse. |

Shots in `docs/verify/`: `w1-home-after-60s` (a cold home screen, differing
only by the dismissed Time Machine hint, exactly as the acceptance predicts),
`w1-exit-mid` (rail leaving, `tm.exit` 0.042, `glowSuppress` 0.173 mid-release),
`w1-reentry`, `w1-replay`, `w1-exit-header`, `w1-exit-header-mobile`,
`w1-exit-skipped`, `w1-exit-reduced`, `w1-interrupted-tour`.

Two layout fixes came out of looking at the shots rather than the numbers:
the header micro-line was landing on the filter bar row (moved clear of it,
with a backdrop), and on mobile it hung centred under the Menu button at the
right edge and ran off the viewport (right-anchored there instead).

---

# Round 7, wave 2: cinematic year-scaling (addendum 1, section 2)

Implements `docs/direction/2026-08-13-addendum-1.md` section 2 in full (2.1 the
curve, 2.2 the staircase, 2.3 the accents, 2.4 the acceptance tests), plus
amendment A2 and delta-list items 2, 6 and 7. Sections 3 and 4 belong to later
waves and are untouched: `IntroSequence` and the assembly, camera breathing,
star parallax, tour leg choreography and the resting micro-breathe are all
exactly as they were. Wave 1's exit and entry choreography is untouched except
for the one constant wave 1 handed over (below).

## 2.1 The curve

`src/utils/timeMachineData.js`: `MXY` 18 to **26**, `KNEE_SHARE` 0.38 to
**0.42**, `BULK_EXP` 0.85 to **1.00**. `KNEE_PCT` stays 90 and stays derived at
build time; `MIN_RY` and `ZERO_RY` are unchanged. All four are now exported,
because the methodology panel and the tests read them rather than restating
them.

Measured against `data/diseases.json` as it stands, every figure in the
addendum's own table reproduces exactly:

| | shipped | new | addendum |
|---|---|---|---|
| HIV/AIDS 1990 to 2014 | 3.13 to 7.02, 2.24x, travel 3.89 | **4.22 to 11.10, 2.628x, travel 6.87** | 4.22 / 11.10 / 2.63x / 6.87 |
| HIV at the 1996 pause | 4.96 | **7.34** | 7.34 |
| COVID-19 2019 / 2020 / 2021 / 2024 | 0.69 / 14.13 / 18.00 / 11.28 | **0.68 / 20.75 / 26.00 / 16.87** | same |
| COVID's 2020 lead | 1.1114x, gap 1.42 | **1.1021x, gap 1.92** | 1.102x, 1.92 |
| rheumatic heart disease span | 0.56, 3.1 percent | **0.66, 2.5 percent** | 0.66, 2.5 percent |
| median non-zero cell | 1.63 | **1.93** | 1.93 |
| nodes moving 0.15+ per step, mean | 33.8 | **48.7** | 48.7 |
| per-step delta percentiles | p50 0.057 p90 0.255 | **p50 0.076 p90 0.423 p99 1.068** | same |

The top-3 accent gate is now met on all 34 steps; under the shipped curve 2017's
third mover fell under it at 0.235.

## 2.2 The staircase

`STEP = 0.65` continuous legs are gone. `pushLeg` in `TimeMachine.jsx` builds
every leg out of 360 ms years (240 ms expo.out travel plus a 120 ms dwell), with
three exceptions the addendum names: a single-year leg keeps its 650 ms and the
detonation keeps `back.out(1.2)`; a leg longer than 8 years sweeps its first
S-6 years in 1.30 s on sine.inOut and then ratchets the last 6; the rewind is
unchanged.

The dwell is deliberately **not** a segment. It is the gap between one stair's
`t1` and the next stair's `t0`, which `tourYearAt` already resolves by holding
the previous segment's destination. That keeps the year a step function of the
clock with no special case, and makes "held for at least 120 ms" a property of
the built timeline that a test reads rather than a frame it samples.

Every segment now carries a `kind` and a `rate` in years per second, and
`tourRateAt(segs, t)` reads the rate at any moment (zero in every dwell and
hold). That is accent gate G2's input on the tour. It is deliberately the
segment's average rate rather than the instantaneous derivative of its easing:
expo.out opens at an enormous slope for a millisecond and closes at nearly zero,
so gating on the derivative would suppress the first frame of every stair and
pass the last frame of the rewind. The addendum's own numbers are segment rates,
and the built timeline reproduces them: rewind 26.15, sweep 13.08, stair 2.78,
single-year leg 1.54.

Built timeline, against the boarded one:

| leg or hold | shipped | new | boarded |
|---|---|---|---|
| rewind | 1.30 | 1.30 | 1.30 |
| 1990 to 1996 | 3.90 | **2.16** | 2.16 |
| 1996 to 2019 | 3.90 | **3.46** (1.30 sweep + 6 stairs) | 3.46 |
| 2019 to 2020 | 0.65 | 0.65 | 0.65 |
| 2020 to 2021 | 0.65 | 0.65 | 0.65 |
| 2021 to 2024 | 1.95 | **1.08** | 1.08 |
| six holds | 21.00 | 21.00 | 21.00 |
| **total** | 33.35 | **30.30** | 30.30 |

Manual scrub is untouched: the critically damped 120 ms spring stays, drag stays
analog and continuous between detents.

**Wave 1's concern 4, resolved.** `finaleExitAt` was opening the exit at
`lastPause + FINALE_SPLIT + FINALE_HOLD` = 4.4 s into a 4.5 s finale hold, so the
tour's last 100 ms ran underneath a choreography that had already taken the
frame. Wave 2 owns the holds, and the free variable is `FINALE_SPLIT`, which no
direction document pins: 1.8 becomes **1.9**. `FINALE_HOLD` stays the addendum's
2.6, `TOUR_HOLDS` stays `[3.0, 3.5, 3.0, 4.0, 3.0, 4.5]` summing to 21.00, the
tour still totals 30.30, and `finaleExitAt(tl) === tl.end` is now an identity
asserted in `tests/timeMachineExit.test.js`. No overlap, one constant, and the
cooling line reads 100 ms longer before the flatline takes over.

## 2.3 The accents

All four gates. G1 and G2 are the engine's (`stepAccents` in `TimeMachine.jsx`),
because only the running engine knows where the year is and how fast it got
there; G3 and G4 are `accentPicks` in `timeMachineData.js`, pure over the built
table and therefore unit-tested rather than sampled.

- **Ghost shells** (`src/components/GhostShells.jsx`, mounted in App's Canvas):
  one pooled 8-slot `InstancedMesh`, LRU recycled, one geometry, one material,
  one draw call, `MeshBasicMaterial`, normal blending, never additive, held at
  the radius the node had in the year just left, 0.30 to 0 linear over 480 ms,
  never scaled. `mesh.visible` is false whenever the pool is empty, so the whole
  cost is proportional to the ~1.4 s a year that accents are actually up.
- **Mover ring**: `fireRipple(idx, color)` on rank 1 at `|delta r| >= 1.50`,
  category color on growth and `#64748b` on shrinkage. `SelectionRipple` needed
  no change at all: its `trigger` already takes a color and already starts the
  ring at the node's live Time Machine radius.
- **Year-step settle**: amendment A2's half sine, applied multiplicatively
  inside `tm.radiusAt`, which is the one place a node's Time Machine radius is
  decided. `settleScale` is exactly 1 outside its 240 ms window, so an
  unaccented node's radius is bit-identical to the mapping.
- **Numeral pip**: `TimeRail` computes `accentPicks(data, prev, detent, 1)` on
  its own detent edge, so the rail needs no channel from the engine; on a ring
  step the existing 1-frame 4 percent pip becomes 2 frames at 8 percent.
- **Mover micro-label** (`src/components/ui/MoverLabel.jsx`): rank-1, ring
  fired, and the year still standing on that detent 360 ms later. Both numerals
  are the difference of two file values.

Reduced motion: shells become a single 300 ms dissolve, and rings, settles and
micro-labels are dropped by one branch. The staircase already collapses to
stepped holds through `buildTourTimeline(…, reduced)`.

Tier budgets HIGH 3 / MEDIUM 2 / LOW 1, from `ACCENT_BUDGET[TIER]`.

## 2.1 honesty line 4, and delta 7

`MethodologyPanel` gains a "Time Machine size mapping" subsection.
`timeMachineMapping(data)` is pure and exported for the same reason
`nonDefaultMortalitySources` is: the claim that every numeral is read from the
built table is a unit test, not a promise. The test feeds it a table built from
a third of the counts and asserts every data figure moves while the two curve
constants do not. The panel prefers the live table `TimeMachine` publishes and
falls back to building one.

## Three defects the harness found

1. **A growth ghost was invisible.** With depth testing on, a shell smaller than
   the node it belongs to is inside an opaque sphere, so every growth ghost in
   the piece would have been culled and only shrinkage would ever have read.
   `depthTest: false`, the same deliberate overdraw the 2020 flash already
   makes, and here it is the accent rather than a tradeoff: the old radius stays
   legible in both directions, as a translucent disc of the previous silhouette
   with the new node around it or inside it. `w2-ghost-closeup.png` is the
   proof, a 150px shell on a 247px pneumonia.
2. **The scrub's rate gate dimmed the numeral after every deliberate step.**
   `stepAccents` was publishing one number for two questions. The gate asks how
   fast the twelve months just crossed were travelled, which is a property of a
   completed step; the rail asks whether the numeral is a readable year right
   now, which is instantaneous velocity. On the frame after a crossing the first
   quantity is 1/0.016 s, so the numeral blurred for a third of a second every
   time the viewer stepped a year. The engine now takes both: `gate` and
   `shown`, identical on the tour and different on the scrub (spring velocity).
   Measured after the fix: a deliberate step blurs 0 frames; a full-rail flick
   peaks at 105.5 yr/s, blurs, and fires 0 ghosts and 0 settles.
3. **A seek or a jump fired a shell for a year nobody watched.** Crossings are
   now required to be adjacent (`|detent - from| === 1`), and `clearAccents`
   re-seats the detent on every harness seek, on tour open and on close.

## Two disclosed deviations

- **Per-instance opacity needs a shader patch.** The addendum says "one draw
  call, no shader". A crossing lights up to three shells and the next crossing
  arrives 360 ms later while the previous generation still has 120 ms of fade
  left, so two generations are alive at different alphas by design (8 slots is
  deliberately more than one generation of 3). `instanceColor` multiplies the
  diffuse term only, and fading a normal-blended sphere toward black on a dark
  field reads as a hole rather than a fade. So the stock basic shader carries a
  three-line `onBeforeCompile` injection of an `aGhostAlpha` instanced
  attribute. It is a patch to a built-in program, not an authored shader: no new
  program, no per-frame uniforms, no tier gate, and it behaves identically on
  the LOW path (confirmed: LOW fires exactly one shell per crossing).
- **The ring's ninth year does not exist.** The addendum's ledger lists nine
  ring years including 2004 (obesity). Measured, 2004's rank-1 delta is
  **1.498** against the 1.50 gate: the prediction was right about the year and
  0.002 radius units wrong about the threshold. The addendum also says "do not
  tune the threshold away from it", so the threshold stands at 1.50 and the ring
  fires on eight years, every one of which lands on an outbreak or its
  aftermath (2009 and 2010 influenza, 2014 Ebola, 2016 Zika, and COVID-19's
  2020, 2021, 2023, 2024). The test pins both the eight-member set and 2004's
  1.498, so a data refresh that moves either is visible rather than silent.
  Note that 2014 Ebola sits at 1.502, the same 0.002 the other side of the gate:
  two of the thirty-four steps are knife-edge on this threshold.

## Verification

`npx vitest run`: **237 passed** (15 files), up from 200. New coverage:
`tests/timeMachine.test.js` 15 to 25 (acceptance 1 to 6 and 8, plus the
`accentPicks` gate suite), `tests/timeMachineTour.test.js` 30 to 44 (acceptance
9, the staircase shape, the segment rates, `scrubRate`),
`tests/motion.test.js` 21 to 30 (acceptance 7 and the new constants),
`tests/methodology.test.js` 11 to 15 (delta 7), `tests/timeMachineExit.test.js`
20 to 21 (the resolved overlap). `npx vite build`: green.

Browser (`tools/verify-wave2.mjs` against :5280, headless Chrome 1440x900 unless
noted). Run one task at a time; each owns the session's state.

| check | result |
|---|---|
| **2.4 #10** HIV 1990 vs 2014, frozen camera | **PASS**. Camera drift between the two shots **0.0000 units**. 1990 radius 4.223 -> 3.3px on screen; 2014 radius 11.098 -> 8.8px. On-screen diameter ratio **2.627** against a 2.50 gate (radius ratio 2.628, so the projection is not flattering it). Shots `w2-hiv-1990`, `w2-hiv-2014`. |
| **2.4 #11** COVID largest silhouette in 2020 | **PASS** on both. Desktop: covid-19 20.75 / 15.5px, ahead of heart-disease 13.4px and pneumonia 12.6px. Mobile 375x812 (LOW tier): covid-19 8.1px, heart-disease 7.1px, pneumonia 6.9px. Largest by radius and by projected silhouette in both. Shots `w2-2020-covid`, `w2-2020-covid-mobile`. |
| **2.4 #12** three shells at +200 ms, none at +600 ms | **PASS**. 2019 -> 2020: 3 shells, alphas 0.170 / 0.170 / 0.170 at crossing + 200 ms (0.30 x (1 - 200/480) = 0.175), **0 live at +600 ms**. 2021 -> 2022: same. Shots `w2-ghosts-mid` (captured with the shells aged 85 to 209 ms), `w2-ghosts-mid-crop`, `w2-ghosts-gone` (0 live), `w2-ghost-closeup`. |
| **tour length**, wall clock | **PASS**. **30.31 s** measured from `startTimeMachine(true)` to the exit opening, against 30.30 boarded and a 31.0 gate. |
| **staircase + sweep** | **PASS**. Mid-sweep: rate **13.08 yr/s**, numeral computed opacity **0.55**, filter **blur(0.6px)** (`w2-sweep`). First stair: rate **2.78**, opacity **1**, filter **none** (`w2-staircase`). Measured dwells across the 2013 to 2019 staircase: 108, 108, 109, 117, 117 ms at 60 Hz sampling (120 ms boarded; the sampler can miss a frame at each end), then 633 ms and climbing as the 2019 pause takes over. |
| **accents 3, 4, 5** | **PASS**. Settle multiplier on COVID at the 2020 crossing: peak **1.04496** (spec 1.045 at rank 1), floor 1.00000, and it returns to **1.000000000000** with 0 settles live. Numeral pip: exactly **2 frames at brightness(1.08)**, 0 blur frames. Micro-label: `COVID-19 +94,344 papers`, 9px, up at crossing + 369 ms (`w2-mover-label`). |
| **gate G2, the flick end** | **PASS**. A throw across all 34 years peaks at **105.5 yr/s**, blurs the numeral for 92 frames, fires **0 ghosts and 0 settles**, and restores to `filter: none` at rest. |
| **LOW tier budget** (`--mobile`) | **PASS**. Exactly **1** shell per crossing, both directions. |
| **reduced motion** (`--reduced`) | **PASS**. Shells lit, 3 live at +200 ms, **0 by +320 ms** (the 300 ms dissolve), and **0 settles ever live**, no ring, no micro-label. |
| **delta 7**, methodology | **PASS**. Subsection renders knee 7,238 at the 90th percentile, exponent 1.00, share 42 percent, ceiling 26 against the cumulative 55, naming `src/utils/timeMachineData.js` (`w2-methodology-tm`). |
| **wave-1 delta 1 regression**, 60 s untouched | **PASS**, and with more room than before. Tour opens at 22.0 s, exit at **52.3 s**, home at **53.7 s** (was 57.9 s with the 33.35 s tour). At t = 60 s: `tmPhase 'idle'`, `tmFocusIdx -1`, `tmCaption null`, `sizeMode 'papers'`, `uiRevealed`/`hintsShown`/`storyVisible` true, `autoRotate` true, `autoRotateSpeed` exactly **0.3**, `tm.active` false, `tm.exit` 0, **0 ghosts, 0 settles**, `tm.rate` 0, `glowSuppress` 0, `ember` 1 (`w2-home-after-60s`). |

## Concerns for later waves

1. **The tour frames its own subject small.** At the 1996 HIV pause the camera
   sits at radius 1776 and HIV is 5.7px across; at 2014 it would be 8.8px. The
   curve did its part (the same node was 3.9px and 5.5px before), but the
   remaining half of "year deltas read as change" is camera distance, and
   section 4 item 3 (tour leg choreography: a 3 percent dolly per leg, 6 percent
   on a sweep) is where that gets paid. Wave 4 should measure on-screen
   diameters at the pauses, not only radii.
2. **The ghost shell is a quiet accent at tour framing.** It peaks at alpha 0.30
   and the median accented node's shell differs from its node by 14 percent of
   radius, which at 10 to 15 screen pixels is a few pixels of rim. It reads
   clearly at close range (`w2-ghost-closeup`) and on the loud steps (COVID
   2020 is 30x, Zika 2016 is 9.3x, Ebola 2014 is 4.5x); it is nearly invisible on the
   quiet ones. Concern 1's dolly is the same fix.
3. **Two of the 34 steps are knife-edge on the ring threshold** (2004 at 1.498,
   2014 at 1.502). The weekly PubMed refresh can flip either. The test pins both
   so the flip is loud, but a future wave may want the ring gate expressed as a
   percentile of the step-delta distribution rather than an absolute.
4. **The micro-label fires three times on the tour, not twice.** The addendum
   predicted 2023 and 2024; the literal rule (rank-1 + ring + the year still
   standing 360 ms later) selects **2020, 2021 and 2024** and rejects 2023,
   whose dwell is 120 ms. The rule is implemented as written rather than tuned
   to the parenthetical. If the intent was to keep the label off the narrated
   pauses, the extra gate belongs in wave 3 or 4, not here.
5. **`docs/verify` now holds 13 `w2-*` shots.** That directory is gitignored, as
   it was for wave 1, so the frames are local evidence rather than repository
   state. `tools/verify-wave2.mjs` is committed and regenerates any of them in
   one command, which is the reproducible half.

---

# Round 7, wave 3: the fly-in assembly

ADDENDUM 1 section 3 in full, amendments A1/A3, delta-list item 3 and the
first-frame/skip halves of item 10. The wave the client asked for by name:
"maybe nodes fly in like the space."

Branch `next/showcase`, one commit. `main` untouched, nothing pushed.

## What landed

**`src/utils/assembly.js` (new, pure).** The whole flight as math: two
deterministic index hashes (never `Math.random`, so beat 0 is byte-identical on
every load and seekable), the ten category entry vectors on a Fibonacci sphere
with the -25/+55 degree elevation clamp, `makePlan` (spawn, bezier control
point, launch time, flight duration per node), `flightAt` (one node's complete
state at any assembly time), `forceLand` (the skip's 0.5 s fast-forward),
`assemblySeat` (the camera channel) and `fogRangeAt`. Nothing in it touches
THREE, the store or the DOM, which is what turns the addendum's acceptance
items into 38 unit tests instead of pixel comparisons.

**`src/components/AssemblyFlight.jsx` (new).** The driver, mounted *before*
`DiseaseNodes` and running at `useFrame` priority -1 (after `IdleDrift`'s -2,
before `DiseaseNodes`' 0). It publishes `sceneRefs.assembly` — this frame's
per-node position, scale multiplier, comet quaternion, stretch and brightness —
and owns the filaments (one `LineSegments`, one draw call, 153 tangent tails
rewritten per frame, dead at beat 1, all tiers). It also owns the beat-0 clock
and publishes it, so `IntroSequence`'s phases and the flight can never disagree
about what time it is.

**Ownership.** `DiseaseNodes`' matrix loop remains the sole writer of every node
matrix on every frame in every mode. While `assembly.active` it composes from
`assembly.pos` instead of `curPos`, uses `assembly.radius` as its scale
multiplier in place of the old staged intro ramp, and applies the quaternion
plus a non-uniform scale on local +Y (the axis the quaternion was built to
align with the velocity). When it is false — which is the whole rest of the
session — not one line of that loop behaves differently from before this wave.
The quaternion and the non-uniform scale exist only while a node is in flight.
`IdleDrift` is `introPhase >= 5`-gated and therefore inert for all of beat 0;
verified, unchanged.

**Brightness channel.** New `aFlight` instanced attribute through
`plasma.vert/frag` and `pulse.vert/frag`, applied as the last multiply before
`gl_FragColor`, exactly 1.0 outside beat 0. LOW rides `instanceColor` scaled
from a captured base-color table and restored exactly on landing.

**Everything else in section 3.** Camera seat 2.9 R0 elevation 12 drifting to
1.5 R0 over 5.2 s sine.inOut with the 2.5 degree azimuth counter-drift, its
direction *derived* from the layout (`curlSign` = the mean sense of the ten
bows about the vertical) rather than chosen. HIGH-only dust settle (3 percent
inward on the group's own scale, 0.4 percent per second rotation bump, back to
the resting rate by 5.6 s, zero new objects). Moment 1 rewritten: bed in over
1.0 s, ten harmonic partials one per stream launch across 1.44 s, the soft
consonance plus a -18 dB low thud on the last giant's landing at 4.99 s.
`GlowSprites` follow the flight position and its brightness while it is live
(otherwise the biggest halo in the galaxy sits at an empty seat while its own
node is still visibly two-thirds of the way there). Beat 0's budget is 5.2 s and
`IntroSequence`'s intermediate thresholds moved with it (each old value times
5.2/4.0); phase 5 still means "beat 0 is over".

## Two deviations, both forced by the data, both documented in code

**1. Stream launch order is derived, not legend order.** The addendum launches
the streams "in legend order" and then states the result: "the last thing to
land is the biggest thing", latest arrival 4.99 s, "and then 210 ms of
stillness". Those cannot both hold on this table. The launch spread is 1.44 s
and the entire flight-duration range is 1.15 s, so the galaxy's largest node can
only land last if its category happens to launch last — and the largest node
here is Heart Disease, whose category is third in legend order. Implemented
literally, the assembly ends at **4.50 s** with the giant landing 0.64 s
earlier: a 700 ms dead hold at the end of beat 0 and no "biggest thing last".

So the launch *slot* is the one transcribed number that became derived: the ten
streams still launch 0.16 s apart with the last at 1.44 s, but they are ordered
by their own heaviest member, lightest first. Mass grows through the assembly,
the giant is in the last stream, and the measured result is **latest arrival
4.983 s, last lander = Heart Disease = the largest node in the galaxy,
stillness 0.217 s** — against the addendum's 4.99 and 210 ms. The shape the
addendum described is now true by construction on any table, including after a
weekly PubMed refresh that reshuffles which category is biggest.

**2. A spawn-shell floor at 3.4 layout radii.** `S = P * K + D_c * camDist *
0.85` cannot deliver "0 instances inside 2.0 R0" for nodes near the layout's
centre: the hero sits exactly at the origin, so its spawn would be the category
offset alone — 0.85 R0, deep inside the galaxy it is supposed to be falling
into. 31 of 153 were inside the gate. Spawns below the floor are pushed out
along their own spawn direction to 3.4 layout radii, which is the addendum's own
prose ("spawn distances between roughly 3.4 and 5.2 times the layout radius")
made true for all 153 rather than for the 122 that already satisfied it.
Measured desktop shell: **2.43 to 4.32 R0**, 0 inside 2.0 R0, 0 outside 6 R0.

## Two defects found by the acceptance shots, both fixed

**The fog rendered the entire spawn shell black.** The node shaders' atmospheric
fog is tuned for the settled galaxy (0.6 to 3.0 layout radii). Every spawn is
3.4 to 5.2 radii out with the camera 2.9 R0 behind that, so the first painted
frame had all 153 instances present, correctly placed, correctly scaled — and
fogged to pure black. The shot proved it: **40 pixels above 12/255 in a 1440x900
frame.** A frame with nothing in it is exactly what "nothing appears from
nothing" forbids. `fogRangeAt` opens the range to cover the shell and contracts
it back to the settled one over the last 600 ms of beat 0, landing on the exact
resting values at t = 5.2 so beat 1 is byte-identical. During a skip the
assembly clock rides the same `arrival()` curve the nodes do, so the fog
fast-forwards with them instead of snapping.

**52 of 153 spawns began beyond the camera's far plane.** `far` was `camDist *
4`; the worst spawn is 7.2 R0 from the opening seat. Those instances were
hard-clipped and then *popped into existence* as they crossed the plane — the
literal defect this wave exists to remove. `far` is now `camDist * 8`. It also
un-clips the background star shell, which lives at 4.0 to 5.2 R0 from the origin
and had always been partly cut. On-screen instances at t = 0 went from 20 to 68,
and the first frame from 40 to 1,134 pixels above 12/255.

## Verification

`npx vitest run`: **275 passed** (16 files), up from 237. New file
`tests/assembly.test.js`, 38 tests: hash determinism and plan reproducibility,
the ten entry vectors and the per-stream chirality, first-frame integrity
(153 present at exactly 0.55 radius at their spawns, 0 inside 2.0 R0, 0 outside
6 R0), the timing table, `arrival()` monotonicity on the flight driver, radius
0.55 to exactly 1.00 with no overshoot and no regression, stretch capped at
1+1.8 and exactly 1.000 by p = 0.92, every quaternion identity at beat 1 frame 1,
the brightness ramp and the pip's exact return to 1.000, filament velocity
scaling and death on both sides of the flight, skip integrity (identity stretch
and quaternion from the first fast-forward frame; the terminal state written,
not lerped, so every node lands on its seat exactly), the camera seat, the fog
range and the far plane. `npx vite build`: green.

Browser (`tools/verify-wave3.mjs` against :5280, headless Chrome, 1440x900
unless noted). Run one task at a time. Every geometric assertion is read off the
live `instanceMatrix` array, not off the driver's own arrays.

| check | result |
|---|---|
| **delta 3** seek set, desktop (0.0 / 1.6 / 3.2 / 4.9 / 5.0 / 5.2) | **PASS**. t=0: 153 present, **0 inside 2.0 R0**, 0 rotated, shell 2.43..4.32 R0, camera 2.9 R0, desat 1.00. t=1.6: 146 in flight, 146 stretched (max **2.80x**, the cap), 146 filament segments. t=3.2: 102 in flight / 51 landed, 43 still stretched. t=4.9: **1 in flight — the giant**. t=5.0: giant down, its landing pip live at **1.271**. t=5.2: 0 rotated, max anisotropy 1.000, 0 filaments, phase 5. Shots `w3-assembly-*`. |
| **delta 3** seek set, portrait 375x812 (LOW) | **PASS on every gate except the literal 2.0 R0 one**, which is a desktop measurement: R0 is camDist and portrait's camera sits 2.4 layout radii out instead of 1.4, so the same shell is 1.42..2.86 R0 there and 104 instances read as "inside 2.0 R0". The scale-free form of the same promise (no spawn inside 3.4 layout radii) holds on both and is unit-tested. Everything else matches desktop: 146 stretched at 1.6 s (max 2.80x), 146 filaments, giant alone in flight at 4.9 s, clean at 5.2 s. Shots `w3m-assembly-*`. |
| **first frame**, played rather than seeked | **PASS**. 153 present, 0 inside 2.0 R0, 0 rotated, camera 2.9 R0, desat 1. `w3-assembly-firstpaint`. |
| **skip at t = 1.0 s** | **PASS**. 90 nodes in flight and 90 non-identity quaternions at the input; two frames later, on beat 1's first frame: phase 5, **0 non-identity quaternions**, max anisotropy **1.000**, 0 filaments. At +0.5 s: 0 in flight, assembly inactive, **worst distance from any node to its seat 0.0000**. |
| **FPS during the 5.2 s window** | **120 fps** headless and **120 fps headed** on HIGH desktop (gate 55); **118 fps** on `--mobile` LOW portrait (gate 30). The headless caveat from earlier waves applies to the headless number; the headed run is the on-display one. |
| **the film after the longer beat 0** | **PASS**. Phase 5 at **5.20 s** after dismissal; beats 1/2/3 at 5.2 / 10.2 / 17.2; release end at **21.70 s**. Film length beat 1 to release end **16.50 s**, exactly as boarded, and 21.7 s is the addendum's own stated total. |
| **reduced motion** (`--reduced`, both viewports) | **PASS, unchanged from today**. Phase 5 on the first frame, driver `dead: true` and never active, all 153 seated at full radius, 0 filaments, camera at the 1.5 R0 beat-1 seat. |
| **wave-1 delta 1 regression**, 60 s untouched | **PASS**. `tmPhase 'idle'`, `tmFocusIdx -1`, `tmCaption null`, `sizeMode 'papers'`, `uiRevealed`/`hintsShown`/`storyVisible` true, `autoRotate` true, `autoRotateSpeed` exactly 0.3, `tm.active` false, `tm.exit` 0, 0 ghosts, `ember` 1, `glowSuppress` 0, camera at 1.000 R0. Beat 0's driver inert (`active` false, `dead` true, 0 in flight, 0 filaments, max stretch 1). Budget is now 5.2 + 16.5 + 1.5 + 30.3 + 2.6 = **56.1 s**, the addendum's own figure, with 3.9 s of home before the 60 s mark. `w3-home-after-60s`. |

## Visual verdict on the 1.6 s and 3.2 s frames, honestly

**1.6 s: it reads as a meteor shower falling inward. It does not read as ten
distinguishable ribbons.** About forty stretched comet ellipses are visible
across the frame, each with a faint curved filament tail, and their directions
are consistent enough that the whole frame reads as matter converging on a
centre. A 3x-brightened crop (`w3-assembly-1p6-crop`) shows the mechanism
clearly: a long, gently bowed tail behind a visibly elongated node. But the ten
streams overlap heavily in screen space from the 2.6 R0 seat, so the viewer sees
one shower from many directions rather than ten ribbons — the grouping the
addendum promises ("ten streams, not 153 darts") is true in the geometry and weak
in the projection.

**3.2 s: this one lands.** The galaxy has taken its recognizable shape, roughly
a third of the field is still arriving, and two or three late comets are still
visibly stretched at the frame's edge. It reads unmistakably as assembly rather
than as a switch being thrown, which is the note the client actually raised.

**The frame is dark, by design and to a degree that is worth a decision.** Beat
0 runs at `desat = 1` with node brightness climbing from 0.35, so mean frame
luminance is 0.04/255 at t=0, 0.23 at 1.6 s, 0.86 at 3.2 s and 3.6 at 5.2 s.
The old assembly was brighter mid-beat because nodes popped in at full radius
and full brightness near the centre. The trade is the addendum's own ("the
fly-in is monochrome, which is precisely what makes the color arrival the
reward"), and the two fixes above recovered most of what was recoverable
without touching a spec'd number. If the client wants beat 0 brighter, the one
honest knob is `ASM.brightMin` (0.35) and the fog's `fogNear0`/`fogFar0`;
everything else is load-bearing.

## Concerns for wave 4 and beyond

1. **The ten streams do not separate visually.** The addendum's mechanism for
   "ten ribbons" is the per-category bow direction, which gives a shared
   *chirality* about each stream's axis rather than a shared direction, and the
   category offset (`D_c * camDist * 0.85`) is small next to the spawn spread
   (`P * K`, up to 4.3 R0). The streams are real in the geometry and in the
   launch timing; they are not legible in the projection. If the client wants
   the ribbons to read, the lever is the category offset, not the curl.
2. **Four nodes spawn behind the opening camera** (of 153) and enter frame from
   the edges. The elevation clamp keeps whole *streams* from entering from
   behind, which is what section 3 asks for, but individual members of a stream
   whose seats are far off-axis can still land behind the seat.
3. **68 of 153 instances are inside the frustum at t = 0**; the rest enter from
   off-frame during the flight. That is honest comet behaviour rather than a
   pop, and the stated acceptance is about instance state (which passes), but it
   is worth knowing that "all 153 in the first painted frame" is true of the
   scene and not of the screen.
4. **The far-plane change (`camDist * 4` to `* 8`) is global.** It fixes real
   clipping of both the spawn shell and the star shell, and depth precision is
   dominated by `near: 1` rather than by far, but any wave that touches depth
   sorting should know it moved.
5. **`docs/verify` now holds 16 `w3-*`/`w3m-*` shots** plus three brightened
   crops. That directory is gitignored, as in waves 1 and 2;
   `tools/verify-wave3.mjs` is committed and regenerates any of them.

---

# Round 7, wave 4: more motion, everywhere it is cheap

ADDENDUM 1 section 4 (all five ranked ambient upgrades), amendment A4,
delta-list item 4 (nothing on screen is ever perfectly still) and delta-list
item 10 (skip integrity under all the new motion), plus the two carried notes
from waves 2 and 3. Waves 1-3 landed first: the film ends at home, the tour
ratchets with accents, the galaxy assembles itself.

## What landed

**1. Camera breathing on every hold** (`CameraRig.jsx`, `utils/motion.js`).
An additive offset applied after all tweens, about whatever the controls are
looking at: azimuth +-0.45 deg at 0.055 Hz, elevation +-0.25 deg at 0.083 Hz,
radius +-0.6 percent at 0.037 Hz. In millihertz the three are 55, 83 and 37 —
pairwise coprime, so the pattern's exact repeat period is 1000 s against a 56 s
piece and it cannot loop inside a viewing.

The bookkeeping is the cursor parallax's, one block down in the same frame loop:
hold the offset that was applied, remove it, compute the next, add it.
`OrbitControls.onStart` kills it for the session exactly as it kills the
handover, and the offset is left where it stands rather than snapped out, which
is what makes that a stop rather than a jump.

Three stillnesses are directed and stay absolute (A4): beat 2's ignition hold,
the detonation push-in, and any active fly. The last two are one test —
`gsap.isTweening(camera.position)` — because every camera move in this piece is
a gsap tween on that object, and a tween owns the position outright, so the rig
forgets its offset rather than subtracting it out from under one. Off is
instant; on eases back over ~0.5 s, since an offset re-applied whole on the
frame a fly lands would be a visible step.

**2. Star parallax, three shells** (`BackgroundParticles.jsx`). `CFG.particles`
split 0.30 / 0.45 / 0.25 into 120 / 180 / 100 points at 2.8 / 4.0 / 6.2 times
`camDist` (+-6 percent of shell thickness, so a shell is not a shrink-wrap),
turning at 0.00090 / 0.00040 / 0.00015 rad/s off the frame delta so the parallax
is the same on a 60 Hz and a 120 Hz display; sizes 2.2 / 1.5 / 1.0, colors
`#3b4a63` / `#334155` / `#232f42`. HIGH gets a per-point twinkle through a small
points shader whose size attenuation reproduces `pointsMaterial`'s own
(`size * (scale / -mvPosition.z)`), so a tier switch is not a size change;
MEDIUM keeps `pointsMaterial` and gets parallax only; LOW's budget is 0 and the
component returns null. Beat 0's dust settle still rides the parent group's
scale, so it moves all three shells as one volume.

**3. Tour leg choreography** (`TimeMachine.jsx`). One `camera-leg` cue per leg,
executed as one extra `flyTarget`: 4.0 degrees of truck and 3 percent of dolly
across a staircase, 9.0 degrees and 6 percent across a sweep, both sine.inOut,
both about the controls' current target rather than the origin — so a leg that
leaves a pause framed on HIV orbits HIV instead of snapping the target home. The
dolly is released at the pause because the pause's own camera cue fires on the
frame the last stair lands and overwrites the tween; that is what "the existing
per-pause cues are unchanged and still win" means in code. Single-year legs
(2019-2020, 2020-2021) get nothing: the detonation is its own gesture. A seek
never replays a leg cue (it is relative to a camera that no longer exists);
reduced motion never builds one.

**4. Resting galaxy micro-breathe** (`DiseaseNodes.jsx`). +-0.8 percent of
radius at a per-node frequency between 0.10 and 0.16 Hz, read off the `aPhase`
attribute the geometry already carries, applied as one multiply inside the
matrix compose that already runs every frame. Off wherever scale is carrying a
meaning: the Time Machine (including its exit blend, which is still year
radius), beat 2 (where every radius is the morph), beat 0 (where the flight owns
radius), and the selected node. Off on LOW and under reduced motion.

**5. Edge shimmer during the film** (`EdgeNetwork.jsx`, `edge.vert.glsl`,
`edge.frag.glsl`). A global opacity breathe from 0.06 to 0.13 at 0.2 Hz, film
only, with a per-vertex phase wave on HIGH and MEDIUM travelling outward from
the galactic centre (`vRad = length(position) / uR0`, `uR0` measured off the
layout's own extent on the first frame that has positions). The film alpha is a
floor under the hover neighborhood's alpha and never a lift on it — `max()`, not
`+` — so the existing 0.1-to-0.35 rise is untouched. It eases out with beat 2's
palette rather than cutting, and at rest it is exactly 0.

## The two carried notes, answered

**(a) The HIV pause now frames its own growth.** The two HIV push-in factors are
swapped: the surge takes 0.62 and the fade takes 0.80, where the shipped pair
was 0.80 then 0.62. The surge is the pause whose caption claims growth, so it
takes the deeper push; the product is preserved exactly
(0.62 x 0.80 = 0.80 x 0.62), so the 2019 close-up, which was never the defect,
is framed where it always was. Measured on the **played** tour, not a seek —
a pause's framing is the sum of every leg dolly and every earlier push-in the
camera inherited on the way there, and a seek replays only the last camera cue:

| | before | after |
|---|---|---|
| HIV at the 1996 pause | **12.7px** (camera 0.45 R0, 902 units out) | **17.0px** (camera 0.32 R0, 673 units out) |
| HIV at the 1990 pause, where the leg starts | 4.3px | 4.3px |
| HIV at the 2019 pause | 56.6px | 69.2px |

So across the 1990-to-1996 leg the node goes 4.3px to 17.0px on screen while the
data grows 1.74x: the camera stops hiding the curve. Judged honestly on
`w4-hiv-pause-1.png`, HIV is now a legible teal sphere under its own label with
the field still readable around it, where before it was a 4px dot under a
caption claiming it had climbed. It is still not a large node — the 1996 galaxy
is genuinely small — but the growth reads.

**(b) Ghost shells at tour framing.** No shell code changed, as instructed. The
closer tour camera from (a) plus the per-leg 3 percent dolly are the whole
answer: the 1996 pause is 25 percent closer than it was, which is 25 percent
more shell.

## Two disclosed deviations

1. **The far plane moved again, `camDist * 8` to `camDist * 9.6`** (`App.jsx`).
   Wave 3 raised it to 8 for the spawn shell; the outermost star shell reaches
   6.57 R0 from the origin, so from beat 0's 2.9 R0 seat its far hemisphere
   needs 9.47 R0 of depth. At 8 R0 part of that shell was cut, and a backdrop
   with a hole in it during the assembly is the one frame where the eye has
   nothing else to look at. `near` stays 1, so the depth ratio moves 12,000:1 to
   14,400:1 — no measurable change to the precision the nodes, all inside 2 R0,
   actually use. Harness-confirmed: 0 of 400 stars beyond the plane from the
   deepest seat.

2. **Camera breathing and the node micro-breathe are off under
   `prefers-reduced-motion`.** Section 4 does not name reduced motion, but the
   film's reduced path replaces every camera move with stillness, and an ambient
   drift underneath it would be the one motion that preference could not turn
   off. Star rotation and edge shimmer stay: the star field already rotated
   under reduced motion before this wave, and the shimmer is an opacity channel,
   not a move. Verified: camera delta exactly 0 across a reduced held frame,
   node scale drift exactly 0 percent at rest, edge alpha 0.

## Verification

`npx vitest run`: **301 passed** (275 before this wave; +18 in a new
`tests/ambient.test.js`, +8 in `tests/timeMachineTour.test.js`).
`npx vite build`: green. New harnesses: `tools/verify-wave4.mjs` (tasks
`breathe`, `stars`, `hiv`, `microbreathe`, `shimmer`, `fps`) and
`tools/verify-fuzz.mjs`.

**delta-4, camera breathing** (`verify-wave4.mjs breathe`):
- 2020 pause, played, two shots 1.5 s apart: **0.541 percent of R0** — inside
  the (0.2, 1.0) band. PASS.
- The same pause frozen with the rest rotation zeroed, three consecutive 1.5 s
  gaps: 0.182 / 0.218 / 0.319 percent. Reported as a diagnostic, not the
  acceptance: with every other channel removed what is left is three
  incommensurate sinusoids, and a window straddling a common turning point reads
  lower than one that does not.
- Beat 2's ignition hold, 1.5 s apart: **|delta| = 0 world units, exactly**.
  PASS.

**Star shells** (`stars`): 120 / 180 / 100 points at 2.63-2.96, 3.76-4.24 and
5.84-6.57 R0, sizes 2.2 / 1.5 / 1.0, `ShaderMaterial` (the twinkle) on HIGH;
0 of 400 stars beyond the 9.60 R0 far plane from the 2.85 R0 assembly seat, and
7.74 R0 furthest from the rest seat. Across a 10 degree orbit the median screen
travel per shell is **67.4 / 82.6 / 96.4 px**, monotone in shell radius, near-to-
far separation **1.43x**. The sign is the opposite of walk-past parallax because
the camera orbits the origin rather than translating: a shell at infinity would
sweep the full 10 degrees of view (150px) and the shell the camera orbits inside
sweeps least. Three distinct rates is the point. `--mobile`: 0 shells, LOW's
budget is 0 and stays 0.

**Micro-breathe** (`microbreathe`, at the real home screen 60 s in, not the
22 s window before the tour arms): 146 of 153 nodes changed scale across 3 s;
largest change **1.609 percent** trough-to-peak against a ceiling of
2A/(1-A) = 1.613 percent, i.e. an amplitude of **0.798 percent of radius**.
Inside the Time Machine, worst scale drift across 1.5 s at a held pause:
**0.0000 percent**.

**Edge shimmer** (`shimmer`): film alpha over a full 6 s sample runs
**0.060 to 0.130**, both ends of the boarded band, at 0.2 Hz; per-vertex wave
uniform 1 on HIGH; at rest, after `overtureDone`, alpha is exactly **0**.
`w4-shimmer-film.png` and `-b.png` are two frames of the same frozen beat-1
moment 1.25 s apart: the net is visibly lit differently in each.

**FPS** (`fps`, one linear pass, no seeks): desktop HIGH **120 / 120 / 120** fps
(film / tour / rest) headless and **120 / 120 / 120** headed; `--mobile` LOW
**119 / 120 / 120**. Same caveat waves 2 and 3 filed: this machine's ceiling is
120 and neither headless nor headed Chrome here is a phone. What the numbers
establish is that no ambient channel introduced a stall.

**FUZZ, delta-10** (`tools/verify-fuzz.mjs`, 40 clicks evenly spaced 0.0 to
56.1 s, each on its own page load, two browsers): **40/40 green, 0 retries.**
Structural group, three seconds after each click: 40/40 (no node in flight, no
filament left drawn, every quaternion identity and every scale isotropic,
`tm.exit` in {0, 1}, no live ghost, 153 of 153 instances present, no page
errors). Narrative group, once the sequence the click landed in finished: 40/40
(chrome up, thesis caption seen at least once). Terminal states: 14 at
`tmPhase: 'idle'` (the piece ended at home), 21 at `'scrub'` (clicks during the
tour, which is the documented exception — an interrupted tour is not a park),
5 with the tour still playing at the moment the narrative pair came true.

**Regression** (`verify-wave3.mjs delta1`): 60 s untouched still ends at home —
`tmPhase: 'idle'`, `tmFocusIdx: -1`, no caption, papers sizing, chrome up,
`autoRotate` true at 0.3, 0 ghosts, the assembly driver dead, camera at
**0.999 R0** (the breathing does not move it outside the 3 percent gate).

## Concerns

1. **The edge shimmer is a real change to beat 1's look.** The whole 736-edge
   net is now faintly visible during the film where before it was invisible
   until hover. It is at the addendum's own numbers (0.06 to 0.13) and it reads
   as structure rather than noise, but it is the one item in this wave a viewer
   would notice as *new content* rather than as life. The knob is
   `AMBIENT.edge.lo`/`hi`.
2. **Camera breathing is killed permanently by the first `onStart`**, per "killed
   by `OrbitControls.onStart` exactly like the handover". A viewer who orbits
   once never sees breathing again in that session, including at every later
   idle. That is literal to the spec and it is also the safe reading (never add
   motion under a hand on the mouse), but if the intent was "pause while the
   viewer drives", the change is one line.
3. **The leg dollies compound with the pause push-ins.** The 2019 HIV pause is
   about 18 percent closer than before this wave (56.6px to 69.2px), from the
   sweep's 6 percent plus the staircase's 3 percent plus the deeper surge it now
   inherits. It still frames well; a sixth pause, or a longer tour, would want
   this watched.
4. **`verify-fuzz.mjs` cannot be trusted while the tree is being edited.** Vite
   full-reloads every open page when any project file changes, which resets the
   fuzz recorder mid-assertion and reads as "chrome never came up". Two earlier
   passes scored 12/40 and 38/40 for exactly that reason. The harness now stamps
   a session id and treats a lost document as an infrastructure event to retry,
   but the operational rule is simpler: do not touch the tree while it runs.
5. **`docs/verify` now holds 13 more `w4-*`/`w4m-*` shots.** That directory is
   gitignored, as in waves 1-3; `tools/verify-wave4.mjs` regenerates any of them.

---

**Direction-conflict fix: camera breathing resumes at idle.** Wave 4's camera
breathing (`src/components/CameraRig.jsx`) read `OrbitControls.onStart` too
literally, killing the ambient offset on the viewer's first drag and never
clearing the `killed` flag, so one drag anywhere in the session silenced
breathing for good, contradicting ADDENDUM 1 section 4 item 1's own list of
eleven holds that must never sit perfectly still, which names "scrub at rest,
idle" — a state that only exists after an interaction ends. Fixed by clearing
`killed` on the exact frame `idleFrames` crosses the same 300-frame threshold
that already flips `autoRotate` back on (the identical counter, reused so the
two always return together), then ramping the offset back in over a new,
slower ~2s curve (`breatheResumeGain`, a pure function in `src/utils/motion.js`)
rather than the block's usual ~0.5s snap-back; the three absolute suppressions
(ignition hold, detonation push-in, any active fly) are untouched. `npx
vitest run`: 305 tests, 17 files, all pass (+4 new, pinning the ramp's shape).
Verified live with a headless-Chrome harness in the `tools/verify-wave4.mjs`
family (not committed): a real `'start'` event dispatched on
`window.__scene.controls` at the true rest/idle state kills `autoRotate`
immediately and it resumes on its own with no further input; two
camera-position samples 1.5s apart afterward (rest-state autoRotate spin
zeroed first, to isolate breathing the same way `verify-wave4.mjs`'s own
`breathe()` task does) differ by 0.335% of R0, inside the required (0.2%,
1.0%) band. One commit, `fix(motion): camera breathing resumes at idle like
autoRotate`.

---

# Round 8: the round-5 gate's ranked fix list (items 1-8)

Round 5 certified 9.16/10 and returned one major and eleven minors as a ranked,
finite change list. This is that list executed, on `next/showcase`, in one commit.
Every claim below is a number this session measured, not an intention.

## The finding under the finding (items 1 and 3)

Three of the eight items turned out to be one defect wearing three hats, and
finding that is what made the fix small. The tour's pause framings were
*relative*: `camera-node` computed a radius as `cam.position.length() * factor`,
i.e. it used the camera's distance from the ORIGIN as its distance from the NODE,
and then compounded that across pauses. By 1996 the camera sat 502 units out
inside a layout of radius 803; by 2020 it sat at 133, deep in the core, with
hypertension 70 units off the lens rendering 128 px against the ringed, captioned
COVID-19 node's 50. The 2021 peak was clean only because it had already been
patched with a factor-less recenter, and its comment says exactly why: "a
relative pull from wherever the camera happens to be would inherit the tour's
compounded push-ins instead of the designed overview distance."

So the fix is one rule, applied to all three: **a pause frames its subject from
outside the layout, on the subject's own ray.** A new `seat` field on the
`camera-node` cue seats the camera at `seat` LAYOUT RADII from the origin in the
node's direction. Nothing can then sit between the lens and the node to collect a
perspective boost the data never earned; the subject is the nearest body in
frame; and its size on screen is its size in the table. The seats are
`HIV_SURGE_SEAT 1.20`, `HIV_FADE_SEAT 1.08` (still "deeper for the fade", now
deeper toward the node rather than further into the crowd) and `DETONATION_SEAT
1.18` (still a push-in: nearer than the overview, and the move still rides the
year-step, so the eruption and the framing stay one gesture).

The unit is load-bearing. The first attempt expressed the seats as fractions of
`camDist`, which passed on desktop and failed on a phone: `camDist` is 2.0x the
layout on desktop and 2.4x in portrait, so the same number framed mobile 70
percent further out and handed the 1996 pause straight back to heart disease
(HIV 4.8 px against 5.3). In layout radii one number means one framing on any
viewport, and "outside the galaxy" becomes what it always should have been: a
value greater than 1, which is now a unit test rather than a tuned clearance.

Measured on the played tour (`tools/verify-r6fix.mjs`, event-triggered off the
app's own tour clock, never off wall-clock arithmetic):

| frame | round 5 | now |
|---|---|---|
| 2020 hold, subject | COVID 50 px, rank 5 of 153 | COVID 29 px, **rank 1 for all 4.0 s**, lead 1.62-1.64x |
| 2020 hold, bystander | hypertension 152 px | arrhythmia 17.8 px |
| 1996 hold, subject | HIV 8.5 px, rank 12 | HIV 15 px, **rank 1**, lead 1.47-1.49x |
| 2021 peak (regression guard) | COVID 27.8 vs 14 | COVID 28.5 vs 16.2, lead 1.77x |
| mobile 2020 hold | clean | COVID rank 1 all 4.0 s, lead 1.66-1.70x |

The 2020 hold is also now a genuinely still frame (camera 954-956 across the
whole hold) rather than a recovery from a move, which is what a four-second
directed climax should be.

## The rest of the list

**2. Assembly's dark opening.** `ASM.brightMin` 0.35 -> 0.50, pinned in
`tests/assembly.test.js`. Monochrome and the beat-1 colour reward are untouched;
this is the flight's own brightness ramp. Re-shot at 0.0/1.6/3.2/5.0 on both
viewports. At the 1.6 s mark, desktop mean 0.227 -> 0.243/255 and comet peak
147 -> 162; mobile mean 0.483/255. **Reported honestly:** the whole-frame mean
moves only 7 percent, and it cannot move much more from this knob. At that mark
153 sub-pixel-to-few-pixel nodes and their tails cover under one percent of a
1440x900 frame, so the mean the round-5 lens measured is mostly star field and
aurora. The harness therefore reports the mean (for continuity) alongside comet
peak and lit-pixel fraction, which are what a viewer in a bright room actually
sees change. Moving the mean substantially would require the boarded composition
constants (`rStart` 0.55, `camSeat0` 2.9), which this list did not authorize; A/B
runs against the pre-fix build are in the harness output.

**4. The 21-year stale caption.** `buildTourTimeline` now clears the caption at
the start of any leg long enough to sweep. The rule is the leg's own shape, not a
named year: a leg that sweeps is a leg whose opening card has stopped describing
the frame. On this board that is exactly the 1996-2019 leg; every short leg keeps
its caption all the way across, which is what makes the detonation's two
single-year steps read as one sentence. Verified live: caption `null` at year
1999.8 mid-leg.

**5. Mobile ending affordance.** The exit pulsed a Time Machine button that lives
two taps deep in the Menu drawer, so the piece's last sentence pointed at
nothing. Phones now get `ExitTmChip`: a real, tappable Time Machine control
below the header, on the same 1.4 s pulse channel, carrying the same micro-line,
which opens the instrument on tap and leaves with the cue. The Menu button keeps
its pulse underneath. Verified on 375x812: chip on screen, 240x47, animating
`tmHdrLine, tmBtnPulse`. Desktop unchanged.

**6. Micro-label redundancy.** `captionNames` (moved to `src/utils/captions.js`,
pure, unit-tested) suppresses accent 5 wherever the card on screen already names
its node. Checked **live**, not once, and that is the whole subtlety: the year
crosses its detent partway through the back.out step, so the label is armed and
spent while the PREVIOUS pause's card is still up, and the card it would
duplicate arrives ~150 ms later. A one-shot check at arming time passes and the
label then sits under the detonation card for the rest of its life. The engine
also calls `syncMoverLabel` on the same frame it sets a caption, which closes the
last frame of overlap. Measured across a full tour: **0 frames** carry both the
label and a caption naming the same node, and the accent still fires twice, so
suppression did not become deletion.

**7. Ghost shell legibility.** New `ghostAlphaFor(annulusPx)` in `motion.js`:
below `legiblePx` (4) the lit alpha rises in inverse proportion to the shell's
on-screen annulus, capped at `maxAlpha` 0.78. The compensation is **weight only**:
the sphere is still composed once at exactly the radius the node had in the
year just left and still never scales, so the remembered radius is untouched and
an at-rest frame is unchanged. Verified at the 1990-1996 overview: a 0.31 px
annulus is now lit at 0.78 instead of 0.30 (mobile 0.29 px, same lift), with
monotonicity and the cap unit-tested.

**8. Prose.** (a) The methodology's GHE sentence now reconciles its own two
counts in-line, both still derived: "23 sit on WHO's Global Health Estimates 2021
(17 on the estimate itself, which is why the line under this paragraph counts 17;
the other 6 cite a specific GHE cause line and are listed by name in the table
below)". (b) A sickle cell caveat paragraph now sits beside the sepsis one it
parallels, naming the total-burden construct (underlying plus contributing) and
the order-of-magnitude difference from underlying-cause-only estimates. (c) The
Time Machine subsection reads "radius is a 0.25 floor plus a term proportional to
the count", with the floor read from `MIN_RY` rather than written, and a test that
fails if the old wording returns. (d) `docs/direction/2026-08-13-addendum-1-notes.md`
records the two letter-level deviations the craft lens asked for: delta-8's
re-entry stillness (unsatisfiable against delta-4's breathing mandate and the
exit's own turning galaxy; the build chose the right reading, and the acceptance
that should have been written is stated) and A4's 1 percent cap against item 5's
own 0.06-0.13 shimmer band (resolved as a question of A4's scope, not its number).

## Verification

- `npx vitest run`: **316 passed, 17 files** (from 305; +11 new pinning the seats,
  the layout-radius helper, the caption hand-back, `captionNames`, the ghost alpha
  curve, the brightness floor and the disclosed floor).
- `npx vite build`: green, 2.5 s.
- `tools/verify-r6fix.mjs` (new, committed): all checks green on desktop AND
  `--mobile`, covering r6fix-2020-hold, r6fix-hiv-pause, r6fix-caption-leg,
  r6fix-assembly-16, r6fix-ghosts-wide, r6fix-mobile-pulse, the micro-label pair
  and a 2021-peak regression guard.
- Determinism pair: two untouched runs agree on every tour beat to **18 ms**
  desktop, **16 ms** mobile.
- `node tools/verify-fuzz.mjs --points 14 --conc 2` (the documented quick mode,
  14 of the full 40 points): **14/14 green**, 14/14 structural, 14/14 narrative.
- Mobile LOW spot: exactly 1-2 live ghost slots (one per crossing, two only where
  480 ms fades overlap a 360 ms stair), chip affordance on screen, all pause
  framings rank 1.

## Notes for whoever picks this up

1. **`PUSH_IN` is gone, and deliberately.** No relative camera factor survives on
   the tour board; a test asserts `tl.cues.filter(c => c.factor != null).length
   === 0`. If a future pause wants a push-in, give it a `seat`.
2. **Seats are in layout radii, never camDist.** The mobile failure above is the
   reason, and it is silent on a desktop.
3. **`docs/verify` is gitignored**, as in every prior wave. `tools/verify-r6fix.mjs`
   regenerates every shot and JSON it names.
4. The assembly mean-luminance instrument averages four frames a beat apart; a
   single screenshot cannot distinguish a 7 percent change from the star field's
   own swing.
