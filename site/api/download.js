const RELEASES_API = 'https://api.github.com/repos/Ankit6149/skribly/releases?per_page=10';

function githubToken() {
  return process.env.SKRIBLY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
}

function githubHeaders(accept = 'application/vnd.github+json') {
  const headers = {
    accept,
    'user-agent': 'SkribliDownload/1.3',
    'x-github-api-version': '2022-11-28',
  };

  const token = githubToken();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function scoreAsset(asset, requestedFormat) {
  const name = String(asset?.name || '').toLowerCase();
  if (!asset?.browser_download_url || !asset?.url) return -1;
  if (name.includes('sha256') || name.includes('checksum')) return -1;

  const isExe = name.endsWith('.exe');
  const isMsi = name.endsWith('.msi');
  if (!isExe && !isMsi) return -1;

  let score = 0;
  if (requestedFormat === 'msi') score += isMsi ? 100 : 0;
  else score += isExe ? 100 : 0;

  if (name.includes('x64') || name.includes('amd64')) score += 25;
  if (name.includes('setup') || name.includes('nsis')) score += 20;
  if (name.includes('skribli') || name.includes('skribly')) score += 10;
  return score;
}

async function resolveReleaseAsset(requestedFormat) {
  const response = await fetch(RELEASES_API, {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GitHub releases request failed with ${response.status}.`);
  }

  const releases = await response.json();
  const release = Array.isArray(releases)
    ? releases.find((item) => item && !item.draft && Array.isArray(item.assets) && item.assets.length > 0)
    : null;

  if (!release) throw new Error('No published Skribli release with installer assets was found.');

  const ranked = release.assets
    .map((asset) => ({ asset, score: scoreAsset(asset, requestedFormat) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) throw new Error('The latest Skribli release has no Windows installer asset.');
  return { asset: ranked[0].asset, release };
}

async function resolvePrivateAssetRedirect(asset) {
  const response = await fetch(asset.url, {
    method: 'GET',
    headers: githubHeaders('application/octet-stream'),
    redirect: 'manual',
  });

  const location = response.headers.get('location');
  if (location && response.status >= 300 && response.status < 400) return location;

  throw new Error(`Private release asset redirect failed with ${response.status}.`);
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const requestedFormat = request.query?.format === 'msi' ? 'msi' : 'exe';
  const emergencyFallback = process.env.SKRIBLY_TRIAL_DOWNLOAD_URL;

  try {
    let target;
    let source = 'github-release';

    try {
      const { asset, release } = await resolveReleaseAsset(requestedFormat);
      target = githubToken()
        ? await resolvePrivateAssetRedirect(asset)
        : asset.browser_download_url;
      response.setHeader('X-Skribli-Release', String(release.tag_name || release.name || 'unknown'));
      response.setHeader('X-Skribli-Release-Asset', String(asset.name || 'unknown'));
    } catch (releaseError) {
      if (!emergencyFallback) throw releaseError;
      console.warn('Using the emergency Skribli installer fallback:', releaseError);
      target = emergencyFallback;
      source = 'emergency-fallback';
    }

    response.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.setHeader('X-Skribli-Download-Format', requestedFormat);
    response.setHeader('X-Skribli-Download-Source', source);
    return response.redirect(302, target);
  } catch (error) {
    console.error('Unable to resolve the Skribli installer:', error);
    response.setHeader('Cache-Control', 'no-store');
    return response.redirect(302, '/download-unavailable');
  }
};
