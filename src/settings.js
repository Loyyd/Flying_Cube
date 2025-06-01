// Score
export const GameState = {
    score: 150
};

// Player settings
export const PLAYER_SPEED = 5.0;
export const PLAYER_ROTATION_SPEED = 5.0;

// Shot settings
export const SHOT_RANGE = 10;
export const SHOT_RADIUS = 1;
export const SHOT_EFFECT_DURATION_S = 0.01;
export const SHOT_COOLDOWN_S = 1;
export const SHOT_ACTIVE_COLOR = 0xff0000;
export const EXPLOSION_DELAY_S = 0.3;

// Visual indicators
export const RING_THICKNESS = 0.15;
export const RING_OPACITY = 0.4;
export const CURSOR_INDICATOR_RADIUS = 0.5;
export const CURSOR_INDICATOR_SEGMENTS = 16;
export const CURSOR_INDICATOR_OPACITY = 0.8;

// Obstacle settings
export const OBSTACLE1_COLOR = "#00FF00";
export const OBSTACLE2_COLOR = "#8fce00";
export const OBSTACLE_WALL_COLOR = 50549;
export const OBSTACLE_RANDOM_COLOR = 50549;
export const NUM_RANDOM_OBSTACLES = 50;

// Enemy settings
export const ENEMY_RADIUS = 0.5;
export const ENEMY_SPEED = 1.0;
export const ENEMY_WANDER_SPEED = 1;
export const ENEMY_DARK_RED = 0x660000;
export const ENEMY_CHASE_RADIUS = 8;
export const ENEMY_WANDER_CHANGE_INTERVAL = 1;

// EnemySpawner settings
export const ENEMY_BOX_SIZE = 1;
export const ENEMY_SPAWN_RADIUS = 2;
export const ENEMY_NUM_BOXES = 2;
export const ENEMY_SPAWN_INTERVAL_MS = 3000;

// Camera settings
export const CAMERA_OFFSET_X = 0;
export const CAMERA_OFFSET_Y = 10;
export const CAMERA_OFFSET_Z = 10;
export const CAMERA_LERP_FACTOR = 0.05;

// Game/scene settings
export const GRID_SIZE = 50;
export const PLAYER_SIZE = 1;
export const SCENE_BACKGROUND_COLOR = 0x282c34;

// Shot radius UI
export const SHOT_RADIUS_MIN = 1;
export const SHOT_RADIUS_MAX = 2;

// --- Physics Material ---
import * as CANNON from 'cannon-es';
export const defaultMaterial = new CANNON.Material('default');
export const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.5,
    restitution: 0.2,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  }
);
