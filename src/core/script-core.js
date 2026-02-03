// ============================================================================
// Windows 11 File Explorer Simulator - Main Script
// ============================================================================
// Configuration sources (no build step / front-end only):
// - Student mode: loads exercise-config.json (meta + initialStructure + tasks)
// - Teacher mode: optionally loads default-structure.js (DEFAULT_STRUCTURE)
//   and exports exercise-config.json
//
// NOTE: legacy files instructions-config.js / structures-config.js are not used.
// ============================================================================

// ============================================================================
// MINI-MODULE LAYOUT (ARCHITECTURE)
// ============================================================================
// This file is intentionally kept as a single bundle (no build step).
// We keep it maintainable by grouping code into clear sections.
//
// Sections (top → bottom):
//  1) Errors & Diagnostics
//  2) Config & Generic DOM helpers (pure)
//  3) Path / Naming / Structure helpers (pure)
//  4) Checks & Evaluation (pure, side-effect free)
//  5) Application State (mutable)
//  6) DOM Cache (elements)
//  7) File system operations (mutations)
//  8) Rendering (UI)
//  9) Modals & UI flows
// 10) Event binding & Keyboard
//
// INVARIANTS:
// - Pure helpers MUST NOT mutate global state
// - Evaluation MUST be side-effect free
// - Mutations MUST be explicit and centralized

// INVARIANT INDEX (high-level)
// - USER actions (student): create new item -> NO auto-rename on conflicts
// - SYSTEM operations: paste/restore/extract/compress -> YES auto-rename on conflicts
// - Event binding only in setupEventListeners/bind* helpers (never in navigation/render logic)

// ============================================================================

// ============================================================================
// 1) Errors & Diagnostics
// ============================================================================

// Debug logging (disabled by default)
// Enable via: window.DEBUG_LOGS = true;
window.DEBUG_LOGS = window.DEBUG_LOGS ?? false;
window.debugLog =
    window.debugLog ??
    function debugLog(...args) {
        if (window.DEBUG_LOGS) console.log(...args);
    };
const debugLog = window.debugLog;

window.onerror = (msg, src, line) => {
    alert("JS error: " + msg + " at line " + line);
};

// ============================================================================
// 2) Config & Generic DOM helpers (pure)
// ============================================================================

// exercise instructions helper
function getExerciseInstructions() {
    if (typeof exerciseInstructions !== "undefined") {
        return exerciseInstructions;
    }

    const cfg = getExerciseConfig();
    if (cfg?.meta?.description) return cfg.meta.description;

    return "Volg de opdrachten in de checklist aan de linkerkant.";
}

// ============================================================================
// 2) DOM helpers (small, local side effects allowed)
// ============================================================================
// INVARIANTS:
// - Only use these helpers for safe element lookup / binding.
// - Do not bind events "randomly" in feature code; event wiring belongs in bind*/setup*.
// - These helpers should stay tiny and predictable.

function safeOn(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

function withEl(id, fn) {
    const el = document.getElementById(id);
    if (el) fn(el);
}

// Side-effect helper (initiates a file download). Keep isolated from pure utilities.
function downloadJSON(content, filename) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}
// ============================================================================
// Student checklist status persistence
// ============================================================================
// NOTE: Do not use a global `exerciseConfig` variable anywhere.
// Always use getExerciseConfig() so load/restore/reset flows stay consistent.
function getAttemptSessionKey() {
    const cfg = getExerciseConfig();
    const title = cfg?.meta?.title || "untitled";
    return `attemptActive_v1__${title}`;
}

/**
 * If this is a "fresh open" (new tab / new session), clear persisted checklist results.
 * If it's a reload in the same tab, keep them.
 */
function initStudentAttemptPersistence() {
    if (window.APP_MODE === "teacher") return;

    const k = getAttemptSessionKey();
    if (!sessionStorage.getItem(k)) {
        clearLatestCheckResults(); // prevents "instant green" on new attempt
        clearStudentChecklistState(); // prevents carrying manual checks to new attempt
        sessionStorage.setItem(k, "1");
    }
}

function getLatestCheckResultsKey() {
    const cfg = getExerciseConfig();
    const title = cfg?.meta?.title || "untitled";
    return `latestCheckResults_v1__${title}`;
}

function persistLatestCheckResults(results) {
    // Only relevant for student mode
    if (window.APP_MODE === "teacher") return;

    try {
        // Store minimal info needed to re-render UI
        const payload = results.map((t) => ({
            completed: !!t.completed,
            // checks can be missing in edge cases; normalize to []
            checks: Array.isArray(t.checks)
                ? t.checks.map((c) => ({ passed: !!c.passed }))
                : [],
        }));

        localStorage.setItem(
            getLatestCheckResultsKey(),
            JSON.stringify(payload),
        );
    } catch (e) {
        // Non-fatal: UI still works without persistence
        debugLog("Could not persist latest check results", e);
    }
}

