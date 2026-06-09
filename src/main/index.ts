import path from "node:path";
import { app, BrowserWindow } from "electron";
import { registerFinlogHandlers } from "@/main/ipc/register-finlog-handlers";
import { getBasePath } from "@/utils/path";

function createWindow() {
  const basePath = getBasePath();
  const preload = path.join(basePath, "preload.js");
  const isMac = process.platform === "darwin";
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: "Finlog",
    backgroundColor: "#09090b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
    },
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 16, y: 16 },
        }
      : {}),
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return mainWindow;
  }

  void mainWindow.loadFile(
    path.join(basePath, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  );
  return mainWindow;
}

void app.whenReady().then(() => {
  registerFinlogHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
