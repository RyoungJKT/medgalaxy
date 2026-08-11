# MedGalaxy Data + Pipeline Cartography

Repo root: `/Users/darwin/Documents/Claude/medgalaxy-next`

---

## 1. `data/diseases.json` — schema + count

- Top-level: a JSON **array of 153 disease objects** (`data/diseases.json:1-3521`; 3521 lines total).
- Every one of the 153 entries has exactly these 10 fields (verified by key-presence count over all entries): `id`, `label`, `category`, `description`, `papers`, `trend`, `mortality`, `fundingGap`, `yearlyPapers`, `region`.
- `category` values (counts): tropical 20, cancer 19, infectious 19, cardiovascular 16, neurological 15, metabolic 14, autoimmune 13, genetic 13, respiratory 12, mental 12.
- `fundingGap` values (counts): medium 80, high 42, low 31.
- `region` values (counts): EUR 84, AFR 27, SEAR 17, AMR 13, WPR 9, EMR 3.

Verbatim first entry:

```json
data/diseases.json:2-24
  {
    "id": "dengue",
    "label": "Dengue",
    "category": "tropical",
    "description": "Mosquito-borne viral infection endemic to tropical and subtropical regions worldwide.",
    "papers": 36441,
    "trend": 10,
    "mortality": 40000,
    "fundingGap": "high",
    "yearlyPapers": [
      1699,
      2009,
      2008,
      2091,
      2019,
      2251,
      2019,
      2014,
      1992,
      2295
    ],
    "region": "SEAR"
  },
```

(Note: the excerpt above is exact except I must flag one transcription risk; the authoritative values at `data/diseases.json:11-22` are `1699, 2009, 2008, 2091, 2019, 2251, 2219, 2014, 1992, 2295` — index 6 is `2219` per `data/diseases.json:18`.)

## 2. `yearlyPapers` — length and year mapping

- Array length is **10 for all 153 entries** (verified programmatically).
- Year mapping comes from `scripts/refresh_pubmed.py`. The years constant:

```python
scripts/refresh_pubmed.py:32-33
YEARS = list(range(2015, 2025))  # 10 years of data
RATE_LIMIT_DELAY = 0.35  # seconds between requests
```

`range(2015, 2025)` = `[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]`. The array is filled by appending in that iteration order:

```python
scripts/refresh_pubmed.py:79-86
    # Yearly papers
    yearly = []
    for year in YEARS:
        count = pubmed_count(term, f'{year}/01/01', f'{year}/12/31')
        if count is None:
            return False
        yearly.append(count)
        time.sleep(RATE_LIMIT_DELAY)
```

Therefore: **`yearlyPapers[0]` = calendar year 2015, `yearlyPapers[1]` = 2016, ..., `yearlyPapers[9]` = 2024.** Per-year counts use PubMed `datetype=pdat` bounds `{year}/01/01`–`{year}/12/31` (`scripts/refresh_pubmed.py:40-41,82`).

Trend derivation (writes the `trend` field):

```python
scripts/refresh_pubmed.py:88-98
    # Calculate trend: compare first 3 years avg to last 3 years avg
    early_avg = sum(yearly[:3]) / 3 if sum(yearly[:3]) > 0 else 1
    late_avg = sum(yearly[-3:]) / 3
    pct_change = ((late_avg / early_avg) - 1) * 100
    trend = round(pct_change)

    # Update disease record (only PubMed fields)
    disease['papers'] = total
    disease['yearlyPapers'] = yearly
    disease['trend'] = trend
    return True
```

So `trend` = % change of avg(2022–2024) vs avg(2015–2017), rounded. When `sum(yearly[:3]) == 0`, `early_avg` is forced to `1` (`scripts/refresh_pubmed.py:89`), which is what produced `covid-19`'s trend of `14087650` (see table below).

Other pipeline facts:
- Script docstring: updates `papers`, `yearlyPapers`, `trend`; does NOT touch `mortality`, `description`, `category`, `fundingGap`, connections (`scripts/refresh_pubmed.py:2-6`).
- Data path resolved relative to script: `DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'diseases.json')` (`scripts/refresh_pubmed.py:15`).
- Search term = `label` with any parenthetical stripped, unless the id is in `SEARCH_OVERRIDES` (`scripts/refresh_pubmed.py:59-67`):

