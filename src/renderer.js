const state = {
  sdRootPath: "",
  templatePath: "",
  wavFiles: [],
  mappings: [],
};

const elements = {
  selectSdRoot: document.getElementById("selectSdRoot"),
  selectTemplate: document.getElementById("selectTemplate"),
  saveKit: document.getElementById("saveKit"),
  applySuggestedRenames: document.getElementById("applySuggestedRenames"),
  sdRootPath: document.getElementById("sdRootPath"),
  templatePath: document.getElementById("templatePath"),
  status: document.getElementById("status"),
  mappingRows: document.getElementById("mappingRows"),
  renameWarnings: document.getElementById("renameWarnings"),
};

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#cf222e" : "#1f2328";
}

function sampleOptionLabel(item) {
  const truncated = item.stem.length > 8 ? `${item.stem.slice(0, 8)}*` : item.stem;
  return `${truncated}   (${item.relativePath})`;
}

function sanitizeForSamplePad(stem) {
  return (stem || "").replace(/[^A-Za-z0-9_]/g, "");
}

function uniqueSuggestion(base, usedSuggestions) {
  if (!base) {
    let fallbackCounter = 1;
    while (fallbackCounter < 1000) {
      const fallback = `SMP${String(fallbackCounter).padStart(5, "0")}`;
      if (!usedSuggestions.has(fallback)) {
        usedSuggestions.add(fallback);
        return fallback;
      }
      fallbackCounter += 1;
    }
    return "SAMPLE01";
  }

  const trimmed = base.slice(0, 8);
  if (!usedSuggestions.has(trimmed)) {
    usedSuggestions.add(trimmed);
    return trimmed;
  }

  for (let suffix = 1; suffix <= 99; suffix += 1) {
    const suffixText = String(suffix);
    const candidate = `${trimmed.slice(0, 8 - suffixText.length)}${suffixText}`;
    if (!usedSuggestions.has(candidate)) {
      usedSuggestions.add(candidate);
      return candidate;
    }
  }

  return trimmed;
}

function getRenameWarnings() {
  const warnings = [];
  const usedSuggestions = new Set();

  for (const mapping of state.mappings) {
    if (!mapping.sampleStem) {
      continue;
    }

    const sanitized = sanitizeForSamplePad(mapping.sampleStem);
    const suggested = uniqueSuggestion(sanitized, usedSuggestions);

    if (mapping.sampleStem !== suggested) {
      warnings.push({
        padLabel: mapping.padLabel,
        original: mapping.sampleStem,
        suggested,
        index: mapping.index,
        sourcePath: mapping.selectedWavPath || "",
      });
    }
  }

  return warnings;
}

function getRenameOperations() {
  const operations = [];
  const usedSuggestions = new Set();

  for (const mapping of state.mappings) {
    if (!mapping.sampleStem || !mapping.selectedWavPath) {
      continue;
    }

    const sanitized = sanitizeForSamplePad(mapping.sampleStem);
    const suggested = uniqueSuggestion(sanitized, usedSuggestions);
    operations.push({
      padLabel: mapping.padLabel,
      sourcePath: mapping.selectedWavPath,
      suggestedStem: suggested,
    });
  }

  return operations;
}

function renderRenameWarnings() {
  const warnings = getRenameWarnings();
  elements.renameWarnings.innerHTML = "";

  if (!warnings.length) {
    const item = document.createElement("li");
    item.style.color = "#1f6feb";
    item.textContent = "No rename issues detected. Selected names are SamplePad-compatible.";
    elements.renameWarnings.appendChild(item);
    return warnings;
  }

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = `${warning.padLabel}: "${warning.original}" will be saved as "${warning.suggested}"`;
    elements.renameWarnings.appendChild(item);
  }

  return warnings;
}

