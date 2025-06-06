import * as THREE from 'three';
import { RING_THICKNESS } from './settings.js';

/**
 * Reusable asset manager to reduce memory usage and improve performance
 * by sharing geometries and materials across the game
 */
class AssetManager {
    constructor() {
        // Shared Geometries
        this.geometries = {
            // Common shapes
            box: new THREE.BoxGeometry(1, 1, 1),
            sphere: new THREE.SphereGeometry(1, 16, 12),
            cylinder: new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6),
            plane: new THREE.PlaneGeometry(1, 1),
            ring: new THREE.RingGeometry(1 - RING_THICKNESS, 1, 64),
            
            // Special shapes
            bullet: new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6),
            bulletGlow: new THREE.SphereGeometry(0.15, 8, 8)
        };
        
        // Shared Materials
        this.materials = {
            // Basic materials
            red: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
            green: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
            blue: new THREE.MeshBasicMaterial({ color: 0x0000ff }),
            white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
            
            // Special materials
            bulletBase: new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
            bulletGlow: new THREE.MeshBasicMaterial({ 
                color: 0xff6600, 
                transparent: true, 
                opacity: 0.3 
            }),
            
            // Transparent materials
            transparentRed: new THREE.MeshBasicMaterial({ 
                color: 0xff0000, 
                transparent: true, 
                opacity: 0.5 
            })
        };
        
        // Utility functions
        this.getClonedMaterial = (key) => {
            if (this.materials[key]) {
                return this.materials[key].clone();
            }
            console.warn(`Material ${key} not found`);
            return this.materials.white.clone();
        };
    }
    
    // Get a mesh with a shared geometry and a cloned material for unique customization
    getMesh(geometryKey, materialKey) {
        const geometry = this.geometries[geometryKey];
        if (!geometry) {
            console.warn(`Geometry ${geometryKey} not found`);
            return null;
        }
        
        const material = this.getClonedMaterial(materialKey);
        return new THREE.Mesh(geometry, material);
    }
    
    // Dispose all shared resources when game exits
    dispose() {
        Object.values(this.geometries).forEach(geometry => geometry.dispose());
        Object.values(this.materials).forEach(material => material.dispose());
    }
}

export const Assets = new AssetManager();
