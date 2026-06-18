import { kv } from '@vercel/kv';

function parseUA(userAgent = '') {
  let device = 'Desktop';
  let browser = 'Other';

  if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
    device = 'Mobile';
  }

  if (/chrome/i.test(userAgent) && !/edge|opr/i.test(userAgent))
    browser = 'Chrome';
  else if (/firefox/i.test(userAgent))
    browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent))
    browser = 'Safari';
  else if (/edge/i.test(userAgent))
    browser = 'Edge';

  return { device, browser };
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
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

    // Device stats
    await kv.hincrby(
      `analytics:devices:${slug}`,
      device,
      1
    );

    // Browser stats
    await kv.hincrby(
      `analytics:browsers:${slug}`,
      browser,
      1
    );

    // Country stats
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

    // Recent click history
    const clickData = JSON.stringify({
      timestamp,
      device,
      browser,
      country
    });

    await kv.lpush(
      `analytics:recent:${slug}`,
      clickData
    );

    await kv.ltrim(
      `analytics:recent:${slug}`,
      0,
      49
    );

    // Debug
    const recentTest = await kv.lrange(
      `analytics:recent:${slug}`,
      0,
      5
    );

    console.log(
      'RECENT TEST:',
      recentTest
    );

  } catch (error) {
    console.error(
      'ANALYTICS ERROR:',
      error
    );
  }

  return res.redirect(302, originalUrl);
}