function readLatestCheckResults() {
    if (window.APP_MODE === "teacher") return null;

    try {
        const raw = localStorage.getItem(getLatestCheckResultsKey());
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

function clearLatestCheckResults() {
    try {
        localStorage.removeItem(getLatestCheckResultsKey());
    } catch (e) {
        // ignore
    }
}

function isStudentChecklistEnabled() {
    const cfg = getExerciseConfig();
    return window.APP_MODE !== "teacher" && !!cfg?.studentChecklistEnabled;
}

function getStudentChecklistKey() {
    const cfg = getExerciseConfig();
    const title = cfg?.meta?.title || "untitled";
    return `studentChecklist_v1__${title}`;
}

function normalizeStudentChecklistState(count, state) {
    const normalized = Array.isArray(state) ? state.slice(0, count) : [];
    while (normalized.length < count) normalized.push(false);
    return normalized.map((v) => !!v);
}

function persistStudentChecklistState(state) {
    if (window.APP_MODE === "teacher") return;
    if (!isStudentChecklistEnabled()) return;

    try {
        localStorage.setItem(
            getStudentChecklistKey(),
            JSON.stringify(state || []),
        );
    } catch (e) {
        debugLog("Could not persist student checklist state", e);
    }
}

function readStudentChecklistState() {
    if (window.APP_MODE === "teacher") return null;
    if (!isStudentChecklistEnabled()) return null;

    try {
        const raw = localStorage.getItem(getStudentChecklistKey());
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

function clearStudentChecklistState() {
    try {
        localStorage.removeItem(getStudentChecklistKey());
    } catch (e) {
        // ignore
    }
}

// ================================
// Student session state persistence
// Keeps filesystem + navigation consistent on refresh (same tab)
// ================================

function getStudentSessionStateKey() {
    const cfg = getExerciseConfig();
    const title = cfg?.meta?.title || "untitled";
    return `studentSessionState_v1__${title}`;
}

function persistStudentSessionState() {
    if (window.APP_MODE === "teacher") return;
    if (!fileSystem) return;

    const payload = {
        fileSystem,
        currentPath,
        history,
        historyIndex,
        recycleBin,
    };

    try {
        sessionStorage.setItem(
            getStudentSessionStateKey(),
            JSON.stringify(payload),
        );
    } catch (e) {
        console.warn("Failed to persist student session state:", e);
    }
}

function restoreStudentSessionState() {
    if (window.APP_MODE === "teacher") return null;

    try {
        const raw = sessionStorage.getItem(getStudentSessionStateKey());
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed?.fileSystem) return null;

        return parsed;
    } catch (e) {
        console.warn("Failed to restore student session state:", e);
        return null;
    }
}

function clearStudentSessionState() {
    try {
        sessionStorage.removeItem(getStudentSessionStateKey());
    } catch (e) {
        console.warn("Failed to clear student session state:", e);
    }
}

// ============================================================================
// 3) Path / Naming / Structure helpers (pure)
// ============================================================================
// --- PURE UTILITIES ---------------------------------------------------------
// INVARIANTS:
// - Helpers in this section are deterministic where possible.
// - Helpers MUST NOT mutate global state or the DOM.
// - Never split/join paths inline outside these helpers.
// ---------------------------------------------------------------------------

// ============================================================================
// 3) PURE UTILITIES (no DOM writes, no global state mutations)
// ============================================================================
// INVARIANTS:
// - Helpers in this section are deterministic where possible.
// - No event binding / no DOM writes here.
// - Never split/join paths inline outside the path helpers below.

/**
 * PATH CONVENTION (INVARIANT):
 * - Paths are always absolute
 * - Root is always "C:"
 * - Folder paths do NOT end with a trailing backslash
 * - File paths INCLUDE the filename
 */

// --- Path helpers (pure) ----------------------------------------------------
/**
 * Returns the parent folder path of a given path.
 * Example: "C:\Docs\File.txt" → "C:\Docs"
 */
function getParentPath(path) {
    if (path === "C:") return null;
    const parts = path.split("\\");
    parts.pop();
    return parts.join("\\") || "C:";
}

/**
 * Returns the file or folder name from a path.
 * Example: "C:\Docs\File.txt" → "File.txt"
 */
function getNameFromPath(path) {
    const parts = path.split("\\");
    return parts[parts.length - 1];
}

/**
 * Joins a parent path and a child name safely.
 * Example: ("C:\Docs", "File.txt") → "C:\Docs\File.txt"
 */
function joinPath(parent, name) {
    if (parent === "C:") return `C:\\${name}`;
    return `${parent}\\${name}`;
}

// ==========================
// Multi-root helpers (pure)
// ==========================

/**
 * PATH CONVENTION (UPDATED):
 * - Paths are absolute
 * - Root is the first segment (e.g. "C:" or "OneDrive")
 * - Root paths have no trailing backslash (e.g. "C:" / "OneDrive")
 * - Folder paths do NOT end with a trailing backslash
 * - File paths INCLUDE the filename
 *
 * Special virtual locations:
 * - "This PC"
 * - "Recycle Bin"
 */

function isSpecialLocation(path) {
    return path === "This PC" || path === "Recycle Bin";
}

function getRootFromPath(path) {
    if (!path || isSpecialLocation(path)) return null;
    // "C:\Docs" => ["C:", "Docs"] => root = "C:"
    // "OneDrive\Docs" => root = "OneDrive"
    return path.split("\\").filter(Boolean)[0] || null;
}

function isRootPath(path) {
    if (!path || isSpecialLocation(path)) return false;
    const parts = path.split("\\").filter(Boolean);
    return parts.length === 1; // "C:" or "OneDrive"
}

/**
 * Updated parent path:
 * - parent of root => "This PC"
 * - parent of "This PC" => null
 */
function getParentPathMultiRoot(path) {
    if (path === "This PC") return null;
    if (path === "Recycle Bin") return "This PC";
    if (isRootPath(path)) return "This PC";

    // normal path
    const parts = path.split("\\");
    parts.pop();
    return parts.join("\\");
}

/**
 * Updated join:
 * Works for any root name ("C:" or "OneDrive") and normal folders.
 */
function joinPathMultiRoot(parent, name) {
    if (!parent || parent === "This PC") return name; // used for drive listing if needed
    return `${parent}\\${name}`;
}

// --- Protected system folders (pure) ---------------------------------------
function normalizePath(path) {
    if (!path) return "";
    return path.replace(/\//g, "\\").replace(/\\+$/, "");
}

const PROTECTED_FOLDERS = [
    "C:\\Desktop",
    "C:\\Documents",
    "C:\\Downloads",
    "OneDrive",
];
const PROTECTED_FOLDER_SET = new Set(
    PROTECTED_FOLDERS.map((p) => normalizePath(p)),
);

function isProtectedFolderPath(path) {
    if (!path) return false;
    return PROTECTED_FOLDER_SET.has(normalizePath(path));
}

function isProtectedFolderItem(item, parentPath) {
    if (!item || item.type !== "folder") return false;
    const fullPath = joinPathMultiRoot(parentPath, item.name);
    return isProtectedFolderPath(fullPath);
}

function getProtectedSelection(items, parentPath, selectedNames) {
    if (!Array.isArray(items) || !Array.isArray(selectedNames)) return [];
    return items.filter(
        (item) =>
            selectedNames.includes(item.name) &&
            isProtectedFolderItem(item, parentPath),
    );
}

// --- Node identity helpers (UUID) ------------------------------------------
function createFallbackUuid() {
    const rand = Math.random().toString(16).slice(2, 10);
    const ts = Date.now().toString(16);
    return `uuid-${ts}-${rand}`;
}

function createUuid() {
    if (
        typeof globalThis !== "undefined" &&
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === "function"
    ) {
        return globalThis.crypto.randomUUID();
    }
    return createFallbackUuid();
}

function isStructureNode(node) {
    return node && (node.type === "file" || node.type === "folder");
}

function ensureNodeId(node) {
    if (!isStructureNode(node)) return node;
    if (typeof node.id !== "string" || node.id.trim() === "") {
        node.id = createUuid();
    }
    return node;
}

function ensureNodeIdsRecursive(node) {
    if (!isStructureNode(node)) return;

    ensureNodeId(node);

    if (node.type === "folder") {
        if (!Array.isArray(node.children)) node.children = [];
        node.children.forEach((child) => ensureNodeIdsRecursive(child));
    }
}

function ensureStructureNodeIds(structure) {
    if (!structure) return structure;

    if (structure.type === "system" && Array.isArray(structure.roots)) {
        structure.roots.forEach((root) => ensureNodeIdsRecursive(root));
        return structure;
    }

    if (structure.type === "folder") {
        ensureNodeIdsRecursive(structure);
    }

    return structure;
}

function ensureRecycleBinNodeIds(items) {
    if (!Array.isArray(items)) return [];
    items.forEach((item) => ensureNodeIdsRecursive(item));
    return items;
}

function cloneNodeWithNewIds(node) {
    const cloned = deepClone(node);
    ensureNodeIdsRecursive(cloned);
    return cloned;
}

/**
 * Find a file/folder node by id in a structure root.
 * Supports both system roots and single folder roots.
 */
function findNodeById(root, id) {
    if (!root || !id) return null;

    function search(node) {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.type !== "folder" || !Array.isArray(node.children)) return null;

        for (const child of node.children) {
            const found = search(child);
            if (found) return found;
        }
        return null;
    }

    if (root.type === "system" && Array.isArray(root.roots)) {
        for (const systemRoot of root.roots) {
            const found = search(systemRoot);
            if (found) return found;
        }
        return null;
    }

    if (root.type === "folder") return search(root);
    return null;
}

/**
 * Resolve absolute path for a node id from a structure root.
 * Returns null when not found.
 */
function getPathById(root, id) {
    if (!root || !id) return null;

    function walk(node, currentPath) {
        if (!node) return null;
        if (node.id === id) return currentPath;
        if (node.type !== "folder" || !Array.isArray(node.children)) return null;

        for (const child of node.children) {
            const childPath = joinPathMultiRoot(currentPath, child.name);
            const foundPath = walk(child, childPath);
            if (foundPath) return foundPath;
        }
        return null;
    }

    if (root.type === "system" && Array.isArray(root.roots)) {
        for (const systemRoot of root.roots) {
            const foundPath = walk(systemRoot, systemRoot.name);
            if (foundPath) return foundPath;
        }
        return null;
    }

    if (root.type === "folder") {
        const startPath = root.name || "C:";
        return walk(root, startPath);
    }

    return null;
}

window.findNodeById = window.findNodeById || findNodeById;
window.getPathById = window.getPathById || getPathById;

// --- Naming helpers (SYSTEM operations: auto-rename for paste/restore/etc.) --
/**
 * Resolve naming conflicts by auto-renaming.
 *
 * INVARIANT:
 * - SYSTEM operations only (paste/restore/extract/compress)
 * - MUST NOT be used for USER create/rename flows
 */

function ensureUniqueChildName(children, desiredName) {
    // INVARIANT: behavior must match existing paste logic
    let newName = desiredName;
    let counter = 1;

    while (children.some((c) => c.name === newName)) {
        const ext = desiredName.includes(".")
            ? "." + desiredName.split(".").pop()
            : "";
        const base = desiredName.replace(ext, "");
        newName = `${base} (${counter})${ext}`;
        counter++;
    }

    return newName;
}
// Name conflict resolver (SYSTEM operations only)
function addWithUniqueName(children, item) {
    // Reuse the same naming logic everywhere (single source of truth)
    ensureNodeIdsRecursive(item);
    const finalName = ensureUniqueChildName(children, item.name);
    item.name = finalName;
    children.push(item);
}

// --- Structure helpers (pure) ----------------------------------------------
// structure flattener
/**
 * Flattens a file structure into raw fact records.
 *
 * MULTI-ROOT UPDATE:
 * - Supports system root: { type:"system", roots:[...] }
 * - Supports legacy single-root: { type:"folder", name:"C:", children:[...] }
 *
 * INVARIANTS:
 * - Produces RAW facts only (no interpretation)
 * - Order is not semantically meaningful
 * - Used as input for diff / normalization pipelines
 */
function flattenStructure(structure, currentPath = null) {
    let result = [];

    if (!structure) return result;

    // 1) System root: iterate roots
    if (structure.type === "system" && Array.isArray(structure.roots)) {
        structure.roots.forEach((root) => {
            // Root path starts at its name, e.g. "C:" or "OneDrive"
            result = result.concat(flattenStructure(root, root?.name || null));
        });
        return result;
    }

    // 2) Folder root / normal folder
    const basePath = currentPath || structure.name || "C:";

    if (!Array.isArray(structure.children)) return result;

    structure.children.forEach((item) => {
        // ✅ Multi-root safe join
        const itemPath = joinPathMultiRoot(basePath, item.name);

        result.push({
            id: item.id,
            name: item.name,
            type: item.type,
            path: itemPath,
        });

        if (item.type === "folder") {
            result = result.concat(flattenStructure(item, itemPath));
        }
    });

    return result;
}

// --- Clone helpers (pure) --------------------------------------------------
// Deep clone helper
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// history helper
function pushHistory(action) {
    actionHistory.push(action);
    if (actionHistory.length > MAX_HISTORY) {
        actionHistory.shift();
    }
}

// checklist helper
function buildInstructionChecklistFromTasks(tasks) {
    const checklistEl = document.getElementById("instructionChecklist");
    checklistEl.innerHTML = "";

    const checklistEnabled = isStudentChecklistEnabled();
    studentChecklistState = checklistEnabled
        ? normalizeStudentChecklistState(
              tasks.length,
              readStudentChecklistState(),
          )
        : [];

    tasks.forEach((task, index) => {
        const li = document.createElement("li");
        li.className = "instruction-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.disabled = !checklistEnabled;

        if (checklistEnabled) {
            checkbox.checked = !!studentChecklistState[index];
            checkbox.addEventListener("change", () => {
                if (checkbox.disabled) return;
                studentChecklistState[index] = !!checkbox.checked;
                persistStudentChecklistState(studentChecklistState);
            });
        }

        const label = document.createElement("label");
        label.className = "instruction-text";
        label.textContent = task.description || task.type || "Task";

        li.appendChild(checkbox);
        li.appendChild(label);
        checklistEl.appendChild(li);
    });
}

// Reset helpers
function resetChecklist() {
    const checklistEnabled = isStudentChecklistEnabled();
    const checkboxes = document.querySelectorAll(
        '#instructionChecklist input[type="checkbox"]',
    );

    if (checklistEnabled) {
        studentChecklistState = normalizeStudentChecklistState(
            checkboxes.length,
            null,
        );
    }

    checkboxes.forEach((cb) => {
            cb.checked = false;
            cb.disabled = !checklistEnabled;
            cb.closest(".instruction-item")?.classList.remove(
                "completed",
                "status-success",
                "status-partial",
                "status-fail",
            );
        });
}

function resetAssignment() {
    // --- Reset filesystem to the immutable start state ---
    fileSystem = deepClone(initialFileSystem);

    // --- Reset navigation & state (multi-root safe) ---
    currentPath = getDefaultRootPath(fileSystem);
    history = [currentPath];
    historyIndex = 0;

    selectedItems = [];
    clipboard = null;
    renamingItem = null;
    recycleBin = [];
    resetActionLog();

    // --- Reset checklist UI ---
    resetChecklist();

    // --- Clear persisted states ---
    clearLatestCheckResults();
    clearStudentChecklistState();
    clearStudentSessionState();

    // IMPORTANT:
    // After clearing, immediately persist the reset state so a refresh does NOT resurrect old state
    persistStudentSessionState();

    // hide modal
    hideModal("resetModal");

    // Allow new submission after reset
    exerciseSubmitted = false;
    localStorage.removeItem("exerciseSubmitted");

    withEl("submitBtn", (btn) => {
        btn.disabled = false;
        btn.title = "";
    });

    // Render again (this will also persist, but now it's the correct clean state)
    renderAll();
}

// undo helpers
function undoLastAction() {
    const action = actionHistory.pop();
    if (!action) return;

    switch (action.type) {
        case "delete": {
            const folder = getFolder(action.from);
            if (!folder) break;

            folder.children.push(...deepClone(action.items));
            recycleBin = recycleBin.filter(
                (rb) => !action.items.some((i) => i.name === rb.name),
            );
            break;
        }

        case "restore": {
            recycleBin.push(action.item);
            const folder = getFolder(action.item.originalPath);
            if (folder) {
                folder.children = folder.children.filter(
                    (c) => c.name !== action.item.name,
                );
            }
            break;
        }

        case "rename": {
            const folder = getFolder(action.path);
            const item = folder?.children.find((c) => c.name === action.to);
            if (item) item.name = action.from;
            break;
        }
    }

    renderAll();
}

function resetUndoHistory() {
    actionHistory = [];
}

function canUndo() {
    return currentPath !== "Recycle Bin" && !exerciseSubmitted;
}

// submission helper
function requestSubmit() {
    showModal("submitConfirmModal");
}

/**
 * Load exercise configuration for student mode
 */
async function loadExerciseConfig() {
    try {
        const response = await fetch("../config/exercise-config.json");
        if (!response.ok) {
            throw new Error("exercise-config.json not found");
        }
        const loadedConfig = await response.json();
        const initialStructure = loadedConfig?.initialStructure
            ? ensureStructureNodeIds(
                  normalizeToSystemRoot(loadedConfig.initialStructure),
              )
            : loadedConfig?.initialStructure;
        const initialRecycleBin = ensureRecycleBinNodeIds(
            Array.isArray(loadedConfig?.initialRecycleBin)
                ? loadedConfig.initialRecycleBin
                : [],
        );
        const tasks = window.TaskDSL?.normalizeTasks
            ? window.TaskDSL.normalizeTasks(loadedConfig?.tasks)
            : Array.isArray(loadedConfig?.tasks)
              ? loadedConfig.tasks
              : [];

        if (window.TaskDSL?.validateTasks) {
            const validation = window.TaskDSL.validateTasks(tasks);
            if (!validation.valid) {
                console.error(
                    "Invalid Task DSL in exercise-config.json:",
                    validation.errors,
                );
            }
        }

        window.exerciseConfig = {
            ...loadedConfig,
            initialStructure,
            initialRecycleBin,
            tasks,
        };
        debugLog("Exercise config loaded", window.exerciseConfig);
    } catch (err) {
        console.error("Failed to load exercise config:", err);
        window.exerciseConfig = { tasks: [] };
    }

    window.dispatchEvent(
        new CustomEvent("exercise-config-loaded", {
            detail: window.exerciseConfig,
        }),
    );
}

// evaluation helpers
function getTotalTasks() {
    return document.querySelectorAll("#instructionChecklist .instruction-item")
        .length;
}

function folderExists(path) {
    return !!getFolder(path);
}

function fileExists(path) {
    const folderPath = getParentPath(path);
    const fileName = getNameFromPath(path);
    const folder = getFolder(folderPath);
    return folder?.children?.some((c) => c.name === fileName);
}

function getFileByPath(path) {
    const folderPath = getParentPath(path);
    const fileName = getNameFromPath(path);
    const folder = getFolder(folderPath);
    return folder?.children?.find((c) => c.name === fileName) || null;
}

function recycleBinHasItem(type, path) {
    if (!path || !type) return false;
    if (!Array.isArray(recycleBin)) return false;

    const name = getNameFromPath(path);
    const parentPath = getParentPathMultiRoot(path);
    if (!name || !parentPath) return false;

    const normalizedParent = normalizePath(parentPath);
    return recycleBin.some(
        (item) =>
            item &&
            item.type === type &&
            item.name === name &&
            normalizePath(item.originalPath) === normalizedParent,
    );
}

function recycleBinHasAncestorFolder(path) {
    if (!path) return false;
    if (!Array.isArray(recycleBin)) return false;

    const normalizedPath = normalizePath(path).toLowerCase();
    if (!normalizedPath) return false;

    return recycleBin.some((item) => {
        if (!item || item.type !== "folder") return false;
        if (!item.name || !item.originalPath) return false;

        const folderPath = normalizePath(
            joinPathMultiRoot(item.originalPath, item.name),
        ).toLowerCase();
        return normalizedPath.startsWith(`${folderPath}\\`);
    });
}

function requireCheckFields(check, fields) {
    const missing = (fields || []).filter(
        (field) => check?.[field] === undefined || check?.[field] === null || check?.[field] === "",
    );

    if (missing.length > 0) {
        debugLog(
            `Check misconfigured (${check?.type || "unknown"}): missing ${missing.join(", ")}`,
            check,
        );
        return false;
    }

    return true;
}

function calculateScoreFromTasks(tasks) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;

    const rawScore = (completedTasks / totalTasks) * 100;

    // round up
    return Math.round(rawScore);
}

// ============================================================================
// 4) Checks & Evaluation (pure, side-effect free)
// ============================================================================

function evaluateCheck(check) {
    /**
     * Evaluates a single declarative check.
     *
     * INVARIANTS:
     * - This function MUST be side-effect free
     * - This function MUST NOT modify the file system
     * - A renamed or moved file must NEVER be treated as deleted
     * - Checks express "what must be true", never "how it was achieved"
     */
    switch (check.type) {
        case "folder-exists":
            if (!requireCheckFields(check, ["path"])) return false;
            return folderExists(check.path);

        case "folder-not-exists":
            if (!requireCheckFields(check, ["path"])) return false;
            // True if the folder is NOT present in the current simulated filesystem
            return !folderExists(check.path);

        case "file-exists":
            if (!requireCheckFields(check, ["path"])) return false;
            return fileExists(check.path);

        case "file-not-exists":
            if (!requireCheckFields(check, ["path"])) return false;
            return !fileExists(check.path);

        case "file-moved":
            if (!requireCheckFields(check, ["from", "to"])) return false;
            return fileExists(check.to) && !fileExists(check.from);

        case "file-renamed":
            if (!requireCheckFields(check, ["from", "to"])) return false;
            return fileExists(check.to) && !fileExists(check.from);

        case "file-copied":
            if (!requireCheckFields(check, ["from", "to"])) return false;
            return fileExists(check.from) && fileExists(check.to);

        case "folder-moved":
            if (!requireCheckFields(check, ["from", "to"])) return false;
            // Folder exists at destination and not at source
            return folderExists(check.to) && !folderExists(check.from);

        case "folder-renamed":
            if (!requireCheckFields(check, ["from", "to"])) return false;
            // Rename is conceptually move within same parent, but evaluator stays declarative:
            return folderExists(check.to) && !folderExists(check.from);

        case "folder-copied":
            if (!requireCheckFields(check, ["from", "to"])) return false;
            return folderExists(check.from) && folderExists(check.to);

        case "file-restored":
            if (!requireCheckFields(check, ["path"])) return false;
            return fileExists(check.path) && !recycleBinHasItem("file", check.path);

        case "folder-restored":
            if (!requireCheckFields(check, ["path"])) return false;
            return (
                folderExists(check.path) &&
                !recycleBinHasItem("folder", check.path)
            );

        case "file-permanently-deleted":
            if (!requireCheckFields(check, ["path"])) return false;
            return (
                !fileExists(check.path) &&
                !recycleBinHasItem("file", check.path) &&
                !recycleBinHasAncestorFolder(check.path)
            );

        case "folder-permanently-deleted":
            if (!requireCheckFields(check, ["path"])) return false;
            return (
                !folderExists(check.path) &&
                !recycleBinHasItem("folder", check.path)
            );

        case "zip-exists":
            if (!requireCheckFields(check, ["path"])) return false;
            if (!check.path.endsWith(".zip")) return false;
            const zipItem = getFileByPath(check.path);
            return !!zipItem?.isZip;

        case "zip-contains": {
            if (!requireCheckFields(check, ["zipPath", "entries"])) return false;
            const zipItem = getFileByPath(check.zipPath);
            if (!zipItem || !zipItem.name?.endsWith(".zip")) return false;
            if (!zipItem.zipMeta || !Array.isArray(zipItem.zipMeta.entries)) {
                console.warn("zip-contains check: zipMeta missing", check);
                return false;
            }

            const entries = Array.isArray(check.entries) ? check.entries : [];
            const mode = check.mode === "any" ? "any" : "all";

            if (mode === "any") {
                return entries.some((e) => zipItem.zipMeta.entries.includes(e));
            }

            return entries.every((e) => zipItem.zipMeta.entries.includes(e));
        }

        case "zip-extracted-to": {
            if (
                !requireCheckFields(check, [
                    "zipPath",
                    "destinationFolder",
                    "expectEntries",
                ])
            ) {
                return false;
            }

            if (!fileExists(check.zipPath)) return false;
            if (!folderExists(check.destinationFolder)) return false;

            const expected = Array.isArray(check.expectEntries)
                ? check.expectEntries
                : [];

            return expected.every((entry) => {
                if (typeof entry === "string") {
                    const entryPath = joinPathMultiRoot(
                        check.destinationFolder,
                        entry,
                    );
                    return fileExists(entryPath) || folderExists(entryPath);
                }

                if (!entry || typeof entry !== "object") return false;
                if (!entry.name || !entry.type) return false;

                const entryPath = joinPathMultiRoot(
                    check.destinationFolder,
                    entry.name,
                );

                if (entry.type === "file") return fileExists(entryPath);
                if (entry.type === "folder") return folderExists(entryPath);

                return false;
            });
        }

        default:
            debugLog("Unknown check type:", check.type);
            return false;
    }
}

function evaluateTasksFromConfig(tasks) {
    return tasks.map((task) => {
        const checks = Array.isArray(task?.checks) ? task.checks : [];
        const results = checks.map((check) => evaluateCheck(check));
        const completed = checks.length > 0 && results.every(Boolean);

        return {
            ...task,
            completed,
            checks: checks.map((check, index) => ({
                ...check,
                passed: results[index],
            })),
        };
    });
}

// ============================================================================
// 5) Application State (mutable)
// ============================================================================

let initialFileSystem = null; // immutable start state
let pendingDeleteItems = [];
let actionHistory = [];
const MAX_HISTORY = 5;
let exerciseSubmitted = false;
let fileSystem = null; // will be set on initialization
let currentPath = "C:";
let history = ["C:"];
let historyIndex = 0;
let selectedItems = [];
let clipboard = null;
let viewMode = "grid";
let renamingItem = null;
let recycleBin = []; // Stores deleted items with their original paths
let sidePanelVisible = false;
let studentChecklistState = [];
let actionLog = [];
let deleteContext = {
    mode: "soft", // "soft" | "permanent"
    itemName: null,
};
let isProgressRunning = false;
let extractWizardState = {
    zipName: null,
    zipParentPath: null,
    destinationPath: null,
    showAfterComplete: true,
};
let folderPickerState = {
    selectedPath: null,
};

function logEvent(type, payload = {}) {
    const entry = {
        id: createUuid(),
        ts: Date.now(),
        type,
        payload: deepClone(payload),
    };

    actionLog.push(entry);
    window.__BBSIM_ACTION_LOG__ = actionLog;
    debugLog("Action event", entry);
    return entry;
}

function getActionLog() {
    return actionLog.map((entry) => deepClone(entry));
}

function resetActionLog() {
    actionLog.length = 0;
    window.__BBSIM_ACTION_LOG__ = actionLog;
}

window.logEvent = window.logEvent || logEvent;
window.getActionLog = window.getActionLog || getActionLog;
window.resetActionLog = window.resetActionLog || resetActionLog;
window.__BBSIM_ACTION_LOG__ = actionLog;

// ============================================================================
// 6) DOM Cache (elements)
// ============================================================================

const fileListEl = document.getElementById("fileList");
const folderTreeEl = document.getElementById("folderTree");
const breadcrumbsEl = document.getElementById("breadcrumbs");
const addressInputEl = document.getElementById("addressInput");
const statusBarEl = document.getElementById("statusBar");
const contextMenuEl = document.getElementById("contextMenu");
const modalOverlayEl = document.getElementById("modalOverlay");
const sidePanelEl = document.getElementById("sidePanel");

// always check for exercise config
window.exerciseConfig = window.exerciseConfig || {
    tasks: [],
};

/**
 * Single Source of Truth for config.
 * Never read/write `exerciseConfig` directly; always go through window.exerciseConfig.
 */
function getExerciseConfig() {
    const cfg = window.exerciseConfig || {};
    const tasks = window.TaskDSL?.normalizeTasks
        ? window.TaskDSL.normalizeTasks(cfg.tasks)
        : Array.isArray(cfg.tasks)
          ? cfg.tasks
          : [];

    return {
        ...cfg,
        tasks,
    };
}

function normalizeToSystemRoot(structure) {
    // Accept:
    // 1) New format: { roots: [...] }
    // 2) Old format: { name:"C:", type:"folder", children:[...] }

    if (structure && Array.isArray(structure.roots)) {
        const normalized = {
            name: "This PC",
            type: "system",
            roots: deepClone(structure.roots),
        };
        return ensureStructureNodeIds(normalized);
    }

    // Single root fallback
    const singleRoot =
        structure && structure.name && structure.type === "folder"
            ? deepClone(structure)
            : { name: "C:", type: "folder", children: [] };

    const normalized = {
        name: "This PC",
        type: "system",
        roots: [singleRoot],
    };
    return ensureStructureNodeIds(normalized);
}

function getDefaultRootPath(systemRoot) {
    // Prefer C: if present, else first root name
    const roots = systemRoot?.roots || [];
    const c = roots.find((r) => r.name === "C:");
    return (c ? c.name : roots[0]?.name) || "C:";
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
    if (window.APP_MODE !== "teacher") {
        await loadExerciseConfig();
        initStudentAttemptPersistence();
    }

    // ✅ SINGLE SOURCE OF TRUTH
    const cfg = getExerciseConfig();

    // --- RESTORE student session state on refresh (same tab) ---
    const restored =
        window.APP_MODE !== "teacher" ? restoreStudentSessionState() : null;

    if (window.APP_MODE === "teacher") {
        // =====================================================================
        // TEACHER MODE INIT (single source of truth = DEFAULT_STRUCTURE)
        // =====================================================================
        const base = window.DEFAULT_STRUCTURE
            ? normalizeToSystemRoot(window.DEFAULT_STRUCTURE)
            : normalizeToSystemRoot({
                  name: "C:",
                  type: "folder",
                  children: [],
              });

        initialFileSystem = deepClone(base);
        fileSystem = deepClone(initialFileSystem);

        currentPath = getDefaultRootPath(fileSystem);
        history = [currentPath];
        historyIndex = 0;
        recycleBin = ensureRecycleBinNodeIds(
            Array.isArray(cfg?.initialRecycleBin)
                ? deepClone(cfg.initialRecycleBin)
                : [],
        );
    } else if (restored) {
        // =====================================================================
        // STUDENT MODE: RESTORE SAME-TAB SESSION
        // =====================================================================
        fileSystem = ensureStructureNodeIds(restored.fileSystem);
        currentPath = restored.currentPath || getDefaultRootPath(fileSystem);
        history = Array.isArray(restored.history)
            ? restored.history
            : [currentPath];
        historyIndex =
            typeof restored.historyIndex === "number"
                ? restored.historyIndex
                : 0;
        recycleBin = ensureRecycleBinNodeIds(
            Array.isArray(restored.recycleBin) ? restored.recycleBin : [],
        );

        debugLog("Student session state restored", restored);
    } else {
        // =====================================================================
        // STUDENT MODE: FRESH START FROM exercise-config.json
        // =====================================================================
        if (cfg?.initialStructure) {
            initialFileSystem = normalizeToSystemRoot(cfg.initialStructure);
        } else {
            console.error("Student mode: no initial structure found");
            initialFileSystem = normalizeToSystemRoot({
                name: "C:",
                type: "folder",
                children: [],
            });
        }

        fileSystem = deepClone(initialFileSystem);

        currentPath = getDefaultRootPath(fileSystem);
        history = [currentPath];
        historyIndex = 0;
        recycleBin = ensureRecycleBinNodeIds(
            Array.isArray(cfg?.initialRecycleBin)
                ? deepClone(cfg.initialRecycleBin)
                : [],
        );
    }

    initialFileSystem = ensureStructureNodeIds(initialFileSystem);
    fileSystem = ensureStructureNodeIds(fileSystem);
    resetActionLog();

    // Instructions
    const instructions = getExerciseInstructions();
    document.getElementById("instructionsText").textContent = instructions;
    document.getElementById("modalInstructionsText").textContent = instructions;

    // Checklist
    buildInstructionChecklistFromTasks(cfg?.tasks || []);

    // Restore checklist status only if we ALSO restored session
    if (restored) {
        const latest = readLatestCheckResults();
        if (latest) updateChecklistFromResults(latest);
    }

    if (window.APP_MODE !== "teacher") {
        showModal("instructionsModal");
    }

    renderAll();
    setupEventListeners();
});

// ==========================
// Event binding helpers
// ==========================

function bindNavigationEvents() {
    // Navigation
    safeOn("backBtn", "click", goBack);
    safeOn("forwardBtn", "click", goForward);
    safeOn("upBtn", "click", goUp);
    safeOn("thisPCNav", "click", () => {
        if (currentPath !== "This PC") navigate("This PC");
    });

    // Recycle bin
    safeOn("recycleBinNav", "click", () => navigate("Recycle Bin"));
}

function bindToolbarEvents() {
    // Toolbar
    safeOn("newFolderBtn", "click", () => showNewItemModal("folder"));
    safeOn("newFileBtn", "click", () => showNewItemModal("file"));
    safeOn("cutBtn", "click", handleCut);
    safeOn("copyBtn", "click", handleCopy);
    safeOn("pasteBtn", "click", handlePaste);
    safeOn("renameBtn", "click", startRename);
    safeOn("deleteBtn", "click", handleDelete);
    safeOn("compressBtn", "click", handleCompress);
    safeOn("extractBtn", "click", handleExtract);
}

function bindViewEvents() {
    // View
    safeOn("gridViewBtn", "click", () => setViewMode("grid"));
    safeOn("listViewBtn", "click", () => setViewMode("list"));
}

function bindInstructionsAndSidePanelEvents() {
    // Side panel & instructions
    safeOn("showInstructionsBtn", "click", toggleSidePanel);
    safeOn("closeSidePanelBtn", "click", toggleSidePanel);
    safeOn("closeInstructionsBtn", "click", () => {
        hideModal("instructionsModal");
        showSidePanel();
    });
}

function bindResetSubmitAndResultsEvents() {
    // Reset / submit / results
    safeOn("resetBtn", "click", () => showModal("resetModal"));
    safeOn("cancelResetBtn", "click", () => hideModal("resetModal"));
    safeOn("confirmResetBtn", "click", resetAssignment);

    // Delete confirm (shared modal)
    safeOn("confirmDeleteBtn", "click", confirmDelete);

    // Results
    safeOn("closeResultsBtn", "click", () => hideModal("resultsModal"));

    // Submit flow
    safeOn("cancelSubmitBtn", "click", () => hideModal("submitConfirmModal"));
    safeOn("submitBtn", "click", requestSubmit);
    safeOn("checkBtn", "click", checkStructure);
    safeOn("confirmSubmitBtn", "click", submitExercise);
}

function bindModalEvents() {
    // Modals
    safeOn("closePropertiesBtn", "click", () => hideModal("propertiesModal"));
    safeOn("closeFileViewerBtn", "click", () => hideModal("fileViewerModal"));
    safeOn("cancelNewItemBtn", "click", () => hideModal("newItemModal"));
    safeOn("createNewItemBtn", "click", createNewItem);
    safeOn("cancelExtractWizardBtn", "click", () =>
        hideModal("extractWizardModal"),
    );
    safeOn("confirmExtractWizardBtn", "click", confirmExtractToDestination);
    safeOn("extractBrowseBtn", "click", openFolderPicker);
    safeOn("cancelFolderPickerBtn", "click", () =>
        hideModal("folderPickerModal"),
    );
    safeOn("confirmFolderPickerBtn", "click", confirmFolderPickerSelection);
    safeOn("folderPickerList", "click", (e) => {
        const item = e.target.closest(".folder-picker-item");
        if (!item) return;
        folderPickerState.selectedPath = item.dataset.path || null;
        renderFolderPicker();
    });
}

function bindGlobalEvents() {
    // Keyboard & global
    document.addEventListener("keydown", handleKeyboard);
    modalOverlayEl.addEventListener(
        "click",
        requestCloseActiveModalFromOverlay,
    );
    // Close context menu when clicking anywhere else
    document.addEventListener("mousedown", (e) => {
        // Only if it is open
        if (!contextMenuEl.classList.contains("active")) return;

        // If click is inside context menu, do nothing
        if (contextMenuEl.contains(e.target)) return;

        hideContextMenu();
    });

    // Also close on window resize/scroll (optional but feels polished)
    window.addEventListener("resize", hideContextMenu);
    window.addEventListener("scroll", hideContextMenu, true);
    // Explorer surface context menu (empty area)
    fileListEl.addEventListener("contextmenu", (e) => {
        if (e.target === fileListEl) {
            e.preventDefault();
            selectedItems = [];
            renderFileList();
            showContextMenu(e.clientX, e.clientY, null);
        }
    });
}

// ============================================================================
// 10) Event binding & Keyboard
// ============================================================================

// INVARIANT: Event listeners are registered only in setupEventListeners()
// and bind* helpers. No other functions should add listeners.
function setupEventListeners() {
    bindNavigationEvents();
    bindToolbarEvents();
    bindViewEvents();
    bindInstructionsAndSidePanelEvents();
    bindResetSubmitAndResultsEvents();
    bindModalEvents();
    bindGlobalEvents();
}

function toggleSidePanel() {
    sidePanelVisible = !sidePanelVisible;
    sidePanelEl.classList.toggle("hidden", !sidePanelVisible);
}
function showSidePanel() {
    sidePanelVisible = true;
    sidePanelEl.classList.remove("hidden");
}

// ==========================
// Keyboard shortcut helpers
// ==========================

function isTypingContext(e) {
    const tag = e.target?.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || e.target?.isContentEditable;
}

function handleKeyboardNavigationShortcuts(e) {
    // Preserve existing behavior: Alt+Left/Right and Alt+Up for navigation
    if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
        return true;
    }

    if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
        return true;
    }

    if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        goUp();
        return true;
    }

    return false;
}

