const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle WebAssembly files used by expo-sqlite's web worker
config.resolver.assetExts.push('wasm');

// In development, proxy /v1/* and /healthz to the API server on port 3000.
// This keeps the browser on a single origin (port 5000) so no CORS preflight
// is needed and EXPO_PUBLIC_API_URL can stay empty (relative URLs work).
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      const url = req.url ?? '';
      if (url.startsWith('/v1/') || url === '/healthz') {
        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: 3000,
            path: url,
            method: req.method,
            headers: { ...req.headers, host: 'localhost:3000' },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );
        proxyReq.on('error', () => {
          if (!res.headersSent) res.writeHead(503);
          res.end('{"error":"API server is not running"}');
        });
        req.pipe(proxyReq, { end: true });
        return;
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
