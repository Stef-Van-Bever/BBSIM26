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
