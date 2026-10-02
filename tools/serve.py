"""Serve public pages with readable URLs and backwards-compatible redirects.

Run from the repository root: python3 tools/serve.py --port 8899
"""
import argparse
import json
import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, quote
from urllib.request import urlopen
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent.parent
CACHE = {}
PAGES = {'about': 'about', 'projects': 'projects', 'events': 'events', 'news': 'news'}

def slug(record):
    text = record.get('slug') or record.get('name') or record.get('title') or record.get('id', '')
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')[:80]

def records(kind):
    cached = CACHE.get(kind)
    if cached and time.time() - cached[0] < 10:
        return cached[1]
    try:
        with urlopen(f'http://localhost:3001/api/public/{kind}.json', timeout=3) as response:
            data = json.load(response)
    except Exception:
        data = json.loads((ROOT / 'data' / f'{kind}.json').read_text())
    if kind == 'news':
        data = {item['id']: item for item in data.get('articles', []) if item.get('published') and not item.get('archived')}
    CACHE[kind] = (time.time(), data)
    return data

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlsplit(self.path)
        path = parsed.path
        query = ('?' + parsed.query) if parsed.query else ''
        legacy = {'/index.html': '/', **{f'/html/{name}.html': f'/{name}' for name in PAGES}}
        if path in legacy and 'landing-editor' not in parse_qs(parsed.query):
            return self.redirect(legacy[path] + query)
        match = re.fullmatch(r'/html/(project|event|news)-detail\.html', path)
        if match:
            kind = {'project': 'projects', 'event': 'events', 'news': 'news'}[match[1]]
            reference = parse_qs(parsed.query).get(match[1], [''])[0].rstrip('.,;')
            record = records(kind).get(reference)
            if record:
                params = parse_qs(parsed.query)
                if 'landing-editor' not in params:
                    return self.redirect(f'/{kind}/{slug(record)}')
        if path.rstrip('/') in [f'/{name}' for name in PAGES]:
            if path.endswith('/'):
                return self.redirect(path.rstrip('/') + query)
            return self.page(f'html/{PAGES[path[1:]]}.html')
        match = re.fullmatch(r'/(projects|events|news)/([a-z0-9-]+)/?', path)
        if match:
            if path.endswith('/'):
                return self.redirect(path.rstrip('/') + query)
            kind, name = match.groups()
            if not any(slug(record) == name for record in records(kind).values()):
                self.send_error(404, 'This page is not available')
                return
            detail = {'projects': 'project', 'events': 'event', 'news': 'news'}[kind]
            return self.page(f'html/{detail}-detail.html')
        super().do_GET()

    def do_HEAD(self):
        self.head_only = True
        self.do_GET()

    def redirect(self, destination):
        self.send_response(308)
        self.send_header('Location', quote(destination, safe='/?=&%#'))
        self.send_header('Content-Length', '0')
        self.end_headers()

    def page(self, source):
        body = (ROOT / source).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if not getattr(self, 'head_only', False):
            self.wfile.write(body)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8899)
    args = parser.parse_args()
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
