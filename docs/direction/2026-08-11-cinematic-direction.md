# MedGalaxy Next: direction document
## "The Gap" showcase edition

Cinematic direction, v1. Written against `data/diseases.json` as it exists in this worktree (153 diseases, per-year paper counts 2015-2024). Every number in every caption below is traceable to a named field in that file; the numbers ledger in the appendix maps each one. Where a figure is derived (a ratio, a delta, a sum of a displayed series), it is marked DERIVED and must be computed at render time from `diseases.json`, never hard-coded. House style throughout: no em dashes, no section-sign symbol, sentence case captions.

One data-integrity note before art: the `yearlyPapers` arrays are 10 entries. COVID-19 reads [0, 1, 1, 8, 289, 94633, ...], and its first full pandemic year must be 2020, so index 0 is 2015 and index 9 is 2024. The live sidebar label "Publication Trend (2014–2024)" is off by one year and must be corrected to 2015-2024 everywhere. The spec's 30-year ambition (HIV surging through the 90s) is not in this file; the tour below is directed for the decade we can prove, and its grammar extends unchanged the day the research agents land the longer series.

---

## 1. Art direction

### The one-sentence look
A clinical instrument that catches fire: cold graphite-blue precision for the world of papers, one incandescent black-body event for the world of deaths, and the color of the truth is temperature, not hue.

### Color script, beat by beat

Base stage (never changes): background `#06080d`, ink `#e2e8f0`, secondary ink `#94a3b8`, tertiary `#64748b`, glass `rgba(10,16,30,0.92)`. These are the site's existing constants and the showcase keeps them; continuity with the live product is part of the credibility story.

**Beat 0, Assembly (the instrument turns on).** Near-monochrome. Space deepens to `#04060a`. Filament streams `#1b2740` at 25 percent opacity. Node seeds arrive as cold points `#8fb3ff` at low emission. Star dust `#141a2a`. No saturated hue anywhere yet; the galaxy should feel like a machine booting, not a fireworks show. Caption ink not yet present.

**Beat 1, Attention (the world as researchers see it).** The full category palette fades up to 100 percent over the first second of the beat, graded cool: shadows tinted `#0a1420`, highlights kept just under bloom threshold. The ten category hues are the existing constants and are not altered: tropical `#00ff6a`, cancer `#ff3333`, cardiovascular `#ff8c1a`, neurological `#b44dff`, respiratory `#3399ff`, autoimmune `#ff3d8e`, metabolic `#ffd500`, infectious `#00e6b8`, genetic `#ff5cbf`, mental `#7c3aed`. Caption ink `#e2e8f0`, data sub-line `#94a3b8`.

**Beat 2, The morph (the world as it actually is).** Two-stage color event:
- Stage one, suppression (0.0 to 1.2 s of the beat): every category hue desaturates 85 percent toward graphite `#5a6478`, background sinks to `#030409`, edges drop to 30 percent of their resting opacity. The galaxy goes to grayscale like an X-ray. This is the single most important color decision in the piece; see "how red ignite reads" below.
- Stage two, ignition (1.2 s onward): nodes whose mortality rank far exceeds their papers rank ignite through a black-body ramp, dark to hot: smolder `#2b0806`, ember `#7f1408`, ignition `#c92a0d`, flame `#ff4d1a`, white-hot core `#fff3e0`. The ramp is applied radially per node: cool rim, hot core. Sepsis, the hero, is the only node allowed to reach full white-hot core.

**Beat 3, Release (the instrument is yours).** Category palette returns to full saturation over 1.5 s. Ignited nodes cool back to category color but the bottom decile of papers-per-death keeps a persistent thin ember rim `#ff3b14` at 35 percent opacity with a slow 0.5 Hz smolder, a standing scar that ties directly into the Attention Map's existing red. UI chrome arrives in the established glass materials.

**Time Machine grade.** Neutral beat-1 grade throughout, no suppression; the story is size change, not color change. The 2020 detonation borrows exactly one element from the ignite ramp: a single `#ff4d1a` shockwave ring and the ember dot on the scrubber.

