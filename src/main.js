import * as THREE from 'three';
import * as CANNON from 'cannon-es'; 
import Player from './player.js';
import { SHOT_RANGE, SHOT_RADIUS, SHOT_EFFECT_DURATION_S, SHOT_COOLDOWN_S, SHOT_ACTIVE_COLOR, EXPLOSION_DELAY_S } from './player.js';
import { Explosion } from './explosion.js';
import CameraManager from './camera.js'; 
import { ObstacleManager } from './obstacleManager.js';

// --- Game Constants ---
const GRID_SIZE = 50;
const PLAYER_SIZE = 1;
const SCENE_BACKGROUND_COLOR = 0x282c34;

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
scene.fog = new THREE.FogExp2(SCENE_BACKGROUND_COLOR, 0.01);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const clock = new THREE.Clock();

// --- Physics World Setup ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.5,
    restitution: 0.2,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial;

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
let shotCooldownTimer = 0;

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

const groundShape = new CANNON.Plane();
const groundBody = new CANNON.Body({ mass: 0, material: defaultMaterial });
groundBody.addShape(groundShape);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// --- Obstacles ---
const obstacleManager = new ObstacleManager(scene, world, defaultMaterial, GRID_SIZE);
obstacleManager.initializeObstacles();

// --- Player ---
const player = new Player();
player.loadModel(scene);

// --- Camera Setup ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraManager = new CameraManager(camera, player);

const playerShape = new CANNON.Box(new CANNON.Vec3(PLAYER_SIZE * 1.3, PLAYER_SIZE, PLAYER_SIZE * 1.3));
const playerBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: defaultMaterial });
playerBody.addShape(playerShape);
playerBody.position.set(player.position.x, player.position.y, player.position.z);
world.addBody(playerBody);

// --- Active Shots & Explosions ---
const activeShots = [];
const explosions = [];

// --- Input Handling ---
const keys = {};
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
    shotCooldownTimer = SHOT_COOLDOWN_S;
    updateCooldownBar(0);

    player.lastShotDirection.subVectors(intersectPoint, player.position).normalize();
    player.lastShotDirection.y = 0;

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
        endTime: clock.elapsedTime + SHOT_EFFECT_DURATION_S,
        position: shotCircle.position.clone()
      });
      createExplosion(intersectPoint);
    }, EXPLOSION_DELAY_S * 1000);
  }
});

// --- Explosion Creation ---
function createExplosion(position) {
  explosions.push(new Explosion(position, scene, world));
}

// --- Game Logic Functions ---
function updateCooldownBar(progress) {
  const cooldownBar = document.getElementById('cooldown-bar');
  cooldownBar.style.transition = progress === 1 ? 'none' : 'width 0.5s ease-in-out'; // Disable transition when full
  cooldownBar.style.width = `${Math.min(1, Math.max(0, progress)) * 100}%`;
}

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

// --- Animation Loop ---
function animate() {
  cameraManager.update();
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  world.step(1 / 60, deltaTime, 3);

  player.update(deltaTime, keys, cursorWorld, scene, playerBody);

  if (shotCooldownTimer > 0) {
    shotCooldownTimer -= deltaTime;
    updateCooldownBar(1 - shotCooldownTimer / SHOT_COOLDOWN_S);
    if (shotCooldownTimer <= 0) {
      canShoot = true;
      shotCooldownTimer = 0;
      updateCooldownBar(1);
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
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
