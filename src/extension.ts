import * as vscode from 'vscode';
import { DocumentTabsProvider } from './tabsProvider';
import { TreeViewItem, isTabItem, getTabUri } from './types';

/**
 * Updates the context keys for sort and group settings.
 * These context keys are used by 'when' clauses in package.json menus
 * to conditionally show either the checked or unchecked version of menu items,
 * providing visual feedback for the currently selected options.
 */
function updateContextKeys() {
    const config = vscode.workspace.getConfiguration('documentTabs');
    const sortOrder = config.get<string>('sortOrder', 'alphabetical');
    const groupBy = config.get<string>('groupBy', 'none');
    const colorBy = config.get<string>('colorBy', 'none');

    // Set context keys for menu checkmarks
    vscode.commands.executeCommand('setContext', 'documentTabs.sortOrder', sortOrder);
    vscode.commands.executeCommand('setContext', 'documentTabs.groupBy', groupBy);
    vscode.commands.executeCommand('setContext', 'documentTabs.colorBy', colorBy);
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Document Tabs extension is now active');

    // Set initial context keys for menu checkmarks
    updateContextKeys();

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

    // Helper function to reveal active file in tree view
    const revealActiveFile = async (uri: vscode.Uri) => {
        if (treeView.visible) {
            const tabItem = tabsProvider.findTabByUri(uri);
            if (tabItem) {
                try {
                    await treeView.reveal(tabItem, { select: true, focus: false, expand: true });
                } catch {
                    // Ignore errors if element can't be revealed
                }
            }
        }
    };

    // Reveal currently active file when tree view becomes visible
    let hasRevealedOnStartup = false;
    const visibilityChangeListener = treeView.onDidChangeVisibility(async (e) => {
        if (e.visible && !hasRevealedOnStartup) {
            hasRevealedOnStartup = true;
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                await revealActiveFile(activeEditor.document.uri);
            }
        }
    });

    // Coalesce multiple refresh triggers that can fire back-to-back
    let refreshPending = false;
    const scheduleRefresh = () => {
        if (refreshPending) {
            return;
        }
        refreshPending = true;
        setTimeout(() => {
            refreshPending = false;
            tabsProvider.refresh();
        }, 0);
    };

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

        scheduleRefresh();
    });

    // Listen for tab group changes
    const tabGroupChangeListener = vscode.window.tabGroups.onDidChangeTabGroups(() => {
        scheduleRefresh();
    });

    // Listen for active editor changes to sync with main window selection
    const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor) {
            await revealActiveFile(editor.document.uri);
        }
    });

    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('documentTabs')) {
            // Update context keys for menu checkmarks
            updateContextKeys();
            scheduleRefresh();
        }
    });

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('documentTabs.refresh', () => {
        scheduleRefresh();
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
    const sortAlphabeticallyCheckedCommand = vscode.commands.registerCommand('documentTabs.sortAlphabetically.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'alphabetical', true);
    });

    const sortByRecentlyOpenedFirstCommand = vscode.commands.registerCommand('documentTabs.sortByRecentlyOpenedFirst', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'recentlyOpenedFirst', true);
    });
    const sortByRecentlyOpenedFirstCheckedCommand = vscode.commands.registerCommand('documentTabs.sortByRecentlyOpenedFirst.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'recentlyOpenedFirst', true);
    });

    const sortByRecentlyOpenedLastCommand = vscode.commands.registerCommand('documentTabs.sortByRecentlyOpenedLast', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'recentlyOpenedLast', true);
    });
    const sortByRecentlyOpenedLastCheckedCommand = vscode.commands.registerCommand('documentTabs.sortByRecentlyOpenedLast.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'recentlyOpenedLast', true);
    });

    // Group commands
    const groupByNoneCommand = vscode.commands.registerCommand('documentTabs.groupByNone', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'none', true);
    });
    const groupByNoneCheckedCommand = vscode.commands.registerCommand('documentTabs.groupByNone.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'none', true);
    });

    const groupByFolderCommand = vscode.commands.registerCommand('documentTabs.groupByFolder', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'folder', true);
    });
    const groupByFolderCheckedCommand = vscode.commands.registerCommand('documentTabs.groupByFolder.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'folder', true);
    });

    const groupByExtensionCommand = vscode.commands.registerCommand('documentTabs.groupByExtension', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'extension', true);
    });
    const groupByExtensionCheckedCommand = vscode.commands.registerCommand('documentTabs.groupByExtension.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'extension', true);
    });

    const groupByProjectCommand = vscode.commands.registerCommand('documentTabs.groupByProject', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'project', true);
    });
    const groupByProjectCheckedCommand = vscode.commands.registerCommand('documentTabs.groupByProject.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'project', true);
    });

    // Color-by commands
    const colorByNoneCommand = vscode.commands.registerCommand('documentTabs.colorByNone', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'none', true);
    });
    const colorByNoneCheckedCommand = vscode.commands.registerCommand('documentTabs.colorByNone.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'none', true);
    });

    const colorByProjectCommand = vscode.commands.registerCommand('documentTabs.colorByProject', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'project', true);
    });
    const colorByProjectCheckedCommand = vscode.commands.registerCommand('documentTabs.colorByProject.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'project', true);
    });

    const colorByExtensionCommand = vscode.commands.registerCommand('documentTabs.colorByExtension', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'extension', true);
    });
    const colorByExtensionCheckedCommand = vscode.commands.registerCommand('documentTabs.colorByExtension.checked', async () => {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'extension', true);
    });

    // Manual Set Tab Color commands (applies to Document Tabs view items)
    const setTabColorNoneCommand = vscode.commands.registerCommand('documentTabs.setTabColor.none', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.clearManualTabColor(item.uri);
        }
    });
    const setTabColorLavenderCommand = vscode.commands.registerCommand('documentTabs.setTabColor.lavender', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'lavender');
        }
    });
    const setTabColorGoldCommand = vscode.commands.registerCommand('documentTabs.setTabColor.gold', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'gold');
        }
    });
    const setTabColorCyanCommand = vscode.commands.registerCommand('documentTabs.setTabColor.cyan', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'cyan');
        }
    });
    const setTabColorBurgundyCommand = vscode.commands.registerCommand('documentTabs.setTabColor.burgundy', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'burgundy');
        }
    });
    const setTabColorGreenCommand = vscode.commands.registerCommand('documentTabs.setTabColor.green', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'green');
        }
    });
    const setTabColorBrownCommand = vscode.commands.registerCommand('documentTabs.setTabColor.brown', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'brown');
        }
    });
    const setTabColorRoyalBlueCommand = vscode.commands.registerCommand('documentTabs.setTabColor.royalBlue', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'royalBlue');
        }
    });
    const setTabColorPumpkinCommand = vscode.commands.registerCommand('documentTabs.setTabColor.pumpkin', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'pumpkin');
        }
    });
    const setTabColorGrayCommand = vscode.commands.registerCommand('documentTabs.setTabColor.gray', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'gray');
        }
    });
    const setTabColorVoltCommand = vscode.commands.registerCommand('documentTabs.setTabColor.volt', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'volt');
        }
    });
    const setTabColorTealCommand = vscode.commands.registerCommand('documentTabs.setTabColor.teal', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'teal');
        }
    });
    const setTabColorMagentaCommand = vscode.commands.registerCommand('documentTabs.setTabColor.magenta', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'magenta');
        }
    });
    const setTabColorMintCommand = vscode.commands.registerCommand('documentTabs.setTabColor.mint', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'mint');
        }
    });
    const setTabColorDarkBrownCommand = vscode.commands.registerCommand('documentTabs.setTabColor.darkBrown', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'darkBrown');
        }
    });
    const setTabColorBlueCommand = vscode.commands.registerCommand('documentTabs.setTabColor.blue', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'blue');
        }
    });
    const setTabColorPinkCommand = vscode.commands.registerCommand('documentTabs.setTabColor.pink', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            await tabsProvider.setManualTabColorByName(item.uri, 'pink');
        }
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
            scheduleRefresh();
        }
    });

    const unpinTabCommand = vscode.commands.registerCommand('documentTabs.unpinTab', async (item: TreeViewItem) => {
        if (isTabItem(item)) {
            // Open the file first to ensure it's active, then unpin
            await vscode.window.showTextDocument(item.uri, { preview: false });
            await vscode.commands.executeCommand('workbench.action.unpinEditor');
            scheduleRefresh();
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

    // Navigation commands - switch tabs in the Document Tabs order
    const nextTabCommand = vscode.commands.registerCommand('documentTabs.nextTab', async () => {
        const orderedTabs = tabsProvider.getOrderedTabs();
        if (orderedTabs.length === 0) {
            return;
        }

        const activeUri = vscode.window.activeTextEditor?.document.uri;
        let nextIndex = 0;

        if (activeUri) {
            const currentIndex = orderedTabs.findIndex(t => t.uri.toString() === activeUri.toString());
            if (currentIndex !== -1) {
                nextIndex = (currentIndex + 1) % orderedTabs.length;
            }
        }

        const nextTab = orderedTabs[nextIndex];
        if (nextTab) {
            await vscode.window.showTextDocument(nextTab.uri, { preview: false });
        }
    });

    const previousTabCommand = vscode.commands.registerCommand('documentTabs.previousTab', async () => {
        const orderedTabs = tabsProvider.getOrderedTabs();
        if (orderedTabs.length === 0) {
            return;
        }

        const activeUri = vscode.window.activeTextEditor?.document.uri;
        let prevIndex = orderedTabs.length - 1;

        if (activeUri) {
            const currentIndex = orderedTabs.findIndex(t => t.uri.toString() === activeUri.toString());
            if (currentIndex !== -1) {
                prevIndex = (currentIndex - 1 + orderedTabs.length) % orderedTabs.length;
            }
        }

        const prevTab = orderedTabs[prevIndex];
        if (prevTab) {
            await vscode.window.showTextDocument(prevTab.uri, { preview: false });
        }
    });

    // Add all subscriptions to context
    context.subscriptions.push(
        treeView,
        tabChangeListener,
        tabGroupChangeListener,
        visibilityChangeListener,
        activeEditorChangeListener,
        configChangeListener,
        refreshCommand,
        expandAllCommand,
        openOptionsCommand,
        sortAlphabeticallyCommand,
        sortAlphabeticallyCheckedCommand,
        sortByRecentlyOpenedFirstCommand,
        sortByRecentlyOpenedFirstCheckedCommand,
        sortByRecentlyOpenedLastCommand,
        sortByRecentlyOpenedLastCheckedCommand,
        groupByNoneCommand,
        groupByNoneCheckedCommand,
        groupByFolderCommand,
        groupByFolderCheckedCommand,
        groupByExtensionCommand,
        groupByExtensionCheckedCommand,
        groupByProjectCommand,
        groupByProjectCheckedCommand,
        colorByNoneCommand,
        colorByNoneCheckedCommand,
        colorByProjectCommand,
        colorByProjectCheckedCommand,
        colorByExtensionCommand,
        colorByExtensionCheckedCommand,
        setTabColorNoneCommand,
        setTabColorLavenderCommand,
        setTabColorGoldCommand,
        setTabColorCyanCommand,
        setTabColorBurgundyCommand,
        setTabColorGreenCommand,
        setTabColorBrownCommand,
        setTabColorRoyalBlueCommand,
        setTabColorPumpkinCommand,
        setTabColorGrayCommand,
        setTabColorVoltCommand,
        setTabColorTealCommand,
        setTabColorMagentaCommand,
        setTabColorMintCommand,
        setTabColorDarkBrownCommand,
        setTabColorBlueCommand,
        setTabColorPinkCommand,
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
        openToSideCommand,
        nextTabCommand,
        previousTabCommand
    );
}

export function deactivate() {
    console.log('Document Tabs extension is now deactivated');
}