### Light and bloom philosophy
Bloom is meaning, never decoration. One rule enforced in code: only ignite-ramp emissives may exceed the bloom threshold (threshold 1.0, ignited emissive intensity 4.0 to 6.0, everything else capped at or under 1.0). If a viewer sees glow spill, it is because attention and death have diverged at that node, nowhere else. Filmic ACES tone mapping across the whole piece, slight teal in the shadows, warm only where the ignite ramp burns. Depth of field is reserved for selection states, never active during the opening. Category nodes read as flat plasma (single hue, no white core); ignited nodes read as incandescent matter (dark rim, white core). Two materials, two meanings.

### Typography hierarchy
IBM Plex Mono only, as today. Hierarchy is built from size, weight, and ink, never from a second family:
- Hero caption: Plex Mono 500, clamp(20px, 3.2vw, 34px), ink `#e2e8f0`, line height 1.25.
- Hero number (inside hero copy): weight 600, `#ffffff`, one size step up, rendered as a live odometer where directed.
- Data sub-line: 11px, `#94a3b8`. Every stat line carries its unit ("papers", "deaths every year").
- Provenance micro-line: 9px, `#64748b`, for example "PubMed · WHO Global Health Estimates 2021".
- Captions enter per line: 8px rise plus fade over 300 ms, 90 ms stagger between lines; exit is a plain 200 ms fade, no rise. Never more than two sentence lines plus one data line on screen.
- Sentence case for all caption sentences. Disease names render verbatim from the data `label` field. Feature names keep their capitals (Time Machine).

### How red ignite reads against the existing palette
The honest problem: cancer is already `#ff3333` and cardiovascular is `#ff8c1a`, and the ignite ramp lives between them. Three decisions make ignite unmistakable:
1. Ignition only ever happens on the suppressed graphite stage (beat 2, stage one has already drained every category hue). At the moment red appears, it is the only saturated color in the frame, so it cannot be read as a category.
2. Ignite has a luminance signature no category node ever has: black-body radial profile with a white-hot `#fff3e0` core and HDR bloom. Cancer red is flat and never blooms. Viewers discriminate the two by temperature profile even in a still frame, which also makes the OG image self-explanatory.
3. After release, ignite survives only as the thin ember rim on the most overlooked nodes, an outline rather than a fill, sitting exactly on the semantic red the Attention Map already uses (`#ef4444` family). Red therefore means one thing across the whole product: overlooked relative to toll. It never means "cancer" outside of a node's fill.

---

## 2. The Gap: beat board

