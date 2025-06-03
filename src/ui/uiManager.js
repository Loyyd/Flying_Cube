import { GameState } from '../core/settings.js';
const TEMPLATE_PATHS = {
    UPGRADE_COMPONENT: 'public/templates/upgrade-component.html',
    UPGRADES: 'public/templates/upgrades.html'
};

//SHOTRADIUS
const RadiusUpgradeCost = 100;
const base_shot_radius = GameState.SHOT_RADIUS;
const RADIUS_INCREASE_STEP = 0.5;
const SHOT_RADIUS_MAX = 3.5;

//COOLDOWN
const CooldownUpgradeCost = 100;
const MAX_COOLDOWN_LEVEL = 5;
const COOLDOWN_REDUCTION_PER_LEVEL = 0.19;
const MAX_COOLDOWN_REDUCTION = 1;

//TURRET
export const TURRET_COST = 250;



export class UIManager {
    constructor() {
        this.score = GameState.score;
        this.shotRadius = base_shot_radius;
        this.cooldownLevel = 0;
        this.COOLDOWN_UPGRADE_MAX = MAX_COOLDOWN_LEVEL;
        this.COOLDOWN_REDUCTION_PER_LEVEL = COOLDOWN_REDUCTION_PER_LEVEL;

        // UI Elements
        this.scoreElement = document.getElementById('score-value');
        this.shotRadiusSquares = document.getElementById('shot-radius-squares');
        this.increaseRadiusBtn = document.getElementById('increase-radius-btn');
        this.decreaseCooldownBtn = document.getElementById('decrease-cooldown-btn');
        this.cooldownLevelBar = document.getElementById('cooldown-level-bar-inner');
        this.cooldownCircle = document.querySelector('#cooldown-bar .circle');

        this.upgradeComponents = new Map();

        this.loadTemplate();
    }

    async loadTemplate() {
        try {
            // Load upgrade component template
            const upgradeResponse = await fetch(TEMPLATE_PATHS.UPGRADE_COMPONENT);
            const upgradeTemplate = await upgradeResponse.text();
            const upgradeDoc = new DOMParser().parseFromString(upgradeTemplate, 'text/html');
            const upgradeComponentTemplate = upgradeDoc.querySelector('#upgrade-component-template');

            // Load main template
            const response = await fetch(TEMPLATE_PATHS.UPGRADES);
            const mainTemplate = await response.text();
            const doc = new DOMParser().parseFromString(mainTemplate, 'text/html');
            const template = doc.querySelector('#shot-radius-ui-template');
            
            const container = document.getElementById('shot-radius-ui-container');
            container.appendChild(template.content.cloneNode(true));

            // Initialize upgrade components
            this.initializeUpgradeComponents(upgradeComponentTemplate);
            
            this.setupEventListeners();
            this.updateAllUI();
        } catch (error) {
            console.error('Failed to initialize UI:', error);
        }
    }

    initializeUpgradeComponents(template) {
        const upgradeElements = document.querySelectorAll('[data-upgrade]');
        
        upgradeElements.forEach(el => {
            const type = el.dataset.upgrade;
            const component = template.content.cloneNode(true);
            
            // Replace template variables
            const html = component.firstElementChild.outerHTML
                .replace('${title}', el.dataset.title)
                .replace('${label}', el.dataset.label)
                .replace('${cost}', el.dataset.cost);
                
            el.innerHTML = html;
            
            // Store references
            this.upgradeComponents.set(type, {
                button: el.querySelector('.upgrade-btn'),
                type: el.dataset.type,
                squares: el.querySelectorAll('.progress-square')
            });
        });

        // Update references to match new structure
        const radiusComponent = this.upgradeComponents.get('radius');
        const cooldownComponent = this.upgradeComponents.get('cooldown');
        
        this.increaseRadiusBtn = radiusComponent.button;
        this.decreaseCooldownBtn = cooldownComponent.button;

        // Initialize progress squares
        this.updateProgressSquares('radius', 0);
        this.updateProgressSquares('cooldown', 0);
    }

    updateProgressSquares(type, level) {
        const component = this.upgradeComponents.get(type);
        if (!component || !component.squares) return;

        component.squares.forEach((square, index) => {
            if (index < level) {
                square.classList.add('filled');
            } else {
                square.classList.remove('filled');
            }
        });
    }

    setupEventListeners() {
        this.increaseRadiusBtn.addEventListener('click', () => this.handleRadiusUpgrade());
        this.decreaseCooldownBtn.addEventListener('click', () => this.handleCooldownUpgrade());
    }

    handleRadiusUpgrade() {
        if (this.shotRadius < SHOT_RADIUS_MAX && GameState.score >= RadiusUpgradeCost) {
            this.shotRadius += RADIUS_INCREASE_STEP;
            if (this.addScore(-RadiusUpgradeCost)) {
                this.updateProgressSquares('radius', (this.shotRadius-1)*2);
                GameState.SHOT_RADIUS = this.shotRadius;
            }
        }
    }

    handleCooldownUpgrade() {
        if (this.cooldownLevel < this.COOLDOWN_UPGRADE_MAX && GameState.score >= CooldownUpgradeCost) {
            if (this.addScore(-CooldownUpgradeCost)) {
                this.cooldownLevel++;
                this.updateProgressSquares('cooldown', this.cooldownLevel);
            }
        }
    }

    updateAllUI() {
        this.updateScoreUI();
    }

    updateScoreUI() {
        this.score = GameState.score; // Keep local score in sync
        this.scoreElement.textContent = this.score;
        
        // Update turret button state
        const placeCubeBtn = document.getElementById('place-cube-btn');
        if (this.score < TURRET_COST) {
            placeCubeBtn.classList.add('disabled');
        } else {
            placeCubeBtn.classList.remove('disabled');
        }
    }

    updateCooldownCircle(progress) {
        const offset = 100 - progress * 100;
        this.cooldownCircle.style.strokeDashoffset = offset;
    }

    getCurrentCooldown(baseCooldown) {
        const reduction = Math.min(this.cooldownLevel * this.COOLDOWN_REDUCTION_PER_LEVEL, MAX_COOLDOWN_REDUCTION);
        return baseCooldown * (1 - reduction);
    }

    addScore(amount) {
        if (GameState.updateScore(amount)) {
            this.score = GameState.score;
            this.updateScoreUI();
            return true;
        }
        return false;
    }

    getShotRadius() {
        return this.shotRadius;
    }
}

export const UI = new UIManager();
