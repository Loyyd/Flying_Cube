import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';
import {
    PLAYER_SPEED,
    PLAYER_ROTATION_SPEED,
    SHOT_RANGE,
    SHOT_RADIUS,
    SHOT_EFFECT_DURATION_S,
    SHOT_COOLDOWN_S,
    SHOT_ACTIVE_COLOR,
    EXPLOSION_DELAY_S,
    RING_THICKNESS,
    RING_OPACITY,
    CURSOR_INDICATOR_RADIUS,
    CURSOR_INDICATOR_SEGMENTS,
    CURSOR_INDICATOR_OPACITY
} from '../core/settings.js';

// SETTINGS

/* const SHOT_RANGE = 10;
const SHOT_RADIUS = 1;
const SHOT_EFFECT_DURATION_S = 0.01;
const SHOT_COOLDOWN_S = 2;
const SHOT_ACTIVE_COLOR = 0xff0000;
const EXPLOSION_DELAY_S = 0.3;

const RING_THICKNESS = 0.15;
const RING_OPACITY = 0.4;
const CURSOR_INDICATOR_RADIUS = 0.5;
const CURSOR_INDICATOR_SEGMENTS = 16;
const CURSOR_INDICATOR_OPACITY = 0.8; */



class Player extends THREE.Mesh {
    constructor(initialPosition = new THREE.Vector3(0, 0, 0)) {
        super();
        this.speed = PLAYER_SPEED;
        this.isCombatMode = false;
        this.canShoot = true;
        this.shotCooldownTimer = 0;
        this.lastShotDirection = new THREE.Vector3(0, 0, -1);
        this.activationRangeRing = null;
        this.cursorIndicator = null;
        this.mixer = null;
        this.siegeAction = null;
        this.siegeREAction = null;
        this.siegeDriveAction = null; // Keep "SiegeDrive" reference
        this.canMove = true;
        this.targetRotationY = this.rotation.y; // Store the target rotation
        this.rotorBone = null;
        this.targetQuaternion = new THREE.Quaternion();
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
            this.siegeDriveAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeDrive'));
            if (this.siegeDriveAction) {
                this.siegeDriveAction.setLoop(THREE.LoopRepeat);
                this.siegeDriveAction.clampWhenFinished = false;
                this.siegeDriveAction.enable = true;
            }

            [this.siegeAction, this.siegeREAction].forEach(action => {
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
                action.enable = true;
            });
            this.rotorBone = tank.getObjectByName("rotor");
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
        if (this.isCombatMode || !this.canMove) {
            playerBody.velocity.set(0, playerBody.velocity.y, 0);
            if (this.siegeDriveAction) {
                this.siegeDriveAction.paused = true; // Pause "SiegeDrive" animation
            }
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

            // Wake up the player body if it is asleep
            if (playerBody.sleepState === CANNON.Body.SLEEPING) {
                playerBody.wakeUp();
            }
            
            playerBody.velocity.set(
                moveVector.x * this.speed,
                playerBody.velocity.y,
                moveVector.z * this.speed
            );

            // Calculate the target rotation
            let targetRotationY = Math.atan2(moveVector.x, moveVector.z);

            // Normalize angles to ensure shortest rotation
            let currentRotationY = this.rotation.y % (Math.PI * 2);
            let diff = targetRotationY - currentRotationY;
            if (diff > Math.PI) {
                diff -= Math.PI * 2;
            } else if (diff < -Math.PI) {
                diff += Math.PI * 2;
            }
            this.targetRotationY = currentRotationY + diff;

            if (this.siegeDriveAction) {
                this.siegeDriveAction.paused = false; // Resume "SiegeDrive" animation
                if (!this.siegeDriveAction.isRunning()) {
                    this.siegeDriveAction.reset().play(); // Play "SiegeDrive" animation
                }
            }
        } else {
            playerBody.velocity.set(0, playerBody.velocity.y, 0);
            if (this.siegeDriveAction) {
                this.siegeDriveAction.paused = true; // Pause "SiegeDrive" animation
            }
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
        if (this.siegeREAction) this.siegeREAction.stop();
        if (this.siegeAction) this.siegeAction.reset().play();

        if (!this.activationRangeRing) {
            const ringGeo = new THREE.RingGeometry(SHOT_RANGE - RING_THICKNESS, SHOT_RANGE, 64);
            const ringMat = new THREE.MeshBasicMaterial({ color: playerActiveColor, side: THREE.DoubleSide, transparent: true, opacity: RING_OPACITY });
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

        if (this.siegeDriveAction) this.siegeDriveAction.stop(); // Stop "SiegeDrive" animation
    }

    /**
     * Exits combat mode, updating player visuals and physics body state.
     * @param {THREE.Scene} scene - The Three.js scene.
     * @param {CANNON.Body} playerBody - The Cannon.js body associated with the player.
     */
    exitCombatMode(scene, playerBody) {
        this.isCombatMode = false;
        if (this.siegeAction) {
            this.siegeAction.stop();
        }

        if (this.siegeREAction && this.mixer) {
            this.canMove = false; // Disable movement immediately

            const onAnimationFinished = (event) => {
                if (event.action === this.siegeREAction) {
                    this.canMove = true;
                    if (playerBody) {
                        playerBody.wakeUp();
                    }
                    if (this.siegeDriveAction) {
                        this.siegeDriveAction.reset().play(); // Properly reset and play "SiegeDrive" animation
                        this.siegeDriveAction.setEffectiveWeight(1.0);
                    }
                    this.mixer.removeEventListener('finished', onAnimationFinished);
                }
            };

            this.mixer.addEventListener('finished', onAnimationFinished);
            this.siegeREAction.reset().play();
            this.siegeREAction.setEffectiveWeight(1.0);
        } else {
            // If no exit animation or mixer, allow movement immediately
            this.canMove = true;
            if (playerBody) {
                playerBody.wakeUp();
            }
            if (this.siegeDriveAction) {
                this.siegeDriveAction.reset().play();
                this.siegeDriveAction.setEffectiveWeight(1.0);
            }
        }

        if (this.activationRangeRing) {
            scene.remove(this.activationRangeRing);
            this.disposeMesh(this.activationRangeRing);
            this.activationRangeRing = null;
        }
        this.removeCursorIndicator(scene);

        if (playerBody && !this.siegeREAction) {
            playerBody.wakeUp();
        }
    }

    createCursorIndicator(scene, cursorWorld) {
        if (!this.cursorIndicator) {
            const indicatorGeo = new THREE.CircleGeometry(CURSOR_INDICATOR_RADIUS, CURSOR_INDICATOR_SEGMENTS);
            const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: CURSOR_INDICATOR_OPACITY });
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
     * Creates and adds a red circle to the scene at the given position.
     * Returns the mesh for later removal.
     * @param {THREE.Scene} scene
     * @param {THREE.Vector3} position
     * @param {number} color
     * @param {number} radius (optional)
     */
    createShotRangeCircle(scene, position, color = 0xff0000, radius = SHOT_RADIUS) {
        const circleGeometry = new THREE.CircleGeometry(radius, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5
        });
        const shotCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        shotCircle.rotation.x = -Math.PI / 2;
        shotCircle.position.set(position.x, 0.01, position.z);
        scene.add(shotCircle);
        return shotCircle;
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
        this.move(deltaTime, keys, playerBody);
        this.updateActivationRangeRing();

        this.targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.targetRotationY);
        this.quaternion.slerp(this.targetQuaternion, deltaTime * PLAYER_ROTATION_SPEED);

        if (this.isCombatMode) {
            this.createCursorIndicator(scene, cursorWorld);
            this.updateCursorIndicator(cursorWorld);
            this.updateRotorRotation(cursorWorld);
        } else {
            this.removeCursorIndicator(scene);
        }
        this.quaternion.slerp(this.targetQuaternion, deltaTime * PLAYER_ROTATION_SPEED); // Use slerp for smooth quaternion interpolation
    }
}

export default Player;
export {
    SHOT_RANGE,
    SHOT_RADIUS,
    SHOT_EFFECT_DURATION_S,
    SHOT_COOLDOWN_S,
    SHOT_ACTIVE_COLOR,
    EXPLOSION_DELAY_S
};
