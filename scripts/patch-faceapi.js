const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/@vladmandic/face-api/dist/face-api.esm.js');

if (fs.existsSync(targetFile)) {
    let code = fs.readFileSync(targetFile, 'utf8');
    let modified = false;

    if (code.includes('this.util=AR()')) {
        code = code.replaceAll('this.util=AR()', 'this.util=(globalThis.nodeUtil||AR())');
        modified = true;
    }
    if (code.includes('this.textEncoder=new this.util.TextEncoder')) {
        code = code.replaceAll('this.textEncoder=new this.util.TextEncoder', 'this.textEncoder=new (globalThis.TextEncoder||this.util.TextEncoder)');
        modified = true;
    }
    if (code.includes('isTypedArray(e){return this.util.types')) {
        code = code.replaceAll('isTypedArray(e){return this.util.types', 'isTypedArray(e){return (this.util?.types||globalThis.nodeUtil?.types)');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(targetFile, code, 'utf8');
        console.log('✅ @vladmandic/face-api patched successfully for Node.js backend environment.');
    }
}