function handleKeyboardEditShortcuts(e) {
    // Copy/Cut/Paste/Rename/Delete (preserve existing semantics)
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopy();
        return true;
    }

    if (modKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCut();
        return true;
    }

    if (modKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePaste();
        return true;
    }

    if (e.key === "F2") {
        e.preventDefault();
        startRename();
        return true;
    }

    if (e.key === "Delete") {
        e.preventDefault();
        handleDelete();
        return true;
    }

    return false;
}

function handleKeyboardModalShortcuts(e) {
    if (e.key === "Escape") {
        // 1) First close context menu if open
        if (contextMenuEl?.classList?.contains("active")) {
            hideContextMenu();
            return true;
        }

        // 2) Then apply modal policy (only closes non-blocking modals)
        requestCloseActiveModalFromEscape();
        return true;
    }
    return false;
}

function handleKeyboard(e) {
    // Preserve behavior: do not hijack keys while typing in inputs/textareas
    if (isTypingContext(e)) return;

    // Modal shortcuts first (highest priority)
    if (handleKeyboardModalShortcuts(e)) return;

    // Navigation shortcuts
    if (handleKeyboardNavigationShortcuts(e)) return;

    // Edit shortcuts (copy/cut/paste/rename/delete)
    if (handleKeyboardEditShortcuts(e)) return;
}

