// ===================== 战斗逻辑核心（支持行迹激活状态）=====================
const BattleLogic = {
    // 使用技能
    useSkill: function(skillIndex) {
        const gameState = window.gameState;
        if (!gameState || !gameState.isPlayerTurn || gameState.gameOver) {
            window.showMessage('提示', '当前无法使用技能');
            return false;
        }

        const character = gameState.party[gameState.activeCharacter];
        const enemy = gameState.enemies[gameState.selectedEnemy];
        
        const skill = character.skills ? character.skills[skillIndex] : null;
        if (!skill) {
            window.showMessage('错误', '技能不存在');
            return false;
        }

        if (this.isSkillDisabled(skill, skillIndex)) {
            window.showMessage('提示', '技能条件不满足');
            return false;
        }

        if (!enemy || enemy.hp <= 0) {
            window.showMessage('提示', '请选择有效的目标');
            return false;
        }

        let result = null;
        let success = true;
        try {
            switch(skill.type) {
                case 'normal':
                    result = this.executeNormalAttack(character, enemy, skill);
                    break;
                case 'skill':
                    result = this.executeSkillAttack(character, enemy, skill);
                    break;
                case 'ultimate':
                    result = this.executeUltimateAttack(character, enemy, skill);
                    break;
                case 'defend':
                    result = this.executeDefend(character);
                    break;
                default:
                    console.warn('未知技能类型:', skill.type);
                    success = false;
            }
        } catch (error) {
            console.error('执行技能时出错:', error);
            success = false;
        }

        if (!success) {
            window.showMessage('错误', '技能执行失败');
            return false;
        }

        this.updateAfterSkill(character, enemy, skill, result);
        
        if (result && result.damage !== undefined) {
            window.showDamageEffect(
                gameState.selectedEnemy,
                result.damage,
                result.isCritical || false,
                false
            );
        }

        this.checkBattleEnd();
        if (typeof window.updateBattleUI === 'function') window.updateBattleUI();

        let extraTurnFlag = false;
        if (skill.type === 'normal' && window._extraTurnPending) {
            extraTurnFlag = true;
            window._extraTurnPending = false;
        }

        if (skill.type !== 'defend' && skill.type !== 'ultimate') {
            setTimeout(() => {
                if (gameState.isPlayerTurn && !gameState.gameOver) {
                    if (extraTurnFlag) {
                        window.updateBattleUI();
                    } else {
                        this.switchToNextCharacter();
                    }
                }
            }, 800);
        }

        return true;
    },

    isSkillDisabled: function(skill, skillIndex) {
        const gameState = window.gameState;
        if (!gameState) return true;
        const character = gameState.party[gameState.activeCharacter];
        if (!character || character.hp <= 0) return true;
        switch(skill.type) {
            case 'normal': return false;
            case 'skill':
                return gameState.skillPoints < (skill.skillPointCost || 1);
            case 'ultimate':
                return character.energy < (skill.energyCost || 120);
            default:
                return false;
        }
    },

    // 行迹激活检查辅助函数
    _isTraceActive: function(character, traceId) {
        return character._activatedTraces && character._activatedTraces.includes(traceId);
    },

    executeNormalAttack: function(character, enemy, skill) {
        const gameState = window.gameState;
        const damageResult = GameData.calculateDamage(character, enemy, skill);
        let damage = damageResult.damage || 0;
        if (enemy.isDefDown) damage = Math.floor(damage * 1.3);
        
        enemy.hp -= damage;
        enemy.hp = Math.max(0, enemy.hp);
        
        character.energy = Math.min(character.energy + (skill.energyGain || 20), character.maxEnergy);
        gameState.skillPoints = Math.min(gameState.skillPoints + 1, gameState.maxSkillPoints);
        
        // 额外能力3：风速迅捷（每回合最多触发一次）
        const hasTalent3 = this._isTraceActive(character, 'luguan_talent3');
        if (hasTalent3 && !character._extraTurnUsedInThisTurn) {
            window._extraTurnPending = true;
            character._extraTurnUsedInThisTurn = true;
            console.log(`${character.name} 触发风速迅捷，获得额外行动`);
        }
        
        return {
            damage: damage,
            isCritical: damageResult.isCritical || false,
            type: 'normal'
        };
    },

    executeSkillAttack: function(character, enemy, skill) {
        const gameState = window.gameState;
        const damageResult = GameData.calculateDamage(character, enemy, skill);
        let damage = damageResult.damage || 0;
        
        const hasTalent2 = this._isTraceActive(character, 'luguan_talent2');
        if (hasTalent2 && enemy.debuffs && enemy.debuffs.length > 0) {
            damage = Math.floor(damage * 1.6);
            console.log(`${character.name} 触发精准狩猎，伤害增加60%`);
        }
        
        if (enemy.isDefDown) damage = Math.floor(damage * 1.3);
        
        enemy.hp -= damage;
        enemy.hp = Math.max(0, enemy.hp);
        
        gameState.skillPoints -= (skill.skillPointCost || 1);
        gameState.skillPoints = Math.max(0, gameState.skillPoints);
        character.energy = Math.min(character.energy + (skill.energyGain || 30), character.maxEnergy);
        
        if (skill.hasDefDown && damageResult.isCritical) {
            enemy.isDefDown = true;
            enemy.defDownTurns = skill.defDownTurns || 2;
            const percent = (skill.defDownAmount || 0.35) * 100;
            const turns = enemy.defDownTurns;
            const name = skill.debuffConfig?.nameTemplate?.replace("{percent}", percent) || `${percent}%防御降低`;
            const desc = skill.debuffConfig?.descTemplate?.replace("{percent}", percent).replace("{turns}", turns) || `防御力降低${percent}%，持续${turns}回合`;
            const debuff = { name, description: desc, turnsLeft: turns };
            if (!enemy.debuffs) enemy.debuffs = [];
            if (!enemy.debuffs.some(d => d.name === name)) enemy.debuffs.push(debuff);
        }
        
        return {
            damage: damage,
            isCritical: damageResult.isCritical || false,
            type: 'skill'
        };
    },

    executeUltimateAttack: function(character, enemy, skill) {
        const damageResult = GameData.calculateDamage(character, enemy, skill);
        let damage = damageResult.damage || 0;
        if (enemy.isDefDown) damage = Math.floor(damage * 1.3);
        enemy.hp -= damage;
        enemy.hp = Math.max(0, enemy.hp);
        character.energy -= (skill.energyCost || 120);
        character.energy = Math.max(0, character.energy);
        return {
            damage: damage,
            isCritical: damageResult.isCritical || false,
            type: 'ultimate'
        };
    },

    executeDefend: function(character) {
        character.isDefending = true;
        character.defenseBonus = 0.5;
        character.defenseTurns = 1;
        character.energy = Math.min(character.energy + 10, character.maxEnergy);
        return { type: 'defend', defenseBonus: 0.5 };
    },

    updateAfterSkill: function(character, enemy, skill, result) {
        if (character.hp <= 0) this.onCharacterDefeated(character);
        if (enemy.hp <= 0) this.onEnemyDefeated(enemy);
        this.logBattleAction(character.name, skill.name, result);
        
        // 天赋：猎杀强化 - 每行动1次增加攻击力（整场战斗累加，不重置）
        const talentSkill = character.skills.find(s => s.type === 'talent');
        if (talentSkill && !character._actionCountLock) {
            if (character._actionCount === undefined) character._actionCount = 0;
            character._actionCount++;
            const maxBonus = talentSkill.atkBonus || 0.2;
            const currentBonus = Math.min(maxBonus, character._actionCount * 0.05);
            if (!character._baseAttack) character._baseAttack = character.attack;
            character.attack = Math.floor(character._baseAttack * (1 + currentBonus));
            console.log(`${character.name} 行动 ${character._actionCount} 次，攻击力提升至 ${character.attack}`);
        }
    },

    onCharacterDefeated: function(character) {
        console.log(`${character.name} 被击败了！`);
        character.isDefending = false;
        character.defenseBonus = 0;
    },

    onEnemyDefeated: function(enemy) {
        console.log(`${enemy.name} 被击败了！`);
        enemy.isDefDown = false;
        enemy.defDownTurns = 0;
        if (enemy.debuffs && Array.isArray(enemy.debuffs)) {
            const idx = enemy.debuffs.findIndex(d => d.name && d.name.includes('防御降低'));
            if (idx !== -1) enemy.debuffs.splice(idx, 1);
        }
    },

    switchToNextCharacter: function() {
        const gameState = window.gameState;
        if (!gameState || !gameState.isPlayerTurn) return false;
        let nextIndex = gameState.activeCharacter;
        let attempts = 0;
        do {
            nextIndex = (nextIndex + 1) % gameState.party.length;
            attempts++;
            if (attempts >= gameState.party.length) {
                this.endTurn();
                return false;
            }
        } while (gameState.party[nextIndex].hp <= 0);
        gameState.activeCharacter = nextIndex;
        if (typeof window.updateBattleUI === 'function') window.updateBattleUI();
        return true;
    },

    endTurn: function() {
        const gameState = window.gameState;
        if (!gameState || !gameState.isPlayerTurn || gameState.gameOver) return;

        gameState.party.forEach(character => {
            if (character.isDefending && character.defenseTurns) {
                character.defenseTurns--;
                if (character.defenseTurns <= 0) {
                    character.isDefending = false;
                    character.defenseBonus = 0;
                }
            }
        });

        gameState.enemies.forEach(enemy => {
            if (enemy.isDefDown && enemy.defDownTurns) {
                enemy.defDownTurns--;
                if (enemy.defDownTurns <= 0) {
                    enemy.isDefDown = false;
                    if (enemy.debuffs && Array.isArray(enemy.debuffs)) {
                        const idx = enemy.debuffs.findIndex(d => d.name && d.name.includes('防御降低'));
                        if (idx !== -1) enemy.debuffs.splice(idx, 1);
                    }
                } else {
                    if (enemy.debuffs && Array.isArray(enemy.debuffs)) {
                        const debuff = enemy.debuffs.find(d => d.name && d.name.includes('防御降低'));
                        if (debuff) debuff.turnsLeft = enemy.defDownTurns;
                    }
                }
            }
        });

        gameState.isPlayerTurn = false;
        gameState.turn++;
        console.log(`===== 回合 ${gameState.turn} 结束 =====`);
        if (typeof window.updateBattleUI === 'function') window.updateBattleUI();
        setTimeout(() => this.executeEnemyTurns(), 800);
    },

    executeEnemyTurns: function() {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver) return;
        const aliveEnemies = gameState.enemies.filter(enemy => enemy.hp > 0);
        if (aliveEnemies.length === 0) {
            this.checkBattleEnd();
            return;
        }
        console.log(`敌人回合开始，${aliveEnemies.length}个敌人行动`);
        aliveEnemies.forEach((enemy, index) => {
            setTimeout(() => {
                this.executeEnemyAction(enemy, index);
                if (index === aliveEnemies.length - 1) {
                    setTimeout(() => this.startPlayerTurn(), 1000);
                }
            }, index * 800);
        });
    },

    executeEnemyAction: function(enemy, enemyIndex) {
        const gameState = window.gameState;
        if (!gameState) return;
        const aliveCharacters = gameState.party.filter(char => char.hp > 0);
        if (aliveCharacters.length === 0) {
            this.checkBattleEnd();
            return;
        }
        const targetIndex = Math.floor(Math.random() * aliveCharacters.length);
        const target = aliveCharacters[targetIndex];
        const partyIndex = gameState.party.indexOf(target);
        const enemySkill = enemy.skills && enemy.skills[0] ? enemy.skills[0] : { baseDamage: 0.8 };
        let damage = Math.floor(enemy.attack * enemySkill.baseDamage);
        if (target.isDefending) damage = Math.floor(damage * (1 - (target.defenseBonus || 0)));
        
        const hasTalent1 = this._isTraceActive(target, 'luguan_talent1');
        if (hasTalent1 && target.hp <= target.maxHp * 0.5) {
            damage = Math.floor(damage * 0.5);
            console.log(`${target.name} 触发疾风守护，伤害减半`);
        }
        
        target.hp -= damage;
        target.hp = Math.max(0, target.hp);
        window.showDamageEffect(partyIndex, damage, false, true);
        console.log(`${enemy.name} 攻击了 ${target.name}，造成 ${damage} 点伤害`);
        if (target.hp <= 0) this.onCharacterDefeated(target);
        if (typeof window.updateBattleUI === 'function') window.updateBattleUI();
        this.checkBattleEnd();
    },

    startPlayerTurn: function() {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver) return;
        gameState.isPlayerTurn = true;
        console.log(`===== 玩家回合开始 (回合 ${gameState.turn}) =====`);
        gameState.party.forEach(character => {
            character.isDefending = false;
            character.defenseBonus = 0;
            // 重置额外行动标记（每回合一次）
            character._extraTurnUsedInThisTurn = false;
            // 注意：不要重置攻击力！天赋加成的攻击力应该整场战斗累计
        });
        let firstAliveIndex = gameState.party.findIndex(char => char.hp > 0);
        if (firstAliveIndex !== -1) gameState.activeCharacter = firstAliveIndex;
        else this.checkBattleEnd();
        if (typeof window.updateBattleUI === 'function') window.updateBattleUI();
    },

    checkBattleEnd: function() {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver) return;
        const allEnemiesDead = gameState.enemies.every(enemy => enemy.hp <= 0);
        const allCharactersDead = gameState.party.every(char => char.hp <= 0);
        if (allEnemiesDead) {
            gameState.gameOver = true;
            window.showMessage('胜利！', '成功击败所有敌人');
            console.log('战斗胜利！');
        } else if (allCharactersDead) {
            gameState.gameOver = true;
            window.showMessage('战败', '队伍被击败了');
            console.log('战斗失败！');
        }
        return gameState.gameOver;
    },

    logBattleAction: function(characterName, skillName, result) {
        let message = `${characterName} 使用了 ${skillName}`;
        if (result && result.damage !== undefined) {
            message += `，造成 ${result.damage} 点伤害`;
            if (result.isCritical) message += ' (暴击!)';
        } else if (result && result.type === 'defend') message += '，进入防御姿态';
        console.log(`[战斗日志] ${message}`);
    },

    restartBattle: function() {
        if (typeof GameData !== 'undefined') {
            console.log('重新开始战斗...');
            const initialState = GameData.getInitialState();
            if (window.gameState) {
                Object.keys(initialState).forEach(key => { window.gameState[key] = initialState[key]; });
                window.gameState.turn = 0;
                window.gameState.isPlayerTurn = true;
                window.gameState.gameOver = false;
                window.gameState.selectedEnemy = 0;
                window.gameState.activeCharacter = 0;
                if (window.gameState.skillPoints === undefined) window.gameState.skillPoints = Math.floor(window.gameState.maxSkillPoints / 2);
            } else {
                window.gameState = {
                    ...initialState,
                    turn: 0,
                    isPlayerTurn: true,
                    gameOver: false,
                    selectedEnemy: 0,
                    activeCharacter: 0
                };
                if (window.gameState.skillPoints === undefined) window.gameState.skillPoints = Math.floor(window.gameState.maxSkillPoints / 2);
            }
            if (typeof window.renderBattleUI === 'function') window.renderBattleUI();
            if (typeof window.updateBattleUI === 'function') window.updateBattleUI();
            window.showMessage('战斗开始', '新的战斗开始了！');
            return true;
        }
        return false;
    },

    switchCharacter: function(index) {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver || !gameState.isPlayerTurn) return false;
        if (index >= 0 && index < gameState.party.length) {
            if (gameState.party[index].hp <= 0) {
                window.showMessage('提示', '该角色已无法行动');
                return false;
            }
            gameState.activeCharacter = index;
            if (typeof window.updateBattleUI === 'function') window.updateBattleUI();
            console.log(`切换到角色: ${gameState.party[index].name}`);
            return true;
        }
        return false;
    }
};

window.useSkillLogic = function(skillIndex) { return BattleLogic.useSkill(skillIndex); };
window.endTurnLogic = function() { return BattleLogic.endTurn(); };
window.restartBattleLogic = function() { return BattleLogic.restartBattle(); };
window.switchCharacterLogic = function(index) { return BattleLogic.switchCharacter(index); };
window.getBattleLogic = function() { return BattleLogic; };
window.BattleLogic = BattleLogic;
window.addEventListener('DOMContentLoaded', () => console.log('战斗逻辑加载完成！'));