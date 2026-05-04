/**
 * Echo TMDB Proxy — Vercel Edge Function
 *
 * 路由（与 CF Worker 版完全一致，客户端 URL 配置相同）：
 *   /img/<path>     → https://image.tmdb.org/<path>     （公开，无需 secret）
 *   /<其他路径>      → https://api.themoviedb.org/3/<同路径>  （需 X-Echo-App-Secret 头）
 *
 * 环境变量（在 Vercel Dashboard → Project → Settings → Environment Variables 配置）：
 *   TMDB_TOKEN   — TMDB Bearer Token
 *   APP_SECRET   — 客户端随机共享密钥
 */

export const config = { runtime: 'edge' };

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE = 'https://image.tmdb.org';

export default async function handler(req) {
  const url = new URL(req.url);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 图片代理：/img/t/p/w500/abc.jpg → image.tmdb.org/t/p/w500/abc.jpg
  if (url.pathname.startsWith('/img/')) {
    const imgPath = url.pathname.substring(4);
    const resp = await fetch(`${TMDB_IMG_BASE}${imgPath}`);
    return new Response(resp.body, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  }

  // API 代理：校验共享密钥
  const presented = req.headers.get('X-Echo-App-Secret');
  if (!process.env.APP_SECRET || presented !== process.env.APP_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!process.env.TMDB_TOKEN) {
    return new Response('TMDB_TOKEN not configured', { status: 500 });
  }

  const target = `${TMDB_API_BASE}${url.pathname}${url.search}`;
  const resp = await fetch(target, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
      Accept: 'application/json',
    },
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': resp.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
