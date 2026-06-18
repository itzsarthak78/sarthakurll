import { kv } from '@vercel/kv';

function parseUA(userAgent) {
  const ua = userAgent || '';
  let device = 'Desktop';
  let browser = 'Other';

  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    device = 'Mobile';
  }

  if (/chrome/i.test(ua) && !/edge|opr/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge/i.test(ua)) browser = 'Edge';

  return { device, browser };
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(404).send('Not found');
  }

  const originalUrl = await kv.get(`short:${slug}`);

  if (!originalUrl) {
    return res.status(404).send('Link not found');
  }

  try {
    const timestamp = new Date().toISOString();
    const ip =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      'unknown';

    const country =
      req.headers['x-vercel-ip-country'] ||
      'Unknown';

    const { device, browser } = parseUA(
      req.headers['user-agent'] || ''
    );

    // Total clicks
    await kv.incr(`stats:clicks:${slug}`);

    // Unique visitors
    await kv.sadd(`analytics:unique:${slug}`, ip);

    // Devices
    await kv.hincrby(
      `analytics:devices:${slug}`,
      device,
      1
    );

    // Browsers
    await kv.hincrby(
      `analytics:browsers:${slug}`,
      browser,
      1
    );

    // Countries
    await kv.hincrby(
      `analytics:countries:${slug}`,
      country,
      1
    );

    // Last click
    await kv.set(
      `analytics:last_click:${slug}`,
      timestamp
    );

    // Recent history
    const clickRecord = JSON.stringify({
      timestamp,
      device,
      browser,
      country
    });

    await kv.lpush(
      `analytics:recent:${slug}`,
      clickRecord
    );

    await kv.ltrim(
      `analytics:recent:${slug}`,
      0,
      49
    );

  } catch (error) {
    console.error('ANALYTICS ERROR:', error);
  }

  return res.redirect(302, originalUrl);
}
