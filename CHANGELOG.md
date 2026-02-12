# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.6] - 2026-02-11

### Added

- Comprehensive test suite with 50+ test cases (extension, provider, and type guards)
- Windows path resolution for test discovery (8.3 short path support)
- Extensive error handling with user-facing messages for all commands

### Changed

- Major performance optimizations: caching, memoization, and pre-computed values
- Configuration caching (100ms TTL) to reduce repeated reads during render cycles
- Project folder caching with LRU-style size limiting (max 1000 entries)
- Parent lookup map for O(1) reveal performance in tree view
- Pre-computed tab data (project folders, file extensions) in getAllTabs()
- Refactored tab sorting within groups to avoid double-sorting
- Code formatting consistency with Prettier and ESLint
- All commands now wrapped in try-catch for robustness
- Async context key updates to ensure proper menu state synchronization
- Improved tree view event handling with debounced refresh

### Fixed

- Graceful error handling in all async operations
- Type guard improvements for discriminated union pattern
- Proper cleanup and cache invalidation on configuration changes

## [1.0.5] - 2026-02-01

### Added

- Tab navigation commands: Go to Next/Previous Tab in Document Tabs order
- Default keybindings: Alt+PageDown (next) and Alt+PageUp (previous)
- Navigate tabs using the plugin's sort/group order instead of VS Code's built-in tab order

## [1.0.4] - 2025-12-30

### Added

- Active editor synchronization - Document Tabs selection now syncs with Explorer and tab clicks
- Support for all .xxxproj file types (generic project file detection)
- Event-driven initial selection for reliable startup behavior

### Fixed

- Project grouping now correctly shows multi-part names (e.g., Common.Contracts, Common.Infrastructure)
- Project cache clears on refresh to handle renamed project files
- Regex pattern updated to properly detect project names with dots

## [1.0.3] - 2025-12-18

### Added

- README context menu screenshot

### Changed

- View menu: show Color section items directly (no submenu)
- README view menu screenshot updated

## [1.0.2] - 2025-12-14

### Added

- "Color Document Tabs by" view menu (Project, File Extension, No Coloring)
- "Set Tab Color" context menu for Document Tabs items
- Automatic tab coloring (project- or extension-based)
- Per-file manual tab color overrides (persisted per workspace)

## [1.0.1] - 2025-12-14

### Added

- README screenshot for Marketplace/GitHub

### Fixed

- Marketplace category validation issue

## [1.0.0] - 2025-12-14

### Added

- Initial release of Document Tabs extension
- Sidebar view showing all open tabs
- Tab grouping by folder, extension, or project
- Tab sorting (alphabetical, recently opened first/last)
- Pinned tabs support with separate group
- Context menu actions:
  - Close tab
  - Close other tabs
  - Close tabs to the right
  - Close all in group
  - Pin/Unpin tab
  - Open to the side
  - Copy path
  - Copy relative path
  - Reveal in Explorer
- Configuration options for customization
- Real-time sync with VS Code tab state
- File icons and dirty indicators
- Tab count badge on view
- Expand All action in the view title

[Unreleased]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.6...HEAD
[1.0.6]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/GridFlowTech/document-tabs/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/GridFlowTech/document-tabs/releases/tag/v1.0.0
