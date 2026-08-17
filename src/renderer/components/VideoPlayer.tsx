import type { MediaInfo } from '../../shared/types';

/**
 * Plain `<iframe>` embed, not the JS IFrame Player API: only native playback controls
 * (play/pause/seek/fullscreen) are needed, nothing programmatic from our own code, so the
 * enablejsapi/postMessage bridge would be unused complexity. youtube-nocookie.com is Google's
 * documented Privacy-Enhanced Mode domain — it sets no tracking cookies until playback starts.
 * A video whose owner disabled embedding shows YouTube's own fallback UI inside the frame;
 * there is nothing extra to detect or handle on this side. See docs/PLAN.md §17.
 */
export function VideoPlayer({ info }: { info: MediaInfo }) {
  const src = info.isPlaylist
    ? `https://www.youtube-nocookie.com/embed?listType=playlist&list=${info.id}`
    : `https://www.youtube-nocookie.com/embed/${info.id}`;

  return (
    <iframe
      key={src} // a fresh frame per video/playlist rather than reusing the previous one's state
      src={src}
      title={info.title}
      className="aspect-video w-full rounded-lg border border-line-soft"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}
