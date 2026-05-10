// ===================== 游戏数据配置（崩铁公式 + 动态技能上限 + 命座，无防御技能）=====================
const GameData = (function() {
    // ---------- 1. 基础技能上限（无命座）----------
    const BASE_SKILL_MAX_LEVEL = {
        normal: 6,
        skill: 10,
        ultimate: 10,
        talent: 10
    };

    // ---------- 2. 属性预设点（等级 → {hp, atk, def}）----------
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

    function getStatByLevel(level, statName) {
        if (level <= PRESET_LEVELS[0]) return STAT_PRESETS[PRESET_LEVELS[0]][statName];
        if (level >= PRESET_LEVELS[PRESET_LEVELS.length-1]) return STAT_PRESETS[PRESET_LEVELS[PRESET_LEVELS.length-1]][statName];
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
        normal: { base: 50, step: 10 },
        skill: { base: 150, step: 20 },
        ultimate: [
            { base: 300, step: 36 },
            { base: 100, step: 10 }
        ],
        talent: [
            { base: 10, step: 2 },
            { base: 20, step: 5 }
        ]
    };

    function getSkillValue(skillType, level, index = 0) {
        const growth = SKILL_GROWTH[skillType];
        if (!growth) return 0;
        if (Array.isArray(growth)) {
            return growth[index].base + growth[index].step * (level - 1);
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
            baseStatsFixed: {
                maxEnergy: 120,
                speed: 115,
                critRate: 0.05,
                critDamage: 0.5,
                windDamageBoost: 0,
                effectHitRate: 0,
                effectRes: 0
            },
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
                    baseDamageExpr: () => getSkillValue('skill', this.currentLevel, 0) / 100,
                    // 新增：debuff 显示配置（用于战斗逻辑动态生成）
                    debuffConfig: {
                        nameTemplate: "{percent}%防御降低",
                        descTemplate: "防御力降低{percent}%，持续{turns}回合"
                    }
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
                }
            },
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

    // ---------- 5. 构建查找表（命座使用短ID作为键）----------
    const skillsMap = {};
    const extraAbilitiesMap = {};
    const eidolonsMap = {};

    function registerSkill(skillTemplate) {
        const clone = { ...skillTemplate };
        delete clone.baseDamageExpr;
        delete clone.extraDamageExpr;
        delete clone.penetrationExpr;
        delete clone.atkBonusExpr;
        skillsMap[clone.id] = clone;
    }
    function registerExtraAbility(ability) { extraAbilitiesMap[ability.id] = { ...ability }; }
    function registerEidolon(shortId, eidolon) {
        eidolonsMap[shortId] = { ...eidolon };
    }

    for (const char of Object.values(charactersBaseData)) {
        for (const skill of Object.values(char.skillsTemplates)) registerSkill(skill);
        for (const ability of Object.values(char.extraAbilities)) registerExtraAbility(ability);
        for (const [shortId, eidolon] of Object.entries(char.eidolons)) {
            registerEidolon(shortId, eidolon);
        }
    }

    // ---------- 6. 获取技能上限（根据命座动态调整）----------
    function getSkillMaxLevel(skillType, activatedEidolons = []) {
        let base = BASE_SKILL_MAX_LEVEL[skillType];
        if (!base) return 1;
        let extra = 0;
        if (skillType === 'normal' && activatedEidolons.includes('e3')) extra = 1;
        if (skillType === 'talent' && activatedEidolons.includes('e3')) extra = 2;
        if (skillType === 'skill' && activatedEidolons.includes('e5')) extra = 2;
        if (skillType === 'ultimate' && activatedEidolons.includes('e5')) extra = 2;
        return base + extra;
    }

    // ---------- 7. 初始化角色实例（支持等级、技能等级、命座）----------
    function getInitialState(levelConfig = null, activatedEidolons = []) {
        const charBase = charactersBaseData.luguan;
        let charLevel = 1;
        let skillLevels = {};
        if (levelConfig && levelConfig.luguan) {
            charLevel = levelConfig.luguan.level || 1;
            skillLevels = levelConfig.luguan.skillLevels || {};
        }
        charLevel = Math.min(90, Math.max(1, charLevel));

        const hp = getStatByLevel(charLevel, 'hp');
        const atk = getStatByLevel(charLevel, 'atk');
        const def = getStatByLevel(charLevel, 'def');
        const { maxEnergy, speed, critRate, critDamage, windDamageBoost, effectHitRate, effectRes } = charBase.baseStatsFixed;

        const skills = [];
        for (const [key, template] of Object.entries(charBase.skillsTemplates)) {
            const skillType = key === 'normal' ? 'normal' : (key === 'skill' ? 'skill' : (key === 'ultimate' ? 'ultimate' : 'talent'));
            const maxLv = getSkillMaxLevel(skillType, activatedEidolons);
            let currentLv = skillLevels[template.id] || 1;
            currentLv = Math.min(maxLv, Math.max(1, currentLv));
            let baseDamage = null, extraDamage = null;
            if (template.baseDamageExpr) {
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
                baseDamage: baseDamage,
                extraDamage: extraDamage,
                debuffConfig: template.debuffConfig // 传递配置
            };
            skills.push(skillObj);
        }

        const extraAbilities = Object.values(charBase.extraAbilities).map(a => ({ ...a }));
        const eidolonList = activatedEidolons.map(id => ({ id, ...eidolonsMap[id] }));

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
            eidolons: eidolonList,
            activatedEidolons: activatedEidolons,
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

    // ---------- 8. 升级方法 ----------
    function levelUpCharacter(character, targetLevel) {
        if (!character) return false;
        let newLevel = targetLevel || (character.level + 1);
        if (newLevel > 90) newLevel = 90;
        if (newLevel <= character.level) return false;
        const oldHp = character.hp;
        const oldMaxHp = character.maxHp;
        character.level = newLevel;
        character.maxHp = getStatByLevel(newLevel, 'hp');
        character.attack = getStatByLevel(newLevel, 'atk');
        character.defense = getStatByLevel(newLevel, 'def');
        const ratio = oldHp / oldMaxHp;
        character.hp = Math.floor(character.maxHp * ratio);
        if (character.hp <= 0) character.hp = 1;
        character._baseStats = { hp: character.maxHp, atk: character.attack, def: character.defense };
        character._charLevel = newLevel;
        return true;
    }

    function levelUpSkill(skill) {
        if (!skill) return false;
        if (skill.currentLevel >= skill.maxLevel) return false;
        skill.currentLevel++;
        const skillType = skill.type;
        if (skillType === 'normal' || skillType === 'skill') {
            skill.baseDamage = getSkillValue(skillType, skill.currentLevel, 0) / 100;
        } else if (skillType === 'ultimate') {
            skill.baseDamage = getSkillValue('ultimate', skill.currentLevel, 0) / 100;
            skill.extraDamage = getSkillValue('ultimate', skill.currentLevel, 1) / 100;
        } else if (skillType === 'talent') {
            skill.penetration = getSkillValue('talent', skill.currentLevel, 0) / 100;
            skill.atkBonus = getSkillValue('talent', skill.currentLevel, 1) / 100;
        }
        return true;
    }

    // ---------- 9. 崩铁标准伤害计算（含命座效果）----------
    function calculateDamage(attacker, target, skill) {
        let damage = attacker.attack * (skill.baseDamage || 1);
        if (skill.element && attacker[`${skill.element}DamageBoost`]) {
            damage *= (1 + attacker[`${skill.element}DamageBoost`]);
        }
        const resistance = target.resistances?.[skill.element] || 0;
        damage *= (1 - Math.min(resistance, 0.7));
        let defense = target.defense;
        if (target.isDefDown) {
            defense *= (1 - (skill.defDownAmount || 0.35));
        }
        if (attacker.activatedEidolons && attacker.activatedEidolons.includes('e6')) {
            defense *= 0.76;
        }
        const defenseReducer = 1000 / (1000 + defense);
        damage *= defenseReducer;

        let finalCritRate = attacker.critRate;
        let finalCritDamage = attacker.critDamage;
        if (attacker.activatedEidolons && attacker.activatedEidolons.includes('e2') && target.debuffs && target.debuffs.length > 0) {
            finalCritRate += 0.18;
            const stacks = Math.min(target.debuffs.length, 6);
            finalCritDamage += 0.24 * stacks;
        }
        const isCritical = Math.random() < finalCritRate;
        if (isCritical) {
            damage *= (1 + finalCritDamage);
        }
        if (skill.extraDamage && target.debuffs && target.debuffs.length > 0) {
            damage *= (1 + skill.extraDamage);
        }
        if (attacker.activatedEidolons && attacker.activatedEidolons.includes('e1') && target.hp >= target.maxHp * 0.2) {
            damage *= 1.5;
        }
        damage = Math.max(damage, attacker.attack * 0.1);
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

    // ---------- 10. 导出接口 ----------
    return {
        characters: [charactersBaseData.luguan],
        skills: skillsMap,
        extraAbilities: extraAbilitiesMap,
        eidolons: eidolonsMap,
        enemies: [],
        constants: { maxSkillPoints: 5, minDamageMultiplier: 0.1 },
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
console.log('游戏数据加载完成（命座使用短ID，已修复描述显示）');