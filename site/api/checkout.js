module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.status(503).json({
    error: 'Payments are unavailable. Skribli has not opened sales.',
    code: 'sales_unavailable',
  });
};
