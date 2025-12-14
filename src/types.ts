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
 * Cache for project folder lookups to avoid repeated file system scans
 */
const projectFolderCache = new Map<string, string>();

/**
 * Gets the project folder for a URI by finding the nearest folder containing a project file
 * (.csproj, .fsproj, .vbproj, package.json, etc.)
 */
export function getProjectFolder(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return 'External';
    }

    // Get the directory path of the file
    const filePath = uri.fsPath;
    const workspacePath = workspaceFolder.uri.fsPath;
    
    // Check cache first
    const cacheKey = filePath;
    if (projectFolderCache.has(cacheKey)) {
        return projectFolderCache.get(cacheKey)!;
    }

    // Get relative path and split into parts
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const pathParts = relativePath.split(/[/\\]/);
    
    // Remove the filename to get directory parts
    const dirParts = pathParts.slice(0, -1);
    
    // Walk through the path from the file's directory upward
    // Look for the folder name that likely represents a project
    for (let i = dirParts.length - 1; i >= 0; i--) {
        const folderName = dirParts[i];
        
        // Skip common non-project folders
        const skipFolders = ['bin', 'obj', 'debug', 'release', 'node_modules', 'dist', 'out', 'build', 
                           '.vs', '.git', 'properties', 'wwwroot', 'controllers', 'models', 'views',
                           'services', 'repositories', 'data', 'entities', 'dtos', 'interfaces',
                           'migrations', 'configurations', 'helpers', 'extensions', 'middleware'];
        
        if (skipFolders.includes(folderName.toLowerCase())) {
            continue;
        }
        
        // Check if this folder name looks like a project name
        // Common patterns: ends with .Api, .Core, .Domain, .Infrastructure, .Service, etc.
        // Or contains a dot suggesting it's a namespaced project name
        const projectPatterns = [
            /\.(Api|Core|Domain|Infrastructure|Service|Services|Application|Web|Tests|Common|Data|Models|Shared|Client|Server|Contracts|Business|Logic|Repository|Repositories|Handlers|Commands|Queries|Events)$/i,
            /^[A-Z][a-zA-Z0-9]*\.[A-Z][a-zA-Z0-9]*/, // Pattern like "Users.Api", "Company.Project"
        ];
        
        for (const pattern of projectPatterns) {
            if (pattern.test(folderName)) {
                projectFolderCache.set(cacheKey, folderName);
                return folderName;
            }
        }
    }
    
    // If no pattern matched, use the first meaningful folder after common root folders
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
