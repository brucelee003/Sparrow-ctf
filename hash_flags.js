const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDir = process.argv[2] || '.';

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.html')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(baseDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Regex to find CTF.initSubmission('id', 'flag')
  const regex = /CTF\.initSubmission\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  
  content = content.replace(regex, (match, id, flag) => {
    // If flag is already a 64-char hex string, it's likely a hash, skip it
    if (flag.length === 64 && /^[0-9a-f]+$/i.test(flag)) {
        return match;
    }
    
    console.log(`Hashing flag for ${id} in ${file}: ${flag}`);
    const hash = crypto.createHash('sha256').update(flag.trim()).digest('hex');
    changed = true;
    return `CTF.initSubmission('${id}', '${hash}')`;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
