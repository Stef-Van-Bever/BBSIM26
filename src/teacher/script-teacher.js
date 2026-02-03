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

const taskBuilderState = {
    subject: null,
    toPath: "",
    archive: null,
    zipInputNodes: [],
    zipOutputPath: "",
    picker: null,
    pickerSelectedId: null,
    pickerSelectedIds: [],
    pickerExpandedIds: [],
};

function updateTasksEditorVisibility() {
    const editor = document.getElementById("tasksEditor");
    if (!editor) return;
    editor.classList.toggle("hidden", !teacherState.startStructureSet);
}

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

    updateTasksEditorVisibility();
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
    resetTaskBuilderDraft();

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
            renderTasksEditor([]);

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
            renderTasksEditor([]);

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
                          task.isManual === true ||
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

    bindTaskBuilderEvents();

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

function parseEntriesInput(value) {
    return (value || "")
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function getTaskBuilderEls() {
    return {
        typeSelect: document.getElementById("manualTaskType"),
        strictInput: document.getElementById("manualTaskStrictInput"),
        descriptionInput: document.getElementById("manualTaskDescriptionInput"),
        subjectGroup: document.getElementById("manualSubjectGroup"),
        subjectDisplay: document.getElementById("manualSubjectDisplay"),
        toPathGroup: document.getElementById("manualToPathGroup"),
        toPathInput: document.getElementById("manualToPathInput"),
        renameGroup: document.getElementById("manualRenameGroup"),
        renameToNameInput: document.getElementById("manualRenameToNameInput"),
        zipCreateGroup: document.getElementById("manualZipCreateGroup"),
        zipInputList: document.getElementById("manualZipInputList"),
        zipOutputNameInput: document.getElementById("manualZipOutputNameInput"),
        zipOutputPathInput: document.getElementById("manualZipOutputPathInput"),
        zipExtractGroup: document.getElementById("manualZipExtractGroup"),
        zipArchiveInput: document.getElementById("manualZipArchiveInput"),
        destinationInput: document.getElementById("manualDestinationInput"),
        pickerHint: document.getElementById("manualPickerHint"),
        taskNodePickerModal: document.getElementById("taskNodePickerModal"),
        taskNodePickerTitle: document.getElementById("taskNodePickerTitle"),
        taskNodePickerList: document.getElementById("taskNodePickerList"),
        confirmTaskNodePickerBtn: document.getElementById(
            "confirmTaskNodePickerBtn",
        ),
    };
}

function resetTaskBuilderDraft() {
    taskBuilderState.subject = null;
    taskBuilderState.toPath = "";
    taskBuilderState.archive = null;
    taskBuilderState.zipInputNodes = [];
    taskBuilderState.zipOutputPath = "";
    taskBuilderState.picker = null;
    taskBuilderState.pickerSelectedId = null;
    taskBuilderState.pickerSelectedIds = [];
    taskBuilderState.pickerExpandedIds = [];

    const els = getTaskBuilderEls();
    if (els.descriptionInput) els.descriptionInput.value = "";
    if (els.renameToNameInput) els.renameToNameInput.value = "";
    if (els.zipOutputNameInput) els.zipOutputNameInput.value = "";
    if (els.strictInput) els.strictInput.checked = false;

    clearTaskPicker();
    syncManualTaskControls();
}

function buildNodePickerItems() {
    const items = [];

    function walk(node, path, level, isRoot = false, parentId = null) {
        if (!node) return;
        items.push({
            id: node.id,
            type: node.type,
            name: node.name,
            path,
            level,
            isRoot,
            parentId,
            hasChildren:
                node.type === "folder" &&
                Array.isArray(node.children) &&
                node.children.length > 0,
            isZip: !!node.isZip || !!node.name?.endsWith?.(".zip"),
        });

        if (node.type !== "folder" || !Array.isArray(node.children)) return;
        node.children.forEach((child) => {
            const childPath = joinPathMultiRoot(path, child.name);
            walk(child, childPath, level + 1, false, node.id);
        });
    }

    const roots = fileSystem?.roots || [];
    roots.forEach((root) => walk(root, root.name, 0, true));
    return items;
}

function getFilteredNodePickerItems() {
    const picker = taskBuilderState.picker;
    if (!picker) return [];

    const all = buildNodePickerItems();
    if (picker.kind === "subject") {
        return all;
    }
    if (picker.kind === "archive") {
        return all.filter((node) => !node.isRoot && node.type === "file" && node.isZip);
    }
    if (picker.kind === "zip-input") {
        return all.filter((node) => !node.isRoot);
    }
    if (picker.kind === "folder-path") {
        return all.filter((node) => node.type === "folder");
    }

    return [];
}

function isPickerItemSelectable(picker, item) {
    if (!picker || !item) return false;
    if (picker.kind === "subject") return !item.isRoot;
    return true;
}

function renderTaskNodePicker() {
    const els = getTaskBuilderEls();
    const list = els.taskNodePickerList;
    const confirmBtn = els.confirmTaskNodePickerBtn;
    if (!list || !confirmBtn) return;

    const picker = taskBuilderState.picker;
    const items = getFilteredNodePickerItems();
    const multi = picker?.kind === "zip-input";

    confirmBtn.textContent = multi ? "Add selected" : "Select";

    if (items.length === 0) {
        list.innerHTML = '<div class="folder-picker-empty">No matching items available.</div>';
        return;
    }

    const selectedIds = new Set(taskBuilderState.pickerSelectedIds || []);
    const expandedIds = new Set(taskBuilderState.pickerExpandedIds || []);
    const byId = new Map(items.map((item) => [String(item.id), item]));

    const isVisible = (item) => {
        let parentId = item.parentId;
        while (parentId) {
            if (!expandedIds.has(parentId)) return false;
            const parent = byId.get(String(parentId));
            parentId = parent?.parentId || null;
        }
        return true;
    };

    const visibleItems = items.filter(isVisible);
    list.innerHTML = visibleItems
        .map((item) => {
            const selected = multi
                ? selectedIds.has(item.id)
                : taskBuilderState.pickerSelectedId === item.id;
            const selectable = isPickerItemSelectable(picker, item);
            const canToggle = item.type === "folder" && item.hasChildren;
            const expanded = expandedIds.has(item.id);
            return `
                <div class="folder-picker-item ${selected ? "selected" : ""} ${selectable ? "" : "picker-disabled"}" data-picker-id="${item.id}" style="--level:${item.level}">
                    <button type="button" class="picker-toggle ${canToggle ? "" : "empty"}" data-toggle-id="${item.id}">
                        ${canToggle ? (expanded ? "▾" : "▸") : ""}
                    </button>
                    ${multi ? `<input type="checkbox" ${selected ? "checked" : ""} />` : ""}
                    <span>${item.path}</span>
                </div>
            `;
        })
        .join("");

    list.querySelectorAll("[data-toggle-id]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const id = btn.dataset.toggleId;
            const item = byId.get(String(id));
            if (!item || item.type !== "folder" || !item.hasChildren) return;

            const next = new Set(taskBuilderState.pickerExpandedIds || []);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            taskBuilderState.pickerExpandedIds = Array.from(next);
            renderTaskNodePicker();
        });
    });

    list.querySelectorAll("[data-picker-id]").forEach((el) => {
        el.addEventListener("click", () => {
            const id = el.dataset.pickerId;
            const item = byId.get(String(id));
            if (!isPickerItemSelectable(picker, item)) return;
            if (multi) {
                const set = new Set(taskBuilderState.pickerSelectedIds || []);
                if (set.has(id)) set.delete(id);
                else set.add(id);
                taskBuilderState.pickerSelectedIds = Array.from(set);
            } else {
                taskBuilderState.pickerSelectedId = id;
            }
            renderTaskNodePicker();
        });
    });
}

