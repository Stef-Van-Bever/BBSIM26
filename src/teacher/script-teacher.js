// script-teacher.js

// Reuse debugLog from script-core.js when available.
// Fallback only if teacher script is loaded without core.
if (typeof window.debugLog !== "function") {
    window.debugLog = (...args) => {
        if (window.DEBUG_LOGS) console.log(...args);
    };
}
// ==========================
// Teacher workflow guardrails + feedback UI
// ==========================

/**
 * Small toast/banner in the bottom-right.
 * We keep it lightweight (no dependency) and safe (textContent only).
 */
function getTeacherToastEl() {
    let el = document.getElementById("teacherToast");
    if (!el) {
        el = document.createElement("div");
        el.id = "teacherToast";
        el.className = "teacher-toast hidden";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.appendChild(el);
    }
    return el;
}

let toastTimer = null;
function showTeacherToast(message, variant = "success") {
    const el = getTeacherToastEl();
    el.textContent = message;

    el.classList.remove("hidden");
    el.classList.toggle("error", variant === "error");

    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        el.classList.add("hidden");
    }, 2200);
}

// Cache the original button labels so we can restore them after reset.
const teacherUiLabels = {
    startBtnBase: null,
    targetBtnBase: null,
};

function updateSaveButtonVisual(buttonEl, isSaved, baseLabel) {
    if (!buttonEl) return;

    // Preserve the original label once.
    if (!baseLabel) baseLabel = buttonEl.textContent?.trim() || "";

    // Visual confirmation: add a check mark + a subtle style.
    buttonEl.textContent = isSaved ? `${baseLabel} ✓` : baseLabel;
    buttonEl.classList.toggle("btn-saved", Boolean(isSaved));
}
function updateWorkflowStepper() {
    const stepStart = document.getElementById("wfStepStart");
    const stepTarget = document.getElementById("wfStepTarget");
    const stepAnalyze = document.getElementById("wfStepAnalyze");
    const stepExport = document.getElementById("wfStepExport");

    const sStart = document.getElementById("wfStartStatus");
    const sTarget = document.getElementById("wfTargetStatus");
    const sAnalyze = document.getElementById("wfAnalyzeStatus");
    const sExport = document.getElementById("wfExportStatus");

    const hasStart = Boolean(teacherState.startStructureSet);
    const hasTarget = Boolean(teacherState.targetStructureSet);
    const analyzed = Boolean(teacherState.analysisCompleted);
    const hasTasks = Array.isArray(teacherState.generatedTasks)
        ? teacherState.generatedTasks.length > 0
        : false;

    // Status text
    if (sStart) sStart.textContent = hasStart ? "Saved ✓" : "Not set";
    if (sTarget) sTarget.textContent = hasTarget ? "Saved ✓" : "Not set";
    if (sAnalyze) sAnalyze.textContent = analyzed ? "Done ✓" : "Pending";
    if (sExport) sExport.textContent = analyzed ? "Ready" : "Locked";

    // Step classes (active/done/blocked)
    const setStepClass = (el, state) => {
        if (!el) return;
        el.classList.remove("active", "done", "blocked");
        el.classList.add(state);
    };

    setStepClass(stepStart, hasStart ? "done" : "active");
    setStepClass(
        stepTarget,
        hasStart ? (hasTarget ? "done" : "active") : "blocked",
    );
    setStepClass(
        stepAnalyze,
        hasTarget ? (analyzed ? "done" : "active") : "blocked",
    );
    setStepClass(stepExport, analyzed ? "active" : "blocked");
}

function updateWorkflowUi() {
    const analyzeBtn = document.getElementById("analyzeDifferencesBtn");

    // Target button should only be usable after Start is saved
    const targetBtn =
        document.getElementById("setTargetStructureBtn") ||
        document.getElementById("saveTargetStructureBtn");

    const exportBtn =
        document.getElementById("exportExerciseBtn") ||
        document.getElementById("exportExerciseConfigBtn");

    const hasStart = Boolean(teacherState.startStructureSet);
    const hasTarget = Boolean(teacherState.targetStructureSet);
    const analyzed = Boolean(teacherState.analysisCompleted);
    const hasTasks = Array.isArray(teacherState.generatedTasks)
        ? teacherState.generatedTasks.length > 0
        : false;

    if (targetBtn) {
        targetBtn.disabled = !hasStart;
        targetBtn.title = hasStart
            ? "Set as target structure"
            : "Set start structure first";
    }

    if (analyzeBtn) {
        const ready = hasStart && hasTarget;
        analyzeBtn.disabled = !ready;
        analyzeBtn.title = ready
            ? "Analyze differences"
            : "Set start and target structures first";
    }

    // Step 4: Export only after Analyze (prevents exporting half-finished configs)
    if (exportBtn) {
        const canExport = analyzed || hasTasks;
        exportBtn.disabled = !canExport;
        exportBtn.title = canExport
            ? "Export exercise"
            : "Run Analyze differences first";
    }

    updateWorkflowStepper();
}

function resetTeacherWorkflowState() {
    teacherState.startStructureSet = false;
    teacherState.targetStructureSet = false;
    teacherState.initialStructure = null;
    teacherState.targetStructure = null;
    teacherState.initialRecycleBin = null;
    teacherState.targetRecycleBin = null;
    teacherState.generatedTasks = [];
    teacherState.analysisCompleted = false;

    // Keep tasks editor visible for manual task creation
    const editor = document.getElementById("tasksEditor");
    if (editor) editor.classList.remove("hidden");
    renderTasksEditor([]);

    // Restore button labels
    const startBtn =
        document.getElementById("setInitialStructureBtn") ||
        document.getElementById("saveInitialStructureBtn");
    const targetBtn =
        document.getElementById("setTargetStructureBtn") ||
        document.getElementById("saveTargetStructureBtn");

    if (startBtn)
        updateSaveButtonVisual(
            startBtn,
            false,
            teacherUiLabels.startBtnBase ||
                startBtn.textContent?.replace(/\s*✓\s*$/, "").trim(),
        );
    if (targetBtn)
        updateSaveButtonVisual(
            targetBtn,
            false,
            teacherUiLabels.targetBtnBase ||
                targetBtn.textContent?.replace(/\s*✓\s*$/, "").trim(),
        );

    updateWorkflowUi();
}

// ==========================
// Teacher UI event bindings
// ==========================

/**
 * INVARIANT:
 * - Static UI event listeners (buttons/inputs) are registered here.
 * - Dynamic per-task listeners belong where tasks are rendered (task editor UI),
 *   because those elements are recreated.
 */
