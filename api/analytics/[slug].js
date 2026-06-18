import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug required' });
  }

  try {
    const [
      totalClicks,
      uniqueCount,
      devices,
      browsers,
      countries,
      lastClick,
      recentClicks
    ] = await Promise.all([
      kv.get(`stats:clicks:${slug}`),
      kv.scard(`analytics:unique:${slug}`),
      kv.hgetall(`analytics:devices:${slug}`),
      kv.hgetall(`analytics:browsers:${slug}`),
      kv.hgetall(`analytics:countries:${slug}`),
      kv.get(`analytics:last_click:${slug}`),
      kv.lrange(`analytics:recent:${slug}`, 0, 49)
    ]);

    console.log('RECENT CLICKS RAW:', recentClicks);

    const history = (recentClicks || [])
      .map(item => {
        try {
          return typeof item === 'string'
            ? JSON.parse(item)
            : item;
        } catch (e) {
          console.error('Parse error:', e);
          return null;
        }
      })
      .filter(Boolean);

    const now = new Date();
    const dailyData = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = 0;
    }

    history.forEach(click => {
      if (!click.timestamp) return;

      const key = new Date(click.timestamp)
        .toISOString()
        .split('T')[0];

      if (dailyData[key] !== undefined) {
        dailyData[key]++;
      }
    });

    const chartData = Object.entries(dailyData).map(
      ([date, clicks]) => ({
        date,
        clicks
      })
    );

    return res.status(200).json({
      slug,
      total: Number(totalClicks || 0),
      uniqueVisitors: Number(uniqueCount || 0),
      lastClick: lastClick || null,
      devices: devices || {},
      browsers: browsers || {},
      countries: countries || {},
      history: history.slice(0, 20),
      chartData
    });

  } catch (error) {
    console.error('Analytics API error:', error);

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
}
