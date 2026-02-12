import * as path from 'path';
import { execSync } from 'child_process';
import { runTests } from '@vscode/test-electron';

/**
 * On Windows, @vscode/test-electron uses `shell: true` which splits args at
 * spaces. Convert paths to Windows 8.3 short names to avoid this.
 */
function resolveShortPath(longPath: string): string {
  if (process.platform !== 'win32' || !longPath.includes(' ')) {
    return longPath;
  }
  try {
    const script = `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${longPath}').ShortPath`;
    return execSync(`powershell -NoProfile -Command "${script}"`, { encoding: 'utf-8' }).trim();
  } catch {
    return longPath;
  }
}

async function main() {
  try {
    // The folder containing the extension manifest (package.json)
    const extensionDevelopmentPath = resolveShortPath(path.resolve(__dirname, '../../'));

    // The path to the test runner entry point (resolve as dir, then append file)
    const suiteDir = resolveShortPath(path.resolve(__dirname, './suite'));
    const extensionTestsPath = path.join(suiteDir, 'index');

    // Download VS Code, unzip it, and run the integration tests
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions']
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
