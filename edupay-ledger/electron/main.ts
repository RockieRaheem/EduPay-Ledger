/**
 * Electron Main Process
 * Entry point for the desktop application
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Menu,
  Tray,
  nativeImage,
} from "electron";
import * as path from "path";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

// Configure logging
log.transports.file.level = "info";
autoUpdater.logger = log;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 3000;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "eBursar",
    icon: path.join(__dirname, "../public/icons/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false, // Don't show until ready
    backgroundColor: "#f6f7f8",
  });

  // Load the app
  const startUrl = isDev
    ? `http://localhost:${PORT}`
    : `file://${path.join(__dirname, "../out/index.html")}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();

    // Check for updates in production
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Handle window close
  mainWindow.on("close", (event) => {
    // On macOS, hide instead of quit
    if (process.platform === "darwin") {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "../public/icons/icon.png");
  const icon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 });

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open eBursar",
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: "Check for Updates",
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("eBursar");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow?.show();
  });
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Payment",
          accelerator: "CmdOrCtrl+P",
          click: () => {
            mainWindow?.webContents.send("navigate", "/payments/record");
          },
        },
        {
          label: "New Student",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow?.webContents.send("navigate", "/students/new");
          },
        },
        { type: "separator" },
        {
          label: "Export Data",
          click: () => {
            mainWindow?.webContents.send("export-data");
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            mainWindow?.webContents.send("navigate", "/dashboard");
          },
        },
        {
          label: "Students",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            mainWindow?.webContents.send("navigate", "/students");
          },
        },
        {
          label: "Payments",
          accelerator: "CmdOrCtrl+3",
          click: () => {
            mainWindow?.webContents.send("navigate", "/payments");
          },
        },
        {
          label: "Reports",
          accelerator: "CmdOrCtrl+4",
          click: () => {
            mainWindow?.webContents.send("navigate", "/reports");
          },
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "User Guide",
          click: () => {
            shell.openExternal("https://docs.ebursar.ug/guide");
          },
        },
        {
          label: "Report Issue",
          click: () => {
            shell.openExternal("https://github.com/your-org/ebursar/issues");
          },
        },
        { type: "separator" },
        {
          label: "Check for Updates",
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          },
        },
        { type: "separator" },
        {
          label: "About eBursar",
          click: () => {
            mainWindow?.webContents.send("show-about");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for communication with renderer
function setupIpcHandlers() {
  // Get app info
  ipcMain.handle("get-app-info", () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      isDev,
    };
  });

  // Get sync status
  ipcMain.handle("get-online-status", () => {
    return require("dns")
      .promises.lookup("google.com")
      .then(() => true)
      .catch(() => false);
  });

  // Open file dialog for import
  ipcMain.handle("open-file-dialog", async (event, options) => {
    const { dialog } = require("electron");
    return dialog.showOpenDialog(mainWindow!, options);
  });

  // Save file dialog for export
  ipcMain.handle("save-file-dialog", async (event, options) => {
    const { dialog } = require("electron");
    return dialog.showSaveDialog(mainWindow!, options);
  });

  // Print receipt
  ipcMain.handle("print-receipt", async () => {
    mainWindow?.webContents.print({
      silent: false,
      printBackground: true,
    });
  });
}

// Auto-updater events
autoUpdater.on("update-available", () => {
  mainWindow?.webContents.send("update-available");
});

autoUpdater.on("update-downloaded", () => {
  mainWindow?.webContents.send("update-downloaded");
});

autoUpdater.on("error", (err) => {
  log.error("Update error:", err);
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  createMenu();
  setupIpcHandlers();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle certificate errors for development
if (isDev) {
  app.on(
    "certificate-error",
    (event, webContents, url, error, certificate, callback) => {
      event.preventDefault();
      callback(true);
    },
  );
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
