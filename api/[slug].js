import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';

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

// ----- Helper: Track analytics (unchanged logic) -----
async function trackAnalytics(req, slug) {
  try {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const country = req.headers['x-vercel-ip-country'] || 'Unknown';
    const { device, browser } = parseUA(userAgent);

    await kv.incr(`stats:clicks:${slug}`);
    await kv.sadd(`analytics:unique:${slug}`, ip);
    await kv.hincrby(`analytics:devices:${slug}`, device, 1);
    await kv.hincrby(`analytics:browsers:${slug}`, browser, 1);
    await kv.hincrby(`analytics:countries:${slug}`, country, 1);
    await kv.set(`analytics:last_click:${slug}`, timestamp);

    const clickRecord = JSON.stringify({ timestamp, device, browser, country, ip });
    await kv.lpush(`analytics:recent:${slug}`, clickRecord);
    await kv.ltrim(`analytics:recent:${slug}`, 0, 49);
  } catch (error) {
    console.error('Analytics error (non‑fatal):', error);
  }
}

// ----- Main handler (with password protection) -----
export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(404).send('Not found');
  }

  try {
    const [originalUrl, hashedPassword] = await Promise.all([
      kv.get(`short:${slug}`),
      kv.get(`password:${slug}`)
    ]);

    if (!originalUrl) {
      return res.status(404).send('Link not found');
    }

    // No password → redirect normally with analytics
    if (!hashedPassword) {
      await trackAnalytics(req, slug);
      return res.redirect(302, originalUrl);
    }

    // Password protected
    if (req.method === 'POST') {
      const { password } = req.body;
      if (!password) {
        return sendPasswordPage(res, slug, true, 'Password is required.');
      }

      const valid = await bcrypt.compare(password, hashedPassword);
      if (valid) {
        await trackAnalytics(req, slug);
        return res.redirect(302, originalUrl);
      } else {
        return sendPasswordPage(res, slug, true, 'Incorrect password. Please try again.');
      }
    }

    // GET → show password page
    return sendPasswordPage(res, slug, false, null);

  } catch (error) {
    console.error('ERROR:', error);
    return res.status(500).send('Server Error');
  }
}

