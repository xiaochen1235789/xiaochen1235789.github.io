// character-upgrade.js
// 鹿馆升级核心逻辑（已集成专属评分、颜色高亮、文本优化，新增行迹系统）
// 修复保存按钮失效问题，增加错误捕获和详细日志，保存后不自动返回

// ========== 页面加载状态 ==========
let loadingOverlay = null;

// ========== 角色升级相关变量 ==========
let currentCharacter = null;
let totalCredits = 5000000;
let activatedEidolons = [];
let activatedTraces = [];

const COST_LEVEL = 1000;
const COST_SKILL = 500;
const RELIC_UPGRADE_COST = 500;
const LIGHTCONE_UPGRADE_COST = 500;

let relicEquips = { head: null, hands: null, body: null, feet: null, sphere: null, rope: null };

// 行迹数据（与 game-data.js 中的 extraAbilities 对应）
const traceList = [
    { id: "luguan_talent1", name: "疾风守护", description: "生命值≤50%时，受到的伤害降低50%。", icon: "🛡️" },
    { id: "luguan_talent2", name: "精准狩猎", description: "战技对负面效果下的目标造成的伤害提高60%。", icon: "🎯" },
    { id: "luguan_talent3", name: "风速迅捷", description: "施放普攻后自身行动提前20%。", icon: "⚡" }
];

// ========== 光锥数据（保持不变）==========
const lcBasePoints = {
    1:{hp:48,atk:26,def:21},20:{hp:242,atk:133,def:106},30:{hp:391,atk:215,def:171},
    40:{hp:540,atk:297,def:236},50:{hp:688,atk:378,def:301},60:{hp:837,atk:460,def:366},
    70:{hp:986,atk:542,def:431},80:{hp:1058,atk:582,def:463},90:{hp:1270,atk:698,def:556}
};
const lcLevels = [1,20,30,40,50,60,70,80,90];
let lightconeStatsByLevel = [];
for (let i = 1; i <= 90; i++) {
    let lower = lcLevels[0], upper = lcLevels[lcLevels.length-1];
    for (let j = 0; j < lcLevels.length-1; j++) if (i >= lcLevels[j] && i <= lcLevels[j+1]) { lower = lcLevels[j]; upper = lcLevels[j+1]; break; }
    const low = lcBasePoints[lower], high = lcBasePoints[upper], ratio = (i - lower) / (upper - lower);
    lightconeStatsByLevel[i] = { hp: Math.round(low.hp + (high.hp - low.hp) * ratio), atk: Math.round(low.atk + (high.atk - low.atk) * ratio), def: Math.round(low.def + (high.def - low.def) * ratio) };
}
let lightconeLevel = 1, superimpose = 1;

function loadLightconeData() {
    const savedLv = localStorage.getItem('hsr-lightcone-level'); if (savedLv) lightconeLevel = parseInt(savedLv,10)||1;
    const savedSuper = localStorage.getItem('hsr-lightcone-superimpose'); if (savedSuper) superimpose = parseInt(savedSuper,10)||1;
    const selector = document.getElementById('lcSuperimpose');
    if (selector) selector.value = superimpose;
}
function saveLightconeLevel() { localStorage.setItem('hsr-lightcone-level', lightconeLevel); }
function saveLightconeSuperimpose() { localStorage.setItem('hsr-lightcone-superimpose', superimpose); }

function updateLightconeUI() {
    const stats = lightconeStatsByLevel[lightconeLevel];
    document.getElementById('lcHp').innerText = stats.hp;
    document.getElementById('lcAtk').innerText = stats.atk;
    document.getElementById('lcDef').innerText = stats.def;
    document.getElementById('lcLevelDisplay').innerText = `Lv.${lightconeLevel}`;
    document.getElementById('lcLevelSlider').value = lightconeLevel;
    const critRate = [0.20,0.225,0.25,0.275,0.30][superimpose-1];
    const skillDmg = [0.06,0.08,0.10,0.12,0.14][superimpose-1];
    const ultDmg = [0.16,0.18,0.20,0.22,0.24][superimpose-1];
    const stacks = Math.min(10, Math.max(0, Math.floor(((currentCharacter?.speed||102)-100)/6)));
    const descDiv = document.getElementById('lcDesc');
    if (descDiv) {
        descDiv.innerHTML = `
            <div>✨ 基础效果（叠影${['①','②','③','④','⑤'][superimpose-1]}）</div>
            <div>• 暴击率提高 ${(critRate*100).toFixed(1)}%</div>
            <div>• 速度＞100时，每超过6点获得1层【暗涌】（最多10层）</div>
            <div>• 每层【暗涌】使普攻/战技伤害提高 ${(skillDmg*100).toFixed(0)}%，终结技暴伤提高 ${(ultDmg*100).toFixed(0)}%</div>
            <div class="skill-next" style="margin-top:4px;">当前速度 ${currentCharacter?.speed||102} → 可叠加 ${stacks} 层</div>
        `;
    }
    const downBtn=document.getElementById('lcLevelDown'), upBtn=document.getElementById('lcLevelUp');
    if(downBtn) downBtn.disabled=(lightconeLevel<=1);
    if(upBtn) upBtn.disabled=(lightconeLevel>=90);
}
function changeLightconeLevel(delta) {
    let newLevel=lightconeLevel+delta;
    if(newLevel<1) newLevel=1; if(newLevel>90) newLevel=90;
    if(newLevel===lightconeLevel) return;
    const cost=Math.abs(newLevel-lightconeLevel)*LIGHTCONE_UPGRADE_COST;
    if(totalCredits<cost){ showToast(`信用点不足，需要 ${cost} 点`,true); return; }
    totalCredits-=cost;
    lightconeLevel=newLevel;
    updateLightconeUI();
    updateCreditUI();
    saveLightconeLevel();
    showToast(`光锥升至 Lv.${lightconeLevel}`,false);
}
function changeSuperimpose() {
    const select = document.getElementById('lcSuperimpose');
    if (select) superimpose=parseInt(select.value,10);
    saveLightconeSuperimpose();
    updateLightconeUI();
    showToast(`叠影等级已切换`,false);
}

