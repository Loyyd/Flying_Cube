import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Player from './player.js';
import { Enemy, spawnEnemy, ENEMY_SIZE, ENEMY_SPEED_PER_SEC, ENEMY_COLOR } from './enemy.js';

// --- Game Constants ---
const GRID_SIZE = 50;
const PLAYER_SIZE = 1;
const PLAYER_SPEED = 5.0; // Units per second
const PLAYER_NORMAL_COLOR = 0x4488ff; // Brighter Blue
const PLAYER_ACTIVE_COLOR = 0xff4444; // Brighter Red

const ENEMY_SPAWN_INTERVAL = 2000; // ms

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
scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, CAMERA_Y_OFFSET * FOG_NEAR_FACTOR, CAMERA_Y_OFFSET + GRID_SIZE * FOG_FAR_FACTOR);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const clock = new THREE.Clock();

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

// --- Obstacles ---
const obstacles = [];
const wallMaterial = new THREE.MeshStandardMaterial({ color: OBSTACLE_WALL_COLOR, roughness: 0.8, metalness: 0.1 });
const randomObstacleMaterial = new THREE.MeshStandardMaterial({ color: OBSTACLE_RANDOM_COLOR, roughness: 0.7, metalness: 0.1 });

const wallGeo = new THREE.BoxGeometry(1, 2, 1);
const randomObstacleGeo = new THREE.BoxGeometry(1, 1.5, 1);
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
  if (i !== -GRID_SIZE / 2 && i !== GRID_SIZE / 2) {
    createWall(-GRID_SIZE / 2, i);
    createWall(GRID_SIZE / 2, i);
  }
}
for (let i = 0; i < NUM_RANDOM_OBSTACLES; i++) {
  const obsMesh = new THREE.Mesh(randomObstacleGeo, randomObstacleMaterial);
  const x = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
  const z = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
  if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
  obsMesh.position.set(x, 1.5 / 2, z);
  obsMesh.castShadow = true;
  obsMesh.receiveShadow = true;
  scene.add(obsMesh);
  obstacles.push(obsMesh);
}

// --- Player ---
const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
const playerMaterial = new THREE.MeshStandardMaterial({ color: PLAYER_NORMAL_COLOR });
const player = new Player(playerGeometry, playerMaterial);
player.loadModel(scene);

// --- Enemies ---
const enemies = [];

// --- Active Shots ---
const activeShots = [];
const explosions = [];

// --- Input Handling ---
const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' && !gameOver) {
    activeMode = !activeMode;
    if (activeMode) {
      player.enterCombatMode(scene, PLAYER_ACTIVE_COLOR);
    } else {
      player.exitCombatMode(scene);
    }
  }
});
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

renderer.domElement.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(groundPlaneRay, cursorWorld);

  // Update cursor indicator through player class
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

    const circleGeometry = new THREE.CircleGeometry(SHOT_RADIUS, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({ color: SHOT_ACTIVE_COLOR, transparent: true, opacity: 0.5 });
    const shotCircle = new THREE.Mesh(circleGeometry, circleMaterial);
    shotCircle.rotation.x = -Math.PI / 2;
    shotCircle.position.set(intersectPoint.x, 0.01, intersectPoint.z);
    scene.add(shotCircle);

    activeShots.push({
      mesh: shotCircle,
      endTime: clock.elapsedTime + SHOT_EFFECT_DURATION_S + EXPLOSION_DELAY_S,
      position: shotCircle.position.clone()
    });

    player.lastShotDirection.subVectors(intersectPoint, player.position).normalize();
    player.lastShotDirection.y = 0;

    setTimeout(() => {
      createExplosion(intersectPoint);
    }, EXPLOSION_DELAY_S * 1000);
  }
});

// --- Game Logic Functions ---
function updateCooldownBar(progress) {
  document.getElementById('cooldown-bar').style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
}

function updateEnemies(deltaTime) {
  if (gameOver) return;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const collidedWithPlayer = enemy.update(deltaTime, player.position, obstacles, GRID_SIZE);
    if (collidedWithPlayer) {
      gameOver = true;
      document.getElementById('game-over-message').style.display = 'block';
      player.exitCombatMode(scene);
      player.removeCursorIndicator(scene);
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
        enemy.dispose(); // Dispose of enemy resources
        enemies.splice(j, 1);
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

function createExplosion(position) {
  const particleCount = 20;
  const particleGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  for (let i = 0; i < particleCount; i++) {
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
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
      endTime: clock.elapsedTime + 0.5
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
      if (explosion.mesh.geometry) explosion.mesh.geometry.dispose();
      if (explosion.mesh.material) explosion.mesh.material.dispose();
      explosions.splice(i, 1);
    }
  }
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  if (!gameOver) {
    player.update(deltaTime, keys, obstacles, cursorWorld, scene);

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
      // Spawn a new enemy using the function from enemy.js
      const newEnemy = spawnEnemy(scene, player.position, GRID_SIZE);
      enemies.push(newEnemy);
      enemySpawnTimer = ENEMY_SPAWN_INTERVAL;
    }
  }

  updateEnemies(deltaTime);
  updateActiveShots();
  updateExplosions(deltaTime);

  camera.position.set(player.position.x, player.position.y + CAMERA_Y_OFFSET, player.position.z + CAMERA_Z_OFFSET);
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
