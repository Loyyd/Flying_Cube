// Score
export const GameState = {
    score: 200
};

export class UIManager {
    constructor() {
        this.score = GameState.score;
        this.shotRadius = 1;
        this.cooldownLevel = 0;
        this.COOLDOWN_UPGRADE_MAX = 4;
        this.COOLDOWN_REDUCTION_PER_LEVEL = 0.2;

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
            const upgradeResponse = await fetch('src/templates/upgrade-component.html');
            const upgradeTemplate = await upgradeResponse.text();
            const upgradeDoc = new DOMParser().parseFromString(upgradeTemplate, 'text/html');
            const upgradeComponentTemplate = upgradeDoc.querySelector('#upgrade-component-template');

            // Load main template
            const response = await fetch('src/templates/upgrades.html');
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
                progress: el.querySelector('.upgrade-progress'),
                type: el.dataset.progressType
            });
        });

        // Update references to match new structure
        const radiusComponent = this.upgradeComponents.get('radius');
        const cooldownComponent = this.upgradeComponents.get('cooldown');
        
        this.increaseRadiusBtn = radiusComponent.button;
        this.shotRadiusSquares = radiusComponent.progress;
        this.decreaseCooldownBtn = cooldownComponent.button;
        this.cooldownLevelBar = cooldownComponent.progress;
    }

    setupEventListeners() {
        this.increaseRadiusBtn.addEventListener('click', () => this.handleRadiusUpgrade());
        this.decreaseCooldownBtn.addEventListener('click', () => this.handleCooldownUpgrade());
    }

    handleRadiusUpgrade() {
        if (this.shotRadius < 2 && this.score >= 20) {
            this.shotRadius += 0.2;
            this.score -= 20;
            this.updateAllUI();
        }
    }

    handleCooldownUpgrade() {
        if (this.cooldownLevel < this.COOLDOWN_UPGRADE_MAX && this.score >= 20) {
            this.cooldownLevel++;
            this.score -= 20;
            this.updateAllUI();
        }
    }

    updateAllUI() {
        this.updateScoreUI();
        this.updateShotRadiusUI();
        this.updateCooldownBarUI();
    }

    updateScoreUI() {
        this.scoreElement.textContent = this.score;
    }

    updateShotRadiusUI() {
        const progress = this.upgradeComponents.get('radius').progress;
        progress.innerHTML = '';
        for (let i = 1; i <= 2; i += 0.2) {
            const square = document.createElement('div');
            square.className = 'shot-radius-square' + (i <= this.shotRadius ? ' filled' : '');
            progress.appendChild(square);
        }
    }

    updateCooldownBarUI() {
        const progress = this.upgradeComponents.get('cooldown').progress;
        const percent = 1 - Math.min(this.cooldownLevel * this.COOLDOWN_REDUCTION_PER_LEVEL, 0.8);
        progress.style.width = (percent * 100) + '%';
    }

    updateCooldownCircle(progress) {
        const offset = 100 - progress * 100;
        this.cooldownCircle.style.strokeDashoffset = offset;
    }

    getCurrentCooldown(baseCooldown) {
        const reduction = Math.min(this.cooldownLevel * this.COOLDOWN_REDUCTION_PER_LEVEL, 0.8);
        return baseCooldown * (1 - reduction);
    }

    addScore(amount) {
        this.score += amount;
        this.updateScoreUI();
    }

    getShotRadius() {
        return this.shotRadius;
    }
}

export const UI = new UIManager();
