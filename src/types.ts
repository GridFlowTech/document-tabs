import * as vscode from 'vscode';

/**
 * Represents the sorting options for tabs
 */
export type SortOrder = 'alphabetical' | 'recentlyOpenedFirst' | 'recentlyOpenedLast';

/**
 * Represents the grouping options for tabs
 */
export type GroupBy = 'none' | 'folder' | 'extension' | 'project';

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
 * Represents a tab item in the tree view
 */
export interface TabItem {
    type: 'tab';
    tab: vscode.Tab;
    uri: vscode.Uri;
    label: string;
    isPinned: boolean;
    isDirty: boolean;
    openedAt: number;
    groupName?: string;
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
 */
const projectFolderCache = new Map<string, string>();

/**
 * Synchronously scans a directory for project files and returns the project name
 */
function findProjectFileInDirectorySync(dirPath: string): string | null {
    try {
        const fs = require('fs');

        if (!fs.existsSync(dirPath)) {
            return null;
        }

        const files = fs.readdirSync(dirPath);

        // Look for .csproj, .fsproj, .vbproj files first
        for (const file of files) {
            if (file.endsWith('.csproj') || file.endsWith('.fsproj') || file.endsWith('.vbproj')) {
                // Return the project name without extension
                return file.replace(/\.(csproj|fsproj|vbproj)$/, '');
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Gets the project folder for a URI by finding the nearest folder containing a project file
 * (.csproj, .fsproj, .vbproj, package.json, etc.)
 */
export function getProjectFolder(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return 'External';
    }

    const filePath = uri.fsPath;
    const path = require('path');

    const startingDir = path.dirname(filePath);

    // Check cache first
    const cacheKey = startingDir;
    if (projectFolderCache.has(cacheKey)) {
        return projectFolderCache.get(cacheKey)!;
    }

    // Get the directory of the file and walk upward to find a .csproj file
    let currentDir = startingDir;
    const workspacePath = workspaceFolder.uri.fsPath;

    while (currentDir && currentDir.length >= workspacePath.length) {
        const projectName = findProjectFileInDirectorySync(currentDir);

        if (projectName) {
            projectFolderCache.set(cacheKey, projectName);
            return projectName;
        }

        // Move up one directory
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break; // Reached root
        }
        currentDir = parentDir;
    }

    // Fallback: use the first meaningful folder in the relative path
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const pathParts = relativePath.split(/[/\\]/);
    const dirParts = pathParts.slice(0, -1);

    for (const folderName of dirParts) {
        const rootFolders = ['src', 'source', 'lib', 'libs', 'packages', 'projects', 'apps', 'modules'];
        if (!rootFolders.includes(folderName.toLowerCase()) && folderName.length > 0) {
            projectFolderCache.set(cacheKey, folderName);
            return folderName;
        }
    }

    // Fallback to workspace folder name
    const result = workspaceFolder.name;
    projectFolderCache.set(cacheKey, result);
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