// Navigation
// INVARIANT: This function must NOT register event listeners.
function navigate(path) {
    if (path !== currentPath) {
        resetUndoHistory();
    }

    if (path === "This PC") {
        resetUndoHistory();
        currentPath = "This PC";
        history = history.slice(0, historyIndex + 1);
        history.push(path);
        historyIndex = history.length - 1;
        selectedItems = [];
        renamingItem = null;
        renderAll();
        return;
    }

    if (path === "Recycle Bin") {
        resetUndoHistory();

        currentPath = "Recycle Bin";
        history = history.slice(0, historyIndex + 1);
        history.push(path);
        historyIndex = history.length - 1;
        selectedItems = [];
        renamingItem = null;
        renderAll();
        return;
    }

    // Validate path (multi-root)
    if (!isSpecialLocation(path)) {
        if (isRootPath(path)) {
            if (!getRootFolder(path)) return;
        } else {
            // must be an existing folder
            if (!getFolder(path)) return;
        }
    }

    history = history.slice(0, historyIndex + 1);
    history.push(path);
    historyIndex = history.length - 1;
    currentPath = path;
    selectedItems = [];
    renderAll();
}

function goBack() {
    if (historyIndex > 0) {
        resetUndoHistory();
        historyIndex--;
        currentPath = history[historyIndex];
        selectedItems = [];
        renderAll();
    }
}

function goForward() {
    if (historyIndex < history.length - 1) {
        resetUndoHistory();
        historyIndex++;
        currentPath = history[historyIndex];
        selectedItems = [];
        renderAll();
    }
}

function goUp() {
    if (currentPath === "Recycle Bin") {
        resetUndoHistory();
        navigate("This PC");
        return;
    }

    if (currentPath === "This PC") return;

    const parent = getParentPathMultiRoot(currentPath);
    resetUndoHistory();
    navigate(parent || "This PC");
}

// Get folder at path
function getRootFolder(rootName) {
    return fileSystem?.roots?.find((r) => r.name === rootName) || null;
}

// Get folder at path (multi-root aware)
function getFolder(path) {
    if (!path) return null;
    if (path === "This PC") return null; // virtual
    if (path === "Recycle Bin") return null; // virtual

    const rootName = getRootFromPath(path);
    const root = getRootFolder(rootName);
    if (!root) return null;

    // Root itself
    if (path === rootName) return root;

    // Traverse inside root
    const parts = path.split("\\").filter(Boolean).slice(1); // skip root
    let current = root;

    for (const part of parts) {
        current = current.children?.find(
            (c) => c.name === part && c.type === "folder",
        );
        if (!current) return null;
    }

    return current;
}

function getCurrentFolder() {
    return getFolder(currentPath);
}

function getCurrentItems() {
    if (currentPath === "Recycle Bin") return recycleBin;
    if (currentPath === "This PC") return [];

    const folder = getCurrentFolder();
    return folder?.children || [];
}

// ==========================
// Render orchestration helpers
// ==========================

function renderMainView() {
    if (currentPath === "This PC") {
        renderThisPC();
        return;
    }

    // INVARIANT: Recycle Bin has its own dedicated view rendering
    if (currentPath === "Recycle Bin") {
        renderRecycleBin();
        return;
    }

    // Explorer view (normal folders)
    renderBreadcrumbs();
    renderFolderTree();
    renderFileList();
}

function renderThisPCActiveState() {
    const thisPCNav = document.getElementById("thisPCNav");
    if (!thisPCNav) return;

    // Multi-root invariant:
    // "This PC" is a virtual location, active only when explicitly navigated to
    thisPCNav.classList.toggle("active", currentPath === "This PC");
}

function renderChrome() {
    // "Chrome" here = non-file-list UI state (buttons, status, badges, nav highlights)
    renderThisPCActiveState();
    updateNavigationButtons();
    updateToolbarState();
    updateStatusBar();
    updateRecycleBinBadge();
}

// ============================================================================
// 8) Rendering (UI)
// ============================================================================

function renderAll() {
    renderMainView();
    renderChrome();
    // Keep session state in sync so refresh doesn't break checklist meaning
    persistStudentSessionState();
}

// ==========================
// Recycle Bin rendering helpers
// ==========================

function getRecycleBinEmptyHtml() {
    return `
        <div class="recycle-bin-view">
            <h2>Recycle Bin</h2>
            <div class="empty-state" style="padding: 48px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; color: #9ca3af; margin-bottom: 16px;">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                <p>Recycle Bin is empty</p>
            </div>
        </div>
    `;
}