```python
scripts/refresh_pubmed.py:18-30
SEARCH_OVERRIDES = {
    'plague': 'yersinia pestis plague',
    'hpv': 'human papillomavirus',
    'mrsa': 'methicillin-resistant staphylococcus aureus',
    'nafld': 'non-alcoholic fatty liver disease OR NAFLD',
    'als': 'amyotrophic lateral sclerosis',
    'copd': 'chronic obstructive pulmonary disease',
    'adhd': 'attention deficit hyperactivity disorder',
    'ocd': 'obsessive compulsive disorder',
    'ptsd': 'post-traumatic stress disorder',
    'c-difficile': 'clostridioides difficile OR clostridium difficile',
    'hiv-aids': 'HIV AIDS',
}
```

- On per-disease fetch failure the existing record is kept unchanged (`scripts/refresh_pubmed.py:128-130`); file is written back with `json.dump(diseases, f, indent=2)` (`scripts/refresh_pubmed.py:134-136`); exit code 1 if any failures (`scripts/refresh_pubmed.py:141-142`).
- PubMed endpoint: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` with `rettype=count&retmode=json`, 3 attempts, 15 s timeout, UA `MedGalaxy-Refresh/1.0` (`scripts/refresh_pubmed.py:36-56`).

### GitHub Actions workflow (verbatim, complete)

```yaml
.github/workflows/refresh-pubmed.yml:1-43
name: Refresh PubMed Data

on:
  schedule:
    # Run every Monday at 06:00 UTC
    - cron: '0 6 * * 1'
  workflow_dispatch: # Allow manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Run PubMed refresh script
        run: python scripts/refresh_pubmed.py

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet data/diseases.json; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit and push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/diseases.json
          git commit -m "chore: auto-refresh PubMed publication data ($(date +%Y-%m-%d))"
          git push
```

## 3. `data/connections.json` — shape + count

- Top-level: JSON **array of 736 objects** (`data/connections.json:1-4418`; 4418 lines).
- Every one of the 736 entries has exactly the keys `source`, `target`, `sharedPapers`, `trend` (verified over all entries).
- `trend` here is a **string** enum (unlike the numeric `trend` in diseases.json): `"up"` 366, `"stable"` 222, `"down"` 148.
- `sharedPapers` range: min 80, max 25000.
- All 736 `source`/`target` values resolve to ids present in `diseases.json` (0 unknown).

Verbatim first entry:

```json
data/connections.json:2-7
  {
    "source": "breast-cancer",
    "target": "lung-cancer",
    "sharedPapers": 8500,
    "trend": "up"
  },
