import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// A small, shared palette lets the furniture read like painted pixels. The
// character spritesheet is already shaded and is added after this conversion.
const ROOM_PALETTE: Record<string, string> = {
  walnut: '#79543c', wood: '#b58a59', edge: '#35433e',
  wall: '#a8b29a', 'wall-left': '#839c8b', cream: '#eadab0',
  dark: '#25333b', metal: '#35464a', sage: '#89a36b',
  leaf: '#427653', 'leaf-light': '#a3c66b', terracotta: '#c37e5c',
  linen: '#e4d9b4', blanket: '#87ad98', rug: '#4e7b74',
  'book-red': '#c37463', 'book-blue': '#588d9b', 'book-gold': '#d6ad5d',
  paper: '#efe3bb', white: '#e7e6d6', sky: '#6cabb3', 'distant-leaf': '#699b70',
  'cat-black': '#26323a', 'cat-highlight': '#3e4b56',
  floor0: '#9b7852', floor1: '#a48055', floor2: '#ae895b', floor3: '#b58f60',
  floor4: '#bd9666', floor5: '#c09b6d', floor6: '#c7a575',
};

/** Convert once per source material, before the static furniture is batched. */
export function createIllustratedMaterials() {
  const converted = new Map<string, THREE.MeshToonMaterial>();
  const sources = new Set<THREE.Material>();
  const gradient = new THREE.DataTexture(new Uint8Array([55, 115, 185, 255]), 4, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;

  return {
    convert(source: THREE.Material, character = false): THREE.MeshToonMaterial {
      const key = `${source.uuid}:${character}`;
      const cached = converted.get(key);
      if (cached) return cached;
      const original = source as THREE.MeshStandardMaterial;
      const material = new THREE.MeshToonMaterial({
        color: !character && ROOM_PALETTE[source.name] ? new THREE.Color(ROOM_PALETTE[source.name]) : original.color,
        map: original.map,
        emissive: original.emissive,
        emissiveMap: original.emissiveMap,
        emissiveIntensity: Math.min(original.emissiveIntensity ?? 1, 1.25),
        gradientMap: gradient,
        transparent: source.transparent,
        opacity: source.opacity,
        alphaTest: source.alphaTest,
        side: source.side,
        depthWrite: source.name !== 'glass' && source.depthWrite,
        vertexColors: original.vertexColors,
      });
      material.name = source.name;
      material.shadowSide = THREE.BackSide;
      // Quantize the combined illumination, not each colored lamp independently.
      // This keeps four coherent shade families instead of smooth PBR gradients.
      material.onBeforeCompile = shader => {
        if (character) {
          // The sprite-like figure uses a broad front light. Suppress the
          // lighting changes across sub-pixel voxel treads, keeping its contour.
          shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
            #include <normal_fragment_maps>
            normal = normalize(mix(normal, vec3(0.0, 0.0, 1.0), 0.65));
          `);
        }
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          vec3 receivedLight = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse)
            / max(diffuseColor.rgb, vec3(0.001));
          float brightness = dot(receivedLight, vec3(0.2126, 0.7152, 0.0722)) + ${character ? '0.32' : '0.0'};
          float band = brightness < 0.52 ? 0.42 : brightness < 0.90 ? 0.64 : brightness < 1.24 ? 0.86 : 1.08;
          vec3 shadeTint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.98, 0.88), (band - 0.42) / 0.66);
          outgoingLight = diffuseColor.rgb * shadeTint * band + totalEmissiveRadiance;
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => `room-illustration-four-tones-v1:${character}`;
      converted.set(key, material);
      sources.add(source);
      return material;
    },
    releaseSources() { for (const source of sources) source.dispose(); sources.clear(); },
    dispose() { gradient.dispose(); },
  };
}

export function illustrationResolution(width: number, height: number) {
  // Never shrink mobile pixels; desktop gets a consistent fine pixel-art grid.
  const scale = Math.min(1, 800 / Math.max(width, 1), 520 / Math.max(height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** One scene pass and one full-screen pass; no second copy of animated meshes. */
export function createIllustrationRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
  });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const ink = new THREE.ShaderMaterial({
    name: 'Pixel illustration contours',
    uniforms: {
      colorMap: { value: target.texture }, depthMap: { value: target.depthTexture },
      texel: { value: new THREE.Vector2(1, 1) }, depthRange: { value: camera.far - camera.near },
      edgeThreshold: { value: .085 },
    },
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D colorMap;
      uniform sampler2D depthMap;
      uniform vec2 texel;
      uniform float depthRange;
      uniform float edgeThreshold;
      varying vec2 vUv;
      void main() {
        vec4 color = texture2D(colorMap, vUv);
        float center = texture2D(depthMap, vUv).r;
        float closest = center;
        closest = min(closest, texture2D(depthMap, vUv + vec2(texel.x, 0.0)).r);
        closest = min(closest, texture2D(depthMap, vUv - vec2(texel.x, 0.0)).r);
        closest = min(closest, texture2D(depthMap, vUv + vec2(0.0, texel.y)).r);
        closest = min(closest, texture2D(depthMap, vUv - vec2(0.0, texel.y)).r);
        // Ignore tiny voxel steps: outline silhouettes and occlusion boundaries,
        // rather than drawing a grid over every hair strand and sleeve surface.
        float edge = step(edgeThreshold, (center - closest) * depthRange);
        vec3 outline = mix(vec3(0.015, 0.026, 0.035), color.rgb * 0.24, 0.4);
        gl_FragColor = vec4(mix(color.rgb, outline, edge * 0.88), max(color.a, edge));
        #include <colorspace_fragment>
      }
    `,
  });
  const quad = new FullScreenQuad(ink);
  return {
    resize(width: number, height: number) {
      const size = illustrationResolution(width, height);
      renderer.setSize(size.width, size.height, false);
      target.setSize(size.width, size.height);
      ink.uniforms.texel.value.set(1 / size.width, 1 / size.height);
      // Orthographic depth is linear. Scale with world-space pixel size so that
      // a sloping floor never turns into contour lines at narrow viewports.
      ink.uniforms.edgeThreshold.value = Math.max(.085, (camera.top - camera.bottom) / size.height * 3);
    },
    render() {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      quad.render(renderer);
    },
    dispose() { target.dispose(); ink.dispose(); quad.dispose(); },
  };
}
