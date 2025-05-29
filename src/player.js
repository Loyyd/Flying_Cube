import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

// SETTINGS
const PLAYER_SPEED = 5.0;
const SHOT_RANGE = 10;
const RING_THICKNESS = 0.15;
const RING_OPACITY = 0.4;
const CURSOR_INDICATOR_RADIUS = 0.5;
const CURSOR_INDICATOR_SEGMENTS = 16;
const CURSOR_INDICATOR_OPACITY = 0.8;

// Neue Einstellung für die Rotationsgeschwindigkeit
const ROTATION_SPEED = 5.0; // Adjust this value to control rotation speed

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
        this.canMove = true;
        this.targetRotationY = this.rotation.y; // Store the target rotation
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
    if (this.isCombatMode || !this.canMove) {
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
        targetRotationY = currentRotationY + diff;

        this.targetRotationY = targetRotationY;


    } else {
        playerBody.velocity.set(0, playerBody.velocity.y, 0);
    }

    // Smoothly rotate towards the target rotation
    this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, this.targetRotationY, deltaTime * ROTATION_SPEED);
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

        if (this.siegeREAction && this.mixer) { // Stellen Sie sicher, dass der Mixer existiert
            this.canMove = false; // Bewegung sofort deaktivieren

            const onAnimationFinished = (event) => {
                if (event.action === this.siegeREAction) {
                    this.canMove = true; 
                    if (playerBody) {
                        playerBody.wakeUp();
                    }
                    this.mixer.removeEventListener('finished', onAnimationFinished);
                }
            };
            

            this.mixer.addEventListener('finished', onAnimationFinished);
            this.siegeREAction.reset().play();

        } else {
            // Wenn keine Animation zum Beenden vorhanden ist oder kein Mixer, Bewegung sofort erlauben
            this.canMove = true;
            if (playerBody) {
                playerBody.wakeUp();
            }
        }

        if (this.activationRangeRing) {
            scene.remove(this.activationRangeRing);
            this.disposeMesh(this.activationRangeRing);
            this.activationRangeRing = null;
        }
        this.removeCursorIndicator(scene);

        // PlayerBody aufwecken, falls nicht durch Animation geschehen
        // Die move() Funktion wird die Bewegung ohnehin stoppen, wenn canMove false ist.
        if (playerBody && !this.siegeREAction) { // Nur wenn keine Animation gestartet wurde
             playerBody.wakeUp();
        } else if (playerBody && this.siegeREAction && !this.canMove) {
            // Wenn eine Animation läuft, ist der Körper möglicherweise noch im Schlaf,
            // aber die Bewegung wird durch canMove = false verhindert.
            // playerBody.wakeUp(); // Kann hier auch schon passieren.
        }
         if (playerBody) { // Generelles Aufwecken, falls es noch schläft.
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

        if (this.isCombatMode) {
            this.createCursorIndicator(scene, cursorWorld);
            this.updateCursorIndicator(cursorWorld);
            this.updateRotorRotation(cursorWorld);
        } else {
            this.removeCursorIndicator(scene);
        }
    }
}

export default Player;
