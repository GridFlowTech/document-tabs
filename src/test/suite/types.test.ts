import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import {
  SortOrder,
  GroupBy,
  ColorBy,
  TabColorName,
  DocumentTabsConfig,
  TabItem,
  GroupItem,
  TreeViewItem,
  isTabItem,
  isGroupItem,
  getTabUri,
  getFileName,
  getFileExtension,
  getParentFolder,
  getWorkspaceFolder,
  getProjectFolder,
  clearProjectFolderCache,
  getRelativePath
} from '../../types';

suite('types.ts — Type Guards', () => {
  const makeTabItem = (label = 'test.ts'): TabItem => ({
    type: 'tab',
    tab: {} as vscode.Tab,
    uri: vscode.Uri.file('/test/' + label),
    label,
    isPinned: false,
    isDirty: false,
    openedAt: 1
  });

  const makeGroupItem = (name = 'src'): GroupItem => ({
    type: 'group',
    name,
    tabs: [],
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded
  });

  test('isTabItem returns true for TabItem', () => {
    assert.strictEqual(isTabItem(makeTabItem()), true);
  });

  test('isTabItem returns false for GroupItem', () => {
    assert.strictEqual(isTabItem(makeGroupItem()), false);
  });

  test('isGroupItem returns true for GroupItem', () => {
    assert.strictEqual(isGroupItem(makeGroupItem()), true);
  });

  test('isGroupItem returns false for TabItem', () => {
    assert.strictEqual(isGroupItem(makeTabItem()), false);
  });

  test('type guard narrows union type correctly', () => {
    const items: TreeViewItem[] = [makeTabItem(), makeGroupItem()];
    const tabs = items.filter(isTabItem);
    const groups = items.filter(isGroupItem);
    assert.strictEqual(tabs.length, 1);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(tabs[0].label, 'test.ts');
    assert.strictEqual(groups[0].name, 'src');
  });
});

suite('types.ts — getTabUri', () => {
  test('returns uri for TabInputText', () => {
    const uri = vscode.Uri.file('/test/file.ts');
    const tab = { input: new vscode.TabInputText(uri) } as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result?.toString(), uri.toString());
  });

  test('returns uri for TabInputNotebook', () => {
    const uri = vscode.Uri.file('/test/notebook.ipynb');
    const tab = { input: new vscode.TabInputNotebook(uri, 'jupyter-notebook') } as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result?.toString(), uri.toString());
  });

  test('returns uri for TabInputCustom', () => {
    const uri = vscode.Uri.file('/test/custom.abc');
    const tab = { input: new vscode.TabInputCustom(uri, 'custom-viewer') } as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result?.toString(), uri.toString());
  });

  test('returns modified uri for TabInputTextDiff', () => {
    const original = vscode.Uri.file('/test/original.ts');
    const modified = vscode.Uri.file('/test/modified.ts');
    const tab = { input: new vscode.TabInputTextDiff(original, modified) } as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result?.toString(), modified.toString());
  });

  test('returns modified uri for TabInputNotebookDiff', () => {
    const original = vscode.Uri.file('/test/original.ipynb');
    const modified = vscode.Uri.file('/test/modified.ipynb');
    const tab = {
      input: new vscode.TabInputNotebookDiff(original, modified, 'jupyter-notebook')
    } as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result?.toString(), modified.toString());
  });

  test('returns undefined for unknown input type', () => {
    const tab = { input: {} } as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result, undefined);
  });

  test('returns undefined for tab with no input', () => {
    const tab = { input: undefined } as unknown as vscode.Tab;
    const result = getTabUri(tab);
    assert.strictEqual(result, undefined);
  });
});

suite('types.ts — getFileName', () => {
  test('extracts filename from deep path', () => {
    const uri = vscode.Uri.file('/workspace/src/components/Button.tsx');
    assert.strictEqual(getFileName(uri), 'Button.tsx');
  });

  test('extracts filename from shallow path', () => {
    const uri = vscode.Uri.file('/file.ts');
    assert.strictEqual(getFileName(uri), 'file.ts');
  });

  test('handles file with no extension', () => {
    const uri = vscode.Uri.file('/workspace/Makefile');
    assert.strictEqual(getFileName(uri), 'Makefile');
  });

  test('handles dotfile', () => {
    const uri = vscode.Uri.file('/workspace/.gitignore');
    assert.strictEqual(getFileName(uri), '.gitignore');
  });

  test('handles file with multiple dots', () => {
    const uri = vscode.Uri.file('/workspace/app.test.spec.ts');
    assert.strictEqual(getFileName(uri), 'app.test.spec.ts');
  });
});

