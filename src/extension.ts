import * as vscode from 'vscode';
import { DocumentTabsProvider } from './tabsProvider';
import { TreeViewItem, isTabItem, isGroupItem, getTabUri } from './types';

/**
 * Updates the context keys for sort and group settings.
 * These context keys are used by 'when' clauses in package.json menus
 * to conditionally show either the checked or unchecked version of menu items,
 * providing visual feedback for the currently selected options.
 */
async function updateContextKeys() {
  try {
    const config = vscode.workspace.getConfiguration('documentTabs');

    // Set context keys for menu checkmarks
    await vscode.commands.executeCommand(
      'setContext',
      'documentTabs.sortOrder',
      config.get<string>('sortOrder', 'alphabetical')
    );
    await vscode.commands.executeCommand(
      'setContext',
      'documentTabs.groupBy',
      config.get<string>('groupBy', 'none')
    );
    await vscode.commands.executeCommand(
      'setContext',
      'documentTabs.colorBy',
      config.get<string>('colorBy', 'none')
    );
  } catch (error) {
    console.error('DocumentTabs: Failed to update context keys:', error);
  }
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
        } catch (error) {
          console.error('DocumentTabs: Failed to reveal tab:', error);
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

  // Add all subscriptions to context
  const refreshCommand = vscode.commands.registerCommand('documentTabs.refresh', () => {
    scheduleRefresh();
  });

  const expandAllCommand = vscode.commands.registerCommand('documentTabs.expandAll', async () => {
    try {
      await tabsProvider.expandAll();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to expand all: ${error}`);
    }
  });

  const openOptionsCommand = vscode.commands.registerCommand('documentTabs.openOptions', async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'documentTabs');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open settings: ${error}`);
    }
  });

  const sortAlphabeticallyCommand = vscode.commands.registerCommand(
    'documentTabs.sortAlphabetically',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'alphabetical', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update sort order: ${error}`);
      }
    }
  );

  const sortAlphabeticallyCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.sortAlphabetically.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('sortOrder', 'alphabetical', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update sort order: ${error}`);
      }
    }
  );

  const sortByRecentlyOpenedFirstCommand = vscode.commands.registerCommand(
    'documentTabs.sortByRecentlyOpenedFirst',
    async () => {
      try {
        await vscode.workspace
          .getConfiguration('documentTabs')
          .update('sortOrder', 'recentlyOpenedFirst', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update sort order: ${error}`);
      }
    }
  );

  const sortByRecentlyOpenedFirstCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.sortByRecentlyOpenedFirst.checked',
    async () => {
      try {
        await vscode.workspace
          .getConfiguration('documentTabs')
          .update('sortOrder', 'recentlyOpenedFirst', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update sort order: ${error}`);
      }
    }
  );

  const sortByRecentlyOpenedLastCommand = vscode.commands.registerCommand(
    'documentTabs.sortByRecentlyOpenedLast',
    async () => {
      try {
        await vscode.workspace
          .getConfiguration('documentTabs')
          .update('sortOrder', 'recentlyOpenedLast', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update sort order: ${error}`);
      }
    }
  );

  const sortByRecentlyOpenedLastCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.sortByRecentlyOpenedLast.checked',
    async () => {
      try {
        await vscode.workspace
          .getConfiguration('documentTabs')
          .update('sortOrder', 'recentlyOpenedLast', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update sort order: ${error}`);
      }
    }
  );

  const groupByNoneCommand = vscode.commands.registerCommand('documentTabs.groupByNone', async () => {
    try {
      await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'none', true);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
    }
  });

  const groupByNoneCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.groupByNone.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'none', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
      }
    }
  );

  const groupByFolderCommand = vscode.commands.registerCommand('documentTabs.groupByFolder', async () => {
    try {
      await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'folder', true);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
    }
  });

  const groupByFolderCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.groupByFolder.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'folder', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
      }
    }
  );

  const groupByExtensionCommand = vscode.commands.registerCommand(
    'documentTabs.groupByExtension',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'extension', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
      }
    }
  );

  const groupByExtensionCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.groupByExtension.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'extension', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
      }
    }
  );

  const groupByProjectCommand = vscode.commands.registerCommand('documentTabs.groupByProject', async () => {
    try {
      await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'project', true);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
    }
  });

  const groupByProjectCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.groupByProject.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('groupBy', 'project', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update grouping: ${error}`);
      }
    }
  );

  const colorByNoneCommand = vscode.commands.registerCommand('documentTabs.colorByNone', async () => {
    try {
      await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'none', true);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update color scheme: ${error}`);
    }
  });

  const colorByNoneCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.colorByNone.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'none', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update color scheme: ${error}`);
      }
    }
  );

  const colorByProjectCommand = vscode.commands.registerCommand('documentTabs.colorByProject', async () => {
    try {
      await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'project', true);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update color scheme: ${error}`);
    }
  });

  const colorByProjectCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.colorByProject.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'project', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update color scheme: ${error}`);
      }
    }
  );

  const colorByExtensionCommand = vscode.commands.registerCommand(
    'documentTabs.colorByExtension',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'extension', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update color scheme: ${error}`);
      }
    }
  );

  const colorByExtensionCheckedCommand = vscode.commands.registerCommand(
    'documentTabs.colorByExtension.checked',
    async () => {
      try {
        await vscode.workspace.getConfiguration('documentTabs').update('colorBy', 'extension', true);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update color scheme: ${error}`);
      }
    }
  );

  const setTabColorNoneCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.none',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.clearManualTabColor(item.uri);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorLavenderCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.lavender',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'lavender');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorGoldCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.gold',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'gold');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorCyanCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.cyan',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'cyan');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorBurgundyCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.burgundy',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'burgundy');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorGreenCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.green',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'green');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorBrownCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.brown',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'brown');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorRoyalBlueCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.royalBlue',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'royalBlue');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorPumpkinCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.pumpkin',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'pumpkin');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorGrayCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.gray',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'gray');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorVoltCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.volt',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'volt');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorTealCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.teal',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'teal');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorMagentaCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.magenta',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'magenta');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorMintCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.mint',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'mint');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorDarkBrownCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.darkBrown',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'darkBrown');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorBlueCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.blue',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'blue');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const setTabColorPinkCommand = vscode.commands.registerCommand(
    'documentTabs.setTabColor.pink',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await tabsProvider.setManualTabColorByName(item.uri, 'pink');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to set tab color: ${error}`);
        }
      }
    }
  );

  const closeTabCommand = vscode.commands.registerCommand(
    'documentTabs.closeTab',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await vscode.window.tabGroups.close(item.tab);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to close tab: ${error}`);
        }
      }
    }
  );

  const closeOtherTabsCommand = vscode.commands.registerCommand(
    'documentTabs.closeOtherTabs',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          const tabsToClose = vscode.window.tabGroups.all
            .flatMap((group) => group.tabs)
            .filter((tab) => {
              const uri = getTabUri(tab);
              return uri && uri.toString() !== item.uri.toString() && !tab.isPinned;
            });
          await vscode.window.tabGroups.close(tabsToClose);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to close tabs: ${error}`);
        }
      }
    }
  );

  const closeTabsToTheRightCommand = vscode.commands.registerCommand(
    'documentTabs.closeTabsToTheRight',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          const tabGroup = vscode.window.tabGroups.all.find((group) => group.tabs.includes(item.tab));
          if (tabGroup) {
            const tabsToClose = tabGroup.tabs
              .slice(tabGroup.tabs.indexOf(item.tab) + 1)
              .filter((tab) => !tab.isPinned);
            await vscode.window.tabGroups.close(tabsToClose);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to close tabs: ${error}`);
        }
      }
    }
  );

  const closeTabsInGroupCommand = vscode.commands.registerCommand(
    'documentTabs.closeTabsInGroup',
    async (item: TreeViewItem) => {
      if (isGroupItem(item)) {
        try {
          const tabsToClose = item.tabs.map((t) => t.tab).filter((tab) => !tab.isPinned);
          await vscode.window.tabGroups.close(tabsToClose);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to close tabs in group: ${error}`);
        }
      }
    }
  );

  const closeAllTabsCommand = vscode.commands.registerCommand('documentTabs.closeAllTabs', async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to close all tabs: ${error}`);
    }
  });

  const pinTabCommand = vscode.commands.registerCommand('documentTabs.pinTab', async (item: TreeViewItem) => {
    if (isTabItem(item)) {
      try {
        await vscode.window.showTextDocument(item.uri, { preview: false });
        await vscode.commands.executeCommand('workbench.action.pinEditor');
        scheduleRefresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to pin tab: ${error}`);
      }
    }
  });

  const unpinTabCommand = vscode.commands.registerCommand(
    'documentTabs.unpinTab',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await vscode.window.showTextDocument(item.uri, { preview: false });
          await vscode.commands.executeCommand('workbench.action.unpinEditor');
          scheduleRefresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to unpin tab: ${error}`);
        }
      }
    }
  );

  const copyPathCommand = vscode.commands.registerCommand(
    'documentTabs.copyPath',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await vscode.env.clipboard.writeText(item.uri.fsPath);
          vscode.window.showInformationMessage('Path copied to clipboard');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to copy path: ${error}`);
        }
      }
    }
  );

  const copyRelativePathCommand = vscode.commands.registerCommand(
    'documentTabs.copyRelativePath',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await vscode.env.clipboard.writeText(vscode.workspace.asRelativePath(item.uri));
          vscode.window.showInformationMessage('Relative path copied to clipboard');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to copy relative path: ${error}`);
        }
      }
    }
  );

  const revealInExplorerCommand = vscode.commands.registerCommand(
    'documentTabs.revealInExplorer',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await vscode.commands.executeCommand('revealInExplorer', item.uri);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to reveal in explorer: ${error}`);
        }
      }
    }
  );

  const openToSideCommand = vscode.commands.registerCommand(
    'documentTabs.openToSide',
    async (item: TreeViewItem) => {
      if (isTabItem(item)) {
        try {
          await vscode.window.showTextDocument(item.uri, { viewColumn: vscode.ViewColumn.Beside });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open to side: ${error}`);
        }
      }
    }
  );

  const nextTabCommand = vscode.commands.registerCommand('documentTabs.nextTab', async () => {
    try {
      const orderedTabs = tabsProvider.getOrderedTabs();
      if (orderedTabs.length === 0) {
        return;
      }

      const activeUri = vscode.window.activeTextEditor?.document.uri;
      let nextIndex = 0;

      if (activeUri) {
        const currentIndex = orderedTabs.findIndex((t) => t.uri.toString() === activeUri.toString());
        if (currentIndex !== -1) {
          nextIndex = (currentIndex + 1) % orderedTabs.length;
        }
      }

      if (orderedTabs[nextIndex]) {
        await vscode.window.showTextDocument(orderedTabs[nextIndex].uri, { preview: false });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to navigate to next tab: ${error}`);
    }
  });

  const previousTabCommand = vscode.commands.registerCommand('documentTabs.previousTab', async () => {
    try {
      const orderedTabs = tabsProvider.getOrderedTabs();
      if (orderedTabs.length === 0) {
        return;
      }

      const activeUri = vscode.window.activeTextEditor?.document.uri;
      let prevIndex = orderedTabs.length - 1;

      if (activeUri) {
        const currentIndex = orderedTabs.findIndex((t) => t.uri.toString() === activeUri.toString());
        if (currentIndex !== -1) {
          prevIndex = (currentIndex - 1 + orderedTabs.length) % orderedTabs.length;
        }
      }

      if (orderedTabs[prevIndex]) {
        await vscode.window.showTextDocument(orderedTabs[prevIndex].uri, { preview: false });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to navigate to previous tab: ${error}`);
    }
  });

  // Push all subscriptions to context
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
