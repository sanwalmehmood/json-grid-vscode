const vscode = require('vscode');
const path = require('path');
const { parseWithOffsets } = require('./locator');

const panels = new Map();

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('jsonGrid.open', (uri) => openGrid(context, uri))
  );
}

async function openGrid(context, uri) {
  let doc;
  if (uri instanceof vscode.Uri) doc = await vscode.workspace.openTextDocument(uri);
  else if (vscode.window.activeTextEditor) doc = vscode.window.activeTextEditor.document;
  else return vscode.window.showWarningMessage('Open a JSON file first.');

  const key = doc.uri.toString();
  if (panels.has(key)) { panels.get(key).panel.reveal(); return; }

  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const panel = vscode.window.createWebviewPanel(
    'jsonGrid', `Grid: ${path.basename(doc.fileName)}`,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, localResourceRoots: [media], retainContextWhenHidden: true }
  );
  const state = { panel, index: new Map() };
  panels.set(key, state);

  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const js = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'main.js'));
  const css = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'main.css'));
  panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}"></head>
<body>
<div id="toolbar">
  <button id="expandAll" title="Expand everything">Expand all</button>
  <button id="collapseAll" title="Collapse everything">Collapse all</button>
  <input id="filter" placeholder="Search..." />
  <span id="status"></span>
</div>
<div id="error"></div>
<div id="root"></div>
<script nonce="${nonce}" src="${js}"></script></body></html>`;

  const push = () => {
    try {
      const { value, index } = parseWithOffsets(doc.getText());
      state.index = index;
      panel.webview.postMessage({ type: 'data', value });
    } catch (e) {
      panel.webview.postMessage({ type: 'error', message: e.message });
    }
  };

  let timer;
  const sub = vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.uri.toString() !== key) return;
    clearTimeout(timer);
    timer = setTimeout(push, 300);
  });

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.type === 'ready') push();
    else if (msg.type === 'reveal') await revealPath(doc, state, msg.path);
    else if (msg.type === 'saveCsv') {
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(path.dirname(doc.fileName), 'export.csv')),
        filters: { CSV: ['csv'] }
      });
      if (target) {
        await vscode.workspace.fs.writeFile(target, Buffer.from(msg.csv, 'utf8'));
        vscode.window.showInformationMessage(`Saved ${path.basename(target.fsPath)}`);
      }
    }
  });

  panel.onDidDispose(() => { sub.dispose(); clearTimeout(timer); panels.delete(key); });
}

async function revealPath(doc, state, p) {
  const loc = state.index.get(JSON.stringify(p));
  if (!loc) return;
  const range = new vscode.Range(doc.positionAt(loc.start), doc.positionAt(loc.end));
  let editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
  if (!editor) editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preserveFocus: true });
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function deactivate() { }
module.exports = { activate, deactivate };