function renderMappings() {
  elements.mappingRows.innerHTML = "";

  for (const mapping of state.mappings) {
    const row = document.createElement("tr");

    const padCell = document.createElement("td");
    padCell.textContent = mapping.padLabel;

    const midiCell = document.createElement("td");
    midiCell.textContent = String(mapping.midiNote);

    const sampleCell = document.createElement("td");
    const select = document.createElement("select");
    select.dataset.index = String(mapping.index);

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "(none / internal sound)";
    select.appendChild(noneOption);

    for (const wav of state.wavFiles) {
      const option = document.createElement("option");
      option.value = wav.stem;
      option.textContent = sampleOptionLabel(wav);
      select.appendChild(option);
    }

    select.value = mapping.sampleStem || "";
    select.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.index);
      const selectedStem = event.target.value;
      const target = state.mappings.find((item) => item.index === index);
      const selectedWav = state.wavFiles.find((item) => item.stem === selectedStem) || null;
      if (target) {
        target.sampleStem = selectedStem;
        target.selectedWavPath = selectedWav ? selectedWav.fullPath : "";
      }
      renderRenameWarnings();
    });

    sampleCell.appendChild(select);

    row.appendChild(padCell);
    row.appendChild(midiCell);
    row.appendChild(sampleCell);
    elements.mappingRows.appendChild(row);
  }

  renderRenameWarnings();
}

async function refreshWavs() {
  if (!state.sdRootPath) {
    state.wavFiles = [];
    renderMappings();
    return;
  }

  state.wavFiles = await window.samplePad4Api.listWavs(state.sdRootPath);
  for (const mapping of state.mappings) {
    const match = state.wavFiles.find((item) => item.stem === mapping.sampleStem);
    mapping.selectedWavPath = match ? match.fullPath : "";
  }
  renderMappings();
}

elements.selectSdRoot.addEventListener("click", async () => {
  const selectedPath = await window.samplePad4Api.selectDirectory();
  if (!selectedPath) {
    return;
  }

  state.sdRootPath = selectedPath;
  elements.sdRootPath.textContent = selectedPath;
  await refreshWavs();
  setStatus(`Loaded ${state.wavFiles.length} WAV files from SD card.`);
});

elements.selectTemplate.addEventListener("click", async () => {
  try {
    const selectedKit = await window.samplePad4Api.selectKitTemplate();
    if (!selectedKit) {
      return;
    }

    const loaded = await window.samplePad4Api.loadKitTemplate(selectedKit);
    state.templatePath = selectedKit;
    state.mappings = loaded.mappings;
    elements.templatePath.textContent = `${selectedKit} (${loaded.size} bytes)`;

    renderMappings();
    setStatus("Template loaded. Edit mappings, then save a new .KIT.");
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

elements.saveKit.addEventListener("click", async () => {
  try {
    if (!state.templatePath) {
      setStatus("Select a template .KIT first.", true);
      return;
    }

    const suggestedPath = state.sdRootPath
      ? `${state.sdRootPath}/KITS/USER_001.KIT`
      : state.templatePath.replace(/\.KIT$/i, "_NEW.KIT");

    const outputPath = await window.samplePad4Api.pickOutputKit(suggestedPath);
    if (!outputPath) {
      return;
    }

    const warnings = getRenameWarnings();

    const result = await window.samplePad4Api.saveKit({
      templatePath: state.templatePath,
      mappings: state.mappings,
      outputPath,
    });

    if (warnings.length) {
      setStatus(`Saved ${result.outputPath} (${result.size} bytes). ${warnings.length} name(s) were auto-sanitized/truncated as shown in Rename Warnings.`);
    } else {
      setStatus(`Saved ${result.outputPath} (${result.size} bytes).`);
    }
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

elements.applySuggestedRenames.addEventListener("click", async () => {
  try {
    if (!state.sdRootPath) {
      setStatus("Select SD card root first.", true);
      return;
    }

    const operations = getRenameOperations();
    if (!operations.length) {
      setStatus("No mapped WAV files to copy.", true);
      return;
    }

    const result = await window.samplePad4Api.applySuggestedRenames({
      sdRootPath: state.sdRootPath,
      operations,
    });

    setStatus(`Copied ${result.copied} WAV file(s) to ${result.outputFolder}.`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

renderMappings();
