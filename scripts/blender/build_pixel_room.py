"""Generate the original Octopus room and editable Blender source.
Run: blender --background --python scripts/blender/build_pixel_room.py
Coordinates in this script use Three.js Y-up; conversion happens in xyz().
"""
import bpy, json, math, random, runpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
layout = json.loads((ROOT / 'assets/pixel-room/layout.json').read_text())
random.seed(23)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M = {}
BOX_MESHES = {}
VOXEL_MESHES = {}

def mat(name, color, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .86
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = glow
    M[name] = m
    return m

for name, color in {
    'walnut':(.16,.075,.042), 'wood':(.31,.16,.08), 'edge':(.11,.065,.05),
    'wall':(.36,.29,.23), 'wall-left':(.29,.25,.23), 'cream':(.78,.66,.47),
    'dark':(.022,.034,.043), 'metal':(.045,.065,.075), 'sage':(.22,.32,.23),
    'leaf':(.14,.25,.11), 'leaf-light':(.31,.42,.16), 'terracotta':(.46,.19,.105),
    'linen':(.65,.59,.44), 'blanket':(.24,.35,.32), 'rug':(.17,.24,.25),
    'book-red':(.50,.19,.12), 'book-blue':(.13,.26,.31), 'book-gold':(.56,.40,.16),
    'paper':(.82,.75,.58), 'white':(.82,.83,.77),
    'cat-black':(.013,.018,.026), 'cat-highlight':(.045,.054,.069),
    'cat-nose':(.34,.19,.22), 'cat-eye':(.72,.76,.22),
    'sky':(.18,.38,.43), 'distant-leaf':(.22,.36,.22),
    'skin':(.83,.58,.39), 'skin-light':(.98,.79,.59), 'blush':(.91,.46,.38),
    'silver-hair':(.77,.82,.76), 'silver-highlight':(.97,.95,.74),
    'silver-shadow':(.43,.52,.56), 'costume-white':(.94,.92,.74),
    'costume-shadow':(.63,.69,.74), 'cloth-fold':(.77,.80,.78), 'costume-gold':(.57,.37,.13),
    'gold-highlight':(.81,.64,.29), 'striped-tunic':(.05,.04,.034), 'tunic-stripe':(.49,.36,.22), 'reference-fold':(.56,.65,.66),
    'elf-tights':(.075,.10,.13), 'boot-leather':(.36,.185,.075),
    'boot-highlight':(.43,.25,.125), 'eye-green':(.095,.245,.16),
    'eye-green-light':(.26,.46,.25), 'eyelash':(.025,.04,.032),
    'earring-red':(.56,.06,.11), 'eye-white':(.95,.92,.85),
    'plush-purple':(.46,.29,.68), 'plush-light':(.66,.46,.82),
    'plush-pink':(.93,.43,.58), 'plush-ink':(.07,.055,.13),
}.items(): mat(name,color)
mat('lamp', (1,.55,.18), 2.5)
mat('screen', (.19,.44,.48), .7)
mat('screen-code', (.62,.85,.64), .65)
mat('window', (.035,.09,.15), .3)
mat('window-light', (.67,.43,.17), .7)
mat('blue-led', (.08,.28,.85), 1.4)
mat('glass', (.40,.65,.66))
M['glass'].diffuse_color=(.40,.65,.66,.10)
M['glass'].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.10
M['glass'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.15
M['glass'].surface_render_method='DITHERED'
for i in range(7): mat('floor'+str(i), (.26+i*.018,.13+i*.011,.069+i*.006))

def xyz(p): return (p[0], -p[2], p[1])
def box(name, p, s, material, parent=None, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    obj=bpy.context.object; obj.name=name
    obj.dimensions=(s[0],s[2],s[1]); obj.rotation_euler[2]=-angle
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(M[material])
    # Identical voxel parts share geometry in both Blender and glTF. Keep every
    # object editable while avoiding hundreds of duplicate cube vertex buffers.
    key=(tuple(round(value,7) for value in s),material)
    if key in BOX_MESHES:
        unused=obj.data; obj.data=BOX_MESHES[key]; bpy.data.meshes.remove(unused)
    else: BOX_MESHES[key]=obj.data
    if parent: obj.parent=parent
    return obj

def voxel_volume(name, p, layers, material, parent=None, cell=.025, front=None,
                 elliptical=False, wall=0, opening=0, pleats=0, fold_shade=None, bands=(), centers=(), patches=()):
    """Quantize a tapered silhouette into fine, flat-shaded voxels.
    Greedily merge coplanar exposed faces, so tiny steps do not require an object
    or a complete cube for every cell. A fixed front keeps facial pixels flush.
    """
    geometry_key=(tuple(layers),material,cell,front,elliptical,wall,opening,pleats,fold_shade,bands,centers,patches)
    if geometry_key in VOXEL_MESHES:
        obj=bpy.data.objects.new(name,VOXEL_MESHES[geometry_key]); bpy.context.collection.objects.link(obj)
        obj.location=xyz(p)
        if parent: obj.parent=parent
        return obj
    occupied=set(); fold_depth={}
    for iy in range(math.floor(layers[0][0]/cell), math.ceil(layers[-1][0]/cell)):
        y=(iy+.5)*cell
        if y<layers[0][0] or y>layers[-1][0]: continue
        for lower,upper in zip(layers,layers[1:]):
            if lower[0]<=y<=upper[0]:
                t=(y-lower[0])/(upper[0]-lower[0])
                width=lower[1]+(upper[1]-lower[1])*t
                depth=lower[2]+(upper[2]-lower[2])*t
                break
        center_x=0; center_z=front-depth/2 if front is not None else 0
        if centers:
            if y<=centers[0][0]: cx,cz=centers[0][1:]
            elif y>=centers[-1][0]: cx,cz=centers[-1][1:]
            else:
                lo,hi=next((lo,hi) for lo,hi in zip(centers,centers[1:]) if lo[0]<=y<=hi[0])
                t=(y-lo[0])/(hi[0]-lo[0]); cx=lo[1]+(hi[1]-lo[1])*t; cz=lo[2]+(hi[2]-lo[2])*t
            center_x=cx; center_z+=cz
        for ix in range(math.floor((center_x-width/2)/cell),math.ceil((center_x+width/2)/cell)):
            for iz in range(math.floor((center_z-depth/2)/cell),math.ceil((center_z+depth/2)/cell)):
                x=(ix+.5)*cell-center_x; z=(iz+.5)*cell-center_z
                nx=abs(x)/(width/2); nz=abs(z)/(depth/2)
                fold=(1+math.cos(math.atan2(z/(depth/2),x/(width/2))*pleats))/2 if pleats else 0
                radius=1-.055*fold
                inside=nx*nx+nz*nz<=radius*radius if elliptical else nx<=1 and nz<=1 and nx+nz<=1.8
                if not inside: continue
                if opening and z>0 and abs(x)<opening/2: continue
                if wall and (x/max(width/2-wall,cell))**2+(z/max(depth/2-wall,cell))**2<(radius*.99)**2: continue
                coord=(ix,iy,iz); occupied.add(coord); fold_depth[coord]=fold
    palette=[material]
    if fold_shade: palette.append(fold_shade)
    for _,_,tone in bands:
        if tone not in palette: palette.append(tone)
    for tone,_ in patches:
        if tone not in palette: palette.append(tone)
    planes={}
    for coord in occupied:
        for axis in range(3):
            for sign in [-1,1]:
                neighbor=list(coord); neighbor[axis]+=sign
                if tuple(neighbor) in occupied: continue
                plane=coord[axis]+(1 if sign>0 else 0)
                u,v=(axis+1)%3,(axis+2)%3
                tone=1 if fold_shade and axis!=1 and fold_depth[coord]>.82 else 0
                for lower,upper,band_material in bands:
                    if lower<=(coord[1]+.5)*cell<=upper:
                        tone=palette.index(band_material)
                        break
                if axis==2 and sign>0:
                    x=(coord[0]+.5)*cell; y=(coord[1]+.5)*cell
                    for patch_material,polygon in patches:
                        inside=False
                        for a,b in zip(polygon,polygon[1:]+polygon[:1]):
                            if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: inside=not inside
                        if inside: tone=palette.index(patch_material)
                planes.setdefault((axis,plane,sign,tone),set()).add((coord[u],coord[v]))
    vertices=[]; indices={}; faces=[]; tones=[]
    for (axis,plane,sign,tone),cells in sorted(planes.items()):
        u_axis,v_axis=(axis+1)%3,(axis+2)%3
        while cells:
            u,v=min(cells); width=1; height=1
            while (u+width,v) in cells: width+=1
            while all((u+offset,v+height) in cells for offset in range(width)): height+=1
            cells.difference_update((u+dx,v+dy) for dx in range(width) for dy in range(height))
            corners=[(u,v),(u+width,v),(u+width,v+height),(u,v+height)]
            if sign<0: corners.reverse()
            face=[]
            for cu,cv in corners:
                coord=[0,0,0]; coord[axis]=plane; coord[u_axis]=cu; coord[v_axis]=cv
                key=tuple(coord)
                if key not in indices:
                    indices[key]=len(vertices); vertices.append(xyz(tuple(value*cell for value in key)))
                face.append(indices[key])
            faces.append(tuple(face)); tones.append(tone)
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],faces); mesh.update()
    for tone in palette: mesh.materials.append(M[tone])
    for face,tone in zip(mesh.polygons,tones): face.material_index=tone
    VOXEL_MESHES[geometry_key]=mesh
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
    obj.location=xyz(p)
    if parent: obj.parent=parent
    return obj

def empty(name, p=(0,0,0), parent=None):
    obj=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(obj)
    obj.location=xyz(p)
    if parent: obj.parent=parent
    return obj

def lamp(name, p, power, color, size=.5):
    data=bpy.data.lights.new(name,'POINT'); data.energy=power; data.color=color; data.shadow_soft_size=size
    obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj); obj.location=xyz(p)

