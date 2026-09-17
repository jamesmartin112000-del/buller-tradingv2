import { firebaseAuth } from './firebase';

export type UploadFolder =
'kyc' |
'payments' |
'profiles' |
'admin' |
'chat' |
'trade-screenshots';
export type ChatAttachmentKind = 'image' | 'video' | 'file';

export interface UploadResult {
  ok: boolean;
  url?: string;
  path?: string;
  error?: string;
  kind?: ChatAttachmentKind;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CHAT_TYPES = new Set([
...IMAGE_TYPES,
'video/mp4',
'video/webm',
'application/pdf',
'text/plain',
'application/zip',
'application/msword',
'application/vnd.ms-excel',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);
const MAX_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): {ok: boolean;reason?: string;} {
  if (!file) return { ok: false, reason: 'No file selected.' };
  if (!IMAGE_TYPES.has(file.type)) return { ok: false, reason: 'Only JPEG, PNG or WebP images are allowed.' };
  if (file.size > MAX_BYTES) return { ok: false, reason: 'File is larger than 10 MB. Please choose a smaller image.' };
  return { ok: true };
}

export function classifyAttachment(file: File): ChatAttachmentKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  let bitmap: ImageBitmap | null = null;
  try {
    if (!file.type.startsWith('image/')) return file;
    bitmap = await withTimeout(createImageBitmap(file), 12_000, 'Image preparation timed out.');
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await withTimeout(
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality)),
      12_000,
      'Image compression timed out.'
    );
    return blob ?
    new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }) :
    file;
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function uploadFile(
folder: UploadFolder,
ownerId: string,
file: File,
onProgress?: (percent: number) => void,
signal?: AbortSignal)
: Promise<UploadResult> {
  const validation = folder === 'chat' ? validateAttachment(file) : validateImageFile(file);
  if (!validation.ok) return { ok: false, error: validation.reason };
  try {
    const token = await firebaseAuth.currentUser?.getIdToken();
    const target = await requestUploadTarget(folder, ownerId, file, token, signal);
    await putWithProgress(target.uploadUrl, file, onProgress, signal);
    await verifyUpload(target.key, file.size, target.verificationToken, signal);
    return {
      ok: true,
      url: target.publicUrl,
      path: target.key,
      kind: classifyAttachment(file)
    };
  } catch (error) {
    if ((error as {name?: string;}).name === 'AbortError') {
      return { ok: false, error: 'Upload cancelled. You can retry safely.' };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Upload failed. Please retry.' };
  }
}

export function uploadChatAttachment(
ownerId: string,
file: File,
onProgress?: (percent: number) => void,
signal?: AbortSignal)
{
  return uploadFile('chat', ownerId, file, onProgress, signal);
}

export async function deleteFile(keyOrUrl: string): Promise<boolean> {
  if (!keyOrUrl) return false;
  const current = firebaseAuth.currentUser;
  if (!current) return false;
  try {
    const token = await current.getIdToken();
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', key: keyOrUrl })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadTradeScreenshot(userId: string, file: File) {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.reason);
  let result = file;
  let quality = 0.82;
  let dimension = 1600;
  for (let attempt = 0; attempt < 7 && result.size > 300 * 1024; attempt += 1) {
    result = await compressImage(file, dimension, quality);
    quality = Math.max(0.42, quality - 0.09);
    dimension = Math.max(720, dimension - 160);
  }
  if (result.size > 300 * 1024) throw new Error('Screenshot could not be compressed below 300KB.');
  const uploaded = await uploadFile('trade-screenshots', userId, result);
  if (!uploaded.ok || !uploaded.url || !uploaded.path) throw new Error(uploaded.error || 'Screenshot upload failed.');
  return { url: uploaded.url, path: uploaded.path, size: result.size };
}

export async function removeTradeScreenshot(path?: string | null) {
  if (path && !(await deleteFile(path))) throw new Error('Screenshot could not be removed.');
}

async function requestUploadTarget(
folder: UploadFolder,
ownerId: string,
file: File,
token?: string,
signal?: AbortSignal)
: Promise<{uploadUrl: string;publicUrl: string;key: string;verificationToken: string;}> {
  let response: Response;
  try {
    response = await fetch('/api/upload', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        action: 'sign',
        folder,
        ownerId,
        fileName: file.name,
        contentType: file.type,
        size: file.size
      })
    });
  } catch (error) {
    if ((error as {name?: string;}).name === 'AbortError') throw error;
    throw new Error('Upload service could not be reached. Please retry after the deployment is available.');
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ?
  (await response.json().catch(() => ({}))) as {
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
    verificationToken?: string;
    error?: string;
    stage?: string;
  } :
  {};
  if (!response.ok || !payload.uploadUrl || !payload.publicUrl || !payload.key || !payload.verificationToken) {
    const stage = payload.stage ? ` during ${payload.stage}` : '';
    throw new Error(
      payload.error ?
      `${payload.error}${stage}` :
      `Upload service failed${stage} (HTTP ${response.status}). Check the Vercel function logs and server environment variables.`
    );
  }
  return {
    uploadUrl: payload.uploadUrl,
    publicUrl: payload.publicUrl,
    key: payload.key,
    verificationToken: payload.verificationToken
  };
}

async function verifyUpload(
key: string,
size: number,
verificationToken: string,
signal?: AbortSignal)
{
  const response = await fetch('/api/upload', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify', key, size, verificationToken })
  });
  const payload = (await response.json().catch(() => ({}))) as {error?: string;};
  if (!response.ok) throw new Error(payload.error || 'The uploaded file could not be verified.');
}

function putWithProgress(
uploadUrl: string,
file: File,
onProgress?: (percent: number) => void,
signal?: AbortSignal)
: Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let stallTimer = 0;
    let lastLoaded = 0;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(stallTimer);
      signal?.removeEventListener('abort', cancel);
      callback();
    };
    const armStallTimer = () => {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => {
        request.abort();
        finish(() => reject(new Error('Upload stopped receiving data. Please reconnect and retry.')));
      }, 150_000);
    };
    const cancel = () => {
      request.abort();
      finish(() => reject(new DOMException('Upload cancelled.', 'AbortError')));
    };
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);
    request.setRequestHeader('Cache-Control', 'public, max-age=31536000, immutable');
    request.upload.onprogress = (event) => {
      if (event.loaded > lastLoaded) {
        lastLoaded = event.loaded;
        armStallTimer();
      }
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) finish(resolve);else
      finish(() => reject(new Error(`Upload failed (HTTP ${request.status}). Please retry.`)));
    };
    request.onerror = () => finish(() => reject(new Error(
      request.status === 0 ?
      'Upload was blocked. Ask Admin to verify the R2 bucket CORS setup, then retry.' :
      'Network error while uploading. Please retry.'
    )));
    request.onabort = () => finish(() => reject(new DOMException('Upload cancelled.', 'AbortError')));
    if (signal?.aborted) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    armStallTimer();
    request.send(file);
  });
}

function validateAttachment(file: File): {ok: boolean;reason?: string;} {
  if (!file) return { ok: false, reason: 'No file selected.' };
  if (!CHAT_TYPES.has(file.type)) return { ok: false, reason: 'This attachment type is not allowed.' };
  if (file.size > MAX_BYTES) return { ok: false, reason: 'Attachment is larger than 10 MB.' };
  return { ok: true };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {window.clearTimeout(timer);resolve(value);},
      (error) => {window.clearTimeout(timer);reject(error);}
    );
  });
}