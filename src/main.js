import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './world/player.js';
import { Assets } from './core/assetManager.js';
import {
  GOD_MODE,
  DEBUG_MODE,
  GameState,
  SHOT_RANGE,
  SHOT_EFFECT_DURATION_S,
  SHOT_COOLDOWN_S,
  SHOT_ACTIVE_COLOR,
  EXPLOSION_DELAY_S,
  GRID_SIZE,
  PLAYER_SIZE,
  PLAYER_BOX_HALF_EXTENTS, // Import the new constant
  SCENE_BACKGROUND_COLOR,
  defaultMaterial,
  defaultContactMaterial,
  // Visual indicators
  RING_THICKNESS,
  RING_OPACITY,
  // Lighting constants
  SUN_LIGHT_COLOR,
  SUN_LIGHT_INTENSITY,
  SUN_POSITION
} from './core/settings.js';
import { Explosion } from './world/explosion.js';
import CameraManager from './core/camera.js';
import { ObstacleManager } from './world/obstacleManager.js';
import EnemySpawner from './world/enemySpawner.js';
import { UI } from './ui/uiManager.js';
import { Turret } from './world/turret.js';
import { BulletManager } from './world/bulletManager.js';

if (GOD_MODE) {
  GameState.score = 1000000;
}
// --- Scene & Renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
scene.fog = new THREE.FogExp2(SCENE_BACKGROUND_COLOR, 0.015);
const renderer = new THREE.WebGLRenderer({ antialias: true });
// Set renderer with device pixel ratio for better performance on high DPI displays
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit to 2x for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

// Add strong sunlight (less yellowish)
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

// --- Ground ---
// Use a scaled version of the shared plane geometry for better performance
const groundGeometry = Assets.geometries.plane.clone();
groundGeometry.scale(GRID_SIZE, GRID_SIZE, 1);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a4a4a,
  roughness: 0.8,
  metalness: 0.2,
  envMapIntensity: 0.5,
  flatShading: false // Disable for better ground appearance
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
// Use the new constant for the player shape
const playerShape = new CANNON.Box(PLAYER_BOX_HALF_EXTENTS);
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

// Enable debug hitbox visualization for the player if in debug mode
if (DEBUG_MODE) {
    player.toggleCollisionBox(true);
}

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraManager = new CameraManager(camera, player);

// --- Game Over Functions ---
const gameOverMessage = document.getElementById('game-over-message');
const restartButton = document.getElementById('restart-button');
const debugModeIndicator = document.getElementById('debug-mode-indicator');
let isGameOver = false;
let isPaused = false; // Add a pause state variable

const escMenu = document.getElementById('esc-menu');
const resumeButton = document.getElementById('resume-button');
const settingsButton = document.getElementById('settings-button');
const restartEscButton = document.getElementById('restart-esc-button'); // Updated ID

// Function to toggle pause state
function togglePause() {
  isPaused = !isPaused;
  escMenu.classList.toggle('hidden', !isPaused);
  // Add logic to pause/resume game elements (e.g., stop animations, disable controls)
  if (isPaused) {
    // Example: Stop enemy movement
    enemySpawner.enemies.forEach(enemy => {
      enemy.body.velocity.set(0, 0, 0);
    });
    player.canMove = false;
  } else {
    // Example: Resume player controls
    player.canMove = true;
  }
}

// Event listeners for esc menu buttons
resumeButton.addEventListener('click', togglePause);
settingsButton.addEventListener('click', () => {
  // Add logic for settings
  console.log('Settings button clicked');
});

restartEscButton.addEventListener('click', () => { // Updated event listener
  // Add logic to restart the game
  console.log('Restart button in ESC menu clicked');
  location.reload(); // Simple reload for now
});

// Initialize debug mode indicator
if (DEBUG_MODE) {
  debugModeIndicator.style.display = 'block';
  debugModeIndicator.textContent = 'Debug Mode: ON (Press F2 to toggle)';
}

// Global game over function that can be called from enemy.js
window.gameOver = function() {
  if (isGameOver) return; // Prevent multiple calls
  
  isGameOver = true;
  gameOverMessage.style.display = 'block';
  restartButton.style.display = 'block';
  
  // Stop enemy movement and player controls
  enemySpawner.enemies.forEach(enemy => {
    enemy.body.velocity.set(0, 0, 0);
  });
  
  // Stop player controls
  player.canMove = false;
  
  // Make sure player is not in combat mode
  if (activeMode) {
    player.exitCombatMode(scene, playerBody);
    activeMode = false;
  }
};

// Restart game function
restartButton.addEventListener('click', () => {
  location.reload(); // Simple reload for now
});

