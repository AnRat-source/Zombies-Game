// Optional Rust/WASM hot path. The raw ABI avoids a runtime framework and
// copies compact Float32 data straight into the module's linear memory.
(()=>{
 const assetBase=document.currentScript?.src||location.href;
 let scratch=new Float32Array(0);
 window.CityfallWasm={
  ready:false,
  borrowPoints(count){const needed=count*2;if(scratch.length<needed)scratch=new Float32Array(needed);return scratch},
  hordeHotspots(){return null}
 };
 (async()=>{
  try{
   const response=await fetch(new URL('../wasm/pkg/cityfall_wasm_bg.wasm',assetBase));
   if(!response.ok)throw Error('WASM artifact unavailable');
   const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{}),api=instance.exports;
   if(!api.memory||!api.alloc_f32||!api.free_f32||!api.free_output_f32||!api.horde_hotspots||!api.output_len)throw Error('Invalid Cityfall WASM ABI');
   let inputPtr=0,inputCapacity=0;
   window.CityfallWasm.hordeHotspots=(points,cell,minCount)=>{
    if(points.length>inputCapacity){if(inputPtr)api.free_f32(inputPtr,inputCapacity);inputCapacity=Math.max(points.length,Math.ceil(points.length*1.35));inputPtr=api.alloc_f32(inputCapacity)}
    new Float32Array(api.memory.buffer,inputPtr,points.length).set(points);
    const outputPtr=api.horde_hotspots(inputPtr,points.length,cell,minCount),outputLen=api.output_len();
    if(!outputPtr||!outputLen)return new Float32Array(0);
    const result=new Float32Array(api.memory.buffer,outputPtr,outputLen).slice();api.free_output_f32(outputPtr,outputLen);return result;
   };
   window.CityfallWasm.ready=true;
   console.info('Cityfall WASM simulation accelerator ready');
  }catch(error){
   // Missing build artifacts are expected in source-only local previews.
   console.info('Cityfall WASM accelerator unavailable; using JavaScript fallback.');
  }
 })();
})();
