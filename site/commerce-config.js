window.SKRIBLY_COMMERCE = Object.freeze({
  product: {
    id: 'skribli-windows',
    name: 'Skribli for Windows',
    status: 'v0_owner_testing',
  },

  download: {
    enabled: true,
    mode: 'encrypted_download_key',
    endpoint: '/v0-download',
    versionLabel: 'Download key required',
  },

  access: {
    enabled: true,
    mode: 'local_decryption_key',
  },

  links: {
    releaseNotes: '/release-notes',
    privacy: '/privacy',
    answers: '/answers',
  },
});
