"""Pack Blender's normal buffers without changing positions or animation data.

KHR_mesh_quantization uses normalized signed bytes with a four-byte stride:
https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
Three.js supports this format directly; no runtime decoder is needed.
"""
import json
import math
import struct
from pathlib import Path


def pack_glb_normals(path):
    path=Path(path)
    source=path.read_bytes()
    magic,version,total=struct.unpack_from('<III',source)
    if (magic,version,total)!=(0x46546c67,2,len(source)):
        raise ValueError('Expected a complete glTF 2.0 binary')
    chunks={}; offset=12
    while offset<len(source):
        length,kind=struct.unpack_from('<II',source,offset)
        chunks[kind]=source[offset+8:offset+8+length]; offset+=8+length
    model=json.loads(chunks[0x4e4f534a]); binary=chunks[0x004e4942]
    if len(model['buffers'])!=1:
        raise ValueError('Expected one embedded Blender buffer')
    normal_ids={primitive['attributes']['NORMAL'] for mesh in model['meshes']
                for primitive in mesh['primitives'] if 'NORMAL' in primitive['attributes']}
    packed={}
    for index in sorted(normal_ids):
        accessor=model['accessors'][index]
        view_index=accessor['bufferView']; view=model['bufferViews'][view_index]
        references=sum(item.get('bufferView')==view_index for item in model['accessors'])
        if accessor['componentType']!=5126 or accessor['type']!='VEC3' or references!=1 or 'sparse' in accessor:
            raise ValueError('Expected an independent float VEC3 normal buffer')
        start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        stride=view.get('byteStride',12); data=bytearray()
        for vertex in range(accessor['count']):
            values=struct.unpack_from('<fff',binary,start+vertex*stride)
            if not all(math.isfinite(value) and abs(value)<=1.0001 for value in values):
                raise ValueError('Invalid vertex normal')
            data.extend(struct.pack('<bbbx',*(max(-127,min(127,round(value*127))) for value in values)))
        packed[view_index]=data
        accessor.update(componentType=5120,normalized=True,byteOffset=0)
        for bound in ['min','max']:
            if bound in accessor: accessor[bound]=[max(-127,min(127,round(value*127))) for value in accessor[bound]]
    output=bytearray()
    for index,view in enumerate(model['bufferViews']):
        output.extend(b'\0'*((-len(output))%4))
        original_offset=view.get('byteOffset',0)
        data=packed.get(index,binary[original_offset:original_offset+view['byteLength']])
        view.update(byteOffset=len(output),byteLength=len(data))
        if index in packed: view['byteStride']=4
        output.extend(data)
    model['buffers'][0]['byteLength']=len(output)
    for key in ['extensionsUsed','extensionsRequired']:
        extensions=model.setdefault(key,[])
        if 'KHR_mesh_quantization' not in extensions: extensions.append('KHR_mesh_quantization')
    header=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode()
    header+=b' '*((-len(header))%4); output.extend(b'\0'*((-len(output))%4))
    result=struct.pack('<III',0x46546c67,2,28+len(header)+len(output))
    result+=struct.pack('<II',len(header),0x4e4f534a)+header
    result+=struct.pack('<II',len(output),0x004e4942)+output
    path.write_bytes(result)
    print('NORMALS_PACKED',len(source),'->',len(result),'bytes')


if __name__=='__main__':
    import sys
    pack_glb_normals(sys.argv[1])
