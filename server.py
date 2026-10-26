"""The Brief — RSS news reader with a WSGI entry point for deployment."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from wsgiref.simple_server import make_server
from pathlib import Path
import argparse
import html
import json
import mimetypes
import os
import re
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
FEEDS = [
    ('BBC News', 'technology', 'https://feeds.bbci.co.uk/news/technology/rss.xml'),
    ('The Guardian', 'technology', 'https://www.theguardian.com/technology/rss'),
    ('BBC News', 'politics', 'https://feeds.bbci.co.uk/news/politics/rss.xml'),
    ('NPR', 'politics', 'https://feeds.npr.org/1014/rss.xml'),
]
FEEDS.append(('BBC News', 'politics', 'https://feeds.bbci.co.uk/news/world/rss.xml'))

cache = {'at': 0, 'data': None}
lock = threading.Lock()


def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', value or ''))).strip()


def fetch_feed(feed):
    source, category, url = feed
    request = urllib.request.Request(url, headers={'User-Agent': 'TheBrief/1.0 RSS reader'})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            root = ET.fromstring(response.read(3_000_000))
        stories = []
        for item in root.findall('./channel/item')[:20]:
            link = item.findtext('link', '')
            title = clean(item.findtext('title'))
            if not title or not link.startswith(('https://', 'http://')):
                continue
            try:
                published = parsedate_to_datetime(item.findtext('pubDate')).isoformat()
            except (TypeError, ValueError, OverflowError):
                published = None
            summary = clean(item.findtext('description'))
            # Feed descriptions are publisher-written abstracts, not generated claims.
            if len(summary) > 480:
                summary = summary[:477].rsplit(' ', 1)[0] + '…'
            stories.append(dict(id=link, title=title, url=link, summary=summary,
                                source=source, category=category, published=published,
                                region=('us' if source == 'NPR' else 'uk' if category == 'politics' and '/world/' not in url else 'world')))
        return stories, None
    except Exception:
        return [], source + ' · ' + category


def news():
    with lock:
        if cache['data'] and time.time() - cache['at'] < 300:
            return cache['data']
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(fetch_feed, FEEDS))
        stories, failures, seen = [], [], set()
        for batch, failure in results:
            if failure:
                failures.append(failure)
            for story in batch:
                key = story['url']
                if key not in seen:
                    seen.add(key)
                    stories.append(story)
        stories.sort(key=lambda s: s['published'] or '', reverse=True)
        if not stories and cache['data'] and cache['data']['stories']:
            return {**cache['data'], 'stale': True, 'unavailable': failures}
        data = dict(stories=stories, updatedAt=datetime.now(timezone.utc).isoformat(),
                    unavailable=failures, stale=False)
        if stories:
            cache.update(at=time.time(), data=data)
        return data


ASSETS = {'/': 'index.html', **{
    '/' + name: name for name in
    ('index.html', 'style.css', 'app.js', 'theme.js', 'reader.js')
}}


def application(environ, start_response):
    """Serve only public assets, news, and a feed-independent health check."""
    method = environ.get('REQUEST_METHOD', 'GET')
    path = environ.get('PATH_INFO', '/')
    headers = []
    status = '200 OK'
    content_type = 'text/plain; charset=utf-8'
    if method not in ('GET', 'HEAD'):
        status, payload = '405 Method Not Allowed', b'Method not allowed\n'
        headers.append(('Allow', 'GET, HEAD'))
    elif path == '/healthz':
        payload = b'ok\n'
    elif path == '/api/news':
        payload = json.dumps(news()).encode()
        content_type = 'application/json; charset=utf-8'
        headers.append(('Cache-Control', 'no-store'))
    elif path in ASSETS:
        asset = ROOT / ASSETS[path]
        payload = asset.read_bytes()
        content_type = mimetypes.guess_type(str(asset))[0] or 'application/octet-stream'
        headers.append(('Cache-Control', 'no-cache'))
    else:
        status, payload = '404 Not Found', b'Not found\n'
    headers.extend([('Content-Type', content_type), ('Content-Length', str(len(payload)))])
    start_response(status, headers)
    return [] if method == 'HEAD' else [payload]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '8000')))
    parser.add_argument('--host', default=os.environ.get('HOST', '127.0.0.1'))
    args = parser.parse_args()
    print(f'The Brief is ready at http://{args.host}:{args.port}', flush=True)
    with make_server(args.host, args.port, application) as server:
        server.serve_forever()
