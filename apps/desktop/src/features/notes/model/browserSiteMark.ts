const SITES: Readonly<Record<string, string>> = {
  github:'github', 'github.com':'github', chatgpt:'openai', 'chatgpt.com':'openai', 'chat.openai.com':'openai',
  figma:'figma', 'figma.com':'figma', youtube:'youtube', 'youtube.com':'youtube',
  notion:'notion', 'notion.so':'notion', 'notion.com':'notion',
  'stack overflow':'stackoverflow', 'stackoverflow.com':'stackoverflow', gitlab:'gitlab', 'gitlab.com':'gitlab',
  reddit:'reddit', 'reddit.com':'reddit', wikipedia:'wikipedia', 'wikipedia.org':'wikipedia',
  'google drive':'googledrive', 'drive.google.com':'googledrive', 'google docs':'googledocs', 'docs.google.com':'googledocs',
  discord:'discord', 'discord.com':'discord', slack:'slack', 'slack.com':'slack',
};

// A conservative display hint from the saved window title, never a context
// identity or a claim that we have access to Chrome's URL/history.
export function browserSiteMark(process: string, title: string): string | undefined {
  if (process.trim().toLowerCase() !== 'chrome.exe') return undefined;
  const page = title.replace(/\s*[-–—]\s*Google Chrome\s*$/i, '').trim();
  for (const segment of page.split(/\s+[|·–—]\s+|\s+-\s+/).reverse()) {
    const label = segment.trim().toLowerCase();
    if (SITES[label]) return SITES[label];
    try {
      const url = new URL(segment);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        const host = url.hostname.replace(/^www\./, '');
        if (SITES[host]) return SITES[host];
      }
    } catch { /* A normal title is not a URL. */ }
  }
  return undefined;
}
