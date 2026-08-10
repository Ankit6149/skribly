function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const supabaseUrl = String(process.env.SKRIBLY_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publishableKey = String(process.env.SKRIBLY_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!isHttpsUrl(supabaseUrl) || publishableKey.length < 24) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({ error: 'Owner download access is not configured yet.' });
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ supabaseUrl, publishableKey });
};
