"""Exercise the public HTTP handler without a listening socket or CMS."""
import io
import unittest
from unittest.mock import patch

from serve import Handler


class Request:
    def __init__(self, method, path):
        self.input = io.BytesIO(f'{method} {path} HTTP/1.0\r\n\r\n'.encode())
        self.output = bytearray()

    def makefile(self, *_):
        return self.input

    def sendall(self, data):
        self.output.extend(data)


def response(method, path):
    request = Request(method, path)
    with patch.object(Handler, 'log_message'):
        Handler(request, ('127.0.0.1', 1000), None)
    return bytes(request.output).split(b'\r\n\r\n', 1)


class PublicRoutes(unittest.TestCase):
    def test_head_returns_get_headers_without_the_body(self):
        for path in ['/', '/projects', '/js/public-data.js']:
            with self.subTest(path=path):
                headers, body = response('GET', path)
                head, empty = response('HEAD', path)
                self.assertIn(b'200 OK', headers)
                self.assertIn(b'200 OK', head)
                self.assertIn(f'Content-Length: {len(body)}'.encode(), head)
                self.assertEqual(empty, b'')

    def test_legacy_redirect_retains_campaign_parameters(self):
        with patch('serve.records', return_value={'old': {'slug': 'new'}}):
            headers, _ = response('GET', '/html/project-detail.html?project=old&tag=a&tag=b&campaign=')
        self.assertIn(b'308 ', headers)
        self.assertIn(b'Location: /projects/new?tag=a&tag=b&campaign=', headers)

    def test_public_server_limits_static_files(self):
        for path in ['/README.md', '/tools/', '/data/']:
            with self.subTest(path=path):
                headers, _ = response('GET', path)
                self.assertIn(b'404 ', headers)


if __name__ == '__main__':
    unittest.main()
