import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './world/player.js';
import { Assets } from './core/assetManager.js';
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

      const shootDirection = new THREE.Vector3();
      shootDirection.subVectors(intersectPoint, player.position).normalize();
      player.lastShotDirection.copy(shootDirection);
      player.playShootAnimation();
      
      setTimeout(() => {
        const radius = UI.getShotRadius();
        const shotCircle = shotCirclePool.get(
          new THREE.Vector3(intersectPoint.x, 0.01, intersectPoint.z),
          SHOT_ACTIVE_COLOR, 
          radius
        );
        
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

// --- Shot Effect Object Pool ---
const shotCirclePool = {
  pool: [],
  maxSize: 20,
  
  get: function(position, color, radius) {
    let circle;
    if (this.pool.length > 0) {
      circle = this.pool.pop();
      circle.material.color.set(color);
      circle.scale.set(radius, radius, radius);
      circle.position.copy(position);
    } else {
      const ringGeo = new THREE.RingGeometry(1 - RING_THICKNESS, 1, 64);
      const ringMat = new THREE.MeshBasicMaterial({ 
        color: color, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: RING_OPACITY 
      });
      circle = new THREE.Mesh(ringGeo, ringMat);
      circle.rotation.x = -Math.PI / 2;
      circle.scale.set(radius, radius, radius);
      circle.position.copy(position);
    }
    scene.add(circle);
    return circle;
  },
  
  release: function(circle) {
    scene.remove(circle);
    if (this.pool.length < this.maxSize) {
      this.pool.push(circle);
    } else {
      circle.geometry.dispose();
      circle.material.dispose();
    }
  }
};

// --- Active Shots Cleanup ---
function updateActiveShots() {
  const currentTime = clock.elapsedTime;
  for (let i = activeShots.length - 1; i >= 0; i--) {
    const shot = activeShots[i];
    if (currentTime >= shot.endTime) {
      shotCirclePool.release(shot.mesh);
      activeShots.splice(i, 1);
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
    
    // Game object updates
    player.update(deltaTime, keys, cursorWorld, scene, playerBody);
    enemySpawner.update(deltaTime);
    turret.updateDragPosition(raycaster);
    turret.update(deltaTime, enemySpawner.enemies);
    bulletManager.update(deltaTime, enemySpawner.enemies, obstacleManager.obstacles);
  
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
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate(performance.now());