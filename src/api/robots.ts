import type { VercelRequest, VercelResponse } from '@vercel/node';

const ROBOTS = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /admin/
Disallow: /gate
Disallow: /access-denied

Sitemap: https://bullertrading.vercel.app/sitemap.xml
Host: bullertrading.vercel.app
`;

export default function robots(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method not allowed');
  }
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return response.status(200).send(ROBOTS);
}