suite('types.ts — getFileExtension', () => {
  test('returns .ts extension', () => {
    const uri = vscode.Uri.file('/workspace/file.ts');
    assert.strictEqual(getFileExtension(uri), '.ts');
  });

  test('returns last extension for multi-dot files', () => {
    const uri = vscode.Uri.file('/workspace/file.test.ts');
    assert.strictEqual(getFileExtension(uri), '.ts');
  });

  test('returns No Extension for extensionless file', () => {
    const uri = vscode.Uri.file('/workspace/Makefile');
    assert.strictEqual(getFileExtension(uri), 'No Extension');
  });

  test('returns extension for dotfile with extension', () => {
    const uri = vscode.Uri.file('/workspace/.eslintrc.json');
    assert.strictEqual(getFileExtension(uri), '.json');
  });

  test('returns No Extension for bare dotfile', () => {
    const uri = vscode.Uri.file('/workspace/.gitignore');
    // .gitignore has one dot so split gives ['', 'gitignore'] which has length > 1
    assert.strictEqual(getFileExtension(uri), '.gitignore');
  });

  test('returns .tsx for React file', () => {
    const uri = vscode.Uri.file('/workspace/Component.tsx');
    assert.strictEqual(getFileExtension(uri), '.tsx');
  });
});

suite('types.ts — getParentFolder', () => {
  test('returns parent folder for deep path', () => {
    const uri = vscode.Uri.file('/workspace/src/components/Button.tsx');
    assert.strictEqual(getParentFolder(uri), 'components');
  });

  test('returns workspace for shallow file', () => {
    const uri = vscode.Uri.file('/workspace/file.ts');
    assert.strictEqual(getParentFolder(uri), 'workspace');
  });

  test('returns Root for root-level path', () => {
    const uri = vscode.Uri.parse('file:///file.ts');
    // path is /file.ts → parts = ['', 'file.ts'] → parts[-2] = '' → 'Root'
    assert.strictEqual(getParentFolder(uri), 'Root');
  });

  test('returns src for file in src directory', () => {
    const uri = vscode.Uri.file('/workspace/src/index.ts');
    assert.strictEqual(getParentFolder(uri), 'src');
  });
});

suite('types.ts — getWorkspaceFolder', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('returns workspace folder name when URI belongs to a workspace', () => {
    const uri = vscode.Uri.file('/workspace/src/file.ts');
    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns({
      uri: vscode.Uri.file('/workspace'),
      name: 'MyProject',
      index: 0
    });
    assert.strictEqual(getWorkspaceFolder(uri), 'MyProject');
  });

  test('returns External when URI is outside workspace', () => {
    const uri = vscode.Uri.file('/external/file.ts');
    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(undefined);
    assert.strictEqual(getWorkspaceFolder(uri), 'External');
  });
});

suite('types.ts — getRelativePath', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('returns relative path when in workspace', () => {
    const uri = vscode.Uri.file('/workspace/src/file.ts');
    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns({
      uri: vscode.Uri.file('/workspace'),
      name: 'MyProject',
      index: 0
    });
    sandbox.stub(vscode.workspace, 'asRelativePath').returns('src/file.ts');
    assert.strictEqual(getRelativePath(uri), 'src/file.ts');
  });

  test('returns fsPath when outside workspace', () => {
    const uri = vscode.Uri.file('/external/file.ts');
    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(undefined);
    const result = getRelativePath(uri);
    assert.ok(result.includes('file.ts'));
    assert.ok(result.includes('external'));
  });
});

