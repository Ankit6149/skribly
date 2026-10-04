// Native waits at most 5 s. Leave time for IPC acknowledgement and native commit.
const NATIVE_SAVE_BUDGET_MS = 3500;

export async function saveBeforeNativeDeadline(save: () => Promise<boolean>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(save).catch(() => false),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), NATIVE_SAVE_BUDGET_MS); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
