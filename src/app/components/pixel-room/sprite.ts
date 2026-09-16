import { SpriteMaterial, Vector3, type Camera, type SpriteMaterialParameters } from 'three';

/** Depth of an upright cutout, while retaining the screen-facing pixel drawing. */
export function uprightDepthSlope(camera: Camera) {
  camera.updateMatrixWorld();
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const back = new Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
  return back.y / Math.max(.01, up.y);
}

export function createUprightSpriteMaterial(camera: Camera, options: SpriteMaterialParameters) {
  const material = new SpriteMaterial(options);
  const slope = { value: uprightDepthSlope(camera) };
  material.onBeforeCompile = shader => {
    shader.uniforms.uprightDepthSlope = slope;
    shader.vertexShader = 'uniform float uprightDepthSlope;\n' + shader.vertexShader.replace(
      'mvPosition.xy += rotatedPosition;',
      'mvPosition.xy += rotatedPosition;\n mvPosition.z += rotatedPosition.y * uprightDepthSlope;',
    );
  };
  material.customProgramCacheKey = () => 'upright-pixel-sprite-depth-v1';
  return material;
}
