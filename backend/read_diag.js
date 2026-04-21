const fs = require('fs');
const content = fs.readFileSync('diag_output.txt', 'utf16le');
console.log(content);
