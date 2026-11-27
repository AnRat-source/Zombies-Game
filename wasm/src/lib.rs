use std::collections::BTreeMap;
use std::mem;

static mut OUTPUT_LEN: usize = 0;

/// Allocate an f32 buffer owned by the WebAssembly module. JavaScript writes
/// positions directly into the exported linear memory, avoiding JSON and GC.
#[no_mangle]
pub extern "C" fn alloc_f32(length: usize) -> *mut f32 {
    let mut values = Vec::<f32>::with_capacity(length);
    let ptr = values.as_mut_ptr();
    mem::forget(values);
    ptr
}

/// Release an input buffer created by alloc_f32.
#[no_mangle]
pub unsafe extern "C" fn free_f32(ptr: *mut f32, capacity: usize) {
    if !ptr.is_null() && capacity > 0 {
        drop(Vec::from_raw_parts(ptr, 0, capacity));
    }
}

/// Bin world-space [x, y, ...] positions into horde centers. The returned
/// pointer addresses a flat [x, y, count, ...] buffer; call output_len and
/// free_output_f32 after reading it from JavaScript.
#[no_mangle]
pub unsafe extern "C" fn horde_hotspots(
    positions_ptr: *const f32,
    positions_len: usize,
    cell_size: f32,
    min_count: u32,
) -> *mut f32 {
    if cell_size <= 0.0 || positions_len < 2 || positions_ptr.is_null() {
        OUTPUT_LEN = 0;
        return std::ptr::null_mut();
    }

    let positions = std::slice::from_raw_parts(positions_ptr, positions_len);

    let mut bins: BTreeMap<(i32, i32), (f32, f32, u32)> = BTreeMap::new();
    for point in positions.chunks_exact(2) {
        let x = point[0];
        let y = point[1];
        if !x.is_finite() || !y.is_finite() {
            continue;
        }
        let key = ((x / cell_size).floor() as i32, (y / cell_size).floor() as i32);
        let entry = bins.entry(key).or_insert((0.0, 0.0, 0));
        entry.0 += x;
        entry.1 += y;
        entry.2 += 1;
    }

    let mut output = Vec::with_capacity(bins.len() * 3);
    for (_key, (sum_x, sum_y, count)) in bins {
        if count >= min_count {
            output.push(sum_x / count as f32);
            output.push(sum_y / count as f32);
            output.push(count as f32);
        }
    }
    let output = output.into_boxed_slice();
    OUTPUT_LEN = output.len();
    Box::into_raw(output) as *mut f32
}

#[no_mangle]
pub unsafe extern "C" fn output_len() -> usize { OUTPUT_LEN }

/// Output uses an exact-length boxed allocation, distinct from the reusable
/// capacity-based input buffer above.
#[no_mangle]
pub unsafe extern "C" fn free_output_f32(ptr: *mut f32, length: usize) {
    if !ptr.is_null() && length > 0 {
        drop(Box::from_raw(std::slice::from_raw_parts_mut(ptr, length)));
    }
}
