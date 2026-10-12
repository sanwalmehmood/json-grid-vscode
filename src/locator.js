function parseWithOffsets(text) {
  let i = 0;
  const index = new Map();
  const numLit = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

  const fail = (msg) => {
    const before = text.slice(0, i).split('\n');
    throw new Error(`${msg} at line ${before.length}, column ${before[before.length - 1].length + 1}`);
  };
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };

  function parseString() {
    const s = i;
    if (text[i] !== '"') fail('Expected string');
    i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (i >= text.length) fail('Unterminated string');
    i++;
    return JSON.parse(text.slice(s, i));
  }

  function parseValue(path, keyStart) {
    ws();
    const start = i;
    let value;
    const ch = text[i];
    if (ch === '{') {
      i++; value = {}; ws();
      if (text[i] === '}') i++;
      else for (; ;) {
        ws();
        const ks = i;
        const key = parseString();
        ws();
        if (text[i] !== ':') fail("Expected ':'");
        i++;
        value[key] = parseValue(path.concat(key), ks);
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === '}') { i++; break; }
        fail("Expected ',' or '}'");
      }
    } else if (ch === '[') {
      i++; value = []; ws();
      if (text[i] === ']') i++;
      else for (let n = 0; ; n++) {
        value.push(parseValue(path.concat(n)));
        ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i] === ']') { i++; break; }
        fail("Expected ',' or ']'");
      }
    } else if (ch === '"') {
      value = parseString();
    } else {
      numLit.lastIndex = i;
      const m = numLit.exec(text);
      if (!m) fail('Unexpected token');
      i += m[0].length;
      value = JSON.parse(m[0]);
    }
    index.set(JSON.stringify(path), { start, end: i, keyStart: keyStart ?? start });
    return value;
  }

  const value = parseValue([]);
  ws();
  if (i < text.length) fail('Unexpected content after JSON');
  return { value, index };
}

module.exports = { parseWithOffsets };
