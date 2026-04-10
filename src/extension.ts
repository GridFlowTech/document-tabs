import * as vscode from 'vscode';
import { DocumentTabsProvider } from './tabsProvider';
import { TreeViewItem, TabItem, isTabItem, isGroupItem } from './types';

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
    canSelectMany: true,
    dragAndDropController: tabsProvider
  });

  // Set tree view reference for badge updates
  tabsProvider.setTreeView(treeView);

  // Initial refresh
  tabsProvider.refresh();

  // Debounced reveal — coalesces rapid-fire calls and gives the tree view
  // framework time to finish processing getChildren() / getTreeItem() before
  // we attempt to reveal an element.
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRevealActiveTab = () => {
    if (revealTimer !== undefined) {
      clearTimeout(revealTimer);
    }
    revealTimer = setTimeout(async () => {
      revealTimer = undefined;
      if (!treeView.visible) {
        return;
      }
      const tabItem = tabsProvider.findActiveTab();
      if (!tabItem) {
        return;
      }
      try {
        await treeView.reveal(tabItem, { select: true, focus: false, expand: true });
      } catch {
        // Tree view not ready yet — silently ignore
      }
    }, 150);
  };

  // Reveal active tab when tree view becomes visible
  const visibilityChangeListener = treeView.onDidChangeVisibility((e) => {
    if (e.visible) {
      scheduleRevealActiveTab();
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
  const activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      scheduleRevealActiveTab();
    }
  });

  // Also listen for generic tab activation (covers webview/terminal tabs
  // which don't trigger onDidChangeActiveTextEditor)
  const activeTabChangeListener = vscode.window.tabGroups.onDidChangeTabs((event) => {
    if (event.changed.length > 0) {
      // A tab changed (possibly became active) — try to reveal it
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (activeTab && !activeTab.input) {
        scheduleRevealActiveTab();
      } else if (activeTab) {
        const input = activeTab.input;
        const isTextBased =
          input instanceof vscode.TabInputText ||
          input instanceof vscode.TabInputTextDiff ||
          input instanceof vscode.TabInputNotebook ||
          input instanceof vscode.TabInputNotebookDiff ||
          input instanceof vscode.TabInputCustom;
        if (!isTextBased) {
          scheduleRevealActiveTab();
        }
      }
    }
  });

  // When user clicks dead space in the tree view, the selection empties.
  // Re-select the active file so the highlight is preserved.
  const selectionChangeListener = treeView.onDidChangeSelection((e) => {
    if (e.selection.length === 0) {
      scheduleRevealActiveTab();
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
              return tab !== item.tab && !tab.isPinned;
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

  const focusTab = async (item: TabItem): Promise<void> => {
    if (item.tabKind === 'file' && item.uri) {
      await vscode.window.showTextDocument(item.uri, { preview: false });
    } else {
      const group = item.tab.group;
      const index = group.tabs.indexOf(item.tab);
      const focusCommands: Record<number, string> = {
        1: 'workbench.action.focusFirstEditorGroup',
        2: 'workbench.action.focusSecondEditorGroup',
        3: 'workbench.action.focusThirdEditorGroup',
        4: 'workbench.action.focusFourthEditorGroup',
        5: 'workbench.action.focusFifthEditorGroup'
      };
      const col = group.viewColumn;
      if (col !== undefined && focusCommands[col]) {
        await vscode.commands.executeCommand(focusCommands[col]);
      }
      if (index >= 0) {
        await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', index);
      }
    }
  };

  const pinTabCommand = vscode.commands.registerCommand('documentTabs.pinTab', async (item: TreeViewItem) => {
    if (isTabItem(item)) {
      try {
        await focusTab(item);
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
          await focusTab(item);
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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
      if (isTabItem(item) && item.uri) {
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

      const activeTab = tabsProvider.findActiveTab();
      let nextIndex = 0;

      if (activeTab) {
        const currentIndex = orderedTabs.findIndex((t) => t.tabKey === activeTab.tabKey);
        if (currentIndex !== -1) {
          nextIndex = (currentIndex + 1) % orderedTabs.length;
        }
      }

      const target = orderedTabs[nextIndex];
      if (target?.uri) {
        await vscode.window.showTextDocument(target.uri, { preview: false });
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

      const activeTab = tabsProvider.findActiveTab();
      let prevIndex = orderedTabs.length - 1;

      if (activeTab) {
        const currentIndex = orderedTabs.findIndex((t) => t.tabKey === activeTab.tabKey);
        if (currentIndex !== -1) {
          prevIndex = (currentIndex - 1 + orderedTabs.length) % orderedTabs.length;
        }
      }

      const target = orderedTabs[prevIndex];
      if (target?.uri) {
        await vscode.window.showTextDocument(target.uri, { preview: false });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to navigate to previous tab: ${error}`);
    }
  });

  // Activate a non-file tab (webview, terminal) by focusing its editor group
  // and navigating to it by index — works for ALL tab types generically.
  const activateTabCommand = vscode.commands.registerCommand(
    'documentTabs.activateTab',
    async (item: TabItem) => {
      try {
        const vsTab = item.tab;
        const group = vsTab.group;
        const index = group.tabs.indexOf(vsTab);

        // Focus the correct editor group by view column
        const focusCommands: Record<number, string> = {
          1: 'workbench.action.focusFirstEditorGroup',
          2: 'workbench.action.focusSecondEditorGroup',
          3: 'workbench.action.focusThirdEditorGroup',
          4: 'workbench.action.focusFourthEditorGroup',
          5: 'workbench.action.focusFifthEditorGroup'
        };
        const col = group.viewColumn;
        if (col !== undefined && focusCommands[col]) {
          await vscode.commands.executeCommand(focusCommands[col]);
        }

        // Navigate to the tab by its 1-based index within the group
        if (index >= 0) {
          await vscode.commands.executeCommand('workbench.action.openEditorAtIndex', index);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate tab: ${error}`);
      }
    }
  );

  const newTerminalCommand = vscode.commands.registerCommand('documentTabs.newTerminal', async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.createTerminalEditor');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create terminal: ${error}`);
    }
  });

  const compareSelectedCommand = vscode.commands.registerCommand(
    'documentTabs.compareSelected',
    async (item: TreeViewItem, selectedItems: TreeViewItem[]) => {
      try {
        const items = selectedItems ?? (item ? [item] : []);
        const fileItems = items.filter((i): i is TabItem => isTabItem(i) && !!i.uri);
        if (fileItems.length !== 2) {
          vscode.window.showWarningMessage('Select exactly 2 file tabs to compare.');
          return;
        }
        const [left, right] = fileItems;
        const title = `${left.label} ↔ ${right.label}`;
        await vscode.commands.executeCommand('vscode.diff', left.uri, right.uri, title);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to compare files: ${error}`);
      }
    }
  );

  // Push all subscriptions to context
  context.subscriptions.push(
    treeView,
    tabChangeListener,
    tabGroupChangeListener,
    visibilityChangeListener,
    activeEditorChangeListener,
    activeTabChangeListener,
    selectionChangeListener,
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
    previousTabCommand,
    activateTabCommand,
    compareSelectedCommand,
    newTerminalCommand
  );
}

export function deactivate() {
  console.log('Document Tabs extension is now deactivated');
}
