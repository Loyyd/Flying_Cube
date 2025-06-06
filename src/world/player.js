import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';
import {
    PLAYER_SPEED,
    PLAYER_ROTATION_SPEED,
    SHOT_RANGE,
    SHOT_EFFECT_DURATION_S,
    SHOT_COOLDOWN_S,
    SHOT_ACTIVE_COLOR,
    EXPLOSION_DELAY_S,
    RING_THICKNESS,
    RING_OPACITY,
    CURSOR_INDICATOR_SEGMENTS,
    CURSOR_INDICATOR_OPACITY,
    PLAYER_BOX_HALF_EXTENTS // Import PLAYER_BOX_HALF_EXTENTS
} from '../core/settings.js';
import { UI } from '../ui/uiManager.js'; // Added missing import for UI

class Player extends THREE.Mesh {
    constructor(initialPosition = new THREE.Vector3(0, 3, 0)) {
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
        this.siegeDriveAction = null;
        this.siegeShootAction = null;
        this.canMove = true;
        this.targetRotationY = this.rotation.y;
        this.rotorBone = null;
        this.targetQuaternion = new THREE.Quaternion();
        this.collisionBoxHelper = null;
        this.physicsBody = null;
    }


    loadModel(scene) {
        const loader = new GLTFLoader();
        loader.load('/assets/tank.glb', (gltf) => {
            const tank = gltf.scene;
            tank.scale.set(0.3, 0.3, 0.3);
            this.add(tank);

            this.mixer = new THREE.AnimationMixer(tank);
            const animations = gltf.animations;

            this.siegeAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeMode'));
            this.siegeREAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeModeRE'));
            this.siegeDriveAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeDrive'));
            this.siegeShootAction = this.mixer.clipAction(animations.find(clip => clip.name === 'SiegeShoot'));
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
            if (this.siegeShootAction) {
                this.siegeShootAction.setLoop(THREE.LoopOnce);
                this.siegeShootAction.clampWhenFinished = true;
                this.siegeShootAction.enable = true;
            }
            this.rotorBone = tank.getObjectByName("rotor");
        });
        scene.add(this); // Add the player (which is a THREE.Mesh) to the scene
        
        // Add collision box visualization using PLAYER_BOX_HALF_EXTENTS
        const boxGeometry = new THREE.BoxGeometry(
            PLAYER_BOX_HALF_EXTENTS.x * 2,
            PLAYER_BOX_HALF_EXTENTS.y * 2,
            PLAYER_BOX_HALF_EXTENTS.z * 2
        );
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        this.collisionBoxHelper = new THREE.Mesh(boxGeometry, wireframeMaterial);
        this.collisionBoxHelper.visible = false;  // Set initially invisible
        // Add the helper to the player mesh itself so it inherits transformations
        this.add(this.collisionBoxHelper); 
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
                this.siegeDriveAction.paused = true;
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
            if (playerBody.sleepState === CANNON.Body.SLEEPING) {
                playerBody.wakeUp();
            }
            playerBody.velocity.set(
                moveVector.x * this.speed,
                playerBody.velocity.y,
                moveVector.z * this.speed
            );
            let targetRotationY = Math.atan2(moveVector.x, moveVector.z);
            let currentRotationY = this.rotation.y % (Math.PI * 2);
            let diff = targetRotationY - currentRotationY;
            if (diff > Math.PI) {
                diff -= Math.PI * 2;
            } else if (diff < -Math.PI) {
                diff += Math.PI * 2;
            }
            this.targetRotationY = currentRotationY + diff;
            
            if (this.siegeDriveAction) {
                this.siegeDriveAction.paused = false;
                if (!this.siegeDriveAction.isRunning()) {
                    this.siegeDriveAction.reset().play();
                }
            }
        } else {
            playerBody.velocity.set(0, playerBody.velocity.y, 0);
            if (this.siegeDriveAction) {
                this.siegeDriveAction.paused = true;
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

        if (playerBody) {
            playerBody.sleep();
            playerBody.velocity.set(0, 0, 0);
        }

        if (this.siegeDriveAction) this.siegeDriveAction.stop();
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
            this.canMove = false;

            const onAnimationFinished = (event) => {
                if (event.action === this.siegeREAction) {
                    this.canMove = true;
                    if (playerBody) {
                        playerBody.wakeUp();
                    }
                    if (this.siegeDriveAction) {
                        this.siegeDriveAction.reset().play();
                        this.siegeDriveAction.setEffectiveWeight(1.0);
                    }
                    this.mixer.removeEventListener('finished', onAnimationFinished);
                }
            };

            this.mixer.addEventListener('finished', onAnimationFinished);
            this.siegeREAction.reset().play();
            this.siegeREAction.setEffectiveWeight(1.0);
        } else {
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
        const currentRadius = UI.getShotRadius();
        if (!this.cursorIndicator || this.cursorIndicator.geometry.parameters.radius !== currentRadius) {
            if (this.cursorIndicator) {
                scene.remove(this.cursorIndicator);
                this.disposeMesh(this.cursorIndicator);
            }
            const indicatorGeo = new THREE.CircleGeometry(currentRadius, CURSOR_INDICATOR_SEGMENTS);
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
    createShotRangeCircle(scene, position, color = 0xff0000, radius = SHOT_RANGE) {
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

        // Update visual rotation
        this.targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.targetRotationY);
        this.quaternion.slerp(this.targetQuaternion, deltaTime * PLAYER_ROTATION_SPEED);

        // Update physics body rotation to match visual rotation
        const physicsQuaternion = new CANNON.Quaternion();
        physicsQuaternion.copy(this.quaternion);
        playerBody.quaternion.copy(physicsQuaternion);

        // The collisionBoxHelper is a child of `this` (Player mesh),
        // so its position and rotation are relative to the player mesh.
        // The player mesh's position is synced with playerBody.position in main.js.
        // The player mesh's rotation is updated by slerp above.
        // Thus, no specific update is needed for collisionBoxHelper here.

        if (this.isCombatMode) {
            this.createCursorIndicator(scene, cursorWorld);
            this.updateCursorIndicator(cursorWorld);
            this.updateRotorRotation(cursorWorld);
        } else {
            this.removeCursorIndicator(scene);
        }
    }

    /**
     * Plays the shoot animation once
     */
    playShootAnimation() {
        if (this.siegeShootAction) {
            this.siegeShootAction.stop();
            this.siegeShootAction.reset().play();
        }
    }
    
    toggleCollisionBox(visible) {
        if (this.collisionBoxHelper) {
            this.collisionBoxHelper.visible = visible;
            // Opacity was already handled by the material, 
            // but explicitly setting it here if needed for some reason.
            // this.collisionBoxHelper.material.opacity = visible ? 0.5 : 0; 
        }
    }
}

export default Player;
export {
    SHOT_RANGE,
    SHOT_EFFECT_DURATION_S,
    SHOT_COOLDOWN_S,
    SHOT_ACTIVE_COLOR,
    EXPLOSION_DELAY_S
};
