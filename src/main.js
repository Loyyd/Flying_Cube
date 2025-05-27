import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Player from './player.js';
import { Explosion } from './explosion.js';
import * as CANNON from 'cannon-es'; // Import cannon-es

// --- Game Constants ---
const GRID_SIZE = 50;
const PLAYER_SIZE = 1;
const PLAYER_SPEED = 5.0;
const PLAYER_NORMAL_COLOR = 0x4488ff;
const PLAYER_ACTIVE_COLOR = 0xff4444;

const ENEMY_SIZE = 0.5;
const ENEMY_COLOR = 0x993399;
const ENEMY_SPEED_PER_SEC = 1.0; // Adjusted: Increased enemy speed for more noticeable movement
const ENEMY_SPAWN_INTERVAL = 2000;
const ENEMY_SPAWN_RADIUS_FACTOR = 1.0;

const OBSTACLE_WALL_COLOR = 0x666666;
const OBSTACLE_RANDOM_COLOR = 0x5070C0;
const NUM_RANDOM_OBSTACLES = 50;

const SHOT_ACTIVE_COLOR = 0xff0000;
const SHOT_RADIUS = 2;
const SHOT_RANGE = 10;
const SHOT_EFFECT_DURATION_S = 2.0;
const SHOT_COOLDOWN_S = 0.5;
const EXPLOSION_DELAY_S = 0.3;

const CAMERA_Y_OFFSET = 18;
const CAMERA_Z_OFFSET = 12;

const SCENE_BACKGROUND_COLOR = 0x282c34;
const FOG_NEAR_FACTOR = 0.8;
const FOG_FAR_FACTOR = 2.5;

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
scene.fog = new THREE.Fog(
  SCENE_BACKGROUND_COLOR,
  CAMERA_Y_OFFSET * FOG_NEAR_FACTOR,
  CAMERA_Y_OFFSET + GRID_SIZE * FOG_FAR_FACTOR
);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const clock = new THREE.Clock();

// --- Physics World Setup ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Set gravity
world.broadphase = new CANNON.SAPBroadphase(world); // Improve collision detection performance
world.allowSleep = true; // Allow bodies to "sleep" when not moving to save CPU

// Define a default material for better friction
const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.5, // Increased friction
    restitution: 0.2, // Reduced bounciness
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial; // Set as default

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(GRID_SIZE * 0.3, GRID_SIZE * 0.6, GRID_SIZE * 0.2);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
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
let enemySpawnTimer = ENEMY_SPAWN_INTERVAL;

// --- Ground Plane ---
const groundGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a,
  roughness: 0.9,
  metalness: 0.1
});
const mainGround = new THREE.Mesh(groundGeometry, groundMaterial);
mainGround.rotation.x = -Math.PI / 2;
mainGround.receiveShadow = true;
mainGround.position.y = -0.05;
scene.add(mainGround);

// Create Cannon.js ground plane
const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: defaultMaterial }); // mass 0 makes it static
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to match Three.js plane
world.addBody(groundBody);

// --- Obstacles ---
const obstacles = [];
const obstacleBodies = []; // Array to hold Cannon.js bodies for obstacles

const wallMaterial = new THREE.MeshStandardMaterial({
  color: OBSTACLE_WALL_COLOR,
  roughness: 0.8,
  metalness: 0.1
});
const randomObstacleMaterial = new THREE.MeshStandardMaterial({
  color: OBSTACLE_RANDOM_COLOR,
  roughness: 0.7,
  metalness: 0.1
});
const wallGeo = new THREE.BoxGeometry(1, 2, 1);
const randomObstacleGeo = new THREE.BoxGeometry(1, 1.5, 1);

function createObstacle(x, y, z, geometry, material, isStatic = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push(mesh);

  // Create Cannon.js body for the obstacle
  const halfExtents = new CANNON.Vec3(geometry.parameters.width / 2, geometry.parameters.height / 2, geometry.parameters.depth / 2);
  const boxShape = new CANNON.Box(halfExtents);
  const body = new CANNON.Body({ mass: isStatic ? 0 : 1, material: defaultMaterial }); // Static or dynamic
  body.addShape(boxShape);
  body.position.set(x, y, z);
  world.addBody(body);
  obstacleBodies.push({ mesh, body }); // Store both mesh and body for synchronization
}

for (let i = -GRID_SIZE / 2; i <= GRID_SIZE / 2; i++) {
  createObstacle(i, 1, -GRID_SIZE / 2, wallGeo, wallMaterial);
  createObstacle(i, 1, GRID_SIZE / 2, wallGeo, wallMaterial);
  if (i !== -GRID_SIZE / 2 && i !== GRID_SIZE / 2) {
    createObstacle(-GRID_SIZE / 2, 1, i, wallGeo, wallMaterial);
    createObstacle(GRID_SIZE / 2, 1, i, wallGeo, wallMaterial);
  }
}

