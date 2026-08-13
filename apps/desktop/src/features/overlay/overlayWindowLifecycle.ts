export type HideOverlayWindow = () => Promise<void>;

/**
 * Keep the current surface mounted until the native window is actually hidden.
 * Clearing React state first can leave Skribli's transparent, always-on-top shell
 * visible when Windows or the Tauri ACL rejects the hide request.
 */
export async function hideOverlayThen(
  hideWindow: HideOverlayWindow,
  afterHidden: () => void
): Promise<void> {
  await hideWindow();
  afterHidden();
}