function openTaskNodePicker(config) {
    const els = getTaskBuilderEls();
    const allItems = buildNodePickerItems();
    taskBuilderState.picker = config;
    taskBuilderState.pickerSelectedId = null;
    taskBuilderState.pickerSelectedIds = [];
    taskBuilderState.pickerExpandedIds = allItems
        .filter((item) => item.isRoot)
        .map((item) => item.id);

    if (els.taskNodePickerTitle) {
        els.taskNodePickerTitle.textContent = config.title || "Select item";
    }

    renderTaskNodePicker();
    showModal("taskNodePickerModal");
}

function applyTaskNodePickerSelection() {
    const picker = taskBuilderState.picker;
    if (!picker) return;

    const items = getFilteredNodePickerItems();
    const byId = new Map(items.map((item) => [String(item.id), item]));

    if (picker.kind === "zip-input") {
        const ids = taskBuilderState.pickerSelectedIds || [];
        if (ids.length === 0) {
            alert("Select at least one item.");
            return;
        }

        ids.forEach((id) => {
            const item = byId.get(String(id));
            if (!item) return;
            const exists = taskBuilderState.zipInputNodes.some((n) => n.id === item.id);
            if (!exists) {
                taskBuilderState.zipInputNodes.push({
                    id: item.id,
                    path: item.path,
                    name: item.name,
                    type: item.type,
                });
            }
        });
    } else {
        const item = byId.get(String(taskBuilderState.pickerSelectedId));
        if (!item) {
            alert("Select an item first.");
            return;
        }

        if (picker.kind === "subject") {
            taskBuilderState.subject = {
                id: item.id,
                path: item.path,
                name: item.name,
                type: item.type,
            };
        } else if (picker.kind === "archive") {
            taskBuilderState.archive = {
                id: item.id,
                path: item.path,
                name: item.name,
                type: item.type,
            };
        } else if (picker.kind === "folder-path") {
            if (picker.target === "to-path" || picker.target === "zip-destination") {
                taskBuilderState.toPath = item.path;
            } else if (picker.target === "zip-output-path") {
                taskBuilderState.zipOutputPath = item.path;
            }
        }
    }

    clearTaskPicker();
    syncManualTaskControls();
}

