// api/[slug].js
import { kv } from '@vercel/kv';

// Simple user-agent parser (lightweight)
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

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(404).send('Not found');
  }

  // Look up original URL
  const originalUrl = await kv.get(`short:${slug}`);
  if (!originalUrl) {
    return res.status(404).send('Link not found');
  }

  // ---------- ANALYTICS LOGGING ----------
  try {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const country = req.headers['x-vercel-ip-country'] || 'Unknown'; // Vercel provides this

    const { device, browser } = parseUA(userAgent);

    // Increment total clicks
    await kv.incr(`analytics:total:${slug}`);

    // Add IP to unique visitors set
    await kv.sadd(`analytics:unique:${slug}`, ip);

    // Increment device count
    await kv.hincrby(`analytics:devices:${slug}`, device, 1);

    // Increment browser count
    await kv.hincrby(`analytics:browsers:${slug}`, browser, 1);

    // Increment country count
    await kv.hincrby(`analytics:countries:${slug}`, country, 1);

    // Update last click timestamp
    await kv.set(`analytics:last_click:${slug}`, timestamp);

    // Store recent click (keep last 50)
    const clickRecord = JSON.stringify({ timestamp, device, browser, country, ip });
    await kv.lpush(`analytics:recent:${slug}`, clickRecord);
    await kv.ltrim(`analytics:recent:${slug}`, 0, 49);

  } catch (error) {
    console.error('Analytics error:', error);
    // Don't block redirect, just log error
  }

  // Redirect to original URL
  return res.redirect(302, originalUrl);
}
