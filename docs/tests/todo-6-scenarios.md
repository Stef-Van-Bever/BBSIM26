# TODO 06 — Regression scenarios (multi-root)

## S1 — File moved C:\Documents → OneDrive\Documents

- Start: file `C:\Documents\test C.txt`
- Target: file moved to `OneDrive:\Documents\test C.txt`
- Expected tasks: `file-moved` (no `file-deleted`, no `file-created`)

## S2 — Folder moved with contents

- Start: folder `C:\Documents\MyFolder\A.txt`
- Target: folder moved to `OneDrive:\Documents\MyFolder\A.txt`
- Expected tasks: `folder-moved` (no `folder-removed`, no `folder-created`)
- Optional: either no per-file tasks OR per-file tasks but not conflicting (define your preference)

## S3 — File renamed same folder

- Start: `C:\Documents\a.txt`
- Target: `C:\Documents\b.txt`
- Expected tasks: `file-renamed` only

## S4 — Folder renamed same parent

- Start: `C:\Documents\OldName\...`
- Target: `C:\Documents\NewName\...`
- Expected tasks: `folder-renamed` only

## S5 — Folder deleted

- Start: `C:\Documents\Temp\...`
- Target: folder removed
- Expected tasks: `folder-not-exists` (folder delete task)

## S6 — File copied (future)

- Start: `C:\Documents\a.txt`
- Target: `C:\Documents\a.txt` + `OneDrive:\Documents\a.txt`
- Expected tasks: `file-copied` (or rule-based equivalent)
