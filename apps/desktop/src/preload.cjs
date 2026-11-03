const { contextBridge, ipcRenderer } = require("electron");

// The language chosen in setup becomes the app's language, and does so again whenever setup's choice
// changes. A language the person picks inside the app afterwards is kept: the choice setup last
// applied is remembered, so only a new one in setup wins.
try {
  const chosen = ipcRenderer.sendSync("desktop.locale.get");
  if (typeof chosen === "string") {
    const storage = window.localStorage;
    if (
      !storage.getItem("corvo.uiLocale") ||
      storage.getItem("corvo.setupLocaleSynced") !== chosen
    ) {
      storage.setItem("corvo.uiLocale", chosen);
      storage.setItem("corvo.setupLocaleSynced", chosen);
    }
  }
} catch {
  /* Storage can be unavailable; the app then follows the system language. */
}

contextBridge.exposeInMainWorld("corvoDesktop", {
  platform: process.platform,
  badge: {
    set: (count) => ipcRenderer.invoke("desktop.badge.set", count),
  },
  computer: {
    managesHostChoice: true,
    requestAccess: () => ipcRenderer.invoke("desktop.computer.requestAccess"),
    revokeAccess: () => ipcRenderer.invoke("desktop.computer.revokeAccess"),
    onConfigure: (listener) => {
      const handler = () => listener();
      ipcRenderer.on("desktop.computer.configure", handler);
      return () => ipcRenderer.off("desktop.computer.configure", handler);
    },
  },
  settings: {
    onOpen: (listener) => {
      const handler = () => listener();
      ipcRenderer.on("desktop.settings.open", handler);
      return () => ipcRenderer.off("desktop.settings.open", handler);
    },
  },
  desktopControl: {
    status: () => ipcRenderer.invoke("desktop.control.status"),
    prepare: () => ipcRenderer.invoke("desktop.control.prepare"),
    openPermissionGuide: () => ipcRenderer.invoke("desktop.control.openPermissionGuide"),
  },
  connections: {
    status: () => ipcRenderer.invoke("desktop.connections.status"),
    save: (patch) => ipcRenderer.invoke("desktop.connections.save", patch),
  },
  tools: {
    detect: () => ipcRenderer.invoke("desktop.tools.detect"),
  },
  passkeys: {
    rpIds: () => ipcRenderer.invoke("desktop.passkeys.rpIds"),
  },
  window: {
    close: () => ipcRenderer.invoke("desktop.window.close"),
    minimize: () => ipcRenderer.invoke("desktop.window.minimize"),
    toggleMaximize: () => ipcRenderer.invoke("desktop.window.toggleMaximize"),
    state: () => ipcRenderer.invoke("desktop.window.state"),
  },
  update: {
    state: () => ipcRenderer.invoke("desktop.update.state"),
    check: () => ipcRenderer.invoke("desktop.update.check"),
    download: () => ipcRenderer.invoke("desktop.update.download"),
    install: () => ipcRenderer.invoke("desktop.update.install"),
  },
  oauth: {
    open: (url) => ipcRenderer.invoke("desktop.oauth.open", url),
    cancel: (url) => ipcRenderer.invoke("desktop.oauth.cancel", url),
    onCallback: (listener) => {
      // The IpcRendererEvent stays in the preload: the renderer only sees the code.
      const handler = (_event, callback) => listener(callback);
      ipcRenderer.on("desktop.oauth.callback", handler);
      return () => ipcRenderer.off("desktop.oauth.callback", handler);
    },
  },
});
