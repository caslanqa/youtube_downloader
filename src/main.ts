import { app, BrowserWindow, session, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpc } from './main/ipc';

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

const createWindow = () => {
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
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  restrictNavigation(mainWindow);
  registerIpc(mainWindow);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  applySecurityPolicies();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
