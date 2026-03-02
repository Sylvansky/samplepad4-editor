const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("samplePad4Api", {
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  selectKitTemplate: () => ipcRenderer.invoke("select-kit-template"),
  loadKitTemplate: (templatePath) => ipcRenderer.invoke("load-kit-template", templatePath),
  listWavs: (sdRootPath) => ipcRenderer.invoke("list-wavs", sdRootPath),
  pickOutputKit: (suggestedPath) => ipcRenderer.invoke("pick-output-kit", suggestedPath),
  saveKit: (payload) => ipcRenderer.invoke("save-kit", payload),
  applySuggestedRenames: (payload) => ipcRenderer.invoke("apply-suggested-renames", payload),
});