// ========== 通用辅助 ==========
function showToast(msg, isError=false) {
    const toast=document.getElementById('toastMsg');
    toast.textContent=msg;
    toast.style.color=isError?'var(--hsr-danger)':'var(--hsr-primary)';
    toast.style.opacity='1';
    setTimeout(()=>toast.style.opacity='0',2000);
}
function updateCreditUI() { 
    const creditSpan = document.getElementById('creditDisplay');
    if (creditSpan) creditSpan.innerHTML=`💰 ${totalCredits} 信用点`; 
}

// ========== 行迹管理 ==========
function loadSavedTraces() {
    const saved = localStorage.getItem('hsr-activated-traces');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) activatedTraces = parsed;
            else activatedTraces = [];
        } catch(e) { activatedTraces = []; }
    } else {
        activatedTraces = traceList.map(t => t.id);
    }
    activatedTraces = activatedTraces.filter(id => traceList.some(t => t.id === id));
    if (activatedTraces.length === 0) activatedTraces = traceList.map(t => t.id);
    renderTracesGrid();
}
function saveTracesToLocal() {
    localStorage.setItem('hsr-activated-traces', JSON.stringify(activatedTraces));
}
function toggleTrace(traceId) {
    const idx = activatedTraces.indexOf(traceId);
    if (idx === -1) activatedTraces.push(traceId);
    else activatedTraces.splice(idx, 1);
    renderTracesGrid();
    saveTracesToLocal();
    showToast(`行迹 ${traceList.find(t=>t.id===traceId)?.name} ${idx===-1?'已激活':'已关闭'}`, false);
}
function renderTracesGrid() {
    const container = document.getElementById('tracesGrid');
    if (!container) return;
    container.innerHTML = traceList.map(trace => {
        const isActive = activatedTraces.includes(trace.id);
        return `
            <div class="trace-card ${isActive ? 'active' : ''}" data-trace-id="${trace.id}">
                <div class="trace-header">
                    <span class="trace-icon">${trace.icon}</span>
                    <span class="trace-name">${trace.name}</span>
                </div>
                <div class="trace-desc">${trace.description}</div>
                <button class="trace-toggle-btn ${isActive ? 'active' : ''}" data-id="${trace.id}">
                    ${isActive ? '✓ 已激活' : '🔘 未激活'}
                </button>
            </div>
        `;
    }).join('');
    document.querySelectorAll('.trace-toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) toggleTrace(id);
        };
    });
}

// ========== 遗器评分系统 ==========
function getRulesForCurrentCharacter() {
    if (!currentCharacter) return window.getCharacterRules?.("default") || { tier1: [], tier2: [], scorePerTier1:1, scorePerTier2:0.5, enhanceScore:1, graduationScore:{ perfect:8, good:6, pass:4 } };
    const rules = window.getCharacterRules?.(currentCharacter.name);
    return rules || window.getCharacterRules?.("default") || { tier1: [], tier2: [], scorePerTier1:1, scorePerTier2:0.5, enhanceScore:1, graduationScore:{ perfect:8, good:6, pass:4 } };
}

function calcRelicScore(relic) {
    if (!relic || !relic.subStats) return 0;
    const rules = getRulesForCurrentCharacter();
    const tier1Set = new Set(rules.tier1 || []);
    const tier2Set = new Set(rules.tier2 || []);
    const scorePerTier1 = rules.scorePerTier1 ?? 1.0;
    const scorePerTier2 = rules.scorePerTier2 ?? 0.5;
    const enhanceScore = rules.enhanceScore ?? 1.0;

    let totalScore = 0;
    for (let sub of relic.subStats) {
        let baseWeight = 0;
        if (tier1Set.has(sub.type)) baseWeight = scorePerTier1;
        else if (tier2Set.has(sub.type)) baseWeight = scorePerTier2;
        else continue;
        totalScore += baseWeight;
        totalScore += (sub.enhanceCount || 0) * enhanceScore;
    }
    return Math.round(totalScore * 10) / 10;
}

