import * as vscode from 'vscode';
import { DocumentTabsProvider } from './tabsProvider';
import { TreeViewItem, isTabItem, getTabUri } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Document Tabs extension is now active');

    // Create the tree data provider
    const tabsProvider = new DocumentTabsProvider(context);

    // Create the tree view
    const treeView = vscode.window.createTreeView('documentTabsView', {
        treeDataProvider: tabsProvider,
        showCollapseAll: true,
        canSelectMany: false
    });

    // Set tree view reference for badge updates
    tabsProvider.setTreeView(treeView);

    // Initial refresh
    tabsProvider.refresh();

    // Listen for tab changes
    const tabChangeListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
        // Track newly opened tabs
        if (event.opened.length > 0) {
            tabsProvider.trackNewTabs(event.opened);
        }

        // Remove closed tabs from tracking
        if (event.closed.length > 0) {
            tabsProvider.removeClosedTabs(event.closed);
        }

        tabsProvider.refresh();
    });

    // Listen for tab group changes
    const tabGroupChangeListener = vscode.window.tabGroups.onDidChangeTabGroups(() => {
        tabsProvider.refresh();
    });

    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('documentTabs')) {
            tabsProvider.refresh();
        }
    });

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('documentTabs.refresh', () => {
        tabsProvider.refresh();
    });

    const expandAllCommand = vscode.commands.registerCommand('documentTabs.expandAll', () => {
        tabsProvider.expandAll();
    });

    const openOptionsCommand = vscode.commands.registerCommand('documentTabs.openOptions', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'documentTabs');
    });

    // Sort commands
    const sortAlphabeticallyCommand = vscode.commands.registerCommand('documentTabs.sortAlphabetically', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'alphabetical', true);
    });

    const sortByRecentlyOpenedFirstCommand = vscode.commands.registerCommand('documentTabs.sortByRecentlyOpenedFirst', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'recentlyOpenedFirst', true);
    });

    const sortByRecentlyOpenedLastCommand = vscode.commands.registerCommand('documentTabs.sortByRecentlyOpenedLast', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'recentlyOpenedLast', true);
    });

    // Group commands
    const groupByNoneCommand = vscode.commands.registerCommand('documentTabs.groupByNone', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'none', true);
    });

    const groupByFolderCommand = vscode.commands.registerCommand('documentTabs.groupByFolder', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'folder', true);
    });

    const groupByExtensionCommand = vscode.commands.registerCommand('documentTabs.groupByExtension', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'extension', true);
    });

    const groupByProjectCommand = vscode.commands.registerCommand('documentTabs.groupByProject', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'project', true);
    });

    // Tab action commands
    const closeTabCommand = vscode.commands.registerCommand('documentTabs.closeTab', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await vscode.window.tabGroups.close(item.tab);
        }
    });

    const closeOtherTabsCommand = vscode.commands.registerCommand('documentTabs.closeOtherTabs', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            const allTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
            const tabsToClose = allTabs.filter(tab => {
                const uri = getTabUri(tab);
                return uri && uri.toString() !== item.uri.toString() && !tab.isPinned;
            });
            await vscode.window.tabGroups.close(tabsToClose);
        }
    });

    const closeTabsToTheRightCommand = vscode.commands.registerCommand('documentTabs.closeTabsToTheRight', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            // Find tabs to the right in the same tab group
            const tabGroup = vscode.window.tabGroups.all.find(group =>
                group.tabs.includes(item.tab)
            );
            if (tabGroup) {
                const tabIndex = tabGroup.tabs.indexOf(item.tab);
                const tabsToClose = tabGroup.tabs.slice(tabIndex + 1).filter(tab => !tab.isPinned);
                await vscode.window.tabGroups.close(tabsToClose);
            }
        }
    });

    const closeTabsInGroupCommand = vscode.commands.registerCommand('documentTabs.closeTabsInGroup', async (item: TreeViewItem) => {
        if (!isTabItem(item) && 'tabs' in item) {
            const tabsToClose = item.tabs.map(t => t.tab).filter(tab => !tab.isPinned);
            await vscode.window.tabGroups.close(tabsToClose);
        }
    });

    const closeAllTabsCommand = vscode.commands.registerCommand('documentTabs.closeAllTabs', async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    const pinTabCommand = vscode.commands.registerCommand('documentTabs.pinTab', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            // Open the file first to ensure it's active, then pin
            await vscode.window.showTextDocument(item.uri, { preview: false });
            await vscode.commands.executeCommand('workbench.action.pinEditor');
            tabsProvider.refresh();
        }
    });

    const unpinTabCommand = vscode.commands.registerCommand('documentTabs.unpinTab', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            // Open the file first to ensure it's active, then unpin
            await vscode.window.showTextDocument(item.uri, { preview: false });
            await vscode.commands.executeCommand('workbench.action.unpinEditor');
            tabsProvider.refresh();
        }
    });

    const copyPathCommand = vscode.commands.registerCommand('documentTabs.copyPath', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await vscode.env.clipboard.writeText(item.uri.fsPath);
            vscode.window.showInformationMessage('Path copied to clipboard');
        }
    });

    const copyRelativePathCommand = vscode.commands.registerCommand('documentTabs.copyRelativePath', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            const relativePath = vscode.workspace.asRelativePath(item.uri);
            await vscode.env.clipboard.writeText(relativePath);
            vscode.window.showInformationMessage('Relative path copied to clipboard');
        }
    });

    const revealInExplorerCommand = vscode.commands.registerCommand('documentTabs.revealInExplorer', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await vscode.commands.executeCommand('revealInExplorer', item.uri);
        }
    });

    const openToSideCommand = vscode.commands.registerCommand('documentTabs.openToSide', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await vscode.window.showTextDocument(item.uri, { viewColumn: vscode.ViewColumn.Beside });
        }
    });

    // Add all subscriptions to context
    context.subscriptions.push(
        treeView,
        tabChangeListener,
        tabGroupChangeListener,
        configChangeListener,
        refreshCommand,
        expandAllCommand,
        openOptionsCommand,
        sortAlphabeticallyCommand,
        sortByRecentlyOpenedFirstCommand,
        sortByRecentlyOpenedLastCommand,
        groupByNoneCommand,
        groupByFolderCommand,
        groupByExtensionCommand,
        groupByProjectCommand,
        closeTabCommand,
        closeOtherTabsCommand,
        closeTabsToTheRightCommand,
        closeTabsInGroupCommand,
        closeAllTabsCommand,
        pinTabCommand,
        unpinTabCommand,
        copyPathCommand,
        copyRelativePathCommand,
        revealInExplorerCommand,
        openToSideCommand
    );
}

export function deactivate() {
    console.log('Document Tabs extension is now deactivated');
}
