// Turns yt-dlp's own stderr into a short, human-readable summary for known failure patterns.
// The raw output is never lost: it stays available as JobStatus.error.logTail regardless of
// whether this recognises the failure or falls back to a generic message.

interface ErrorPattern {
  test: RegExp;
  summarize: () => string;
}

const PATTERNS: ErrorPattern[] = [
  {
    test: /HTTP Error 403/i,
    summarize: () =>
      'YouTube refused this download (403 Forbidden). This usually means the video has extra ' +
      'protection from its publisher, or this connection is being throttled. Try again in a ' +
      'few minutes, or test with a different video to tell the two apart.',
  },
  {
    test: /HTTP Error 429/i,
    summarize: () => 'YouTube is rate-limiting this connection (429 Too Many Requests). Wait a while and try again.',
  },
  {
    test: /sign in to confirm/i,
    summarize: () =>
      "YouTube is asking to confirm this isn't a bot. This can happen on heavily-viewed videos; try again later.",
  },
  {
    test: /private video/i,
    summarize: () => 'This is a private video and cannot be downloaded.',
  },
  {
    test: /video unavailable/i,
    summarize: () => 'This video is unavailable. It may have been removed or made private.',
  },
  {
    test: /not available in your country|blocked it in your country|not made this video available in your country/i,
    summarize: () => 'This video is not available in your region.',
  },
  {
    test: /members-only|join this channel/i,
    summarize: () => 'This video is only available to channel members.',
  },
  {
    test: /this live event has ended/i,
    summarize: () => 'This was a livestream and the recording is not available yet.',
  },
];

/**
 * Looks for a known failure pattern in yt-dlp's stderr tail and returns a plain-language
 * summary. Falls back to a generic message that still names the exit code when nothing
 * matches, so the failure is never silently unexplained (docs/PLAN.md §6/§14).
 */
export function summarizeDownloadError(stderrTail: string[], exitCode: number | null): string {
  const combined = stderrTail.join('\n');
  for (const pattern of PATTERNS) {
    if (pattern.test.test(combined)) return pattern.summarize();
  }
  return `yt-dlp exited with code ${exitCode}`;
}