Total for the three beats: 16.5 s, inside the 16 to 20 s spec window, plus a 4.0 s assembly pre-roll. Camera distances are given as multiples of R0, the default orbit radius the app settles at after intro (the handover target; roulette's existing 80 to 400 unit clamps put R0 near 220 units). All beats honor `prefers-reduced-motion`: reduced mode replaces every camera move and scale tween with 300 ms opacity dissolves between held frames, captions intact, thesis intact.

### Beat 0, Assembly. 4.0 s
- Camera: starts at 2.2 R0, 12 degrees above the galactic plane, drifting in to 1.5 R0. Easing character: long sine.inOut, "held breath", constant slow velocity, no ease-out snap.
- Nodes: stream in along faint filaments toward their precomputed layout seats, monochrome seeds, arrival order by category cluster so structure is visible before color exists. No pop-in: the first painted frame already contains every seed.
- Caption: none. Silence before speech.
- Skip: a quiet "skip intro" pill, bottom right, 9px mono `#64748b`, visible from 0.5 s, with three progress ticks (one per upcoming beat). Any click, key, wheel, or touch triggers the compressed-skip path (defined in beat 2).

### Beat 1, Attention. 5.0 s
- Camera: dolly 1.5 R0 to 1.15 R0 with a 4 degree lateral drift so parallax reveals depth. Easing character: expo.out with a very long tail, 90 percent of travel done by 40 percent of the beat, then near-stillness. The frame should feel like it is settling to listen.
- Nodes: category palette fades up; node radii are the papers mapping (today's default). Two micro-labels fade in beside the giants, 11px, sub-line style: "Heart Disease · 1,733,464 papers" and "Breast Cancer · 588,515 papers". Both values rendered at runtime from `papers`.
- Caption (center-low third, desktop; bottom sheet above legend, mobile):
  - "Where the world's attention goes."
  - Data line: "153 diseases, sized by research papers on record."
- Skip: pill persists; first tick fills as the beat completes.

### Beat 2, The morph. 7.0 s. The thesis; this beat survives every restructuring.
- Camera: pull back 1.15 R0 to 1.45 R0 over the first 2.5 s, sine.inOut, "exhale" character, so the whole field is in frame when the truth lands. Then hold absolutely still for the ignition; the stillness is what makes the ignition violent.
- Nodes, stage one (0.0 to 1.2 s): palette suppression to graphite; micro-labels fade out.
- Nodes, stage two (1.2 to 4.6 s): radii cross-fade from papers mapping to mortality mapping over 2.8 s. Per-node duration scales with sqrt of target radius so massive nodes move slowly, mass made visible. Stagger: shrinking nodes lead in the first 200 ms, growing nodes follow from 300 ms, largest movers last, so the eye reads deflation before ignition. Heart Disease barely changes (1,733,464 papers, 9,100,000 deaths, giant in both worlds, an honest anchor). Depression collapses toward the floor radius silently (mortality is recorded as 0 in the file; no caption may claim "no one dies", it is a modeling boundary and stays uncaptioned). Sepsis swells from mid-field to dominant and ignites to white-hot core; Stroke (534,232 papers, 7,300,000 deaths) and COPD (114,808 papers, 3,500,000 deaths) ignite to flame; Rheumatic Heart Disease ignites small but fully saturated ember, a coal among lanterns.
- Caption, timed to ignition (line one at 1.4 s, hero at 2.6 s):
  - "But this is who actually dies."
  - Hero: "Sepsis kills 11 million people a year."
  - Data line, the odometer: a single monospace counter beside the sepsis node rolls from "248,989 papers" to "11,000,000 deaths every year", digits slot-rolling, unit label flipping mid-roll. Both values from the file (`papers`, `mortality`); "11 million" in the hero line is the honest wording of 11,000,000.
- Skip: any input during beats 0 to 2 does not hard-cut. It plays the compressed morph: a 1.2 s papers-to-deaths cross-fade with the ignite flash and the hero caption held 1.5 s, then release. Nobody is allowed to leave without meeting the thesis, but nobody waits more than about 3 s after asking to leave.
- Reduced motion: two held frames (papers state, deaths state) with a 300 ms dissolve at full caption schedule.

### Beat 3, Release. 4.5 s
- Camera: glide 1.45 R0 to 1.0 R0, easing character: critically damped spring, damping ratio 1.0, and, non-negotiable, velocity-matched handover: the spring's terminal velocity is fed into the orbit controls' damping state so the first user drag continues the motion with zero discontinuity. No dead frame between film and instrument.
- Nodes: category color returns over 1.5 s; ember rims persist on the bottom decile of papers-per-death (runtime computed). Size mode remains mortality for 2 s, then eases back to papers as the header's toggle becomes live, teaching the toggle by demonstration.
- Caption:
  - "Explore the gap."
  - Hint chips fade in under it, 300 ms stagger: "Drag to orbit", "Click any disease", "Try the Time Machine". Chips dismiss on first interaction each.
- UI: existing header slide-down and legend slide-up animations fire here (their current 0.5 to 0.6 s timings are kept), plus the freshness stamp in the legend.
- Skip: pill fades out; the Time Machine tour that follows carries its own skip.

---

## 3. Time Machine: the history of attention

Auto-plays once, 1.5 s after release, as a roughly 21 s tour of the decade in the file; skippable at any input (skip hands the scrubber over immediately at 2024). Node radii per year are precomputed (per-year radius texture, scale-only animation, no re-simulation, per spec). Year readout is a large mono numeral above the rail, digits rolling 120 ms per change. All captions sentence case, one idea per pause, every number from `yearlyPapers` (index 0 = 2015) or `mortality`.

**Pause 1, 2015, hold 3.0 s.** Establish the rules.
- "Ten years of attention, year by year."
- Data line: "Node size: papers published in that year."

**Pause 2, 2019, hold 3.5 s.** The fade nobody noticed. Camera drifts toward the HIV/AIDS node; its ten-year sparkline draws in-world beneath it.
- "HIV attention has been fading for years."
- Data line: "7,396 papers in 2016. 6,849 in 2019. 630,000 people still die of HIV each year."

**Pause 3, 2020, hold 4.0 s.** The detonation. The COVID-19 node erupts from near-nothing; one `#ff4d1a` shockwave ring, a 12-frame white flash at its core, the tour's only overshoot (back.out(1.2), 6 percent).
- "Then a new disease detonated."
- Data line: "COVID-19: 289 papers in 2019. 94,633 in 2020."

**Pause 4, 2021, hold 3.0 s.** The peak.
- "Attention can move this fast."
- Data line: "141,958 COVID-19 papers in 2021 alone."

**Pause 5, 2024, hold 4.5 s.** The cooling, then the flatline finale. COVID visibly shrinks. Then everything dims 60 percent except Rheumatic Heart Disease, which gets a hairline reticle and its flat in-world sparkline. Showing nothing happening is the closing shot.
- "The surge cools: 59,634 papers in 2024."
- Then: "Rheumatic heart disease never surged at all."
- Data line: "Its best year: 569 papers. Its toll: 373,000 deaths, every year."
- Optional third micro-line, DERIVED at runtime and only if it fits the viewport: "COVID-19 drew more papers in 2020 than rheumatic heart disease drew in all ten years shown combined (94,633 versus 4,572)." The 4,572 is the sum of RHD's displayed series and must be summed at render time.

Handover: rail brightens, playhead pulses once, chip reads "Scrub the decade".

**Scrubber interaction feel.** Ten magnetic detents; drag is continuous (radii lerp between adjacent year targets by fractional playhead position, so scrubbing feels analog, not stepped); release snaps to the nearest detent in 180 ms expo.out. Flick gives inertia with friction so a hard throw from 2015 replays the whole decade. Keyboard left and right step years; the rail is full-width on mobile with a 44px hit target. The 2020 detent carries a small ember dot. Each detent crossing fires a 1-frame, 4 percent brightness pip on the year numeral, a visual click. Hovering a year shows a "movers" chip, computed at runtime: the largest absolute change that year, for example "2020: COVID-19 +94,344" (the delta of two file values).

**Node growth animation.** Auto-tour transitions between years run 650 ms, expo.out. Stagger orders nodes by absolute radius delta, biggest movers leading, spread across a 180 ms window; shrinkers begin 80 ms before growers so redistribution reads as flow, not noise. During manual scrub there are no tweens at all: each node follows its target through a critically damped spring with a 120 ms time constant, which makes the whole galaxy feel dragged through time by hand. The 2019-to-2020 overshoot exists only inside the auto-tour, only once.

---

## 4. Micro-interaction language

One motion constitution unifies the opening, the Time Machine, and the inherited features (supernova, roulette, spotlight, stories, Attention Map).

**Two motion families.**
- World (nodes, camera, dust): physical. Critically damped springs, no bounce, duration scales with sqrt of node radius, mass always visible. The single sanctioned overshoot is back.out(1.2), reserved for exactly two events: the COVID detonation and the supernova reveal pop.
- Instrument (UI panels, chips, tooltips): immediate. expo.out, 160 to 240 ms, zero physics playfulness. The UI is a lab instrument; the galaxy is nature.

**Sanctioned time constants:** 120, 180, 240, 320, 480, 650 ms. Nothing else, and nothing above 700 ms outside camera beats and the morph. Sanctioned easings: expo.out (UI), sine.inOut (camera drifts), critically damped spring (world), back.out(1.2) (the two events).

**Hover.** Node scales 1.00 to 1.06 in 120 ms; rim brightens 12 percent; connected edges rise from resting 0.08 opacity to 0.28 over 180 ms; tooltip follows the cursor on a 60 ms lag. Ember-rimmed (overlooked) nodes flicker their rim slightly faster on hover, a subliminal "this one matters".

**Select.** Camera glide 320 ms, velocity-matched like the handover; the existing selection ripple standardizes to 480 ms expo.out; depth-of-field racks in over 400 ms; sidebar slides in 280 ms expo.out with a 40 ms per-section content stagger. Deselect reverses at 240 ms; leaving is always faster than arriving.

**Mode transitions (Research Gap, Connections, Trends, Attention Map, Spotlight, Time Machine).** One shared grammar: a 240 ms grade shift plus element crossfade, and a single caption chip announcing the mode, same position every time (top center under the header). No mode gets a bespoke entrance. Predictability is what lets the flashy moments land.

**Supernova and roulette, brought into the family.** Their internal physics (ring speeds, decel curves, easeOutCubic reveal) are already good and stay. Three changes bind them to the new material: reveal tweens adopt the shared critically damped spring; dust particles tint by the revealed disease's papers-per-death color on the Attention Map scale, so a roulette landing on an overlooked disease throws ember-red dust; and their result captions adopt the caption hierarchy and runtime-derived numbers (which also retires the stale-caption bug class the spec names).

**Text and numbers.** Any stat that changes on screen rolls through the odometer treatment, never a hard swap. Any number anywhere can be hovered for its provenance micro-line.

---

## 5. Sound direction

**Decision: yes**, behind a muted-by-default toggle in the header ("sound" pill; first activation is the user gesture that primes the AudioContext, satisfying autoplay policy). No audio files: the entire palette is synthesized in WebAudio at runtime, zero asset weight, and the methodology panel gets one line saying so. Session-scoped state, always muted on a fresh load. If review finds it cheapens the piece on small speakers, the toggle simply never un-mutes by default; the cut is one flag.

**Palette.** Cold and instrument-like, matching the grade: a sub drone at 40 to 55 Hz (sine plus filtered noise, barely there), a granular shimmer bed in the 2 to 6 kHz air band for space, UI ticks as 30 ms filtered sine blips near 2.2 kHz, and one low ignition voice: an 80-to-45 Hz swell with a low-passed noise bloom. Mix discipline: one foreground sound at a time, ambient ducks 6 dB under any event, master limiter on the bus, everything conservative enough for laptop speakers.

**The five key moments.**
1. Assembly shimmer: the granular bed fades in with the filaments, resolving to a single soft consonance as the layout locks.
2. Ignition: at the odometer flip on sepsis, near-silence for 300 ms (the duck is the drama), then the whoomp. The only big hit in the piece.
3. Release exhale: a warm pad swell as chrome arrives and control transfers, resolving the ignition's tension.
4. Time Machine 2020: a muffled distant boom with the shockwave ring, deliberately smaller than moment 2; history rhymes but does not shout.
5. Reveal motif: one two-note rising fifth shared by supernova and roulette reveals, pitch nudged down a third when the revealed disease is in the overlooked decile. The sound design carries the thesis too.

Scrub detents get the UI tick only, no pitch mapping; data sonification beyond this would claim precision the ear cannot verify.

---

## 6. The 9/10 list

Ten craft details, ranked, that separate a 9 from a 7 here.

1. **Velocity-matched handover.** The cinematic's final camera velocity feeds the orbit controls' damping state; the user's first drag continues a motion already underway. The moment film becomes instrument is the moment trust is won or lost.
2. **The odometer flip.** One monospace counter rolling 248,989 papers into 11,000,000 deaths every year, unit label flipping mid-roll. The entire thesis in a single UI element; it is what both target viewers will describe to someone else afterward.
3. **Bloom discipline.** Only ignite-ramp emissives may cross the bloom threshold, ever. Glow becomes a unit of meaning (attention-death divergence), so the one time the screen burns, it is evidence, not garnish.
4. **Palette suppression before ignition.** Draining category color before red appears is what stops "ignite red" from colliding with cancer `#ff3333` and cardiovascular `#ff8c1a`. Without this single grading move the thesis frame is ambiguous to a professional viewer.
5. **Mass-weighted motion.** Every node's animation duration scales with sqrt of radius; giants are slow, minnows are quick. The galaxy stops feeling like sprites and starts feeling like matter, in the morph, the Time Machine, and every hover.
6. **Provenance within one hover of every number.** Runtime-derived captions, the freshness stamp, per-disease click-through to the live PubMed query, and the 2015-2024 year-label correction. The professor's tenth spot-check must land as cleanly as the first.
7. **The flatline as the closing shot.** Dimming 152 diseases to frame Rheumatic Heart Disease's unmoving sparkline (569 papers in its best year, 373,000 deaths every year) is the piece's negative-space moment; directing stillness is harder than directing fireworks, and it is what makes the tour an argument rather than a demo.
8. **Scrubber tactility.** Magnetic detents, analog inter-year lerp, flick inertia, keyboard steps, the ember dot on 2020, the 1-frame numeral pip per detent. The difference between a timeline that is watched and one that is played with, and the interaction most likely to hold Musk for an extra five minutes.
9. **A skip that still lands the thesis.** Any impatient input plays the 1.2 s compressed morph before release, so even the most hostile viewer meets sepsis. Respecting the viewer's time without surrendering the argument is showcase-grade direction.
10. **First-frame and last-frame integrity.** No pop-in ever (first painted frame contains every seed), cold load under 3 s on a mid-tier phone, reduced-motion and Safari paths that keep every caption, and the OG preview image cut from the ignite frame so the argument starts before the link is even opened.

---

## Appendix: numbers ledger

Every figure used above, with its source in `data/diseases.json` (year index 0 = 2015).

| Figure in copy | Source |
|---|---|
| 153 diseases | array length |
| Heart Disease 1,733,464 papers; 9,100,000 deaths | `heart-disease.papers`, `.mortality` |
| Breast Cancer 588,515 papers; 666,000 deaths | `breast-cancer.papers`, `.mortality` |
| Sepsis 248,989 papers; 11 million (11,000,000) deaths a year | `sepsis.papers`, `.mortality` |
| Stroke 534,232 papers; 7,300,000 deaths | `stroke.papers`, `.mortality` |
| COPD 114,808 papers; 3,500,000 deaths | `copd.papers`, `.mortality` |
| Depression radius collapse (uncaptioned) | `depression.mortality` = 0 |
| HIV 7,396 (2016); 6,849 (2019); 6,050 (2024); 630,000 deaths a year | `hiv-aids.yearlyPapers[1]`, `[4]`, `[9]`, `.mortality` |
| COVID-19 289 (2019); 94,633 (2020); 141,958 (2021); 59,634 (2024) | `covid-19.yearlyPapers[4]`, `[5]`, `[6]`, `[9]` |
| Rheumatic Heart Disease best year 569; 373,000 deaths a year; 19,556 papers | `rheumatic-heart-disease.yearlyPapers[9]` (decade max), `.mortality`, `.papers` |
| RHD decade total 4,572 | DERIVED: sum of `rheumatic-heart-disease.yearlyPapers`, computed at render time |
| 2020 movers chip "+94,344" | DERIVED: `covid-19.yearlyPapers[5]` minus `[4]`, runtime |
| Ember rim membership | DERIVED: bottom decile of `papers / mortality` where `mortality > 0`, runtime |

Guardrails: never sum `papers` or `mortality` across diseases in any caption (co-tagged papers and overlapping cause-of-death attribution make cross-disease totals epidemiologically dishonest; sepsis alone overlaps pneumonia and others). Hero copy uses full words for round millions ("11 million"), exact comma-separated integers otherwise, and no abbreviations like 11M anywhere in hero or caption text.