function getRecycleBinItemIconHtml(item) {
    // INVARIANT: keep icon selection identical
    if (item.type === "folder") {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
}

function getRecycleBinItemHtml(item) {
    const icon = getRecycleBinItemIconHtml(item);

    return `
        <div class="recycle-bin-item">
            <div class="recycle-bin-item-info">
                <div class="file-icon ${item.type}">
                    ${icon}
                </div>
                <div class="recycle-bin-item-details">
                    <div class="recycle-bin-item-name">${item.name}</div>
                    <div class="recycle-bin-item-path">Original location: ${item.originalPath}</div>
                </div>
            </div>
            <div class="recycle-bin-actions">
                <button class="restore-btn" data-name="${item.name}">Restore</button>
                <button class="delete-permanent-btn" data-name="${item.name}">Delete Permanently</button>
            </div>
        </div>
    `;
}

function getRecycleBinListHtml(items) {
    return `
        <div class="recycle-bin-view">
            <h2>Recycle Bin</h2>
            ${items.map(getRecycleBinItemHtml).join("")}
        </div>
    `;
}

function bindRecycleBinEvents(rootEl) {
    // Restore
    rootEl.querySelectorAll(".restore-btn").forEach((btn) => {
        btn.addEventListener("click", () => handleRestore(btn.dataset.name));
    });

    // Permanent delete (shows confirmation modal via requestPermanentDelete)
    rootEl.querySelectorAll(".delete-permanent-btn").forEach((btn) => {
        btn.addEventListener("click", () =>
            requestPermanentDelete(btn.dataset.name),
        );
    });
}

function renderRecycleBin() {
    // INVARIANT: recycle bin view always renders in fileListEl
    fileListEl.className = "file-list";

    if (recycleBin.length === 0) {
        fileListEl.innerHTML = getRecycleBinEmptyHtml();
        return; // no buttons to bind
    }

    fileListEl.innerHTML = getRecycleBinListHtml(recycleBin);
    bindRecycleBinEvents(fileListEl);
}
function getRootDisplayName(root) {
    // Prefer configured displayName
    const metaName = root?.meta?.displayName;
    if (metaName) return metaName;

    // Sensible defaults (backwards compatible)
    if (root?.name === "C:") return "Lokale schijf C:";
    if (root?.name === "OneDrive") return "OneDrive";
    return root?.name || "";
}

function getRootIconHtml(root) {
    const kind = root?.meta?.kind;

    // Cloud icon (OneDrive)
    if (kind === "cloud" || root.name === "OneDrive") {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 17.5a4.5 4.5 0 0 0-1.8-8.6A6 6 0 0 0 6.2 8.7a4.5 4.5 0 0 0 .8 8.8H20z"/>
            </svg>
        `;
    }

    // Drive icon (C:)
    return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="7" width="18" height="10" rx="2"/>
            <path d="M7 17v2M17 17v2"/>
        </svg>
    `;
}

function renderThisPC() {
    fileListEl.className = "file-list list-view";

    const roots = fileSystem?.roots || [];
    fileListEl.innerHTML = `
        <div class="this-pc-view">
            <h2>This PC</h2>
            <div class="this-pc-roots">
                ${roots
                    .map(
                        (r) => `
                    <div class="this-pc-root" data-root="${r.name}">
                        <span class="this-pc-root-icon">${getRootIconHtml(r)}</span>
                        <span class="this-pc-root-name">${getRootDisplayName(r)}</span>
                    </div>
                `,
                    )
                    .join("")}
            </div>
        </div>
    `;

    fileListEl.querySelectorAll(".this-pc-root").forEach((el) => {
        el.addEventListener("dblclick", () => navigate(el.dataset.root));
        el.addEventListener("click", () => navigate(el.dataset.root));
    });
}

// ==========================
// Breadcrumb helpers (pure-ish)
// ==========================

/**
 * Build a path from breadcrumb parts using joinPath().
 * parts example: ["C:", "Docs", "School"]
 * uptoIndex example: 1 => "C:\Docs"
 */
function buildPathFromBreadcrumbParts(parts, uptoIndex) {
    // INVARIANT: never join with string ops inline
    let acc = parts[0] || "C:";
    for (let i = 1; i <= uptoIndex; i++) {
        acc = joinPathMultiRoot(acc, parts[i]);
    }
    return acc;
}

// Breadcrumb label helper
// Keeps internal path segments intact (e.g. "C:"), but shows nicer UI terms.
function getBreadcrumbLabel(part, index) {
    // Only the first segment can be a root like "C:"
    if (index === 0 && part === "C:") return "Lokale schijf C:";
    return part;
}

function renderBreadcrumbs() {
    const parts = currentPath.split("\\").filter(Boolean);

    // Edge case: empty path fallback (should not happen, but safe)
    if (parts.length === 0) {
        breadcrumbsEl.innerHTML = "";
        return;
    }

    breadcrumbsEl.innerHTML = parts
        .map((part, index) => {
            const path = buildPathFromBreadcrumbParts(parts, index);
            const label = getBreadcrumbLabel(part, index);

            // title helps when labels are long or truncated
            return (
                `<span class="breadcrumb" data-path="${path}" title="${label}">${label}</span>` +
                (index < parts.length - 1
                    ? '<span class="breadcrumb-separator">›</span>'
                    : "")
            );
        })
        .join("");

    breadcrumbsEl.querySelectorAll(".breadcrumb").forEach((el) => {
        el.addEventListener("click", (e) => {
            e.stopPropagation();
            navigate(el.dataset.path);
        });
    });
}

function renderFolderTree() {
    const roots = fileSystem?.roots || [];

    folderTreeEl.innerHTML = roots
        .map((root) => {
            const isActive = currentPath === root.name;
            const folders =
                root.children?.filter((c) => c.type === "folder") || [];

            const rootKind =
                root?.meta?.kind === "cloud" || root.name === "OneDrive"
                    ? "cloud"
                    : "drive";

            return `
                <div class="tree-root">
                    <div class="tree-item ${isActive ? "active" : ""}" data-path="${root.name}">
                        <span class="tree-toggle"></span>
                        <span class="tree-root-icon ${rootKind}">${getRootIconHtml(root)}</span>
                        <span>${getRootDisplayName(root)}</span>
                    </div>
                    ${
                        folders.length > 0
                            ? `<div class="tree-children">${renderTreeItems(
                                  folders,
                                  root.name,
                              )}</div>`
                            : ""
                    }
                </div>
            `;
        })
        .join("");

    folderTreeEl.querySelectorAll(".tree-item").forEach((el) => {
        el.addEventListener("click", () => navigate(el.dataset.path));
    });
}

function renderTreeItems(items, parentPath) {
    return items
        .map((item) => {
            const itemPath = joinPathMultiRoot(parentPath, item.name); // invariant: no inline path concatenation
            const isActive = currentPath === itemPath;
            const folders =
                item.children?.filter((c) => c.type === "folder") || [];

            return `
            <div>
                <div class="tree-item ${
                    isActive ? "active" : ""
                }" data-path="${itemPath}">
                    <span class="tree-toggle">${
                        folders.length > 0 ? "›" : ""
                    }</span>
                    <svg class="tree-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <span>${item.name}</span>
                </div>
                ${
                    folders.length > 0
                        ? `<div class="tree-children">${renderTreeItems(
                              folders,
                              itemPath,
                          )}</div>`
                        : ""
                }
            </div>
        `;
        })
        .join("");
}

// ==========================
// File list rendering helpers (pure-ish UI helpers)
// ==========================

function sortExplorerItems(items) {
    // INVARIANT: folders first, then alphabetically (unchanged behavior)
    return [...items].sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
    });
}

function renderEmptyFolderState() {
    fileListEl.innerHTML =
        '<div class="empty-state">This folder is empty</div>';
}

function bindFileListItemEvents() {
    fileListEl.querySelectorAll(".file-item").forEach((el) => {
        const itemName = el.dataset.name;

        el.addEventListener("click", (e) => {
            if (e.target.classList.contains("rename-input")) return;
            handleSelect(itemName, e.ctrlKey || e.metaKey);
        });

        el.addEventListener("dblclick", () => {
            const item = getCurrentItems().find((i) => i.name === itemName);
            if (item) handleOpen(item);
        });

        el.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!selectedItems.includes(itemName)) {
                selectedItems = [itemName];
                renderFileList();
            }
            const item = getCurrentItems().find((i) => i.name === itemName);
            showContextMenu(e.clientX, e.clientY, item);
        });
    });
}

function renderFileList() {
    if (currentPath === "Recycle Bin") {
        renderRecycleBin();
        return;
    }

    const items = getCurrentItems();
    fileListEl.className = `file-list ${viewMode}-view`;

    if (items.length === 0) {
        renderEmptyFolderState();
        return;
    }

    const sorted = sortExplorerItems(items);
    fileListEl.innerHTML = sorted.map((item) => renderFileItem(item)).join("");

    bindFileListItemEvents();
}

function renderFileItem(item) {
    const isSelected = selectedItems.includes(item.name);
    const isRenaming = renamingItem === item.name;
    const icon = getFileIcon(item);

    if (viewMode === "grid") {
        return `
            <div class="file-item grid ${
                isSelected ? "selected" : ""
            }" data-name="${item.name}">
                <div class="file-icon ${item.type}">${icon}</div>
                ${
                    isRenaming
                        ? `<input type="text" class="rename-input" value="${item.name}" onblur="finishRename(this)" onkeydown="handleRenameKey(event, this)">`
                        : `<div class="file-name">${item.name}</div>`
                }
            </div>
        `;
    } else {
        const fileType =
            item.type === "folder"
                ? "File folder"
                : item.name.endsWith(".zip")
                  ? "ZIP Archive"
                  : (item.name.split(".").pop()?.toUpperCase() || "") + " File";
        return `
            <div class="file-item list ${
                isSelected ? "selected" : ""
            }" data-name="${item.name}">
                <div class="file-icon ${item.type}">${icon}</div>
                ${
                    isRenaming
                        ? `<input type="text" class="rename-input" value="${item.name}" onblur="finishRename(this)" onkeydown="handleRenameKey(event, this)">`
                        : `<div class="file-name">${item.name}</div>`
                }
                <div class="file-type">${fileType}</div>
                <div class="file-size">${
                    item.type === "folder" ? "" : item.size || "1 KB"
                }</div>
            </div>
        `;
    }
}

function getFileIcon(item) {
    if (item.type === "folder") {
        return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
    }

    const ext = item.name.split(".").pop()?.toLowerCase();

    if (ext === "zip" || item.isZip) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
}

function updateNavigationButtons() {
    if (isProgressRunning) {
        setToolbarButtonsDisabled(true);
        return;
    }

    withEl("backBtn", (btn) => (btn.disabled = historyIndex <= 0));
    withEl(
        "forwardBtn",
        (btn) => (btn.disabled = historyIndex >= history.length - 1),
    );
    withEl("upBtn", (btn) => (btn.disabled = currentPath === "C:"));
}

function setToolbarButtonsDisabled(disabled) {
    document.querySelectorAll(".toolbar button").forEach((btn) => {
        btn.disabled = disabled;
    });
}

function updateToolbarState() {
    if (isProgressRunning) {
        setToolbarButtonsDisabled(true);
        return;
    }

    const hasSelection = selectedItems.length > 0;
    const isThisPC = currentPath === "This PC";
    const hasClipboard = clipboard !== null;
    const items = getCurrentItems();
    const selectedItemObjects = items.filter((i) =>
        selectedItems.includes(i.name),
    );
    const hasProtectedSelection =
        getProtectedSelection(items, currentPath, selectedItems).length > 0;

    const hasZipSelected = selectedItemObjects.some((i) =>
        i.name.endsWith(".zip"),
    );
    const hasNonZipSelected = selectedItemObjects.some(
        (i) => !i.name.endsWith(".zip"),
    );

    const isBlockedLocation =
        currentPath === "Recycle Bin" || currentPath === "This PC";

    withEl("cutBtn", (btn) => {
        btn.disabled = !hasSelection || isBlockedLocation || hasProtectedSelection;
    });

    withEl("copyBtn", (btn) => {
        btn.disabled = !hasSelection || isBlockedLocation;
    });

    withEl("pasteBtn", (btn) => {
        btn.disabled = !hasClipboard || isBlockedLocation;
    });

    withEl("renameBtn", (btn) => {
        btn.disabled =
            selectedItems.length !== 1 ||
            isBlockedLocation ||
            hasProtectedSelection;
    });

    withEl("deleteBtn", (btn) => {
        btn.disabled = !hasSelection || isBlockedLocation || hasProtectedSelection;
    });

    withEl("compressBtn", (btn) => {
        btn.disabled = !hasNonZipSelected || isBlockedLocation;
    });

    withEl("extractBtn", (btn) => {
        btn.disabled = !hasZipSelected || isBlockedLocation;
    });

    withEl("newFolderBtn", (btn) => {
        btn.disabled = isBlockedLocation;
    });

    withEl("newFileBtn", (btn) => {
        btn.disabled = isBlockedLocation;
    });
}

function updateStatusBar() {
    if (currentPath === "Recycle Bin") {
        statusBarEl.textContent = `${recycleBin.length} items in Recycle Bin`;
    } else {
        const items = getCurrentItems();
        let text = `${items.length} items`;
        if (selectedItems.length > 0) {
            text += ` • ${selectedItems.length} selected`;
        }
        statusBarEl.textContent = text;
    }
}

function updateRecycleBinBadge() {
    const badge = document.getElementById("recycleBinCount");
    if (recycleBin.length > 0) {
        badge.textContent = recycleBin.length;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }

    const navItem = document.getElementById("recycleBinNav");
    if (currentPath === "Recycle Bin") {
        navItem.classList.add("active");
    } else {
        navItem.classList.remove("active");
    }
}

function setViewMode(mode) {
    viewMode = mode;
    document
        .getElementById("gridViewBtn")
        .classList.toggle("active", mode === "grid");
    document
        .getElementById("listViewBtn")
        .classList.toggle("active", mode === "list");
    renderFileList();
}

// Selection
function handleSelect(itemName, isMultiSelect) {
    if (isMultiSelect) {
        if (selectedItems.includes(itemName)) {
            selectedItems = selectedItems.filter((n) => n !== itemName);
        } else {
            selectedItems.push(itemName);
        }
    } else {
        selectedItems = [itemName];
    }
    renderFileList();
    updateToolbarState();
}

// Open
function handleOpen(item) {
    if (item.type === "folder") {
        navigate(joinPathMultiRoot(currentPath, item.name));
    } else {
        showFileViewer(item);
    }
}

// Rename

// ==========================
// Rename helpers (UI + state)
// ==========================

function beginRenamingSelectedItem() {
    // INVARIANT: rename is only allowed for a single selection (unchanged)
    if (selectedItems.length !== 1) return false;

    renamingItem = selectedItems[0];
    renderFileList();

    const input = fileListEl.querySelector(".rename-input");
    if (input) {
        input.focus();
        input.select();
    }
    return true;
}

function startRenameAfterNextRender() {
    if (exerciseSubmitted) return;
    if (currentPath === "Recycle Bin") return;
    if (selectedItems.length !== 1) return;

    requestAnimationFrame(() => {
        if (exerciseSubmitted) return;
        if (currentPath === "Recycle Bin") return;
        beginRenamingSelectedItem();
    });
}

function cancelRenaming() {
    renamingItem = null;
    renderFileList();
}

function validateRename(oldName, newName, items) {
    // INVARIANT: trimming + empty name behavior must remain unchanged
    if (!newName) return { ok: false, reason: "empty" };

    if (newName === oldName) return { ok: false, reason: "same" };

    if (items.some((i) => i.name === newName)) {
        return { ok: false, reason: "duplicate" };
    }

    return { ok: true };
}

function applyRename(oldName, newName, items) {
    const item = items.find((i) => i.name === oldName);
    if (!item) return false;
    const subjectId = item.id;

    pushHistory({
        type: "rename",
        from: oldName,
        to: newName,
        path: currentPath,
    });

    item.name = newName;
    selectedItems = [newName];
    logEvent("RENAME", {
        subjectId,
        fromName: oldName,
        toName: newName,
        parentPath: currentPath,
    });
    return true;
}

function startRename() {
    const items = getCurrentItems();
    if (getProtectedSelection(items, currentPath, selectedItems).length > 0) {
        showProtectedFolderAlert("rename");
        return;
    }
    beginRenamingSelectedItem();
}