// ----- Helper: Cool password page (vector icons only) -----
function sendPasswordPage(res, slug, error = false, errorMsg = null) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" />
  <title>Protected Link – Sarthak URL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Inter',sans-serif;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:1.5rem;
      background:linear-gradient(145deg,#f8f4ff 0%,#ede6ff 100%);
      position:relative;
      overflow:hidden;
    }
    body::before, body::after {
      content:'';
      position:absolute;
      border-radius:50%;
      background:rgba(168,85,247,0.08);
      animation:float 12s infinite alternate ease-in-out;
      pointer-events:none;
    }
    body::before { width:400px; height:400px; top:-100px; right:-100px; }
    body::after { width:350px; height:350px; bottom:-80px; left:-80px; animation-delay:-4s; }
    @keyframes float {
      0% { transform:translate(0,0) scale(1); }
      100% { transform:translate(40px,30px) scale(1.2); }
    }
    .container {
      max-width:440px;
      width:100%;
      background:rgba(255,255,255,0.7);
      backdrop-filter:blur(24px) saturate(1.4);
      -webkit-backdrop-filter:blur(24px) saturate(1.4);
      border-radius:40px;
      border:1px solid rgba(192,132,252,0.25);
      box-shadow:0 30px 60px rgba(107,70,193,0.12),0 10px 20px rgba(0,0,0,0.02);
      padding:2.4rem 2rem 2rem;
      text-align:center;
      position:relative;
      z-index:1;
      animation:fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1);
      transition:all 0.3s ease;
    }
    .container:hover {
      border-color:rgba(139,92,246,0.4);
      box-shadow:0 40px 80px rgba(126,34,206,0.15);
      transform:translateY(-2px);
    }
    @keyframes fadeInUp {
      from { opacity:0; transform:translateY(30px); }
      to { opacity:1; transform:translateY(0); }
    }
    .lock-icon-wrap {
      display:inline-block;
      background:linear-gradient(135deg,#ede9fe,#f3e8ff);
      padding:1.2rem;
      border-radius:50%;
      margin-bottom:0.8rem;
      box-shadow:0 8px 20px rgba(168,85,247,0.15);
      animation:pulse 2.5s infinite ease-in-out;
    }
    @keyframes pulse {
      0% { transform:scale(1); }
      50% { transform:scale(1.05); }
      100% { transform:scale(1); }
    }
    .lock-icon { font-size:2.6rem; color:#7c3aed; }
    h1 {
      font-family:'Playfair Display',serif;
      font-size:1.8rem;
      font-weight:700;
      font-style:italic;
      background:linear-gradient(135deg,#5b21b6,#a855f7);
      -webkit-background-clip:text;
      background-clip:text;
      color:transparent;
      margin-bottom:0.2rem;
    }
    .subtitle {
      color:#52525b;
      font-size:0.95rem;
      margin-bottom:1.8rem;
      line-height:1.5;
    }
    .subtitle code {
      background:#f3e8ff;
      padding:0.1rem 0.6rem;
      border-radius:20px;
      font-size:0.8rem;
      color:#6d28d9;
      font-weight:500;
    }
    form { display:flex; flex-direction:column; gap:1.2rem; }
    .input-group { position:relative; text-align:left; }
    .input-group .input-icon {
      position:absolute;
      left:1.2rem;
      top:50%;
      transform:translateY(-50%);
      color:#a855f7;
      font-size:1.1rem;
      transition:0.2s;
      pointer-events:none;
    }
    .input-group input {
      width:100%;
      padding:0.9rem 1rem 0.9rem 3.2rem;
      border:2px solid #e5e5e5;
      border-radius:30px;
      font-size:1rem;
      font-weight:500;
      color:#18181b;
      background:white;
      transition:0.25s ease;
      font-family:'Inter',sans-serif;
      outline:none;
      box-shadow:0 2px 8px rgba(0,0,0,0.02);
    }
    .input-group input:focus {
      border-color:#a855f7;
      box-shadow:0 0 0 4px rgba(168,85,247,0.10),0 4px 12px rgba(168,85,247,0.05);
      transform:translateY(-1px);
    }
    .input-group input:focus + .input-icon { color:#7c3aed; }
    .input-group .floating-label {
      position:absolute;
      left:3.2rem;
      top:50%;
      transform:translateY(-50%);
      color:#a1a1aa;
      font-size:0.95rem;
      font-weight:400;
      pointer-events:none;
      transition:0.2s ease;
      background:white;
      padding:0 0.2rem;
    }
    .input-group input:focus ~ .floating-label,
    .input-group input:not(:placeholder-shown) ~ .floating-label {
      top:-0.5rem;
      left:1.2rem;
      font-size:0.7rem;
      color:#7c3aed;
      font-weight:500;
      background:white;
      padding:0 0.4rem;
      border-radius:4px;
    }
    .input-group input::placeholder { color:transparent; }
    .btn-primary {
      background:linear-gradient(135deg,#7c3aed,#6d28d9);
      border:none;
      padding:0.9rem 1.8rem;
      border-radius:30px;
      font-weight:600;
      font-size:1rem;
      color:white;
      cursor:pointer;
      transition:0.3s ease;
      box-shadow:0 8px 24px rgba(124,58,237,0.25);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:0.6rem;
      font-family:'Inter',sans-serif;
      width:100%;
      position:relative;
      overflow:hidden;
    }
    .btn-primary::after {
      content:'';
      position:absolute;
      inset:0;
      background:linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.15) 100%);
      pointer-events:none;
    }
    .btn-primary:hover {
      transform:translateY(-2px) scale(1.01);
      box-shadow:0 12px 36px rgba(124,58,237,0.35);
    }
    .btn-primary:active { transform:scale(0.97); }
    .error-msg {
      background:#fef2f2;
      color:#b91c1c;
      border-radius:20px;
      padding:0.7rem 1.2rem;
      font-size:0.85rem;
      border-left:4px solid #ef4444;
      display:flex;
      align-items:center;
      gap:0.6rem;
      text-align:left;
      animation:shake 0.4s ease;
    }
    @keyframes shake {
      0%,100% { transform:translateX(0); }
      25% { transform:translateX(-6px); }
      75% { transform:translateX(6px); }
    }
    .error-msg i { font-size:1.1rem; }
    .footer {
      margin-top:1.5rem;
      font-size:0.75rem;
      color:#a1a1aa;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:0.4rem;
    }
    .footer a { color:#7c3aed; text-decoration:none; font-weight:500; }
    .footer a:hover { text-decoration:underline; }
    @media (max-width:480px) {
      .container { padding:1.8rem 1.2rem; }
      h1 { font-size:1.5rem; }
      .lock-icon-wrap { padding:0.8rem; }
      .lock-icon { font-size:2rem; }
      .subtitle { font-size:0.85rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="lock-icon-wrap">
      <i class="fas fa-lock lock-icon"></i>
    </div>
    <h1>Protected Link</h1>
    <p class="subtitle">
      This short link is password‑protected.<br />
      Enter the secret key to unlock it.
    </p>
    <form method="POST" action="/${slug}">
      <div class="input-group">
        <i class="fas fa-key input-icon"></i>
        <input type="password" name="password" placeholder=" " required autofocus />
        <span class="floating-label">Enter password</span>
      </div>
      ${error ? `<div class="error-msg"><i class="fas fa-exclamation-circle"></i> ${errorMsg || 'Incorrect password. Please try again.'}</div>` : ''}
      <button type="submit" class="btn-primary">
        <i class="fas fa-arrow-right"></i> Unlock &amp; Visit
      </button>
    </form>
    <div class="footer">
      <i class="fas fa-shield-alt" style="color:#a855f7;"></i>
      Secured with <a href="https://sarthakurll.vercel.app/">Sarthak URL</a>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
