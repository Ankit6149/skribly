window.SKRIBLY_COMMERCE = Object.freeze({
  product: {
    id: 'skribly-founder-alpha-windows',
    name: 'Skribly Founder Alpha',
    currency: 'INR',
    price: 499,
    billing: 'one_time',
  },

  download: {
    mode: 'public_release',
    latestReleaseUrl: 'https://github.com/Ankit6149/skribly/releases/latest',
    directWindowsAssetUrl: '',
    versionLabel: 'Founder Alpha 0.1',
  },

  checkout: {
    enabled: false,
    provider: 'unconfigured',
    checkoutUrl: '',
    successUrl: '/download-success.html',
    cancelUrl: '/#pricing',
  },

  support: {
    email: 'hello@skribly.app',
    repositoryUrl: 'https://github.com/Ankit6149/skribly',
  },
});

/*
  Future payment activation
  -------------------------

  1. Create a hosted checkout product with the selected payment provider.
  2. Set checkout.enabled to true.
  3. Set checkout.provider to a descriptive provider key.
  4. Put the hosted checkout URL in checkout.checkoutUrl.
  5. Keep installer delivery server-side or provider-gated before changing
     download.mode to "checkout_gated".

  Never place payment-provider secret keys in this public file.
*/
