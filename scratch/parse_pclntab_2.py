import struct

def parse():
    bin_path = r"C:\Users\Max\AppData\Local\Programs\antigravity\resources\bin\language_server.exe"
    with open(bin_path, "rb") as f:
        data = f.read()

    pcln_offset = 1954773
    magic, pad1, pad2, minLC, ptrSize = struct.unpack_from("<IBBBB", data, pcln_offset)
    print(f"Magic: {hex(magic)}, minLC: {minLC}, ptrSize: {ptrSize}")
    
    # Read pcHeader fields
    # On 64-bit:
    # magic (4), pad1 (1), pad2 (1), minLC (1), ptrSize (1) -> 8 bytes
    # nfunc (8), nfiles (8), textStart (8), funcnameOffset (8), cuOffset (8), filetabOffset (8), pctabOffset (8), pclnOffset (8)
    nfunc, nfiles, textStart, funcnameOffset, cuOffset, filetabOffset, pctabOffset, pclnOffset = struct.unpack_from("<QQQQQQQQ", data, pcln_offset + 8)
    print(f"nfunc: {nfunc}, textStart: {hex(textStart)}, funcnameOffset: {hex(funcnameOffset)}")
    
    # We want to find the _func entry where nameoff points to our function name.
    # The function name is at offset 60597452 in the file.
    # What is the offset of the function name relative to the start of funcnameOffset?
    target_name_offset = 60597452 - (pcln_offset + funcnameOffset)
    print(f"Target name offset in funcnameOffset table: {target_name_offset}")
    
    # In Go 1.20, there is a list of functab entries starting at pcln_offset + 8 + 64 (pclnOffset? No, the functab array starts right after the header).
    # Wait, the functab array starts at pcln_offset + 8 + 64 = pcln_offset + 72.
    # Each entry in the array is: entryPC (8 bytes), funcOffset (8 bytes).
    # Let's search the functab array.
    found_func = None
    for i in range(nfunc):
        off = pcln_offset + 72 + i * 16
        entryPC, funcOffset = struct.unpack_from("<QQ", data, off)
        
        # Read the _func struct at pcln_offset + funcOffset
        # _func struct starts with:
        # entryoff (4 bytes)
        # nameoff (4 bytes)
        _func_off = pcln_offset + funcOffset
        if _func_off + 8 > len(data):
            continue
        entryoff, nameoff = struct.unpack_from("<II", data, _func_off)
        if nameoff == target_name_offset:
            print(f"Found _func at {hex(_func_off)}! entryoff: {hex(entryoff)}, nameoff: {hex(nameoff)}")
            # The next functab entry gives the end of this function (entryPC of next function minus entryPC of this function is the size)
            next_off = pcln_offset + 72 + (i + 1) * 16
            next_entryPC, _ = struct.unpack_from("<QQ", data, next_off)
            func_size = next_entryPC - entryPC
            print(f"Function entry PC: {hex(entryPC)}, Size: {func_size} bytes")
            
            # The entryPC is an absolute address. What is the offset in the file?
            # In Go, the entryoff is relative to textStart.
            # But wait, entryoff is also stored as offset in the file?
            # No, entryPC = textStart + entryoff.
            # We can find the file offset by finding where the text section is mapped.
            # Actually, since we know entryoff is relative to textStart, and we know the entryoff of this function,
            # we can look for entryPC in the PE file headers, or we can just search for the start of the function by doing a byte pattern search,
            # or we can calculate the file offset of textStart.
            # Usually, textStart is the load address of the text section.
            # Let's read the PE headers to find the section file offset.
            found_func = (entryoff, func_size)
            break

    if not found_func:
        print("Function not found in functab")
        return
        
    entryoff, func_size = found_func
    # Let's read PE section headers to map virtual address to file offset.
    # PE signature is at offset 0x3c
    pe_ptr = struct.unpack_from("<I", data, 0x3c)[0]
    num_sections = struct.unpack_from("<H", data, pe_ptr + 6)[0]
    size_op_hdr = struct.unpack_from("<H", data, pe_ptr + 20)[0]
    sec_tbl_off = pe_ptr + 24 + size_op_hdr
    
    # Loop through sections
    for s_idx in range(num_sections):
        s_off = sec_tbl_off + s_idx * 40
        s_name = data[s_off:s_off+8].decode('ascii', errors='ignore').strip('\x00')
        v_size, v_addr, r_size, r_ptr = struct.unpack_from("<IIII", data, s_off + 8)
        print(f"Section {s_name}: VirtualAddress {hex(v_addr)}, PointerToRawData {hex(r_ptr)}")
        # Go's textStart is typically the start of the .text section (or base address + .text VirtualAddress).
        # Let's see: if textStart matches a section virtual address or base + virtual address.
        # Actually, Go's textStart address is virtual address (often base 0x400000 or similar).
        # Let's find which section contains entryoff? No, entryoff is relative to textStart, and textStart is the virtual address of the text section.
        # So entryPC is the virtual address!
        # Let's find which section contains entryoff or entryPC.
        # Wait, if entryPC is between v_addr and v_addr + v_size:
        # file_offset = r_ptr + (entryPC - v_addr)
        # Let's test this!
        
parse()
