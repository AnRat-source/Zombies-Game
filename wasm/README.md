# Cityfall WebAssembly accelerator

This module moves horde-density aggregation out of the JavaScript hot path.
It uses a tiny raw ABI rather than a large runtime package: compact `Float32`
positions are copied into WASM linear memory and the returned hotspot buffer is
copied back only at the horde overlay's fixed refresh cadence. It is optional at
runtime: `assets/wasm-sim.js` automatically keeps the proven JavaScript
implementation if the generated file is missing or fails to load.

Build it from this directory after installing stable Rust with the
`wasm32-unknown-unknown` target:

```powershell
New-Item -ItemType Directory -Force pkg
rustc --edition 2021 --target wasm32-unknown-unknown --crate-type cdylib src/lib.rs -o pkg/cityfall_wasm_bg.wasm -C opt-level=z -C lto=fat -C codegen-units=1 -C panic=abort -C strip=symbols -C link-arg=--export-memory
```

Commit the generated `wasm/pkg/cityfall_wasm_bg.wasm` file with the static site
when publishing an accelerated build. Do not run this command from GitHub Pages
itself; it serves the already-built artifact.