function getRelicRating(score) {
    const rules = getRulesForCurrentCharacter();
    const perfect = rules.graduationScore?.perfect ?? 8;
    const good = rules.graduationScore?.good ?? 6;
    const pass = rules.graduationScore?.pass ?? 4;
    if (score >= perfect) return '★★★★★ 毕业';
    if (score >= good)  return '★★★★☆ 小毕业';
    if (score >= pass)  return '★★★☆☆ 过渡';
    return '★★☆☆☆ 未毕业';
}

function getEffectiveStatsForCharacter(character) {
    const rules = character ? (window.getCharacterRules?.(character.name) || window.getCharacterRules?.("default")) : window.getCharacterRules?.("default");
    if (!rules) return ['critRate','critDamage','speed','atkPercent','atk'];
    return [...(rules.tier1 || []), ...(rules.tier2 || [])];
}

function isMainStatRecommended(part, mainStatType) {
    const rules = getRulesForCurrentCharacter();
    const rec = rules.recommendedMainStats?.[part];
    if (!rec) return false;
    if (Array.isArray(rec)) return rec.includes(mainStatType);
    return rec === mainStatType;
}

function getSubStatTier(statType) {
    const rules = getRulesForCurrentCharacter();
    if (rules.tier1?.includes(statType)) return 1;
    if (rules.tier2?.includes(statType)) return 2;
    return 0;
}

// ========== 遗器渲染 ==========
const statIconMap = {
    hpPercent:'/attribute_image/HP.webp', hp:'/attribute_image/HP.webp',
    atkPercent:'/attribute_image/ATK.webp', atk:'/attribute_image/ATK.webp',
    defPercent:'/attribute_image/DEF.webp', def:'/attribute_image/DEF.webp',
    speed:'/attribute_image/SPD.webp',
    critRate:'/attribute_image/IconCriticalChance.webp',
    critDamage:'/attribute_image/IconCriticalDamage.webp',
    effectHitRate:'/attribute_image/IconStatusProbability.webp',
    effectRes:'/attribute_image/IconStatusResistance.webp',
    energyRegen:'/attribute_image/IconEnergyRecovery.webp',
    windDamage:'/Wind.webp', fireDamage:'/Fire.webp',
    iceDamage:'/Ice.webp', imaginaryDamage:'/Imaginary.webp',
    physicalDamage:'/Phys.webp', quantumDamage:'/Quantum.webp'
};
function getStatIcon(type) { return statIconMap[type] || '/attribute_image/HP.webp'; }
function formatStatValue(type,value) {
    const percentTypes=['hpPercent','atkPercent','defPercent','critRate','critDamage','effectHitRate','effectRes','energyRegen','windDamage','fireDamage','iceDamage','imaginaryDamage','physicalDamage','quantumDamage'];
    return percentTypes.includes(type)?`${value}%`:`${value}`;
}
function getStatName(type) {
    const map = {
        hpPercent:'生命', atkPercent:'攻击', defPercent:'防御',
        critRate:'暴击率', critDamage:'暴击伤害',
        speed:'速度', effectHitRate:'效果命中', effectRes:'效果抵抗', energyRegen:'能量回复',
        windDamage:'风属性伤害提高', fireDamage:'火属性伤害提高', iceDamage:'冰属性伤害提高',
        imaginaryDamage:'虚数属性伤害提高', physicalDamage:'物理属性伤害提高', quantumDamage:'量子属性伤害提高',
        hp:'生命', atk:'攻击', def:'防御'
    };
    return map[type] || type;
}
function getPartName(part) {
    const map={head:'智慧头套',hands:'指挥手套',body:'安心的护甲',feet:'健步如飞的靴子',sphere:'过去的球',rope:'过去的绳'};
    return map[part]||part;
}

function enhanceRelicSubStat(relic) {
    if (!window.SubStatPool || !window.SubStatBase || !window.SubStatRollRange) {
        console.warn("遗器统计数据未加载，无法强化副词条");
        return;
    }
    if (relic.subStats.length < 4) {
        const existingTypes = relic.subStats.map(s => s.type);
        let candidates = window.SubStatPool.filter(t => t !== relic.mainStat.type && !existingTypes.includes(t));
        if (candidates.length === 0) candidates = window.SubStatPool.filter(t => t !== relic.mainStat.type);
        const newType = candidates[Math.floor(Math.random() * candidates.length)];
        let base = window.SubStatBase[newType];
        let roll = window.SubStatRollRange.min + Math.random() * (window.SubStatRollRange.max - window.SubStatRollRange.min);
        let value = base * roll;
        if (newType === 'speed') value = Math.round(value);
        else if (newType === 'hp' || newType === 'atk' || newType === 'def') value = Math.floor(value);
        else value = parseFloat(value.toFixed(1));
        relic.subStats.push({ type: newType, value: value, enhanceCount: 0 });
        return;
    }
    const idx = Math.floor(Math.random() * relic.subStats.length);
    const sub = relic.subStats[idx];
    if (sub.enhanceCount === undefined) sub.enhanceCount = 0;
    sub.enhanceCount++;
    let base = window.SubStatBase[sub.type];
    let increment = base * (0.8 + Math.random() * 0.4);
    if (sub.type === 'speed') increment = Math.round(increment);
    else if (sub.type === 'hp' || sub.type === 'atk' || sub.type === 'def') increment = Math.floor(increment);
    else increment = parseFloat(increment.toFixed(1));
    sub.value += increment;
    sub.value = parseFloat(sub.value.toFixed(1));
}

