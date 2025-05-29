import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es'; // Import cannon-es

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

    /**
     * Moves the player using Cannon.js physics (kinematic body).
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {object} keys - Object containing current key states.
     * @param {CANNON.Body} playerBody - The Cannon.js body associated with the player.
     */
    move(deltaTime, keys, playerBody) {
        if (this.isCombatMode) {
            // Stop movement when in combat mode
            playerBody.velocity.set(0, playerBody.velocity.y, 0);
            return;
        }

        let dx = 0;
        let dz = 0;
        if (keys['w']) dz -= 1;
        if (keys['s']) dz += 1;
        if (keys['a']) dx -= 1;
        if (keys['d']) dx += 1;

        const moveVector = new THREE.Vector3(dx, 0, dz);

        if (moveVector.lengthSq() > 0) {
            moveVector.normalize();
            // Set the velocity directly for kinematic bodies
            playerBody.velocity.set(
                moveVector.x * this.speed,
                playerBody.velocity.y, // Preserve vertical velocity (e.g., from gravity)
                moveVector.z * this.speed
            );
            // Update Three.js mesh rotation based on movement direction
            this.rotation.y = Math.atan2(moveVector.x, moveVector.z);
        } else {
            // Stop movement if no keys are pressed
            playerBody.velocity.set(0, playerBody.velocity.y, 0);
        }
    }

    /**
     * Enters combat mode, updating player visuals and physics body state.
     * @param {THREE.Scene} scene - The Three.js scene.
     * @param {number} playerActiveColor - The color for the player in active mode.
     * @param {CANNON.Body} playerBody - The Cannon.js body associated with the player.
     */
    enterCombatMode(scene, playerActiveColor, playerBody) {
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

        // Put player body to sleep and clear velocity when entering combat mode
        if (playerBody) {
            playerBody.sleep();
            playerBody.velocity.set(0, 0, 0);
        }
    }

    /**
     * Exits combat mode, updating player visuals and physics body state.
     * @param {THREE.Scene} scene - The Three.js scene.
     * @param {CANNON.Body} playerBody - The Cannon.js body associated with the player.
     */
    exitCombatMode(scene, playerBody) {
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

        // Wake up player body when exiting combat mode
        if (playerBody) {
            playerBody.wakeUp();
            // Optionally, reset velocity here if needed, though `move` will set it on next input
            // playerBody.velocity.set(0, playerBody.velocity.y, 0);
        }
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

    /**
     * Updates the player's state, including movement and combat mode visuals.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {object} keys - Object containing current key states.
     * @param {THREE.Vector3} cursorWorld - The 3D world coordinates of the mouse cursor.
     * @param {THREE.Scene} scene - The Three.js scene.
     * @param {CANNON.Body} playerBody - The Cannon.js body associated with the player.
     */
    update(deltaTime, keys, cursorWorld, scene, playerBody) {
        if (this.mixer) this.mixer.update(deltaTime);
        this.move(deltaTime, keys, playerBody); // Pass playerBody to move function
        this.updateActivationRangeRing();

        if (this.isCombatMode) {
            this.createCursorIndicator(scene, cursorWorld);
            this.updateCursorIndicator(cursorWorld);
            this.updateRotorRotation(cursorWorld); // Update rotor rotation in combat mode
        } else {
            this.removeCursorIndicator(scene);
        }
    }
}

export default Player;