function bindTaskBuilderEvents() {
    const els = getTaskBuilderEls();
    if (!els.typeSelect) return;

    els.typeSelect.addEventListener("change", syncManualTaskControls);

    document.getElementById("manualSelectSubjectBtn")?.addEventListener("click", () => {
        openTaskNodePicker({
            kind: "subject",
            title: "Select file or folder",
        });
    });

    document.getElementById("manualClearSubjectBtn")?.addEventListener("click", () => {
        taskBuilderState.subject = null;
        syncManualTaskControls();
    });

    document.getElementById("manualSelectToPathBtn")?.addEventListener("click", () => {
        openTaskNodePicker({
            kind: "folder-path",
            target: "to-path",
            title: "Select destination folder",
        });
    });

    document.getElementById("manualAddZipInputBtn")?.addEventListener("click", () => {
        openTaskNodePicker({
            kind: "zip-input",
            title: "Select ZIP input items",
        });
    });

    document
        .getElementById("manualSelectZipOutputPathBtn")
        ?.addEventListener("click", () => {
            openTaskNodePicker({
                kind: "folder-path",
                target: "zip-output-path",
                title: "Select ZIP output folder",
            });
        });

    document.getElementById("manualSelectArchiveBtn")?.addEventListener("click", () => {
        openTaskNodePicker({
            kind: "archive",
            title: "Select ZIP archive",
        });
    });

    document
        .getElementById("manualSelectDestinationBtn")
        ?.addEventListener("click", () => {
            openTaskNodePicker({
                kind: "folder-path",
                target: "zip-destination",
                title: "Select destination folder",
            });
        });

    document
        .getElementById("cancelTaskNodePickerBtn")
        ?.addEventListener("click", clearTaskPicker);

    document
        .getElementById("confirmTaskNodePickerBtn")
        ?.addEventListener("click", applyTaskNodePickerSelection);

    document.getElementById("addManualTaskBtn")?.addEventListener("click", () => {
        const task = buildManualDslTaskFromInputs();
        if (!task) return;

        teacherState.generatedTasks = Array.isArray(teacherState.generatedTasks)
            ? teacherState.generatedTasks
            : [];
        teacherState.generatedTasks.push(task);
        renderTasksEditor(teacherState.generatedTasks);
        resetTaskBuilderDraft();
        updateWorkflowUi();
        showTeacherToast("Task added");
    });

    syncManualTaskControls();
}