def plant(x,z,y=0,scale=1,parent=None):
    box('Ceramic planter',(x,y+.25*scale,z),(.48*scale,.5*scale,.48*scale),'terracotta',parent)
    box('Pot soil',(x,y+.51*scale,z),(.39*scale,.035,.39*scale),'edge',parent)
    for i in range(8):
        a=i*2.4; h=(.75+(i%3)*.19)*scale
        box('Stem',(x+math.sin(a)*.09*scale,y+h*.6,z+math.cos(a)*.09*scale),(.045,h,.045),'wood',parent)
        box('Pixel leaf',(x+math.sin(a)*.22*scale,y+h,z+math.cos(a)*.22*scale),(.37*scale,.15*scale,.24*scale),'leaf-light' if i%3==0 else 'leaf',parent,angle=a)

# Solid foundation and individually modeled staggered floorboards.
box('Foundation',(0,-.24,0),(10,.45,8),'edge')
for row in range(20):
    z=-3.8+row*.4
    for col in range(8):
        left=max(-4.8,-5.4+col*1.45+(row%2)*.72)
        right=min(4.8,-5.4+(col+1)*1.45+(row%2)*.72)
        if right>left:
            box('Oak parquet',((left+right)/2,.015,z),(right-left-.006,.07,.396),'floor'+str(random.randrange(7)))
