const { app, BrowserWindow, desktopCapturer, dialog, Menu, nativeImage, screen, session, shell, Tray } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

const SITE_URL = 'https://pc-speaker.vercel.app/send';
const SITE_ORIGIN = new URL(SITE_URL).origin;
const PAGE_LOAD_TIMEOUT_MS = 15000;
const DESKTOP_UI_CSS = `
  @media (max-height: 820px) {
    body { padding-top: 8px !important; padding-bottom: 8px !important; }
    main { padding: 20px !important; }
    #qr { width: 170px !important; height: 170px !important; margin: 10px auto 2px !important; }
    .pairing-card { margin: 10px 0 4px !important; padding: 8px 10px 12px !important; }
    .connection-details { margin-top: 10px !important; }
    .session-count { margin: 16px 0 2px !important; font-size: 48px !important; }
    small { margin-top: 12px !important; }
    button { margin-top: 10px !important; padding: 13px !important; }
  }
  @media (max-height: 680px) {
    body { padding-top: 4px !important; padding-bottom: 4px !important; }
    main { padding: 14px !important; border-radius: 16px !important; }
    h1 { font-size: 20px !important; }
    p { margin: 4px 0 10px !important; }
    #qr { width: 135px !important; height: 135px !important; margin: 6px auto 0 !important; }
    .pairing-card { margin: 6px 0 2px !important; padding: 6px 8px 8px !important; }
    .connection-details dl { gap: 5px 8px !important; margin: 8px 0 2px !important; }
    .session-count { margin: 10px 0 0 !important; font-size: 40px !important; }
    button { margin-top: 8px !important; padding: 11px !important; }
  }
  #approval:not([hidden]) {
    position: fixed !important;
    inset: 0 !important;
    z-index: 9999 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0 !important;
    margin: 0 !important;
    padding: 24px !important;
    max-width: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: rgba(5, 10, 20, .76) !important;
    backdrop-filter: blur(7px);
    text-align: center !important;
  }
  #approval:not([hidden])::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(380px, calc(100vw - 32px));
    height: min(300px, calc(100vh - 32px));
    transform: translate(-50%, -50%);
    border: 1px solid #52617b;
    border-radius: 18px;
    background: #202d42;
    box-shadow: 0 24px 80px rgba(0, 0, 0, .48);
  }
  #approval:not([hidden]) > * {
    position: relative;
    z-index: 1;
    width: min(320px, 100%);
  }
  #approval:not([hidden]) h2 { margin: 0 0 8px; }
  #approval:not([hidden]) p { margin: 0 0 10px; }
  #approval:not([hidden]) button { margin-top: 8px; }
`;

let mainWindow;
let tray;
let isQuitting = false;
let pageLoadTimeout;
let showingOffline = false;
let updateStatus = 'idle';
let updateProgress = 0;
let manualUpdateCheck = false;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

function refreshTrayMenu() {
  if (!tray) return;
  const updateLabel = updateStatus === 'checking' ? 'Checking for updates...'
    : updateStatus === 'downloading' ? 'Downloading update (' + updateProgress + '%)'
    : updateStatus === 'downloaded' ? 'Install update and restart'
    : 'Check for updates';
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show PC Speaker', click: showWindow },
    { type: 'separator' },
    {
      label: updateLabel,
      enabled: !['checking', 'downloading'].includes(updateStatus),
      click: () => {
        if (updateStatus === 'downloaded') autoUpdater.quitAndInstall();
        else checkForUpdates(true);
      }
    },
    { type: 'separator' },
    { label: 'Exit PC Speaker', click: quitApp }
  ]));
  tray.setToolTip(updateStatus === 'downloaded'
    ? 'PC Speaker update ready to install' : 'PC Speaker');
}

function reportUpdateError(error) {
  const notifyUser = manualUpdateCheck;
  manualUpdateCheck = false;
  updateStatus = 'idle';
  updateProgress = 0;
  refreshTrayMenu();
  console.error('PC Speaker update check failed:', error);
  if (notifyUser) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Update check failed',
      message: 'PC Speaker could not check for or download an update.',
      detail: error.message
    }).catch(dialogError => {
      console.error('Could not show the update error:', dialogError);
    });
  }
}

function checkForUpdates(manual = false) {
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Updates unavailable',
        message: 'Update checks are available in the installed app.'
      }).catch(error => {
        console.error('Could not show the update message:', error);
      });
    }
    return;
  }
  if (['checking', 'downloading', 'downloaded'].includes(updateStatus)) return;

  manualUpdateCheck = manual;
  updateStatus = 'checking';
  updateProgress = 0;
  refreshTrayMenu();
  autoUpdater.checkForUpdates().catch(error => {
    if (updateStatus !== 'idle') reportUpdateError(error);
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => {
    console.log('PC Speaker update available:', info.version);
    updateStatus = 'downloading';
    updateProgress = 0;
    refreshTrayMenu();
  });
  autoUpdater.on('update-not-available', info => {
    const notifyUser = manualUpdateCheck;
    manualUpdateCheck = false;
    updateStatus = 'idle';
    updateProgress = 0;
    refreshTrayMenu();
    console.log('PC Speaker is up to date:', info.version);
    if (notifyUser) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No updates available',
        message: 'PC Speaker is up to date.',
        detail: 'Installed version: ' + app.getVersion()
      }).catch(error => {
        console.error('Could not show the update status:', error);
      });
    }
  });
  autoUpdater.on('download-progress', progress => {
    const percent = Math.floor(progress.percent);
    if (percent === updateProgress) return;
    updateProgress = percent;
    refreshTrayMenu();
  });
  autoUpdater.on('update-downloaded', info => {
    manualUpdateCheck = false;
    updateStatus = 'downloaded';
    updateProgress = 100;
    refreshTrayMenu();
    console.log('PC Speaker update downloaded:', info.version);
    if (tray && process.platform === 'win32') {
      tray.displayBalloon({
        title: 'PC Speaker update ready',
        content: 'Right-click the tray icon and choose Install update and restart.'
      });
    }
  });
  autoUpdater.on('error', error => {
    if (updateStatus !== 'idle') reportUpdateError(error);
    else console.error('PC Speaker updater error:', error);
  });

  checkForUpdates();
  const updateCheckTimer = setInterval(() => checkForUpdates(), 6 * 60 * 60 * 1000);
  updateCheckTimer.unref();
}

