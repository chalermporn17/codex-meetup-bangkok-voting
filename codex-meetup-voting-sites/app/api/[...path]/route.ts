import { proxyUpstream } from '@/lib/proxy-upstream';

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyUpstream(request, 'api', path);
}

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
