# JSON Grid

View any JSON file as nested, expandable tables inside VS Code.

## Features

- **Tables for arrays of objects** — columns are inferred automatically
- **Expand / collapse** nested objects and arrays with `+` / `–`
- **Expand all / Collapse all** toolbar buttons
- **Text search** — highlights matching cells
- **Column filters & sort** — funnel icon on each header; advanced multi-condition filter in the `⋯` menu
- **GridSync** — click a cell, header, or row number to select the corresponding value in the editor
- **CSV export** — available from the table corner menu
- **Live updates** while you edit; invalid JSON shows the parse error with line and column
- Follows your current VS Code theme

## Usage

1. Open a `.json` or `.jsonc` file.
2. Click the table icon in the editor title bar, or press `Ctrl+Alt+G` (`Cmd+Alt+G` on macOS).
3. The grid opens beside the editor.

## Install

### From VSIX

```bash
npm i -g @vscode/vsce
vsce package
```

Then in VS Code: **Extensions: Install from VSIX…** and pick the generated `.vsix`.

### Development

Open this folder in VS Code and press `F5` to launch an Extension Development Host.

## License

MIT
