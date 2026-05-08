// ===================== 游戏数据配置（基于鹿馆WIKI数值）=====================
const GameData = (function() {
    // ---------- 1. 等级与技能上限 ----------
    const MAX_CHARACTER_LEVEL = 90;
    const SKILL_MAX_LEVEL = {
        normal: 7,
        skill: 12,
        ultimate: 12,
        talent: 12,
        defend: 1
    };

    // ---------- 2. 基础属性预设点（等级 → {hp, atk, def}）----------
    // 数据来源于 luguan-detail.html 中的 baseStats
    const STAT_PRESETS = {
        1:  { hp: 126, atk: 87,  def: 49 },
        20: { hp: 297, atk: 204, def: 116 },
        30: { hp: 411, atk: 283, def: 160 },
        40: { hp: 525, atk: 361, def: 205 },
        50: { hp: 639, atk: 439, def: 249 },
        60: { hp: 753, atk: 518, def: 294 },
        70: { hp: 868, atk: 596, def: 339 },
        80: { hp: 931, atk: 640, def: 363 },
        90: { hp: 1117, atk: 768, def: 582 }
    };
    const PRESET_LEVELS = Object.keys(STAT_PRESETS).map(Number).sort((a,b)=>a-b);

    // 插值函数：根据等级获取属性值
    function getStatByLevel(level, statName) {
        if (level <= PRESET_LEVELS[0]) return STAT_PRESETS[PRESET_LEVELS[0]][statName];
        if (level >= PRESET_LEVELS[PRESET_LEVELS.length-1]) return STAT_PRESETS[PRESET_LEVELS[PRESET_LEVELS.length-1]][statName];
        // 找到相邻两个预设点
        let lower = PRESET_LEVELS[0], upper = PRESET_LEVELS[PRESET_LEVELS.length-1];
        for (let i = 0; i < PRESET_LEVELS.length-1; i++) {
            if (level >= PRESET_LEVELS[i] && level <= PRESET_LEVELS[i+1]) {
                lower = PRESET_LEVELS[i];
                upper = PRESET_LEVELS[i+1];
                break;
            }
        }
        const lowVal = STAT_PRESETS[lower][statName];
        const highVal = STAT_PRESETS[upper][statName];
        const ratio = (level - lower) / (upper - lower);
        return Math.round(lowVal + (highVal - lowVal) * ratio);
    }

    // ---------- 3. 技能倍率成长公式 ----------
    const SKILL_GROWTH = {
        normal: { base: 50, step: 10 },      // 1级 50%，每级+10%
        skill: { base: 150, step: 20 },      // 1级 150%，每级+20%
        ultimate: [
            { base: 300, step: 36 },         // 第一段倍率
            { base: 100, step: 10 }          // 第二段额外倍率（负面目标增伤）
        ],
        talent: [
            { base: 10, step: 2 },           // 抗性穿透上限
            { base: 20, step: 5 }            // 攻击力加成上限
        ]
    };

    function getSkillValue(skillType, level, index = 0) {
        const growth = SKILL_GROWTH[skillType];
        if (!growth) return 0;
        if (Array.isArray(growth)) {
            const g = growth[index];
            return g.base + g.step * (level - 1);
        } else {
            return growth.base + growth.step * (level - 1);
        }
    }

    // ---------- 4. 角色基础定义（鹿馆）----------
    const charactersBaseData = {
        luguan: {
            id: 'luguan',
            name: '鹿管',
            avatar: '🦌',
            path: '巡猎',
            rarity: 5,
            element: 'wind',
            // 固定属性（不随等级变化）
            baseStatsFixed: {
                maxEnergy: 120,
                speed: 115,
                critRate: 0.05,
                critDamage: 0.5,
                windDamageBoost: 0,
                effectHitRate: 0,
                effectRes: 0
            },
            // 技能模板（倍率初始为1级值，实际使用时按等级计算）
            skillsTemplates: {
                normal: {
                    id: 'luguan_normal',
                    name: '迅风斩',
                    icon: '⚔️',
                    type: 'normal',
                    description: '对敌方单体造成等同于 {damage} 攻击力的风属性伤害。',
                    energyGain: 20,
                    skillPointGain: 1,
                    element: 'wind',
                    target: 'single',
                    baseDamageExpr: () => getSkillValue('normal', this.currentLevel, 0) / 100
                },
                skill: {
                    id: 'luguan_skill',
                    name: '风之挑衅',
                    icon: '🌀',
                    type: 'skill',
                    description: '对敌方单体造成等同于 {damage} 攻击力的风属性伤害，暴击时100%固定概率降低目标防御35%，持续2回合。',
                    energyGain: 30,
                    skillPointCost: 1,
                    element: 'wind',
                    hasDefDown: true,
                    defDownChance: 1.0,
                    defDownAmount: 0.35,
                    defDownTurns: 2,
                    target: 'single',
                    baseDamageExpr: () => getSkillValue('skill', this.currentLevel, 0) / 100
                },
                ultimate: {
                    id: 'luguan_ultimate',
                    name: '狂风终结',
                    icon: '💥',
                    type: 'ultimate',
                    description: '对敌方单体造成等同于 {damage} 攻击力的风属性伤害；若目标处于负面状态则伤害倍率额外提高 {extra}。',
                    energyCost: 120,
                    element: 'wind',
                    target: 'single',
                    baseDamageExpr: () => getSkillValue('ultimate', this.currentLevel, 0) / 100,
                    extraDamageExpr: () => getSkillValue('ultimate', this.currentLevel, 1) / 100
                },
                talent: {
                    id: 'luguan_talent',
                    name: '猎杀强化',
                    icon: '🎯',
                    type: 'talent',
                    description: '战斗中速度≥100点时，每提高5点使风属性抗性穿透提高2%，最多提高 {penetration}；每行动1次使自身攻击力提高5%，最多提高 {atkBonus}。',
                    extra: true,
                    penetrationExpr: () => getSkillValue('talent', this.currentLevel, 0) / 100,
                    atkBonusExpr: () => getSkillValue('talent', this.currentLevel, 1) / 100
                },
                defend: {
                    id: 'defend',
                    name: '防御',
                    icon: '🛡️',
                    type: 'defend',
                    description: '减少下次受到的伤害',
                    energyGain: 0,
                    skillPointGain: 0,
                    target: 'self'
                }
            },
            // 额外能力（天赋）和星魂（静态）
            extraAbilities: {
                talent1: { id: 'luguan_talent1', name: '疾风守护', description: '生命值≤50%时，受到的伤害降低50%。' },
                talent2: { id: 'luguan_talent2', name: '精准狩猎', description: '战技对负面效果下的目标造成的伤害提高60%。' },
                talent3: { id: 'luguan_talent3', name: '风速迅捷', description: '施放普攻后自身行动提前20%。' }
            },
            eidolons: {
                e1: { id: 'luguan_e1', name: '疾风追影', description: '攻击敌方目标时，若其生命≥20%，受到的伤害提高50%。' },
                e2: { id: 'luguan_e2', name: '旋刃狩魂', description: '对拥有负面效果的目标暴击率提高18%，每有一个负面效果暴击伤害提高24%，最多144%。' },
                e3: { id: 'luguan_e3', name: '裂空破障', description: '普攻等级+1，天赋等级+2。' },
                e4: { id: 'luguan_e4', name: '破晓狩风', description: '消灭目标时恢复20能量并获得额外回合。' },
                e5: { id: 'luguan_e5', name: '风狩铭纹', description: '战技等级+2，终结技等级+2。' },
                e6: { id: 'luguan_e6', name: '逐影风刃', description: '天赋所有效果进入战斗后立即生效，且伤害无视目标24%防御。' }
            }
        }
    };

    // ---------- 5. 构建全局查找表 ----------
    const skillsMap = {};
    const extraAbilitiesMap = {};
    const eidolonsMap = {};

    function registerSkill(skillTemplate) {
        // 深拷贝并转换为可存储的静态对象（表达式将在运行时计算）
        const clone = { ...skillTemplate };
        delete clone.baseDamageExpr;
        delete clone.extraDamageExpr;
        delete clone.penetrationExpr;
        delete clone.atkBonusExpr;
        skillsMap[clone.id] = clone;
    }
    function registerExtraAbility(ability) { extraAbilitiesMap[ability.id] = { ...ability }; }
    function registerEidolon(eidolon) { eidolonsMap[eidolon.id] = { ...eidolon }; }

    for (const char of Object.values(charactersBaseData)) {
        for (const skill of Object.values(char.skillsTemplates)) {
            registerSkill(skill);
        }
        for (const ability of Object.values(char.extraAbilities)) {
            registerExtraAbility(ability);
        }
        for (const eidolon of Object.values(char.eidolons)) {
            registerEidolon(eidolon);
        }
    }

    // ---------- 6. 初始化角色实例（支持等级和技能等级配置）----------
    function getInitialState(levelConfig = null) {
        const charBase = charactersBaseData.luguan;
        // 解析传入配置
        let charLevel = 1;
        let skillLevels = {};
        if (levelConfig && levelConfig.luguan) {
            charLevel = levelConfig.luguan.level || 1;
            skillLevels = levelConfig.luguan.skillLevels || {};
        }
        // 限制等级范围
        charLevel = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, charLevel));

        // 计算基础属性
        const hp = getStatByLevel(charLevel, 'hp');
        const atk = getStatByLevel(charLevel, 'atk');
        const def = getStatByLevel(charLevel, 'def');
        const { maxEnergy, speed, critRate, critDamage, windDamageBoost, effectHitRate, effectRes } = charBase.baseStatsFixed;

        // 构建技能列表（动态计算当前倍率）
        const skills = [];
        for (const [key, template] of Object.entries(charBase.skillsTemplates)) {
            const skillType = key === 'normal' ? 'normal' : (key === 'skill' ? 'skill' : (key === 'ultimate' ? 'ultimate' : (key === 'talent' ? 'talent' : 'defend')));
            const maxLv = SKILL_MAX_LEVEL[skillType] || 1;
            let currentLv = skillLevels[template.id] || 1;
            currentLv = Math.min(maxLv, Math.max(1, currentLv));
            // 计算当前倍率（仅对伤害类技能）
            let baseDamage = null, extraDamage = null;
            if (template.baseDamageExpr) {
                // 临时绑定 currentLevel 上下文
                const ctx = { currentLevel: currentLv };
                baseDamage = template.baseDamageExpr.call(ctx);
                if (template.extraDamageExpr) extraDamage = template.extraDamageExpr.call(ctx);
            }
            const skillObj = {
                id: template.id,
                name: template.name,
                icon: template.icon,
                type: template.type,
                description: template.description,
                currentLevel: currentLv,
                maxLevel: maxLv,
                energyGain: template.energyGain,
                skillPointGain: template.skillPointGain,
                skillPointCost: template.skillPointCost,
                energyCost: template.energyCost,
                element: template.element,
                target: template.target,
                hasDefDown: template.hasDefDown,
                defDownChance: template.defDownChance,
                defDownAmount: template.defDownAmount,
                defDownTurns: template.defDownTurns,
                // 伤害数值
                baseDamage: baseDamage,
                extraDamage: extraDamage
            };
            skills.push(skillObj);
        }

        // 额外能力、命座
        const extraAbilities = Object.values(charBase.extraAbilities).map(a => ({ ...a }));
        const eidolons = Object.values(charBase.eidolons).map(e => ({ ...e }));

        const character = {
            id: charBase.id,
            name: charBase.name,
            avatar: charBase.avatar,
            path: charBase.path,
            rarity: charBase.rarity,
            element: charBase.element,
            level: charLevel,
            maxHp: hp,
            hp: hp,
            maxEnergy: maxEnergy,
            energy: 0,
            attack: atk,
            defense: def,
            speed: speed,
            critRate: critRate,
            critDamage: critDamage,
            windDamageBoost: windDamageBoost,
            effectHitRate: effectHitRate,
            effectRes: effectRes,
            isDefending: false,
            buffs: [],
            debuffs: [],
            skills: skills,
            extraAbilities: extraAbilities,
            eidolons: eidolons,
            // 内部缓存
            _baseStats: { hp, atk, def },
            _charLevel: charLevel
        };
        return {
            party: [character],
            enemies: [],
            skillPoints: Math.floor(5 / 2),
            maxSkillPoints: 5,
            turn: 0,
            isPlayerTurn: true,
            autoBattle: false,
            gameOver: false,
            selectedEnemy: 0,
            activeCharacter: 0,
            battleLog: []
        };
    }

    // ---------- 7. 升级方法 ----------
    function levelUpCharacter(character, targetLevel) {
        if (!character) return false;
        let newLevel = targetLevel || (character.level + 1);
        if (newLevel > MAX_CHARACTER_LEVEL) newLevel = MAX_CHARACTER_LEVEL;
        if (newLevel <= character.level) return false;
        const oldHp = character.hp;
        const oldMaxHp = character.maxHp;
        character.level = newLevel;
        character.maxHp = getStatByLevel(newLevel, 'hp');
        character.attack = getStatByLevel(newLevel, 'atk');
        character.defense = getStatByLevel(newLevel, 'def');
        // 按比例恢复生命
        const ratio = oldHp / oldMaxHp;
        character.hp = Math.floor(character.maxHp * ratio);
        if (character.hp <= 0) character.hp = 1;
        character._baseStats = { hp: character.maxHp, atk: character.attack, def: character.defense };
        character._charLevel = newLevel;
        return true;
    }

    function levelUpSkill(skill) {
        if (!skill) return false;
        const max = skill.maxLevel;
        if (skill.currentLevel >= max) return false;
        skill.currentLevel++;
        // 重新计算倍率
        const skillType = skill.type; // 'normal', 'skill', 'ultimate', 'talent'
        if (skillType === 'normal' || skillType === 'skill') {
            skill.baseDamage = getSkillValue(skillType, skill.currentLevel, 0) / 100;
        } else if (skillType === 'ultimate') {
            skill.baseDamage = getSkillValue('ultimate', skill.currentLevel, 0) / 100;
            skill.extraDamage = getSkillValue('ultimate', skill.currentLevel, 1) / 100;
        } else if (skillType === 'talent') {
            // 天赋没有直接伤害，但可存储数值供外部使用
            skill.penetration = getSkillValue('talent', skill.currentLevel, 0) / 100;
            skill.atkBonus = getSkillValue('talent', skill.currentLevel, 1) / 100;
        }
        return true;
    }

    // ---------- 8. 伤害计算（适配新倍率）----------
    const constants = {
        maxSkillPoints: 5,
        baseDefenseMultiplier: 0.5,
        minDamageMultiplier: 0.1,
        critDamageCap: 3.0,
        dotDamageMultiplier: 0.6,
        breakDamageMultiplier: 2.0
    };

    function calculateDamage(attacker, target, skill) {
        let damage = attacker.attack * (skill.baseDamage || 1);
        const isCritical = Math.random() < attacker.critRate;
        if (isCritical) {
            damage *= (1 + Math.min(attacker.critDamage, constants.critDamageCap));
        }
        if (skill.element && attacker[`${skill.element}DamageBoost`]) {
            damage *= (1 + attacker[`${skill.element}DamageBoost`]);
        }
        const resistance = target.resistances?.[skill.element] || 0;
        damage *= (1 - Math.min(resistance, 0.7));
        let defense = target.defense;
        if (target.isDefDown) defense *= 0.65;
        damage *= (1 - defense / (defense + 2000));
        if (skill.extraDamage && target.debuffs?.length > 0) {
            damage *= (1 + skill.extraDamage);
        }
        damage = Math.max(damage, attacker.attack * constants.minDamageMultiplier);
        return { damage: Math.round(damage), isCritical };
    }

    function calculateSimpleDamage(attacker, target, skill) {
        const baseDamage = attacker.attack * (skill.baseDamage || 1);
        const isCritical = Math.random() < attacker.critRate;
        let damage = isCritical ? baseDamage * (1 + attacker.critDamage) : baseDamage;
        if (skill.element && target.resistances?.[skill.element]) {
            damage *= (1 - target.resistances[skill.element]);
        }
        damage *= (1 - target.defense / (target.defense + 1000));
        return { damage: Math.round(damage), isCritical };
    }

    // ---------- 9. 导出接口 ----------
    return {
        characters: [charactersBaseData.luguan], // 原始数据参考
        skills: skillsMap,
        extraAbilities: extraAbilitiesMap,
        eidolons: eidolonsMap,
        enemies: [],
        constants,
        MAX_CHARACTER_LEVEL,
        SKILL_MAX_LEVEL,
        getInitialState,
        levelUpCharacter,
        levelUpSkill,
        getSkillById: (id) => skillsMap[id] || null,
        getExtraAbilityById: (id) => extraAbilitiesMap[id] || null,
        getEidolonById: (id) => eidolonsMap[id] || null,
        getCharacterById: (id) => charactersBaseData[id] || null,
        getEnemyById: (id) => null,
        calculateDamage,
        calculateSimpleDamage
    };
})();

window.GameData = GameData;
console.log('游戏数据加载完成（基于鹿馆WIKI数值体系）');