# Publishing Document Tabs Extension

This guide covers how to package and publish the Document Tabs extension to the VS Code Marketplace.

## Prerequisites

1. **Node.js** - Make sure you have Node.js installed
2. **VSCE** - VS Code Extension Manager (included in devDependencies)

## Step 1: Create a Publisher Account

1. Go to the [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft account (or create one)
3. Click **Create Publisher**
4. Fill in:
   - **ID**: A unique identifier (e.g., `gridflowtech`)
   - **Name**: Display name (e.g., `GridFlow Tech`)
5. Agree to the terms and create

## Step 2: Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com/)
2. Sign in with the same Microsoft account
3. Click on your profile icon → **Personal access tokens**
4. Click **New Token**
5. Configure:
   - **Name**: `vsce-publish` (or any name)
   - **Organization**: `All accessible organizations`
   - **Expiration**: Set as needed
   - **Scopes**: Select **Custom defined**, then find and check:
     - `Marketplace` → `Manage`
6. Click **Create** and **copy the token** (you won't see it again!)

## Step 3: Update package.json

Before publishing, update these fields in `package.json`:

```json
{
  "publisher": "your-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/document-tabs.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/document-tabs/issues"
  },
  "homepage": "https://github.com/yourusername/document-tabs#readme"
}
```

## Step 4: Add an Icon

Create a 128x128 PNG icon at `resources/icon.png`. This is displayed in the Marketplace.

## Step 5: Package the Extension

To create a `.vsix` file for local distribution:

```bash
npm run package
```

This creates a file like `document-tabs-1.0.0.vsix` in the project root.

### Installing VSIX Locally

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Click the `...` menu → **Install from VSIX...**
4. Select the `.vsix` file

## Step 6: Publish to Marketplace

### Option A: Login and Publish

```bash
# Login (will ask for PAT)
npx vsce login your-publisher-id

# Publish
npm run publish
```

### Option B: One-command Publish

```bash
npx vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN
```

## Step 7: Verify Publication

1. Go to [VS Code Marketplace](https://marketplace.visualstudio.com/)
2. Search for "Document Tabs"
3. Your extension should appear within a few minutes

## Updating the Extension

1. Update the `version` in `package.json` (follow [semver](https://semver.org/))
2. Update `CHANGELOG.md` with new changes
3. Run `npm run publish`

Or use vsce to bump version automatically:

```bash
# Patch version (1.0.0 -> 1.0.1)
npx vsce publish patch

# Minor version (1.0.0 -> 1.1.0)
npx vsce publish minor

# Major version (1.0.0 -> 2.0.0)
npx vsce publish major
```

## Distributing VSIX Files

If you want to share the extension without the Marketplace:

1. Run `npm run package`
2. Share the `.vsix` file
3. Users install via:
   - VS Code: Extensions → `...` → Install from VSIX
   - Command line: `code --install-extension document-tabs-1.0.0.vsix`

## Unpublishing

To remove the extension from the Marketplace:

```bash
npx vsce unpublish your-publisher-id.document-tabs
```

## Useful Links

- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [Marketplace Management](https://marketplace.visualstudio.com/manage)
- [VSCE Documentation](https://github.com/microsoft/vscode-vsce)
