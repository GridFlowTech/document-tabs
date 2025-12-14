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
 * Configuration interface for Document Tabs extension
 */
export interface DocumentTabsConfig {
    sortOrder: SortOrder;
    groupBy: GroupBy;
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
 * Gets the project/solution folder for a URI
 * This detects project folders like Users.Api, Users.Contracts based on common patterns
 */
export function getProjectFolder(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return 'External';
    }

    // Get relative path from workspace folder
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const pathParts = relativePath.split(/[/\\]/);

    // Look for common project patterns in the path
    // Pattern 1: Look for folders ending with common project suffixes
    const projectSuffixes = ['.Api', '.Contracts', '.Infrastructure', '.Service', '.Services', 
                            '.Core', '.Domain', '.Application', '.Web', '.Tests', '.Common',
                            '.Data', '.Models', '.Shared', '.Client', '.Server'];
    
    for (const part of pathParts) {
        for (const suffix of projectSuffixes) {
            if (part.endsWith(suffix)) {
                return part;
            }
        }
    }

    // Pattern 2: If path has 'src' folder, use the folder after src
    const srcIndex = pathParts.findIndex(p => p.toLowerCase() === 'src');
    if (srcIndex !== -1 && srcIndex + 1 < pathParts.length - 1) {
        return pathParts[srcIndex + 1];
    }

    // Pattern 3: Look for folders containing project files (.csproj, .fsproj, package.json, etc.)
    // For now, use the first significant folder after workspace root
    if (pathParts.length > 1) {
        // Skip common non-project folders
        const skipFolders = ['src', 'source', 'lib', 'libs', 'packages', 'node_modules', 'bin', 'obj', 'out', 'dist', 'build'];
        for (const part of pathParts.slice(0, -1)) { // Exclude filename
            if (!skipFolders.includes(part.toLowerCase()) && part.length > 0) {
                return part;
            }
        }
    }

    // Fallback to workspace folder name
    return workspaceFolder.name;
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
