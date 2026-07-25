module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const checkoutUrl = process.env.SKRIBLY_CHECKOUT_URL;
  if (!checkoutUrl) {
    response.setHeader('Cache-Control', 'no-store');
    return response.redirect(302, '/#pricing');
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.redirect(302, checkoutUrl);
};
