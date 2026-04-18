import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Represents the sorting options for tabs
 */
export type SortOrder = 'alphabetical' | 'recentlyOpenedFirst' | 'recentlyOpenedLast';

/**
 * Represents the grouping options for tabs
 */
export type GroupBy = 'none' | 'folder' | 'workspace' | 'extension' | 'project';

/**
 * Represents how tabs should be colorized in the Document Tabs view.
 */
export type ColorBy = 'none' | 'project' | 'extension';

/**
 * Supported manual tab colors.
 */
export type TabColorName =
  | 'none'
  | 'lavender'
  | 'gold'
  | 'cyan'
  | 'burgundy'
  | 'green'
  | 'brown'
  | 'royalBlue'
  | 'pumpkin'
  | 'gray'
  | 'volt'
  | 'teal'
  | 'magenta'
  | 'mint'
  | 'darkBrown'
  | 'blue'
  | 'pink';

/**
 * Configuration interface for Document Tabs extension
 */
export interface DocumentTabsConfig {
  sortOrder: SortOrder;
  groupBy: GroupBy;
  colorBy: ColorBy;
  showPinnedSeparately: boolean;
  showTabCount: boolean;
  showDirtyIndicator: boolean;
  showFileIcons: boolean;
  showPath: boolean;
  collapseGroupsByDefault: boolean;
}

/**
 * Discriminates the kind of editor a tab represents.
 */
export type TabKind = 'file' | 'diff' | 'webview' | 'terminal';

/**
 * Represents a tab item in the tree view
 */
export interface TabItem {
  type: 'tab';
  tab: vscode.Tab;
  tabKey: string;
  tabKind: TabKind;
  uri?: vscode.Uri;
  viewType?: string;
  label: string;
  isPinned: boolean;
  isDirty: boolean;
  openedAt: number;
  groupName?: string;
  projectFolder?: string;
}

/**
 * Represents a group item in the tree view
 */
export interface GroupItem {
  type: 'group';
  name: string;
  tabs: TabItem[];
  collapsibleState: vscode.TreeItemCollapsibleState;
}

/**
 * Union type for tree view items
 */
export type TreeViewItem = TabItem | GroupItem;

/**
 * Type guard to check if an item is a TabItem
 */
export function isTabItem(item: TreeViewItem): item is TabItem {
  return item.type === 'tab';
}

/**
 * Type guard to check if an item is a GroupItem
 */
export function isGroupItem(item: TreeViewItem): item is GroupItem {
  return item.type === 'group';
}

/**
 * Gets the URI from a tab input if available
 */
export function getTabUri(tab: vscode.Tab): vscode.Uri | undefined {
  const input = tab.input;

  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputNotebook) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputCustom) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return input.modified;
  }
  if (input instanceof vscode.TabInputNotebookDiff) {
    return input.modified;
  }

  return undefined;
}

/**
 * Returns true when the tab represents a text diff (e.g. Git Working Tree).
 */
export function isTabDiff(tab: vscode.Tab): boolean {
  return tab.input instanceof vscode.TabInputTextDiff;
}

/**
 * Returns the TabKind for a VS Code Tab.
 */
export function getTabKind(tab: vscode.Tab): TabKind {
  const input = tab.input;
  if (input instanceof vscode.TabInputTextDiff || input instanceof vscode.TabInputNotebookDiff) {
    return 'diff';
  }
  if (input instanceof vscode.TabInputWebview) {
    return 'webview';
  }
  if (input instanceof vscode.TabInputTerminal) {
    return 'terminal';
  }
  // File-backed tabs: TabInputText, TabInputNotebook, TabInputCustom
  if (
    input instanceof vscode.TabInputText ||
    input instanceof vscode.TabInputNotebook ||
    input instanceof vscode.TabInputCustom
  ) {
    return 'file';
  }
  // Duck-type detection for unknown input types (e.g. future API additions)
  if (input && typeof input === 'object') {
    if ('viewType' in input && !('uri' in input)) {
      return 'webview';
    }
  }
  // Truly unknown — treat as webview so it still appears in the tree
  if (input === undefined || input === null) {
    return 'webview';
  }
  return 'webview';
}

/**
 * Returns the viewType for a webview or custom tab, or undefined.
 */
export function getWebviewViewType(tab: vscode.Tab): string | undefined {
  const input = tab.input;
  if (input instanceof vscode.TabInputWebview) {
    return input.viewType;
  }
  if (input instanceof vscode.TabInputCustom) {
    return input.viewType;
  }
  // Duck-type fallback for unknown input objects
  if (input && typeof input === 'object' && 'viewType' in input) {
    return String((input as Record<string, unknown>).viewType);
  }
  return undefined;
}

/**
 * Unique key for a tab — differentiates all tab types.
 */
export function getTabKey(tab: vscode.Tab): string {
  const kind = getTabKind(tab);
  switch (kind) {
    case 'webview': {
      const vt = getWebviewViewType(tab) ?? 'unknown';
      return `webview:${vt}:${tab.label}`;
    }
    case 'terminal':
      return `terminal:${tab.label}`;
    case 'diff': {
      const uri = getTabUri(tab);
      return uri ? uri.toString() + '#diff' : `diff:${tab.label}`;
    }
    default: {
      const uri = getTabUri(tab);
      return uri ? uri.toString() : `unknown:${tab.label}`;
    }
  }
}

