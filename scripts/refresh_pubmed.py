#!/usr/bin/env python3
"""
Refresh PubMed publication data for all diseases in diseases.json.
Updates: papers (total count), yearlyPapers (last 10 years), trend (% change).
Does NOT touch: mortality, description, category, fundingGap, connections.
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

YEARS = list(range(2015, 2025))  # 10 years of data
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


def refresh_disease(disease):
    """Fetch updated PubMed data for a single disease."""
    term = get_search_term(disease)

    # Total paper count
    total = pubmed_count(term)
    if total is None:
        return False

    # Yearly papers
    yearly = []
    for year in YEARS:
        count = pubmed_count(term, f'{year}/01/01', f'{year}/12/31')
        if count is None:
            return False
        yearly.append(count)
        time.sleep(RATE_LIMIT_DELAY)

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


def main():
    with open(DATA_PATH, 'r') as f:
        diseases = json.load(f)

    total = len(diseases)
    updated = 0
    failed = 0

    print(f'Refreshing PubMed data for {total} diseases...')
    print(f'Years: {YEARS[0]}-{YEARS[-1]}')
    print()

    for i, disease in enumerate(diseases):
        label = disease['label']
        term = get_search_term(disease)
        print(f'[{i+1}/{total}] {label} (searching: "{term}")...', end=' ', flush=True)

        old_papers = disease.get('papers', 0)
        old_trend = disease.get('trend', 0)

        success = refresh_disease(disease)

        if success:
            delta = disease['papers'] - old_papers
            delta_str = f'+{delta}' if delta >= 0 else str(delta)
            print(f'OK — {disease["papers"]:,} papers ({delta_str}), trend={disease["trend"]}% (was {old_trend}%)')
            updated += 1
        else:
            print('FAILED — keeping existing data')
            failed += 1

        time.sleep(RATE_LIMIT_DELAY)

    # Write back
    with open(DATA_PATH, 'w') as f:
        json.dump(diseases, f, indent=2)

    print()
    print(f'Done. Updated: {updated}, Failed: {failed}, Total: {total}')

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
