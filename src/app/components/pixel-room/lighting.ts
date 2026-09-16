import * as THREE from 'three';

/** Fixtures and their targets are authored together in Blender; no duplicated
 * furniture coordinates in the browser, even for rotated/scaled shelves. */
export function createRoomLighting(scene: THREE.Scene, root: THREE.Object3D) {
  const owned: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(object: T): T => { scene.add(object); owned.push(object); return object; };
  const position = (name: string) => {
    const anchor = root.getObjectByName(name);
    if (!anchor) throw new Error(`房间灯具位置缺失：${name}`);
    return anchor.getWorldPosition(new THREE.Vector3());
  };
  const ambient = add(new THREE.HemisphereLight(0xd4e6e5, 0x647b70, 1.45));
  const sunlight = add(new THREE.DirectionalLight(0xffe3b2, 3));
  sunlight.position.set(-3, 8, 5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 25 });
  sunlight.shadow.bias = -.0002; sunlight.shadow.normalBias = .07;

  const spots = [
    { name: 'DeskLamp', intensity: 3.2, distance: 7, angle: 1.20, bounce: 4.5 },
    { name: 'ReadingLamp', intensity: 4, distance: 8, angle: 1.25, bounce: 5 },
    { name: 'CollectionSpot', intensity: 4.5, distance: 7.5, angle: 1.14, bounce: 5 },
  ].map(spec => {
    const light = add(new THREE.SpotLight(0xffcd93, spec.intensity, spec.distance, spec.angle, 1, 2));
    light.name = spec.name;
    light.position.copy(position(`Light_${spec.name}`));
    light.target.position.copy(position(`Aim_${spec.name}`)); add(light.target);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = .08;
    light.shadow.bias = -.0003; light.shadow.normalBias = .035;
    // Broad spill represents light reflected around the room from each fixture.
    // Keep it shadow-free, with the weaker spot supplying nearby contact shadows.
    const bounce = add(new THREE.PointLight(0xffd5a5, spec.bounce, 12, 1.6));
    bounce.name = `${spec.name}Bounce`;
    bounce.position.copy(light.position);
    return { light, bounce, nightIntensity: spec.intensity, nightBounce: spec.bounce };
  });
  const screen = add(new THREE.PointLight(0x8fcfdf, 2.4, 3.3, 2));
  screen.name = 'ScreenSpill'; screen.position.copy(position('Light_Screen'));
  // Modest shelf bounce fills the small displays without flooding the floor.
  const shelf = add(new THREE.PointLight(0xffbd7c, .6, 2.1, 2));
  shelf.position.set(.73, 1.9, -2.60);
  const window = add(new THREE.PointLight(0x7697bc, 10, 6, 2)); window.position.set(-4, 2.4, -2);
  const backWindow = add(new THREE.PointLight(0xadd8db, 9, 6, 2)); backWindow.position.set(-2.65, 3.1, -3.4);
  const setNight = (night: boolean) => {
    ambient.color.set(night ? 0xffd8ac : 0xd4e6e5);
    ambient.groundColor.set(night ? 0x856248 : 0x647b70);
    ambient.intensity = night ? .42 : 1.45;
    sunlight.color.set(night ? 0x819fc8 : 0xffe3b2);
    sunlight.intensity = night ? .10 : 3;
    sunlight.castShadow = !night;
    for (const { light, bounce, nightIntensity, nightBounce } of spots) {
      light.intensity = night ? nightIntensity : nightIntensity * .12;
      light.castShadow = night;
      bounce.intensity = night ? nightBounce : 0;
    }
    screen.intensity = night ? 2.4 : .35;
    shelf.intensity = night ? .9 : .5;
    window.intensity = night ? .14 : 10;
    backWindow.intensity = night ? .12 : 9;
  };
  setNight(false);
  return {
    setNight,
    dispose() {
      for (const object of owned) {
        if (object instanceof THREE.SpotLight || object instanceof THREE.DirectionalLight) object.shadow.dispose();
        object.removeFromParent();
      }
    },
  };
}
