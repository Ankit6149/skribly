const RELEASES_API = 'https://api.github.com/repos/Ankit6149/skribly/releases?per_page=10';

function githubHeaders() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'SkriblyDownload/1.1',
    'x-github-api-version': '2022-11-28',
  };

  const token = process.env.SKRIBLY_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function scoreAsset(asset, requestedFormat) {
  const name = String(asset?.name || '').toLowerCase();
  if (!asset?.browser_download_url) return -1;
  if (name.includes('sha256') || name.includes('checksum')) return -1;

  const isExe = name.endsWith('.exe');
  const isMsi = name.endsWith('.msi');
  if (!isExe && !isMsi) return -1;

  let score = 0;
  if (requestedFormat === 'msi') score += isMsi ? 100 : 0;
  else score += isExe ? 100 : 0;

  if (name.includes('x64') || name.includes('amd64')) score += 25;
  if (name.includes('setup') || name.includes('nsis')) score += 20;
  if (name.includes('skribly')) score += 10;
  return score;
}

async function resolveReleaseAsset(requestedFormat) {
  const response = await fetch(RELEASES_API, {
    headers: githubHeaders(),
  });

  if (!response.ok) {
    throw new Error(`GitHub releases request failed with ${response.status}.`);
  }

  const releases = await response.json();
  const release = Array.isArray(releases)
    ? releases.find((item) => item && !item.draft && Array.isArray(item.assets) && item.assets.length > 0)
    : null;

  if (!release) throw new Error('No published Skribly release with installer assets was found.');

  const ranked = release.assets
    .map((asset) => ({ asset, score: scoreAsset(asset, requestedFormat) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) throw new Error('The latest Skribly release has no Windows installer asset.');
  return ranked[0].asset.browser_download_url;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const requestedFormat = request.query?.format === 'msi' ? 'msi' : 'exe';
  const explicitTarget = process.env.SKRIBLY_TRIAL_DOWNLOAD_URL;

  try {
    const target = explicitTarget || (await resolveReleaseAsset(requestedFormat));
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    response.setHeader('X-Skribly-Download-Format', requestedFormat);
    return response.redirect(302, target);
  } catch (error) {
    console.error('Unable to resolve the Skribly installer:', error);
    response.setHeader('Cache-Control', 'no-store');
    return response.redirect(302, '/download-unavailable');
  }
};
