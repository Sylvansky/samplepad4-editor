# SamplePad 4 Kit Mapper

Lightweight desktop app for creating Alesis SamplePad 4 compatible `.KIT` files on Windows.

It is built specifically for the SamplePad 4 file format (`3200` bytes), using a known-good `.KIT` as template and only editing pad-to-WAV mappings plus checksum.

## What it does

- Loads a working SamplePad 4 template kit (for example your `USER_001.KIT`)
- Scans your SD card for `.wav` files
- Lets you map 6 pad inputs (4 pads + 2 triggers) to WAV stems
- One-click copies mapped WAVs to `RENAMED_WAVS/` using device-safe suggested 8-char names
- Saves a new `.KIT` file that keeps the original template structure intact

## Install

From this folder:

```bash
npm install
```

## Run (development)

```bash
npm start
```

## Build Windows installer

Run this on Windows:

```bash
npm run dist:win
```

Installer output will be in `dist/`.

## If you work from WSL

If `npm` is missing in WSL (`zsh: command not found: npm`), build from native Windows PowerShell instead of WSL:

1. Install Node.js LTS on Windows:

```powershell
winget install OpenJS.NodeJS.LTS
```

2. Open **Windows PowerShell** (not WSL), then go to this project folder. Example via WSL share:

```powershell
cd "\\wsl$\Ubuntu\home\sylvansky\dev\samplepad4-editor"
```

3. Install dependencies and build installer:

```powershell
npm install
npm run dist:win
```

4. Run the generated installer from `dist\` in Windows.

For dev mode in Windows (with Electron UI):

```powershell
npm start
```

### One-command Windows build

The build scripts automatically stage the project to a local Windows temp folder first, so Electron/npm do not fail on UNC paths (`\\wsl.localhost\...`).

From Windows PowerShell:

```powershell
cd "\\wsl.localhost\Ubuntu-24.04\home\sylvansky\dev\samplepad4-editor"
powershell -ExecutionPolicy Bypass -File .\build-win.ps1
```

From Windows Command Prompt:

```bat
cd \\wsl.localhost\Ubuntu-24.04\home\sylvansky\dev\samplepad4-editor
build-win.cmd
```

## Recommended workflow with your SD card

1. Back up your SD card first.
2. Open app.
3. Select SD card root folder.
4. Select template `.KIT` (use your known-good `USER_001.KIT`).
5. Map each pad to a WAV stem.
6. Save as a new file in `KITS/` (for example `USER_002.KIT`).
7. Eject card safely and test on hardware.

## Compatibility notes

- WAV stem names are sanitized to letters/numbers/underscore and truncated to 8 chars for device compatibility.
- This app does not try to rewrite unknown metadata blocks; it preserves template bytes except mapping fields and checksum.
