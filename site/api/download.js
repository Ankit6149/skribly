const DEFAULT_TRIAL_URL =
  'https://github.com/Ankit6149/skribly/releases/latest/download/Skribly_0.1.0_x64-setup.exe';

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const target = process.env.SKRIBLY_TRIAL_DOWNLOAD_URL || DEFAULT_TRIAL_URL;

  try {
    const availability = await fetch(target, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'user-agent': 'SkriblyDownload/1.0' },
    });

    if (availability.status >= 200 && availability.status < 400) {
      response.setHeader('Cache-Control', 'no-store');
      return response.redirect(302, target);
    }
  } catch {
    // The branded fallback below is preferable to exposing a repository page.
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.redirect(302, '/download-unavailable');
};
