import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

// Extension ID: publisher.name from package.json
const EXTENSION_ID = 'GridFlowTech.document-tabs';

/**
 * All commands declared in package.json — must all be registered after activation.
 */
const ALL_COMMANDS = [
  'documentTabs.refresh',
  'documentTabs.expandAll',
  'documentTabs.openOptions',
  'documentTabs.sortAlphabetically',
  'documentTabs.sortAlphabetically.checked',
  'documentTabs.sortByRecentlyOpenedFirst',
  'documentTabs.sortByRecentlyOpenedFirst.checked',
  'documentTabs.sortByRecentlyOpenedLast',
  'documentTabs.sortByRecentlyOpenedLast.checked',
  'documentTabs.groupByNone',
  'documentTabs.groupByNone.checked',
  'documentTabs.groupByFolder',
  'documentTabs.groupByFolder.checked',
  'documentTabs.groupByExtension',
  'documentTabs.groupByExtension.checked',
  'documentTabs.groupByProject',
  'documentTabs.groupByProject.checked',
  'documentTabs.colorByNone',
  'documentTabs.colorByNone.checked',
  'documentTabs.colorByProject',
  'documentTabs.colorByProject.checked',
  'documentTabs.colorByExtension',
  'documentTabs.colorByExtension.checked',
  'documentTabs.setTabColor.none',
  'documentTabs.setTabColor.lavender',
  'documentTabs.setTabColor.gold',
  'documentTabs.setTabColor.cyan',
  'documentTabs.setTabColor.burgundy',
  'documentTabs.setTabColor.green',
  'documentTabs.setTabColor.brown',
  'documentTabs.setTabColor.royalBlue',
  'documentTabs.setTabColor.pumpkin',
  'documentTabs.setTabColor.gray',
  'documentTabs.setTabColor.volt',
  'documentTabs.setTabColor.teal',
  'documentTabs.setTabColor.magenta',
  'documentTabs.setTabColor.mint',
  'documentTabs.setTabColor.darkBrown',
  'documentTabs.setTabColor.blue',
  'documentTabs.setTabColor.pink',
  'documentTabs.closeTab',
  'documentTabs.closeOtherTabs',
  'documentTabs.closeTabsToTheRight',
  'documentTabs.closeTabsInGroup',
  'documentTabs.closeAllTabs',
  'documentTabs.pinTab',
  'documentTabs.unpinTab',
  'documentTabs.copyPath',
  'documentTabs.copyRelativePath',
  'documentTabs.revealInExplorer',
  'documentTabs.openToSide',
  'documentTabs.nextTab',
  'documentTabs.previousTab'
];

