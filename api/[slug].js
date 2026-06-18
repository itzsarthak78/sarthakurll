import { kv } from '@vercel/kv';

function parseUA(userAgent) {
  const ua = userAgent || '';
  let device = 'Desktop';
  let browser = 'Other';

  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    device = 'Mobile';
  }

  if (/chrome/i.test(ua) && !/edge|opr|brave/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/brave/i.test(ua)) browser = 'Brave';

  return { device, browser };
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(404).send('Not found');
  }

  // 1. Lookup original URL
  const originalUrl = await kv.get(`short:${slug}`);
  if (!originalUrl) {
    return res.status(404).send('Link not found');
  }

  // 2. Increment total clicks (kept as before)
  await kv.incr(`stats:clicks:${slug}`);

  // 3. ANALYTICS TRACKING (with error handling)
  try {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const country = req.headers['x-vercel-ip-country'] || 'Unknown';

    const { device, browser } = parseUA(userAgent);

    // Store unique visitor (IP set)
    await kv.sadd(`analytics:unique:${slug}`, ip);

    // Device, browser, country counts
    await kv.hincrby(`analytics:devices:${slug}`, device, 1);
    await kv.hincrby(`analytics:browsers:${slug}`, browser, 1);
    await kv.hincrby(`analytics:countries:${slug}`, country, 1);

    // Last click timestamp
    await kv.set(`analytics:last_click:${slug}`, timestamp);

    // Recent click history (last 50)
    const clickRecord = JSON.stringify({ timestamp, device, browser, country, ip });
    await kv.lpush(`analytics:recent:${slug}`, clickRecord);
    await kv.ltrim(`analytics:recent:${slug}`, 0, 49);

    console.log(`✅ Analytics saved for ${slug}`);

  } catch (error) {
    console.error('❌ Analytics error:', error);
    // Never block redirect
  }

  // 4. Redirect
  return res.redirect(302, originalUrl);
}
