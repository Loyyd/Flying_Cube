import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './world/player.js';
import {
  SHOT_RANGE,
  SHOT_RADIUS,
  SHOT_EFFECT_DURATION_S,
  SHOT_COOLDOWN_S,
  SHOT_ACTIVE_COLOR,
  EXPLOSION_DELAY_S,
  GRID_SIZE,
  PLAYER_SIZE,
  SCENE_BACKGROUND_COLOR,
  defaultMaterial,
  defaultContactMaterial
} from './core/settings.js';
import { Explosion } from './world/explosion.js';
import CameraManager from './core/camera.js';
import { ObstacleManager } from './world/obstacleManager.js';
import EnemySpawner from './world/enemySpawner.js';
import { UI, GameState } from './ui/uiManager.js';


// --- Scene & Renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
scene.fog = new THREE.FogExp2(SCENE_BACKGROUND_COLOR, 0.01);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- Physics World ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial;

// --- Score State ---
const scoreValueElem = document.getElementById('score-value');
function updateScoreUI() {
  scoreValueElem.textContent = GameState.score;
}
updateScoreUI();

// --- Lighting ---
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(GRID_SIZE * 0.3, GRID_SIZE * 0.8, GRID_SIZE * 0.2);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = GRID_SIZE * 2;
directionalLight.shadow.camera.left = -GRID_SIZE / 1.5;
directionalLight.shadow.camera.right = GRID_SIZE / 1.5;
directionalLight.shadow.camera.top = GRID_SIZE / 1.5;
directionalLight.shadow.camera.bottom = -GRID_SIZE / 1.5;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffaa33, 0.8, 50);
pointLight.position.set(0, GRID_SIZE * 0.6, 0);
pointLight.castShadow = true;
scene.add(pointLight);

// --- Ground ---
const groundGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a,
  roughness: 0.8,
  metalness: 0.2
});
const mainGround = new THREE.Mesh(groundGeometry, groundMaterial);
mainGround.rotation.x = -Math.PI / 2;
mainGround.receiveShadow = true;
mainGround.position.y = -0.05;
scene.add(mainGround);

const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: defaultMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// --- Obstacles ---
const obstacleManager = new ObstacleManager(scene, world, GRID_SIZE);
obstacleManager.initializeObstacles();

// --- Player ---
const player = new Player();
player.loadModel(scene);
const playerShape = new CANNON.Box(new CANNON.Vec3(PLAYER_SIZE * 1.3, PLAYER_SIZE, PLAYER_SIZE * 1.3));
const playerBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: defaultMaterial });
playerBody.addShape(playerShape);
playerBody.position.set(player.position.x, player.position.y, player.position.z);
world.addBody(playerBody);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraManager = new CameraManager(camera, player);

// --- State ---
const clock = new THREE.Clock();
const activeShots = [];
const explosions = [];
const keys = {};
let activeMode = false;
let canShoot = true;
let shotCooldownTimer = 0;

// --- Raycasting & Mouse ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let cursorWorld = new THREE.Vector3();
const groundPlaneRay = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// --- Input ---
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') {
    activeMode = !activeMode;
    if (activeMode) {
      player.enterCombatMode(scene, playerBody);
    } else {
      player.exitCombatMode(scene, playerBody);
    }
  }
});
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
renderer.domElement.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(groundPlaneRay, cursorWorld);
  if (activeMode) {
    player.createCursorIndicator(scene, cursorWorld);
    player.updateCursorIndicator(cursorWorld);
  } else {
    player.removeCursorIndicator(scene);
  }
});

renderer.domElement.addEventListener('click', (event) => {
  if (!activeMode || !canShoot) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersectPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlaneRay, intersectPoint)) {
    const distanceToTarget = intersectPoint.distanceTo(player.position);
    if (distanceToTarget > SHOT_RANGE) return;

    canShoot = false;
    shotCooldownTimer = UI.getCurrentCooldown(SHOT_COOLDOWN_S);
    UI.updateCooldownCircle(0);

    player.lastShotDirection.subVectors(intersectPoint, player.position).normalize();
    player.lastShotDirection.y = 0;

    setTimeout(() => {
      const shotCircle = player.createShotRangeCircle(scene, intersectPoint, SHOT_ACTIVE_COLOR, UI.getShotRadius());

      activeShots.push({
        mesh: shotCircle,
        endTime: clock.elapsedTime + SHOT_EFFECT_DURATION_S,
        position: shotCircle.position.clone()
      });
      createExplosion(intersectPoint);
    }, EXPLOSION_DELAY_S * 1000);
  }
});

// --- Explosion ---
function createExplosion(position) {
  explosions.push(new Explosion(position, scene, world, SHOT_RADIUS));
}

// --- Active Shots Cleanup ---
function updateActiveShots() {
  const currentTime = clock.elapsedTime;
  for (let i = activeShots.length - 1; i >= 0; i--) {
    const shot = activeShots[i];
    if (currentTime >= shot.endTime) {
      scene.remove(shot.mesh);
      if (shot.mesh.geometry) shot.mesh.geometry.dispose();
      if (shot.mesh.material) shot.mesh.material.dispose();
      activeShots.splice(i, 1);
    }
  }
}

// --- Enemy Spawner ---
const enemySpawner = new EnemySpawner(scene, world, player);

// --- Animation Loop ---
function animate() {
  cameraManager.update();
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  world.step(1 / 60, deltaTime, 3);
  player.update(deltaTime, keys, cursorWorld, scene, playerBody);
  enemySpawner.update(deltaTime);
  
  // Enemy hit detection with active shots
  for (const shot of activeShots) {
    for (const enemy of enemySpawner.enemies) {
      if (!enemy.isRigid) {
        const dist = enemy.mesh.position.distanceTo(shot.position);
        if (dist <= SHOT_RADIUS) {
          enemy.hitByShot();
          UI.addScore(1);
        }
      }
    }
  }

  if (shotCooldownTimer > 0) {
    shotCooldownTimer -= deltaTime;
    UI.updateCooldownCircle(1 - shotCooldownTimer / UI.getCurrentCooldown(SHOT_COOLDOWN_S));
    if (shotCooldownTimer <= 0) {
      canShoot = true;
      shotCooldownTimer = 0;
      UI.updateCooldownCircle(1);
    }
  }

  updateActiveShots();
  player.position.copy(playerBody.position);
  obstacleManager.synchronizeObstacles();

  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update(deltaTime);
    if (explosions[i].isFinished()) {
      explosions[i].dispose();
      explosions.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  renderer.setClearColor(0x1e1e1e);
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();