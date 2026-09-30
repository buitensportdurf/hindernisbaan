import { afterEach, describe, expect, it, vi } from 'vitest';
import { enterTestFullscreen, exitTestFullscreen, fullscreenAvailable, isFullscreen } from './fullscreen';

type MockDoc = {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  documentElement: {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
  };
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
};

function doc(partial: Partial<MockDoc> & { documentElement: MockDoc['documentElement'] }): Document {
  return partial as unknown as Document;
}

describe('test fullscreen', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is available when the standard or webkit flag is on', () => {
    expect(fullscreenAvailable(doc({ fullscreenEnabled: true, documentElement: {} }))).toBe(true);
    expect(fullscreenAvailable(doc({ webkitFullscreenEnabled: true, documentElement: {} }))).toBe(true);
    expect(fullscreenAvailable(doc({ fullscreenEnabled: false, documentElement: {} }))).toBe(false);
  });

  it('requests fullscreen once per sitting', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const d = doc({
      fullscreenEnabled: true,
      fullscreenElement: null,
      documentElement: { requestFullscreen }
    });
    await enterTestFullscreen(d);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    d.fullscreenElement = d.documentElement as unknown as Element;
    await enterTestFullscreen(d);
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it('exits when the sitting ends', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    const d = doc({
      fullscreenEnabled: true,
      fullscreenElement: {} as Element,
      documentElement: {},
      exitFullscreen
    });
    await exitTestFullscreen(d);
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it('skips exit when already windowed', async () => {
    const exitFullscreen = vi.fn();
    await exitTestFullscreen(
      doc({ fullscreenEnabled: true, fullscreenElement: null, documentElement: {}, exitFullscreen })
    );
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('reports whether the document is fullscreen', () => {
    expect(isFullscreen(doc({ fullscreenElement: {} as Element, documentElement: {} }))).toBe(true);
    expect(isFullscreen(doc({ fullscreenElement: null, documentElement: {} }))).toBe(false);
  });
});