for (let i = 0; i < NUM_RANDOM_OBSTACLES; i++) {
  const x = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
  const z = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
  if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
  // Make random obstacles dynamic for physics interaction
  createObstacle(x, 1.5 / 2, z, randomObstacleGeo, randomObstacleMaterial, false);
}

// --- Player ---
const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
const playerMaterial = new THREE.MeshStandardMaterial({ color: PLAYER_NORMAL_COLOR });
const player = new Player(playerGeometry, playerMaterial);
player.loadModel(scene);

// Create Cannon.js body for the player - now KINEMATIC
const playerShape = new CANNON.Box(new CANNON.Vec3(PLAYER_SIZE / 2, PLAYER_SIZE / 2, PLAYER_SIZE / 2));
const playerBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: defaultMaterial }); // Changed to KINEMATIC
playerBody.addShape(playerShape);
playerBody.position.set(player.position.x, player.position.y, player.position.z);
world.addBody(playerBody);

// --- Enemies ---
const enemies = [];
const enemyBodies = []; // Array to hold Cannon.js bodies for enemies

const enemyMaterial = new THREE.MeshStandardMaterial({
  color: ENEMY_COLOR,
  roughness: 0.6,
  metalness: 0.1
});

function spawnEnemy() {
  if (gameOver) return;
  const enemyGeo = new THREE.BoxGeometry(ENEMY_SIZE, ENEMY_SIZE, ENEMY_SIZE);
  const enemyMesh = new THREE.Mesh(enemyGeo, enemyMaterial);
  enemyMesh.castShadow = true;
  enemyMesh.receiveShadow = true;

  let angle = Math.random() * Math.PI * 2;
  let radius = (GRID_SIZE / 2) * ENEMY_SPAWN_RADIUS_FACTOR;
  let x = player.position.x + Math.cos(angle) * radius;
  let z = player.position.z + Math.sin(angle) * radius;

  x = Math.max(-GRID_SIZE / 2 + ENEMY_SIZE, Math.min(GRID_SIZE / 2 - ENEMY_SIZE, x));
  z = Math.max(-GRID_SIZE / 2 + ENEMY_SIZE, Math.min(GRID_SIZE / 2 - ENEMY_SIZE, z));

  enemyMesh.position.set(x, ENEMY_SIZE / 2, z);
  scene.add(enemyMesh);
  enemies.push(enemyMesh);

  // Create Cannon.js body for the enemy - now KINEMATIC
  const enemyShape = new CANNON.Box(new CANNON.Vec3(ENEMY_SIZE / 2, ENEMY_SIZE / 2, ENEMY_SIZE / 2));
  const enemyBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: defaultMaterial }); // Changed to KINEMATIC
  enemyBody.addShape(enemyShape);
  enemyBody.position.set(x, ENEMY_SIZE / 2, z);
  world.addBody(enemyBody);
  enemyBodies.push({ mesh: enemyMesh, body: enemyBody });
}

// --- Active Shots & Explosions ---
const activeShots = [];
const explosions = []; // Now stores Explosion instances

// --- Input Handling ---
const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' && !gameOver) {
    activeMode = !activeMode;
    if (activeMode) {
      player.enterCombatMode(scene, PLAYER_ACTIVE_COLOR, playerBody); // Pass playerBody
    } else {
      player.exitCombatMode(scene, playerBody); // Pass playerBody
    }
  }
});
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

renderer.domElement.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(groundPlaneRay, cursorWorld);

  if (activeMode && !gameOver) {
    player.createCursorIndicator(scene, cursorWorld);
    player.updateCursorIndicator(cursorWorld);
  } else {
    player.removeCursorIndicator(scene);
  }
});

renderer.domElement.addEventListener('click', (event) => {
  if (gameOver || !activeMode || !canShoot) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersectPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlaneRay, intersectPoint)) {
    const distanceToTarget = intersectPoint.distanceTo(player.position);
    if (distanceToTarget > SHOT_RANGE) return;

    canShoot = false;
    shotCooldownTimer = SHOT_COOLDOWN_S;
    updateCooldownBar(0);

    player.lastShotDirection.subVectors(intersectPoint, player.position).normalize();
    player.lastShotDirection.y = 0;

    // The red circle and explosion are now created simultaneously after the delay
    setTimeout(() => {
      const circleGeometry = new THREE.CircleGeometry(SHOT_RADIUS, 32);
      const circleMaterial = new THREE.MeshBasicMaterial({
        color: SHOT_ACTIVE_COLOR,
        transparent: true,
        opacity: 0.5
      });
      const shotCircle = new THREE.Mesh(circleGeometry, circleMaterial);
      shotCircle.rotation.x = -Math.PI / 2;
      shotCircle.position.set(intersectPoint.x, 0.01, intersectPoint.z);
      scene.add(shotCircle);

      activeShots.push({
        mesh: shotCircle,
        endTime: clock.elapsedTime + SHOT_EFFECT_DURATION_S, // No need for EXPLOSION_DELAY_S here anymore
        position: shotCircle.position.clone()
      });
      createExplosion(intersectPoint);
    }, EXPLOSION_DELAY_S * 1000); // This delay now applies to both the circle and explosion
  }
});

