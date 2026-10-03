import { decryptInstaller, DownloadFailure, fetchEncryptedInstaller, ownerArtifact } from './v0-download-core.mjs';
import { mountOwnerDownloads } from './v0-download-ui.mjs';

mountOwnerDownloads(document, {
  decrypt: decryptInstaller,
  fetchPackage: (platform) => fetchEncryptedInstaller(fetch, platform === 'android' ? 60_000 : 15_000, platform),
  artifactFor: ownerArtifact,
  isFailure: (error, category) => error instanceof DownloadFailure && error.category.startsWith(category),
  download: (bytes, artifact) => {
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: artifact.mime }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = artifact.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  },
});
