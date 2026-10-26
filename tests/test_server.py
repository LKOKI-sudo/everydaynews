"""Check the public WSGI contract without relying on external feeds."""
import unittest
from unittest.mock import patch
from wsgiref.util import setup_testing_defaults

import server


class ServerTests(unittest.TestCase):
    def request(self, path, method='GET'):
        environ = {}
        setup_testing_defaults(environ)
        environ.update(PATH_INFO=path, REQUEST_METHOD=method)
        response = {}

        def start_response(status, headers):
            response.update(status=status, headers=dict(headers))

        response['body'] = b''.join(server.application(environ, start_response))
        return response

    def test_assets_and_head(self):
        for path in server.ASSETS:
            with self.subTest(path=path):
                get = self.request(path)
                head = self.request(path, 'HEAD')
                self.assertEqual(get['status'], '200 OK')
                self.assertTrue(get['body'])
                self.assertEqual(head['body'], b'')
                self.assertEqual(head['headers'], get['headers'])

    def test_health_does_not_fetch_feeds(self):
        with patch.object(server, 'news', side_effect=AssertionError('feed requested')):
            self.assertEqual(self.request('/healthz')['body'], b'ok\n')

    def test_news_response(self):
        with patch.object(server, 'news', return_value={'stories': []}):
            response = self.request('/api/news')
        self.assertEqual(response['body'], b'{"stories": []}')
        self.assertEqual(response['headers']['Cache-Control'], 'no-store')
        self.assertIn('application/json', response['headers']['Content-Type'])

    def test_private_files_and_traversal_are_not_served(self):
        for path in ('/server.py', '/requirements.txt', '/render.yaml', '/.env', '/../README.md'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)['status'], '404 Not Found')

    def test_unsupported_method(self):
        response = self.request('/api/news', 'POST')
        self.assertEqual(response['status'], '405 Method Not Allowed')
        self.assertEqual(response['headers']['Allow'], 'GET, HEAD')


if __name__ == '__main__':
    unittest.main()
