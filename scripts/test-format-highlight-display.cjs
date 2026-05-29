const assert = require('assert');
const {
  formatHighlightReadableText,
  formatHighlightDisplayMarkdown
} = require('../shared/formatHighlightDisplay.cjs');

const readable = formatHighlightReadableText('A∩B={xIx∈A und x∈B}');
assert(readable.includes('∩'), 'union symbol');
assert(readable.includes('|'), 'set-builder bar');
assert(!readable.includes('$'), 'no LaTeX dollar wrap');
assert(formatHighlightDisplayMarkdown('A∩B={xIx∈A und x∈B}') === readable, 'alias matches');

const german = formatHighlightReadableText('Die leere Menge enthält kein Element.');
assert(german.includes('leere Menge'), 'German preserved');
assert(!german.startsWith('$'), 'plain German');

console.log('format-highlight-display tests OK');
