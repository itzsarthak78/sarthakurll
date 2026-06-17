import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Generate a secure random key: sk_sarthak_xxxxx
  const prefix = 'sk_sarthak_';
  const randomPart = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 5);
  const apiKey = prefix + randomPart;

  // Store the key (value = true means active)
  await kv.set(`api_key:${apiKey}`, true);

  return res.status(200).json({ apiKey });
}
