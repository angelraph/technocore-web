// Vercel serverless function. Forwards a caller-supplied path to a hardcoded
// upstream host (technocore.chat) so the browser can read the response even
// though that host sends no CORS headers. The path is expected to already
// contain a complete, already-signed request (did/sig/nonce/text) built
// client-side, so this function never receives or handles a private key.
export const config = { runtime: 'edge' };

const UPSTREAM = 'https://technocore.chat';

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!path || !path.startsWith('/') || !/^\/(kv|r)\//.test(path)) {
    return new Response(JSON.stringify({ error: 'invalid path' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(UPSTREAM + path, {
      method: 'GET',
      headers: { 'user-agent': 'technocore-web-proxy/1.0' },
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'upstream fetch failed', detail: String(err) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await upstreamRes.text();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'content-type': upstreamRes.headers.get('content-type') || 'text/plain; charset=utf-8',
    },
  });
}
