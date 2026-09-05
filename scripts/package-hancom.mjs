import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// A small deterministic, uncompressed ZIP avoids an extra deployment dependency.
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}
export async function packageHancom(destination) {
    const source = new URL('../runtime/hancom/', import.meta.url);
    const locals = [], central = [];
    let offset = 0;
    for (const file of (await readdir(source)).filter(name => /\.(py|cmd|txt|md)$/.test(name)).sort()) {
        const name = Buffer.from('mathgraph-hancom/' + file);
        const data = await readFile(new URL(file, source));
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
        local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(0x21, 14); entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28);
        entry.writeUInt32LE(offset, 42);
        locals.push(local, name, data); central.push(entry, name);
        offset += local.length + name.length + data.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    await mkdir(new URL('./', destination), { recursive: true });
    await writeFile(destination, Buffer.concat([...locals, directory, end]));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await packageHancom(new URL('../downloads/mathgraph-hancom.zip', import.meta.url));
}