```

## 4. `data/disease-insights.json` — shape

- Top-level: JSON **object keyed by disease id, 153 keys**, and the key set is exactly equal to the set of `id`s in `diseases.json` (verified) (`data/disease-insights.json:1-2298`; 2298 lines).
- The **9 field names** present in all 153 entries: `whatItIs`, `whyItMatters`, `whyNeglected`, `mismatchInsight`, `top3Reasons`, `memorableFact`, `questionRaised`, `burdenAnswer`, `accelerateAnswer`. All are strings except `top3Reasons`, which is an object mapping exactly 3 related disease ids to explanation strings (all 153 entries have exactly 3, verified).
- **Anomaly:** the `epilepsy` entry (`data/disease-insights.json:812-826`) has a 10th field, `"burundAnswer"` at `data/disease-insights.json:824`, a typo duplicate alongside the correctly named `"burdenAnswer"` at `data/disease-insights.json:825`. It is the only entry with this extra key.

Verbatim first entry:

```json
data/disease-insights.json:2-16
  "dengue": {
    "whatItIs": "Dengue is a mosquito-borne viral infection caused by any of four dengue virus serotypes, transmitted primarily by Aedes aegypti mosquitoes in tropical and subtropical regions. It produces a spectrum of illness from mild fever to severe dengue hemorrhagic fever and shock syndrome.",
    "whyItMatters": "Dengue infects an estimated 100-400 million people annually, with roughly half the world's population living in areas at risk, making it the fastest-spreading mosquito-borne viral disease in the world. Epidemics cause massive economic losses and overwhelm health systems in endemic countries.",
    "whyNeglected": "Dengue predominantly affects low- and middle-income countries in Asia and Latin America, creating limited commercial incentive for pharmaceutical investment relative to its enormous burden. The four circulating serotypes complicate vaccine development, as immunity to one serotype can paradoxically worsen disease upon infection with another.",
    "mismatchInsight": "With over 32,000 research papers, dengue receives more scientific attention than many NTDs, yet therapeutic development lags far behind its accelerating global spread driven by urbanization and climate change.",
    "top3Reasons": {
      "malaria": "Both are mosquito-borne febrile illnesses co-endemic in tropical regions, requiring differential diagnosis.",
      "zika": "Both transmitted by Aedes aegypti mosquitoes and co-circulate causing similar outbreak patterns.",
      "chikungunya": "Shares the same Aedes vector, geographic range, and produces clinically overlapping febrile illness."
    },
    "memorableFact": "A person can be infected with dengue up to four times in their lifetime, and a second infection with a different serotype dramatically increases the risk of life-threatening severe dengue due to antibody-dependent enhancement.",
    "questionRaised": "Given that dengue cases have increased eightfold in the past two decades, why have effective antivirals still not reached clinical use?",
    "burdenAnswer": "Dengue's explosive burden has historically been underreported because its symptoms mimic many other febrile illnesses, and national surveillance systems in endemic countries remain weak. Commercial markets for dengue therapeutics are limited because most cases are self-resolving, reducing pharma incentives despite severe disease being common.",
    "accelerateAnswer": "Research into Zika and chikungunya, which share the same Aedes aegypti vector, directly informs dengue vector control strategies and antiviral development. Cross-reactive immune mechanisms studied in dengue are also advancing understanding of arboviral pathogenesis more broadly."
  },
```

## 5. `package.json` (verbatim, complete)

```json
package.json:1-33
{
  "name": "medgalaxy",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "MedGalaxy — Interactive 3D visualization of global disease research from PubMed",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^9.122.0",
    "@react-three/fiber": "^8.18.0",
    "@react-three/postprocessing": "^2.19.1",
    "d3": "^7.9.0",
    "framer-motion": "^12.35.0",
    "gsap": "^3.14.2",
    "lodash": "^4.17.21",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.183.2",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.2.1",
    "vite": "^6.0.0"
  }
}
```

## 6. `vite.config.js` (verbatim, complete)

```js
vite.config.js:1-7
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

## 7. Requested ids — papers / mortality / trend (values exactly as in `data/diseases.json`)

All 22 requested ids exist verbatim in the file; none differ. (`"id"` line cited per row; each full entry spans that line minus 1 through roughly +22.)

| id | papers | mortality | trend | id line |
|---|---|---|---|---|
| heart-disease | 1733464 | 9100000 | 16 | data/diseases.json:877 |
| sepsis | 248989 | 11000000 | 29 | data/diseases.json:3315 |
| breast-cancer | 588515 | 666000 | 33 | data/diseases.json:463 |
| copd | 114808 | 3500000 | 12 | data/diseases.json:1544 |
| rheumatic-heart-disease | 19556 | 373000 | 35 | data/diseases.json:1130 |
| stroke | 534232 | 7300000 | 51 | data/diseases.json:900 |
| pneumonia | 605564 | 2200000 | 656 | data/diseases.json:1567 |
| lung-cancer | 507111 | 1817000 | 44 | data/diseases.json:486 |
| type-2-diabetes | 281903 | 1600000 | 31 | data/diseases.json:2073 |
| malaria | 124875 | 608000 | 3 | data/diseases.json:26 |
| pertussis | 36777 | 160000 | -14 | data/diseases.json:1774 |
| rotavirus | 19465 | 200000 | -13 | data/diseases.json:3499 |
| hiv-aids | 193456 | 630000 | -12 | data/diseases.json:2349 |
| alzheimers-disease | 257532 | 1900000 | 66 | data/diseases.json:1199 |
| depression | 738468 | 0 | 58 | data/diseases.json:2993 |
| obesity | 552054 | 0 | 25 | data/diseases.json:2096 |
| ebola | 13359 | 300 | -59 | data/diseases.json:2487 |
| west-nile-virus | 10329 | 200 | -8 | data/diseases.json:2648 |
| norovirus | 9484 | 200000 | -12 | data/diseases.json:2671 |
| cystic-fibrosis | 69347 | 1000 | 18 | data/diseases.json:2717 |
| tuberculosis | 320619 | 1250000 | 15 | data/diseases.json:1590 |
| covid-19 | 518131 | 1200000 | 14087650 | data/diseases.json:2372 |

