const fs = require('fs');
const path = require('path');

function writeTest(relPath, content) {
  const fullPath = path.join(__dirname, '..', relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Wrote:', relPath);
}

module.exports = { writeTest };