function upgradeRelic(part) {
    let relic = relicEquips[part];
    if (!relic) return;
    if (relic.level >= 15) {
        showToast(`${getPartName(part)} 已达最高等级！`, true);
        return;
    }
    if (totalCredits < RELIC_UPGRADE_COST) {
        showToast('信用点不足！', true);
        return;
    }
    totalCredits -= RELIC_UPGRADE_COST;
    relic.level++;
    if (window.getRelicMainStatValue) {
        relic.mainStat.value = window.getRelicMainStatValue(relic.mainStat.type, relic.level);
    } else {
        let step = relic.mainStat.type === 'speed' ? 1.56 : (relic.mainStat.type.includes('Damage') ? 2.592 : (relic.mainStat.type === 'critRate' ? 1.944 : (relic.mainStat.type === 'critDamage' ? 3.888 : 2.592)));
        relic.mainStat.value = (relic.mainStat.value || 0) + step;
        relic.mainStat.value = parseFloat(relic.mainStat.value.toFixed(1));
    }
    if (relic.level % 3 === 0 && relic.level <= 15) {
        enhanceRelicSubStat(relic);
        showToast(`${getPartName(part)} 副词条强化！`, false);
    }
    saveRelicEquips();
    renderRelicSystem();
    updateCreditUI();
    showToast(`${getPartName(part)} 升至 +${relic.level}`);
}

function loadRelicEquips() {
    const saved = localStorage.getItem('hsr-relic-equips');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            relicEquips = { head: null, hands: null, body: null, feet: null, sphere: null, rope: null, ...parsed };
            for (let part of Object.keys(relicEquips)) {
                let r = relicEquips[part];
                if (r && r.subStats) {
                    r.subStats.forEach(s => { if (s.enhanceCount === undefined) s.enhanceCount = 0; });
                }
            }
        } catch(e) { console.warn(e); }
    }
    const parts = ['head','hands','body','feet','sphere','rope'];
    for (let part of parts) {
        if (!relicEquips[part]) {
            relicEquips[part] = { id:`empty_${part}`, setType:"新生的未来", part:part, level:0, mainStat:{ type: part==='head'?'hpPercent':'atkPercent', value:0 }, subStats:[] };
        }
    }
    saveRelicEquips();
}
function saveRelicEquips() { localStorage.setItem('hsr-relic-equips', JSON.stringify(relicEquips)); }

function renderRelicSystem() {
    const container=document.getElementById('relicGrid');
    if(!container) return;
    const parts=['head','hands','body','feet','sphere','rope'];
    container.innerHTML=parts.map(part=>{
        const relic=relicEquips[part];
        if(!relic) return `<div class="relic-slot">${getPartName(part)}<div>无遗器</div></div>`;
        
        const isMainGood = isMainStatRecommended(part, relic.mainStat.type);
        const mainColor = isMainGood ? '#ffa500' : '#ffffff';
        const mainIcon=getStatIcon(relic.mainStat.type);
        const mainName=getStatName(relic.mainStat.type);
        const mainVal=formatStatValue(relic.mainStat.type,relic.mainStat.value);
        
        const subStatsHtml=relic.subStats.map(sub=>{
            const tier = getSubStatTier(sub.type);
            let subColor = '#ffffff';
            if (tier === 1) subColor = '#f5e6b0';
            const icon=getStatIcon(sub.type);
            const name=getStatName(sub.type);
            const val=formatStatValue(sub.type,sub.value);
            const cnt=sub.enhanceCount||0;
            const marks=['①','②','③','④','⑤'];
            const markStr=cnt>0?marks[cnt-1]:'';
            return `<div class="substat" style="color:${subColor};"><img src="${icon}" class="stat-icon">${name}: ${val}${markStr}</div>`;
        }).join('');
        
        const score=calcRelicScore(relic);
        const rating=getRelicRating(score);
        const ratingColor=score>=8?'#ffaa44':(score>=6?'#e6c87e':'#aaa');
        return `
            <div class="relic-slot">
                <div class="relic-header"><span class="relic-partName">${getPartName(part)}</span><span class="relic-level">+${relic.level}</span></div>
                <div class="relic-mainStat" style="color:${mainColor};"><img src="${mainIcon}" class="stat-icon">${mainName}: ${mainVal}</div>
                <div class="relic-subStats">${subStatsHtml||'<span style="color:#aaa;">无副词条</span>'}</div>
                <div class="relic-rating" style="color:${ratingColor};">📊 ${rating} (${score}分)</div>
                <div class="relic-actions"><button class="relic-btn" onclick="upgradeRelic('${part}')">⬆️ 升级 (${RELIC_UPGRADE_COST})</button></div>
            </div>
        `;
    }).join('');
}

