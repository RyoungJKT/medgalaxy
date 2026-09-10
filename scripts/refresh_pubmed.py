#!/usr/bin/env python3
"""
Refresh PubMed publication data for all diseases in diseases.json.
Updates: papers (total count), yearlyPapers (last 10 years), trend (% change),
and, through reconcile_connections below, any sharedPapers count those fresh
totals leave describing a different query.
Does NOT touch: mortality, description, category, fundingGap, the curated pair
list itself.
"""

import datetime
import json
import os
import sys
import time
import urllib.request
import urllib.error

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'diseases.json')
META_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'meta.json')
SEARCH_OVERRIDES_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'search-overrides.json')
CONNECTIONS_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'connections.json')

# Override search terms for diseases whose labels don't work as-is. Loaded
# from data/search-overrides.json — the single source of truth shared with
# scripts/backfill_yearly.py and src/utils/pubmedTerms.js (Sidebar's "View on
# PubMed" link), so the query this script runs and the link the UI shows can
# never drift apart.
with open(SEARCH_OVERRIDES_PATH, 'r') as _f:
    SEARCH_OVERRIDES = json.load(_f)

YEARS = list(range(2015, 2025))  # 10 years of data
RATE_LIMIT_DELAY = 0.35  # seconds between requests

# A week of new indexing moves a disease's all-time total by a fraction of a
# percent. A move this large is the fingerprint of something else: the search
# term behind that total is no longer the term the old total answered, which
# makes the new number the answer to a different question. That happens two
# ways, and this detector does not care which. Either PubMed changes its own
# automatic mapping for the phrase, or the term itself changes here, because
# get_search_term falls back to the disease's label whenever
# data/search-overrides.json has no entry for it. Colorectal Cancer went from
# 180,574 to 351,932 between the 2026-08-10 and 2026-09-11 snapshots the second
# way: the row was labelled "Colon Cancer" for the 2026-08-10 run and was
# renamed "Colorectal Cancer" afterwards, so 2026-09-11 was simply its first
# refresh under the new term. A rename must therefore be followed by a
# re-backfill of that row's frozen years under the new term, which is what was
# run for this one; otherwise its older years keep answering the old term.
# The pair counts stored beside such a total were measured against the old
# term, and the sharedPapers <= min(papers) invariant below can never catch
# that, because a total that GREW only makes the invariant easier to satisfy.
# So a jump re-queries that disease's pairs on its own.
MAPPING_JUMP = 0.25    # fractional move of the total in a single weekly run
MAPPING_JUMP_MIN = 200  # papers, so a tiny row's ordinary churn is not a jump


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
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as e:
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
    trend = max(-999, min(999, trend))

    # Update disease record (only PubMed fields)
    disease['papers'] = total
    prior = disease.get('yearlyPapers', [])
    year_start = disease.get('yearStart', YEARS[0])
    prefix_len = YEARS[0] - year_start  # 25 after backfill, 0 before
    disease['yearlyPapers'] = prior[:prefix_len] + yearly
    disease['trend'] = trend
    return True


def is_mapping_jump(old, new):
    """True when a total moved further in one run than new indexing explains."""
    if not old or old <= 0 or new is None:
        return False
    delta = abs(new - old)
    return delta >= MAPPING_JUMP_MIN and delta / old >= MAPPING_JUMP


