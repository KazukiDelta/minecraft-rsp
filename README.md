# MC Resource Pack Studio

Browser-based Minecraft Resource Pack editor built with React, TypeScript, Vite, Tailwind CSS, HTML5 Canvas, and JSZip.

## Features
- **Unrestricted Pixel Upscaling (Nearest-Neighbor):** `2x`, `4x`, `8x`, `16x`, or custom resolution up to `4096×4096 px`.
- **Image Stamping & Auto Background Removal:** Flood-fill BG remover, GUI panel masking, and **Keep GUI Slots Crisp on Top**.
- **3D Skybox & Item/Block Preview:** Interactive 360° Skybox viewer with 3D tangent-plane stamping (`OptiFine` / `Skyboxify` / `FabricSkyboxes`) and auto `blend: replace` export patch.
- **Animated Textures:** Supports animated `.webp`, `.gif`, `.webm`, `.mp4`, or multi-frame PNGs for both `.png.mcmeta` and **Animatica** GUI animations (`optifine/anim/`).
- **Minecraft 26.3 Bed Support:** Seamless 2-file bed top stamping (`*_bed_head_up.png` + `*_bed_foot_up.png`) and legacy `entity/bed/` UV splitting.
- **Pack Merger & Auto-Save Cache:** Merge selected textures from multiple `.zip` packs with automatic IndexedDB persistence.

## Local Setup
```bash
npm install
# Optional: extract vanilla textures from your local Minecraft jar into public/templates/
npm run extract-templates
npm run dev
```
