# Lunar scene models, step 1 of 2 (Blender, headless). Run through build.sh, not directly.
#   blender -b --factory-startup --python build.py -- RAW_DIR WORK_DIR
# Reads the raw NASA 3D Resources GLBs from RAW_DIR, writes hdu.glb, sev.glb, astronaut.glb
# (uncompressed, PNG textures, metres, Y up, origin at the bottom centre) into WORK_DIR,
# plus the repainted textures as PNG so they can be checked by eye. build.sh compresses them.
import bpy, sys, os, json, math
import numpy as np
from mathutils import Matrix, Vector

RAW, WORK = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(WORK, exist_ok=True)
REPORT = {}

# Logo rectangles to repaint as blank panel, in texture pixels from the TOP-LEFT corner (x0, y0, x1, y1).
# Found by eye on the 1024 px source textures. Each is filled row by row with a straight blend between the
# pixel just left and just right of it, which keeps the horizontal panel seams and the shading gradient.
HDU_01_LOGOS = [
    (129, 0, 152, 666),   # left strip: small US flag and small NASA insignia on every segment
    (192, 66, 252, 128),  # US flag (upper)
    (186, 150, 256, 210),  # NASA insignia (upper)
    (180, 228, 264, 292),  # X-Hab logo and its small text (upper)
    (192, 390, 252, 452),  # US flag (lower)
    (186, 474, 256, 536),  # NASA insignia (lower)
    (180, 550, 264, 608),  # X-Hab logo and its small text (lower)
    (34, 232, 94, 286),   # HDU badge, segment D
    (66, 556, 124, 608),  # HDU badge, segment H
]
ASTRONAUT_LOGOS = [
    (886, 22, 964, 84),   # US flag on the backpack
    (900, 184, 958, 240),  # NASA insignia on the backpack
    (792, 382, 872, 444),  # mission patch
    (806, 712, 864, 762),  # US flag on the sleeve
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path, weld=False):
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=weld)


def bake_meshes():
    """Unparent, drop non-mesh objects, apply every transform: mesh data ends up in world space (Z up)."""
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes:
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        o.data.update()
    return meshes


def transform_all(meshes, m):
    for o in meshes:
        o.data.transform(m)
        o.data.update()


def bbox(meshes):
    mn = Vector((1e18,) * 3)
    mx = Vector((-1e18,) * 3)
    for o in meshes:
        co = np.empty(len(o.data.vertices) * 3)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        for i in range(3):
            mn[i] = min(mn[i], co[:, i].min())
            mx[i] = max(mx[i], co[:, i].max())
    return mn, mx


def to_bottom_centre(meshes):
    mn, mx = bbox(meshes)
    transform_all(meshes, Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))))


def tris(meshes):
    n = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        n += len(o.data.loop_triangles)
    return n


def size_m(meshes):
    mn, mx = bbox(meshes)
    # Blender Z up -> report as glTF (x, y=up, z)
    return [round(mx.x - mn.x, 3), round(mx.z - mn.z, 3), round(mx.y - mn.y, 3)]


def images_of(meshes):
    out = []
    for o in meshes:
        for mat in o.data.materials:
            if mat and mat.node_tree:
                for n in mat.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image and n.image not in out:
                        out.append(n.image)
    return out


