window.SKRIBLY_COMMERCE = Object.freeze({
  product: {
    id: 'skribli-windows',
    name: 'Skribli for Windows',
    status: 'v0_owner_testing',
  },

  download: {
    enabled: true,
    mode: 'owner_authenticated',
    endpoint: '/v0-download',
    versionLabel: 'Verified owner account required',
  },

  access: {
    enabled: true,
    mode: 'verified_owner_account',
  },

  links: {
    releaseNotes: '/release-notes',
    privacy: '/privacy',
    answers: '/answers',
  },
});
