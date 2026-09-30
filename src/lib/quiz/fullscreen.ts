type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

type FsRoot = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

export function fullscreenAvailable(doc: Document = document): boolean {
  const d = doc as FsDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(doc: Document = document): boolean {
  const d = doc as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Browsers only allow this from a click; no-ops when already there or blocked. */
export async function enterTestFullscreen(doc: Document = document): Promise<void> {
  if (!fullscreenAvailable(doc) || isFullscreen(doc)) return;
  const root = doc.documentElement as FsRoot;
  try {
    if (root.requestFullscreen) await root.requestFullscreen();
    else await root.webkitRequestFullscreen?.();
  } catch {
    /* permission, embed policy, iOS */
  }
}

export async function exitTestFullscreen(doc: Document = document): Promise<void> {
  if (!isFullscreen(doc)) return;
  const d = doc as FsDoc;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    /* already left */
  }
}
