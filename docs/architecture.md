## Purpose

This project is an open-source, front-end-only web application that allows
students to safely practice Windows file management skills.

The application simulates a Windows-like file system and evaluates student
actions through declarative, task-based checks.

The project is designed for:

- educational use
- SCORM-compatible LMS integration
- long-term maintainability
- contribution by non-professional developers

## Core design principles

### 1. No backend

The entire application runs in the browser.
No real file system access is used.

### 2. Configuration-driven

Exercises are fully defined in JSON.
The engine never contains hardcoded exercise logic.

### 3. Task-based evaluation

Students are evaluated on tasks, not on final states.
Each task defines one or more checks.

### 4. Declarative checks

The engine only evaluates "what must be true",
never "how the student did it".

### 5. Teacher and student share the same engine

There is only one simulation and evaluation engine.
Teacher mode and student mode differ only in UI and initialization.

## Helper taxonomy & invariants

To keep the codebase readable and safe without a build step, helpers are grouped
by **intent**, not by file.

This taxonomy is enforced both by comments and by refactor discipline.

### 1. Pure utilities

Examples:

- Path helpers (`getParentPath`, `joinPath`, `getNameFromPath`)
- Naming helpers (`ensureUniqueChildName`)
- Structure helpers (`flattenStructure`, `deepClone`)

Invariants:

- No DOM access
- No global state mutation
- Deterministic output
- Never bind events
- Never split/join paths inline outside path helpers

These helpers produce **raw facts** or perform deterministic transformations.

#### Path convention (multi-root)

Paths are absolute and **root-aware**.

- Root is the first segment (e.g. `C:` or `OneDrive`)
- Root paths have no trailing backslash (e.g. `C:` / `OneDrive`)
- Folder paths do not end with a trailing backslash
- File paths include the filename

Virtual locations (UI navigation, not real folders):

- `This PC` (lists roots)
- `Recycle Bin`

Implication:

- Path helpers must handle **multiple roots** and `This PC` correctly.
- Never hardcode a single root in core logic.

---

### 2. Evaluation helpers (side-effect free)

Examples:

- `evaluateCheck`
- `evaluateTasksFromConfig`
- `compareStructures` (diagnostic only)

Invariants:

- Side-effect free
- Must not mutate the file system
- Express _what must be true_, never _how it was achieved_
- NOT responsible for UI updates

These helpers are safe to call repeatedly and are suitable for grading logic.

---

### 3. DOM helpers (small, controlled side effects)

Examples:

- `safeOn`
- `withEl`

Invariants:

- Limited to element lookup or minimal binding
- No business logic
- No state mutation beyond the DOM node itself
- Event wiring belongs in `bind*` / `setupEventListeners`

---

### 4. System operations (explicit mutations)

Examples:

- Paste / Restore / Extract / Compress flows
- `addWithUniqueName`

Invariants:

- Mutations must be explicit and centralized
- Auto-rename is allowed **only** here
- Must respect USER vs SYSTEM action rules

---

### 5. UI orchestration & rendering

Examples:

- `renderAll`
- `renderFileList`
- Modal flows

Invariants:

- No event registration
- Rendering must reflect state, not change rules
- Side effects are limited to the UI

---

### USER vs SYSTEM actions (educational invariant)

- **USER actions (student)**  
  Creating or renaming files/folders must **fail on name conflicts**.  
  Students are required to resolve conflicts manually.

- **SYSTEM operations**  
  Paste / restore / extract / compress operations **must auto-resolve conflicts**
  using shared naming helpers.

This distinction is essential for pedagogical correctness.

## Mental model

The application consists of three conceptual layers:

1. Simulation layer
    - A virtual file system in memory
    - Supports operations like create, move, rename, delete

2. Evaluation layer
    - A set of declarative checks
    - Evaluates the current simulated state

3. User interface layer
    - Student UI: practice, check, submit
    - Teacher UI: design exercises and export configuration

## File responsibilities

### script-core.js

The core engine.
Responsible for:

- file system simulation
- evaluation of checks
- shared logic for teacher and student mode

Must NOT contain:

- exercise-specific logic
- teacher UI logic
- student UI text

### script-student.js

Student-specific behavior:

- CHECK and SUBMIT flow
- feedback display
- SCORM communication

### script-teacher.js

Teacher-specific behavior:

- start/target structure capture
- diff analysis
- task generation
- exercise export

### exercise-config.json

Defines a single exercise:

- metadata
- initial structure
- tasks and checks

## Application modes

The application runs in one of two modes:

### Student mode

- Loads an exercise from exercise-config.json
- Uses the initialStructure from the config
- Students cannot change the evaluation logic

### Teacher mode

- Starts from an optional default structure
- Allows defining start and target structures
- Generates tasks by analyzing differences
- Exports exercise-config.json

The active mode is defined explicitly via a global APP_MODE flag.

## Invariants

The following rules must always hold true:

- A renamed file must never be evaluated as deleted
- A moved file must never be evaluated as deleted
- The core engine must never depend on teacher-only state
- The student engine must never depend on teacher UI code
- A check must never modify the file system
- Reset must always restore the original initial structure

## Intentional simplicity

This project deliberately avoids:

- frameworks
- complex build steps
- backend services

This lowers the barrier for:

- teachers
- students
- educational contributors

Complexity is accepted only when it directly supports learning goals.

## Possible future extensions

- Recycle Bin simulation (restore / permanent delete)
- ZIP compression checks
- More detailed feedback per task
- Accessibility improvements
- Localization

### Default Structure (Teacher Mode)

The teacher interface can optionally load a default file structure
from `default-structure.js`.

This file is not required.
If absent, the teacher starts with an empty C: drive.

Student exercises never depend on this file.
All student data is loaded from `exercise-config.json`.

#### Multi-root default structure

`default-structure.js` may define multiple roots via:

- `DEFAULT_STRUCTURE.roots: [...]`

Example roots:

- `C:` (local drive)
- `OneDrive` (cloud folder)

Student exercises remain backwards compatible:

- If `exercise-config.json` provides a single root structure, the engine normalizes it internally to a system root (`This PC`) with `roots[]`.

UI note:

- Roots can optionally include `meta.displayName` to show educational terms like `Lokale schijf C:` while keeping the internal root id (`C:`) stable for checks and paths.