def repaint(img, rects, name):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    for x0, y0, x1, y1 in rects:
        for yt in range(y0, y1 + 1):
            r = h - 1 - yt  # Blender rows run bottom-up
            left = px[r, max(x0 - 1, 0)].copy()
            right = px[r, min(x1 + 1, w - 1)].copy()
            n = x1 - x0 + 1
            t = (np.arange(n, dtype=np.float32) + 1) / (n + 1)
            px[r, x0:x1 + 1] = left[None, :] * (1 - t[:, None]) + right[None, :] * t[:, None]
    img.pixels.foreach_set(px.ravel())
    path = os.path.join(WORK, name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    # The importer keeps the original GLB bytes packed and the exporter writes those, so load the repainted
    # file as a new image and swap it into every node that used the old one.
    new = bpy.data.images.load(path)
    for mat in bpy.data.materials:
        for n in (mat.node_tree.nodes if mat.node_tree else []):
            if n.type == "TEX_IMAGE" and n.image == img:
                n.image = new
    bpy.data.images.remove(img)
    return path


def plain_materials(meshes):
    """Matte, opaque PBR only: no transmission (an extra render pass in three.js) and no specular extension."""
    for o in meshes:
        for mat in o.data.materials:
            bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if mat else None
            if not bsdf:
                continue
            for key, val in (("Transmission Weight", 0.0), ("Specular IOR Level", 0.5), ("IOR", 1.5),
                             ("Metallic", 0.0), ("Roughness", 0.8), ("Specular Tint", (1, 1, 1, 1))):
                sock = bsdf.inputs.get(key)
                if sock is None:
                    continue
                for link in list(sock.links):
                    mat.node_tree.links.remove(link)
                sock.default_value = val


def export(meshes, name, extra):
    plain_materials(meshes)
    for o in bpy.context.scene.objects:
        o.select_set(o in meshes)
    out = os.path.join(WORK, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, use_selection=True,
                              export_image_format="AUTO", export_apply=True, export_animations=False)
    REPORT[name] = {"tris": tris(meshes), "size_m_xyz_yup": size_m(meshes),
                    "materials": sorted({m.name for o in meshes for m in o.data.materials if m}), **extra}


# ---- HDU: Habitat Demonstration Unit, parts 1 + 2 share one frame; source units are inches ----
reset()
import_glb(os.path.join(RAW, "hdu_part1.glb"))
import_glb(os.path.join(RAW, "hdu_part2.glb"))
hdu = bake_meshes()
transform_all(hdu, Matrix.Scale(0.0254, 4))
to_bottom_centre(hdu)
painted = []
for img in images_of(hdu):
    if img.name.startswith("HDU_01"):
        painted.append(repaint(img, HDU_01_LOGOS, "hdu_01_repainted"))
export(hdu, "hdu", {"repainted": painted})

# ---- SEV: Space Exploration Vehicle; already metres; 413k tris with split vertices ----
reset()
import_glb(os.path.join(RAW, "sev.glb"), weld=True)  # weld first: collapse-decimate tears UV seams otherwise
sev = bake_meshes()
to_bottom_centre(sev)
before = tris(sev)
TARGET = 40000
for o in sev:
    mod = o.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = TARGET / before
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier="dec")
# Keep the colour map only: the bump and specular maps cost two 4096 textures for little at this distance.
for o in sev:
    for mat in o.data.materials:
        nt = mat.node_tree
        for n in list(nt.nodes):
            if n.type == "TEX_IMAGE" and n.image and "Color" not in n.image.name:
                nt.nodes.remove(n)
        for n in list(nt.nodes):
            if n.type in ("NORMAL_MAP", "BUMP"):
                nt.nodes.remove(n)
export(sev, "sev", {"tris_before": before})

# ---- Astronaut: static T-pose mesh, arbitrary units ----
reset()
import_glb(os.path.join(RAW, "astronaut.glb"))
ast = bake_meshes()
mn, mx = bbox(ast)
H = 1.85
transform_all(ast, Matrix.Scale(H / (mx.z - mn.z), 4))
to_bottom_centre(ast)

# Drop the arms: rotate the vertices outboard of each shoulder about a shoulder pivot, with a smooth
# ramp across the shoulder so the mesh does not tear. Thresholds scale with the figure height.
ANGLE = math.radians(72)
X0, X1 = 0.12 * H, 0.19 * H
ob = max(ast, key=lambda o: len(o.data.vertices))
moved = 0
for o in ast:
    co = [v.co.copy() for v in o.data.vertices]
    wide = max(abs(c.x) for c in co)
    hands = [c for c in co if abs(c.x) > wide - 0.03 * H]
    if o is ob:
        sh_z = sum(c.z for c in hands) / len(hands)
        sh_y = sum(c.y for c in hands) / len(hands)
for o in ast:
    for v in o.data.vertices:
        c = v.co
        ax = abs(c.x)
        if ax < X0 or c.z < sh_z - 0.19 * H or abs(c.y - sh_y) > 0.09 * H:
            continue
        t = min(1.0, (ax - X0) / (X1 - X0))
        t = t * t * (3 - 2 * t)
        s = 1 if c.x > 0 else -1
        pivot = Vector((s * X0, c.y, sh_z))
        v.co = pivot + Matrix.Rotation(s * ANGLE * t, 3, "Y") @ (c - pivot)
        moved += 1
    o.data.update()
to_bottom_centre(ast)
painted = []
for img in images_of(ast):
    if img.size[0] >= 1024:
        painted.append(repaint(img, ASTRONAUT_LOGOS, "astronaut_repainted"))
export(ast, "astronaut", {"posed_verts": moved, "repainted": painted})

print("LUNARJSON " + json.dumps(REPORT))