// ========== 角色升级逻辑（含行迹保存）==========
function rebuildCharacter() {
    if (!window.GameData) return;
    let initState = GameData.getInitialState(null, activatedEidolons);
    let newChar = initState.party[0];
    const upgradeData = loadSavedUpgradeData();
    if (upgradeData) {
        if (upgradeData.level && upgradeData.level > 1) GameData.levelUpCharacter(newChar, upgradeData.level);
        if (upgradeData.skillLevels) {
            newChar.skills.forEach(skill => {
                const targetLv = upgradeData.skillLevels[skill.id];
                if (targetLv && targetLv > skill.currentLevel) {
                    while (skill.currentLevel < targetLv && skill.currentLevel < skill.maxLevel) GameData.levelUpSkill(skill);
                }
            });
        }
    }
    currentCharacter = newChar;
    renderCharacterInfo();
    renderLevelUpPanel();
    renderSkillList();
    if (document.getElementById('tab2')?.classList.contains('active')) updateLightconeUI();
}

function toggleEidolon(eidolonId) {
    const idx = activatedEidolons.indexOf(eidolonId);
    if (idx === -1) activatedEidolons.push(eidolonId);
    else activatedEidolons.splice(idx, 1);
    renderEidolonButtons();
    rebuildCharacter();
}

function renderEidolonButtons() {
    const container = document.getElementById('eidolonGrid');
    if (!container) return;
    const fallbackEidolons = {
        e1: { name: '疾风追影', description: '攻击敌方目标时，若其生命≥20%，受到的伤害提高50%。' },
        e2: { name: '旋刃狩魂', description: '对拥有负面效果的目标暴击率提高18%，每有一个负面效果暴击伤害提高24%，最多144%。' },
        e3: { name: '裂空破障', description: '普攻等级+1，天赋等级+2。' },
        e4: { name: '破晓狩风', description: '消灭目标时恢复20能量并获得额外回合。' },
        e5: { name: '风狩铭纹', description: '战技等级+2，终结技等级+2。' },
        e6: { name: '逐影风刃', description: '天赋所有效果进入战斗后立即生效，且伤害无视目标24%防御。' }
    };
    let eidolonMap = (window.GameData && window.GameData.eidolons) ? window.GameData.eidolons : fallbackEidolons;
    const allEidolons = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
    container.innerHTML = allEidolons.map(id => {
        const eData = eidolonMap[id] || fallbackEidolons[id];
        const name = eData ? eData.name : (id === 'e1' ? '疾风追影' : '未知命座');
        const desc = eData ? eData.description : '暂无描述';
        const isActive = activatedEidolons.includes(id);
        return `<div class="eidolon-card ${isActive ? 'active' : ''}" data-eidolon="${id}">
                    <div class="eidolon-header"><span class="eidolon-name">${name}</span></div>
                    <div class="eidolon-desc">${desc}</div>
                    <button class="eidolon-activate-btn ${isActive ? 'active' : ''}" data-id="${id}">${isActive ? '✓ 已激活' : '🔘 未激活'}</button>
                </div>`;
    }).join('');
    document.querySelectorAll('.eidolon-activate-btn').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); toggleEidolon(btn.dataset.id); };
    });
}

function loadSavedEidolons() {
    const saved = localStorage.getItem('hsr-activated-eidolons');
    if (saved) {
        try {
            activatedEidolons = JSON.parse(saved);
            if (!Array.isArray(activatedEidolons)) activatedEidolons = [];
        } catch (e) { activatedEidolons = []; }
    } else {
        activatedEidolons = [];
    }
    renderEidolonButtons();
}

function renderCharacterInfo() {
    if (!currentCharacter) return;
    const char = currentCharacter;
    const container = document.getElementById('characterCard');
    if (!container) return;
    container.innerHTML = `
        <div class="char-header">
            <div class="char-avatar">${char.avatar || '🦌'}</div>
            <div class="char-info">
                <div class="char-name">${char.name}</div>
                <div class="char-meta">
                    <span class="char-tag">${char.path}</span>
                    <span class="char-tag">${char.element === 'wind' ? '风' : char.element}</span>
                    <span class="char-tag">Lv.${char.level}</span>
                    ${activatedEidolons.length > 0 ? `<span class="char-tag">🌟${activatedEidolons.length}命</span>` : ''}
                </div>
            </div>
        </div>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-label"><img src="/attribute_image/HP.webp" class="stat-icon" style="width:20px;height:20px;vertical-align:middle;"> 生命</div>
                <div class="stat-value">${char.maxHp}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><img src="/attribute_image/ATK.webp" class="stat-icon" style="width:20px;height:20px;vertical-align:middle;"> 攻击</div>
                <div class="stat-value">${char.attack}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><img src="/attribute_image/DEF.webp" class="stat-icon" style="width:20px;height:20px;vertical-align:middle;"> 防御</div>
                <div class="stat-value">${char.defense}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><img src="/attribute_image/SPD.webp" class="stat-icon" style="width:20px;height:20px;vertical-align:middle;"> 速度</div>
                <div class="stat-value">${char.speed}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><img src="/attribute_image/IconCriticalChance.webp" class="stat-icon" style="width:20px;height:20px;vertical-align:middle;"> 暴击率</div>
                <div class="stat-value">${Math.round(char.critRate * 100)}%</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><img src="/attribute_image/IconCriticalDamage.webp" class="stat-icon" style="width:20px;height:20px;vertical-align:middle;"> 暴击伤害</div>
                <div class="stat-value">${Math.round(char.critDamage * 100)}%</div>
            </div>
        </div>
    `;
}

