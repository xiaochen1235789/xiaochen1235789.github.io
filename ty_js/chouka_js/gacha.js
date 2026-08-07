// ================================================================
//  js/gacha.js  -  通用抽卡核心引擎
//  支持：角色池、光锥池、复刻池（多UP）
// ================================================================

import { state, addItemToInventory } from './state.js';
import {
    saveAllAfterDraw,
    saveGachaResult,
    loadUserData
} from './db.js';
import { ITEM_TYPES } from './constants.js';

// ================================================================
//  计算当前五星概率（含软保底）
// ================================================================
export function getCurrentFiveStarRate() {
    const pity = state.fiveStarPity;
    const maxPity = state.pity5Max;
    const softStart = state.softPityStart;

    // 硬保底：90抽必出
    if (pity >= maxPity - 1) return 1.0;

    // 软保底区：74抽后概率递增
    if (pity < softStart) {
        return 0.006; // 基础0.6%
    }

    const step = pity - (softStart - 1);
    const maxStep = maxPity - softStart;
    return Math.min(0.006 + (1.0 - 0.006) * (step / maxStep), 1.0);
}

// ================================================================
//  四星判定
// ================================================================
function isFourStar() {
    if (state.fourStarPity >= state.pity4Max - 1) return true;
    return Math.random() < state.baseRate4;
}

// ================================================================
//  选择五星结果（支持多UP列表）
// ================================================================
function selectFiveStarResult() {
    const upList = state.upFiveStarList || [];
    const permanentList = state.permanentFiveStar || [];

    let selected;

    if (state.guaranteedUp) {
        // 大保底：必出UP（从UP列表中随机选一个）
        if (upList.length === 0) {
            // 容错：如果没有UP列表，从常驻池选
            selected = permanentList[Math.floor(Math.random() * permanentList.length)];
        } else {
            selected = upList[Math.floor(Math.random() * upList.length)];
        }
        state.guaranteedUp = false;
        return selected;
    }

    // 小保底：50%概率UP
    if (Math.random() < 0.5) {
        // 中了UP
        if (upList.length === 0) {
            selected = permanentList[Math.floor(Math.random() * permanentList.length)];
        } else {
            selected = upList[Math.floor(Math.random() * upList.length)];
        }
    } else {
        // 歪了
        if (permanentList.length === 0) {
            selected = upList[Math.floor(Math.random() * upList.length)];
        } else {
            selected = permanentList[Math.floor(Math.random() * permanentList.length)];
        }
        state.guaranteedUp = true; // 下次大保底
    }

    return selected;
}

// ================================================================
//  选择四星结果
// ================================================================
function selectFourStarResult() {
    const pool = state.fourStarChars || [];
    if (pool.length === 0) return '四星角色';
    return pool[Math.floor(Math.random() * pool.length)];
}

// ================================================================
//  选择三星结果
// ================================================================
function selectThreeStarResult() {
    const pool = state.threeStarItems || [];
    if (pool.length === 0) return '三星物品';
    return pool[Math.floor(Math.random() * pool.length)];
}

// ================================================================
//  核心函数：执行单次抽卡
// ================================================================
export async function performSingleDraw(itemType = ITEM_TYPES.CHARACTER) {
    let resultName, resultStar;

    // ---- 判定五星 ----
    const fiveStarRate = getCurrentFiveStarRate();
    const isFiveStar = Math.random() < fiveStarRate;

    if (isFiveStar) {
        resultName = selectFiveStarResult();
        resultStar = 5;
        state.fiveStarPity = 0;
        state.fourStarPity = 0;
    } else {
        // ---- 判定四星 ----
        if (isFourStar()) {
            resultName = selectFourStarResult();
            resultStar = 4;
            state.fourStarPity = 0;
            state.fiveStarPity++;
        } else {
            // ---- 三星 ----
            resultName = selectThreeStarResult();
            resultStar = 3;
            state.fourStarPity++;
            state.fiveStarPity++;
        }
    }

    // ---- ★★★ 调用通用物品处理（命座/精炼/溢出补偿） ★★★ ----
    let constellationMsg = null;
    if (resultStar >= 4) {
        const result = addItemToInventory(itemType, resultName, resultStar);
        if (result.action === 'first') {
            constellationMsg = '首次获得';
        } else if (result.action === 'upgrade') {
            const rule = getItemRule(itemType);
            constellationMsg = `${rule?.levelLabel || '等级'} ${result.newLevel}`;
        } else if (result.action === 'overflow') {
            constellationMsg = `满级转化 +${result.compensation} 星琼`;
        }
    }

    // ---- 更新历史 ----
    state.gachaHistory.unshift({
        name: resultName,
        star: resultStar,
        type: itemType
    });

    // 限制历史记录数量
    if (state.gachaHistory.length > 2000) {
        state.gachaHistory.pop();
    }

    // ---- 更新统计数据 ----
    state.totalPulls++;
    if (resultStar === 5) {
        state.fiveStarCount++;
        const upList = state.upFiveStarList || [];
        if (upList.includes(resultName)) {
            state.upFiveStarCount++;
        }
        if (state.lastFiveStarPullIndex !== 0) {
            const dist = state.totalPulls - state.lastFiveStarPullIndex;
            state.fiveStarDistances.push(Math.min(dist, state.pity5Max));
        }
        state.lastFiveStarPullIndex = state.totalPulls;
    } else if (resultStar === 4) {
        state.fourStarCount++;
    } else {
        state.threeStarCount++;
    }

    // ---- 扣减专票 ----
    state.tickets--;

    return {
        name: resultName,
        star: resultStar,
        type: itemType,
        constellationMsg: constellationMsg
    };
}

