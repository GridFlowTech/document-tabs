import * as vscode from 'vscode';
import {
    DocumentTabsConfig,
    SortOrder,
    GroupBy,
    TabItem,
    GroupItem,
    TreeViewItem,
    isTabItem,
    isGroupItem,
    getTabUri,
    getFileName,
    getFileExtension,
    getParentFolder,
    getProjectFolder,
    getRelativePath
} from './types';

/**
 * TreeDataProvider for the Document Tabs view
 * Provides data for displaying open tabs in a tree view with grouping and sorting
 */
export class DocumentTabsProvider implements vscode.TreeDataProvider<TreeViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeViewItem | undefined | null | void> =
        new vscode.EventEmitter<TreeViewItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeViewItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private tabOpenOrder: Map<string, number> = new Map();
    private orderCounter: number = 0;
    private treeView: vscode.TreeView<TreeViewItem> | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.initializeTabOrder();
    }

    /**
     * Sets the tree view reference for badge updates
     */
    setTreeView(treeView: vscode.TreeView<TreeViewItem>): void {
        this.treeView = treeView;
        this.updateBadge();
    }

    /**
     * Initialize tab order for existing tabs
     */
    private initializeTabOrder(): void {
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                const uri = getTabUri(tab);
                if (uri) {
                    this.tabOpenOrder.set(uri.toString(), this.orderCounter++);
                }
            }
        }
    }

    /**
     * Track newly opened tabs
     */
    trackNewTabs(tabs: readonly vscode.Tab[]): void {
        for (const tab of tabs) {
            const uri = getTabUri(tab);
            if (uri && !this.tabOpenOrder.has(uri.toString())) {
                this.tabOpenOrder.set(uri.toString(), this.orderCounter++);
            }
        }
    }

    /**
     * Remove closed tabs from tracking
     */
    removeClosedTabs(tabs: readonly vscode.Tab[]): void {
        for (const tab of tabs) {
            const uri = getTabUri(tab);
            if (uri) {
                this.tabOpenOrder.delete(uri.toString());
            }
        }
    }

    /**
     * Gets the configuration for the extension
     */
    private getConfig(): DocumentTabsConfig {
        const config = vscode.workspace.getConfiguration('documentTabs');
        return {
            sortOrder: config.get<SortOrder>('sortOrder', 'alphabetical'),
            groupBy: config.get<GroupBy>('groupBy', 'folder'),
            showPinnedSeparately: config.get<boolean>('showPinnedSeparately', true),
            showTabCount: config.get<boolean>('showTabCount', true),
            showDirtyIndicator: config.get<boolean>('showDirtyIndicator', true),
            showFileIcons: config.get<boolean>('showFileIcons', true),
            showPath: config.get<boolean>('showPath', true),
            collapseGroupsByDefault: config.get<boolean>('collapseGroupsByDefault', false)
        };
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
        this.updateBadge();
    }

    /**
     * Expand all groups in the tree view
     */
    async expandAll(): Promise<void> {
        if (!this.treeView) {
            return;
        }

        const children = this.getChildren();
        for (const child of children) {
            if (isGroupItem(child)) {
                try {
                    await this.treeView.reveal(child, { expand: true, select: false, focus: false });
                } catch {
                    // Ignore errors if element can't be revealed
                }
            }
        }
    }

    /**
     * Updates the view badge with tab count
     */
    private updateBadge(): void {
        if (!this.treeView) {
            return;
        }

        const config = this.getConfig();
        if (!config.showTabCount) {
            this.treeView.badge = undefined;
            return;
        }

        const tabCount = this.getAllTabs().length;
        this.treeView.badge = {
            value: tabCount,
            tooltip: `${tabCount} open tab${tabCount !== 1 ? 's' : ''}`
        };
    }

    /**
     * Get all tabs from all tab groups
     */
    private getAllTabs(): TabItem[] {
        const tabs: TabItem[] = [];

        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                const uri = getTabUri(tab);
                if (uri) {
                    const openedAt = this.tabOpenOrder.get(uri.toString()) ?? 0;
                    tabs.push({
                        type: 'tab',
                        tab,
                        uri,
                        label: getFileName(uri),
                        isPinned: tab.isPinned,
                        isDirty: tab.isDirty,
                        openedAt
                    });
                }
            }
        }

        return tabs;
    }

    /**
     * Sort tabs based on the configured sort order
     */
    private sortTabs(tabs: TabItem[]): TabItem[] {
        const config = this.getConfig();

        return [...tabs].sort((a, b) => {
            switch (config.sortOrder) {
                case 'alphabetical':
                    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
                case 'recentlyOpenedFirst':
                    return b.openedAt - a.openedAt;
                case 'recentlyOpenedLast':
                    return a.openedAt - b.openedAt;
                default:
                    return 0;
            }
        });
    }

    /**
     * Group tabs based on the configured grouping
     */
    private groupTabs(tabs: TabItem[]): Map<string, TabItem[]> {
        const config = this.getConfig();
        const groups = new Map<string, TabItem[]>();

        for (const tab of tabs) {
            let groupName: string;

            switch (config.groupBy) {
                case 'folder':
                    groupName = getParentFolder(tab.uri);
                    break;
                case 'extension':
                    groupName = getFileExtension(tab.uri);
                    break;
                case 'project':
                    groupName = getProjectFolder(tab.uri);
                    break;
                case 'none':
                default:
                    groupName = '';
                    break;
            }

            tab.groupName = groupName;

            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }
            groups.get(groupName)!.push(tab);
        }

        return groups;
    }

    /**
     * Get tree item representation for an element
     */
    getTreeItem(element: TreeViewItem): vscode.TreeItem {
        const config = this.getConfig();

        if (isGroupItem(element)) {
            const treeItem = new vscode.TreeItem(
                element.name || 'Ungrouped',
                element.collapsibleState
            );
            treeItem.contextValue = 'group';
            treeItem.description = `(${element.tabs.length})`;
            treeItem.iconPath = new vscode.ThemeIcon('folder');
            return treeItem;
        }

        // TabItem
        const tab = element;
        const treeItem = new vscode.TreeItem(tab.label);

        // Set description (path)
        if (config.showPath) {
            treeItem.description = getRelativePath(tab.uri);
        }

        // Set icon
        if (config.showFileIcons) {
            treeItem.resourceUri = tab.uri;
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('file');
        }

        // Set dirty indicator
        if (config.showDirtyIndicator && tab.isDirty) {
            treeItem.label = `● ${tab.label}`;
        }

        // Set pinned indicator
        if (tab.isPinned) {
            treeItem.contextValue = 'pinnedTab';
            if (!tab.isDirty) {
                treeItem.label = `📌 ${tab.label}`;
            } else {
                treeItem.label = `📌 ● ${tab.label}`;
            }
        } else {
            treeItem.contextValue = 'tab';
        }

        // Set command to open the tab on click
        treeItem.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [tab.uri]
        };

        // Set tooltip
        treeItem.tooltip = new vscode.MarkdownString();
        treeItem.tooltip.appendMarkdown(`**${tab.label}**\n\n`);
        treeItem.tooltip.appendMarkdown(`Path: \`${tab.uri.fsPath}\`\n\n`);
        if (tab.isPinned) {
            treeItem.tooltip.appendMarkdown(`📌 Pinned\n`);
        }
        if (tab.isDirty) {
            treeItem.tooltip.appendMarkdown(`● Unsaved changes\n`);
        }

        return treeItem;
    }

    /**
     * Get children for tree view
     */
    getChildren(element?: TreeViewItem): TreeViewItem[] {
        const config = this.getConfig();

        if (!element) {
            // Root level
            let tabs = this.getAllTabs();
            tabs = this.sortTabs(tabs);

            // Handle pinned tabs separately if configured
            if (config.showPinnedSeparately) {
                const pinnedTabs = tabs.filter(t => t.isPinned);
                const unpinnedTabs = tabs.filter(t => !t.isPinned);

                const result: TreeViewItem[] = [];

                if (pinnedTabs.length > 0) {
                    result.push({
                        type: 'group',
                        name: '📌 Pinned',
                        tabs: pinnedTabs,
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded
                    });
                }

                if (config.groupBy === 'none') {
                    // No grouping - return tabs directly (with pinned group if any)
                    return [...result, ...unpinnedTabs];
                }

                // Group unpinned tabs
                const groups = this.groupTabs(unpinnedTabs);
                const sortedGroupNames = Array.from(groups.keys()).sort();

                for (const groupName of sortedGroupNames) {
                    const groupTabs = groups.get(groupName)!;
                    result.push({
                        type: 'group',
                        name: groupName || 'Other',
                        tabs: groupTabs,
                        collapsibleState: config.collapseGroupsByDefault
                            ? vscode.TreeItemCollapsibleState.Collapsed
                            : vscode.TreeItemCollapsibleState.Expanded
                    });
                }

                return result;
            }

            // No separate pinned handling
            if (config.groupBy === 'none') {
                return tabs;
            }

            // Group all tabs
            const groups = this.groupTabs(tabs);
            const sortedGroupNames = Array.from(groups.keys()).sort();

            return sortedGroupNames.map(groupName => ({
                type: 'group' as const,
                name: groupName || 'Other',
                tabs: groups.get(groupName)!,
                collapsibleState: config.collapseGroupsByDefault
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : vscode.TreeItemCollapsibleState.Expanded
            }));
        }

        // Children of a group
        if (isGroupItem(element)) {
            return this.sortTabs(element.tabs);
        }

        return [];
    }

    /**
     * Get parent for tree view (required for reveal functionality)
     */
    getParent(element: TreeViewItem): TreeViewItem | undefined {
        if (isTabItem(element) && element.groupName) {
            const config = this.getConfig();
            if (config.groupBy !== 'none') {
                // Find the parent group
                const children = this.getChildren();
                for (const child of children) {
                    if (isGroupItem(child) && child.name === element.groupName) {
                        return child;
                    }
                }
            }
        }
        return undefined;
    }

    /**
     * Find a tab item by URI
     */
    findTabByUri(uri: vscode.Uri): TabItem | undefined {
        const tabs = this.getAllTabs();
        return tabs.find(t => t.uri.toString() === uri.toString());
    }
}
