const { Readable } = require('node:stream');

const REPOSITORY_API = 'https://api.github.com/repos/Ankit6149/skribly';

function json(response, status, body) {
  return response.status(status).json(body);
}

function githubHeaders() {
  const token = String(process.env.SKRIBLY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  if (!token) return null;
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'SkribliOwnerV0Download/1.0',
    'x-github-api-version': '2022-11-28',
  };
}

function ownerConfiguration() {
  const supabaseUrl = String(process.env.SKRIBLY_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const publishableKey = String(process.env.SKRIBLY_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const ownerEmail = String(process.env.SKRIBLY_V0_OWNER_EMAIL || '').trim().toLowerCase();
  const artifactId = String(process.env.SKRIBLY_V0_ARTIFACT_ID || '').trim();
  if (
    !supabaseUrl.startsWith('https://') ||
    publishableKey.length < 24 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail) ||
    !/^\d{1,20}$/.test(artifactId)
  ) {
    return null;
  }
  return { supabaseUrl, publishableKey, ownerEmail, artifactId };
}

async function verifiedOwnerEmail(request, configuration) {
  const authorization = String(request.headers.authorization || '');
  if (!/^Bearer\s+[^\s]+$/i.test(authorization)) return null;

  const accountResponse = await fetch(`${configuration.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: configuration.publishableKey,
      authorization,
    },
  });
  if (!accountResponse.ok) return null;
  const account = await accountResponse.json();
  if (!account || typeof account.email !== 'string' || !account.email_confirmed_at) return null;
  return account.email.trim().toLowerCase();
}

function isTrustedArchiveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

async function fetchArtifactArchive(configuration) {
  const headers = githubHeaders();
  if (!headers) throw new Error('github_download_not_configured');
  const artifactResponse = await fetch(
    `${REPOSITORY_API}/actions/artifacts/${configuration.artifactId}/zip`,
    { headers, redirect: 'manual' }
  );
  if (artifactResponse.status !== 302) throw new Error('artifact_not_available');

  const archiveUrl = artifactResponse.headers.get('location');
  if (!archiveUrl || !isTrustedArchiveUrl(archiveUrl)) throw new Error('artifact_redirect_invalid');

  const archiveResponse = await fetch(archiveUrl, { redirect: 'error' });
  if (!archiveResponse.ok || !archiveResponse.body) throw new Error('artifact_fetch_failed');
  return archiveResponse;
}

function streamArchive(archiveResponse, response) {
  response.statusCode = 200;
  response.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Skribli-Download-Status', 'owner-v0-authorized');
  response.setHeader('Content-Type', 'application/zip');
  response.setHeader('Content-Disposition', 'attachment; filename="Skribli_v0_Windows.zip"');
  const contentLength = archiveResponse.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength)) response.setHeader('Content-Length', contentLength);

  return new Promise((resolve, reject) => {
    const archiveStream = Readable.fromWeb(archiveResponse.body);
    archiveStream.once('error', reject);
    response.once('error', reject);
    response.once('finish', resolve);
    archiveStream.pipe(response);
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');

  const configuration = ownerConfiguration();
  if (!configuration) return json(response, 503, { error: 'Owner download access is not configured yet.' });

  try {
    const email = await verifiedOwnerEmail(request, configuration);
    if (!email) return json(response, 401, { error: 'Sign in with the verified owner account to download v0.' });
    if (email !== configuration.ownerEmail) {
      return json(response, 403, { error: 'This account is not permitted to download the v0 build.' });
    }

    return streamArchive(await fetchArtifactArchive(configuration), response);
  } catch (error) {
    console.error('Owner v0 download failed:', error instanceof Error ? error.message : 'unknown_error');
    return json(response, 503, { error: 'The current v0 installer artifact is not ready yet.' });
  }
};
