import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './world/player.js';
import {
  GOD_MODE,
  GameState,
  SHOT_RANGE,
  SHOT_EFFECT_DURATION_S,
  SHOT_COOLDOWN_S,
  SHOT_ACTIVE_COLOR,
  EXPLOSION_DELAY_S,
  GRID_SIZE,
  PLAYER_SIZE,
  SCENE_BACKGROUND_COLOR,
  defaultMaterial,
  defaultContactMaterial,
  // Lighting constants
  AMBIENT_LIGHT_COLOR,
  AMBIENT_LIGHT_INTENSITY,
  SUN_LIGHT_COLOR,
  SUN_LIGHT_INTENSITY,
  SUN_POSITION,
  PLAYER_LIGHT_COLOR,
  PLAYER_LIGHT_INTENSITY,
  PLAYER_LIGHT_HEIGHT,
  PLAYER_LIGHT_DISTANCE,
  PLAYER_LIGHT_ANGLE,
  PLAYER_LIGHT_PENUMBRA,
  USE_ACCENT_LIGHTS,
  ACCENT_LIGHT_COLOR,
  ACCENT_LIGHT_INTENSITY,
  ACCENT_LIGHT_DISTANCE
} from './core/settings.js';
import { Explosion } from './world/explosion.js';
import CameraManager from './core/camera.js';
import { ObstacleManager } from './world/obstacleManager.js';
import EnemySpawner from './world/enemySpawner.js';
import { UI } from './ui/uiManager.js';
import { Turret } from './world/turret.js';

if (GOD_MODE) {
  GameState.score = 1000000;
}
// --- Scene & Renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
scene.fog = new THREE.FogExp2(SCENE_BACKGROUND_COLOR, 0.015);
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

// --- Lighting Setup ---
// Clear any existing lights
scene.children.forEach(child => {
  if (child instanceof THREE.Light) {
    scene.remove(child);
  }
});

// Add ambient light - softer, more even illumination
const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
scene.add(ambientLight);

// Add sun-like directional light with shadows
const sunLight = new THREE.DirectionalLight(SUN_LIGHT_COLOR, SUN_LIGHT_INTENSITY);
sunLight.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunLight.shadow.bias = -0.0003;
scene.add(sunLight);

// Create player spotlight that follows the player
const playerLight = new THREE.SpotLight(
  PLAYER_LIGHT_COLOR,
  PLAYER_LIGHT_INTENSITY,
  PLAYER_LIGHT_DISTANCE,
  PLAYER_LIGHT_ANGLE,
  PLAYER_LIGHT_PENUMBRA,
  1
);
playerLight.position.set(0, PLAYER_LIGHT_HEIGHT, 0);
playerLight.castShadow = true;
playerLight.shadow.mapSize.width = 1024;
playerLight.shadow.mapSize.height = 1024;
playerLight.shadow.camera.near = 0.1;
playerLight.shadow.camera.far = PLAYER_LIGHT_DISTANCE + 5;
playerLight.target = new THREE.Object3D(); // Create target object
scene.add(playerLight.target); // Add target to scene
scene.add(playerLight);

// Add accent lights if enabled
const accentLights = [];
if (USE_ACCENT_LIGHTS) {
  // Add a few accent lights at different positions for atmosphere
  const accentPositions = [
    { x: 20, y: 2, z: 20 },
    { x: -20, y: 2, z: 20 },
    { x: 20, y: 2, z: -20 },
    { x: -20, y: 2, z: -20 }
  ];
  
  accentPositions.forEach(pos => {
    const accentLight = new THREE.PointLight(
      ACCENT_LIGHT_COLOR,
      ACCENT_LIGHT_INTENSITY,
      ACCENT_LIGHT_DISTANCE
    );
    accentLight.position.set(pos.x, pos.y, pos.z);
    accentLight.castShadow = false; // No shadows for performance
    scene.add(accentLight);
    accentLights.push(accentLight);
  });
}

// --- Ground ---
const groundGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a,
  roughness: 0.8,
  metalness: 0.2,
  envMapIntensity: 0.5
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
// Update player body configuration
const playerBody = new CANNON.Body({ 
    type: CANNON.Body.KINEMATIC, 
    material: defaultMaterial,
    collisionFilterGroup: 1,
    collisionFilterMask: 1
});
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
  if (e.key.toLowerCase() === 'q') {
    if (turret.isDragging) {
      turret.cancelDragging();
      placeCubeBtn.classList.remove('active');
    } else {
      if (turret.startDragging()) {
        placeCubeBtn.classList.add('active');
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
  if (activeMode) {
    player.createCursorIndicator(scene, cursorWorld);
    player.updateCursorIndicator(cursorWorld);
  } else {
    player.removeCursorIndicator(scene);
  }
});

// --- Cube Manager ---
const turret = new Turret(scene, world);
const placeCubeBtn = document.getElementById('place-cube-btn');

placeCubeBtn.addEventListener('click', () => {
    if (turret.isDragging) {
        turret.cancelDragging();
        placeCubeBtn.classList.remove('active');
    } else {
        turret.startDragging();
        placeCubeBtn.classList.add('active');
    }
});

renderer.domElement.addEventListener('click', (event) => {
    if (turret.isDragging) {
        turret.placeCube();
        placeCubeBtn.classList.remove('active');
        return;
    }
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
      
      // Play shoot animation
      player.playShootAnimation();

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
  explosions.push(new Explosion(position, scene, world, GameState.SHOT_RADIUS));
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
    
    // Update player light to follow player smoothly
    const targetLightPosition = new THREE.Vector3(
        player.position.x,
        PLAYER_LIGHT_HEIGHT,
        player.position.z
    );
    playerLight.position.lerp(targetLightPosition, 0.1);
    playerLight.target.position.lerp(player.position, 0.1);
    playerLight.target.updateMatrixWorld();
    
    player.update(deltaTime, keys, cursorWorld, scene, playerBody);
    enemySpawner.update(deltaTime);
    turret.updateDragPosition(raycaster);
    turret.update(deltaTime, enemySpawner.enemies);
  
    // Enemy hit detection with active shots
    for (const shot of activeShots) {
      // Check spawner hits
      for (const spawner of enemySpawner.spawners) {
        const dist = spawner.mesh.position.distanceTo(shot.position);
        if (dist <= GameState.SHOT_RADIUS) {
          enemySpawner.hitBox(spawner);
          if (!spawner.active) {
            UI.addScore(50); // Bonus score for destroying a spawner
          }
        }
      }
      
      // Check enemy hits
      for (const enemy of enemySpawner.enemies) {
        if (!enemy.isRigid) {
          const dist = enemy.mesh.position.distanceTo(shot.position);
          if (dist <= GameState.SHOT_RADIUS) {
            enemy.hitByShot();
            UI.addScore(10);
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
    renderer.setClearColor(SCENE_BACKGROUND_COLOR);
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();