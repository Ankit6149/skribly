window.SKRIBLY_COMMERCE = Object.freeze({
  product: {
    id: 'skribly-personal-windows',
    name: 'Skribly Personal for Windows',
    currency: 'INR',
    launchPrice: 999,
    standardPrice: 1499,
    billing: 'one_time',
    includedUpdateMonths: 12,
    optionalUpdatePassPrice: 499,
  },

  trial: {
    days: 7,
    enforcedInApp: false,
    cardRequired: false,
  },

  download: {
    mode: 'controlled_trial',
    endpoint: '/api/download',
    versionLabel: 'Windows beta 0.1',
  },

  checkout: {
    enabled: false,
    provider: 'paddle',
    endpoint: '/api/checkout',
    successUrl: '/download-success',
    cancelUrl: '/#pricing',
  },

  links: {
    releaseNotes: '/release-notes',
    privacy: '/privacy',
  },
});