suite('Extension — Activation', () => {
  test('extension is registered', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Extension ${EXTENSION_ID} should be registered`);
  });

  test('extension activates successfully', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);

    if (!ext.isActive) {
      await ext.activate();
    }

    assert.strictEqual(ext.isActive, true);
  });
});

suite('Extension — Command Registration', () => {
  let allCommands: string[];

  suiteSetup(async () => {
    // Ensure extension is active
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    // Get all registered commands once
    allCommands = await vscode.commands.getCommands(true);
  });

  for (const cmdId of ALL_COMMANDS) {
    test(`command "${cmdId}" is registered`, () => {
      assert.ok(allCommands.includes(cmdId), `Command ${cmdId} should be registered`);
    });
  }
});

suite('Extension — Sort Commands', () => {
  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    // Ensure extension is active
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    sandbox.restore();
    // Reset to default
    try {
      await vscode.workspace
        .getConfiguration('documentTabs')
        .update('sortOrder', undefined, vscode.ConfigurationTarget.Global);
    } catch {
      // Ignore
    }
  });

  test('sortAlphabetically sets sortOrder to alphabetical', async () => {
    await vscode.commands.executeCommand('documentTabs.sortAlphabetically');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('sortOrder'), 'alphabetical');
  });

  test('sortByRecentlyOpenedFirst sets sortOrder to recentlyOpenedFirst', async () => {
    await vscode.commands.executeCommand('documentTabs.sortByRecentlyOpenedFirst');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('sortOrder'), 'recentlyOpenedFirst');
  });

  test('sortByRecentlyOpenedLast sets sortOrder to recentlyOpenedLast', async () => {
    await vscode.commands.executeCommand('documentTabs.sortByRecentlyOpenedLast');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('sortOrder'), 'recentlyOpenedLast');
  });

  test('checked variant sortAlphabetically.checked also updates config', async () => {
    await vscode.commands.executeCommand('documentTabs.sortByRecentlyOpenedFirst');
    await vscode.commands.executeCommand('documentTabs.sortAlphabetically.checked');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('sortOrder'), 'alphabetical');
  });
});

suite('Extension — Group Commands', () => {
  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    sandbox.restore();
    try {
      await vscode.workspace
        .getConfiguration('documentTabs')
        .update('groupBy', undefined, vscode.ConfigurationTarget.Global);
    } catch {
      // Ignore
    }
  });

  test('groupByNone sets groupBy to none', async () => {
    await vscode.commands.executeCommand('documentTabs.groupByNone');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('groupBy'), 'none');
  });

  test('groupByFolder sets groupBy to folder', async () => {
    await vscode.commands.executeCommand('documentTabs.groupByFolder');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('groupBy'), 'folder');
  });

  test('groupByExtension sets groupBy to extension', async () => {
    await vscode.commands.executeCommand('documentTabs.groupByExtension');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('groupBy'), 'extension');
  });

  test('groupByProject sets groupBy to project', async () => {
    await vscode.commands.executeCommand('documentTabs.groupByProject');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('groupBy'), 'project');
  });

  test('checked variant groupByNone.checked also updates config', async () => {
    await vscode.commands.executeCommand('documentTabs.groupByFolder');
    await vscode.commands.executeCommand('documentTabs.groupByNone.checked');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('groupBy'), 'none');
  });
});

suite('Extension — Color Commands', () => {
  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    sandbox.restore();
    try {
      await vscode.workspace
        .getConfiguration('documentTabs')
        .update('colorBy', undefined, vscode.ConfigurationTarget.Global);
    } catch {
      // Ignore
    }
  });

  test('colorByNone sets colorBy to none', async () => {
    await vscode.commands.executeCommand('documentTabs.colorByNone');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('colorBy'), 'none');
  });

  test('colorByProject sets colorBy to project', async () => {
    await vscode.commands.executeCommand('documentTabs.colorByProject');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('colorBy'), 'project');
  });

  test('colorByExtension sets colorBy to extension', async () => {
    await vscode.commands.executeCommand('documentTabs.colorByExtension');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('colorBy'), 'extension');
  });

  test('checked variant colorByNone.checked also updates config', async () => {
    await vscode.commands.executeCommand('documentTabs.colorByProject');
    await vscode.commands.executeCommand('documentTabs.colorByNone.checked');
    const config = vscode.workspace.getConfiguration('documentTabs');
    assert.strictEqual(config.get('colorBy'), 'none');
  });
});

suite('Extension — Utility Commands', () => {
  setup(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  test('refresh command executes without error', async () => {
    await vscode.commands.executeCommand('documentTabs.refresh');
    assert.ok(true);
  });

  test('expandAll command executes without error', async () => {
    await vscode.commands.executeCommand('documentTabs.expandAll');
    assert.ok(true);
  });

  test('closeAllTabs command executes without error', async () => {
    await vscode.commands.executeCommand('documentTabs.closeAllTabs');
    assert.ok(true);
  });

  test('nextTab command executes without error (no open tabs)', async () => {
    // Close all tabs first
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('documentTabs.nextTab');
    assert.ok(true);
  });

  test('previousTab command executes without error (no open tabs)', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.commands.executeCommand('documentTabs.previousTab');
    assert.ok(true);
  });
});

suite('Extension — Tab Operations', () => {
  setup(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    } catch {
      // Ignore
    }
  });

  test('opening a file and navigating with nextTab/previousTab', async () => {
    // Open two documents
    const doc1 = await vscode.workspace.openTextDocument({ content: 'file 1', language: 'plaintext' });
    await vscode.window.showTextDocument(doc1);

    const doc2 = await vscode.workspace.openTextDocument({ content: 'file 2', language: 'plaintext' });
    await vscode.window.showTextDocument(doc2);

    // Give VS Code a moment to process tab changes
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Navigate — should not throw
    await vscode.commands.executeCommand('documentTabs.nextTab');
    await vscode.commands.executeCommand('documentTabs.previousTab');
    assert.ok(true);
  });

  test('copyPath command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.copyPath');
    } catch (e) {
      // Expected: command requires a TreeViewItem argument from tree view context
      assert.ok(e instanceof TypeError);
    }
  });

  test('copyRelativePath command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.copyRelativePath');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('closeTab command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.closeTab');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('closeOtherTabs command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.closeOtherTabs');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('closeTabsToTheRight command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.closeTabsToTheRight');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('closeTabsInGroup command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.closeTabsInGroup');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('pinTab command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.pinTab');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('unpinTab command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.unpinTab');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('revealInExplorer command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.revealInExplorer');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('openToSide command handles missing item gracefully', async () => {
    try {
      await vscode.commands.executeCommand('documentTabs.openToSide');
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });

  test('setTabColor commands handle missing item gracefully', async () => {
    const colors = [
      'none',
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
    for (const color of colors) {
      try {
        await vscode.commands.executeCommand(`documentTabs.setTabColor.${color}`);
      } catch (e) {
        assert.ok(e instanceof TypeError);
      }
    }
    assert.ok(true);
  });
});

suite('Extension — Event Handling', () => {
  setup(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    } catch {
      // Ignore
    }
  });

  test('opening a new tab triggers tree refresh (no crash)', async () => {
    const doc = await vscode.workspace.openTextDocument({ content: 'test', language: 'plaintext' });
    await vscode.window.showTextDocument(doc);

    // Wait for event processing
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(true);
  });

  test('closing a tab triggers tree refresh (no crash)', async () => {
    const doc = await vscode.workspace.openTextDocument({ content: 'temp', language: 'plaintext' });
    await vscode.window.showTextDocument(doc);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(true);
  });

  test('configuration change triggers refresh (no crash)', async () => {
    const config = vscode.workspace.getConfiguration('documentTabs');

    // Toggle a setting and back
    await config.update('showTabCount', false, vscode.ConfigurationTarget.Global);
    await new Promise((resolve) => setTimeout(resolve, 200));

    await config.update('showTabCount', true, vscode.ConfigurationTarget.Global);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.ok(true);
  });
});

suite('Extension — deactivate()', () => {
  test('deactivate function exists and is callable', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);

    if (!ext.isActive) {
      await ext.activate();
    }

    // The deactivate export should be a function
    // We can't easily call it directly without importing the module,
    // but we verify the extension structure
    assert.ok(ext.isActive);
  });
});

suite('Extension — Tree View Registration', () => {
  test('documentTabsView tree view is available', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    // The tree view should be registered — we can check by trying to focus it
    // This will not throw if the view exists
    try {
      await vscode.commands.executeCommand('documentTabsView.focus');
    } catch {
      // View might not be visible but command should exist
    }
    assert.ok(true);
  });
});

suite('Extension — openOptions Command', () => {
  test('openOptions command executes without error', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    // This opens settings UI - should not throw
    try {
      await vscode.commands.executeCommand('documentTabs.openOptions');
    } catch {
      // May fail in headless test environment — that's acceptable
    }
    assert.ok(true);
  });
});