# Two tall windows wrap around the deepest corner. The low sill, layered foliage
# and partially raised blinds echo the reference without using photographic textures.
box('Back plaster',(0,2.1,-3.95),(10,4.25,.18),'wall')
box('Left plaster',(-4.95,2.1,0),(.18,4.25,8),'wall-left')
for x in [-4.84,4.84]: box('Wall upright',(x,2.12,-3.84),(.15,4.36,.15),'edge')
box('Left front post',(-4.84,2.12,3.84),(.15,4.36,.15),'edge')
box('Back crown',(0,4.29,-3.95),(10.2,.16,.27),'wood')
box('Left crown',(-4.95,4.29,0),(.27,.16,8.2),'wood')
box('Back skirting',(0,.2,-3.81),(9.8,.29,.12),'walnut')
box('Left skirting',(-4.81,.2,0),(.12,.29,7.8),'walnut')
box('Front floor trim',(0,.06,3.95),(10,.15,.13),'wood')
box('Right floor trim',(4.95,.06,0),(.13,.15,8),'wood')

def window(name,position,width,yaw=0):
    group=empty(name,position); group.rotation_euler[2]=yaw
    box('Window outer frame',(0,2.68,0),(width,2.72,.12),'white',group)
    box('Window garden sky',(0,2.68,.075),(width-.18,2.51,.025),'sky',group)
    for i in range(12):
        x=-width/2+.25+i*(width-.5)/11; height=random.uniform(.5,1.1)
        box('Garden tree trunk',(x,1.65,.10),(.04,.50,.025),'wood',group)
        box('Garden foliage',(x,1.78+height*.25,.12),(.37,height,.022),'distant-leaf',group)
        box('Sunlit foliage',(x+.06,1.8+height*.38,.14),(.24,height*.45,.015),'leaf-light',group)
    for x in [-width/2+.09,0,width/2-.09]:
        box('White window mullion',(x,2.68,.19),(.065,2.64,.10),'white',group)
    box('Window crossbar',(0,2.36,.2),(width,.065,.1),'white',group)
    box('Deep windowsill',(0,1.29,.22),(width+.15,.13,.49),'cream',group)
    box('Blind cassette',(0,4.02,.25),(width+.08,.16,.21),'white',group)
    for i in range(12):
        box('Venetian blind slat',(0,3.9-i*.065,.23),(width-.15,.037,.14),'linen',group)
    for x in [-width*.3,width*.3]:
        box('Blind cord',(x,3.52,.32),(.018,.95,.018),'cream',group)
    return group

