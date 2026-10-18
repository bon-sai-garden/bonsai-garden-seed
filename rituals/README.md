---
id: 01KRNRJTY523XAQRKE14T4SBXF
title: Rituals
type: readme
tended-by: workshop
created: 2026-05-12
updated: 2026-05-12
---
# Rituals

> *The rituals are how the garden is tended. Specs clarify intent. Tasks track motion. Lessons prevent decay.*

---

## Structure

```
rituals/
├── specs/          ← formal specifications (what & how, before or after)
├── tasks/
│   ├── todo.md     ← current work tracking
│   └── lessons.md  ← captured learnings across sessions
└── templates/      ← reusable starters
    ├── spec.md
    └── task.md
```

---

## The three rituals

### 1. Specify
Before (or after) a run, write a spec. Small is fine. Specs are not bureaucracy — they are the crystallized version of what you learned. If you can't spec it, you don't understand it yet.

Use `templates/spec.md` as a starter. File under `specs/<slug>.md`.

### 2. Track
Active work lives in `tasks/todo.md`. Checkboxes in, checkboxes out. When a session ends, archive completed items or carry them forward. The list should reflect current reality, not history.

### 3. Learn
Every correction, every surprise, every "I should have done it this way" goes into `tasks/lessons.md`. These are rules for the next session, not post-mortems. Write them as imperatives.
