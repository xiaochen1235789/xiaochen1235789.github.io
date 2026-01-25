
// ===================== 游戏数据配置 =====================
const GameData = {
    // 角色数据
    characters: [
        {
            id: 'luguan',
            name: '鹿管',
            avatar: '🦌',
            path: '巡猎',
            rarity: 5,
            element: 'wind',
            
            // 基础属性
            maxHp: 9999,
            maxEnergy: 120,
            attack: 2900,
            defense: 800,
            speed: 140,
            critRate: 0.8,
            critDamage: 1.75,
            
            // 战斗属性
            windDamageBoost: 0.388,
            effectHitRate: 0,
            effectRes: 0,
            
            // 技能
            skills: [
                {
                    id: 'normal',
                    name: '迅风斩',
                    icon: '⚔️',
                    type: 'normal',
                    description: '单体风属性伤害',
                    energyGain: 20,
                    skillPointGain: 1,
                    baseDamage: 1.1, // 110%
                    element: 'wind',
                    target: 'single'
                },
                {
                    id: 'skill',
                    name: '风之挑衅',
                    icon: '🌀',
                    type: 'skill',
                    description: '单体伤害，暴击时降低目标防御',
                    energyGain: 30,
                    skillPointCost: 1,
                    baseDamage: 3.7, // 370%
                    element: 'wind',
                    hasDefDown: true,
                    defDownChance: 1.0,
                    defDownAmount: 0.35,
                    defDownTurns: 2,
                    target: 'single'
                },
                {
                    id: 'ultimate',
                    name: '狂风终结',
                    icon: '💥',
                    type: 'ultimate',
                    description: '单体高伤害，对负面目标伤害提高',
                    energyCost: 120,
                    baseDamage: 6.96, // 696%
                    extraDamage: 2.1, // +210%
                    element: 'wind',
                    target: 'single'
                },
                {
                    id: 'defend',
                    name: '防御',
                    icon: '🛡️',
                    type: 'defend',
                    description: '减少下次受到的伤害'
                }
            ],
            
            // 额外能力
            extraAbilities: [
                {
                    name: '疾风守护',
                    description: '生命值≤50%时，受击概率降低50%'
                },
                {
                    name: '精准狩猎',
                    description: '战技对负面目标伤害提高60%'
                },
                {
                    name: '风速迅捷',
                    description: '普攻后自身行动提前20%'
                }
            ],
            
            // 星魂
            eidolons: [
                {
                    name: '疾风追影',
                    description: '目标生命≥20%时，受到的伤害提高50%'
                },
                {
                    name: '旋刃狩魂',
                    description: '对负面目标暴击率提高18%，每层负面效果额外提升暴伤'
                }
            ]
        },
        {
            id: 'fire_guard',
            name: '炎盾护卫',
            avatar: '🛡️',
            path: '存护',
            rarity: 4,
            element: 'fire',
            
            maxHp: 15000,
            maxEnergy: 100,
            attack: 1800,
            defense: 1600,
            speed: 100,
            critRate: 0.05,
            critDamage: 1.5,
            
            fireDamageBoost: 0.2,
            effectHitRate: 0.3,
            effectRes: 0.4,
            
            skills: [
                {
                    id: 'normal',
                    name: '烈焰盾击',
                    icon: '🔥',
                    type: 'normal',
                    description: '单体火属性伤害，附带嘲讽',
                    energyGain: 15,
                    skillPointGain: 1,
                    baseDamage: 0.9,
                    element: 'fire',
                    target: 'single'
                },
                {
                    id: 'skill',
                    name: '炽热屏障',
                    icon: '🛡️',
                    type: 'skill',
                    description: '为自身和一名队友提供护盾',
                    energyGain: 25,
                    skillPointCost: 1,
                    shieldAmount: 0.25,
                    target: 'ally'
                },
                {
                    id: 'ultimate',
                    name: '熔岩爆发',
                    icon: '🌋',
                    type: 'ultimate',
                    description: '群体火属性伤害，嘲讽所有敌人',
                    energyCost: 100,
                    baseDamage: 1.5,
                    element: 'fire',
                    target: 'aoe'
                },
                {
                    id: 'defend',
                    name: '坚守阵地',
                    icon: '🏰',
                    type: 'defend',
                    description: '大幅提升防御力'
                }
            ],
            
            extraAbilities: [
                {
                    name: '不屈意志',
                    description: '护盾存在时，自身防御力提高30%'
                }
            ]
        },
        {
            id: 'quantum_mage',
            name: '量子术士',
            avatar: '🌌',
            path: '智识',
            rarity: 5,
            element: 'quantum',
            
            maxHp: 7500,
            maxEnergy: 120,
            attack: 3200,
            defense: 600,
            speed: 110,
            critRate: 0.3,
            critDamage: 1.8,
            
            quantumDamageBoost: 0.35,
            effectHitRate: 0.5,
            effectRes: 0.2,
            
            skills: [
                {
                    id: 'normal',
                    name: '量子飞弹',
                    icon: '⚛️',
                    type: 'normal',
                    description: '单体量子属性伤害',
                    energyGain: 20,
                    skillPointGain: 1,
                    baseDamage: 1.0,
                    element: 'quantum',
                    target: 'single'
                },
                {
                    id: 'skill',
                    name: '维度坍缩',
                    icon: '🌀',
                    type: 'skill',
                    description: '对随机目标进行3次量子攻击',
                    energyGain: 30,
                    skillPointCost: 2,
                    baseDamage: 1.2,
                    element: 'quantum',
                    hitCount: 3,
                    target: 'random'
                },
                {
                    id: 'ultimate',
                    name: '黑洞奇点',
                    icon: '🕳️',
                    type: 'ultimate',
                    description: '群体量子属性伤害，概率禁锢',
                    energyCost: 120,
                    baseDamage: 2.5,
                    element: 'quantum',
                    imprisonChance: 0.6,
                    target: 'aoe'
                },
                {
                    id: 'defend',
                    name: '量子护盾',
                    icon: '✨',
                    type: 'defend',
                    description: '生成量子护盾吸收伤害'
                }
            ],
            
            extraAbilities: [
                {
                    name: '量子纠缠',
                    description: '攻击有负面状态的敌人时，伤害提高30%'
                }
            ]
        },
        {
            id: 'lightning_healer',
            name: '雷鸣医者',
            avatar: '⚡',
            path: '丰饶',
            rarity: 4,
            element: 'lightning',
            
            maxHp: 9000,
            maxEnergy: 90,
            attack: 1500,
            defense: 900,
            speed: 120,
            critRate: 0.1,
            critDamage: 1.5,
            
            lightningDamageBoost: 0.15,
            healingBoost: 0.3,
            effectRes: 0.4,
            
            skills: [
                {
                    id: 'normal',
                    name: '电疗之触',
                    icon: '⚡',
                    type: 'normal',
                    description: '单体雷属性伤害，附带微量治疗',
                    energyGain: 15,
                    skillPointGain: 1,
                    baseDamage: 0.8,
                    element: 'lightning',
                    healAmount: 0.05,
                    target: 'single'
                },
                {
                    id: 'skill',
                    name: '复苏雷雨',
                    icon: '🌧️',
                    type: 'skill',
                    description: '治疗全体队友',
                    energyGain: 20,
                    skillPointCost: 1,
                    healAmount: 0.25,
                    target: 'ally_all'
                },
                {
                    id: 'ultimate',
                    name: '天雷净化',
                    icon: '☇',
                    type: 'ultimate',
                    description: '群体雷属性伤害，清除负面状态',
                    energyCost: 90,
                    baseDamage: 1.2,
                    element: 'lightning',
                    cleanse: true,
                    target: 'aoe'
                },
                {
                    id: 'defend',
                    name: '静电屏障',
                    icon: '⚡',
                    type: 'defend',
                    description: '生成静电屏障减少伤害'
                }
            ],
            
            extraAbilities: [
                {
                    name: '医者仁心',
                    description: '治疗量溢出时，转化为护盾'
                }
            ]
        },
        {
            id: 'ice_assassin',
            name: '寒冰刺客',
            avatar: '❄️',
            path: '巡猎',
            rarity: 4,
            element: 'ice',
            
            maxHp: 8500,
            maxEnergy: 110,
            attack: 2600,
            defense: 700,
            speed: 150,
            critRate: 0.4,
            critDamage: 1.9,
            
            iceDamageBoost: 0.25,
            effectHitRate: 0.2,
            effectRes: 0.3,
            
            skills: [
                {
                    id: 'normal',
                    name: '寒冰刺',
                    icon: '❄️',
                    type: 'normal',
                    description: '单体冰属性伤害，概率冻结',
                    energyGain: 18,
                    skillPointGain: 1,
                    baseDamage: 1.0,
                    element: 'ice',
                    freezeChance: 0.2,
                    target: 'single'
                },
                {
                    id: 'skill',
                    name: '霜华连击',
                    icon: '🥶',
                    type: 'skill',
                    description: '单体冰属性伤害，连续攻击2次',
                    energyGain: 25,
                    skillPointCost: 1,
                    baseDamage: 1.8,
                    element: 'ice',
                    hitCount: 2,
                    target: 'single'
                },
                {
                    id: 'ultimate',
                    name: '绝对零度',
                    icon: '🧊',
                    type: 'ultimate',
                    description: '单体超高冰属性伤害，必中冻结',
                    energyCost: 110,
                    baseDamage: 5.5,
                    element: 'ice',
                    freezeChance: 1.0,
                    target: 'single'
                },
                {
                    id: 'defend',
                    name: '冰镜反射',
                    icon: '🪞',
                    type: 'defend',
                    description: '进入隐身状态'
                }
            ],
            
            extraAbilities: [
                {
                    name: '寒冷血脉',
                    description: '对冻结状态的敌人暴击伤害提高50%'
                }
            ]
        },
        {
            id: 'physical_warrior',
            name: '钢铁战士',
            avatar: '⚔️',
            path: '毁灭',
            rarity: 4,
            element: 'physical',
            
            maxHp: 12000,
            maxEnergy: 100,
            attack: 2200,
            defense: 1200,
            speed: 105,
            critRate: 0.2,
            critDamage: 1.6,
            
            physicalDamageBoost: 0.25,
            effectHitRate: 0.1,
            effectRes: 0.3,
            
            skills: [
                {
                    id: 'normal',
                    name: '重锤猛击',
                    icon: '🔨',
                    type: 'normal',
                    description: '单体物理伤害，附带破防',
                    energyGain: 16,
                    skillPointGain: 1,
                    baseDamage: 1.1,
                    element: 'physical',
                    defenseDown: 0.15,
                    target: 'single'
                },
                {
                    id: 'skill',
                    name: '旋风斩',
                    icon: '🌀',
                    type: 'skill',
                    description: '群体物理伤害',
                    energyGain: 22,
                    skillPointCost: 2,
                    baseDamage: 1.4,
                    element: 'physical',
                    target: 'aoe'
                },
                {
                    id: 'ultimate',
                    name: '狂暴冲锋',
                    icon: '💥',
                    type: 'ultimate',
                    description: '单体物理伤害，伤害随生命值降低而提高',
                    energyCost: 100,
                    baseDamage: 4.0,
                    element: 'physical',
                    bonusDamageLowHp: 2.0,
                    target: 'single'
                },
                {
                    id: 'defend',
                    name: '钢铁意志',
                    icon: '🦾',
                    type: 'defend',
                    description: '提升攻击力和防御力'
                }
            ],
            
            extraAbilities: [
                {
                    name: '愈战愈勇',
                    description: '生命值每降低10%，攻击力提高5%'
                }
            ]
        }
    ],
    
    // 敌人数据
    enemies: [
        {
            id: 'abyss_monster',
            name: '深渊魔物',
            emoji: '👹',
            rarity: 'elite',
            
            maxHp: 50000,
            attack: 800,
            defense: 1000,
            speed: 120,
            
            // 属性抗性
            resistances: {
                physical: 0.2,
                fire: 0.1,
                ice: 0.1,
                lightning: 0.1,
                wind: 0.2,
                quantum: 0.3,
                imaginary: 0.3
            },
            
            // 技能
            skills: [
                {
                    name: '深渊冲击',
                    type: 'normal',
                    baseDamage: 0.8,
                    description: '单体物理伤害'
                },
                {
                    name: '暗影爆发',
                    type: 'skill',
                    baseDamage: 1.5,
                    description: '群体暗属性伤害',
                    cooldown: 2
                }
            ]
        },
        {
            id: 'quantum_beast',
            name: '虚数兽',
            emoji: '🐉',
            rarity: 'normal',
            
            maxHp: 3000,
            attack: 600,
            defense: 800,
            speed: 140,
            
            resistances: {
                wind: 0.1,
                quantum: 0.4,
                imaginary: 0.2
            },
            
            skills: [
                {
                    name: '量子撕咬',
                    type: 'normal',
                    baseDamage: 0.6,
                    description: '单体量子伤害'
                }
            ]
        },
        {
            id: 'wind_phantom',
            name: '风之幻影',
            emoji: '👻',
            rarity: 'normal',
            
            maxHp: 2500,
            attack: 700,
            defense: 600,
            speed: 160,
            
            resistances: {
                wind: 0.4,
                fire: 0.3
            },
            
            skills: [
                {
                    name: '疾风刃',
                    type: 'normal',
                    baseDamage: 0.7,
                    description: '单体风属性伤害'
                },
                {
                    name: '风之舞',
                    type: 'skill',
                    baseDamage: 1.2,
                    description: '随机攻击2-3次',
                    cooldown: 3
                }
            ]
        }
    ],
    
    // 战斗常量
    constants: {
        maxSkillPoints: 5,
        baseDefenseMultiplier: 0.5,
        minDamageMultiplier: 0.1,
        critDamageCap: 3.0,
        dotDamageMultiplier: 0.6,
        breakDamageMultiplier: 2.0
    },
    
    // 获取初始游戏状态
    getInitialState: function() {
        return {
            party: this.characters.slice(0, 4).map(char => ({
                ...char,
                hp: char.maxHp,
                energy: 0,
                isDefending: false,
                buffs: [],
                debuffs: []
            })),
            
            enemies: this.enemies.map(enemy => ({
                ...enemy,
                hp: enemy.maxHp,
                isDefDown: false,
                defDownTurns: 0,
                buffs: [],
                debuffs: []
            })),
            
            skills: this.characters[0].skills, // 默认使用第一个角色的技能
            
            skillPoints: Math.floor(this.constants.maxSkillPoints / 2), // 星铁标准开局
            maxSkillPoints: this.constants.maxSkillPoints,
            
            turn: 0,
            isPlayerTurn: true,
            autoBattle: false,
            gameOver: false,
            selectedEnemy: 0,
            activeCharacter: 0,
            battleLog: []
        };
    },
    
    // 根据ID获取角色数据
    getCharacterById: function(id) {
        return this.characters.find(char => char.id === id);
    },
    
    // 根据ID获取敌人数据
    getEnemyById: function(id) {
        return this.enemies.find(enemy => enemy.id === id);
    },
    
    // 计算公式
    calculateDamage: function(attacker, target, skill) {
        // 基础伤害
        let damage = attacker.attack * skill.baseDamage;
        
        // 暴击
        const isCritical = Math.random() < attacker.critRate;
        if (isCritical) {
            damage *= (1 + Math.min(attacker.critDamage, this.constants.critDamageCap));
        }
        
        // 属性加成
        if (skill.element && attacker[`${skill.element}DamageBoost`]) {
            damage *= (1 + attacker[`${skill.element}DamageBoost`]);
        }
        
        // 目标抗性
        const resistance = target.resistances?.[skill.element] || 0;
        damage *= (1 - Math.min(resistance, 0.7)); // 抗性上限70%
        
        // 防御计算
        let defense = target.defense;
        if (target.isDefDown) {
            defense *= 0.65; // 降低35%
        }
        damage *= (1 - defense / (defense + 2000));
        
        // 额外效果
        if (skill.extraDamage && target.debuffs.length > 0) {
            damage *= (1 + skill.extraDamage);
        }
        
        // 最小伤害保证
        damage = Math.max(damage, attacker.attack * this.constants.minDamageMultiplier);
        
        return {
            damage: Math.round(damage),
            isCritical: isCritical
        };
    },
    
    // 新增：简化版计算公式（用于测试）
    calculateSimpleDamage: function(attacker, target, skill) {
        const baseDamage = attacker.attack * skill.baseDamage;
        const isCritical = Math.random() < attacker.critRate;
        let damage = isCritical ? baseDamage * (1 + attacker.critDamage) : baseDamage;
        
        // 简单抗性计算
        if (skill.element && target.resistances?.[skill.element]) {
            damage *= (1 - target.resistances[skill.element]);
        }
        
        // 防御减伤
        damage *= (1 - target.defense / (target.defense + 1000));
        
        return {
            damage: Math.round(damage),
            isCritical: isCritical
        };
    }
};

// 导出为全局变量
window.GameData = GameData;

console.log('游戏数据加载完成！');