// ================================================================
//  单抽（含自动补票逻辑）
// ================================================================
export async function singlePull() {
    if (state.isDrawing) {
        showNotification('抽卡进行中...', 'warning');
        return null;
    }

    if (!state.user) {
        showNotification('请先登录', 'error');
        return null;
    }

    // 检查是否有票
    if (state.tickets < 1) {
        // 尝试用星琼兑换
        const cost = state.exchangeRate;
        if (state.starJade >= cost) {
            state.starJade -= cost;
            state.tickets += 1;
            showNotification(`兑换了 1 张星轨专票`, 'info');
        } else {
            showNotification(`星轨专票不足，需要 ${cost} 星琼兑换`, 'error');
            return null;
        }
    }

    state.isDrawing = true;

    try {
        // 获取当前卡池类型
        const itemType = state.bannerType || ITEM_TYPES.CHARACTER;

        // 执行抽卡
        const result = await performSingleDraw(itemType);

        // 保存到数据库
        await saveAllAfterDraw(state.user.id, [result]);

        // 刷新用户数据（确保同步）
        await loadUserData(state.user.id);

        return result;
    } catch (error) {
        console.error('抽卡失败:', error);
        showNotification('抽卡失败: ' + error.message, 'error');
        return null;
    } finally {
        state.isDrawing = false;
    }
}

// ================================================================
//  十连抽
// ================================================================
export async function tenPull() {
    if (state.isDrawing) {
        showNotification('抽卡进行中...', 'warning');
        return null;
    }

    if (!state.user) {
        showNotification('请先登录', 'error');
        return null;
    }

    // 检查是否有10张票
    if (state.tickets < 10) {
        const need = 10 - state.tickets;
        const cost = need * state.exchangeRate;
        if (state.starJade >= cost) {
            state.starJade -= cost;
            state.tickets += need;
            showNotification(`兑换了 ${need} 张星轨专票`, 'info');
        } else {
            showNotification(`星轨专票不足，需要 ${cost} 星琼兑换`, 'error');
            return null;
        }
    }

    state.isDrawing = true;

    try {
        const itemType = state.bannerType || ITEM_TYPES.CHARACTER;
        const results = [];

        // 执行10次抽卡
        for (let i = 0; i < 10; i++) {
            if (state.tickets < 1) break;
            const result = await performSingleDraw(itemType);
            results.push(result);
            // 微延迟，避免界面卡顿
            await new Promise(r => setTimeout(r, 30));
        }

        // 保存到数据库
        await saveAllAfterDraw(state.user.id, results);

        // 刷新用户数据
        await loadUserData(state.user.id);

        return results;
    } catch (error) {
        console.error('十连失败:', error);
        showNotification('十连失败: ' + error.message, 'error');
        return null;
    } finally {
        state.isDrawing = false;
    }
}

// ================================================================
//  辅助：根据星级获取颜色
// ================================================================
export function getStarColor(star) {
    if (star === 5) return '#ffb347';
    if (star === 4) return '#c084fc';
    return '#5f7f9e';
}

// ================================================================
//  辅助：获取物品类型的显示名称
// ================================================================
export function getItemTypeDisplay(itemType) {
    const map = {
        'character': '角色',
        'light_cone': '光锥',
    };
    return map[itemType] || itemType;
}

// ================================================================
//  导入辅助（解决循环依赖）
// ================================================================
import { getItemRule } from './state.js';
import { showNotification } from './ui.js';

// 如果 ui.js 还没创建，先用 console 代替
if (typeof showNotification === 'undefined') {
    window.showNotification = function(msg, type) {
        console.log(`[${type}] ${msg}`);
    };
}