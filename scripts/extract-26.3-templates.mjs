import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const JAR_PATH = 'C:\\Users\\ADMIN\\AppData\\Roaming\\ModrinthApp\\meta\\versions\\26.3-0.19.5\\26.3-0.19.5.jar';
const OUT_ROOT = path.resolve('public', 'templates');

async function main() {
  console.log('Reading jar:', JAR_PATH);
  const buf = await fs.readFile(JAR_PATH);
  const zip = await JSZip.loadAsync(buf);

  const prefix = 'assets/minecraft/textures/';
  const entries = [];
  const files = Object.keys(zip.files).filter(
    (name) => name.startsWith(prefix) && name.endsWith('.png') && !zip.files[name].dir
  );

  console.log(`Found ${files.length} PNG textures in 26.3 jar. Extracting...`);

  // Extract in batches to avoid excessive open file handles
  const BATCH = 100;
  for (let i = 0; i < files.length; i += BATCH) {
    const slice = files.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (fullPath) => {
        const relTexPath = fullPath.slice(prefix.length); // e.g. gui/container/inventory.png
        const dest = path.join(OUT_ROOT, fullPath);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        const content = await zip.files[fullPath].async('nodebuffer');
        await fs.writeFile(dest, content);

        const topFolder = relTexPath.split('/')[0] || 'other';
        entries.push({
          path: fullPath,
          relPath: relTexPath,
          name: path.basename(fullPath),
          category: topFolder,
          url: `/templates/${fullPath}`,
        });
      })
    );
  }

  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  await fs.mkdir(OUT_ROOT, { recursive: true });
  await fs.writeFile(
    path.join(OUT_ROOT, 'manifest.json'),
    JSON.stringify({ version: '26.3', count: entries.length, entries }, null, 0),
    'utf8'
  );
  console.log(`Done! Extracted ${entries.length} textures and generated manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