// --- State ---
const clock = new THREE.Clock();
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
  
  // Toggle DEBUG_MODE with F2 key
  if (e.key === 'F2') {
    // Toggle debug mode
    GameState.debugMode = !GameState.debugMode;
    console.log('Debug Mode:', GameState.debugMode ? 'ON' : 'OFF');
    
    // Update debug mode indicator
    debugModeIndicator.style.display = 'block';
    debugModeIndicator.textContent = `Debug Mode: ${GameState.debugMode ? 'ON' : 'OFF'} (Press F2 to toggle)`;
    
    // Update player hitbox visibility
    player.toggleCollisionBox(GameState.debugMode);
    
    // Update enemy hitboxes
    enemySpawner.enemies.forEach(enemy => {
      if (enemy.debugHitbox) {
        enemy.debugHitbox.visible = GameState.debugMode;
      }
    });
    
    // Update turret hitboxes
    turret.placedTurrets.forEach(t => {
      if (t.debugHitbox) {
        t.debugHitbox.visible = GameState.debugMode;
      }
    });
  }
  if (e.key === 'Escape') { // Use 'Escape' for the Esc key
    togglePause();
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

      const shootDirection = new THREE.Vector3();
      shootDirection.subVectors(intersectPoint, player.position).normalize();
      player.lastShotDirection.copy(shootDirection);
      player.playShootAnimation();
        setTimeout(() => {
          createExplosion(intersectPoint);
        }, EXPLOSION_DELAY_S * 1000);
    }
});

function createExplosion(position) {
  explosions.push(new Explosion(position, scene, world, GameState.SHOT_RADIUS));

  // Check spawner hits
  for (const spawner of enemySpawner.spawners) {
    const dist = spawner.mesh.position.distanceTo(position);
    if (dist <= GameState.SHOT_RADIUS) {
      enemySpawner.hitBox(spawner);
      if (!spawner.active) {
        UI.addScore(50);
      }
    }
  
    // Check enemy hits
    for (const enemy of enemySpawner.enemies) {
      if (!enemy.isRigid) {
        const dist = enemy.mesh.position.distanceTo(position);
        if (dist <= GameState.SHOT_RADIUS) {
          enemy.hitByShot();
          UI.addScore(10);
        }
      }
    }
  }
}

// --- Enemy Spawner ---
const enemySpawner = new EnemySpawner(scene, world, player);

// --- Bullet Manager ---
const bulletManager = new BulletManager(scene, world);

// --- Performance monitoring ---
let lastFpsUpdateTime = 0;
let frameCount = 0;
let currentFPS = 0;
const FPS_UPDATE_INTERVAL = 1000; // Update FPS display every second
const TARGET_FRAMERATE = 60;
const FRAME_TIME = 1000 / TARGET_FRAMERATE;
let lastFrameTime = 0;

// --- Animation Loop ---
function animate(currentTime) {
    requestAnimationFrame(animate);

    if (isPaused) { // Skip game updates if paused
      renderer.render(scene, camera); // Still render the scene
      return;
    }
    
    // FPS counter
    frameCount++;
    if (currentTime - lastFpsUpdateTime >= FPS_UPDATE_INTERVAL) {
        currentFPS = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdateTime));
        frameCount = 0;
        lastFpsUpdateTime = currentTime;
        // console.log(`FPS: ${currentFPS}`); // Uncomment for FPS debugging
    }
    
    // Frame time throttling for consistent physics
    const elapsedTime = currentTime - lastFrameTime;
    if (elapsedTime < FRAME_TIME) {
        return; // Skip this frame if we're running too fast
    }
    
    // Limit delta time to avoid physics issues on slow frames
    const deltaTime = Math.min(elapsedTime / 1000, 1/30);
    lastFrameTime = currentTime;
    
    // Fixed timestep for physics
    world.step(1/60, deltaTime, 3);
    
    // Camera update
    cameraManager.update();
    
    // Game object updates - don't update enemies and player movement if game over
    if (!isGameOver) {
        player.update(deltaTime, keys, cursorWorld, scene, playerBody);
        enemySpawner.update(deltaTime);
        turret.updateDragPosition(raycaster);
        turret.update(deltaTime, enemySpawner.enemies);
        bulletManager.update(deltaTime, enemySpawner.enemies, obstacleManager.obstacles);
      
        if (shotCooldownTimer > 0) {
          shotCooldownTimer -= deltaTime;
          UI.updateCooldownCircle(1 - shotCooldownTimer / UI.getCurrentCooldown(SHOT_COOLDOWN_S));
          if (shotCooldownTimer <= 0) {
            canShoot = true;
            shotCooldownTimer = 0;
            UI.updateCooldownCircle(1);
          }
        }
    
        player.position.copy(playerBody.position);
        obstacleManager.synchronizeObstacles();
    }

    // Always update explosions
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
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate(performance.now());