function getNextDamage(skill) {
    if (skill.currentLevel >= skill.maxLevel) return null;
    let nextLv = skill.currentLevel + 1;
    if (skill.type === 'normal') return GameData.getSkillValue('normal', nextLv, 0) / 100;
    if (skill.type === 'skill') return GameData.getSkillValue('skill', nextLv, 0) / 100;
    if (skill.type === 'ultimate') return GameData.getSkillValue('ultimate', nextLv, 0) / 100;
    return null;
}

function getProcessedDescription(skill) {
    let desc = skill.description || '无描述';
    if (skill.baseDamage && desc.includes('{damage}')) desc = desc.replace('{damage}', `<span class="golden">${Math.round(skill.baseDamage * 100)}%</span>`);
    if (skill.extraDamage && desc.includes('{extra}')) desc = desc.replace('{extra}', `<span class="golden">${Math.round(skill.extraDamage * 100)}%</span>`);
    if (skill.type === 'talent') {
        if (skill.penetration !== undefined && desc.includes('{penetration}')) desc = desc.replace('{penetration}', `<span class="golden">${Math.round(skill.penetration * 100)}%</span>`);
        if (skill.atkBonus !== undefined && desc.includes('{atkBonus}')) desc = desc.replace('{atkBonus}', `<span class="golden">${Math.round(skill.atkBonus * 100)}%</span>`);
    }
    return desc;
}

function getNextTalentValues(skill) {
    if (skill.type !== 'talent' || skill.currentLevel >= skill.maxLevel) return null;
    let nextLv = skill.currentLevel + 1;
    let nextPen = GameData.getSkillValue('talent', nextLv, 0) / 100;
    let nextAtk = GameData.getSkillValue('talent', nextLv, 1) / 100;
    return { curPen: skill.penetration, curAtk: skill.atkBonus, nextPen, nextAtk };
}

function renderLevelUpPanel() {
    const char = currentCharacter;
    const nextLevel = char.level + 1;
    const canLevelUp = nextLevel <= GameData.MAX_CHARACTER_LEVEL && totalCredits >= COST_LEVEL;
    const isMaxLevel = char.level >= GameData.MAX_CHARACTER_LEVEL;
    let nextHp = char.maxHp, nextAtk = char.attack, nextDef = char.defense;
    if (!isMaxLevel && nextLevel <= GameData.MAX_CHARACTER_LEVEL && GameData.getStatByLevel) {
        nextHp = GameData.getStatByLevel(nextLevel, 'hp');
        nextAtk = GameData.getStatByLevel(nextLevel, 'atk');
        nextDef = GameData.getStatByLevel(nextLevel, 'def');
    }
    const panel = document.getElementById('levelUpPanel');
    if (!panel) return;
    
    let levelInfo = '';
    if (isMaxLevel) {
        levelInfo = `<div class="skill-name">已满级 (Lv.${char.level})</div>
                     <div class="skill-desc">⭐ 角色已达到最高等级 ⭐</div>`;
    } else {
        levelInfo = `<div class="skill-name">当前等级 ${char.level}</div>
                     <div class="skill-desc">下一级 → Lv.${nextLevel}<br>生命 ${char.maxHp} → ${nextHp} &nbsp;|&nbsp;攻击 ${char.attack} → ${nextAtk} &nbsp;|&nbsp;防御 ${char.defense} → ${nextDef}</div>`;
    }
    
    panel.innerHTML = `<div class="skill-item">
        <div class="skill-info">
            ${levelInfo}
        </div>
        <div class="skill-level"><span>${isMaxLevel ? '无消耗' : `消耗 ${COST_LEVEL} 信用点`}</span></div>
        <button class="upgrade-btn" id="levelUpBtn" ${(!canLevelUp || isMaxLevel) ? 'disabled' : ''}>${isMaxLevel ? '✓ 已达上限' : '⬆️ 升级'}</button>
    </div>`;
    const btn = document.getElementById('levelUpBtn');
    if (btn && !isMaxLevel) btn.onclick = () => levelUpCharacter();
}

function levelUpCharacter() {
    const char = currentCharacter;
    const nextLevel = char.level + 1;
    if (nextLevel > GameData.MAX_CHARACTER_LEVEL) { showToast('已达最高等级！', true); return; }
    if (totalCredits < COST_LEVEL) { showToast('信用点不足！', true); return; }
    if (GameData.levelUpCharacter(char, nextLevel)) {
        totalCredits -= COST_LEVEL;
        updateCreditUI();
        renderCharacterInfo();
        renderLevelUpPanel();
        renderSkillList();
        showToast(`升级成功！鹿馆升至 Lv.${char.level}`);
    } else showToast('升级失败', true);
}