function finishRename(input) {
    const newName = input.value.trim();
    const oldName = renamingItem;

    // Stop rename mode first (unchanged ordering)
    renamingItem = null;

    const items = getCurrentItems();

    const validation = validateRename(oldName, newName, items);

    if (!validation.ok) {
        if (validation.reason === "duplicate") {
            alert(`An item named "${newName}" already exists.`);
        }
        // For "empty" or "same": do nothing (unchanged behavior)
        renderAll();
        return;
    }

    applyRename(oldName, newName, items);

    renderAll();
}

function handleRenameKey(e, input) {
    if (e.key === "Enter") {
        // Existing behavior: blur triggers finishRename via onblur
        input.blur();
        return;
    }

    if (e.key === "Escape") {
        cancelRenaming();
    }
}

// ==========================
// Delete flow helpers (UI + state orchestration)
// ==========================

function isTeacherModeDeleteFlow() {
    // Teacher mode has no delete confirmation modal in the DOM.
    // Existing behavior: direct delete.
    const textEl = document.getElementById("deleteConfirmText");
    return !textEl;
}

function setPendingDeleteFromSelection() {
    pendingDeleteItems = [...selectedItems];
}

function getPendingDeleteObjects() {
    return getCurrentItems().filter((item) =>
        pendingDeleteItems.includes(item.name),
    );
}

function hasFolderInSelection(items) {
    return items.some((item) => item.type === "folder");
}

function setDeleteContextSoft() {
    deleteContext = { mode: "soft", itemName: null };
}

function setDeleteContextPermanent(itemName) {
    deleteContext = { mode: "permanent", itemName };
}

function setDeleteModalTextForSelection(textEl, selectedObjects) {
    const hasFolder = hasFolderInSelection(selectedObjects);

    if (pendingDeleteItems.length === 1) {
        const item = selectedObjects[0];

        if (item.type === "folder") {
            textEl.innerHTML = `
                Are you sure you want to delete the folder "<strong>${item.name}</strong>"?<br><br>
                <strong>All files and subfolders inside this folder will also be deleted.</strong>
            `;
        } else {
            textEl.textContent = `Are you sure you want to delete "${item.name}"?`;
        }
        return;
    }

    // Multiple selection
    if (hasFolder) {
        textEl.innerHTML = `
            Are you sure you want to delete these ${pendingDeleteItems.length} items?<br><br>
            <strong>Folders and all of their contents will be deleted.</strong>
        `;
    } else {
        textEl.textContent = `Are you sure you want to delete these ${pendingDeleteItems.length} items?`;
    }
}

function performPermanentDeleteFromRecycleBin() {
    // 🔒 Permanent delete = undo volledig blokkeren (existing behavior)
    resetUndoHistory();
    const toDelete = recycleBin.find(
        (item) => item.name === deleteContext.itemName,
    );
    if (toDelete) {
        logEvent("DELETE", {
            subjectId: toDelete.id,
            fromPath: joinPathMultiRoot(
                toDelete.originalPath || "Recycle Bin",
                toDelete.name,
            ),
        });
    }


    recycleBin = recycleBin.filter(
        (item) => item.name !== deleteContext.itemName,
    );

    // Extra defensieve reset (toekomstbestendig)
    resetUndoHistory();

    setDeleteContextSoft();
    hideModal("deleteConfirmModal");
    renderAll();
}

function performSoftDeleteToRecycleBin() {
    if (pendingDeleteItems.length === 0) return;

    const items = getPendingDeleteObjects();

    pushHistory({
        type: "delete",
        items: deepClone(items),
        from: currentPath,
    });

    const deletedItems = items.map((item) => ({
        ...deepClone(item),
        originalPath: currentPath,
        deletedAt: new Date().toISOString(),
    }));
    ensureRecycleBinNodeIds(deletedItems);

    items.forEach((item) => {
        logEvent("DELETE", {
            subjectId: item.id,
            fromPath: joinPathMultiRoot(currentPath, item.name),
        });
    });

    recycleBin = recycleBin.concat(deletedItems);

    const folder = getCurrentFolder();
    folder.children = folder.children.filter(
        (c) => !pendingDeleteItems.includes(c.name),
    );

    pendingDeleteItems = [];
    selectedItems = [];

    hideModal("deleteConfirmModal");
    renderAll();
}

// Delete - Move to Recycle Bin
function handleDelete() {
    const items = getCurrentItems();
    if (getProtectedSelection(items, currentPath, selectedItems).length > 0) {
        showProtectedFolderAlert("delete");
        return;
    }
    // 👉 Teacher mode: geen delete modal → direct delete (existing behavior)
    if (isTeacherModeDeleteFlow()) {
        setPendingDeleteFromSelection();
        confirmDelete();
        return;
    }

    const textEl = document.getElementById("deleteConfirmText");
    setPendingDeleteFromSelection();

    const selectedObjects = getPendingDeleteObjects();

    setDeleteModalTextForSelection(textEl, selectedObjects);

    setDeleteContextSoft();
    showModal("deleteConfirmModal");
}

function confirmDelete() {
    if (deleteContext.mode === "permanent") {
        performPermanentDeleteFromRecycleBin();
        return;
    }

    // Soft delete (naar Recycle Bin)
    performSoftDeleteToRecycleBin();
}

function requestPermanentDelete(itemName) {
    deleteContext = {
        mode: "permanent",
        itemName,
    };

    const textEl = document.getElementById("deleteConfirmText");

    // Teacher mode has no delete modal in the DOM; perform direct delete.
    if (!textEl) {
        performPermanentDeleteFromRecycleBin();
        return;
    }

    textEl.innerHTML = `
    Are you sure you want to <strong>permanently delete</strong> "${itemName}"?<br><br>
    <strong>This action cannot be undone.</strong>
  `;

    showModal("deleteConfirmModal");
}

// Recycle Bin operations

function handleRestore(itemName) {
    // INVARIANT (SYSTEM OPERATION):
    // Restore MUST auto-resolve name conflicts when restoring into the original folder.
    const item = recycleBin.find((i) => i.name === itemName);
    if (!item) return;

    // Save undo history (na item lookup!)
    pushHistory({
        type: "restore",
        item: deepClone(item),
    });

    const originalPath = item.originalPath;
    const restoredItem = deepClone(item);
    ensureNodeIdsRecursive(restoredItem);
    delete restoredItem.originalPath;
    delete restoredItem.deletedAt;

    const originalFolder = getFolder(originalPath);
    let restoredToPath = null;

    if (!originalFolder) {
        if (
            !confirm(
                `The original location "${originalPath}" no longer exists. The item will be restored to a new "Restored" folder in C:. Continue?`,
            )
        ) {
            return;
        }

        const defaultRoot = getRootFolder("C:") || fileSystem?.roots?.[0];
        if (!defaultRoot) return;

        let restoredFolder = defaultRoot.children.find(
            (c) => c.name === "Restored" && c.type === "folder",
        );
        if (!restoredFolder) {
            restoredFolder = {
                id: createUuid(),
                name: "Restored",
                type: "folder",
                children: [],
            };
            defaultRoot.children.push(restoredFolder);
        }

        addWithUniqueName(restoredFolder.children, restoredItem);
        restoredToPath = joinPathMultiRoot("C:\\Restored", restoredItem.name);
    } else {
        addWithUniqueName(originalFolder.children, restoredItem);
        restoredToPath = joinPathMultiRoot(originalPath, restoredItem.name);
    }

    logEvent("RESTORE", {
        subjectId: restoredItem.id,
        toPath: restoredToPath,
    });

    recycleBin = recycleBin.filter((i) => i.name !== itemName);
    renderAll();
}

// Clipboard
function handleCut() {
    const items = getCurrentItems().filter((i) =>
        selectedItems.includes(i.name),
    );
    if (getProtectedSelection(items, currentPath, selectedItems).length > 0) {
        showProtectedFolderAlert("move");
        return;
    }
    clipboard = {
        items: deepClone(items),
        operation: "cut",
        sourcePath: currentPath,
    };
    updateToolbarState();
}

function handleCopy() {
    const items = getCurrentItems().filter((i) =>
        selectedItems.includes(i.name),
    );
    clipboard = {
        items: deepClone(items),
        operation: "copy",
        sourcePath: currentPath,
    };
    updateToolbarState();
}

// ==========================
// Clipboard / paste helpers
// ==========================

// INVARIANT (SYSTEM OPERATION):
// Paste MUST auto-resolve name conflicts using the shared naming helper(s).
function pasteClipboardItemsIntoFolder(targetFolder, clipboardItems, operation) {
    const inserted = [];

    clipboardItems.forEach((item) => {
        const uniqueName = ensureUniqueChildName(
            targetFolder.children,
            item.name,
        );
        const cloned =
            operation === "copy"
                ? cloneNodeWithNewIds(item)
                : deepClone(item);
        cloned.name = uniqueName;
        targetFolder.children.push(cloned);
        inserted.push({
            original: item,
            inserted: cloned,
        });
    });

    return inserted;
}

function removeCutItemsFromSourceFolder(sourcePath, clipboardItems) {
    const sourceFolder = getFolder(sourcePath);
    if (!sourceFolder) return;

    const itemNames = clipboardItems.map((i) => i.name);
    sourceFolder.children = sourceFolder.children.filter(
        (c) => !itemNames.includes(c.name),
    );
}

function shouldClearClipboardAfterPaste(operation, sourcePath, targetPath) {
    // Existing behavior: only clear clipboard when cutting to a different folder
    return operation === "cut" && sourcePath !== targetPath;
}

function handlePaste() {
    if (!clipboard) return;
    if (
        clipboard.operation === "cut" &&
        getProtectedSelection(
            clipboard.items,
            clipboard.sourcePath,
            clipboard.items.map((i) => i.name),
        ).length > 0
    ) {
        showProtectedFolderAlert("move");
        return;
    }

    const targetFolder = getCurrentFolder();

    const inserted = pasteClipboardItemsIntoFolder(
        targetFolder,
        clipboard.items,
        clipboard.operation,
    );

    inserted.forEach(({ original, inserted: insertedNode }) => {
        const fromPath = joinPathMultiRoot(clipboard.sourcePath, original.name);
        const toPath = joinPathMultiRoot(currentPath, insertedNode.name);

        if (
            clipboard.operation === "cut" &&
            clipboard.sourcePath !== currentPath
        ) {
            logEvent("MOVE", {
                subjectId: original.id,
                fromPath,
                toPath,
            });
            return;
        }

        logEvent("COPY", {
            subjectId: original.id,
            outputId: insertedNode.id,
            fromPath,
            toPath,
        });
    });

    if (
        shouldClearClipboardAfterPaste(
            clipboard.operation,
            clipboard.sourcePath,
            currentPath,
        )
    ) {
        removeCutItemsFromSourceFolder(clipboard.sourcePath, clipboard.items);
        clipboard = null;
    }

    renderAll();
}

// ==========================
// Compress/Extract helpers
// ==========================

function getSelectedNonZipItems() {
    // INVARIANT: compress should ignore existing .zip files (unchanged)
    return getCurrentItems().filter(
        (i) => selectedItems.includes(i.name) && !i.name.endsWith(".zip"),
    );
}

function getSelectedZipItems() {
    // INVARIANT: extract only applies to .zip items (unchanged)
    return getCurrentItems().filter(
        (i) => selectedItems.includes(i.name) && i.name.endsWith(".zip"),
    );
}

function getDefaultZipNameForItems(items) {
    // INVARIANT: same naming rules as before
    if (items.length === 1) {
        return items[0].name.replace(/\.[^.]+$/, "") + ".zip";
    }
    return "Archive.zip";
}

function addZipFileToCurrentFolder(zipName, compressedContents, zipMeta) {
    const folder = getCurrentFolder();

    const zipItem = {
        id: createUuid(),
        name: zipName,
        type: "file",
        isZip: true,
        compressedContents: deepClone(compressedContents),
    };
    if (zipMeta) {
        zipItem.zipMeta = zipMeta;
    }

    // INVARIANT (SYSTEM OPERATION):
    // Compress MUST auto-resolve name conflicts for the generated .zip output.
    addWithUniqueName(folder.children, zipItem);

    return zipItem.name; // actual final name after conflict resolution
}

function extractZipToFolder(zipFile, destinationPath) {
    if (
        !zipFile?.compressedContents ||
        zipFile.compressedContents.length === 0
    ) {
        return null;
    }

    const destinationFolder = getFolder(destinationPath);
    if (!destinationFolder) return null;

    const contents = deepClone(zipFile.compressedContents);
    const addedNames = [];
    const extractedIds = [];

    contents.forEach((item) => {
        const clonedItem = cloneNodeWithNewIds(item);
        addWithUniqueName(destinationFolder.children, clonedItem);
        addedNames.push(clonedItem.name);
        if (clonedItem.id) extractedIds.push(clonedItem.id);
    });

    return { mode: "items", names: addedNames, extractedIds };
}

function extractZipIntoCurrentFolder(zipFile) {
    extractZipToFolder(zipFile, currentPath);
}

