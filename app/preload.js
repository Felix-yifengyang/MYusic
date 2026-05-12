const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("personalMusic", {
  getStatus: () => ipcRenderer.invoke("app:getStatus"),
  openPath: (target) => ipcRenderer.invoke("app:openPath", target),
  copyText: (text) => ipcRenderer.invoke("app:copyText", text)
});