back_window=window('BackWindow',(-2.65,0,-3.77),3.94)
left_window=window('LeftWindow',(-4.77,0,-2.06),3.28,math.pi/2)
for x in [-4.05,-3.42,-.91]: plant(x,-3.40,1.37,.36)
# Deep-corner workbench, with the monitors stacked vertically on one arm.
desk=empty('Desk',(-2.64,0,-2.95))
box('Desk walnut top',(0,1.25,0),(3.92,.16,1.50),'wood',desk)
box('Desk black underframe',(0,1.1,0),(3.65,.13,1.25),'metal',desk)
for x in [-1.67,1.67]:
    for z in [-.54,.54]: box('Desk leg',(x,.58,z),(.12,1.16,.12),'metal',desk)
box('Desk drawer unit',(-1.38,.69,.1),(.70,.99,1.09),'walnut',desk)
for y in [.4,.7,.99]:
    box('Desk drawer front',(-1.38,y,.66),(.63,.24,.035),'wood',desk)
    box('Desk brass pull',(-1.38,y,.69),(.23,.025,.035),'cream',desk)
box('Desk oversized mat',(.06,1.343,.15),(2.19,.018,.87),'rug',desk)
box('Monitor arm foot',(.08,1.37,-.44),(.62,.065,.31),'metal',desk)
box('Monitor vertical arm',(.08,2.15,-.53),(.08,1.58,.09),'metal',desk)
for index,y in enumerate([1.84,2.64]):
    monitor=empty('MonitorLower' if index==0 else 'MonitorUpper',(.08,y,-.36),desk)
    box('Display bezel',(0,0,0),(1.58,.76,.10),'dark',monitor)
    box('Display panel',(0,0,.063),(1.44,.63,.025),'screen',monitor)
    if index==0:
        box('Code sidebar',(-.58,0,.08),(.19,.58,.012),'book-blue',monitor)
        for row in range(6):
            width=random.uniform(.35,.95)
            box('Editor line',(-.39+width/2,.235-row*.085,.085),(width,.026,.012),'screen-code',monitor)
    else:
        for j,(x,h) in enumerate([(-.49,.17),(-.2,.3),(.09,.41),(.39,.27)]):
            box('Pixel mountain',(x,-.25+h/2,.084),(.37,h,.013),'sage' if j%2 else 'leaf-light',monitor)
        box('Wallpaper sun',(.44,.18,.085),(.14,.14,.014),'lamp',monitor)
    box('Monitor power light',(.65,-.35,.07),(.035,.018,.015),'blue-led',monitor)
# Bookshelf speakers with stepped drivers, a DAC and small everyday objects.
for x in [-1.13,1.30]:
    box('Speaker cabinet',(x,1.70,-.30),(.38,.70,.38),'walnut',desk)
    box('Speaker grille',(x,1.70,-.10),(.30,.58,.03),'dark',desk)
    box('Speaker woofer',(x,1.60,-.077),(.20,.20,.022),'metal',desk)
    box('Speaker dust cap',(x,1.60,-.06),(.10,.10,.015),'cream',desk)
    box('Speaker tweeter',(x,1.87,-.068),(.09,.09,.025),'metal',desk)
box('Mechanical keyboard',(-.13,1.39,.33),(1.07,.08,.34),'cream',desk)
for r in range(3):
    for c in range(12): box('Keyboard key',(-.6+c*.084,1.441,.22+r*.09),(.058,.018,.052),'sage' if c<2 else 'linen',desk)