function createTray() {
  if (tray) return;

  try {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tray-icon.png')
      : path.join(__dirname, 'build', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.error('Could not create the PC Speaker tray icon:', iconPath);
      return;
    }

    tray = new Tray(icon);
    tray.setToolTip('PC Speaker');
    refreshTrayMenu();
    tray.on('click', showWindow);
  } catch (error) {
    tray = null;
    console.error('Could not create the PC Speaker tray icon:', error);
  }
}

function clearPageLoadTimeout() {
  clearTimeout(pageLoadTimeout);
  pageLoadTimeout = null;
}

function startPageLoadTimeout() {
  clearPageLoadTimeout();
  const loadingWindow = mainWindow;
  pageLoadTimeout = setTimeout(() => {
    if (!loadingWindow || loadingWindow.isDestroyed() || mainWindow !== loadingWindow) return;
    console.error('PC Speaker page load timed out.');
    showOffline();
  }, PAGE_LOAD_TIMEOUT_MS);
}

function showOffline() {
  if (!mainWindow || mainWindow.isDestroyed() || showingOffline) return;
  clearPageLoadTimeout();
  showingOffline = true;
  mainWindow.loadFile(path.join(__dirname, 'offline.html'), {
    query: { target: SITE_URL }
  }).catch(error => {
    showingOffline = false;
    console.error('Could not show the offline page:', error);
  });
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1000, Math.max(320, screenWidth - 80)),
    height: Math.min(900, Math.max(400, screenHeight - 80)),
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      if (new URL(navigationUrl).origin !== SITE_ORIGIN) {
        event.preventDefault();
        return;
      }
      showingOffline = false;
      startPageLoadTimeout();
    } catch (error) {
      event.preventDefault();
      console.error('Blocked an invalid navigation URL:', error);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    clearPageLoadTimeout();
    if (mainWindow.webContents.getURL() === SITE_URL) showingOffline = false;
    mainWindow.webContents.insertCSS(DESKTOP_UI_CSS).catch(error => {
      console.error('Could not apply desktop layout styles:', error);
    });
    mainWindow.webContents.executeJavaScript(`(() => {
      const dialog = document.getElementById('approval');
      if (!dialog) return;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('tabindex', '-1');

      let wasOpen = false;
      let previousFocus = null;
      const syncDialog = () => {
        const isOpen = !dialog.hidden;
        if (isOpen && !wasOpen) {
          previousFocus = document.activeElement;
          const firstButton = dialog.querySelector('button:not([disabled])');
          (firstButton || dialog).focus();
        } else if (!isOpen && wasOpen && previousFocus && previousFocus.isConnected) {
          previousFocus.focus();
        } else if (isOpen && (document.activeElement === dialog ||
                              document.activeElement.matches('button[disabled]'))) {
          const availableButton = dialog.querySelector('button:not([disabled])');
          if (availableButton) availableButton.focus();
        }
        wasOpen = isOpen;
      };

      dialog.addEventListener('keydown', event => {
        if (dialog.hidden || event.key !== 'Tab') return;
        const buttons = Array.from(dialog.querySelectorAll('button:not([disabled])'));
        if (!buttons.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

      new MutationObserver(syncDialog).observe(dialog, {
        attributes: true,
        attributeFilter: ['hidden', 'disabled'],
        subtree: true
      });
      syncDialog();
    })();`).catch(error => {
      console.error('Could not enable the device approval dialog:', error);
    });
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -3 || !isMainFrame) return;
    console.error('PC Speaker page failed to load:', errorCode, errorDescription, validatedURL);
    showOffline();
  });

  mainWindow.on('closed', () => {
    clearPageLoadTimeout();
    mainWindow = null;
  });

  mainWindow.on('minimize', () => {
    if (tray && !mainWindow.isDestroyed()) mainWindow.hide();
  });

  mainWindow.on('close', event => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  startPageLoadTimeout();
  mainWindow.loadURL(SITE_URL).catch(error => {
    console.error('Could not load the PC Speaker page:', error);
    showOffline();
  });
  return mainWindow;
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    app.whenReady().then(showWindow).catch(error => {
      console.error('Could not reopen the PC Speaker window:', error);
    });
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(permission === 'display-capture');
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      return permission === 'display-capture';
    });

    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        if (sources.length === 0) {
          callback(null);
          return;
        }
        callback({
          video: { id: sources[0].id, name: sources[0].name },
          audio: 'loopback'
        });
      } catch (error) {
        console.error('Could not enumerate screens for audio capture:', error);
        callback(null);
      }
    });

    createTray();
    createWindow();
    setupAutoUpdater();
  }).catch(error => {
    console.error('Could not initialize PC Speaker:', error);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  showWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});
