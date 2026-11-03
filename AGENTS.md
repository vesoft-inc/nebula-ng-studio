# Repository rules

- Dependencies flow from `studio-ui` to `studio-ui-internal` to `studio-core`, never in reverse. Core has no UI, MobX, Router, or Axios dependency.
- Web/GUI use internal UI. Web may also use the public `adapters/studio-server` entry. Do not mix the two sets of Providers.
- Applications own routing and page composition: TanStack file routes in Web, React Router in GUI. UI packages do not parse URLs or dispatch pages.
- Keep MobX internal. Public APIs must not expose Controllers, Stores, observables, or Monaco/ForceGraph instances.
- Preserve encryption, snapshot, and storage key compatibility. Keep product behavior regressions, not migration comparison tests.
- Update affected guides, API documentation/reports, commands, and references alongside implementation changes; remove stale statements in the same change. Record reusable corrections in LESSONS.
- Unless instructed otherwise, automatically create local commits for completed, verified task changes, grouped by coherent concern. Use Conventional Commits and normal hooks; preserve unrelated edits/staging and push only when requested.

## Read as needed

| Task                                               | Guide                                                   |
| -------------------------------------------------- | ------------------------------------------------------- |
| Package boundaries, type ownership, public surface | [ARCHITECTURE](docs/agents/ARCHITECTURE.md)             |
| Core protocols and utilities                       | [STUDIO-CORE](docs/agents/STUDIO-CORE.md)               |
| Public UI and service contracts                    | [STUDIO-UI](docs/agents/STUDIO-UI.md)                   |
| Internal components and runtime                    | [STUDIO-UI-INTERNAL](docs/agents/STUDIO-UI-INTERNAL.md) |
| HTTP, settings, layout persistence                 | [STUDIO-SERVER](docs/agents/STUDIO-SERVER.md)           |
| Builds, verification, generated files              | [VERIFICATION](docs/agents/VERIFICATION.md)             |
| Concurrency, interaction, or boundary regressions  | [LESSONS](docs/agents/LESSONS.md)                       |
| Go development and deployment                      | [CONTRIBUTING](CONTRIBUTING.md), [deploy](deploy)       |

Keep always-applicable rules here and conditional constraints or key implementation details in their owning guides. Omit source inventories and generic advice.
