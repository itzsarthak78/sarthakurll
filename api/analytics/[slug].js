// api/analytics/[slug].js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug required' });
  }

  try {
    // Fetch all data in parallel
    const [
      total,
      uniqueCount,
      devices,
      browsers,
      countries,
      lastClick,
      recentClicks
    ] = await Promise.all([
      kv.get(`analytics:total:${slug}`),
      kv.scard(`analytics:unique:${slug}`),
      kv.hgetall(`analytics:devices:${slug}`),
      kv.hgetall(`analytics:browsers:${slug}`),
      kv.hgetall(`analytics:countries:${slug}`),
      kv.get(`analytics:last_click:${slug}`),
      kv.lrange(`analytics:recent:${slug}`, 0, 49)
    ]);

    // Parse recent clicks
    const history = recentClicks.map(item => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);

    // Build 7-day click chart data (optional: we can compute from history)
    // For simplicity, we'll generate daily counts from the last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const dailyData = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = 0;
    }

    // Count clicks per day from history
    history.forEach(click => {
      const date = new Date(click.timestamp);
      const key = date.toISOString().split('T')[0];
      if (dailyData.hasOwnProperty(key)) {
        dailyData[key] += 1;
      }
    });

    const chartData = Object.keys(dailyData).map(key => ({
      date: key,
      clicks: dailyData[key]
    }));

    res.status(200).json({
      slug,
      total: parseInt(total || 0, 10),
      uniqueVisitors: uniqueCount || 0,
      lastClick: lastClick || null,
      devices: devices || {},
      browsers: browsers || {},
      countries: countries || {},
      history: history.slice(0, 20), // last 20 for table
      chartData
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
