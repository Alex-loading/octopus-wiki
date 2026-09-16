"""Legacy 3D portrait renderer; current avatars use public/sprites/frieren.png."""
import bpy
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/pixel-room/octopus-room.blend'))
player=bpy.data.objects['Player']
if player.get('character') == 'frieren-sprite':
    raise RuntimeError('The avatar is now 2D. Preview public/sprites/frieren.png; no 3D character is present.')
player.location=(0,0,.104)
player.rotation_euler=(0,0,0)
def belongs_to_player(obj):
    while obj:
        if obj==player: return True
        obj=obj.parent
    return False
for obj in bpy.data.objects:
    if obj.type=='MESH' and not belongs_to_player(obj): obj.hide_render=True
    if obj.type=='LIGHT': obj.hide_render=True
scene=bpy.context.scene
scene.world.use_nodes=True
background=scene.world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value=(.16,.20,.25,1)
background.inputs['Strength'].default_value=.65
for name,position,energy,color,size in [
    ('Portrait key',(-3,-4,5),360,(1,.88,.76),4),
    ('Portrait fill',(3,-2,3),260,(.76,.86,1),3),
    ('Portrait rim',(1,3,4),300,(.86,.92,1),2),
]:
    light=bpy.data.lights.new(name,'AREA'); light.energy=energy; light.color=color; light.shape='DISK'; light.size=size
    obj=bpy.data.objects.new(name,light); bpy.context.collection.objects.link(obj); obj.location=position
    obj.rotation_euler=(Vector((0,0,.9))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=scene.camera
camera.location=(1.9,-5,2.2)
camera.rotation_euler=(Vector((0,0,.90))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=2.08
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=480; scene.render.resolution_y=600; scene.render.resolution_percentage=100
scene.render.film_transparent=False
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(root/'assets/pixel-room/frieren-detail.png')
bpy.ops.render.render(write_still=True)
