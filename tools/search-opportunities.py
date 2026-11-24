"""Report real Search Console query/page pairs for the Ehsan portfolio."""
import argparse
import csv
import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

BUYER = r'(?i)(apartment|apartmen|kondo|condo|serviced residence|residensi|rumah|property|properties|perumahan|bungalow|banglo|townhouse|terrace|teres|semi.d|shop.?office|kedai|freehold|landed|pemaju|developer|untuk dijual|for sale)'


def query_rows(site, token, filters, end):
    url = 'https://www.googleapis.com/webmasters/v3/sites/' + quote(site, safe='') + '/searchAnalytics/query'
    start = end - timedelta(days=89)
    offset = 0
    while True:
        payload = dict(startDate=start.isoformat(), endDate=end.isoformat(),
                       dimensions=['query', 'page'], type='web', dataState='final',
                       dimensionFilterGroups=[{'filters': filters}], rowLimit=25000, startRow=offset)
        request = Request(url, data=json.dumps(payload).encode(), headers={
            'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        with urlopen(request, timeout=30) as response:
            batch = json.load(response).get('rows', [])
        yield from batch
        if len(batch) < payload['rowLimit']:
            return
        offset += len(batch)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', default='sc-domain:ehsanproperty.com')
    parser.add_argument('--end', type=date.fromisoformat, default=date.today() - timedelta(days=3))
    parser.add_argument('--page', help='Exact canonical URL. Show all returned queries to review before editing.')
    parser.add_argument('--min-impressions', type=int, default=100)
    parser.add_argument('--max-ctr-percent', type=float, default=1.0)
    args = parser.parse_args()
    token = os.getenv('GSC_ACCESS_TOKEN')
    if not token:
        parser.exit(2, 'Set GSC_ACCESS_TOKEN to a read-only Search Console OAuth access token.\n')
    if args.page:
        filters = [dict(dimension='page', operator='equals', expression=args.page)]
    else:
        projects = json.loads((Path(__file__).resolve().parents[1] / 'data/projects.json').read_text())
        names = ['ehsan'] + [p['name'] for p in projects.values() if p.get('name') and p['name'] != p.get('location')]
        brand = '(?i)(' + '|'.join(re.escape(name).replace(r'\ ', ' ') for name in names) + ')'
        filters = [dict(dimension='query', operator='includingRegex', expression=BUYER),
                   dict(dimension='query', operator='excludingRegex', expression=brand)]
    try:
        rows = list(query_rows(args.site, token, filters, args.end))
    except HTTPError as exc:
        parser.exit(1, f'Search Console returned HTTP {exc.code}. Check property access and token validity.\n')
    except (URLError, TimeoutError):
        parser.exit(1, 'Search Console could not be reached.\n')
    if not args.page:
        rows = [r for r in rows if r['impressions'] >= args.min_impressions and r['ctr'] * 100 <= args.max_ctr_percent]
    rows.sort(key=lambda r: (-r['impressions'], r['keys']))
    output = csv.writer(sys.stdout)
    output.writerow(['query', 'page', 'impressions', 'clicks', 'CTR percent', 'average position'])
    for row in rows if args.page else rows[:10]:
        keys = [("'" + v if v.lstrip().startswith(('=', '+', '-', '@')) else v) for v in row['keys']]
        output.writerow([*keys, row['impressions'], row['clicks'], round(row['ctr'] * 100, 3), round(row['position'], 2)])


if __name__ == '__main__':
    main()