function renderZipInputNodeChips() {
    const els = getTaskBuilderEls();
    if (!els.zipInputList) return;

    els.zipInputList.innerHTML = taskBuilderState.zipInputNodes
        .map(
            (node, index) => `
                <span class="task-chip">
                    ${node.path}
                    <button type="button" data-zip-input-index="${index}" title="Remove">&times;</button>
                </span>
            `,
        )
        .join("");

    els.zipInputList
        .querySelectorAll("[data-zip-input-index]")
        .forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.dataset.zipInputIndex);
                taskBuilderState.zipInputNodes.splice(idx, 1);
                renderZipInputNodeChips();
            });
        });
}

function syncManualTaskControls() {
    const els = getTaskBuilderEls();
    const type = els.typeSelect?.value;
    if (!type) return;

    const needsSubject = [
        "move",
        "copy",
        "rename",
        "delete",
        "permanently-delete",
        "restore",
    ].includes(type);

    els.subjectGroup?.classList.toggle("hidden", !needsSubject);
    els.toPathGroup?.classList.toggle("hidden", !(type === "move" || type === "copy"));
    els.renameGroup?.classList.toggle("hidden", type !== "rename");
    els.zipCreateGroup?.classList.toggle("hidden", type !== "zip-create");
    els.zipExtractGroup?.classList.toggle("hidden", type !== "zip-extract");

    if (els.subjectDisplay) {
        els.subjectDisplay.value = taskBuilderState.subject
            ? `${taskBuilderState.subject.path} (${taskBuilderState.subject.id})`
            : "";
    }

    if (els.toPathInput) els.toPathInput.value = taskBuilderState.toPath || "";
    if (els.zipArchiveInput) {
        els.zipArchiveInput.value = taskBuilderState.archive
            ? taskBuilderState.archive.path
            : "";
    }
    if (els.zipOutputPathInput) {
        els.zipOutputPathInput.value = taskBuilderState.zipOutputPath || "";
    }
    if (els.destinationInput) {
        els.destinationInput.value = taskBuilderState.toPath || "";
    }

    renderZipInputNodeChips();
}

function clearTaskPicker() {
    taskBuilderState.picker = null;
    taskBuilderState.pickerSelectedId = null;
    taskBuilderState.pickerSelectedIds = [];
    taskBuilderState.pickerExpandedIds = [];
    hideModal("taskNodePickerModal");

    const hint = getTaskBuilderEls().pickerHint;
    if (hint) {
        hint.textContent = "";
        hint.classList.add("hidden");
    }
}

function makeTaskDescriptionFallback(type, data) {
    switch (type) {
        case "move":
            return `Move "${data.subject?.name || "item"}" to "${data.toPath}".`;
        case "copy":
            return `Copy "${data.subject?.name || "item"}" to "${data.toPath}".`;
        case "rename":
            return `Rename "${data.subject?.name || "item"}" to "${data.toName}".`;
        case "delete":
            return `Delete "${data.subject?.name || "item"}".`;
        case "permanently-delete":
            return `Permanently delete "${data.subject?.name || "item"}".`;
        case "restore":
            return `Restore "${data.subject?.name || "item"}".`;
        case "zip-create":
            return `Create archive "${data.outputName}".`;
        case "zip-extract":
            return `Extract "${data.archive?.name || "archive"}" to "${data.destPath}".`;
        default:
            return "Do this task.";
    }
}