box('Spacebar',(-.1,1.444,.51),(.42,.02,.055),'book-gold',desk)
box('Mouse',(.70,1.415,.35),(.16,.095,.25),'white',desk)
box('Audio interface',(1.22,1.40,.35),(.47,.13,.26),'metal',desk)
for x in [1.09,1.25,1.38]: box('Audio dial',(x,1.40,.50),(.065,.065,.035),'cream',desk)
box('Desk notebook',(-1.10,1.39,.36),(.45,.075,.58),'book-red',desk,angle=-.12)
box('Coffee coaster',(-1.7,1.35,.37),(.29,.025,.29),'sage',desk)
box('Coffee mug',(-1.7,1.50,.37),(.20,.28,.20),'cream',desk)
box('Coffee surface',(-1.7,1.645,.37),(.15,.012,.15),'edge',desk)
box('Coffee mug handle',(-1.56,1.51,.37),(.10,.14,.07),'cream',desk)
box('Desk lamp base',(1.64,1.37,-.43),(.30,.06,.30),'metal',desk)
box('Desk lamp upright',(1.64,1.79,-.43),(.055,.84,.055),'metal',desk)
box('Desk lamp bar',(1.4,2.19,-.43),(.54,.055,.08),'metal',desk)
box('Desk lamp light',(1.18,2.15,-.43),(.24,.055,.18),'lamp',desk)
# PC tower with a side window and luminous square fans.
box('PC case',(-1.02,.60,-2.96),(.52,1.02,.84),'metal')
box('PC side glass',(-.742,.65,-2.96),(.018,.81,.66),'glass')
for y in [.34,.66,.97]:
    box('PC RGB fan',(-1.02,y,-2.529),(.29,.25,.018),'blue-led')
    box('PC fan hub',(-1.02,y,-2.51),(.14,.12,.022),'metal')
# Miniature models fill the shelves. All display items are modeled in 3D.
def robot(parent,x,y,z,scale=1,color='book-red'):
    group=empty('Collectible robot',(x,y,z),parent)
    def part(name,p,size,material): return box(name,tuple(v*scale for v in p),tuple(v*scale for v in size),material,group)
    part('Robot display plinth',(0,.035,0),(.43,.07,.31),'metal')
    for side in [-1,1]:
        part('Robot boot',(side*.10,.105,.04),(.13,.14,.18),'dark')
        part('Robot leg',(side*.10,.22,0),(.10,.19,.12),color)
        part('Robot arm',(side*.22,.42,0),(.12,.31,.13),color)
        part('Robot shoulder',(side*.20,.55,0),(.19,.13,.19),'cream')
    part('Robot body',(0,.43,0),(.28,.31,.19),color)
    part('Robot chest',(0,.46,.105),(.12,.10,.03),'blue-led')
    part('Robot head',(0,.69,0),(.24,.21,.21),'cream')
    part('Robot visor',(0,.7,.116),(.17,.06,.02),'dark')
    for side in [-1,1]: part('Robot antenna',(side*.13,.82,0),(.04,.16,.04),color)

def car(parent,x,y,z,color='book-gold',scale=1):
    group=empty('Diecast car',(x,y,z),parent)
    def part(name,p,size,material): return box(name,tuple(v*scale for v in p),tuple(v*scale for v in size),material,group)
    part('Car lower',(0,.14,0),(.65,.16,.28),color)
    part('Car cabin',(-.04,.27,0),(.32,.17,.25),color)
    part('Car windshield',(.045,.285,.132),(.12,.10,.013),'screen')
    part('Car rear window',(-.1,.285,.132),(.12,.10,.013),'screen')
    for dx in [-.21,.21]:
        for dz in [-.155,.155]: part('Car wheel',(dx,.10,dz),(.13,.15,.055),'dark')
    for dz in [-.09,.09]: part('Car headlight',(.334,.16,dz),(.02,.055,.05),'cream')

def books(parent,x,y,z,count=5):
    for i in range(count):
        height=.30+(i%3)*.07
        box('Art book',(x+i*.13,y+height/2,z),(.105,height,.32),['book-red','book-blue','paper','book-gold','sage'][i%5],parent)
        box('Book spine stripe',(x+i*.13,y+.10,z+.166),(.075,.02,.012),'cream',parent)

def shelves(name,position,width,yaw=0):
    group=empty(name,position); group.rotation_euler[2]=yaw
    box('Cabinet backing',(0,1.32,-.46),(width,2.48,.055),'walnut',group)
    for x in [-width/2,width/2]:
        for z in [-.45,.45]: box('Black steel cabinet post',(x,1.45,z),(.07,2.9,.07),'metal',group)
        box('Cabinet side glass',(x,1.66,0),(.015,2.12,.79),'glass',group)
    for y in [.15,.74,1.43,2.20,2.90]:
        box('Walnut display shelf',(0,y,0),(width+.08,.08,.98),'wood',group)
        if y>.74:
            box('Warm shelf strip',(0,y-.052,.31),(width-.1,.024,.027),'lamp',group)
    # Thin clear panes leave the miniatures legible at the low render resolution.
    for x in [-width*.25,width*.25]:
        box('Display front glass',(x,1.70,.462),(width/2-.03,2.18,.012),'glass',group)
    box('Display brass handle',(.055,1.7,.49),(.022,.22,.03),'cream',group)
    return group