// --- Explosion Creation (modular) ---
function createExplosion(position) {
  explosions.push(new Explosion(position, scene));
}

// --- Game Logic Functions ---
function updateCooldownBar(progress) {
  document.getElementById('cooldown-bar').style.width =
    `${Math.min(1, Math.max(0, progress)) * 100}%`;
}

function updateEnemies(deltaTime) {
  if (gameOver) return;
  for (let i = enemyBodies.length - 1; i >= 0; i--) {
    const { mesh: enemy, body: enemyBody } = enemyBodies[i];
    const directionToPlayer = new THREE.Vector3().subVectors(player.position, enemy.position);
    if (directionToPlayer.lengthSq() < 0.01) {
        enemyBody.velocity.set(0, enemyBody.velocity.y, 0); // Stop if very close
        continue;
    }

    const moveVector = new THREE.Vector3(directionToPlayer.x, 0, directionToPlayer.z);
    moveVector.normalize();

    // Set the velocity directly for kinematic enemies
    enemyBody.velocity.set(
        moveVector.x * ENEMY_SPEED_PER_SEC,
        enemyBody.velocity.y, // Preserve vertical velocity
        moveVector.z * ENEMY_SPEED_PER_SEC
    );

    // Make enemy mesh look at player (visual only)
    enemy.lookAt(player.position.x, enemy.position.y, player.position.z);

    // Check for collision with player (using Three.js distance for simplicity,
    // but Cannon.js collision events would be more robust for kinematic bodies)
    if (enemy.position.distanceTo(player.position) < (PLAYER_SIZE / 2 + ENEMY_SIZE / 2)) {
      gameOver = true;
      document.getElementById('game-over-message').style.display = 'block';
      player.exitCombatMode(scene, playerBody); // Pass playerBody
      player.removeCursorIndicator(scene);
      break;
    }
  }
}

function updateActiveShots() {
  const currentTime = clock.elapsedTime;
  for (let i = activeShots.length - 1; i >= 0; i--) {
    const shot = activeShots[i];
    for (let j = enemyBodies.length - 1; j >= 0; j--) {
      const { mesh: enemy, body: enemyBody } = enemyBodies[j];
      if (shot.position.distanceTo(enemy.position) < SHOT_RADIUS) {
        scene.remove(enemy);
        if (enemy.geometry) enemy.geometry.dispose();
        if (enemy.material) enemy.material.dispose();
        world.removeBody(enemyBody); // Remove enemy body from physics world
        enemyBodies.splice(j, 1);
        enemies.splice(enemies.indexOf(enemy), 1); // Also remove from the Three.js enemies array
        score++;
        document.getElementById('score').innerText = `Score: ${score}`;
      }
    }
    if (currentTime >= shot.endTime) {
      scene.remove(shot.mesh);
      if (shot.mesh.geometry) shot.mesh.geometry.dispose();
      if (shot.mesh.material) shot.mesh.material.dispose();
      activeShots.splice(i, 1);
    }
  }
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  // Step the physics world
  world.step(1 / 60, deltaTime, 3); // Fixed time step for physics

  if (!gameOver) {
    // Update player movement (now applies force to physics body)
    player.update(deltaTime, keys, obstacles, cursorWorld, scene, playerBody); // Pass playerBody to player update

    if (shotCooldownTimer > 0) {
      shotCooldownTimer -= deltaTime;
      updateCooldownBar(1 - shotCooldownTimer / SHOT_COOLDOWN_S);
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

  updateEnemies(deltaTime); // This now applies forces to enemy physics bodies
  updateActiveShots();

  // Synchronize Three.js meshes with Cannon.js bodies
  player.position.copy(playerBody.position);
  // Removed player.quaternion.copy(playerBody.quaternion);
  // Player's visual rotation is now handled directly by player.js based on input.

  for (const { mesh, body } of obstacleBodies) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  for (const { mesh, body } of enemyBodies) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  // --- Modular Explosion Update ---
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update(deltaTime);
    if (explosions[i].isFinished()) {
      explosions[i].dispose();
      explosions.splice(i, 1);
    }
  }

  camera.position.set(
    player.position.x,
    player.position.y + CAMERA_Y_OFFSET,
    player.position.z + CAMERA_Z_OFFSET
  );
  camera.lookAt(player.position);

  renderer.render(scene, camera);
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
