#!/usr/bin/env python3
"""
Regenerate data/connections.json's sharedPapers from live PubMed co-occurrence
counts.

Every stored sharedPapers value becomes the all-time PubMed count for the query
"(<termA>) AND (<termB>)", using exactly the same search terms, endpoint, user
agent and rate limit as scripts/refresh_pubmed.py, so a connection weight is
reproducible by anyone who runs the same query. All-time (undated) semantics
match the diseases.json `papers` field, which is what the co-occurrence score
divides by.

Does NOT touch the pair list itself, which is curated: the pairs are hand-drawn
plausible links, not an exhaustive all-pairs sweep, and this script only
measures the ones already there.

The file previously also carried a per-pair `trend` ("up"/"stable"/"down").
That value was authored, is not derivable from a single count query, and was
displayed next to the measured count as though it were measured too, so it was
removed from the data and from the sidebar rather than left to be misread.

Resumable: caches every fetched count in scripts/.connections_progress.json and
rewrites connections.json every WRITE_EVERY pairs, so an interrupted run
resumes without re-querying.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

HERE = os.path.dirname(__file__)
DATA_PATH = os.path.join(HERE, '..', 'data', 'connections.json')
DISEASES_PATH = os.path.join(HERE, '..', 'data', 'diseases.json')
SEARCH_OVERRIDES_PATH = os.path.join(HERE, '..', 'data', 'search-overrides.json')
PROGRESS_PATH = os.path.join(HERE, '.connections_progress.json')

# Same single source of truth as scripts/refresh_pubmed.py,
# scripts/backfill_yearly.py and src/utils/pubmedTerms.js.
with open(SEARCH_OVERRIDES_PATH, 'r') as _f:
    SEARCH_OVERRIDES = json.load(_f)

RATE_LIMIT_DELAY = 0.35  # seconds between requests, same as refresh_pubmed.py
WRITE_EVERY = 20         # rewrite connections.json this often


def pubmed_count(term):
    """Query PubMed E-utilities for an all-time article count."""
    url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'
    params = f'db=pubmed&term={urllib.request.quote(term)}&rettype=count&retmode=json'
    full_url = f'{url}?{params}'

    for attempt in range(3):
        try:
            req = urllib.request.Request(full_url, headers={'User-Agent': 'MedGalaxy-Refresh/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
                return int(data['esearchresult']['count'])
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as e:
            if attempt < 2:
                time.sleep(2)
                continue
            print(f'  WARNING: Failed to fetch count for "{term}": {e}', file=sys.stderr)
            return None
    return None


def get_search_term(disease):
    """Get the PubMed search term for a disease (mirrors refresh_pubmed.py)."""
    if disease['id'] in SEARCH_OVERRIDES:
        return SEARCH_OVERRIDES[disease['id']]
    label = disease['label']
    if '(' in label:
        label = label[:label.index('(')].strip()
    return label


def load_progress():
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, 'r') as f:
            return json.load(f)
    return {}


def save_progress(progress):
    with open(PROGRESS_PATH, 'w') as f:
        json.dump(progress, f, indent=0)


def main():
    with open(DISEASES_PATH, 'r') as f:
        diseases = json.load(f)
    with open(DATA_PATH, 'r') as f:
        connections = json.load(f)

    by_id = {d['id']: d for d in diseases}
    terms = {d['id']: get_search_term(d) for d in diseases}

    progress = load_progress()
    total = len(connections)
    fetched = 0
    cached = 0
    failed = 0

    print(f'Regenerating sharedPapers for {total} connections from live PubMed co-occurrence...')
    print()

    for i, c in enumerate(connections):
        key = f'{c["source"]}|{c["target"]}'
        if key in progress and progress[key] is not None:
            c['sharedPapers'] = progress[key]
            cached += 1
            continue

        if c['source'] not in by_id or c['target'] not in by_id:
            print(f'[{i+1}/{total}] {key} — unknown disease id, skipping', file=sys.stderr)
            failed += 1
            continue

        query = f'({terms[c["source"]]}) AND ({terms[c["target"]]})'
        print(f'[{i+1}/{total}] {key} :: {query}', end=' ', flush=True)

        count = pubmed_count(query)
        time.sleep(RATE_LIMIT_DELAY)

        if count is None:
            print('FAILED — keeping existing value')
            failed += 1
            continue

        old = c['sharedPapers']
        c['sharedPapers'] = count
        progress[key] = count
        fetched += 1
        ratio = f'{old / count:.1f}x' if count else 'inf'
        print(f'-> {count} (was {old}, off by {ratio})')

        if fetched % WRITE_EVERY == 0:
            save_progress(progress)
            with open(DATA_PATH, 'w') as f:
                json.dump(connections, f, indent=2)

    save_progress(progress)

    # Pairs with zero real co-occurrence are not connections. Drop them rather
    # than storing a weight the data does not support.
    kept = [c for c in connections if c['sharedPapers'] > 0]
    dropped = len(connections) - len(kept)

    with open(DATA_PATH, 'w') as f:
        json.dump(kept, f, indent=2)

    counts = [c['sharedPapers'] for c in kept]
    print()
    print(f'Done. Fetched: {fetched}, from cache: {cached}, failed: {failed}')
    print(f'Dropped (zero real co-occurrence): {dropped}; kept: {len(kept)}')
    if counts:
        print(f'sharedPapers min={min(counts)} max={max(counts)} distinct={len(set(counts))}')

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