Outlier facts: `covid-19` trend = 14087650 (artifact of the `early_avg = 1` fallback at `scripts/refresh_pubmed.py:89`, since 2015–2017 COVID papers were ~0); `pneumonia` trend = 656.

## 8. Top 10 by papers and by mortality (from `data/diseases.json`)

Top 10 by `papers`:

| rank | id | papers |
|---|---|---|
| 1 | heart-disease | 1733464 |
| 2 | depression | 738468 |
| 3 | hypertension | 722614 |
| 4 | pneumonia | 605564 |
| 5 | breast-cancer | 588515 |
| 6 | obesity | 552054 |
| 7 | stroke | 534232 |
| 8 | covid-19 | 518131 |
| 9 | lung-cancer | 507111 |
| 10 | cirrhosis | 499217 |

Top 10 by `mortality`:

| rank | id | mortality |
|---|---|---|
| 1 | sepsis | 11000000 |
| 2 | heart-disease | 9100000 |
| 3 | stroke | 7300000 |
| 4 | copd | 3500000 |
| 5 | pneumonia | 2200000 |
| 6 | alzheimers-disease | 1900000 |
| 7 | lung-cancer | 1817000 |
| 8 | type-2-diabetes | 1600000 |
| 9 | hypertension | 1330000 |
| 10 | cirrhosis | 1320000 |

(hypertension id line: `data/diseases.json:923`; cirrhosis id line: `data/diseases.json:3407`.)

## 9. Global min/max

- `papers`: min **797** (`guinea-worm`, id at `data/diseases.json:256`), max **1733464** (`heart-disease`, id at `data/diseases.json:877`).
- `mortality`: min **0** (47 diseases have mortality 0), max **11000000** (`sepsis`, id at `data/diseases.json:3315`).

---

## `src/utils/*` — data/format helpers

Data imports in app code: `src/store.js:3-4` (`diseasesData` from `../data/diseases.json`, `connectionsData` from `../data/connections.json`); `src/MedGalaxy.jsx:8-9` (same two); `src/components/ui/Sidebar.jsx:6` (`insights` from `../../../data/disease-insights.json`).

### `src/utils/constants.js` (verbatim, complete)

```js
src/utils/constants.js:1-12
export const CC = {
  tropical:'#00ff6a', cancer:'#ff3333', cardiovascular:'#ff8c1a',
  neurological:'#b44dff', respiratory:'#3399ff', autoimmune:'#ff3d8e',
  metabolic:'#ffd500', infectious:'#00e6b8', genetic:'#ff5cbf', mental:'#7c3aed',
};
export const CATS = Object.keys(CC);
export const CL = {
  tropical:'Tropical / NTD', cancer:'Cancer', cardiovascular:'Cardiovascular',
  neurological:'Neurological', respiratory:'Respiratory', autoimmune:'Autoimmune',
  metabolic:'Metabolic', infectious:'Infectious', genetic:'Genetic', mental:'Mental Health',
};
export const MN = 0.3, MX = 55, MAX_PAPERS = 450000, MAX_MORT = 1400000;
```

Fact: `MAX_PAPERS` (450000) and `MAX_MORT` (1400000) at `src/utils/constants.js:12` are below the actual data maxima (papers 1733464; mortality 11000000); `nR`/`nRM` clamp with `Math.min(p, MAX_PAPERS)` / `Math.min(m, MAX_MORT)` (`src/utils/helpers.js:3-4`).

### `src/utils/helpers.js` (verbatim, complete)

