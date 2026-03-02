const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const {
  SAMPLEPAD4_FILE_SIZE,
  padMappingsFromKit,
  writeMappingsToTemplate,
  validateKitTemplate,
} = require("./src/kit");

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(() => {
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

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("select-kit-template", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "KIT files", extensions: ["KIT", "kit"] }],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("load-kit-template", async (_event, templatePath) => {
  const buffer = fs.readFileSync(templatePath);
  validateKitTemplate(buffer);

  return {
    size: buffer.length,
    expectedSize: SAMPLEPAD4_FILE_SIZE,
    mappings: padMappingsFromKit(buffer),
  };
});

function walkWavs(rootDir) {
  const items = fs.readdirSync(rootDir, { withFileTypes: true });
  const output = [];

  for (const item of items) {
    if (item.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(rootDir, item.name);
    if (item.isDirectory()) {
      output.push(...walkWavs(fullPath));
      continue;
    }

    if (!item.isFile()) {
      continue;
    }

    if (path.extname(item.name).toLowerCase() !== ".wav") {
      continue;
    }

    output.push(fullPath);
  }

  return output;
}

ipcMain.handle("list-wavs", async (_event, sdRootPath) => {
  if (!sdRootPath || !fs.existsSync(sdRootPath)) {
    return [];
  }

  const wavPaths = walkWavs(sdRootPath);

  return wavPaths
    .map((wavPath) => {
      const relative = path.relative(sdRootPath, wavPath);
      const stem = path.parse(wavPath).name;
      return {
        fullPath: wavPath,
        relativePath: relative,
        stem,
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
});

ipcMain.handle("save-kit", async (_event, payload) => {
  const { templatePath, mappings, outputPath } = payload;
  const sourceBuffer = fs.readFileSync(templatePath);
  validateKitTemplate(sourceBuffer);

  const updatedBuffer = writeMappingsToTemplate(sourceBuffer, mappings);
  fs.writeFileSync(outputPath, updatedBuffer);

  return {
    outputPath,
    size: updatedBuffer.length,
  };
});

ipcMain.handle("pick-output-kit", async (_event, suggestedPath) => {
  const result = await dialog.showSaveDialog({
    defaultPath: suggestedPath,
    filters: [{ name: "KIT files", extensions: ["KIT"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle("apply-suggested-renames", async (_event, payload) => {
  const { sdRootPath, operations } = payload;
  if (!sdRootPath || !fs.existsSync(sdRootPath)) {
    throw new Error("Select a valid SD card root folder first.");
  }

  const outputFolder = path.join(sdRootPath, "RENAMED_WAVS");
  fs.mkdirSync(outputFolder, { recursive: true });

  let copied = 0;
  for (const operation of operations || []) {
    if (!operation?.sourcePath || !operation?.suggestedStem) {
      continue;
    }

    if (!fs.existsSync(operation.sourcePath)) {
      continue;
    }

    const destinationPath = path.join(outputFolder, `${operation.suggestedStem}.wav`);
    fs.copyFileSync(operation.sourcePath, destinationPath);
    copied += 1;
  }

  return {
    copied,
    outputFolder,
  };
});