def reconcile_connections(diseases, jumped=None):
    """
    Keep connections.json consistent with the totals this refresh just wrote.

    Two things can leave a pair count describing a different PubMed query from
    the totals printed beside it, and each has its own trigger here.

    1. The count no longer fits inside its endpoints' totals. A co-occurrence
       count and its two endpoint totals only satisfy sharedPapers <=
       min(endpoint papers) when they describe the same snapshot. Totals move
       on every weekly refresh while pair counts were measured once
       (scripts/regenerate_connections.py), so a pair measured after a total
       was can exceed it by a few papers.
    2. An endpoint's total jumped (see MAPPING_JUMP): its search term is no
       longer the term the old total answered, either because the row was
       renamed here or because PubMed remapped the phrase, so the stored pair
       counts answer the old term's query. Nothing about the invariant in 1
       can see this when the total grew, which is exactly how colorectal
       cancer's 13 pairs were left behind by the 2026-09-11 refresh while the
       run reported the connections consistent. `jumped` carries the ids
       main() measured.

    Rather than clamping (which would falsify the stored count's stated query),
    re-run the same "(termA) AND (termB)" all-time query for every pair either
    trigger names, so the pair count and the fresh totals describe the same
    snapshot again. If a re-queried pair still exceeds an endpoint's total
    (that endpoint's own refresh failed this run, or its total predates this
    reconciliation), the endpoints themselves are re-fetched.
    tests/dataInvariants.test.js holds the shipped data to the invariant and
    tests/pipelineDisclosure.test.js holds the methodology panel's sentence to
    what this function does.

    Returns the number of problems left (0 on success): violations that
    survived the re-query, pairs whose re-query failed or returned zero, and
    endpoint re-refreshes that failed.
    """
    with open(CONNECTIONS_PATH, 'r') as f:
        connections = json.load(f)
    by_id = {d['id']: d for d in diseases}
    jumped = set(jumped or ())

    def violates(c):
        a, b = by_id.get(c['source']), by_id.get(c['target'])
        if a is None or b is None:
            return False
        return c['sharedPapers'] > min(a['papers'], b['papers'])

    def touches_jumped(c):
        return c['source'] in jumped or c['target'] in jumped

    stale = [c for c in connections if violates(c) or touches_jumped(c)]
    if not stale:
        print('Connections already consistent with the refreshed totals.')
        return 0

    if jumped:
        print(f'Totals that moved more than {int(MAPPING_JUMP * 100)}% this run: {", ".join(sorted(jumped))}')
    print(f'Re-querying {len(stale)} connection(s) left behind by the refreshed totals...')
    changed = False
    problems = 0
    requeried = {}
    for c in stale:
        a, b = by_id[c['source']], by_id[c['target']]
        query = f'({get_search_term(a)}) AND ({get_search_term(b)})'
        count = pubmed_count(query)
        time.sleep(RATE_LIMIT_DELAY)
        if count is None:
            print(f'  {c["source"]}|{c["target"]}: FAILED, keeping existing value', file=sys.stderr)
            problems += 1
            continue
        if count == 0:
            # A pair that held tens of thousands of shared papers does not
            # honestly drop to zero between snapshots; that is a PubMed
            # anomaly or a term problem, and writing 0 would silently delete
            # the connection's weight. Keep the old value and flag the run.
            print(f'  WARNING: {c["source"]}|{c["target"]} re-queried as 0 (was {c["sharedPapers"]}); '
                  'keeping existing value, investigate the term', file=sys.stderr)
            problems += 1
            continue
        old = c['sharedPapers']
        c['sharedPapers'] = count
        requeried[f'{c["source"]}|{c["target"]}'] = count
        changed = True
        print(f'  {c["source"]}|{c["target"]}: {old} -> {count}')
        if violates(c):
            # The pair count is now fresher than a total: bring both endpoints
            # to the same snapshot.
            for d in (a, b):
                print(f'  re-refreshing endpoint {d["id"]} to the same snapshot...')
                if not refresh_disease(d):
                    print(f'  WARNING: endpoint {d["id"]} re-refresh failed; its total may still '
                          'describe the older snapshot', file=sys.stderr)
                    problems += 1
                time.sleep(RATE_LIMIT_DELAY)

    still = [c for c in connections if violates(c)]
    if changed:
        with open(CONNECTIONS_PATH, 'w') as f:
            json.dump(connections, f, indent=2)
        with open(DATA_PATH, 'w') as f:
            json.dump(diseases, f, indent=2)
        # regenerate_connections.py resumes from its progress cache when one
        # exists, and a cached pre-reconciliation count would silently revert
        # what was just re-queried. Keep any existing cache entry in step.
        progress_path = os.path.join(os.path.dirname(__file__), '.connections_progress.json')
        if requeried and os.path.exists(progress_path):
            with open(progress_path, 'r') as f:
                progress = json.load(f)
            progress.update(requeried)
            with open(progress_path, 'w') as f:
                json.dump(progress, f, indent=0)
            print(f'Updated {len(requeried)} entr(ies) in {os.path.basename(progress_path)}.')
    for c in still:
        print(f'  WARNING: {c["source"]}|{c["target"]} still exceeds an endpoint total after re-query',
              file=sys.stderr)
    return len(still) + problems


def main():
    with open(DATA_PATH, 'r') as f:
        diseases = json.load(f)

    total = len(diseases)
    updated = 0
    failed = 0
    jumped = set()

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
            if is_mapping_jump(old_papers, disease['papers']):
                jumped.add(disease['id'])
                print(f'  NOTE: total moved {delta_str} in one run, past the {int(MAPPING_JUMP * 100)}% '
                      'mapping-change threshold; this row\'s pairs will be re-queried')
        else:
            print('FAILED — keeping existing data')
            failed += 1

        time.sleep(RATE_LIMIT_DELAY)

    # Write back
    with open(DATA_PATH, 'w') as f:
        json.dump(diseases, f, indent=2)

    # Now that every total describes today's snapshot, bring any connection
    # measured against an older snapshot along with it.
    leftover = reconcile_connections(diseases, jumped)

    # Update meta.json's lastRefresh date alongside diseases.json
    if os.path.exists(META_PATH):
        with open(META_PATH, 'r') as f:
            meta = json.load(f)
    else:
        meta = {}
    meta['pubmedLastRefresh'] = datetime.date.today().isoformat()
    with open(META_PATH, 'w') as f:
        json.dump(meta, f, indent=2)

    print()
    print(f'Done. Updated: {updated}, Failed: {failed}, Total: {total}')

    if failed > 0 or leftover > 0:
        sys.exit(1)


if __name__ == '__main__':
    # --reconcile-only: run just the connections reconciliation against the
    # totals already on disk (the weekly run does it automatically after the
    # totals refresh). For fixing a snapshot skew without a full refresh.
    #
    # --jumped id[,id...]: name diseases whose totals are known to have moved
    # under a changed search term, so their pairs are re-queried even though
    # they break no invariant. A full run measures this for itself; this flag
    # is how a skew found after the run is repaired through the same code path
    # instead of by hand.
    if '--reconcile-only' in sys.argv:
        _jumped = set()
        for _i, _a in enumerate(sys.argv):
            if _a == '--jumped' and _i + 1 < len(sys.argv):
                _jumped = {s for s in sys.argv[_i + 1].split(',') if s}
        with open(DATA_PATH, 'r') as f:
            _diseases = json.load(f)
        sys.exit(1 if reconcile_connections(_diseases, _jumped) > 0 else 0)
    main()
