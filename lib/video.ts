// Video upload: start an upload on the Recursiv video primitive (which gates by
// Plus/Pro + quota), then TUS-upload the file straight to Bunny. Returns the HLS
// URL to attach to a post. The server stamps playbackId + 'processing'; the encode
// webhook flips it to 'ready'.
import * as tus from 'tus-js-client';
import * as storage from './storage';
import { BASE_URL } from './recursiv';

export interface VideoEntitlement {
  tier: string;
  reason?: 'tier' | 'quota';
  quotaSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
}

export class VideoNotEntitledError extends Error {
  entitlement?: VideoEntitlement;
  constructor(entitlement?: VideoEntitlement) {
    super(
      entitlement?.reason === 'quota'
        ? 'You have reached your video storage limit.'
        : 'Video uploads are a Plus/Pro feature.',
    );
    this.name = 'VideoNotEntitledError';
    this.entitlement = entitlement;
  }
}

interface CreateUploadResponse {
  playbackId: string;
  hlsUrl: string;
  upload: {
    endpoint: string;
    libraryId: string;
    videoId: string;
    authorizationSignature: string;
    authorizationExpire: number;
  };
}

async function apiKey(): Promise<string> {
  return (await storage.getItem('minds:api_key')) || '';
}

async function createUpload(title: string): Promise<CreateUploadResponse> {
  const res = await fetch(`${BASE_URL}/video/create-upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${await apiKey()}`,
    },
    body: JSON.stringify({ title }),
  });
  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    throw new VideoNotEntitledError(body?.entitlement);
  }
  if (!res.ok) {
    throw new Error(`Video upload could not start (${res.status})`);
  }
  const json = await res.json();
  return json.data as CreateUploadResponse;
}

/**
 * Pick → upload a video. Returns the HLS url to put in a post's media_urls.
 * Throws VideoNotEntitledError if the user isn't Plus/Pro or is over quota.
 */
export async function uploadVideo(opts: {
  fileUri: string;
  title?: string;
  onProgress?: (pct: number) => void;
}): Promise<{ playbackId: string; hlsUrl: string }> {
  const title = opts.title || 'Untitled';
  const { playbackId, hlsUrl, upload } = await createUpload(title);

  const blob = await (await fetch(opts.fileUri)).blob();

  await new Promise<void>((resolve, reject) => {
    const upl = new tus.Upload(blob, {
      endpoint: upload.endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        AuthorizationSignature: upload.authorizationSignature,
        AuthorizationExpire: String(upload.authorizationExpire),
        VideoId: upload.videoId,
        LibraryId: upload.libraryId,
      },
      metadata: { filetype: blob.type || 'video/mp4', title },
      onError: (err) => reject(err),
      onProgress: (sent, total) =>
        opts.onProgress?.(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve(),
    });
    upl.start();
  });

  return { playbackId, hlsUrl };
}
