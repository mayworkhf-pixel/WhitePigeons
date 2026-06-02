import os
import struct

def find_pc_and_bytes():
    bin_path = r"C:\Users\Max\AppData\Local\Programs\antigravity\resources\bin\language_server.exe"
    with open(bin_path, "rb") as f:
        data = f.read()

    # Search for function name in binary
    func_name = b"google3/third_party/jetski/cortex/utils/utils.validateImagePath"
    name_idx = data.find(func_name)
    if name_idx == -1:
        print("Function name not found in binary")
        return
    print(f"Found function name at offset: {name_idx}")

    # Search for magic headers of pclntab
    # Go 1.20 magic: 0xfffffff0 or 0xfffffff1 or 0xfffffff2 or 0xfffffffb
    magics = [b"\xfb\xff\xff\xff", b"\xf0\xff\xff\xff", b"\xf1\xff\xff\xff", b"\xf2\xff\xff\xff"]
    pcln_offset = -1
    for magic in magics:
        offset = data.find(magic)
        if offset != -1:
            pcln_offset = offset
            print(f"Found pclntab magic {magic.hex()} at offset: {pcln_offset}")
            break
            
    if pcln_offset == -1:
        print("pclntab not found")
        return

    # Let's search for the string 'image path must be within artifact directory'
    err_str = b"image path must be within artifact directory"
    err_idx = data.find(err_str)
    if err_idx != -1:
        print(f"Found error string at offset: {err_idx}")
        # Search for references to the address of this string, or search nearby instructions.
        # In Go, string constants are accessed relative to RIP or as raw addresses.
        # Let's search for the offset or address of the string.
        # Usually, Go uses RIP-relative addressing (lea rbx, [rip + offset]) or direct addresses.
        # Let's look at 1000 bytes around the err_idx.
        
find_pc_and_bytes()