function getDefaultExtractDestinationPath() {
    const roots = fileSystem?.roots || [];
    const preferredRoot = getDefaultRootPath(fileSystem);

    if (preferredRoot && preferredRoot !== currentPath) {
        return preferredRoot;
    }

    const otherRoot = roots.find((r) => r.name !== currentPath);
    if (otherRoot) return otherRoot.name;

    const currentFolder = getFolder(currentPath);
    const firstChildFolder = currentFolder?.children?.find(
        (child) => child.type === "folder",
    );
    if (firstChildFolder) {
        return joinPathMultiRoot(currentPath, firstChildFolder.name);
    }

    return null;
}

function shouldShowExtractWizardWarning(destinationPath) {
    if (!destinationPath) return false;
    if (currentPath === "This PC" || currentPath === "Recycle Bin") return false;
    return destinationPath === currentPath;
}

function updateExtractWizardUI() {
    const input = document.getElementById("extractDestinationInput");
    if (input) {
        input.value = extractWizardState.destinationPath || "";
    }

    const checkbox = document.getElementById("extractShowAfterCheckbox");
    if (checkbox) {
        checkbox.checked = !!extractWizardState.showAfterComplete;
    }

    const warning = document.getElementById("extractWizardWarning");
    if (warning) {
        warning.classList.toggle(
            "hidden",
            !shouldShowExtractWizardWarning(extractWizardState.destinationPath),
        );
    }
}

function buildFolderPickerItems(folder, path, level, selectedPath) {
    const isSelected = path === selectedPath;
    let html = `
        <div class="folder-picker-item ${
            isSelected ? "selected" : ""
        }" data-path="${path}" style="--level: ${level}">
            ${getNameFromPath(path)}
        </div>
    `;

    const children = folder.children?.filter((c) => c.type === "folder") || [];
    children.forEach((child) => {
        const childPath = joinPathMultiRoot(path, child.name);
        html += buildFolderPickerItems(
            child,
            childPath,
            level + 1,
            selectedPath,
        );
    });

    return html;
}

function renderFolderPicker() {
    const listEl = document.getElementById("folderPickerList");
    if (!listEl) return;

    const roots = fileSystem?.roots || [];
    if (roots.length === 0) {
        listEl.innerHTML = `<div class="folder-picker-empty">No folders available.</div>`;
        return;
    }

    let html = "";
    roots.forEach((root) => {
        const path = root.name;
        html += buildFolderPickerItems(
            root,
            path,
            0,
            folderPickerState.selectedPath,
        );
    });

    listEl.innerHTML = html;
}

function openFolderPicker() {
    folderPickerState.selectedPath = extractWizardState.destinationPath;
    renderFolderPicker();
    showModal("folderPickerModal");
}

function confirmFolderPickerSelection() {
    if (!folderPickerState.selectedPath) {
        alert("Selecteer eerst een doelmap.");
        return;
    }

    extractWizardState.destinationPath = folderPickerState.selectedPath;
    updateExtractWizardUI();
    hideModal("folderPickerModal");
}

function openExtractWizard(zipItem) {
    if (!zipItem) return;
    if (isProgressRunning) return;

    extractWizardState.zipName = zipItem.name;
    extractWizardState.zipParentPath = currentPath;
    extractWizardState.destinationPath = getDefaultExtractDestinationPath();
    extractWizardState.showAfterComplete = true;

    updateExtractWizardUI();
    showModal("extractWizardModal");
}

function openExtractWizardForSelectedZip() {
    if (isProgressRunning) return;

    const items = getSelectedZipItems();
    if (items.length === 0) return;
    openExtractWizard(items[0]);
}

function confirmExtractToDestination() {
    if (isProgressRunning) return;

    const destinationPath = extractWizardState.destinationPath;
    if (!destinationPath) {
        alert("Kies eerst een doelmap om uit te pakken.");
        return;
    }

    const destinationFolder = getFolder(destinationPath);
    if (!destinationFolder) {
        alert("De gekozen doelmap bestaat niet (meer).");
        return;
    }

    const zipParentFolder = getFolder(extractWizardState.zipParentPath);
    const zipFile = zipParentFolder?.children?.find(
        (item) =>
            item.name === extractWizardState.zipName && item.name.endsWith(".zip"),
    );
    if (!zipFile) {
        alert("Het zipbestand werd niet gevonden.");
        return;
    }

    extractWizardState.showAfterComplete = !!document.getElementById(
        "extractShowAfterCheckbox",
    )?.checked;

    hideModal("extractWizardModal");

    runWithProgress({
        title: "Extracting...",
        durationMs: 2000,
        action: () => {
            const extractedResult = extractZipToFolder(
                zipFile,
                destinationPath,
            );

            if (!extractedResult) return;
            logEvent("ZIP_EXTRACT", {
                archiveId: zipFile.id,
                destPath: destinationPath,
                extractedIds: extractedResult.extractedIds || [],
            });

            if (extractWizardState.showAfterComplete) {
                navigate(destinationPath);
                selectedItems = extractedResult.names;
                renderAll();
                return;
            }

            if (destinationPath === currentPath) {
                selectedItems = extractedResult.names;
                renderAll();
            }
        },
    });
}

// Compress/Extract
function handleCompress() {
    if (isProgressRunning) return;

    const items = getSelectedNonZipItems();
    if (items.length === 0) return;

    runWithProgress({
        title: "Compressing...",
        durationMs: 2000,
        action: () => {
            const zipName = getDefaultZipNameForItems(items);
            const zipMeta = {
                entries: items.map((item) => item.name),
                createdFromPath: currentPath,
            };
            const finalZipName = addZipFileToCurrentFolder(
                zipName,
                items,
                zipMeta,
            );
            const outputPath = joinPathMultiRoot(currentPath, finalZipName);
            const createdZip = getFileByPath(outputPath);
            logEvent("ZIP_CREATE", {
                outputId: createdZip?.id || null,
                outputPath,
                outputName: finalZipName,
                inputIds: items.map((item) => item.id).filter(Boolean),
            });

            selectedItems = [finalZipName];
            renderAll();
            startRenameAfterNextRender();
        },
    });
}

function handleExtract() {
    openExtractWizardForSelectedZip();
}

// New Item
function showNewItemModal(type) {
    document.getElementById("newItemTitle").textContent = `Create New ${
        type === "folder" ? "Folder" : "File"
    }`;
    document.getElementById("newItemName").value = "";
    document.getElementById("newFileContent").value = "";
    document.getElementById("newFileContentGroup").style.display =
        type === "file" ? "block" : "none";
    document.getElementById("newItemModal").dataset.type = type;
    showModal("newItemModal");
    document.getElementById("newItemName").focus();
}

// ============================================================================
// 7) File system operations (mutations)
// ============================================================================

function createNewItem() {
    const name = document.getElementById("newItemName").value.trim();
    const content = document.getElementById("newFileContent").value;
    const type = document.getElementById("newItemModal").dataset.type;

    if (!name) return;

    const items = getCurrentItems();

    // INVARIANT:
    // Creating a new file/folder must not auto-resolve name conflicts; students must choose unique names.
    // Auto-rename is only allowed for system operations (paste/restore/extract/compress).// INVARIANT (USER ACTION - STUDENT):
    // Creating a new file/folder MUST NOT auto-resolve name conflicts.
    // Students must explicitly choose a unique name.
    // Auto-renaming is only allowed for SYSTEM operations (paste/restore/extract/compress).

    if (items.some((i) => i.name === name)) {
        alert(`An item named "${name}" already exists.`);
        return;
    }

    const folder = getCurrentFolder();
    let createdNode = null;
    if (type === "folder") {
        createdNode = {
            id: createUuid(),
            name,
            type: "folder",
            children: [],
        };
        folder.children.push(createdNode);
    } else {
        createdNode = {
            id: createUuid(),
            name,
            type: "file",
            content: content || "",
        };
        folder.children.push(createdNode);
    }
    logEvent("CREATE", {
        subjectId: createdNode?.id || null,
        toPath: joinPathMultiRoot(currentPath, name),
        nodeType: type,
    });

    selectedItems = [name];
    hideModal("newItemModal");
    renderAll();
}

// ==========================
// Context menu builders (UI helpers)
// ==========================

function buildContextMenuForItem(item) {
    const isZip = item.name.endsWith(".zip");
    const isProtected = isProtectedFolderItem(item, currentPath);

    return `
        <div class="context-item" onclick="handleContextOpen()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Open
        </div>
        <div class="context-divider"></div>
        <div class="context-item ${isProtected ? "disabled" : ""}" onclick="${
            isProtected ? "" : "handleCut(); hideContextMenu();"
        }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>
            Cut
        </div>
        <div class="context-item" onclick="handleCopy(); hideContextMenu();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy
        </div>
        <div class="context-divider"></div>
        ${
            isZip
                ? `<div class="context-item" onclick="openExtractWizardForSelectedZip(); hideContextMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><path d="M12 11v6M9 14h6"/></svg>
                Extract All...
               </div>`
                : `<div class="context-item" onclick="handleCompress(); hideContextMenu();">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                Compress to ZIP
               </div>`
        }
        <div class="context-divider"></div>
        <div class="context-item ${isProtected ? "disabled" : ""}" onclick="${
            isProtected ? "" : "startRename(); hideContextMenu();"
        }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Rename
        </div>
        <div class="context-item danger ${
            isProtected ? "disabled" : ""
        }" onclick="${isProtected ? "" : "handleDelete(); hideContextMenu();"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Delete
        </div>
        <div class="context-divider"></div>
        <div class="context-item" onclick="showProperties(); hideContextMenu();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Properties
        </div>
    `;
}

function buildContextMenuForEmptyArea() {
    return `
        <div class="context-item" onclick="showNewItemModal('folder'); hideContextMenu();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><path d="M12 11v6M9 14h6"/></svg>
            New folder
        </div>
        <div class="context-item" onclick="showNewItemModal('file'); hideContextMenu();">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
            New file
        </div>
        <div class="context-divider"></div>
        <div class="context-item ${clipboard ? "" : "disabled"}" onclick="${
            clipboard ? "handlePaste(); hideContextMenu();" : ""
        }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            Paste
        </div>
    `;
}

// Context Menu
function showContextMenu(x, y, item) {
    if (isProgressRunning) return;

    const adjustedX = Math.min(x, window.innerWidth - 200);
    const adjustedY = Math.min(y, window.innerHeight - 300);

    contextMenuEl.style.left = adjustedX + "px";
    contextMenuEl.style.top = adjustedY + "px";

    if (item) {
        contextMenuEl.innerHTML = buildContextMenuForItem(item);
    } else {
        contextMenuEl.innerHTML = buildContextMenuForEmptyArea();
    }

    contextMenuEl.classList.add("active");
}

function hideContextMenu() {
    contextMenuEl.classList.remove("active");
}

function handleContextOpen() {
    if (selectedItems.length > 0) {
        const item = getCurrentItems().find((i) => i.name === selectedItems[0]);
        if (item) handleOpen(item);
    }
    hideContextMenu();
}

// ==========================
// Properties helpers
// ==========================

function getSingleSelectedItemOrNull() {
    // INVARIANT: properties only works for exactly 1 selected item
    if (selectedItems.length !== 1) return null;

    const itemName = selectedItems[0];
    return getCurrentItems().find((i) => i.name === itemName) || null;
}

function getFileTypeLabel(item) {
    // INVARIANT: keep exact same type labeling logic
    if (item.type === "folder") return "File folder";
    if (item.name.endsWith(".zip")) return "ZIP Archive";

    const ext = item.name.split(".").pop()?.toUpperCase() || "";
    return `${ext} File`;
}

function getPropertiesModel(item) {
    const icon = getFileIcon(item);
    const fileType = getFileTypeLabel(item);

    return {
        name: item.name,
        type: item.type,
        icon,
        fileType,
        sizeValue: item.type === "folder" ? "N/A" : item.size || "1 KB",
        containsValue:
            item.type === "folder"
                ? (item.children?.length || 0) + " items"
                : "N/A",
        createdValue: new Date().toLocaleDateString(),
    };
}

function buildPropertiesHtml(model) {
    // INVARIANT: preserve HTML structure & labels exactly
    return `
        <div class="properties-header">
            <div class="properties-icon ${model.type}">${model.icon}</div>
            <div>
                <div class="properties-name">${model.name}</div>
                <div class="properties-type">${model.fileType}</div>
            </div>
        </div>
        <div class="properties-row">
            <span class="properties-label">Type:</span>
            <span class="properties-value">${model.fileType}</span>
        </div>
        <div class="properties-row">
            <span class="properties-label">Size:</span>
            <span class="properties-value">${model.sizeValue}</span>
        </div>
        <div class="properties-row">
            <span class="properties-label">Contains:</span>
            <span class="properties-value">${model.containsValue}</span>
        </div>
        <div class="properties-row">
            <span class="properties-label">Created:</span>
            <span class="properties-value">${model.createdValue}</span>
        </div>
    `;
}

function renderPropertiesModal(model) {
    document.getElementById("propertiesTitle").textContent =
        `${model.name} Properties`;
    document.getElementById("propertiesBody").innerHTML =
        buildPropertiesHtml(model);

    showModal("propertiesModal");
}

// Properties
function showProperties() {
    const item = getSingleSelectedItemOrNull();
    if (!item) return;

    const model = getPropertiesModel(item);
    renderPropertiesModal(model);
}