function renderSkillList() {
    const char = currentCharacter;
    const skills = char.skills || [];
    const displaySkills = skills.filter(s => ['normal', 'skill', 'ultimate', 'talent'].includes(s.type));
    const container = document.getElementById('skillList');
    if (!container) return;
    if (displaySkills.length === 0) { container.innerHTML = '<div style="padding:20px;text-align:center;">技能加载中...</div>'; return; }
    container.innerHTML = displaySkills.map(skill => {
        const canUp = skill.currentLevel < skill.maxLevel && totalCredits >= COST_SKILL;
        const processedDesc = getProcessedDescription(skill);
        let nextPreview = '';
        if (skill.type !== 'talent') {
            if (skill.currentLevel < skill.maxLevel) {
                const nextDamage = getNextDamage(skill);
                if (nextDamage) {
                    let cur = Math.round(skill.baseDamage * 100), nxt = Math.round(nextDamage * 100);
                    nextPreview = `<div class="skill-next">下一级: ${cur}% → ${nxt}%</div>`;
                }
            } else { nextPreview = `<div class="skill-max">✓ 已达最高等级</div>`; }
        } else {
            if (skill.currentLevel < skill.maxLevel) {
                const nextVals = getNextTalentValues(skill);
                if (nextVals) {
                    let curP = Math.round(nextVals.curPen * 100), nxtP = Math.round(nextVals.nextPen * 100);
                    let curA = Math.round(nextVals.curAtk * 100), nxtA = Math.round(nextVals.nextAtk * 100);
                    nextPreview = `<div class="skill-next">下一级: 穿透上限 ${curP}% → ${nxtP}% &nbsp;|&nbsp; 攻击加成上限 ${curA}% → ${nxtA}%</div>`;
                } else { nextPreview = `<div class="skill-next">升级提升天赋效果</div>`; }
            } else { nextPreview = `<div class="skill-max">✓ 天赋已达最高等级</div>`; }
        }
        return `<div class="skill-item" data-skill-id="${skill.id}">
            <div class="skill-info">
                <div class="skill-name">${skill.icon || '✨'} ${skill.name}</div>
                <div class="skill-desc">${processedDesc}</div>
                ${nextPreview}
            </div>
            <div class="skill-level">Lv.<span>${skill.currentLevel}</span> / ${skill.maxLevel}</div>
            <button class="upgrade-btn skill-upgrade" ${!canUp ? 'disabled' : ''}>⬆️ 升级 (${COST_SKILL})</button>
        </div>`;
    }).join('');
    document.querySelectorAll('.skill-upgrade').forEach(btn => {
        const item = btn.closest('.skill-item');
        const skillId = item?.dataset.skillId;
        const skill = currentCharacter.skills.find(s => s.id === skillId);
        if (skill) btn.onclick = () => upgradeSkill(skill);
    });
}

function upgradeSkill(skill) {
    if (skill.currentLevel >= skill.maxLevel) { showToast(`${skill.name} 已达最高等级！`, true); return; }
    if (totalCredits < COST_SKILL) { showToast('信用点不足！', true); return; }
    if (GameData.levelUpSkill(skill)) {
        totalCredits -= COST_SKILL;
        updateCreditUI();
        renderSkillList();
        renderCharacterInfo();
        showToast(`${skill.name} 升至 Lv.${skill.currentLevel}`);
    } else showToast(`${skill.name} 升级失败`, true);
}

// ==================== 修复保存函数（增加错误捕获，不跳转） ====================
function saveCharacter() {
    try {
        const char = currentCharacter;
        if (!char) {
            showToast('角色数据异常，保存失败', true);
            console.error('saveCharacter: currentCharacter is null');
            return;
        }

        const teamData = {
            characters: [{
                id: char.id, name: char.name, avatar: char.avatar, path: char.path,
                element: char.element === 'wind' ? '风' : char.element,
                hp: char.maxHp, attack: char.attack, defense: char.defense, speed: char.speed,
                level: char.level,
                skills: char.skills.map(s => ({ id: s.id, currentLevel: s.currentLevel }))
            }],
            timestamp: Date.now(),
            teamName: '鹿馆·独行'
        };
        const upgradeData = { level: char.level, skillLevels: {} };
        char.skills.forEach(s => { upgradeData.skillLevels[s.id] = s.currentLevel; });

        localStorage.setItem('hsr-selected-team', JSON.stringify(teamData));
        localStorage.setItem('hsr-upgrade-data', JSON.stringify(upgradeData));
        localStorage.setItem('hsr-activated-eidolons', JSON.stringify(activatedEidolons));
        
        saveTracesToLocal();
        saveRelicEquips();
        saveLightconeLevel();
        saveLightconeSuperimpose();
        
        // 验证关键数据是否写入成功（可选）
        const testRead = localStorage.getItem('hsr-upgrade-data');
        if (!testRead) throw new Error('hsr-upgrade-data 保存失败');
        
        showToast('角色数据已保存！', false);
        console.log('保存成功：', { teamData, upgradeData });
    } catch (err) {
        console.error('保存失败：', err);
        showToast('保存失败：' + err.message, true);
    }
}

