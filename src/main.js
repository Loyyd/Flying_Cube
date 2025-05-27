import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- Game Constants ---
  const GRID_SIZE = 50;
  const PLAYER_SIZE = 1;
  const PLAYER_SPEED = 5.0; // Units per second
  const PLAYER_NORMAL_COLOR = 0x4488ff; // Brighter Blue
  const PLAYER_ACTIVE_COLOR = 0xff4444; // Brighter Red

  const ENEMY_SIZE = 0.5;
  const ENEMY_COLOR = 0x993399; // Darker Purple
  const ENEMY_SPEED_PER_SEC = 1.0; // Units per second
  const ENEMY_SPAWN_INTERVAL = 2000; // ms
  const ENEMY_SPAWN_RADIUS_FACTOR = 1.0; // Adjusted to spawn at the edge of the map

  const OBSTACLE_WALL_COLOR = 0x666666;
  const OBSTACLE_RANDOM_COLOR = 0x5070C0; // Bluish grey
  const NUM_RANDOM_OBSTACLES = 50;

  const SHOT_ACTIVE_COLOR = 0xff0000;
  const SHOT_RADIUS = 2;
  const SHOT_RANGE = 10;
  const SHOT_EFFECT_DURATION_S = 2.0;
  const SHOT_COOLDOWN_S = 0.5;
  const EXPLOSION_DELAY_S = 0.3; // Delay before explosion

  const CAMERA_Y_OFFSET = 18; // Slightly higher for better shadow visibility
  const CAMERA_Z_OFFSET = 12;

  const SCENE_BACKGROUND_COLOR = 0x282c34; // Dark bluish grey
  const FOG_NEAR_FACTOR = 0.8; // Fog starts closer to camera Y
  const FOG_FAR_FACTOR = 2.5;  // Fog ends further

  // --- Scene Setup ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
  scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, CAMERA_Y_OFFSET * FOG_NEAR_FACTOR, CAMERA_Y_OFFSET + GRID_SIZE * FOG_FAR_FACTOR);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

  document.getElementById('canvas-container').appendChild(renderer.domElement);

  const clock = new THREE.Clock();

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Brighter ambient
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Brighter directional
  directionalLight.position.set(GRID_SIZE * 0.3, GRID_SIZE * 0.6, GRID_SIZE * 0.2); // Angled for better shadows
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048; // Higher shadow map resolution
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = GRID_SIZE * 1.5;
  directionalLight.shadow.camera.left = -GRID_SIZE / 1.5;
  directionalLight.shadow.camera.right = GRID_SIZE / 1.5;
  directionalLight.shadow.camera.top = GRID_SIZE / 1.5;
  directionalLight.shadow.camera.bottom = -GRID_SIZE / 1.5;
  scene.add(directionalLight);


  // --- Raycasting & Mouse ---
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let cursorWorld = new THREE.Vector3();
  const groundPlaneRay = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // --- Game State ---
  let activeMode = false;
  let canShoot = true;
  let score = 0;
  let gameOver = false;
  let shotCooldownTimer = 0;
  let lastShotDirection = new THREE.Vector3(0, 0, -1);
  let enemySpawnTimer = ENEMY_SPAWN_INTERVAL;

  // --- Ground Plane ---
  const groundGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE); // Adjusted size
  const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a, // Darker grey
  roughness: 0.9,
  metalness: 0.1
  });
  const mainGround = new THREE.Mesh(groundGeometry, groundMaterial);
  mainGround.rotation.x = -Math.PI / 2;
  mainGround.receiveShadow = true;
  mainGround.position.y = -0.05; // Ensure it's slightly below objects
  scene.add(mainGround);

  // --- Helper Elements ---
  let activationRangeRing = null;
  let cursorIndicator = null; // New cursor indicator

  // --- Player Cube ---
  let mixer, siegeAction, siegeREAction;
  //let clock = new THREE.Clock();

  const loader = new GLTFLoader();
  loader.load('/assets/tank.glb',
    (gltf) => {
      const tank = gltf.scene;
      tank.scale.set(0.3, 0.3, 0.3);
      scene.add(tank);
      playerModel.add(tank);

      mixer = new THREE.AnimationMixer(tank);
      const animations = gltf.animations;

      // Animations benennen
      siegeAction = mixer.clipAction(animations.find(clip => clip.name === 'SiegeMode'));
      siegeREAction = mixer.clipAction(animations.find(clip => clip.name === 'SiegeModeRE'));

      // Alle Animationen vorbereiten: Einmal abspielen, nicht loopen, letzte Pose beibehalten
      [siegeAction, siegeREAction].forEach(action => {
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.enable = true;
    });
    },
  );
  const playerMaterial = new THREE.MeshStandardMaterial({ color: PLAYER_NORMAL_COLOR, roughness: 0.4, metalness: 0.1 });
  const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
  const playerModel = new THREE.Mesh(playerGeometry, playerMaterial);
  playerModel.position.set(0, PLAYER_SIZE / 2, 0);
  playerModel.castShadow = true;
  playerModel.receiveShadow = true; // Can receive shadows from taller obstacles
  scene.add(playerModel);

 

  

  // --- Aiming Cone ---
  const coneMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.7 }); // Brighter, transparent
  const coneGeometry = new THREE.ConeGeometry(0.3, 1, 16);
  const aimingCone = new THREE.Mesh(coneGeometry, coneMaterial);
  scene.add(aimingCone);

  // --- Obstacles ---
  const obstacles = [];
  const wallMaterial = new THREE.MeshStandardMaterial({ color: OBSTACLE_WALL_COLOR, roughness: 0.8, metalness: 0.1 });
  const randomObstacleMaterial = new THREE.MeshStandardMaterial({ color: OBSTACLE_RANDOM_COLOR, roughness: 0.7, metalness: 0.1 });

  const wallGeo = new THREE.BoxGeometry(1, 2, 1);
  const randomObstacleGeo = new THREE.BoxGeometry(1, 1.5, 1); // Slightly taller random obstacles

  for (let i = -GRID_SIZE / 2; i <= GRID_SIZE / 2; i++) {
  function createWall(x, z) {
  const wall = new THREE.Mesh(wallGeo, wallMaterial);
  wall.position.set(x, 1, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  obstacles.push(wall);
  }
  createWall(i, -GRID_SIZE / 2);
  createWall(i, GRID_SIZE / 2);
  if (i !== -GRID_SIZE / 2 && i !== GRID_SIZE / 2) { // Avoid duplicating corners
  createWall(-GRID_SIZE / 2, i);
  createWall(GRID_SIZE / 2, i);
  }
  }

  for (let i = 0; i < NUM_RANDOM_OBSTACLES; i++) {
  const obsMesh = new THREE.Mesh(randomObstacleGeo, randomObstacleMaterial);
  const x = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2)); // Spawn away from edges
  const z = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
  if (Math.abs(x) < 3 && Math.abs(z) < 3) continue; // Avoid player start
  obsMesh.position.set(x, 1.5 / 2, z);
  obsMesh.castShadow = true;
  obsMesh.receiveShadow = true;
  scene.add(obsMesh);
  obstacles.push(obsMesh);
  }

  // --- Enemies ---
  const enemies = [];
  const enemyMaterial = new THREE.MeshStandardMaterial({ color: ENEMY_COLOR, roughness: 0.6, metalness: 0.1 });

  function spawnEnemy() {
  if (gameOver) return;
  const enemyGeo = new THREE.BoxGeometry(ENEMY_SIZE, ENEMY_SIZE, ENEMY_SIZE);
  const enemy = new THREE.Mesh(enemyGeo, enemyMaterial);
  enemy.castShadow = true;
  enemy.receiveShadow = true;

  // Ensure enemies spawn within the map boundaries
  let angle = Math.random() * Math.PI * 2;
  let radius = (GRID_SIZE / 2) * ENEMY_SPAWN_RADIUS_FACTOR;
  let x = playerModel.position.x + Math.cos(angle) * radius;
  let z = playerModel.position.z + Math.sin(angle) * radius;

  x = Math.max(-GRID_SIZE / 2 + ENEMY_SIZE, Math.min(GRID_SIZE / 2 - ENEMY_SIZE, x));
  z = Math.max(-GRID_SIZE / 2 + ENEMY_SIZE, Math.min(GRID_SIZE / 2 - ENEMY_SIZE, z));

  enemy.position.set(x, ENEMY_SIZE / 2, z);
  scene.add(enemy);
  enemies.push(enemy);
  }

  // --- Active Shots ---
  const activeShots = [];
  const explosions = []; // Array to hold explosion particles

  // --- Input Handling ---
  const keys = {};
  document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' && !gameOver) {
  activeMode = !activeMode;
  playerModel.material.color.setHex(activeMode ? PLAYER_ACTIVE_COLOR : PLAYER_NORMAL_COLOR);
  if (activeMode) {
    enterCombatMode();  // <-- Play "SiegeMode"
    if (!activationRangeRing) {
    const ringGeo = new THREE.RingGeometry(SHOT_RANGE - 0.15, SHOT_RANGE, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: PLAYER_ACTIVE_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    activationRangeRing = new THREE.Mesh(ringGeo, ringMat);
    activationRangeRing.rotation.x = -Math.PI / 2;
    }
    activationRangeRing.position.set(playerModel.position.x, 0.02, playerModel.position.z);
    scene.add(activationRangeRing);
  } else {
    enterDriveMode();   // <-- Play "SiegeModeRE"
    if (activationRangeRing) {
    scene.remove(activationRangeRing);
    if(activationRangeRing.geometry) activationRangeRing.geometry.dispose();
    if(activationRangeRing.material) activationRangeRing.material.dispose();
    activationRangeRing = null;
    }
    if (cursorIndicator) {
    scene.remove(cursorIndicator);
    if(cursorIndicator.geometry) cursorIndicator.geometry.dispose();
    if(cursorIndicator.material) cursorIndicator.material.dispose();
    cursorIndicator = null;
    }
  }
  }
  });
  document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

  renderer.domElement.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(groundPlaneRay, cursorWorld);

  // Update cursor indicator position
  if (activeMode && !gameOver) {
  if (!cursorIndicator) {
  const indicatorGeo = new THREE.CircleGeometry(0.5, 16);
  const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  cursorIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
  cursorIndicator.rotation.x = -Math.PI / 2;
  scene.add(cursorIndicator);
  }
  cursorIndicator.position.copy(cursorWorld).setComponent(1, 0.01); // Position slightly above ground
  } else if (cursorIndicator) {
  scene.remove(cursorIndicator);
  if(cursorIndicator.geometry) cursorIndicator.geometry.dispose();
  if(cursorIndicator.material) cursorIndicator.material.dispose();
  cursorIndicator = null;
  }
  }
  );

  renderer.domElement.addEventListener('click', (event) => {
  if (gameOver || !activeMode || !canShoot) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersectPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlaneRay, intersectPoint)) {
  const distanceToTarget = intersectPoint.distanceTo(playerModel.position);
  if (distanceToTarget > SHOT_RANGE) return;

  canShoot = false;
  shotCooldownTimer = SHOT_COOLDOWN_S;
  updateCooldownBar(0);

  const circleGeometry = new THREE.CircleGeometry(SHOT_RADIUS, 32);
  const circleMaterial = new THREE.MeshBasicMaterial({ color: SHOT_ACTIVE_COLOR, transparent: true, opacity: 0.5 });
  const shotCircle = new THREE.Mesh(circleGeometry, circleMaterial);
  shotCircle.rotation.x = -Math.PI / 2;
  shotCircle.position.set(intersectPoint.x, 0.01, intersectPoint.z);
  scene.add(shotCircle);

  activeShots.push({
  mesh: shotCircle,
  endTime: clock.elapsedTime + SHOT_EFFECT_DURATION_S + EXPLOSION_DELAY_S, // Added delay
  position: shotCircle.position.clone()
  });

  lastShotDirection.subVectors(intersectPoint, playerModel.position).normalize();
  lastShotDirection.y = 0;

  // Create explosion particles with delay
  setTimeout(() => {
  createExplosion(intersectPoint);
  }, EXPLOSION_DELAY_S * 1000); // Delay in milliseconds
  }
  });

  // --- Game Logic Functions ---
  function movePlayer(deltaTime) {
  if (gameOver || activeMode) return;
  let dx = 0;
  let dz = 0;
  if (keys['w']) dz -= 1;
  if (keys['s']) dz += 1;
  if (keys['a']) dx -= 1;
  if (keys['d']) dx += 1;

  if (dx === 0 && dz === 0) return;

  const moveVector = new THREE.Vector2(dx, dz).normalize();
  const moveAmount = PLAYER_SPEED * deltaTime;

  const newX = playerModel.position.x + moveVector.x * moveAmount;
  const newZ = playerModel.position.z + moveVector.y * moveAmount;

  let collision = false;
  const playerHalfSize = PLAYER_SIZE / 2;
  for (const obs of obstacles) {
  const obsParams = obs.geometry.parameters;
  const obsHalfWidth = obsParams.width / 2;
  const obsHalfDepth = obsParams.depth / 2;
  if (Math.abs(obs.position.x - newX) < (playerHalfSize + obsHalfWidth) &&
  Math.abs(obs.position.z - newZ) < (playerHalfSize + obsHalfDepth)) {
  collision = true;
  break;
  }
  }

  if (!collision) {
  playerModel.position.x = newX;
  playerModel.position.z = newZ;
  if (moveVector.x !== 0 || moveVector.y !== 0) {
  playerModel.rotation.y = Math.atan2(moveVector.x, moveVector.y);
  }
  }
  }

  function updateAimingCone() {
  aimingCone.position.set(playerModel.position.x, playerModel.position.y + PLAYER_SIZE * 0.7, playerModel.position.z); // Slightly lower
  let direction;
  if (activeMode && !gameOver) {
  direction = lastShotDirection.clone();
  } else if (!gameOver) {
  direction = new THREE.Vector3().subVectors(cursorWorld, playerModel.position);
  direction.y = 0;
  if (direction.lengthSq() > 0) direction.normalize(); else direction.set(0,0,-1); // Default if no mouse movement yet
  } else {
  direction = lastShotDirection.clone();
  }

  if (direction.lengthSq() > 0.001) {
  const targetPos = new THREE.Vector3().addVectors(playerModel.position, direction);
  aimingCone.lookAt(targetPos);
  }
  }

  function updateCooldownBar(progress) {
  document.getElementById('cooldown-bar').style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
  }

  function updateEnemies(deltaTime) {
  if (gameOver) return;

  for (let i = enemies.length - 1; i >= 0; i--) {
  const enemy = enemies[i];
  const directionToPlayer = new THREE.Vector3().subVectors(playerModel.position, enemy.position);

  if (directionToPlayer.lengthSq() < 0.01) continue; // Too close
  directionToPlayer.normalize();

  const moveDistance = ENEMY_SPEED_PER_SEC * deltaTime;
  const moveVector = directionToPlayer.clone().multiplyScalar(moveDistance);
  const nextPos = enemy.position.clone().add(moveVector);

  let collidesWithObstacle = false;
  const enemyHalfSize = ENEMY_SIZE / 2;
  for (const obs of obstacles) {
  const obsParams = obs.geometry.parameters;
  const obsHalfWidth = obsParams.width / 2;
  const obsHalfDepth = obsParams.depth / 2;
  if (Math.abs(obs.position.x - nextPos.x) < (enemyHalfSize + obsHalfWidth) &&
  Math.abs(obs.position.z - nextPos.z) < (enemyHalfSize + obsHalfDepth)) {
  collidesWithObstacle = true;
  break;
  }
  }

  if (!collidesWithObstacle) {
  enemy.position.copy(nextPos);
  }

  if (enemy.position.distanceTo(playerModel.position) < (PLAYER_SIZE / 2 + ENEMY_SIZE / 2)) {
  gameOver = true;
  document.getElementById('game-over-message').style.display = 'block';
  if (activationRangeRing && scene.children.includes(activationRangeRing)) {
  scene.remove(activationRangeRing);
  if(activationRangeRing.geometry) activationRangeRing.geometry.dispose();
  if(activationRangeRing.material) activationRangeRing.material.dispose();
  activationRangeRing = null;
  }
  if (cursorIndicator) {
  scene.remove(cursorIndicator);
  if(cursorIndicator.geometry) cursorIndicator.geometry.dispose();
  if(cursorIndicator.material) cursorIndicator.material.dispose();
  cursorIndicator = null;
  }
  break;
  }
  }
  }

  function updateActiveShots() { 
  const currentTime = clock.elapsedTime;
  for (let i = activeShots.length - 1; i >= 0; i--) {
  const shot = activeShots[i];
  for (let j = enemies.length - 1; j >= 0; j--) {
  const enemy = enemies[j];
  if (shot.position.distanceTo(enemy.position) < SHOT_RADIUS) {
  scene.remove(enemy);
  if(enemy.geometry) enemy.geometry.dispose();
  enemies.splice(j, 1);
  score++;
  document.getElementById('score').innerText = `Score: ${score}`;
  }
  }
  if (currentTime >= shot.endTime) {
  scene.remove(shot.mesh);
  if(shot.mesh.geometry) shot.mesh.geometry.dispose();
  if(shot.mesh.material) shot.mesh.material.dispose();
  activeShots.splice(i, 1);
  }
  }
  }

  function createExplosion(position) {
  const particleCount = 20;
  const particleGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  for (let i = 0; i < particleCount; i++) {
  const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 }); // Orange
  const particle = new THREE.Mesh(particleGeometry, particleMaterial);
  particle.position.copy(position);
  scene.add(particle);

  const direction = new THREE.Vector3(
  Math.random() - 0.5,
  Math.random() - 0.5,
  Math.random() - 0.5
  ).normalize();
  const speed = 5;

  explosions.push({
  mesh: particle,
  direction: direction,
  speed: speed,
  endTime: clock.elapsedTime + 0.5 // Duration of explosion
  });
  }
  }

  function updateExplosions(deltaTime) {
  const currentTime = clock.elapsedTime;
  for (let i = explosions.length - 1; i >= 0; i--) {
  const explosion = explosions[i];
  explosion.mesh.position.add(explosion.direction.clone().multiplyScalar(explosion.speed * deltaTime));
  if (currentTime >= explosion.endTime) {
  scene.remove(explosion.mesh);
  if(explosion.mesh.geometry) explosion.mesh.geometry.dispose();
  if(explosion.mesh.material) explosion.mesh.material.dispose();
  explosions.splice(i, 1);
  }
  }
  }

  // --- Animation Loop ---
  function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (mixer) mixer.update(deltaTime);
    renderer.render(scene, camera);

    if (!gameOver) {
    movePlayer(deltaTime);
    if (shotCooldownTimer > 0) {
    shotCooldownTimer -= deltaTime;
    updateCooldownBar(1 - (shotCooldownTimer / SHOT_COOLDOWN_S));
    if (shotCooldownTimer <= 0) {
    canShoot = true;
    shotCooldownTimer = 0;
    updateCooldownBar(1);
    }
    }
    enemySpawnTimer -= deltaTime * 1000;
    if (enemySpawnTimer <= 0) {
    spawnEnemy();
    enemySpawnTimer = ENEMY_SPAWN_INTERVAL;
    }
    }

    updateAimingCone();
    if (activationRangeRing && activeMode && !gameOver) {
    activationRangeRing.position.set(playerModel.position.x, 0.02, playerModel.position.z);
    } else if (activationRangeRing && (!activeMode || gameOver) && scene.children.includes(activationRangeRing)) {
    scene.remove(activationRangeRing);
    if(activationRangeRing.geometry) activationRangeRing.geometry.dispose();
    if(activationRangeRing.material) activationRangeRing.material.dispose();
    activationRangeRing = null;
    }

    updateEnemies(deltaTime);
    updateActiveShots();
    updateExplosions(deltaTime);

    camera.position.set(playerModel.position.x, playerModel.position.y + CAMERA_Y_OFFSET, playerModel.position.z + CAMERA_Z_OFFSET);
    camera.lookAt(playerModel.position);

    renderer.render(scene, camera);
  }


  // Kampfmodus aktivieren
  function enterCombatMode() {
      if (siegeREAction) siegeREAction.stop();
      if (siegeAction) siegeAction.reset().play();
  }

  // Fahrmodus aktivieren
  function enterDriveMode() {
      if (siegeAction) siegeAction.stop();
      if (siegeREAction) siegeREAction.reset().play();
  }
  // --- Window Resize ---
  window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();