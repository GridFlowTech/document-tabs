import * as vscode from 'vscode';
import {
  DocumentTabsConfig,
  SortOrder,
  GroupBy,
  ColorBy,
  TabColorName,
  TabItem,
  GroupItem,
  TreeViewItem,
  isTabItem,
  isGroupItem,
  getTabUri,
  getTabKey,
  getTabKind,
  getWebviewViewType,
  getFileName,
  getFileExtension,
  getParentFolder,
  getWorkspaceFolder,
  getProjectFolder,
  getRelativePath,
  clearProjectFolderCache
} from './types';

/**
 * TreeDataProvider for the Document Tabs view
 * Provides data for displaying open tabs in a tree view with grouping and sorting
 */
export class DocumentTabsProvider
  implements vscode.TreeDataProvider<TreeViewItem>, vscode.TreeDragAndDropController<TreeViewItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<TreeViewItem | undefined | null | void> =
    new vscode.EventEmitter<TreeViewItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeViewItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // TreeDragAndDropController — drag file URIs out (e.g. into Copilot/Claude chat)
  readonly dropMimeTypes: readonly string[] = [];
  readonly dragMimeTypes: readonly string[] = ['text/uri-list'];

  handleDrag(
    source: readonly TreeViewItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    const uris: string[] = [];
    for (const item of source) {
      if (isTabItem(item) && item.uri) {
        uris.push(item.uri.toString());
      } else if (isGroupItem(item)) {
        for (const tab of item.tabs) {
          if (tab.uri) {
            uris.push(tab.uri.toString());
          }
        }
      }
    }
    if (uris.length > 0) {
      dataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris.join('\r\n')));
    }
  }

  private tabOpenOrder = new Map<string, number>();
  private orderCounter = 0;
  private treeView: vscode.TreeView<TreeViewItem> | undefined;

  private cachedAllTabs: TabItem[] | undefined;
  private cachedRootChildren: TreeViewItem[] | undefined;
  private cachedRootChildrenSignature: string | undefined;
  private parentLookupMap = new Map<string, GroupItem>();
  private cachedConfig: DocumentTabsConfig | undefined;
  private configCacheInvalidateTime = 0;

  constructor(private context: vscode.ExtensionContext) {
    this.initializeTabOrder();
  }

  private static readonly tabColorStorageKey = 'documentTabs.tabColors';

  private getManualTabColors(): Record<string, TabColorName> {
    return this.context.workspaceState.get<Record<string, TabColorName>>(
      DocumentTabsProvider.tabColorStorageKey,
      {}
    );
  }

  private async setManualTabColor(uri: vscode.Uri, color: TabColorName): Promise<void> {
    const key = uri.toString();
    const colors = this.getManualTabColors();

    if (color === 'none') {
      delete colors[key];
    } else {
      colors[key] = color;
    }

    await this.context.workspaceState.update(DocumentTabsProvider.tabColorStorageKey, colors);
    this.refresh();
  }

  async clearManualTabColor(uri: vscode.Uri): Promise<void> {
    await this.setManualTabColor(uri, 'none');
  }

  async setManualTabColorByName(uri: vscode.Uri, color: TabColorName): Promise<void> {
    await this.setManualTabColor(uri, color);
  }

  private static hashString(value: string): number {
    // Simple stable hash (djb2)
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  private static readonly autoColorPalette: TabColorName[] = [
    'lavender',
    'gold',
    'cyan',
    'burgundy',
    'green',
    'brown',
    'royalBlue',
    'pumpkin',
    'gray',
    'volt',
    'teal',
    'magenta',
    'mint',
    'darkBrown',
    'blue',
    'pink'
  ];

  private static readonly themeColorByTabColor: Record<Exclude<TabColorName, 'none'>, string> = {
    lavender: 'charts.purple',
    gold: 'charts.yellow',
    cyan: 'terminal.ansiCyan',
    burgundy: 'terminal.ansiRed',
    green: 'charts.green',
    brown: 'terminal.ansiYellow',
    royalBlue: 'charts.blue',
    pumpkin: 'charts.orange',
    gray: 'terminal.ansiBrightBlack',
    volt: 'terminal.ansiBrightYellow',
    teal: 'terminal.ansiBrightCyan',
    magenta: 'terminal.ansiMagenta',
    mint: 'terminal.ansiBrightGreen',
    darkBrown: 'terminal.ansiBlack',
    blue: 'terminal.ansiBlue',
    pink: 'terminal.ansiBrightMagenta'
  };

  private getEffectiveTabColor(tab: TabItem, config: DocumentTabsConfig): TabColorName {
    if (!tab.uri) {
      return 'none';
    }

    const manualColors = this.getManualTabColors();
    const manual = manualColors[tab.uri.toString()];
    if (manual) {
      return manual;
    }

    if (config.colorBy === 'none') {
      return 'none';
    }

    let key: string;
    switch (config.colorBy) {
      case 'project':
        key = getProjectFolder(tab.uri);
        break;
      case 'extension':
        key = getFileExtension(tab.uri);
        break;
      default:
        return 'none';
    }

    const index = DocumentTabsProvider.hashString(key) % DocumentTabsProvider.autoColorPalette.length;
    return DocumentTabsProvider.autoColorPalette[index] ?? 'none';
  }

  private invalidateCache(): void {
    this.cachedAllTabs = undefined;
    this.cachedRootChildren = undefined;
    this.cachedRootChildrenSignature = undefined;
    this.parentLookupMap.clear();
    this.cachedConfig = undefined;
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
        const key = getTabKey(tab);
        this.tabOpenOrder.set(key, this.orderCounter++);
      }
    }
  }

  /**
   * Track newly opened tabs
   */
  trackNewTabs(tabs: readonly vscode.Tab[]): void {
    for (const tab of tabs) {
      const key = getTabKey(tab);
      if (!this.tabOpenOrder.has(key)) {
        this.tabOpenOrder.set(key, this.orderCounter++);
      }
    }

    if (tabs.length > 0) {
      this.invalidateCache();
    }
  }

  /**
   * Remove closed tabs from tracking
   */
  removeClosedTabs(tabs: readonly vscode.Tab[]): void {
    for (const tab of tabs) {
      const key = getTabKey(tab);
      this.tabOpenOrder.delete(key);
    }

    if (tabs.length > 0) {
      this.invalidateCache();
    }
  }

  /**
   * Gets the configuration for the extension with caching
   * Cache is valid for 100ms to avoid repeated reads during a single render cycle
   */
  private getConfig(): DocumentTabsConfig {
    const now = Date.now();
    if (this.cachedConfig && now - this.configCacheInvalidateTime < 100) {
      return this.cachedConfig;
    }

    const config = vscode.workspace.getConfiguration('documentTabs');
    this.cachedConfig = {
      sortOrder: config.get<SortOrder>('sortOrder', 'alphabetical'),
      groupBy: config.get<GroupBy>('groupBy', 'folder'),
      colorBy: config.get<ColorBy>('colorBy', 'none'),
      showPinnedSeparately: config.get<boolean>('showPinnedSeparately', true),
      showTabCount: config.get<boolean>('showTabCount', true),
      showDirtyIndicator: config.get<boolean>('showDirtyIndicator', true),
      showFileIcons: config.get<boolean>('showFileIcons', true),
      showPath: config.get<boolean>('showPath', true),
      collapseGroupsByDefault: config.get<boolean>('collapseGroupsByDefault', false)
    };
    this.configCacheInvalidateTime = now;
    return this.cachedConfig;
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    // Clear project folder cache to pick up project file renames
    clearProjectFolderCache();
    this.invalidateCache();
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
        } catch (error) {
          console.error('DocumentTabs: Failed to reveal group:', error);
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
   * Pre-computes project folders - uses cache when available to avoid I/O
   */
  private getAllTabs(): TabItem[] {
    if (this.cachedAllTabs) {
      return this.cachedAllTabs;
    }

    const tabs: TabItem[] = [];
    const config = this.getConfig();
    const needsProjectFolder = config.groupBy === 'project' || config.colorBy === 'project';

    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const tabKind = getTabKind(tab);
        const key = getTabKey(tab);
        const openedAt = this.tabOpenOrder.get(key) ?? 0;
        const uri = getTabUri(tab);

        if (tabKind === 'webview' || tabKind === 'terminal') {
          // Non-file tab — use VS Code's tab label directly
          tabs.push({
            type: 'tab',
            tab,
            tabKey: key,
            tabKind,
            uri: undefined,
            viewType: getWebviewViewType(tab),
            label: tab.label,
            isPinned: tab.isPinned,
            isDirty: tab.isDirty,
            openedAt
          });
        } else if (uri) {
          const isDiff = tabKind === 'diff';

          // Pre-compute project folder if needed (uses cache when available)
          let projectFolder: string | undefined;
          if (needsProjectFolder) {
            projectFolder = getProjectFolder(uri);
          }

          tabs.push({
            type: 'tab',
            tab,
            tabKey: key,
            tabKind,
            uri,
            label: isDiff ? `${getFileName(uri)} (Working Tree)` : getFileName(uri),
            isPinned: tab.isPinned,
            isDirty: tab.isDirty,
            openedAt,
            projectFolder
          });
        }
      }
    }

    this.cachedAllTabs = tabs;
    return tabs;
  }

  /**
   * Sort tabs based on the configured sort order
   * Accepts config as parameter to avoid repeated reads
   */
  private sortTabs(tabs: TabItem[], config?: DocumentTabsConfig): TabItem[] {
    if (!config) {
      config = this.getConfig();
    }

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
   * Accepts config as parameter to avoid repeated reads
   * Now sorts tabs within each group to avoid double-sorting
   */
  private groupTabs(tabs: TabItem[], config?: DocumentTabsConfig): Map<string, TabItem[]> {
    if (!config) {
      config = this.getConfig();
    }
    const groups = new Map<string, TabItem[]>();

    for (const tab of tabs) {
      let groupName: string;

      // Non-file tabs go into a special group
      if (!tab.uri) {
        if (config.groupBy === 'none') {
          groupName = '';
        } else {
          groupName = tab.tabKind === 'terminal' ? 'Terminals' : 'System Tabs';
        }
        tab.groupName = groupName;
        if (!groups.has(groupName)) {
          groups.set(groupName, []);
        }
        groups.get(groupName)!.push(tab);
        continue;
      }

      switch (config.groupBy) {
        case 'folder':
          groupName = getParentFolder(tab.uri!);
          break;
        case 'workspace':
          groupName = getWorkspaceFolder(tab.uri!);
          break;
        case 'extension':
          groupName = getFileExtension(tab.uri!);
          break;
        case 'project':
          // Use pre-computed projectFolder or fall back to getProjectFolder
          groupName = tab.projectFolder ?? getProjectFolder(tab.uri!);
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

    // Sort tabs within each group to avoid double-sorting later
    for (const [groupName, groupTabs] of groups.entries()) {
      groups.set(groupName, this.sortTabs(groupTabs, config));
    }

    return groups;
  }

  /**
   * Get tree item representation for an element
   */
  getTreeItem(element: TreeViewItem): vscode.TreeItem {
    const config = this.getConfig();

    if (isGroupItem(element)) {
      const treeItem = new vscode.TreeItem(element.name || 'Ungrouped', element.collapsibleState);
      if (element.name === 'Terminals') {
        treeItem.contextValue = 'terminalGroup';
        treeItem.iconPath = new vscode.ThemeIcon('terminal');
      } else {
        treeItem.contextValue = 'group';
        treeItem.iconPath = new vscode.ThemeIcon('folder');
      }
      treeItem.description = `(${element.tabs.length})`;
      return treeItem;
    }

    // TabItem
    const tab = element;
    const treeItem = new vscode.TreeItem(tab.label);
    const isFileTab = tab.tabKind === 'file' || tab.tabKind === 'diff';

    // Tab coloring (only for file-based tabs)
    if (isFileTab) {
      const tabColor = this.getEffectiveTabColor(tab, config);
      if (tabColor !== 'none') {
        const themeColorId = DocumentTabsProvider.themeColorByTabColor[tabColor];
        treeItem.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(themeColorId));
      }
    }

    // Set description (path) — only for file-based tabs
    if (config.showPath && tab.uri) {
      treeItem.description = getRelativePath(tab.uri);
    }

    // Set icon
    if (tab.tabKind === 'webview') {
      treeItem.iconPath = treeItem.iconPath ?? new vscode.ThemeIcon('globe');
    } else if (tab.tabKind === 'terminal') {
      treeItem.iconPath = treeItem.iconPath ?? new vscode.ThemeIcon('terminal');
    } else if (config.showFileIcons && tab.uri) {
      treeItem.resourceUri = tab.uri;
    } else {
      treeItem.iconPath = treeItem.iconPath ?? new vscode.ThemeIcon('file');
    }

    // Set dirty indicator
    if (config.showDirtyIndicator && tab.isDirty) {
      treeItem.label = `● ${tab.label}`;
    }

    // Set pinned indicator and context value
    if (tab.isPinned) {
      treeItem.contextValue = isFileTab ? 'pinnedTab' : 'pinnedNonFileTab';
      if (!tab.isDirty) {
        treeItem.label = `📌 ${tab.label}`;
      } else {
        treeItem.label = `📌 ● ${tab.label}`;
      }
    } else {
      treeItem.contextValue = isFileTab ? 'tab' : 'nonFileTab';
    }

    // Set command to open/activate the tab on click
    if (tab.tabKind === 'diff' && tab.tab.input instanceof vscode.TabInputTextDiff) {
      treeItem.command = {
        command: 'vscode.diff',
        title: 'Open Diff',
        arguments: [tab.tab.input.original, tab.tab.input.modified, tab.label]
      };
    } else if (tab.tabKind === 'webview' || tab.tabKind === 'terminal') {
      treeItem.command = {
        command: 'documentTabs.activateTab',
        title: 'Activate Tab',
        arguments: [tab]
      };
    } else if (tab.uri) {
      treeItem.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [tab.uri]
      };
    }

    // Set tooltip
    treeItem.tooltip = new vscode.MarkdownString();
    treeItem.tooltip.appendMarkdown(`**${tab.label}**\n\n`);
    if (tab.uri) {
      treeItem.tooltip.appendMarkdown(`Path: \`${tab.uri.fsPath}\`\n\n`);
    } else if (tab.viewType) {
      treeItem.tooltip.appendMarkdown(`Type: ${tab.viewType}\n\n`);
    }
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
      const signature = `${config.sortOrder}|${config.groupBy}|${
        config.showPinnedSeparately ? 1 : 0
      }|${config.collapseGroupsByDefault ? 1 : 0}`;
      if (this.cachedRootChildren && this.cachedRootChildrenSignature === signature) {
        return this.cachedRootChildren;
      }

      // Clear parent lookup map for rebuild
      this.parentLookupMap.clear();

      // Root level
      let tabs = this.getAllTabs();
      tabs = this.sortTabs(tabs, config);

      // Handle pinned tabs separately if configured
      if (config.showPinnedSeparately) {
        const pinnedTabs = tabs.filter((t) => t.isPinned);
        const unpinnedTabs = tabs.filter((t) => !t.isPinned);

        const result: TreeViewItem[] = [];

        if (pinnedTabs.length > 0) {
          const pinnedGroup: GroupItem = {
            type: 'group',
            name: '📌 Pinned',
            tabs: pinnedTabs,
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded
          };
          result.push(pinnedGroup);
          this.buildParentLookup(pinnedGroup);
        }

        if (config.groupBy === 'none') {
          // No grouping - return tabs directly (with pinned group if any)
          const rootChildren = [...result, ...unpinnedTabs];
          this.cachedRootChildren = rootChildren;
          this.cachedRootChildrenSignature = signature;
          return rootChildren;
        }

        // Group unpinned tabs (already sorted within groups)
        const groups = this.groupTabs(unpinnedTabs, config);
        const sortedGroupNames = Array.from(groups.keys()).sort();

        for (const groupName of sortedGroupNames) {
          const groupItem: GroupItem = {
            type: 'group',
            name: groupName || 'Other',
            tabs: groups.get(groupName)!,
            collapsibleState: config.collapseGroupsByDefault
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.Expanded
          };
          result.push(groupItem);
          this.buildParentLookup(groupItem);
        }

        this.cachedRootChildren = result;
        this.cachedRootChildrenSignature = signature;
        return result;
      }

      // No separate pinned handling
      if (config.groupBy === 'none') {
        this.cachedRootChildren = tabs;
        this.cachedRootChildrenSignature = signature;
        return tabs;
      }

      // Group all tabs (already sorted within groups)
      const groups = this.groupTabs(tabs, config);
      const sortedGroupNames = Array.from(groups.keys()).sort();

      const rootChildren = sortedGroupNames.map((groupName) => {
        const groupItem: GroupItem = {
          type: 'group' as const,
          name: groupName || 'Other',
          tabs: groups.get(groupName)!,
          collapsibleState: config.collapseGroupsByDefault
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.Expanded
        };
        this.buildParentLookup(groupItem);
        return groupItem;
      });

      this.cachedRootChildren = rootChildren;
      this.cachedRootChildrenSignature = signature;
      return rootChildren;
    }

    // Children of a group - tabs are already sorted
    if (isGroupItem(element)) {
      return element.tabs;
    }

    return [];
  }

  /**
   * Build parent lookup for a group's tabs
   */
  private buildParentLookup(groupItem: GroupItem): void {
    for (const tab of groupItem.tabs) {
      this.parentLookupMap.set(tab.tabKey, groupItem);
    }
  }

  /**
   * Get parent for tree view (required for reveal functionality)
   * Now uses memoized parent lookup map for O(1) performance
   */
  getParent(element: TreeViewItem): TreeViewItem | undefined {
    if (isTabItem(element)) {
      return this.parentLookupMap.get(element.tabKey);
    }
    return undefined;
  }

  /**
   * Find a tab item by URI.
   * Only searches the committed cache (what the tree view has rendered).
   * Returns undefined if the cache was invalidated and not yet rebuilt.
   */
  findTabByUri(uri: vscode.Uri): TabItem | undefined {
    const children = this.cachedRootChildren;
    if (!children) {
      return undefined;
    }
    const uriStr = uri.toString();
    for (const child of children) {
      if (isTabItem(child) && child.tabKind === 'file' && child.uri?.toString() === uriStr) {
        return child;
      }
      if (isGroupItem(child)) {
        const match = child.tabs.find((t) => t.tabKind === 'file' && t.uri?.toString() === uriStr);
        if (match) {
          return match;
        }
      }
    }
    return undefined;
  }

  /**
   * Find the TabItem matching the currently active VS Code tab.
   * Works for all tab kinds (file, diff, webview, terminal).
   * Only searches the committed cache to avoid returning stale objects
   * that the tree view framework doesn't know about yet.
   */
  findActiveTab(): TabItem | undefined {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!activeTab) {
      return undefined;
    }

    // Only search the committed cache — if invalidated, return undefined
    // so callers don't try to reveal an element the tree doesn't know about.
    const children = this.cachedRootChildren;
    if (!children) {
      return undefined;
    }

    const key = getTabKey(activeTab);
    for (const child of children) {
      if (isTabItem(child) && child.tabKey === key) {
        return child;
      }
      if (isGroupItem(child)) {
        const match = child.tabs.find((t) => t.tabKey === key);
        if (match) {
          return match;
        }
      }
    }
    return undefined;
  }

  /**
   * Get the flat ordered list of all tabs as displayed in the tree view.
   * This respects grouping and sorting configuration.
   */
  getOrderedTabs(): TabItem[] {
    const children = this.getChildren();
    const result: TabItem[] = [];

    for (const child of children) {
      if (isTabItem(child)) {
        result.push(child);
      } else if (isGroupItem(child)) {
        // Tabs are already sorted within groups by groupTabs()
        result.push(...child.tabs);
      }
    }

    return result;
  }
}
