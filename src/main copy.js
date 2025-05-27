





const loader = new GLTFLoader();
loader.load('/assets/cube.glb',
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(1, 1, 1);
    scene.add(model);
    camera.lookAt(model.position);
  },
  undefined,
  (error) => {
    console.error('Fehler beim Laden:', error);
  }
);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
