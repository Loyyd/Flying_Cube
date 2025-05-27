import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class Player extends THREE.Mesh {
    constructor(geometry, material, initialPosition = new THREE.Vector3(0, 0, 0)) {
        super(geometry, material);
        this.speed = 5.0;
        this.isCombatMode = false;
        this.canShoot = true;
        this.shotCooldownTimer = 0;
        this.lastShotDirection = new THREE.Vector3(0, 0, -1);
        this.activationRangeRing = null;
        this.cursorIndicator = null;
        this.mixer = null;
        this.siegeAction = null;
        this.siegeREAction = null;

        this.position.copy(initialPosition);
        this.castShadow = true;
        this.receiveShadow = true;
        this.rotorBone = null;
    }

    loadModel(scene) {
        const loader = new GLTFLoader();
        loader.load('/assets/tank.glb', (gltf) => {
            const tank = gltf.scene;
            tank.scale.set(0.3, 0.3, 0.3);
            this.add(tank); // Make the tank the player's child

            this.mixer = new THREE.AnimationMixer(tank);
            const animations = gltf.animations;

            this.siegeAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeMode'));
            this.siegeREAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeModeRE'));

            [this.siegeAction, this.siegeREAction].forEach(action => {
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
                action.enable = true;
            });

            // Get the rotor bone here, after the model is loaded
            this.rotorBone = tank.getObjectByName("rotor"); 
            if (!this.rotorBone) {
                console.warn("Could not find bone named 'rotor' in tank.glb");
            }
        });
        scene.add(this);
    }

    move(deltaTime, keys, obstacles) {
        if (this.isCombatMode) return; // Can't move in combat mode

        let dx = 0;
        let dz = 0;
        if (keys['w']) dz -= 1;
        if (keys['s']) dz += 1;
        if (keys['a']) dx -= 1;
        if (keys['d']) dx += 1;

        if (dx === 0 && dz === 0) return;

        const moveVector = new THREE.Vector2(dx, dz).normalize();
        const moveAmount = this.speed * deltaTime;

        const newX = this.position.x + moveVector.x * moveAmount;
        const newZ = this.position.z + moveVector.y * moveAmount;

        let collision = false;
        const playerHalfSize = this.geometry.parameters.width / 2; // Assuming BoxGeometry
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
            this.position.x = newX;
            this.position.z = newZ;
            if (moveVector.x !== 0 || moveVector.y !== 0) {
                this.rotation.y = Math.atan2(moveVector.x, moveVector.y);
            }
        }
    }

    enterCombatMode(scene, playerActiveColor) {
        this.isCombatMode = true;
        this.material.color.setHex(playerActiveColor);
        if (this.siegeREAction) this.siegeREAction.stop();
        if (this.siegeAction) this.siegeAction.reset().play();

        if (!this.activationRangeRing) {
            const ringGeo = new THREE.RingGeometry(10 - 0.15, 10, 64); // SHOT_RANGE
            const ringMat = new THREE.MeshBasicMaterial({ color: playerActiveColor, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
            this.activationRangeRing = new THREE.Mesh(ringGeo, ringMat);
            this.activationRangeRing.rotation.x = -Math.PI / 2;
            scene.add(this.activationRangeRing);
        }
        this.activationRangeRing.position.set(this.position.x, 0.02, this.position.z);
    }

    exitCombatMode(scene) {
        this.isCombatMode = false;
        this.material.color.setHex(0x4488ff); // PLAYER_NORMAL_COLOR
        if (this.siegeAction) this.siegeAction.stop();
        if (this.siegeREAction) this.siegeREAction.reset().play();

        if (this.activationRangeRing) {
            scene.remove(this.activationRangeRing);
            this.disposeMesh(this.activationRangeRing);
            this.activationRangeRing = null;
        }
        this.removeCursorIndicator(scene);
    }

    createCursorIndicator(scene, cursorWorld) {
        if (!this.cursorIndicator) {
            const indicatorGeo = new THREE.CircleGeometry(0.5, 16);
            const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            this.cursorIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
            this.cursorIndicator.rotation.x = -Math.PI / 2;
            scene.add(this.cursorIndicator);
        }
        this.cursorIndicator.position.copy(cursorWorld).setComponent(1, 0.01);
    }

    removeCursorIndicator(scene) {
        if (this.cursorIndicator) {
            scene.remove(this.cursorIndicator);
            this.disposeMesh(this.cursorIndicator);
            this.cursorIndicator = null;
        }
    }

    updateCursorIndicator(cursorWorld) {
        if (this.cursorIndicator) {
            this.cursorIndicator.position.copy(cursorWorld).setComponent(1, 0.01);
        }
    }

    updateActivationRangeRing() {
        if (this.activationRangeRing && this.isCombatMode) {
            this.activationRangeRing.position.set(this.position.x, 0.02, this.position.z);
        }
    }

    disposeMesh(mesh) {
        if (!mesh) return;

        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
    }
    updateRotorRotation(cursorWorld) {
        if (this.rotorBone) {
            this.rotorBone.lookAt(cursorWorld);
        }
    }

    update(deltaTime, keys, obstacles, cursorWorld, scene) {
        if (this.mixer) this.mixer.update(deltaTime);
        this.move(deltaTime, keys, obstacles);
        this.updateActivationRangeRing();

        if (this.isCombatMode) {
            this.createCursorIndicator(scene, cursorWorld);
            this.updateCursorIndicator(cursorWorld);
        } else {
            this.removeCursorIndicator(scene);
        }
        // Update the rotor's rotation
        if (this.isCombatMode) {
            this.updateRotorRotation(cursorWorld);  
            this.createCursorIndicator(scene, cursorWorld);
            this.updateCursorIndicator(cursorWorld);
        } else {
            this.removeCursorIndicator(scene);
        }
    }
}

export default Player;