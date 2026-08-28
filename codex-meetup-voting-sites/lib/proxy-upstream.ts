const UPSTREAM_ORIGIN = 'https://codex-meetup-bangkok-voting.gs5zbddkpy.workers.dev';

const REQUEST_HEADERS_TO_REMOVE = [
  'connection',
  'content-length',
  'host',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
];

export async function proxyUpstream(
  request: Request,
  prefix: 'api' | 'media',
  path: string[],
): Promise<Response> {
  const encodedPath = path.map(encodeURIComponent).join('/');
  const upstreamUrl = new URL(`/${prefix}/${encodedPath}`, UPSTREAM_ORIGIN);
  upstreamUrl.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  for (const name of REQUEST_HEADERS_TO_REMOVE) headers.delete(name);

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: 'The event service is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
