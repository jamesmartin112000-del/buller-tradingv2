// Lightweight browser fingerprint — combines screen, timezone, language,
// platform, hardware concurrency, canvas hash, WebGL renderer.
//
// NOTE: Fingerprints are inherently fuzzy. Two visitors can collide, and a
// single user's fingerprint can change (extensions, browser updates, monitor
// swap). We use this as a SOFT signal, never as the sole gatekeeper.

async function hashString(input: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).
    map((b) => b.toString(16).padStart(2, '0')).
    join('').
    slice(0, 32);
  } catch {
    // Fallback: simple djb2 hash
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = h * 33 ^ input.charCodeAt(i);
    return (h >>> 0).toString(16);
  }
}

function canvasFingerprint(): string {
  try {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 60;
    const ctx = c.getContext('2d');
    if (!ctx) return 'no-ctx';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('AZHAAD-FP-2026', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('AZHAAD-FP-2026', 4, 17);
    return c.toDataURL().slice(-64);
  } catch {
    return 'canvas-error';
  }
}

function webglRenderer(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') ||
    c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'no-ext';
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown';
  } catch {
    return 'webgl-error';
  }
}

export async function generateFingerprint(): Promise<string> {
  const parts = [
  `${screen.width}x${screen.height}x${screen.colorDepth}`,
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigator.language,
  navigator.platform,
  String(navigator.hardwareConcurrency || 0),
  canvasFingerprint(),
  webglRenderer()];

  return hashString(parts.join('|'));
}