/**
 * Known webview viewType → activation command mapping.
 */
const webviewActivationCommands: Record<string, string> = {
  'workbench.settings.editor': 'workbench.action.openSettings2',
  'workbench.keybindings.editor': 'workbench.action.openGlobalKeybindings',
  'workbench.releaseNotes': 'update.showCurrentReleaseNotes',
  'workbench.welcome': 'workbench.action.showWelcomePage',
  'mainThreadWebview-markdown.preview': 'markdown.showPreview',
  'mainThreadWebview-searchEditor': 'search.action.openEditor'
};

/**
 * Returns the activation command for a known webview viewType, or undefined.
 */
export function getWebviewActivationCommand(viewType: string): string | undefined {
  // Direct match
  if (webviewActivationCommands[viewType]) {
    return webviewActivationCommands[viewType];
  }
  // Some viewTypes are prefixed (e.g. mainThreadWebview-...)
  for (const [key, cmd] of Object.entries(webviewActivationCommands)) {
    if (viewType.includes(key)) {
      return cmd;
    }
  }
  return undefined;
}

/**
 * Gets the file name from a URI
 */
export function getFileName(uri: vscode.Uri): string {
  const parts = uri.path.split('/');
  return parts[parts.length - 1] || uri.path;
}

/**
 * Gets the file extension from a URI
 */
export function getFileExtension(uri: vscode.Uri): string {
  const fileName = getFileName(uri);
  const parts = fileName.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : 'No Extension';
}

/**
 * Gets the parent folder name from a URI
 */
export function getParentFolder(uri: vscode.Uri): string {
  const parts = uri.path.split('/');
  if (parts.length >= 2) {
    return parts[parts.length - 2] || 'Root';
  }
  return 'Root';
}

/**
 * Gets the workspace folder name for a URI
 */
export function getWorkspaceFolder(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  return workspaceFolder?.name || 'External';
}

/**
 * Cache for project folder lookups to avoid repeated file system scans
 * Now with LRU-style size limiting
 */
const projectFolderCache = new Map<string, string>();
const MAX_PROJECT_CACHE_SIZE = 1000;

/**
 * Clear the project folder cache (useful after project file renames)
 */
export function clearProjectFolderCache(): void {
  projectFolderCache.clear();
}

/**
 * Gets the project folder for a URI by finding the nearest folder containing a project file
 * (.csproj, .fsproj, .vbproj, etc.)
 * Synchronous version that scans directories and checks cache first
 */
export function getProjectFolder(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return 'External';
  }

  const startingDir = path.dirname(uri.fsPath);

  // Check cache first
  if (projectFolderCache.has(startingDir)) {
    return projectFolderCache.get(startingDir)!;
  }

  // Walk upward to find a .xxxproj file
  let currentDir = startingDir;
  const workspacePath = workspaceFolder.uri.fsPath;

  while (currentDir && currentDir.length >= workspacePath.length) {
    try {
      if (fs.existsSync(currentDir)) {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
          if (file.match(/\.[^.]*proj$/i)) {
            const projectName = file.replace(/\.[^.]*proj$/i, '');
            if (projectFolderCache.size >= MAX_PROJECT_CACHE_SIZE) {
              const firstKey = projectFolderCache.keys().next().value;
              if (firstKey) {
                projectFolderCache.delete(firstKey);
              }
            }
            projectFolderCache.set(startingDir, projectName);
            return projectName;
          }
        }
      }
    } catch (error) {
      console.error('DocumentTabs: Failed to scan directory:', error);
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  // Fallback: first meaningful folder in relative path
  const dirParts = vscode.workspace.asRelativePath(uri, false).split(/[\\/]/).slice(0, -1);
  const rootFolders = ['src', 'source', 'lib', 'libs', 'packages', 'projects', 'apps', 'modules'];

  for (const folderName of dirParts) {
    if (!rootFolders.includes(folderName.toLowerCase()) && folderName.length > 0) {
      if (projectFolderCache.size >= MAX_PROJECT_CACHE_SIZE) {
        const firstKey = projectFolderCache.keys().next().value;
        if (firstKey) {
          projectFolderCache.delete(firstKey);
        }
      }
      projectFolderCache.set(startingDir, folderName);
      return folderName;
    }
  }

  // Ultimate fallback
  const result = workspaceFolder.name;
  if (projectFolderCache.size >= MAX_PROJECT_CACHE_SIZE) {
    const firstKey = projectFolderCache.keys().next().value;
    if (firstKey) {
      projectFolderCache.delete(firstKey);
    }
  }
  projectFolderCache.set(startingDir, result);
  return result;
}

/**
 * Gets the relative path from the workspace folder
 */
export function getRelativePath(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (workspaceFolder) {
    return vscode.workspace.asRelativePath(uri, false);
  }
  return uri.fsPath;
}
