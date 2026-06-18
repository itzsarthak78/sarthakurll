import { kv } from '@vercel/kv';

// ----------------------------------------------
// Simple user‑agent parser
// ----------------------------------------------
function parseUA(userAgent) {
  const ua = userAgent || '';
  let device = 'Desktop';
  let browser = 'Other';

  // Device detection
  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    device = 'Mobile';
  }

  // Browser detection
  if (/chrome/i.test(ua) && !/edge|opr|brave/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/brave/i.test(ua)) browser = 'Brave';

  return { device, browser };
}

// ----------------------------------------------
// Main handler
// ----------------------------------------------
export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(404).send('Not found');
  }

  // ----- DO NOT MODIFY: Lookup + redirect -----
  const originalUrl = await kv.get(`short:${slug}`);

  if (!originalUrl) {
    return res.status(404).send('Link not found');
  }

  // Increment total clicks (keep existing)
  await kv.incr(`stats:clicks:${slug}`);

  // --------------------------------------------
  // ANALYTICS TRACKING (wrapped in try/catch)
  // --------------------------------------------
  try {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const country = req.headers['x-vercel-ip-country'] || 'Unknown';

    const { device, browser } = parseUA(userAgent);

    // 1. Unique visitors (set of IPs)
    await kv.sadd(`analytics:unique:${slug}`, ip);

    // 2. Device breakdown
    await kv.hincrby(`analytics:devices:${slug}`, device, 1);

    // 3. Browser breakdown
    await kv.hincrby(`analytics:browsers:${slug}`, browser, 1);

    // 4. Country breakdown
    await kv.hincrby(`analytics:countries:${slug}`, country, 1);

    // 5. Last click timestamp
    await kv.set(`analytics:last_click:${slug}`, timestamp);

    // 6. Recent click history (keep last 50)
    const clickRecord = JSON.stringify({ timestamp, device, browser, country, ip });
    await kv.lpush(`analytics:recent:${slug}`, clickRecord);
    await kv.ltrim(`analytics:recent:${slug}`, 0, 49);

  } catch (error) {
    // Log error but NEVER block the redirect
    console.error('Analytics error:', error);
  }

  // ----- DO NOT MODIFY: Redirect -----
  return res.redirect(302, originalUrl);
}