function bindTeacherUiEvents() {
    const initialBtn =
        document.getElementById("setInitialStructureBtn") ||
        document.getElementById("saveInitialStructureBtn");
    if (initialBtn) {
        initialBtn.addEventListener("click", () => {
            teacherState.initialStructure = deepClone(fileSystem);
            teacherState.initialRecycleBin = deepClone(recycleBin);
            teacherState.startStructureSet = true;
            // If start is re-saved, previously saved target/analyze may no longer be valid.
            teacherState.targetStructureSet = false;
            teacherState.targetStructure = null;
            teacherState.targetRecycleBin = null;
            teacherState.analysisCompleted = false;
            teacherState.generatedTasks = [];

            // Also remove visual "Saved ✓" on target button
            const targetBtn =
                document.getElementById("setTargetStructureBtn") ||
                document.getElementById("saveTargetStructureBtn");

            if (targetBtn) {
                teacherUiLabels.targetBtnBase =
                    teacherUiLabels.targetBtnBase ||
                    targetBtn.textContent?.replace(/\s*✓\s*$/, "").trim();

                updateSaveButtonVisual(
                    targetBtn,
                    false,
                    teacherUiLabels.targetBtnBase,
                );
            }

            // Remember base label once (for reset)
            teacherUiLabels.startBtnBase =
                teacherUiLabels.startBtnBase ||
                initialBtn.textContent?.replace(/\s*✓\s*$/, "").trim();

            updateSaveButtonVisual(
                initialBtn,
                true,
                teacherUiLabels.startBtnBase,
            );
            updateWorkflowUi();
            showTeacherToast("Start structure saved ✓");

            window.debugLog(
                "Initial structure saved",
                teacherState.initialStructure,
            );
        });
    }

    const targetBtn =
        document.getElementById("setTargetStructureBtn") ||
        document.getElementById("saveTargetStructureBtn");
    if (targetBtn) {
        targetBtn.addEventListener("click", () => {
            if (!teacherState.startStructureSet) {
                alert("Please set the start structure first.");
                showTeacherToast("Set start first", "error");
                updateWorkflowUi();
                return;
            }

            // Changing target invalidates previous analysis
            teacherState.analysisCompleted = false;
            teacherState.generatedTasks = [];

            teacherState.targetStructure = deepClone(fileSystem);
            teacherState.targetRecycleBin = deepClone(recycleBin);
            teacherState.targetStructureSet = true;

            // Remember base label once (for reset)
            teacherUiLabels.targetBtnBase =
                teacherUiLabels.targetBtnBase ||
                targetBtn.textContent?.replace(/\s*✓\s*$/, "").trim();

            updateSaveButtonVisual(
                targetBtn,
                true,
                teacherUiLabels.targetBtnBase,
            );
            updateWorkflowUi();
            showTeacherToast("Target structure saved ✓");

            window.debugLog(
                "Target structure saved",
                teacherState.targetStructure,
            );
        });
    }

    const analyzeBtn = document.getElementById("analyzeDifferencesBtn");
    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", () => {
            if (
                !teacherState.initialStructure ||
                !teacherState.targetStructure
            ) {
                alert("Please save both initial and target structures first.");
                return;
            }

            const raw = diffStructures(
                teacherState.initialStructure,
                teacherState.targetStructure,
                teacherState.initialRecycleBin,
                teacherState.targetRecycleBin,
            );

            window.debugLog("RAW DIFF", raw);

            const manualTasks = Array.isArray(teacherState.generatedTasks)
                ? teacherState.generatedTasks.filter(
                      (task) =>
                          task.type === "zip-compress" ||
                          task.type === "zip-extract",
                  )
                : [];

            const diffTasks = generateTasksFromDiffs(raw);
            teacherState.generatedTasks = diffTasks.concat(manualTasks);

            window.debugLog("GENERATED TASKS", teacherState.generatedTasks);

            renderTasksEditor(teacherState.generatedTasks);
            teacherState.analysisCompleted = true;
            updateWorkflowUi();
            showTeacherToast("Analysis completed ✓");
        });
    }

    // Correct export button id in exercise-configurator.html is exportExerciseBtn
    const exportBtn =
        document.getElementById("exportExerciseBtn") ||
        document.getElementById("exportExerciseConfigBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", exportExerciseConfig);
    }

    const manualTypeSelect = document.getElementById("manualTaskType");
    const addManualTaskBtn = document.getElementById("addManualTaskBtn");

    if (manualTypeSelect) {
        manualTypeSelect.addEventListener("change", () => {
            syncManualTaskControls();
        });
    }

    if (addManualTaskBtn) {
        addManualTaskBtn.addEventListener("click", () => {
            const task = buildManualZipTaskFromInputs();
            if (!task) return;

            teacherState.generatedTasks = Array.isArray(
                teacherState.generatedTasks,
            )
                ? teacherState.generatedTasks
                : [];
            teacherState.generatedTasks.push(task);
            renderTasksEditor(teacherState.generatedTasks);
            updateWorkflowUi();
            showTeacherToast("Task added");
        });
    }

    // When teacher resets the filesystem, the saved snapshots are no longer valid.
    const confirmResetBtn = document.getElementById("confirmResetBtn");
    if (confirmResetBtn) {
        confirmResetBtn.addEventListener("click", () => {
            resetTeacherWorkflowState();
            showTeacherToast("Reset: start/target cleared", "error");
        });
    }

    // Meta fields
    document.getElementById("exerciseTitle")?.addEventListener("input", (e) => {
        teacherState.meta.title = e.target.value;
    });

    document
        .getElementById("exerciseDescription")
        ?.addEventListener("input", (e) => {
            teacherState.meta.description = e.target.value;
        });
}

function syncManualTaskControls() {
    const typeSelect = document.getElementById("manualTaskType");
    const destinationGroup = document.getElementById("manualDestinationGroup");
    if (!typeSelect || !destinationGroup) return;

    const isExtract = typeSelect.value === "zip-extract";
    destinationGroup.classList.toggle("hidden", !isExtract);
}

