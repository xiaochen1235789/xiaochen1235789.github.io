// ===================== 战斗逻辑核心 =====================
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
        
        // 获取技能（优先使用角色特定技能）
        const skill = character.skills ? character.skills[skillIndex] : 
                     (gameState.skills ? gameState.skills[skillIndex] : null);
        
        if (!skill) {
            window.showMessage('错误', '技能不存在');
            return false;
        }

        // 检查技能条件
        if (this.isSkillDisabled(skill, skillIndex)) {
            window.showMessage('提示', '技能条件不满足');
            return false;
        }

        // 检查目标是否有效
        if (!enemy || enemy.hp <= 0) {
            window.showMessage('提示', '请选择有效的目标');
            return false;
        }

        // 执行技能效果
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

        // 更新游戏状态
        this.updateAfterSkill(character, enemy, skill, result);
        
        // 显示特效
        if (result && result.damage !== undefined) {
            window.showDamageEffect(
                gameState.selectedEnemy,
                result.damage,
                result.isCritical || false,
                false
            );
        }

        // 检查战斗结束
        this.checkBattleEnd();

        // 更新UI（立即更新）
        if (typeof window.updateBattleUI === 'function') {
            window.updateBattleUI();
        }

        // 自动切换到下一个角色（只有普攻和战技会切换）
        if (skill.type !== 'defend' && skill.type !== 'ultimate') {
            setTimeout(() => {
                if (gameState.isPlayerTurn && !gameState.gameOver) {
                    this.switchToNextCharacter();
                }
            }, 800);
        }

        return true;
    },

    // 检查技能是否可用
    isSkillDisabled: function(skill, skillIndex) {
        const gameState = window.gameState;
        if (!gameState) return true;

        const character = gameState.party[gameState.activeCharacter];
        if (!character) return true;

        // 通用检查：角色是否存活
        if (character.hp <= 0) {
            return true;
        }

        // 根据技能类型检查
        switch(skill.type) {
            case 'normal':
                // 普攻总是可用
                return false;
            case 'skill':
                // 检查战技点
                if (gameState.skillPoints < (skill.skillPointCost || 1)) {
                    return true;
                }
                break;
            case 'ultimate':
                // 检查能量
                if (character.energy < (skill.energyCost || 120)) {
                    return true;
                }
                break;
            case 'defend':
                // 防御总是可用
                return false;
            default:
                return true;
        }

        return false;
    },

    // 执行普攻
    executeNormalAttack: function(character, enemy, skill) {
        const gameState = window.gameState;
        const damageResult = GameData.calculateDamage(character, enemy, skill);
        
        // 计算实际伤害
        let damage = damageResult.damage || 0;
        if (enemy.isDefDown) {
            damage = Math.floor(damage * 1.3); // 破防增伤30%
        }
        
        enemy.hp -= damage;
        enemy.hp = Math.max(0, enemy.hp);
        
        // 恢复能量
        character.energy = Math.min(
            character.energy + (skill.energyGain || 20),
            character.maxEnergy
        );
        
        // 普攻回复1点战技点
        gameState.skillPoints = Math.min(
            gameState.skillPoints + 1,
            gameState.maxSkillPoints
        );

        return {
            damage: damage,
            isCritical: damageResult.isCritical || false,
            type: 'normal'
        };
    },

    // 执行战技
    executeSkillAttack: function(character, enemy, skill) {
        const gameState = window.gameState;
        const damageResult = GameData.calculateDamage(character, enemy, skill);
        
        // 计算实际伤害
        let damage = damageResult.damage || 0;
        if (enemy.isDefDown) {
            damage = Math.floor(damage * 1.3); // 破防增伤30%
        }
        
        enemy.hp -= damage;
        enemy.hp = Math.max(0, enemy.hp);
        
        // 消耗战技点
        gameState.skillPoints -= (skill.skillPointCost || 1);
        gameState.skillPoints = Math.max(0, gameState.skillPoints);
        
        // 恢复能量
        character.energy = Math.min(
            character.energy + (skill.energyGain || 30),
            character.maxEnergy
        );
        
        // 附加效果
        if (skill.hasDefDown && damageResult.isCritical) {
            enemy.isDefDown = true;
            enemy.defDownTurns = skill.defDownTurns || 2;
        }

        return {
            damage: damage,
            isCritical: damageResult.isCritical || false,
            type: 'skill'
        };
    },

    // 执行终结技
    executeUltimateAttack: function(character, enemy, skill) {
        const damageResult = GameData.calculateDamage(character, enemy, skill);
        
        // 计算实际伤害
        let damage = damageResult.damage || 0;
        if (enemy.isDefDown) {
            damage = Math.floor(damage * 1.3); // 破防增伤30%
        }
        
        enemy.hp -= damage;
        enemy.hp = Math.max(0, enemy.hp);
        
        // 消耗能量
        character.energy -= (skill.energyCost || 120);
        character.energy = Math.max(0, character.energy);

        return {
            damage: damage,
            isCritical: damageResult.isCritical || false,
            type: 'ultimate'
        };
    },

    // 执行防御
    executeDefend: function(character) {
        character.isDefending = true;
        character.defenseBonus = 0.5; // 防御减伤50%
        character.defenseTurns = 1; // 持续1回合
        
        // 恢复少量能量
        character.energy = Math.min(
            character.energy + 10,
            character.maxEnergy
        );
        
        return { 
            type: 'defend',
            defenseBonus: 0.5
        };
    },

    // 技能后的状态更新
    updateAfterSkill: function(character, enemy, skill, result) {
        const gameState = window.gameState;
        
        // 更新角色状态
        if (character.hp <= 0) {
            character.hp = 0;
            this.onCharacterDefeated(character);
        }
        
        if (enemy.hp <= 0) {
            enemy.hp = 0;
            this.onEnemyDefeated(enemy);
        }
        
        // 记录战斗日志
        this.logBattleAction(character.name, skill.name, result);
        
        // 更新UI（已在上方调用）
    },

    // 角色被击败
    onCharacterDefeated: function(character) {
        console.log(`${character.name} 被击败了！`);
        
        // 重置防御状态
        character.isDefending = false;
        character.defenseBonus = 0;
    },

    // 敌人被击败
    onEnemyDefeated: function(enemy) {
        console.log(`${enemy.name} 被击败了！`);
        
        // 重置状态
        enemy.isDefDown = false;
        enemy.defDownTurns = 0;
    },

    // 切换到下一个角色
    switchToNextCharacter: function() {
        const gameState = window.gameState;
        if (!gameState || !gameState.isPlayerTurn) return false;
        
        // 寻找下一个存活角色
        let nextIndex = gameState.activeCharacter;
        let attempts = 0;
        
        do {
            nextIndex = (nextIndex + 1) % gameState.party.length;
            attempts++;
            
            if (attempts >= gameState.party.length) {
                // 所有角色都已经行动过，结束回合
                this.endTurn();
                return false;
            }
        } while (gameState.party[nextIndex].hp <= 0);
        
        // 切换到下一个存活角色
        gameState.activeCharacter = nextIndex;
        
        // 更新UI
        if (typeof window.updateBattleUI === 'function') {
            window.updateBattleUI();
        }
        
        return true;
    },

    // 结束回合
    endTurn: function() {
        const gameState = window.gameState;
        if (!gameState || !gameState.isPlayerTurn || gameState.gameOver) {
            return;
        }

        // 重置角色防御状态
        gameState.party.forEach(character => {
            if (character.isDefending && character.defenseTurns) {
                character.defenseTurns--;
                if (character.defenseTurns <= 0) {
                    character.isDefending = false;
                    character.defenseBonus = 0;
                }
            }
        });

        // 更新敌人负面状态回合
        gameState.enemies.forEach(enemy => {
            if (enemy.isDefDown && enemy.defDownTurns) {
                enemy.defDownTurns--;
                if (enemy.defDownTurns <= 0) {
                    enemy.isDefDown = false;
                }
            }
        });

        // 切换到敌人回合
        gameState.isPlayerTurn = false;
        gameState.turn++;
        
        console.log(`===== 回合 ${gameState.turn} 结束 =====`);

        // 更新UI
        if (typeof window.updateBattleUI === 'function') {
            window.updateBattleUI();
        }

        // 敌人行动
        setTimeout(() => {
            this.executeEnemyTurns();
        }, 800);
    },

    // 敌人行动
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
                
                // 最后一个敌人行动后切换回合
                if (index === aliveEnemies.length - 1) {
                    setTimeout(() => {
                        this.startPlayerTurn();
                    }, 1000);
                }
            }, index * 800);
        });
    },

    // 敌人行动逻辑
    executeEnemyAction: function(enemy, enemyIndex) {
        const gameState = window.gameState;
        if (!gameState) return;
        
        // 寻找存活的目标角色
        const aliveCharacters = gameState.party.filter(char => char.hp > 0);
        if (aliveCharacters.length === 0) {
            this.checkBattleEnd();
            return;
        }
        
        // 随机选择目标
        const targetIndex = Math.floor(Math.random() * aliveCharacters.length);
        const target = aliveCharacters[targetIndex];
        const partyIndex = gameState.party.indexOf(target);
        
        // 计算伤害
        const enemySkill = enemy.skills && enemy.skills[0] ? enemy.skills[0] : { baseDamage: 0.8 };
        let damage = Math.floor(enemy.attack * enemySkill.baseDamage);
        
        // 防御减伤
        if (target.isDefending) {
            damage = Math.floor(damage * (1 - (target.defenseBonus || 0)));
            console.log(`${target.name} 防御减伤，伤害减少为 ${damage}`);
        }
        
        // 应用伤害
        target.hp -= damage;
        target.hp = Math.max(0, target.hp);
        
        // 显示伤害
        window.showDamageEffect(
            partyIndex,
            damage,
            false,
            true
        );
        
        // 记录日志
        console.log(`${enemy.name} 攻击了 ${target.name}，造成 ${damage} 点伤害`);
        
        // 检查目标是否被击败
        if (target.hp <= 0) {
            this.onCharacterDefeated(target);
        }
        
        // 更新UI
        if (typeof window.updateBattleUI === 'function') {
            window.updateBattleUI();
        }
        
        // 检查战斗是否结束
        this.checkBattleEnd();
    },

    // 开始玩家回合 - 移除了每回合恢复1点战技点
    startPlayerTurn: function() {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver) return;

        // 切换到玩家回合
        gameState.isPlayerTurn = true;
        
        console.log(`===== 玩家回合开始 (回合 ${gameState.turn}) =====`);
        
        // 不再自动恢复战技点
        // gameState.skillPoints = Math.min(
        //     gameState.skillPoints + 1,
        //     gameState.maxSkillPoints
        // );
        
        // 重置当前行动角色为第一个存活角色
        let firstAliveIndex = gameState.party.findIndex(char => char.hp > 0);
        if (firstAliveIndex !== -1) {
            gameState.activeCharacter = firstAliveIndex;
        } else {
            // 没有存活角色，战斗结束
            this.checkBattleEnd();
            return;
        }
        
        // 重置所有角色的防御状态
        gameState.party.forEach(character => {
            character.isDefending = false;
            character.defenseBonus = 0;
        });

        // 更新UI
        if (typeof window.updateBattleUI === 'function') {
            window.updateBattleUI();
        }
    },

    // 检查战斗结束
    checkBattleEnd: function() {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver) return;
        
        // 检查敌人全灭
        const allEnemiesDead = gameState.enemies.every(enemy => enemy.hp <= 0);
        
        // 检查角色全灭
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

    // 战斗日志
    logBattleAction: function(characterName, skillName, result) {
        let message = `${characterName} 使用了 ${skillName}`;
        
        if (result && result.damage !== undefined) {
            message += `，造成 ${result.damage} 点伤害`;
            if (result.isCritical) {
                message += ' (暴击!)';
            }
        } else if (result && result.type === 'defend') {
            message += '，进入防御姿态';
        }
        
        console.log(`[战斗日志] ${message}`);
        
        // 可以添加到UI日志系统
        if (typeof window.addBattleLog === 'function') {
            window.addBattleLog(message);
        }
    },

    // 重启战斗
    restartBattle: function() {
        if (typeof GameData !== 'undefined') {
            console.log('重新开始战斗...');
            
            // 重新获取初始状态
            const initialState = GameData.getInitialState();
            
            // 保持现有gameState的结构，用新状态覆盖
            if (window.gameState) {
                Object.keys(initialState).forEach(key => {
                    window.gameState[key] = initialState[key];
                });
                
                // 重置额外状态
                window.gameState.turn = 0;
                window.gameState.isPlayerTurn = true;
                window.gameState.gameOver = false;
                window.gameState.selectedEnemy = 0;
                window.gameState.activeCharacter = 0;
                
                // 确保初始战技点符合星铁标准
                if (window.gameState.skillPoints === undefined) {
                    window.gameState.skillPoints = Math.floor(window.gameState.maxSkillPoints / 2);
                }
                
                console.log('战斗已重置');
            } else {
                // 如果gameState不存在，创建新的
                window.gameState = {
                    ...initialState,
                    turn: 0,
                    isPlayerTurn: true,
                    gameOver: false,
                    selectedEnemy: 0,
                    activeCharacter: 0
                };
                
                // 确保初始战技点符合星铁标准
                if (window.gameState.skillPoints === undefined) {
                    window.gameState.skillPoints = Math.floor(window.gameState.maxSkillPoints / 2);
                }
            }
            
            // 更新UI
            if (typeof window.renderBattleUI === 'function') {
                window.renderBattleUI();
            }
            
            if (typeof window.updateBattleUI === 'function') {
                window.updateBattleUI();
            }
            
            window.showMessage('战斗开始', '新的战斗开始了！');
            
            return true;
        }
        
        return false;
    },

    // 切换角色
    switchCharacter: function(index) {
        const gameState = window.gameState;
        if (!gameState || gameState.gameOver || !gameState.isPlayerTurn) {
            return false;
        }
        
        if (index >= 0 && index < gameState.party.length) {
            // 检查目标角色是否存活
            if (gameState.party[index].hp <= 0) {
                window.showMessage('提示', '该角色已无法行动');
                return false;
            }
            
            gameState.activeCharacter = index;
            
            if (typeof window.updateBattleUI === 'function') {
                window.updateBattleUI();
            }
            
            console.log(`切换到角色: ${gameState.party[index].name}`);
            return true;
        }
        
        return false;
    }
};

// ===================== 全局接口 =====================

// 供UI框架调用的接口
window.useSkillLogic = function(skillIndex) {
    return BattleLogic.useSkill(skillIndex);
};

window.endTurnLogic = function() {
    return BattleLogic.endTurn();
};

window.restartBattleLogic = function() {
    return BattleLogic.restartBattle();
};

window.switchCharacterLogic = function(index) {
    return BattleLogic.switchCharacter(index);
};

// 获取战斗逻辑实例
window.getBattleLogic = function() {
    return BattleLogic;
};

// 战斗逻辑初始化
window.addEventListener('DOMContentLoaded', () => {
    console.log('战斗逻辑加载完成！');
    
    // 如果游戏状态已存在，初始化逻辑
    if (window.gameState) {
        console.log('游戏状态已加载，初始化战斗逻辑...');
    }
});

// 导出
window.BattleLogic = BattleLogic;