// script-student.js
// Student-only UI helpers (NO config loading here!)
// Single Source of Truth: window.exerciseConfig is loaded by script-core.js

function applyExerciseMeta(meta) {
    if (!meta) return;

    const titleEl = document.getElementById("exerciseTitleDisplay");
    const descEl = document.getElementById("exerciseDescriptionDisplay");

    if (titleEl) titleEl.textContent = meta.title || "";
    if (descEl) descEl.textContent = meta.description || "";
}

// 1) If core already loaded config before we run, apply immediately
document.addEventListener("DOMContentLoaded", () => {
    if (window.exerciseConfig?.meta) {
        applyExerciseMeta(window.exerciseConfig.meta);
    }
});

// 2) Also listen for async load completion (core dispatches this)
window.addEventListener("exercise-config-loaded", (e) => {
    const cfg = e?.detail;
    if (cfg?.meta) applyExerciseMeta(cfg.meta);
});
