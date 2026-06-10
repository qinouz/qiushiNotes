# Community Project Reference

## Status

Draft

## Background

This project should not be designed in isolation. Mature open-source note and knowledge-base projects already solved many hard problems around desktop architecture, local storage, sync, hierarchy, search, export, and long-term knowledge management.

The goal is to learn from these projects without inheriting their full complexity, historical constraints, or product direction.

## Reference Projects

### Joplin

Official links:

- https://joplinapp.org/help/dev/spec/architecture/
- https://github.com/laurent22/joplin

Relevant ideas:

- Mature cross-platform notes application.
- Desktop application with sync support.
- Notes organized into notebooks.
- Search, tags, attachments, and export are core note-taking features.
- Joplin Server is designed for synchronizing application data between devices.

What to borrow:

- Treat sync as a separate system, not as the basic local editing path.
- Keep desktop app behavior useful even when sync is unavailable.
- Study how sync targets, conflict handling, and attachment resources are modeled.
- Keep import/export important from the beginning.

What not to borrow now:

- Full multi-client complexity.
- Existing Joplin sync protocol.
- To-do/task features as first-version scope.
- Plugin ecosystem as first-version scope.

### Trilium / TriliumNext

Official links:

- https://github.com/TriliumNext/trilium
- https://triliumnotes.org/
- https://github.com/zadam/trilium/wiki/Document/04d309d9caa233d5a1db034e320939d6713652d1

Relevant ideas:

- Focus on large personal knowledge bases.
- Hierarchical note organization is a first-class feature.
- SQLite database stores notes, tree structure, metadata, and configuration.
- A note can appear in multiple places in the hierarchy.

What to borrow:

- Use SQLite as a serious long-term local document store.
- Design the notebook tree for large personal knowledge collections.
- Consider whether future note cloning or multi-parent placement is useful.
- Keep metadata and relationships explicit rather than hidden in UI-only state.

What not to borrow now:

- Deep personal wiki complexity.
- Note cloning in the first version.
- Many specialized note types.
- Advanced scripting or automation features.

### Logseq

Official links:

- https://github.com/logseq/logseq
- https://github.com/logseq/logseq/blob/master/CODEBASE_OVERVIEW.md

Relevant ideas:

- Privacy-first knowledge management.
- Strong emphasis on user control and longevity.
- Markdown and Org-mode file support are central to the product.
- Graph-style knowledge organization is a long-term reference point.

What to borrow:

- Treat user data ownership as a product feature.
- Keep export formats readable and durable.
- Consider backlinks and knowledge graph later, after the core notes app is stable.

What not to borrow now:

- Outliner-first editing model.
- Graph database/cache complexity.
- Markdown-file-as-primary-storage as the first storage model.
- Knowledge graph as first-version scope.

### AFFiNE

Official links:

- https://github.com/toeverything/AFFiNE
- https://docs.affine.pro/self-host-affine/

Relevant ideas:

- Local-first workspace direction.
- Open-source Notion/Miro-style knowledge workspace.
- Self-hosting is supported with server-side infrastructure.
- Modern block/canvas product direction.

What to borrow:

- Local-first as a long-term product identity.
- Self-hosting as a serious deployment path.
- Keep space for richer knowledge-base features after the core notes product works.

What not to borrow now:

- Notion/Miro-style block workspace complexity.
- Canvas-first editing.
- Collaboration-first architecture.
- Heavy server-side workspace model.

## Decision

This project will not fork an existing open-source notes application for the first implementation.

Instead, it will use a small custom architecture:

- Electron desktop app.
- Vue 3 renderer.
- TypeScript across the app.
- SQLite as the local source of truth.
- Local attachments directory.
- Server sync added later as an enhancement.
- Design documents written before feature implementation.

## Rationale

Forking a mature project would provide many features quickly, but it would also bring:

- Large existing codebase complexity.
- A data model that may not match this project's local-first and export goals.
- Existing sync rules that may not fit a home-server sync model.
- Product assumptions that are hard to remove later.

Self-building the core keeps control over:

- Local database schema.
- Sync protocol.
- Attachment storage.
- Export format.
- Future private knowledge-base and AI integration.

## Architectural Lessons

- Local editing must be independent from sync.
- Sync should be asynchronous and recoverable.
- Attachments should be modeled separately from notes.
- Hierarchy should be first-class, not only a UI filter.
- Export and backup should be designed early.
- A quiet, durable notes app is more important than a large feature list.

## Open Questions

- Should notes support multiple notebook locations in a later version, similar to Trilium note cloning?
- Should Markdown export become a first-class round-trip format or only an export format?
- Should backlinks be included in the first local database schema, or added later?
- Should the server sync model be closer to Joplin-style item sync or custom change-log sync?