function saveCredits() {
    try {
        localStorage.setItem('hsr_credits', totalCredits);
    } catch (err) {
        console.error('信用点保存失败：', err);
    }
}

function loadSavedUpgradeData() {
    const saved = localStorage.getItem('hsr-upgrade-data');
    try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
}

function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            panes.forEach(p => p.classList.remove('active'));
            const activePane = document.getElementById(tabId);
            if (activePane) activePane.classList.add('active');
            if (tabId === 'tab2') updateLightconeUI();
        });
    });
}

async function initUpgradePage() {
    // 显示 loading 遮罩
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:#0a0a14; z-index:9999; display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:#00d4ff; backdrop-filter:blur(10px);';
        loadingOverlay.innerHTML = '<div>加载中...<div style="margin-top:20px; width:40px; height:40px; border:4px solid #fff; border-top-color:#00d4ff; border-radius:50%; animation:spin 1s linear infinite;"></div></div>';
        if (!document.querySelector('#loading-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'loading-spinner-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        document.body.appendChild(loadingOverlay);
    }

    if (!window.GameData) { setTimeout(initUpgradePage, 200); return; }
    
    loadSavedEidolons();
    loadSavedTraces();   // 加载行迹激活状态
    
    let initState = GameData.getInitialState(null, activatedEidolons);
    let character = initState.party[0];
    const upgradeData = loadSavedUpgradeData();
    if (upgradeData) {
        if (upgradeData.level && upgradeData.level > 1) GameData.levelUpCharacter(character, upgradeData.level);
        if (upgradeData.skillLevels) {
            character.skills.forEach(skill => {
                const savedLv = upgradeData.skillLevels[skill.id];
                if (savedLv && savedLv > skill.currentLevel) {
                    while (skill.currentLevel < savedLv && skill.currentLevel < skill.maxLevel) GameData.levelUpSkill(skill);
                }
            });
        }
    }
    currentCharacter = character;
    const savedCredits = localStorage.getItem('hsr_credits');
    if (savedCredits) totalCredits = parseInt(savedCredits) || 50000;
    updateCreditUI();
    renderCharacterInfo();
    renderLevelUpPanel();
    renderSkillList();
    if (window.RelicSets) {
        loadRelicEquips();
        renderRelicSystem();
    } else { console.warn('relic-data.js 未加载，遗器系统不可用'); }
    loadLightconeData();
    updateLightconeUI();
    const slider = document.getElementById('lcLevelSlider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            const newLevel = parseInt(e.target.value, 10);
            if (newLevel !== lightconeLevel) {
                const cost = Math.abs(newLevel - lightconeLevel) * LIGHTCONE_UPGRADE_COST;
                if (totalCredits >= cost) {
                    totalCredits -= cost;
                    lightconeLevel = newLevel;
                    updateLightconeUI();
                    updateCreditUI();
                    saveLightconeLevel();
                    showToast(`光锥升至 Lv.${lightconeLevel}`, false);
                } else {
                    showToast(`信用点不足，需要 ${cost} 点`, true);
                    slider.value = lightconeLevel;
                }
            }
        });
    }
    const downBtn = document.getElementById('lcLevelDown');
    const upBtn = document.getElementById('lcLevelUp');
    if (downBtn) downBtn.addEventListener('click', () => changeLightconeLevel(-1));
    if (upBtn) upBtn.addEventListener('click', () => changeLightconeLevel(1));
    const superSelect = document.getElementById('lcSuperimpose');
    if (superSelect) superSelect.addEventListener('change', () => changeSuperimpose());
    initTabs();

    if (loadingOverlay) {
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                if (loadingOverlay && loadingOverlay.remove) loadingOverlay.remove();
                loadingOverlay = null;
            }, 500);
        }, 100);
    }
}

// ========== 全局保存按钮绑定（确保 DOM 加载完成后执行） ==========
function bindSaveButton() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        // 移除可能已有的监听器，避免重复绑定
        const newHandler = () => { saveCredits(); saveCharacter(); };
        // 移除旧监听（如果有，但不知道旧函数引用，可以替换 onclick 属性）
        saveBtn.onclick = null;
        saveBtn.addEventListener('click', newHandler);
        console.log('保存按钮已绑定');
    } else {
        console.warn('未找到保存按钮，请检查 HTML 中是否有 id="saveBtn" 的元素');
    }
}

// 挂载全局函数（供html onclick调用）
window.upgradeRelic = upgradeRelic;
window.saveCharacter = saveCharacter;
window.saveCredits = saveCredits;

// 启动页面
window.addEventListener('DOMContentLoaded', () => {
    initUpgradePage();
    bindSaveButton();
});

// 定时保存信用点
setInterval(() => { if (totalCredits !== undefined) saveCredits(); }, 5000);