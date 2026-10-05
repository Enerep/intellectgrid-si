#!/usr/bin/env python3
"""Serve only public assets, with the same security headers used on Vercel."""
import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEADERS = json.loads((ROOT / 'vercel.json').read_text())['headers'][0]['headers']

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        for header in HEADERS:
            self.send_header(header['key'], header['value'])
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4311)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(ROOT / 'public'))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print(f'IntellectGrid preview: http://127.0.0.1:{args.port}', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