# Collection wall opposite the desk, opened toward the room.
collection=shelves('CollectionCabinet',(-4.10,0,1.65),2.76,math.pi/2)
for x,color in [(-.88,'book-red'),(0,'book-blue'),(.87,'sage')]: robot(collection,x,2.25,0,.68,color)
for x,color in [(-.84,'book-gold'),(0,'book-red'),(.83,'book-blue')]: car(collection,x,1.48,.1,color,.83)
books(collection,-1.18,.79,.09,6)
# Retro camera and a framed print occupy the remaining shelf.
box('Vintage camera',(.71,1.02,.09),(.61,.34,.32),'metal',collection)
box('Camera silver top',(.71,1.22,.09),(.60,.08,.30),'cream',collection)
box('Camera lens',(.70,1.02,.31),(.26,.26,.17),'dark',collection)
box('Camera lens glass',(.70,1.02,.405),(.15,.15,.022),'screen',collection)
for i in range(4): box('Record sleeve',(-.8+i*.31,.45,.08),(.26,.47,.40),['book-red','sage','paper','book-blue'][i],collection)
box('Storage basket',(.75,.43,.05),(.84,.47,.73),'linen',collection)
for i in range(4): box('Basket weave',(.75,.26+i*.095,.421),(.85,.026,.02),'wood',collection)
robot(collection,-.87,2.96,0,.86,'book-gold')
plant(.90,0,2.96,.45,collection)
box('Framed collection print',(0,3.2,0),(.57,.50,.08),'cream',collection)
box('Print dark inset',(0,3.2,.052),(.45,.38,.015),'book-blue',collection)
box('Print pixel moon',(.06,3.24,.065),(.19,.19,.014),'book-gold',collection)

# Desk, display and bed share the same back-wall alignment, in that order.
display=shelves('WonderDisplay',(.73,0,-3.19),2.86)
# Give the enlarged bed room along the same wall, keeping all display items.
display.scale.x=.85
robot(display,-.94,2.25,0,.69,'book-red')
robot(display,.02,2.25,0,.69,'book-blue')
robot(display,.98,2.25,0,.69,'sage')
# A terrarium diorama with tiny trees and a model house.
box('Diorama soil',(-.68,1.5,0),(1.12,.08,.65),'edge',display)
box('Diorama grass',(-.68,1.55,0),(1.10,.045,.63),'leaf',display)
box('Tiny house',(-.68,1.74,0),(.34,.31,.30),'cream',display)
box('Tiny roof',(-.68,1.92,0),(.43,.11,.36),'book-red',display)
box('Tiny lit door',(-.68,1.69,.16),(.09,.15,.015),'lamp',display)
for x in [-1.1,-.27]:
    box('Diorama tree',(x,1.70,-.05),(.045,.30,.045),'wood',display)
    box('Diorama treetop',(x,1.87,-.05),(.20,.24,.21),'leaf-light',display)
car(display,.75,1.49,.06,'book-gold',1.0)
# Game handheld, cartridges and stacked magazines.
box('Retro handheld',(-.88,1.07,.07),(.47,.49,.13),'cream',display)
box('Handheld screen',(-.88,1.16,.145),(.32,.22,.022),'screen',display)
box('Handheld d pad',(-1.01,.945,.153),(.105,.035,.025),'metal',display)
box('Handheld d pad',(-1.01,.945,.153),(.035,.105,.025),'metal',display)
for x in [-.79,-.71]: box('Handheld button',(x,.956,.151),(.045,.045,.025),'book-red',display)
books(display,-.28,.79,.09,4)
for i in range(4): box('Design magazine',(.92,.82+i*.07,.04),(.65,.06,.51),['paper','book-blue','paper','book-gold'][i],display)
for x in [-.93,0,.93]:
    box('Archive box',(x,.43,.02),(.77,.46,.70),'linen',display)
    box('Archive label',(x,.48,.382),(.33,.10,.018),'paper',display)
    box('Archive label line',(x,.48,.393),(.21,.02,.014),'metal',display)
# Large spacecraft on the top shelf, with a stepped silhouette and display stand.
ship=empty('Model spacecraft',(.03,3.18,.02),display)
box('Spacecraft pedestal',(0,-.17,0),(.53,.10,.43),'metal',ship)
box('Spacecraft stand',(0,0,0),(.065,.38,.065),'metal',ship)
box('Spacecraft fuselage',(0,.15,0),(1.09,.20,.37),'cream',ship)
box('Spacecraft nose',(.61,.15,0),(.25,.13,.24),'white',ship)
box('Spacecraft canopy',(.28,.27,0),(.28,.11,.22),'screen',ship)
for z in [-.37,.37]:
    box('Spacecraft wing',(-.12,.11,z),(.70,.06,.47),'white',ship,angle=.18 if z>0 else -.18)
    box('Spacecraft engine',(-.49,.15,z),(.34,.15,.16),'metal',ship)
    box('Spacecraft thruster',(-.67,.15,z),(.025,.10,.10),'blue-led',ship)
