// ─── DEEP DEVICE FINGERPRINTING ──────────────────────────────────────
// This collects HIDDEN device information without asking for permissions

export interface DeviceFingerprint {
  id: string; // Unique device ID (SHA-256 hash)
  screen: string; // Screen resolution
  timezone: string; // Timezone
  language: string; // Browser language
  platform: string; // OS platform
  userAgent: string; // Full user agent
  cpuCores: number; // CPU cores
  memory: string; // Device memory (if available)
  touchSupport: boolean; // Touch device?
  canvasFingerprint: string; // Canvas fingerprint (hidden)
  webglFingerprint: string; // WebGL renderer (hidden)
  fonts: string[]; // Installed fonts
  plugins: string[]; // Browser plugins
  batteryInfo: string; // Battery status (if available)
  connectionType: string; // Network connection type
  colorDepth: number; // Color depth
  devicePixelRatio: number; // Pixel ratio
  registeredAt: number; // Timestamp
  lastActive: number; // Last active timestamp
}

// ─── HIDDEN CANVAS FINGERPRINT ───────────────────────────────────────
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'canvas-blocked';

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.font = '11pt Arial';
    ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = '18pt Arial';
    ctx.fillText('Cwm fjordbank glyphs', 4, 45);

    return btoa(canvas.toDataURL()).slice(0, 50);
  } catch {
    return 'canvas-error';
  }
}

// ─── HIDDEN WEBGL FINGERPRINT ────────────────────────────────────────
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'webgl-blocked';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'webgl-no-debug';

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return `${vendor}|${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

// ─── HIDDEN FONT DETECTION ───────────────────────────────────────────
function detectFonts(): string[] {
  const fonts = [
  'Arial',
  'Verdana',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Comic Sans MS',
  'Impact',
  'Trebuchet MS',
  'Palatino',
  'Tahoma',
  'Helvetica',
  'Calibri',
  'Cambria',
  'Segoe UI',
  'Roboto',
  'Open Sans',
  'Noto Sans',
  'Monaco',
  'Menlo',
  'Consolas',
  'Monospace'];

  const detected: string[] = [];
  const dummy = document.createElement('div');
  dummy.style.cssText =
  'position:absolute;left:-9999px;font-size:100px;visibility:hidden;';
  document.body.appendChild(dummy);

  for (const font of fonts) {
    dummy.style.fontFamily = `"${font}", monospace`;
    dummy.textContent = 'mmmmmmmmmmlli';
    const width1 = dummy.offsetWidth;
    dummy.style.fontFamily = 'monospace';
    const width2 = dummy.offsetWidth;
    if (width1 !== width2) detected.push(font);
  }

  document.body.removeChild(dummy);
  return detected;
}

// ─── COMPUTE UNIQUE DEVICE ID (SHA-256 via SubtleCrypto) ─────────────
async function computeDeviceHash(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(data)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback to simple hash if SubtleCrypto not available
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return 'fallback-' + Math.abs(hash).toString(16);
  }
}

// ─── GET BATTERY INFO (Hidden) ──────────────────────────────────────
async function getBatteryInfo(): Promise<string> {
  try {
    const battery = await (navigator as any).getBattery?.();
    if (!battery) return 'unknown';
    return `${Math.round(battery.level * 100)}%|${
    battery.charging ? 'charging' : 'discharging'}`;

  } catch {
    return 'not-available';
  }
}

// ─── MAIN FINGERPRINT FUNCTION ───────────────────────────────────────
export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  const ua = navigator.userAgent;
  // Read the global screen object up-front so the local string below
  // doesn't shadow it and break colorDepth.
  const colorDepth = window.screen.colorDepth;
  const screenStr = `${window.screen.width}x${window.screen.height}x${colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  const platform = (navigator as any).platform || 'unknown';
  const cpuCores = navigator.hardwareConcurrency || 0;
  const memory = (navigator as any).deviceMemory ?
  `${(navigator as any).deviceMemory}GB` :
  'unknown';
  const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const canvasFingerprint = getCanvasFingerprint();
  const webglFingerprint = getWebGLFingerprint();
  const fonts = detectFonts();
  const plugins = Array.from(navigator.plugins || []).map((p) => p.name);
  const connectionType =
  (navigator as any).connection?.effectiveType || 'unknown';
  const devicePixelRatio = window.devicePixelRatio || 1;

  const batteryInfo = await getBatteryInfo();

  // Create fingerprint raw string
  const rawFingerprint = `${ua}|${screenStr}|${timezone}|${language}|${platform}|${cpuCores}|${memory}|${touchSupport}|${canvasFingerprint}|${webglFingerprint}|${fonts.join(
    ','
  )}|${plugins.join(',')}|${batteryInfo}|${connectionType}|${colorDepth}|${devicePixelRatio}`;

  const id = await computeDeviceHash(rawFingerprint);

  return {
    id,
    screen: screenStr,
    timezone,
    language,
    platform,
    userAgent: ua,
    cpuCores,
    memory,
    touchSupport,
    canvasFingerprint,
    webglFingerprint,
    fonts,
    plugins,
    batteryInfo,
    connectionType,
    colorDepth,
    devicePixelRatio,
    registeredAt: Date.now(),
    lastActive: Date.now()
  };
}