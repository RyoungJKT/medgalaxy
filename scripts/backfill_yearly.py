#!/usr/bin/env python3
"""
Backfill yearlyPapers with 1990-2014 PubMed counts for all diseases in diseases.json.
Extends the existing 2015-2024 (10-entry) yearlyPapers to a 35-entry array
(indexes 0..24 = 1990..2014 backfilled, 25..34 = 2015..2024 from the weekly
refresh pipeline), and sets yearStart = 1990.
Resumable: writes the file after every completed disease, and skips diseases
that are already backfilled (yearStart == 1990) on restart.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'diseases.json')

# Override search terms for diseases whose labels don't work as-is
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

YEARS_BACK = list(range(1990, 2015))  # 25 years of backfill data
RATE_LIMIT_DELAY = 0.35  # seconds between requests


def pubmed_count(term, min_date=None, max_date=None):
    """Query PubMed E-utilities for article count."""
    url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
    params = f'db=pubmed&term={urllib.request.quote(term)}&rettype=count&retmode=json'
    if min_date and max_date:
        params += f'&datetype=pdat&mindate={min_date}&maxdate={max_date}'
    full_url = f'{url}?{params}'

    for attempt in range(3):
        try:
            req = urllib.request.Request(full_url, headers={'User-Agent': 'MedGalaxy-Refresh/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                return int(data['esearchresult']['count'])
        except (urllib.error.URLError, TimeoutError, KeyError) as e:
            if attempt < 2:
                time.sleep(2)
                continue
            print(f'  WARNING: Failed to fetch count for "{term}": {e}', file=sys.stderr)
            return None
    return None


def get_search_term(disease):
    """Get the PubMed search term for a disease."""
    if disease['id'] in SEARCH_OVERRIDES:
        return SEARCH_OVERRIDES[disease['id']]
    # Strip parenthetical from label
    label = disease['label']
    if '(' in label:
        label = label[:label.index('(')].strip()
    return label


def backfill_disease(disease):
    """Fetch 1990-2014 PubMed counts for a single disease and prepend them
    to the existing (2015-2024) yearlyPapers array."""
    term = get_search_term(disease)

    back = []
    for year in YEARS_BACK:
        count = pubmed_count(term, f'{year}/01/01', f'{year}/12/31')
        if count is None:
            return False
        back.append(count)
        time.sleep(RATE_LIMIT_DELAY)

    disease['yearlyPapers'] = back + disease['yearlyPapers']
    disease['yearStart'] = 1990
    return True


def main():
    with open(DATA_PATH, 'r') as f:
        diseases = json.load(f)

    total = len(diseases)
    updated = 0
    skipped = 0
    failed = 0

    print(f'Backfilling yearlyPapers {YEARS_BACK[0]}-{YEARS_BACK[-1]} for {total} diseases...')
    print()

    for i, disease in enumerate(diseases):
        if disease.get('yearStart') == 1990:
            print(f'[{i+1}/{total}] {disease["id"]} — already backfilled, skipping')
            skipped += 1
            continue

        print(f'[{i+1}/{total}] {disease["id"]}...', end=' ', flush=True)

        success = backfill_disease(disease)

        if success:
            print(f'OK — yearlyPapers now {len(disease["yearlyPapers"])} entries (yearStart={disease["yearStart"]})')
            updated += 1
            # Write after EVERY completed disease so the run is resumable.
            with open(DATA_PATH, 'w') as f:
                json.dump(diseases, f, indent=2)
        else:
            print('FAILED — leaving disease unbackfilled for retry on next run')
            failed += 1

    print()
    print(f'Done. Updated: {updated}, Skipped (already backfilled): {skipped}, Failed: {failed}, Total: {total}')

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
