import { app, BrowserWindow, session, shell } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpc } from './main/ipc';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/**
 * Serves the packaged renderer over http://127.0.0.1 instead of loading it as a file:// page.
 * YouTube's embedded player outright rejects a file:// parent origin — "Error 153: Video
 * player configuration error" — a widely-reported limitation, not something particular to this
 * app. Confirmed by isolating the one variable in a standalone repro: the exact same embed URL
 * loaded and played fine from a bare local http:// page and failed only from file://. Binding
 * to loopback only and picking an OS-assigned port keeps this unreachable outside the machine;
 * it serves nothing but this app's own already-public bundled assets, so no auth is needed.
 */
function serveRendererDirectory(rootDir: string): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const requestedPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const filePath = path.join(rootDir, requestedPath === '/' ? 'index.html' : requestedPath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Thumbnails come from YouTube's CDN and the player embed from its privacy-enhanced domain;
// no other remote origin is allowed (docs/PLAN.md §11).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React sets inline `style` attributes (progress bar width).
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.ytimg.com",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src https://www.youtube-nocookie.com",
].join('; ');

/** The dev server needs websockets and inline scripts for HMR; production allows neither. */
function contentSecurityPolicy(): string {
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) return CSP;
  const dev = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
  return CSP.replace("script-src 'self'", `script-src 'self' 'unsafe-inline' ${dev}`)
    .replace("connect-src 'self'", `connect-src 'self' ${dev} ${dev.replace('http', 'ws')}`)
    .replace("default-src 'self'", `default-src 'self' ${dev}`);
}

function applySecurityPolicies(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // onHeadersReceived fires for every request in this session, including everything the
    // YouTube player <iframe> loads on its own (its scripts, fonts, XHRs) since it shares this
    // session. Only the app's own top-level document should get this header — applying it
    // session-wide silently broke the embedded player by overwriting YouTube's own CSP with
    // ours in its place, which blocked its inline scripts and fonts and left it a black box.
    if (details.resourceType !== 'mainFrame') {
      callback({});
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()],
      },
    });
  });
}

/** The window never navigates away from its own UI; external links open in the browser. */
function restrictNavigation(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event, url) => {
    // In development a full HMR reload targets the same origin; production allows no navigation.
    const allowed = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL));
    if (!allowed) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open the DevTools only in development.
    mainWindow.webContents.openDevTools();
  } else {
    const rendererDir = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
    const origin = await serveRendererDirectory(rendererDir);
    mainWindow.loadURL(`${origin}/index.html`);
  }

  restrictNavigation(mainWindow);
  registerIpc(mainWindow);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  applySecurityPolicies();
  void createWindow();
});

// Closing the window quits the app on every platform, including macOS: this is a small
// single-window utility, not a background/menu-bar app, so staying resident in the dock after
// the window closes (the usual mac convention) would just look like the app failed to close.
app.on('window-all-closed', () => {
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