function parseEntriesInput(value) {
    return (value || "")
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function buildManualZipTaskFromInputs() {
    const typeSelect = document.getElementById("manualTaskType");
    const zipPathInput = document.getElementById("manualZipPathInput");
    const entriesInput = document.getElementById("manualZipEntriesInput");
    const destinationInput = document.getElementById("manualDestinationInput");

    if (!typeSelect || !zipPathInput || !entriesInput) return null;

    const taskType = typeSelect.value;
    const zipPath = zipPathInput.value.trim();
    const entries = parseEntriesInput(entriesInput.value);
    const destinationFolder = destinationInput?.value.trim() || "";

    if (!zipPath) {
        alert("Geef een zip pad op.");
        return null;
    }

    if (entries.length === 0) {
        alert("Voeg minstens één entry toe.");
        return null;
    }

    if (taskType === "zip-extract" && !destinationFolder) {
        alert("Geef een doelmap op.");
        return null;
    }

    if (taskType === "zip-extract") {
        const task = {
            type: "zip-extract",
            description: "",
            zipPath,
            entries,
            destinationFolder,
            checks: [
                {
                    type: "zip-extracted-to",
                    zipPath,
                    destinationFolder,
                    expectEntries: entries,
                },
            ],
        };
        task.description = generateDefaultTaskDescription(task);
        return task;
    }

    const task = {
        type: "zip-compress",
        description: "",
        zipPath,
        entries,
        checks: [
            { type: "zip-exists", path: zipPath },
            {
                type: "zip-contains",
                zipPath,
                entries,
                mode: "all",
            },
        ],
    };
    task.description = generateDefaultTaskDescription(task);
    return task;
}

function hydrateZipTaskDefaults(task) {
    if (!task) return;

    if (!task.zipPath) {
        task.zipPath =
            task.checks?.find((c) => c.type === "zip-exists")?.path ||
            task.checks?.find((c) => c.type === "zip-contains")?.zipPath ||
            task.checks?.find((c) => c.type === "zip-extracted-to")?.zipPath ||
            "";
    }

    if (!Array.isArray(task.entries)) {
        task.entries =
            task.checks?.find((c) => c.type === "zip-contains")?.entries ||
            task.checks?.find((c) => c.type === "zip-extracted-to")
                ?.expectEntries ||
            [];
    }

    if (!task.destinationFolder) {
        task.destinationFolder =
            task.checks?.find((c) => c.type === "zip-extracted-to")
                ?.destinationFolder || "";
    }
}

function syncZipTaskChecks(task) {
    if (!task) return;

    if (task.type === "zip-extract") {
        task.checks = [
            {
                type: "zip-extracted-to",
                zipPath: task.zipPath || "",
                destinationFolder: task.destinationFolder || "",
                expectEntries: Array.isArray(task.entries) ? task.entries : [],
            },
        ];
        return;
    }

    if (task.type === "zip-compress") {
        task.checks = [
            { type: "zip-exists", path: task.zipPath || "" },
            {
                type: "zip-contains",
                zipPath: task.zipPath || "",
                entries: Array.isArray(task.entries) ? task.entries : [],
                mode: "all",
            },
        ];
    }
}

let teacherState = {
    // Guardrail flags: allow UI to enforce the correct teacher workflow
    startStructureSet: false,
    targetStructureSet: false,

    //  New: track whether teacher ran Analyze (so Export becomes Step 4)
    analysisCompleted: false,

    initialStructure: null,
    targetStructure: null,
    initialRecycleBin: null,
    targetRecycleBin: null,
    generatedTasks: [],
    meta: {
        title: "",
        description: "",
    },
};
window.exerciseConfig = {
    tasks: [],
};

// ==========================
// diff-engine
// ==========================

/**
 * diffStructures = RAW DETECTION ONLY
 *
 * INVARIANTS:
 * - Must only collect facts (flattened views)
 * - Must NOT decide what is "added/removed/renamed"
 * - Must NOT enforce priorities
 *
 * Interpretation is handled in normalizeDiffs().
 */
function diffStructures(initial, target, initialRecycleBin, targetRecycleBin) {
    return {
        initialFlat: flattenStructure(initial),
        targetFlat: flattenStructure(target),
        initialRecycleBin: Array.isArray(initialRecycleBin)
            ? deepClone(initialRecycleBin)
            : [],
        targetRecycleBin: Array.isArray(targetRecycleBin)
            ? deepClone(targetRecycleBin)
            : [],
    };
}

/**
 * normalizeDiffs = INTERPRETATION + PRIORITIZATION
 *
 * INVARIANTS:
 * - Rename detection has priority over delete detection
 * - A renamed file must NEVER be evaluated as deleted
 * - A moved file must NEVER be evaluated as deleted (future-ready)
 *
 * Output:
 * - Returns a normalized list of "diff records" used by task generation.
 */
function normalizeDiffs(raw) {
    const { initialFlat, targetFlat, initialRecycleBin, targetRecycleBin } =
        raw;

    // Phase 1: interpret facts into categorized diffs
    const interpreted = interpretDiffsFromFlats(
        initialFlat,
        targetFlat,
        initialRecycleBin,
        targetRecycleBin,
    );

    // Phase 2: normalize interpreted diffs into a flat list of diff-records
    const normalized = normalizeInterpretedDiffs(interpreted);

    // Phase 3 (future): post-processing / prioritization passes if needed
    // (kept empty intentionally to prevent behavior changes)

    return normalized;
}

/**
 * Convert two flat listings into interpreted diffs.
 * This is where we enforce invariant priorities.
 *
 * NOTE: We intentionally preserve current behavior (incl. existing quirks)
 * to keep this refactor non-breaking.
 */
/**
 * Helper: build an index on `${type}:${name}` (legacy behavior).
 */
function buildTypeNameIndex(flat) {
    const index = {};
    flat.forEach((item) => {
        index[`${item.type}:${item.name}`] = item;
    });
    return index;
}

/**
 * Helper: detect rename candidates (same parent folder, different path).
 *
 * INVARIANT:
 * - Rename detection has priority over delete detection.
 *
 * Returns:
 * - renamed: array of { kind:"renamed-file", from, to }
 * - renamedTo: Set of rename target paths (legacy tracking)
 * - renamedPaths: Set containing both from/to paths (for removal exclusion)
 */
function detectRenamesSameDir(initialFlat, targetFlat) {
    const renamed = [];
    const renamedTo = new Set();

    initialFlat.forEach((initialItem) => {
        if (initialItem.type !== "file") return;

        const initialDir = getParentPathMultiRoot(initialItem.path);

        const sameDirTarget = targetFlat.find((t) => {
            if (t.type !== "file") return false;

            const targetDir = getParentPathMultiRoot(t.path);
            return targetDir === initialDir && t.path !== initialItem.path;
        });

        if (sameDirTarget) {
            renamed.push({
                kind: "renamed-file",
                from: initialItem.path,
                to: sameDirTarget.path,
            });

            // Preserve existing behavior: track "to" paths as-is.
            renamedTo.add(sameDirTarget.path);
        }
    });

    const renamedPaths = new Set();
    renamed.forEach((r) => {
        renamedPaths.add(r.from);
        renamedPaths.add(r.to);
    });

    return { renamed, renamedTo, renamedPaths };
}

/**
 * Helper: detect added items.
 *
 * NOTE: We intentionally preserve the legacy "fullPath" quirk,
 * to avoid any behavior change during this refactor step.
 */
function detectAddedItems(
    targetFlat,
    initialIndex,
    renamedTo,
    excludedTargetPaths = new Set(),
) {
    const added = [];

    targetFlat.forEach((item) => {
        const key = `${item.type}:${item.name}`;

        // Compatibility:
        // - renamedTo stores paths like "C:\Docs\File.txt" (flatten already includes name in item.path)
        // - old quirk built "... \ name" again; keep both checks to avoid regressions
        const fullPath = `${item.path}\\${item.name}`;
        if (renamedTo.has(item.path) || renamedTo.has(fullPath)) return;
        // Exclude paths that are targets of moved/renamed items to prevent double tasks
        if (excludedTargetPaths?.has(item.path)) return;
        const normalizedPath = normalizePath(item.path);
        if (excludedTargetPaths?.has(normalizedPath)) return;
        if (!initialIndex[key]) {
            added.push(item);
        }
    });

    return added;
}

/**
 * Helper: detect removed items (excluding rename participants).
 */
function detectRemovedItems(initialFlat, targetFlat, renamedPaths, movedPaths) {
    const removed = [];

    initialFlat.forEach((item) => {
        if (movedPaths?.has(item.path)) return;

        // Exclude anything involved in a rename
        if (renamedPaths.has(item.path)) return;

        const stillExists = targetFlat.some((t) => t.path === item.path);
        if (!stillExists) removed.push(item);
    });

    return removed;
}

/**
 * Helper: detect moved files.
 *
 * IMPORTANT:
 * - This is intentionally a stub in this refactor step.
 * - Returns [] to guarantee NO behavior change.
 *
 * Future extension:
 * - Detect same "identity" moved to different parent folder.
 * - Must respect invariants: moved must not be treated as removed.
 */
function detectMovedFilesStub(initialFlat, targetFlat) {
    // Detect moved files by identity heuristic (fingerprint) instead of path.
    // INVARIANTS:
    // - Moved must not become removed
    // - Works across roots (C: -> OneDrive)
    // - Keeps behavior predictable (no fancy fuzzy matching)

    const moved = [];

    const initialFiles = initialFlat.filter((i) => i.type === "file");
    const targetFiles = targetFlat.filter((i) => i.type === "file");

    // Index targets by filename (simple, deterministic)
    const targetsByName = new Map();
    targetFiles.forEach((t) => {
        if (!targetsByName.has(t.name)) targetsByName.set(t.name, []);
        targetsByName.get(t.name).push(t);
    });

    initialFiles.forEach((src) => {
        // If file still exists at same path, it's not moved
        const stillThere = targetFiles.some((t) => t.path === src.path);
        if (stillThere) return;

        // Candidate targets with same name
        const candidates = targetsByName.get(src.name) || [];
        if (candidates.length === 0) return;

        // Deterministic pick: if multiple same-name candidates exist, pick the first
        // (Later we can improve with content/size fingerprint if needed)
        const dst = candidates[0];

        // Consider it moved if it exists elsewhere and source path no longer exists
        moved.push({
            type: "file",
            name: src.name,
            from: src.path,
            to: dst.path,
        });
    });

    return moved;
}
function detectMovedFoldersStub(initialFlat, targetFlat) {
    // Detect moved folders by simple identity heuristic:
    // - folder is not at original path anymore
    // - folder exists elsewhere with same name
    // Works across roots (C: -> OneDrive)

    const moved = [];

    const initialFolders = initialFlat.filter((i) => i.type === "folder");
    const targetFolders = targetFlat.filter((i) => i.type === "folder");

    // Index targets by folder name (deterministic)
    const targetsByName = new Map();
    targetFolders.forEach((t) => {
        if (!targetsByName.has(t.name)) targetsByName.set(t.name, []);
        targetsByName.get(t.name).push(t);
    });

    initialFolders.forEach((src) => {
        // If folder still exists at same path, it's not moved
        const stillThere = targetFolders.some((t) => t.path === src.path);
        if (stillThere) return;

        const candidates = targetsByName.get(src.name) || [];
        if (candidates.length === 0) return;

        // Deterministic: pick first same-name candidate
        const dst = candidates[0];

        moved.push({
            type: "folder",
            name: src.name,
            from: src.path,
            to: dst.path,
        });
    });

    return moved;
}

function buildPathKey(type, path) {
    return `${type}|${normalizePath(path)}`;
}

function splitPathKey(key) {
    const idx = key.indexOf("|");
    if (idx === -1) return { type: "", path: "" };
    return { type: key.slice(0, idx), path: key.slice(idx + 1) };
}

function buildRecycleBinPathSet(recycleBinItems) {
    const set = new Set();
    if (!Array.isArray(recycleBinItems)) return set;

    recycleBinItems.forEach((item) => {
        if (!item?.originalPath || !item?.name || !item?.type) return;
        const fullPath = joinPathMultiRoot(item.originalPath, item.name);
        set.add(buildPathKey(item.type, fullPath));
    });

    return set;
}

function buildRecycleBinFolderPathSet(recycleBinItems) {
    const set = new Set();
    if (!Array.isArray(recycleBinItems)) return set;

    recycleBinItems.forEach((item) => {
        if (item?.type !== "folder") return;
        if (!item?.originalPath || !item?.name) return;
        const fullPath = joinPathMultiRoot(item.originalPath, item.name);
        set.add(normalizePath(fullPath));
    });

    return set;
}

function isDescendantPath(path, ancestorPath) {
    if (!path || !ancestorPath) return false;
    const normPath = normalizePath(path);
    const normAncestor = normalizePath(ancestorPath);
    if (normPath === normAncestor) return false;
    return normPath.startsWith(`${normAncestor}\\`);
}

function buildFlatPathSet(flat) {
    const set = new Set();
    (flat || []).forEach((item) => {
        if (!item?.type || !item?.path) return;
        set.add(buildPathKey(item.type, item.path));
    });
    return set;
}

function detectCopiedItems(initialFlat, targetFlat) {
    const copied = [];
    const targetPaths = buildFlatPathSet(targetFlat);
    const initialPaths = buildFlatPathSet(initialFlat);

    const initialByTypeName = new Map();
    initialFlat.forEach((item) => {
        const key = `${item.type}:${item.name}`;
        if (!initialByTypeName.has(key)) initialByTypeName.set(key, []);
        initialByTypeName.get(key).push(item);
    });

    targetFlat.forEach((targetItem) => {
        const key = `${targetItem.type}:${targetItem.name}`;
        const sources = initialByTypeName.get(key) || [];

        const source = sources.find((src) =>
            targetPaths.has(buildPathKey(src.type, src.path)),
        );

        if (!source) return;
        if (normalizePath(source.path) === normalizePath(targetItem.path)) return;
        // Only treat as copy if the target path is new in the target structure.
        if (initialPaths.has(buildPathKey(targetItem.type, targetItem.path)))
            return;

        copied.push({
            type: targetItem.type,
            name: targetItem.name,
            from: source.path,
            to: targetItem.path,
        });
    });

    return copied;
}

/**
 * Convert two flat listings into interpreted diffs.
 * This is where we enforce invariant priorities.
 *
 * NOTE: We intentionally preserve current behavior (incl. existing quirks)
 * to keep this refactor non-breaking.
 */
function interpretDiffsFromFlats(
    initialFlat,
    targetFlat,
    initialRecycleBin,
    targetRecycleBin,
) {
    const diffs = {
        added: [],
        removed: [],
        removedPermanent: [],
        moved: [],
        movedFolders: [], // (als je moved-folders al toevoegde)
        renamed: [],
        copied: [],
        restored: [],
        binPermanentlyDeleted: [],
    };

    // ---- Rename detection (priority #1) ----
    const { renamed, renamedTo, renamedPaths } = detectRenamesSameDir(
        initialFlat,
        targetFlat,
    );
    diffs.renamed = renamed;

    // ---- Indexing (legacy behavior) ----
    const initialIndex = buildTypeNameIndex(initialFlat);

    // ---- Moved detection (priority #2) ----
    diffs.moved = detectMovedFilesStub(initialFlat, targetFlat);

    // If you already added moved folders, keep this; otherwise leave as []
    if (typeof detectMovedFoldersStub === "function") {
        diffs.movedFolders = detectMovedFoldersStub(initialFlat, targetFlat);
    }

    // Build movedPaths: exclude these from removed detection
    const movedPaths = new Set();
    diffs.moved.forEach((m) => {
        movedPaths.add(m.from);
        movedPaths.add(m.to);
    });
    diffs.movedFolders.forEach((m) => {
        movedPaths.add(m.from);
        movedPaths.add(m.to);
    });

    // Build excludedTargetPaths: exclude moved-to (and rename-to) from "added" detection
    const excludedTargetPaths = new Set();
    const addExcludedPath = (path) => {
        if (!path) return;
        excludedTargetPaths.add(path);
        excludedTargetPaths.add(normalizePath(path));
    };
    diffs.moved.forEach((m) => addExcludedPath(m.to));
    diffs.movedFolders.forEach((m) => addExcludedPath(m.to));

    // NOTE: renamedTo is already handled via renamedTo.has checks in detectAddedItems
    // but keeping this here makes it future-ready if we refactor detectAddedItems later.
    renamedTo.forEach((p) => addExcludedPath(p));

    // ---- Copied detection (after moved/rename, before added) ----
    diffs.copied = detectCopiedItems(initialFlat, targetFlat);
    diffs.copied.forEach((c) => addExcludedPath(c.to));

    // ---- Recycle bin interpretation (restore/permanent delete) ----
    const initialBinSet = buildRecycleBinPathSet(initialRecycleBin);
    const targetBinSet = buildRecycleBinPathSet(targetRecycleBin);
    const targetPathSet = buildFlatPathSet(targetFlat);

    // Restore: item was in initial bin, now exists in target and not in bin
    initialBinSet.forEach((key) => {
        if (targetPathSet.has(key) && !targetBinSet.has(key)) {
            const { type, path: rawPath } = splitPathKey(key);
            diffs.restored.push({
                type,
                path: rawPath,
                name: getNameFromPath(rawPath),
            });
            addExcludedPath(rawPath);
        }
    });

    // Permanently deleted from bin: item was in initial bin, now gone from bin and FS
    initialBinSet.forEach((key) => {
        if (!targetPathSet.has(key) && !targetBinSet.has(key)) {
            const { type, path: rawPath } = splitPathKey(key);
            diffs.binPermanentlyDeleted.push({
                type,
                path: rawPath,
                name: getNameFromPath(rawPath),
            });
        }
    });

    // ---- Added detection (after moved/rename so we can exclude moved-to) ----
    diffs.added = detectAddedItems(
        targetFlat,
        initialIndex,
        renamedTo,
        excludedTargetPaths,
    );

    // ---- Removed detection (rename + moved have priority) ----
    const removed = detectRemovedItems(
        initialFlat,
        targetFlat,
        renamedPaths,
        movedPaths,
    );
    const targetBinSetForRemoved = buildRecycleBinPathSet(targetRecycleBin);
    const targetBinFolderSet = buildRecycleBinFolderPathSet(targetRecycleBin);
    removed.forEach((item) => {
        const key = buildPathKey(item.type, item.path);
        if (targetBinSetForRemoved.has(key)) {
            diffs.removed.push(item);
            return;
        }

        const isChildOfSoftDeletedFolder = Array.from(targetBinFolderSet).some(
            (folderPath) => isDescendantPath(item.path, folderPath),
        );
        if (isChildOfSoftDeletedFolder) {
            diffs.removed.push(item);
        } else {
            diffs.removedPermanent.push(item);
        }
    });

    // Debug logs preserved (can be gated later)
    window.debugLog("INITIAL FLAT", initialFlat);
    window.debugLog("TARGET FLAT", targetFlat);

    return diffs;
}

/**
 * Convert interpreted diffs to a normalized list of records.
 * This output format is what createTaskFromDiff() expects.
 */
function normalizeInterpretedDiffs(diffs) {
    const result = [];

    diffs.added.forEach((item) => {
        result.push({
            kind: item.type === "folder" ? "added-folder" : "added-file",
            path: item.path,
            name: item.name,
        });
    });

    diffs.removed.forEach((item) => {
        result.push({
            kind: item.type === "folder" ? "removed-folder" : "removed-file",
            path: item.path,
            name: item.name,
        });
    });

    diffs.removedPermanent.forEach((item) => {
        result.push({
            kind:
                item.type === "folder"
                    ? "permanently-deleted-folder"
                    : "permanently-deleted-file",
            path: item.path,
            name: item.name,
        });
    });

    diffs.moved.forEach((item) => {
        if (item.type === "file") {
            result.push({
                kind: "moved-file",
                from: item.from,
                to: item.to,
                name: item.name,
            });
        }
    });

    diffs.movedFolders.forEach((item) => {
        if (item.type === "folder") {
            result.push({
                kind: "moved-folder",
                from: item.from,
                to: item.to,
                name: item.name,
            });
        }
    });

    diffs.renamed.forEach((item) => {
        result.push({
            kind: "renamed-file",
            from: item.from,
            to: item.to,
        });
    });

    diffs.copied.forEach((item) => {
        result.push({
            kind: item.type === "folder" ? "copied-folder" : "copied-file",
            from: item.from,
            to: item.to,
            name: item.name,
        });
    });

    diffs.restored.forEach((item) => {
        result.push({
            kind: item.type === "folder" ? "restored-folder" : "restored-file",
            path: item.path,
            name: item.name,
        });
    });

    diffs.binPermanentlyDeleted.forEach((item) => {
        result.push({
            kind:
                item.type === "folder"
                    ? "permanently-deleted-folder"
                    : "permanently-deleted-file",
            path: item.path,
            name: item.name,
        });
    });

    return result;
}

// taskmodeling

function createTaskFromDiff(diff) {
    switch (diff.kind) {
        case "added-folder":
            const task = {
                type: "folder-created",
                description: "",
                checks: [{ type: "folder-exists", path: diff.path }],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;

        case "removed-file": {
            const task = {
                type: "file-deleted",
                description: "",
                checks: [{ type: "file-not-exists", path: diff.path }],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "moved-file": {
            const task = {
                type: "file-moved",
                description: "",
                checks: [
                    {
                        type: "file-moved",
                        from: diff.from,
                        to: diff.to,
                    },
                ],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }
        case "moved-folder": {
            const task = {
                type: "folder-moved",
                description: "",
                checks: [
                    {
                        type: "folder-moved",
                        from: diff.from,
                        to: diff.to,
                    },
                ],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "renamed-file": {
            const task = {
                type: "file-renamed",
                description: "",
                checks: [
                    {
                        type: "file-renamed",
                        from: diff.from,
                        to: diff.to,
                    },
                ],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "removed-folder": {
            const task = {
                type: "folder-deleted",
                description: "",
                checks: [{ type: "folder-not-exists", path: diff.path }],
            };
            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "permanently-deleted-file": {
            const task = {
                type: "file-permanently-deleted",
                description: "",
                checks: [
                    { type: "file-permanently-deleted", path: diff.path },
                ],
            };
            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "permanently-deleted-folder": {
            const task = {
                type: "folder-permanently-deleted",
                description: "",
                checks: [
                    { type: "folder-permanently-deleted", path: diff.path },
                ],
            };
            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "added-file": {
            // Teacher-generated task: student must create a file at this exact path
            const task = {
                type: "file-created",
                description: "",
                checks: [{ type: "file-exists", path: diff.path }],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "copied-file": {
            const task = {
                type: "file-copied",
                description: "",
                checks: [
                    {
                        type: "file-copied",
                        from: diff.from,
                        to: diff.to,
                    },
                ],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "copied-folder": {
            const task = {
                type: "folder-copied",
                description: "",
                checks: [
                    {
                        type: "folder-copied",
                        from: diff.from,
                        to: diff.to,
                    },
                ],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "restored-file": {
            const task = {
                type: "file-restored",
                description: "",
                checks: [{ type: "file-restored", path: diff.path }],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }

        case "restored-folder": {
            const task = {
                type: "folder-restored",
                description: "",
                checks: [{ type: "folder-restored", path: diff.path }],
            };

            task.description = generateDefaultTaskDescription(task);
            return task;
        }
        default:
            return null;
    }
}

function generateDefaultTaskDescription(task) {
    if (!task || !task.checks || task.checks.length === 0) return "";

    switch (task.type) {
        case "folder-created": {
            const path = task.checks[0].path;
            const folderName = getNameFromPath(path);
            return `Maak een nieuwe map "${folderName}" op de juiste plaats.`;
        }

        case "file-deleted": {
            const path = task.checks[0].path;
            const fileName = getNameFromPath(path);
            return `Verwijder het bestand "${fileName}".`;
        }

        case "file-moved": {
            // For move tasks, the check is "file-moved" with { from, to }
            const moveCheck = task.checks.find((c) => c.type === "file-moved");
            const to = moveCheck?.to;

            if (!to) return "Verplaats het bestand naar de juiste plaats.";

            const fileName = getNameFromPath(to);
            const parent = getParentPathMultiRoot(to);
            const parentName = parent ? getNameFromPath(parent) : "This PC";

            return `Verplaats het bestand "${fileName}" naar "${parentName}".`;
        }

        case "folder-moved": {
            const moveCheck = task.checks.find(
                (c) => c.type === "folder-moved",
            );
            const to = moveCheck?.to;

            if (!to) return "Verplaats de map naar de juiste plaats.";

            const folderName = getNameFromPath(to);
            const parent = getParentPathMultiRoot(to);
            const parentName = parent ? getNameFromPath(parent) : "This PC";

            return `Verplaats de map "${folderName}" naar "${parentName}".`;
        }

        case "file-renamed": {
            const to = task.checks[0].to;
            const newName = getNameFromPath(to);
            return `Wijzig de bestandsnaam naar "${newName}".`;
        }

        case "folder-deleted": {
            const path = task.checks[0].path;
            const folderName = getNameFromPath(path);
            return `Verwijder de map "${folderName}".`;
        }
        case "file-created": {
            const path = task.checks[0].path;
            const fileName = getNameFromPath(path);
            return `Maak een nieuw bestand "${fileName}" op de juiste plaats.`;
        }

        case "file-copied": {
            const copyCheck = task.checks.find((c) => c.type === "file-copied");
            const to = copyCheck?.to;

            if (!to) return "Kopieer het bestand naar de juiste plaats.";

            const fileName = getNameFromPath(to);
            const parent = getParentPathMultiRoot(to);
            const parentName = parent ? getNameFromPath(parent) : "This PC";

            return `Kopieer het bestand "${fileName}" naar "${parentName}".`;
        }

        case "folder-copied": {
            const copyCheck = task.checks.find(
                (c) => c.type === "folder-copied",
            );
            const to = copyCheck?.to;

            if (!to) return "Kopieer de map naar de juiste plaats.";

            const folderName = getNameFromPath(to);
            const parent = getParentPathMultiRoot(to);
            const parentName = parent ? getNameFromPath(parent) : "This PC";

            return `Kopieer de map "${folderName}" naar "${parentName}".`;
        }

        case "file-restored": {
            const path = task.checks[0].path;
            const fileName = getNameFromPath(path);
            return `Herstel het bestand "${fileName}" uit de prullenbak.`;
        }

        case "folder-restored": {
            const path = task.checks[0].path;
            const folderName = getNameFromPath(path);
            return `Herstel de map "${folderName}" uit de prullenbak.`;
        }

        case "file-permanently-deleted": {
            const path = task.checks[0].path;
            const fileName = getNameFromPath(path);
            return `Verwijder het bestand "${fileName}" permanent.`;
        }

        case "folder-permanently-deleted": {
            const path = task.checks[0].path;
            const folderName = getNameFromPath(path);
            return `Verwijder de map "${folderName}" permanent.`;
        }

        case "zip-compress": {
            const zipPath = task.checks.find((c) => c.type === "zip-exists")
                ?.path;
            const zipName = zipPath ? getNameFromPath(zipPath) : "archief";
            return `Maak een ZIP-archief "${zipName}".`;
        }

        case "zip-extract": {
            const extractCheck = task.checks.find(
                (c) => c.type === "zip-extracted-to",
            );
            const zipName = extractCheck?.zipPath
                ? getNameFromPath(extractCheck.zipPath)
                : "archief";
            const destName = extractCheck?.destinationFolder
                ? getNameFromPath(extractCheck.destinationFolder)
                : "doelmap";
            return `Pak "${zipName}" uit naar "${destName}".`;
        }

        default:
            return "Voer deze opdracht uit.";
    }
}

// task generation
function generateTasksFromDiffs(diffs) {
    const normalized = normalizeDiffs(diffs);

    const tasks = normalized
        .map((diff) => createTaskFromDiff(diff))
        .filter(Boolean);

    teacherState.generatedTasks = tasks;
    return tasks;
}

function renderTasksEditor(tasks = teacherState.generatedTasks) {
    if (!Array.isArray(tasks)) tasks = [];
    const editor = document.getElementById("tasksEditor"); // task editor
    const list = document.getElementById("tasksList");

    if (!editor || !list) {
        window.debugLog("Tasks editor DOM elements not found");
        return;
    }

    editor.classList.remove("hidden");
    list.innerHTML = "";

    tasks.forEach((task, index) => {
        // default state
        task.enabled = true;
        task.description = task.description || "";

        const item = document.createElement("div");
        item.className = "task-item";

        // header
        const header = document.createElement("div");
        header.className = "task-header";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.enabled;
        checkbox.addEventListener("change", () => {
            task.enabled = checkbox.checked;
        });

        const typeLabel = document.createElement("span");
        typeLabel.className = "task-type";
        typeLabel.textContent = task.type;

        header.appendChild(checkbox);
        header.appendChild(typeLabel);

        // description input
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Describe this task for the student...";
        input.className = "task-description-input";
        input.value = task.description;

        input.addEventListener("input", () => {
            task.description = input.value;
        });

        item.appendChild(header);
        item.appendChild(input);

        if (task.type === "zip-compress" || task.type === "zip-extract") {
            hydrateZipTaskDefaults(task);

            const zipPathGroup = document.createElement("div");
            zipPathGroup.className = "task-param-group";
            const zipPathLabel = document.createElement("label");
            zipPathLabel.textContent = "Zip path";
            const zipPathInput = document.createElement("input");
            zipPathInput.type = "text";
            zipPathInput.className = "form-input";
            zipPathInput.value = task.zipPath || "";
            zipPathInput.addEventListener("input", () => {
                task.zipPath = zipPathInput.value;
                syncZipTaskChecks(task);
            });
            zipPathGroup.appendChild(zipPathLabel);
            zipPathGroup.appendChild(zipPathInput);
            item.appendChild(zipPathGroup);

            const entriesGroup = document.createElement("div");
            entriesGroup.className = "task-param-group";
            const entriesLabel = document.createElement("label");
            entriesLabel.textContent = "Entries (one per line)";
            const entriesInput = document.createElement("textarea");
            entriesInput.className = "form-textarea task-entries-input";
            entriesInput.value = (task.entries || []).join("\n");
            entriesInput.addEventListener("input", () => {
                task.entries = parseEntriesInput(entriesInput.value);
                syncZipTaskChecks(task);
            });
            entriesGroup.appendChild(entriesLabel);
            entriesGroup.appendChild(entriesInput);
            item.appendChild(entriesGroup);

            if (task.type === "zip-extract") {
                const destinationGroup = document.createElement("div");
                destinationGroup.className = "task-param-group";
                const destinationLabel = document.createElement("label");
                destinationLabel.textContent = "Destination folder";
                const destinationInput = document.createElement("input");
                destinationInput.type = "text";
                destinationInput.className = "form-input";
                destinationInput.value = task.destinationFolder || "";
                destinationInput.addEventListener("input", () => {
                    task.destinationFolder = destinationInput.value;
                    syncZipTaskChecks(task);
                });
                destinationGroup.appendChild(destinationLabel);
                destinationGroup.appendChild(destinationInput);
                item.appendChild(destinationGroup);
            }
        }

        list.appendChild(item);
    });
}

function makeLegacySubjectId(kind, path, fallback = "unknown") {
    const raw = path || fallback;
    const normalized =
        typeof normalizePath === "function" ? normalizePath(raw) : raw;
    return `legacy:${kind}:${normalized}`;
}

function getFirstCheck(task, type) {
    if (!Array.isArray(task?.checks)) return null;
    return task.checks.find((check) => check?.type === type) || null;
}

function convertLegacyTaskToDsl(task) {
    const checks = Array.isArray(task?.checks) ? task.checks : [];

    switch (task?.type) {
        case "file-moved":
        case "folder-moved": {
            const moveCheck =
                getFirstCheck(task, "file-moved") ||
                getFirstCheck(task, "folder-moved");
            if (!moveCheck?.from || !moveCheck?.to) {
                return { error: `Missing move check data for "${task.type}"` };
            }
            return {
                task: {
                    type: "move",
                    subjectId: makeLegacySubjectId(task.type, moveCheck.from),
                    fromPath: moveCheck.from,
                    toPath: moveCheck.to,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "file-renamed": {
            const renameCheck = getFirstCheck(task, "file-renamed");
            if (!renameCheck?.from || !renameCheck?.to) {
                return { error: `Missing rename check data for "${task.type}"` };
            }
            return {
                task: {
                    type: "rename",
                    subjectId: makeLegacySubjectId(task.type, renameCheck.from),
                    fromName: getNameFromPath(renameCheck.from),
                    toName: getNameFromPath(renameCheck.to),
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "file-deleted":
        case "folder-deleted":
        case "file-permanently-deleted":
        case "folder-permanently-deleted": {
            const deleteCheck =
                getFirstCheck(task, "file-not-exists") ||
                getFirstCheck(task, "folder-not-exists") ||
                checks[0];
            if (!deleteCheck?.path) {
                return { error: `Missing delete path for "${task.type}"` };
            }
            return {
                task: {
                    type: "delete",
                    subjectId: makeLegacySubjectId(task.type, deleteCheck.path),
                    fromPath: deleteCheck.path,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "file-created":
        case "folder-created": {
            const createCheck =
                getFirstCheck(task, "file-exists") ||
                getFirstCheck(task, "folder-exists") ||
                checks[0];
            if (!createCheck?.path) {
                return { error: `Missing create path for "${task.type}"` };
            }
            return {
                task: {
                    type: "create",
                    subjectId: makeLegacySubjectId(task.type, createCheck.path),
                    toPath: createCheck.path,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "file-restored":
        case "folder-restored": {
            const restoreCheck =
                getFirstCheck(task, "file-restored") ||
                getFirstCheck(task, "folder-restored");
            if (!restoreCheck?.path) {
                return { error: `Missing restore path for "${task.type}"` };
            }
            return {
                task: {
                    type: "restore",
                    subjectId: makeLegacySubjectId(task.type, restoreCheck.path),
                    toPath: restoreCheck.path,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "file-copied":
        case "folder-copied": {
            const copyCheck =
                getFirstCheck(task, "file-copied") ||
                getFirstCheck(task, "folder-copied");
            if (!copyCheck?.from || !copyCheck?.to) {
                return { error: `Missing copy check data for "${task.type}"` };
            }
            return {
                task: {
                    type: "copy",
                    subjectId: makeLegacySubjectId(task.type, copyCheck.from),
                    fromPath: copyCheck.from,
                    toPath: copyCheck.to,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "zip-compress": {
            const zipExists = getFirstCheck(task, "zip-exists");
            if (!zipExists?.path) {
                return { error: `Missing zip output path for "${task.type}"` };
            }
            const zipContains = getFirstCheck(task, "zip-contains");
            const inputIds = Array.isArray(zipContains?.entries)
                ? zipContains.entries.map((entry) =>
                      makeLegacySubjectId("entry", entry),
                  )
                : [];

            return {
                task: {
                    type: "zip-create",
                    inputIds,
                    outputName: getNameFromPath(zipExists.path),
                    outputPath: zipExists.path,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        case "zip-extract": {
            const extractCheck = getFirstCheck(task, "zip-extracted-to");
            if (!extractCheck?.zipPath || !extractCheck?.destinationFolder) {
                return { error: `Missing zip extract data for "${task.type}"` };
            }

            return {
                task: {
                    type: "zip-extract",
                    archiveId: makeLegacySubjectId(
                        "archive",
                        extractCheck.zipPath,
                    ),
                    destPath: extractCheck.destinationFolder,
                    strict: false,
                    description: task.description || "",
                    checks,
                },
            };
        }

        default:
            return { error: `Task type "${task?.type || "unknown"}" is unsupported` };
    }
}

function toDslTasks(tasks) {
    const dslTypes = new Set(
        Object.values(window.TaskDSL?.TASK_TYPES || {}),
    );

    const dslTasks = [];
    const conversionErrors = [];

    tasks.forEach((task, index) => {
        if (dslTypes.has(task?.type)) {
            dslTasks.push(task);
            return;
        }

        const converted = convertLegacyTaskToDsl(task);
        if (converted.task) {
            dslTasks.push(converted.task);
            return;
        }

        conversionErrors.push(`tasks[${index}]: ${converted.error}`);
    });

    return { dslTasks, conversionErrors };
}

// task export
function exportExerciseConfig() {
    const hasTasks = Array.isArray(teacherState.generatedTasks)
        ? teacherState.generatedTasks.length > 0
        : false;
    if (!teacherState.analysisCompleted && !hasTasks) {
        alert("Please run ‘Analyze differences’ first.");
        showTeacherToast("Run Analyze first", "error");
        return;
    }
    // Guardrail: exporting without a start/target is almost always a teacher mistake.
    if (!teacherState.initialStructure || !teacherState.startStructureSet) {
        alert(
            "No start structure defined. Click ‘Set as start structure’ first.",
        );
        showTeacherToast("Missing start structure", "error");
        return;
    }

    if (!teacherState.targetStructure || !teacherState.targetStructureSet) {
        alert(
            "No target structure defined. Click ‘Set as target structure’ first.",
        );
        showTeacherToast("Missing target structure", "error");
        return;
    }

    const tasks = teacherState.generatedTasks
        .filter((task) => task.enabled)
        .filter((task) => task.description && task.description.trim() !== "");

    if (tasks.length === 0) {
        alert("No valid tasks to export.");
        return;
    }

    const { dslTasks, conversionErrors } = toDslTasks(tasks);
    if (conversionErrors.length > 0) {
        alert(
            `Task conversion failed. First error: ${conversionErrors[0]}`,
        );
        showTeacherToast("Task conversion failed", "error");
        return;
    }

    const validation = window.TaskDSL?.validateTasks
        ? window.TaskDSL.validateTasks(dslTasks)
        : { valid: true, errors: [] };
    if (!validation.valid) {
        alert(`Task validation failed. First error: ${validation.errors[0]}`);
        showTeacherToast("Invalid task data", "error");
        return;
    }

    const exportData = {
        meta: {
            title: teacherState.meta.title || "Untitled exercise",
            description: teacherState.meta.description || "",
        },
        initialStructure: teacherState.initialStructure,
        initialRecycleBin: teacherState.initialRecycleBin || [],
        tasks: dslTasks,
    };

    const json = JSON.stringify(exportData, null, 2);

    downloadJSON(json, "../config/exercise-config.json");
}

document.addEventListener("DOMContentLoaded", () => {
    bindTeacherUiEvents();
    // Initial guardrail state: analyze is disabled until start+target are saved
    updateWorkflowUi();
    syncManualTaskControls();

    const editor = document.getElementById("tasksEditor");
    if (editor) editor.classList.remove("hidden");

    // Use current filesystem as initial structure in teacher mode
    if (!fileSystem) {
        console.error("Teacher mode started without a filesystem");
    }
    // Do NOT auto-set initial structure.
    // Teacher must explicitly choose the start structure.
    window.debugLog(
        "Teacher mode ready. Waiting for start structure selection.",
    );

    window.debugLog("Default start structure loaded for teacher");
});
