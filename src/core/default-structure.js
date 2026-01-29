// default-structure.js
// Multi-root default structure for teacher mode.
// Backwards compatibility: student exercises can still provide a single root
// (name:"C:") and the core will wrap it into roots[].

window.DEFAULT_STRUCTURE = {
    // New multi-root format
    roots: [
        {
            name: "C:",
            type: "folder",
            // Optional metadata for UI (not required by engine)
            meta: { kind: "drive", displayName: "Lokale schijf (C:)" },
            children: [
                { name: "Documents", type: "folder", children: [] },
                { name: "Downloads", type: "folder", children: [] },
                { name: "Desktop", type: "folder", children: [] },
            ],
        },
        {
            name: "OneDrive",
            type: "folder",
            meta: { kind: "cloud", displayName: "OneDrive" },
            children: [
                { name: "Documents", type: "folder", children: [] },
                { name: "Pictures", type: "folder", children: [] },
            ],
        },
    ],
};