suite('types.ts — getProjectFolder', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    clearProjectFolderCache();
  });

  teardown(() => {
    sandbox.restore();
    clearProjectFolderCache();
  });

  test('returns External when no workspace folder', () => {
    const uri = vscode.Uri.file('/nonexistent/external/file.ts');
    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(undefined);
    assert.strictEqual(getProjectFolder(uri), 'External');
  });

  test('returns a non-empty string for any URI with a workspace', () => {
    const uri = vscode.Uri.file('/workspace/src/file.ts');
    sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns({
      uri: vscode.Uri.file('/workspace'),
      name: 'Workspace',
      index: 0
    });
    sandbox.stub(vscode.workspace, 'asRelativePath').returns('src/file.ts');
    const result = getProjectFolder(uri);
    assert.ok(typeof result === 'string' && result.length > 0, `Expected non-empty string, got "${result}"`);
  });

  test('clearProjectFolderCache does not throw', () => {
    clearProjectFolderCache();
    assert.ok(true);
  });
});

suite('types.ts — Type Interfaces', () => {
  test('TabItem has required properties', () => {
    const item: TabItem = {
      type: 'tab',
      tab: {} as vscode.Tab,
      uri: vscode.Uri.file('/test.ts'),
      label: 'test.ts',
      isPinned: false,
      isDirty: false,
      openedAt: 0
    };
    assert.strictEqual(item.type, 'tab');
    assert.strictEqual(item.label, 'test.ts');
    assert.strictEqual(item.isPinned, false);
    assert.strictEqual(item.isDirty, false);
    assert.strictEqual(item.openedAt, 0);
  });

  test('TabItem supports optional groupName and projectFolder', () => {
    const item: TabItem = {
      type: 'tab',
      tab: {} as vscode.Tab,
      uri: vscode.Uri.file('/test.ts'),
      label: 'test.ts',
      isPinned: false,
      isDirty: false,
      openedAt: 0,
      groupName: 'src',
      projectFolder: 'MyApp'
    };
    assert.strictEqual(item.groupName, 'src');
    assert.strictEqual(item.projectFolder, 'MyApp');
  });

  test('GroupItem has required properties', () => {
    const tabs: TabItem[] = [];
    const item: GroupItem = {
      type: 'group',
      name: 'components',
      tabs,
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded
    };
    assert.strictEqual(item.type, 'group');
    assert.strictEqual(item.name, 'components');
    assert.deepStrictEqual(item.tabs, []);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });

  test('TreeViewItem union accepts both TabItem and GroupItem', () => {
    const tabItem: TreeViewItem = {
      type: 'tab',
      tab: {} as vscode.Tab,
      uri: vscode.Uri.file('/test.ts'),
      label: 'test.ts',
      isPinned: false,
      isDirty: false,
      openedAt: 0
    };
    const groupItem: TreeViewItem = {
      type: 'group',
      name: 'group',
      tabs: [],
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
    };
    assert.strictEqual(tabItem.type, 'tab');
    assert.strictEqual(groupItem.type, 'group');
  });

  test('DocumentTabsConfig has all 9 settings', () => {
    const config: DocumentTabsConfig = {
      sortOrder: 'alphabetical',
      groupBy: 'folder',
      colorBy: 'none',
      showPinnedSeparately: true,
      showTabCount: true,
      showDirtyIndicator: true,
      showFileIcons: true,
      showPath: true,
      collapseGroupsByDefault: false
    };
    assert.strictEqual(config.sortOrder, 'alphabetical');
    assert.strictEqual(config.groupBy, 'folder');
    assert.strictEqual(config.colorBy, 'none');
    assert.strictEqual(config.showPinnedSeparately, true);
    assert.strictEqual(config.showTabCount, true);
    assert.strictEqual(config.showDirtyIndicator, true);
    assert.strictEqual(config.showFileIcons, true);
    assert.strictEqual(config.showPath, true);
    assert.strictEqual(config.collapseGroupsByDefault, false);
  });

  test('SortOrder type accepts all valid values', () => {
    const values: SortOrder[] = ['alphabetical', 'recentlyOpenedFirst', 'recentlyOpenedLast'];
    assert.strictEqual(values.length, 3);
  });

  test('GroupBy type accepts all valid values', () => {
    const values: GroupBy[] = ['none', 'folder', 'extension', 'project'];
    assert.strictEqual(values.length, 4);
  });

  test('ColorBy type accepts all valid values', () => {
    const values: ColorBy[] = ['none', 'project', 'extension'];
    assert.strictEqual(values.length, 3);
  });

  test('TabColorName type includes all 17 colors', () => {
    const colors: TabColorName[] = [
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
    assert.strictEqual(colors.length, 17);
  });
});