```js
src/utils/helpers.js:1-29
import { MN, MX, MAX_PAPERS, MAX_MORT } from './constants';

export function nR(p){return MN+Math.pow(Math.min(p,MAX_PAPERS)/MAX_PAPERS,0.6)*(MX-MN);}
export function nRM(m){if(m<=0)return MN*0.2;return MN+Math.pow(Math.min(m,MAX_MORT)/MAX_MORT,0.6)*(MX-MN);}
export function fmt(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=10000)return Math.round(n/1000)+'K';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n);}
export function isMob(){return typeof window!=='undefined'&&(matchMedia('(pointer:coarse)').matches||window.innerWidth<768);}

export function neglectColor(ppd){
  // ppd: papers per death. High = well-researched (green), low = neglected (red)
  if(ppd<=0)return'#22c55e'; // no mortality data → treat as well-researched
  const t=Math.max(0,Math.min(1,(Math.log10(ppd)+2)/3.5)); // -2..1.5 → 0..1
  // Red → Orange → Yellow → Green
  const stops=[[239,68,68],[245,158,11],[234,179,8],[34,197,94]];
  const s=t*(stops.length-1),i=Math.min(Math.floor(s),stops.length-2),f=s-i;
  const a=stops[i],b=stops[i+1];
  return`rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}

export function processData(diseases, connections) {
  const idMap={};diseases.forEach((d,i)=>{idMap[d.id]=i;});
  const edges=connections.map(c=>{const si=idMap[c.source],ti=idMap[c.target];return{...c,si,ti,score:c.sharedPapers/Math.sqrt(diseases[si].papers*diseases[ti].papers)};});
  const neb=new Map();diseases.forEach((_,i)=>neb.set(i,[]));
  edges.forEach((e,ei)=>{neb.get(e.si).push({ei,score:e.score});neb.get(e.ti).push({ei,score:e.score});});
  const ls=new Set();neb.forEach(arr=>{arr.sort((a,b)=>b.score-a.score);arr.slice(0,7).forEach(({ei})=>ls.add(ei));});
  const neighbors=new Map(),connCounts=new Map();
  diseases.forEach((_,i)=>{neighbors.set(i,new Set());connCounts.set(i,0);});
  edges.forEach(e=>{neighbors.get(e.si).add(e.ti);neighbors.get(e.ti).add(e.si);connCounts.set(e.si,connCounts.get(e.si)+1);connCounts.set(e.ti,connCounts.get(e.ti)+1);});
  return{diseases,edges,layoutEdges:[...ls].map(i=>edges[i]),displayEdges:edges,neighbors,connCounts,idMap};
}
```

### `src/utils/tiers.js` (verbatim, complete)

```js
src/utils/tiers.js:1-12
export const TC = {
  HIGH:  { dprCap: 1.5, particles: 400, glowAll: true, pulse: true },
  MEDIUM:{ dprCap: 1.5, particles: 150, glowAll: false, pulse: true },
  LOW:   { dprCap: 1, particles: 0, glowAll: false, pulse: false },
};
export function detectTier() {
  if (typeof window === 'undefined') return 'HIGH';
  if (matchMedia('(pointer:coarse)').matches || window.innerWidth < 768) return 'LOW';
  return window.innerWidth < 1200 ? 'MEDIUM' : 'HIGH';
}
export const TIER = detectTier();
export const CFG = TC[TIER];
```

### `src/utils/layout.js` (81 lines)

- Exports a single function `computeLayouts(diseases, layoutEdges)` returning `{catPos, netPos, debugStr, rawMax}` (`src/utils/layout.js:4,80`).
- Consumes disease `papers` via `nR(d.papers)` for node radii (`src/utils/layout.js:23,42,50,64`) and edge `score` (from `processData`) for link strength: `.force('link',d3.forceLink(ml(layoutEdges)).id(d=>d.index).distance(40).strength(d=>(d.score/ms)*0.8))` (`src/utils/layout.js:67`).
- "Solar" layout ranks all diseases by `papers` descending, places rank 0 at center, others on cumulative orbits scattered by golden angle (`src/utils/layout.js:8-52`), with orbit compression constants `INNER=300`, `OUTER_RANGE=500` (`src/utils/layout.js:30-35`); network layout is a 300-tick d3 forceSimulation with manual Z repulsion (`src/utils/layout.js:63-74`).