plant(1.13,.02,2.96,.36,display)
# Pegboard, cards and geometric blue accent tiles above the display.
box('Pegboard',(.7045,3.55,-3.80),(2.686,1.12,.055),'wood')
for x,y in [(1.72,3.66),(2.05,3.95),(2.39,3.66),(2.73,3.95),(3.07,3.66)]:
    tile=box('Geometric wall light',((x-2.98)*.85+.73,y,-3.74),(.38,.38,.06),'blue-led')
    tile.rotation_euler[1]=math.pi/4
for x,y in [(3.61,3.48),(4.12,3.67)]:
    box('Pinned art card',((x-2.98)*.85+.73,y,-3.73),(.37,.46,.018),'paper')
    box('Art card block',((x-2.98)*.85+.73,y-.02,-3.714),(.23,.24,.014),'book-red' if x<4 else 'sage')
    box('Card pin',((x-2.98)*.85+.73,y+.2,-3.695),(.03,.03,.025),'book-gold')

# Pixel-art redraws of the user's prints, staggered above the bed. Image planes
# face into the room (+Z); explicit UVs keep each square upright and uncropped.
def poster(name, filename, x, y, size, tilt):
    group=empty(name,(x,y,-3.825))
    group.rotation_euler[1]=math.radians(tilt)
    box('Poster paper backing',(0,0,0),(size+.035,size+.035,.018),'paper',group)
    material=mat('poster-'+filename,(1,1,1))
    image=bpy.data.images.load(str(ROOT/'assets/pixel-room/posters'/filename))
    image.pack()
    image.filepath='//posters/'+filename
    texture=material.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image=image
    texture.interpolation='Closest'
    material.node_tree.links.new(texture.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    half=size/2
    mesh=bpy.data.meshes.new(name+' artwork')
    mesh.from_pydata([xyz(p) for p in [(-half,-half,.011),(half,-half,.011),(half,half,.011),(-half,half,.011)]],[],[(0,1,2,3)])
    mesh.uv_layers.new(name='Poster UV')
    for loop,uv in zip(mesh.uv_layers.active.data,[(0,0),(1,0),(1,1),(0,1)]): loop.uv=uv
    mesh.materials.append(material)
    artwork=bpy.data.objects.new(name+' artwork',mesh)
    bpy.context.collection.objects.link(artwork); artwork.parent=group
    for tape_x in [-size*.32,size*.32]:
        box('Poster masking tape',(tape_x,half,.024),(.16,.065,.012),'cream',group)
    return group

poster('PosterYouth','omnipotent-youth-pixel.png',2.70,3.49,.94,-3)
poster('PosterPrism','prism-pixel.png',4.02,3.36,1.08,2)
poster('PosterEye','eye-pixel.png',2.84,2.34,1.00,2)
poster('PosterPortrait','portrait-pixel.png',4.11,2.17,.92,-4)

# Back-wall bed: two pillows, a ribbed blue-green duvet and a rust throw.
bed=empty('Bed',(3.403,0,-1.6325))
# Blender axes are X width / Y depth / Z height: 20% wider, 25% longer.
# Keep the headboard against the wall and the right edge inside the floor trim.
bed.scale=(1.20,1.25,1)
box('Low bed frame',(0,.34,0),(2.23,.49,3.18),'walnut',bed)
box('Bed mattress',(0,.66,0),(2.16,.28,3.07),'linen',bed)
box('Bed headboard',(0,.97,-1.60),(2.27,1.34,.14),'wood',bed)
for x in [-.51,.51]: box('Bed pillow',(x,.89,-1.10),(.89,.22,.58),'paper',bed)
box('Striped duvet',(0,.86,.31),(2.20,.22,2.40),'blanket',bed)
for x in range(17):
    box('Duvet fine rib',(-1.035+x*.13,.98,.31),(.025,.023,2.36),'sage',bed)
box('Duvet drape',(-1.105,.61,.31),(.04,.57,2.40),'blanket',bed)
box('Rust throw',(0,1.01,-.61),(2.24,.09,.66),'terracotta',bed)
for i in range(13): box('Throw knit',(-1.03+i*.17,1.064,-.61),(.075,.025,.65),'book-red',bed)
for x in [-.8,.8]:
    for z in [-1.23,1.23]: box('Bed short foot',(x,.17,z),(.14,.25,.14),'metal',bed)

# A small stuffed octopus rests on the duvet, separate from the moving characters.
# Chunky voxel steps shape the head and eight short, splayed plush tentacles.
plush=empty('OctopusPlush',(4.08,1.005,-1.43))
# Match the orthographic camera's horizontal viewing direction (11, 10, 14).
plush.rotation_euler[2]=math.atan2(11,14)
voxel_volume('Plush round head',(0,0,0),[
    (.09,.34,.31),(.15,.47,.42),(.28,.52,.46),
    (.39,.46,.41),(.48,.30,.27),(.51,.13,.12),
],'plush-purple',plush,cell=.06,elliptical=True)
for index in range(8):
    angle=index*math.tau/8
    tentacle=empty('Plush tentacle '+str(index+1),
                   (.26*math.sin(angle),0,.26*math.cos(angle)),plush)
    tentacle.rotation_euler[2]=angle
    voxel_volume('Plush soft tentacle',(0,0,0),[
        (0,.12,.23),(.035,.19,.29),(.09,.18,.26),(.145,.12,.18),
    ],'plush-purple',tentacle,cell=.05,elliptical=True)
    box('Plush pale underside',(0,.025,.055),(.10,.03,.14),'plush-light',tentacle)
for x in [-.105,.105]:
    eye=box('Plush embroidered eye',(x,.285,.238),(.060,.080,.025),'plush-ink',plush)
    eye['faceDetail']=True
    box('Plush eye sparkle',(x-.014,.305,.255),(.025,.025,.012),'white',plush)['faceDetail']=True
    box('Plush rosy cheek',(x*1.55,.237,.236),(.075,.035,.022),'plush-pink',plush)['faceDetail']=True
for x,y in [(-.028,.231),(0,.216),(.028,.231)]:
    box('Plush stitched smile',(x,y,.250),(.030,.025,.017),'plush-ink',plush)['faceDetail']=True

# Geometric woven rug, in the clear central circulation area.
box('Room geometric rug',(-.23,.075,.80),(3.86,.025,3.90),'rug')
for col in range(5):
    for row in range(5):
        x=-1.70+col*.74; z=-.70+row*.74
        box('Rug gold square',(x,.092,z),(.63,.009,.63),'book-gold')
        box('Rug green square',(x,.098,z),(.51,.006,.51),'sage')
        box('Rug dark square',(x,.102,z),(.35,.005,.35),'rug')
for x in range(20):
    for z in [-1.2,2.8]: box('Rug fringe',(-2.02+x*.19,.078,z),(.035,.014,.10),'linen')
lamp('Desk warm light',(-1.02,2.08,-2.98),90,(1,.63,.32))
lamp('Display warm light',(.73,2.5,-2.61),90,(1,.61,.29))
lamp('Collection warm light',(-3.45,2.5,1.65),90,(1,.61,.29))

# Only the floor anchor is exported; Luo Xiaohei is drawn as a 2D sprite.
cat=empty('Cat',(layout['cat']['spawn']['x'],.112,layout['cat']['spawn']['z']))
cat['character']='luoxiaohei-sprite'
# Navigation anchor only; the browser draws Frieren from a 2D pixel spritesheet.
player=empty('Player')
player['character']='frieren-sprite'
player.location=xyz((layout['spawn']['x'],.112,layout['spawn']['z']))
for zone in layout['zones']:
    marker=empty('Zone_'+zone['id'],(zone['x'],0,zone['z']))
    marker['zoneId']=zone['id']
# Blender preview lighting. Browser lighting is controlled independently.
bpy.context.scene.world.color=(.11,.13,.17)
lamp('Soft room fill',(1,6,2),350,(.72,.79,1),3)
lamp('Warm overhead',(-2,5,-1),450,(1,.72,.46),3)
bpy.ops.object.camera_add(location=xyz((11,10,14)))
camera=bpy.context.object; camera.name='Isometric camera'
direction=Vector(xyz((0,1.1,0)))-camera.location
camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=15.3
scene=bpy.context.scene; scene.camera=camera
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=960; scene.render.resolution_y=760; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/pixel-room/octopus-room.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/octopus-room.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True)
runpy.run_path(str(ROOT/'scripts/blender/pack_glb_normals.py'))['pack_glb_normals'](ROOT/'public/models/octopus-room.glb')
print('ROOM_EXPORTED', len(bpy.data.objects), 'objects')
