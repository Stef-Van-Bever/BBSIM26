## Conceptual model: checks vs diffs vs tasks

In Base44, **checks**, **diffs**, and **tasks** serve different purposes.
They are intentionally separated to keep the system understandable,
testable, and pedagogically correct.

## Path format (multi-root)

All checks that accept a `path` use the same convention:

- The first segment is the root (e.g. `C:` or `OneDrive`)
- Examples:
    - `C:\Documents\report.docx`
    - `OneDrive\Documents\report.docx`
    - `C:\Downloads` (folder)

Notes:

- `This PC` and `Recycle Bin` are UI navigation locations and are not used as `path` values in checks.
- Cross-root moves are supported (e.g. from `C:\...` to `OneDrive\...`) using the same check types as normal moves, because paths are root-aware.

---

### Diffs (structural comparison)

Diffs describe **what is different** between two file structures.

Examples:

- File exists in target but not in start
- Folder removed
- File renamed (detected heuristically)
- File moved (future extension)

Properties:

- Derived from comparing two structures
- Represent _raw facts_
- Order does not matter
- Not student-facing
- Not used directly for grading

Diffs are primarily a **teacher / authoring tool concern**.

---

### Tasks (student instructions)

Tasks describe **what the student is asked to do**.

Examples:

- “Verplaats het bestand `report.docx` naar de map `Docs`.”
- “Verwijder de map `Temp`.”
- “Hernoem `old.txt` naar `new.txt`.”

Properties:

- Human-readable
- Ordered
- Shown in the checklist UI
- Each task contains one or more checks

Tasks bridge **author intent** and **student action**.

---

### Checks (evaluation rules)

Checks describe **what must be true** after the student finishes.

Examples:

- File exists at a given path
- File does not exist
- File moved from A to B
- Folder exists

Properties:

- Declarative
- Side-effect free
- Order-independent
- Evaluated against the current file system state

Checks never describe _how_ something was achieved —
only _whether the end condition is satisfied_.

---

## Invariants for checks

Checks must obey the following strict rules:

- ✅ Side-effect free  
  Checks must never mutate the file system or UI.

- ✅ Declarative  
  A check expresses a condition, not an action.

- ✅ Stateless  
  Checks depend only on the current file system state.

- ❌ No UI logic  
  Checks must not trigger alerts, modals, or rendering.

- ❌ No history awareness  
  Checks must not depend on how the student arrived at the result.

---

## Example: rename vs delete (important edge case)

If a file is renamed:

- A `file-renamed` check should pass
- A `file-not-exists` check for the old name should also pass
- The file must **not** be treated as deleted

This invariant ensures that:

- Renames are not misinterpreted as deletes
- Grading remains fair and predictable

---

## Why this separation matters (educational rationale)

Separating diffs, tasks, and checks allows:

- Clear authoring workflows for teachers
- Predictable grading for students
- Easier extension with new task types
- Safe refactoring

## Supported check types

## Config: initialRecycleBin (optional)

Exercises can pre-seed the Recycle Bin via `initialRecycleBin` in `exercise-config.json`.
This is useful for restore/permanent-delete tasks.

Each entry uses the same shape as the runtime recycle bin items:

Example:
{
"meta": { "title": "Restore exercise" },
"initialStructure": { ... },
"initialRecycleBin": [
  {
    "name": "old.txt",
    "type": "file",
    "originalPath": "C:\\Docs",
    "deletedAt": "2026-02-01T12:00:00.000Z"
  }
],
"tasks": [ ... ]
}

Notes:
- `originalPath` is the folder that contained the item before deletion.
- `deletedAt` is informational and optional.
- Items in `initialRecycleBin` are removed from the live structure; only the bin holds them at start.

### file-exists

Checks if a file exists at the given path.

### file-not-exists

Checks if a file does not exist at the given path.

### folder-exists

Checks if a folder exists at the given path.

### folder-not-exists

Checks if a folder does not exist at the given path.

Example:
{
"type": "folder-not-exists",
"path": "C:\\Temp"
}

### folder-renamed

Checks if a folder was renamed (declarative: new path exists and old path does not).

Example:
{
"type": "folder-renamed",
"from": "C:\\Docs\\OldName",
"to": "C:\\Docs\\NewName"
}

### folder-moved

Checks if a folder was moved (declarative: destination exists and source does not).

Example:
{
"type": "folder-moved",
"from": "C:\\Docs\\FolderA",
"to": "C:\\Downloads\\FolderA"
}

### file-moved

Checks if a file was moved (declarative: destination exists and source does not).

Example:
{
"type": "file-moved",
"from": "C:\\Docs\\report.docx",
"to": "OneDrive\\Documents\\report.docx"
}

### file-renamed

Checks if a file was renamed (declarative: new path exists and old path does not).

Example:
{
"type": "file-renamed",
"from": "C:\\Docs\\old.txt",
"to": "C:\\Docs\\new.txt"
}

### folder-copied

Checks if a folder was copied (declarative: both source and destination exist).

Example:
{
"type": "folder-copied",
"from": "C:\\Docs\\Templates",
"to": "OneDrive\\Docs\\Templates"
}

### file-copied

Checks if a file was copied (declarative: both source and destination exist).

Example:
{
"type": "file-copied",
"from": "C:\\Docs\\report.docx",
"to": "OneDrive\\Documents\\report.docx"
}

### file-restored

Checks if a file was restored from the Recycle Bin (declarative: file exists and is not in the Recycle Bin).

Example:
{
"type": "file-restored",
"path": "C:\\Docs\\report.docx"
}

### folder-restored

Checks if a folder was restored from the Recycle Bin (declarative: folder exists and is not in the Recycle Bin).

Example:
{
"type": "folder-restored",
"path": "C:\\Docs\\Project"
}

### file-permanently-deleted

Checks if a file was permanently deleted (declarative: file does not exist and is not in the Recycle Bin).

Example:
{
"type": "file-permanently-deleted",
"path": "C:\\Docs\\old.txt"
}

### folder-permanently-deleted

Checks if a folder was permanently deleted (declarative: folder does not exist and is not in the Recycle Bin).

Example:
{
"type": "folder-permanently-deleted",
"path": "C:\\Temp"
}

### zip-exists

Checks if a zip file exists at the given path (path must end with `.zip`).

Example:
{
"type": "zip-exists",
"path": "C:\\Downloads\\Archive.zip"
}

### zip-contains

Checks if a zip file's `zipMeta.entries` includes the expected entries.
`mode: "all"` means all entries must be present, `mode: "any"` means at least one.

Example:
{
"type": "zip-contains",
"zipPath": "C:\\Downloads\\Archive.zip",
"entries": ["Docs", "img.png"],
"mode": "all"
}

### zip-extracted-to

Checks if a zip was extracted to a destination folder, by verifying the destination
folder exists and contains the expected top-level entries (files or folders).

Example:
{
"type": "zip-extracted-to",
"zipPath": "C:\\Downloads\\Archive.zip",
"destinationFolder": "C:\\Docs\\Archive",
"expectEntries": ["Docs", "img.png"]
}
