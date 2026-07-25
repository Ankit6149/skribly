const REPOSITORY_API = 'https://api.github.com/repos/Ankit6149/skribly';

function githubHeaders() {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'SkriblyBuildStatus/1.0',
    'x-github-api-version': '2022-11-28',
  };
  const token = process.env.SKRIBLY_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function githubJson(url) {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub request failed with ${response.status}.`);
  return response.json();
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const runsPayload = await githubJson(
      `${REPOSITORY_API}/actions/runs?branch=main&event=push&per_page=10`
    );
    const run = Array.isArray(runsPayload.workflow_runs)
      ? runsPayload.workflow_runs.find((candidate) => candidate.name === 'CI')
      : null;
    if (!run) throw new Error('No main-branch CI run was found.');

    const jobsPayload = await githubJson(`${REPOSITORY_API}/actions/runs/${run.id}/jobs?per_page=100`);
    const jobs = Array.isArray(jobsPayload.jobs)
      ? jobsPayload.jobs.map((job) => ({
          id: job.id,
          name: job.name,
          status: job.status,
          conclusion: job.conclusion,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          url: job.html_url,
        }))
      : [];

    response.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response.status(200).json({
      run: {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        commit: run.head_sha,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        url: run.html_url,
      },
      jobs,
    });
  } catch (error) {
    console.error('Unable to read Skribly CI status:', error);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(503).json({
      error: 'Build status is temporarily unavailable.',
    });
  }
};
