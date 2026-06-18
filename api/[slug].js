import { kv } from '@vercel/kv';

export default async function handler(req, res) {
const { slug } = req.query;

if (!slug || typeof slug !== 'string') {
return res.status(404).send('Not found');
}

const originalUrl = await kv.get("short:${slug}");

if (!originalUrl) {
return res.status(404).send('Link not found');
}

const ip =
req.headers['x-forwarded-for']?.split(',')[0] ||
req.socket?.remoteAddress ||
'unknown';

const userAgent = req.headers['user-agent'] || '';

const device = /mobile/i.test(userAgent) ? 'Mobile' : 'Desktop';

let browser = 'Other';
if (/chrome/i.test(userAgent)) browser = 'Chrome';
else if (/firefox/i.test(userAgent)) browser = 'Firefox';
else if (/safari/i.test(userAgent)) browser = 'Safari';

const country =
req.headers['x-vercel-ip-country'] || 'IN';

await kv.incr("stats:clicks:${slug}");

await kv.incr("analytics:total:${slug}");
await kv.sadd("analytics:unique:${slug}", ip);
await kv.hincrby("analytics:devices:${slug}", device, 1);
await kv.hincrby("analytics:browsers:${slug}", browser, 1);
await kv.hincrby("analytics:countries:${slug}", country, 1);

const clickData = {
timestamp: new Date().toISOString(),
device,
browser,
country
};

await kv.set(
"analytics:last_click:${slug}",
clickData.timestamp
);

await kv.lpush(
"analytics:recent:${slug}",
JSON.stringify(clickData)
);

await kv.ltrim(
"analytics:recent:${slug}",
0,
49
);

return res.redirect(302, originalUrl);
}
