# Feature Design Documents

Every feature module should have a design document before implementation starts.

The goal is to make future maintenance easy: when someone revisits a feature, they should be able to understand why it exists, how it works, where the data lives, and what tradeoffs were made.

Chinese documents are the primary maintenance entry for this project:

```text
docs/designs/zh-CN/
```

Recommended file naming:

```text
feature-name.md
```

Examples:

```text
local-database.md
notebook-tree.md
rich-text-editor.md
attachment-storage.md
full-text-search.md
sync-engine.md
```

Use `template.md` as the starting point for new feature designs.