function buildManualDslTaskFromInputs() {
    const els = getTaskBuilderEls();
    if (!els.typeSelect) return null;

    const type = els.typeSelect.value;
    const strict = !!els.strictInput?.checked;
    const descriptionInput = els.descriptionInput?.value?.trim() || "";
    const subject = taskBuilderState.subject;

    const base = {
        type,
        strict,
        isManual: true,
    };

    let task = null;

    if (type === "move" || type === "copy") {
        if (!subject || !taskBuilderState.toPath) {
            alert("Select subject and destination folder.");
            return null;
        }
        task = {
            ...base,
            subjectId: subject.id,
            fromPath: subject.path,
            toPath: taskBuilderState.toPath,
        };
    } else if (type === "rename") {
        const toName = els.renameToNameInput?.value?.trim() || "";
        if (!subject || !toName) {
            alert("Select subject and enter a new name.");
            return null;
        }
        task = {
            ...base,
            subjectId: subject.id,
            fromName: subject.name,
            toName,
        };
    } else if (type === "delete" || type === "permanently-delete") {
        if (!subject) {
            alert("Select a subject.");
            return null;
        }
        task = {
            ...base,
            subjectId: subject.id,
            fromPath: subject.path,
        };
    } else if (type === "restore") {
        if (!subject) {
            alert("Select a subject.");
            return null;
        }
        task = {
            ...base,
            subjectId: subject.id,
            toPath: subject.path,
        };
    } else if (type === "zip-create") {
        const outputName = els.zipOutputNameInput?.value?.trim() || "";
        if (
            taskBuilderState.zipInputNodes.length === 0 ||
            !outputName ||
            !taskBuilderState.zipOutputPath
        ) {
            alert("Select zip inputs, output name and output folder.");
            return null;
        }
        task = {
            ...base,
            inputIds: taskBuilderState.zipInputNodes.map((node) => node.id),
            outputName,
            outputPath: taskBuilderState.zipOutputPath,
        };
    } else if (type === "zip-extract") {
        if (!taskBuilderState.archive || !taskBuilderState.toPath) {
            alert("Select archive and destination folder.");
            return null;
        }
        task = {
            ...base,
            archiveId: taskBuilderState.archive.id,
            destPath: taskBuilderState.toPath,
        };
    }

    if (!task) return null;

    task.description =
        descriptionInput ||
        makeTaskDescriptionFallback(type, {
            subject,
            toPath: taskBuilderState.toPath,
            toName: els.renameToNameInput?.value?.trim(),
            outputName: els.zipOutputNameInput?.value?.trim(),
            archive: taskBuilderState.archive,
            destPath: taskBuilderState.toPath,
        });

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

    updateTasksEditorVisibility();
    list.innerHTML = "";

    tasks.forEach((task, index) => {
        // default state
        task.enabled = task.enabled !== false;
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
        typeLabel.textContent = `${task.type}${task.isManual ? " (manual)" : ""}`;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-secondary";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
            teacherState.generatedTasks.splice(index, 1);
            renderTasksEditor(teacherState.generatedTasks);
            updateWorkflowUi();
        });

        header.appendChild(checkbox);
        header.appendChild(typeLabel);
        header.appendChild(removeBtn);

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
        case "folder-deleted": {
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

        case "file-permanently-deleted":
        case "folder-permanently-deleted": {
            const deleteCheck =
                getFirstCheck(task, "file-permanently-deleted") ||
                getFirstCheck(task, "folder-permanently-deleted") ||
                checks[0];
            if (!deleteCheck?.path) {
                return {
                    error: `Missing permanent delete path for "${task.type}"`,
                };
            }
            return {
                task: {
                    type: "permanently-delete",
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
    resetTaskBuilderDraft();
    // Initial guardrail state: analyze is disabled until start+target are saved
    updateWorkflowUi();

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
