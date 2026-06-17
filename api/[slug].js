import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { slug } = req.query; // this is the dynamic part

  if (!slug || typeof slug !== 'string') {
    return res.status(404).send('Not found');
  }

  // Look up the original URL
  const originalUrl = await kv.get(`short:${slug}`);
  if (!originalUrl) {
    return res.status(404).send('Link not found');
  }

  // (Optional) Increment click counter
  await kv.incr(`stats:clicks:${slug}`);

  // Redirect with 302 (temporary)
  return res.redirect(302, originalUrl);
}