function showProtectedFolderAlert(action) {
    const messages = {
        delete: "Systeemmap kan niet verwijderd worden.",
        rename: "Systeemmap kan niet hernoemd worden.",
        move: "Systeemmap kan niet verplaatst worden.",
    };
    alert(messages[action] || "Systeemmap kan niet worden aangepast.");
}

// File Viewer
function showFileViewer(item) {
    const isZip = item.name?.endsWith(".zip") || item.isZip;
    document.getElementById("fileViewerTitle").textContent = isZip
        ? "Archive contents"
        : item.name;

    if (isZip) {
        document.getElementById("fileViewerContent").innerHTML =
            buildArchiveViewerHtml(item);
    } else if (item.content) {
        document.getElementById("fileViewerContent").innerHTML =
            `<pre>${item.content}</pre>`;
    } else {
        const icon = getFileIcon(item);
        document.getElementById("fileViewerContent").innerHTML = `
            <div class="file-viewer-empty">
                <div class="file-icon">${icon}</div>
                <p>No content available for this file type</p>
                <p style="font-size: 11px; margin-top: 4px;">This is a simulated file viewer</p>
            </div>
        `;
    }

    showModal("fileViewerModal");
}

function buildArchiveViewerHtml(item) {
    const contents = Array.isArray(item.compressedContents)
        ? item.compressedContents
        : [];

    if (contents.length === 0) {
        return `
            <div class="archive-viewer-empty">
                <p>Archive is empty.</p>
            </div>
        `;
    }

    return `
        <div class="archive-viewer">
            ${renderArchiveTree(contents)}
        </div>
    `;
}

function renderArchiveTree(items) {
    const sorted = (items || []).slice().sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "folder" ? -1 : 1;
    });

    const listItems = sorted
        .map((item) => {
            if (item.type === "folder") {
                return `
                    <li class="archive-node folder">
                        <details>
                            <summary>${item.name}</summary>
                            ${renderArchiveTree(item.children || [])}
                        </details>
                    </li>
                `;
            }

            return `
                <li class="archive-node file">
                    <span>${item.name}</span>
                </li>
            `;
        })
        .join("");

    return `<ul class="archive-tree">${listItems}</ul>`;
}

//evaluation
function evaluateExercise(showResults = true) {
    const cfg = getExerciseConfig(); // single source of truth
    const tasks = cfg?.tasks || [];

    if (tasks.length === 0) {
        alert("Er zijn geen taken om te controleren.");
        return null;
    }

    const results = evaluateTasksFromConfig(tasks);

    // Persist latest results so status stays visible after reload
    persistLatestCheckResults(results);

    if (showResults) {
        const completedCount = results.filter((t) => t.completed).length;
        const totalCount = results.length;

        const header = document.getElementById("resultsHeader");
        const body = document.getElementById("resultsBody");

        if (completedCount === totalCount) {
            header.innerHTML = `<h2 style="color:#16a34a;">Goed gedaan!</h2>`;
            body.innerHTML = `<p>Alle opdrachten zijn correct uitgevoerd 🎉</p>`;
        } else {
            header.innerHTML = `<h2 style="color:#d97706;">Nog niet helemaal juist</h2>`;
            body.innerHTML = `
        <p>
          ${completedCount} van de ${totalCount} opdrachten zijn correct.<br>
          Kijk in de checklist welke stappen nog ontbreken.
        </p>`;
        }

        showModal("resultsModal");
    }

    // Update checklist UI (status classes + checkboxes)
    updateChecklistFromResults(results);

    // Persist latest results so status stays visible after reload
    persistLatestCheckResults(results);

    return results;
}

// Check Structure
function checkStructure() {
    evaluateExercise(true);
}

/**
 * Diagnostic structure comparison helper.
 *
 * INVARIANTS:
 * - Side-effect free
 * - NOT used for student grading
 * - Intended for teacher/debug/analysis tooling only
 * - Path construction MUST go through joinPath()
 */
function compareStructures(current, target, path = "C:") {
    const errors = [];

    function getItemsMap(items) {
        const map = {};
        (items || []).forEach((item) => (map[item.name] = item));
        return map;
    }

    function compare(currentItems, targetItems, currentPath) {
        const currentMap = getItemsMap(currentItems);
        const targetMap = getItemsMap(targetItems);

        // Missing or mismatched items
        Object.keys(targetMap).forEach((name) => {
            const currentItem = currentMap[name];
            const targetItem = targetMap[name];

            if (!currentItem) {
                errors.push(`Missing: "${name}" at ${currentPath}`);
                return;
            }

            if (currentItem.type !== targetItem.type) {
                errors.push(
                    `Type mismatch: "${name}" at ${currentPath} should be a ${targetItem.type}`,
                );
                return;
            }

            if (currentItem.type === "folder") {
                compare(
                    currentItem.children,
                    targetItem.children,
                    joinPath(currentPath, name), // invariant: no inline path concat
                );
            }
        });

        // Extra items
        Object.keys(currentMap).forEach((name) => {
            if (!targetMap[name]) {
                errors.push(
                    `Extra item: "${name}" at ${currentPath} should not exist`,
                );
            }
        });
    }

    compare(current.children, target.children, path);

    return { success: errors.length === 0, errors };
}

// Submit Exercise
function submitExercise() {
    if (exerciseSubmitted) return;

    const results = evaluateExercise(false);
    if (!results) return;

    exerciseSubmitted = true;
    localStorage.setItem("exerciseSubmitted", "true");

    withEl("submitBtn", (btn) => (btn.disabled = true));
    withEl("checkBtn", (btn) => (btn.disabled = true));

    const score = calculateScoreFromTasks(results);
    sendScoreToLMS(score);

    alert(
        `Oefening ingediend!\n\nVoltooide opdrachten: ${
            results.filter((t) => t.completed).length
        } / ${results.length}\nScore: ${score}%`,
    );
}

function countTotalItems(structure) {
    let count = structure.children?.length || 0;
    structure.children?.forEach((child) => {
        if (child.type === "folder") {
            count += countTotalItems(child);
        }
    });
    return count;
}

function sendScoreToLMS(score) {
    // Try SCORM 1.2 API
    if (typeof window.API !== "undefined" && window.API !== null) {
        window.API.LMSSetValue("cmi.core.score.raw", score);
        window.API.LMSSetValue("cmi.core.score.min", 0);
        window.API.LMSSetValue("cmi.core.score.max", 100);
        window.API.LMSSetValue(
            "cmi.core.lesson_status",
            score >= 50 ? "passed" : "failed",
        );
        window.API.LMSCommit("");
    }
    // Try SCORM 2004 API
    else if (
        typeof window.API_1484_11 !== "undefined" &&
        window.API_1484_11 !== null
    ) {
        window.API_1484_11.SetValue("cmi.score.raw", score);
        window.API_1484_11.SetValue("cmi.score.min", 0);
        window.API_1484_11.SetValue("cmi.score.max", 100);
        window.API_1484_11.SetValue(
            "cmi.success_status",
            score >= 50 ? "passed" : "failed",
        );
        window.API_1484_11.Commit("");
    }
    // Try postMessage for iframe embedding
    else if (window.parent !== window) {
        window.parent.postMessage(
            {
                type: "lms-score",
                score: score,
                maxScore: 100,
                passed: score >= 50,
            },
            "*",
        );
    }
}

// ============================================================================
// 9) Modals & UI flows
// ============================================================================

function getActiveModal() {
    // We gaan ervan uit dat er meestal maar 1 modal tegelijk open is.
    // Toch nemen we de laatste "active" als er ooit stacking komt.
    const actives = Array.from(document.querySelectorAll(".modal.active"));
    return actives.length ? actives[actives.length - 1] : null;
}

function modalAllowsOverlayClose(modalEl) {
    // Default = true (dus bestaande modals blijven "non-blocking" zonder extra attribuut)
    // Alleen als expliciet "false" => blocking.
    return modalEl?.dataset?.overlayClose !== "false";
}

function syncOverlayCloseVisualState() {
    const activeModal = getActiveModal();
    const closable = activeModal ? modalAllowsOverlayClose(activeModal) : true;

    modalOverlayEl.classList.toggle(
        "overlay-closable",
        !!activeModal && closable,
    );
    modalOverlayEl.classList.toggle(
        "overlay-blocked",
        !!activeModal && !closable,
    );
}

function showModal(modalId) {
    // POLISH: context menu always closes when a modal opens
    if (typeof hideContextMenu === "function") {
        hideContextMenu();
    }
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modalOverlayEl.classList.add("active");
    modal.classList.add("active");

    syncOverlayCloseVisualState();
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove("active");

    // Overlay alleen weg als er geen andere modals meer open zijn.
    const stillOpen = document.querySelector(".modal.active");
    if (!stillOpen) {
        modalOverlayEl.classList.remove("active");
        modalOverlayEl.classList.remove("overlay-closable", "overlay-blocked");
    } else {
        syncOverlayCloseVisualState();
    }
}

function hideAllModals() {
    document
        .querySelectorAll(".modal")
        .forEach((m) => m.classList.remove("active"));
    modalOverlayEl.classList.remove("active");
    modalOverlayEl.classList.remove("overlay-closable", "overlay-blocked");
}

function runWithProgress({ title, durationMs = 2000, action }) {
    if (isProgressRunning) return;

    const modal = document.getElementById("zipProgressModal");
    const titleEl = document.getElementById("zipProgressTitle");
    const barEl = document.getElementById("zipProgressBar");

    const safeDuration = Number.isFinite(durationMs) ? durationMs : 2000;

    isProgressRunning = true;
    if (typeof hideContextMenu === "function") hideContextMenu();
    setToolbarButtonsDisabled(true);

    const finalize = () => {
        try {
            if (typeof action === "function") action();
        } finally {
            if (modal) {
                hideModal("zipProgressModal");
            }
            if (barEl) {
                barEl.style.transition = "none";
                barEl.style.width = "0%";
            }
            isProgressRunning = false;
            setToolbarButtonsDisabled(false);
            updateNavigationButtons();
            updateToolbarState();
        }
    };

    if (!modal || !titleEl || !barEl) {
        setTimeout(finalize, safeDuration);
        return;
    }

    titleEl.textContent = title || "Processing...";
    barEl.style.transition = "none";
    barEl.style.width = "0%";
    // Force reflow so transition restarts reliably
    // eslint-disable-next-line no-unused-expressions
    barEl.offsetWidth;

    showModal("zipProgressModal");

    barEl.style.transition = `width ${safeDuration}ms linear`;
    requestAnimationFrame(() => {
        barEl.style.width = "100%";
    });

    setTimeout(finalize, safeDuration);
}

function shakeModal(modalEl) {
    if (!modalEl) return;

    // Restart animation even if user clicks multiple times quickly
    modalEl.classList.remove("modal-shake");

    // Force reflow so the animation can restart reliably
    // eslint-disable-next-line no-unused-expressions
    modalEl.offsetWidth;

    modalEl.classList.add("modal-shake");

    // Cleanup after animation finishes (fallback timeout in case animationend fails)
    const cleanup = () => modalEl.classList.remove("modal-shake");
    modalEl.addEventListener("animationend", cleanup, { once: true });
    setTimeout(cleanup, 500);
}

function requestCloseActiveModalFromOverlay() {
    const activeModal = getActiveModal();
    if (!activeModal) return;

    if (modalAllowsOverlayClose(activeModal)) {
        hideModal(activeModal.id);
    } else {
        // NEW: visual feedback for blocking modals
        shakeModal(activeModal);
    }
}

function requestCloseActiveModalFromEscape() {
    const activeModal = getActiveModal();
    if (!activeModal) return;

    if (modalAllowsOverlayClose(activeModal)) {
        hideModal(activeModal.id);
    } else {
        // POLISH: same feedback as overlay click
        shakeModal(activeModal);
    }
}

function updateChecklistFromResults(results) {
    const items = document.querySelectorAll(".instruction-item");
    const checklistEnabled = isStudentChecklistEnabled();

    results.forEach((task, index) => {
        const li = items[index];
        if (!li) return;

        li.classList.remove("status-success", "status-partial", "status-fail");

        const checkbox = li.querySelector('input[type="checkbox"]');
        const completed = !!task.completed;

        const checks = Array.isArray(task.checks) ? task.checks : [];
        const passedCount = checks.filter((c) => c && c.passed).length;
        const hasAnyPass = passedCount > 0;
        const allPass = checks.length > 0 && passedCount === checks.length;

        if (checkbox) {
            if (checklistEnabled) {
                if (completed) {
                    checkbox.checked = true;
                    checkbox.disabled = true;
                    studentChecklistState[index] = true;
                } else {
                    checkbox.checked = false;
                    checkbox.disabled = false;
                    studentChecklistState[index] = false;
                }
            } else {
                checkbox.checked = completed;
                checkbox.disabled = true;
            }
        }

        li.classList.toggle("completed", completed);

        if (completed) {
            li.classList.add("status-success");
        } else if (hasAnyPass && !allPass) {
            li.classList.add("status-partial");
        } else {
            li.classList.add("status-fail");
        }
    });

    if (checklistEnabled) {
        persistStudentChecklistState(studentChecklistState);
    }
}
