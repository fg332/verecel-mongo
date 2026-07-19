/**
 * Nvidia API Reverse Proxy
 * Forwards requests to https://integrate.api.nvidia.com/v1 to bypass CORS restrictions.
 * Supports standard methods, headers forwarding, request/response streaming.
 */

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Determine target path relative to Nvidia Base URL
  let targetPath = '';
  if (req.url) {
    if (req.url.startsWith('/api/nvidia')) {
      targetPath = req.url.slice('/api/nvidia'.length);
    } else {
      // Fallback for rewrites (e.g. /api/nvidia?path=chat/completions)
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const pathParam = urlObj.searchParams.get('path');
        if (pathParam) {
          targetPath = '/' + pathParam;
          urlObj.searchParams.delete('path');
          const remainingSearch = urlObj.search;
          targetPath += remainingSearch;
        } else {
          const forwardUri = req.headers['x-forwarded-uri'] || req.headers['x-original-url'];
          if (forwardUri && forwardUri.startsWith('/api/nvidia')) {
            targetPath = forwardUri.slice('/api/nvidia'.length);
          } else {
            targetPath = req.url;
          }
        }
      } catch (e) {
        targetPath = req.url;
      }
    }
  }

  // Ensure targetPath starts with a single slash
  if (!targetPath.startsWith('/')) {
    targetPath = '/' + targetPath;
  }

  const targetUrl = `https://integrate.api.nvidia.com/v1${targetPath}`;

  // Filter and prepare headers to send to Nvidia
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    // Exclude hop-by-hop headers and host to avoid proxy issues
    if (!['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding'].includes(lowerKey)) {
      headers[key] = value;
    }
  }

  // Ensure application/json content-type is set if missing and body exists
  if (req.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  // Format request body
  let body = req.body;
  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
  }

  // Setup AbortController to cancel Nvidia request if client disconnects
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      console.log('Nvidia API Request aborted by client disconnection (response was not finished).');
      controller.abort();
    }
  });

  try {
    const fetchOptions = {
      method: req.method,
      headers: headers,
      signal: controller.signal
    };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase()) && body) {
      fetchOptions.body = body;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Set corresponding response status code
    res.statusCode = response.status;

    // Forward response headers
    for (const [key, value] of response.headers.entries()) {
      const lowerKey = key.toLowerCase();
      // Skip headers that should not be forwarded or are already handled by CORS/Vercel
      if (!['content-encoding', 'transfer-encoding', 'connection', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    }

    // Stream response body back to the client
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Nvidia API Request aborted by client disconnection.');
      return;
    }
    console.error('Nvidia proxy error:', error);
    
    // Fallback response if status code was not sent yet
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: `Failed to proxy request to Nvidia API: ${error.message}`
      }));
    }
  }
};
