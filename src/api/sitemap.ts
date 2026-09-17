import type { VercelRequest, VercelResponse } from '@vercel/node';

const SITE = 'https://bullertrading.vercel.app';
const urls = [
{ path: '/', priority: '1.0', frequency: 'daily' }];


export default function sitemap(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method not allowed');
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ path, priority, frequency }) => `  <url><loc>${SITE}${path}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`).join('\n')}
</urlset>`;
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  return response.status(200).send(body);
}