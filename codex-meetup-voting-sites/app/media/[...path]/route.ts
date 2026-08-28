import { proxyUpstream } from '@/lib/proxy-upstream';

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyUpstream(request, 'media', path);
}

export const GET = handler;
export const HEAD = handler;
