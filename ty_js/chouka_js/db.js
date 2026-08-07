// ================================================================
//  js/db.js  -  适配现有 Supabase 表结构（支持多池子）
//  表：user_resources, user_gacha_state, user_constellations,
//      gacha_history, gacha_config, gacha_banners, gacha_four_star,
//      gacha_permanent_five, gacha_three_star
// ================================================================

import { SUPABASE_URL, SUPABASE_KEY, CACHE_TTL } from './constants.js';
import { state, applyDatabaseConfig, selectBanner } from './state.js';

let supabaseClient = null;

export function getSupabase() {
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabaseClient = supabaseClient;
    }
    return supabaseClient;
}

function getCached(key) {
    const item = localStorage.getItem(key);
    if (!item) return null;
    try {
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch { return null; }
}

function setCached(key, data) {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

// ================================================================
//  主加载函数
// ================================================================
export async function loadUserData(userId) {
    const sb = getSupabase();

    // ---- 并行加载所有数据 ----
    const [
        resourcesRes,
        gachaStateRes,
        historyRes,
        constellationsRes,
        configRes,
        bannerRes,          // 多个池子
        profileRes,
        fourStarRes,
        permanentFiveRes,
        threeStarRes
    ] = await Promise.all([
        sb.from('user_resources').select('*').eq('user_id', userId).maybeSingle(),
        sb.from('user_gacha_state').select('*').eq('user_id', userId).maybeSingle(),
        sb.from('gacha_history').select('item_name, star_level').eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(2000),
        sb.from('user_constellations').select('character_name, constellation_level, star_level').eq('user_id', userId),
        sb.from('gacha_config').select('*').single(),
        sb.from('gacha_banners').select('*')
            .lte('start_time', new Date().toISOString())
            .gte('end_time', new Date().toISOString())
            .order('display_order', { ascending: true }),   // ★ 查询所有开放池子
        sb.from('user_profiles').select('user_number').eq('id', userId).maybeSingle(),
        sb.from('gacha_four_star').select('character_name'),
        sb.from('gacha_permanent_five').select('character_name'),
        sb.from('gacha_three_star').select('item_name')
    ]);

    // ---- 资源 ----
    if (resourcesRes.data) {
        state.starJade = resourcesRes.data.star_jade || 0;
        state.tickets = resourcesRes.data.tickets || 0;
    } else {
        await sb.from('user_resources').insert({ user_id: userId, star_jade: 1599840, tickets: 100 });
        state.starJade = 1599840;
        state.tickets = 100;
    }

    // ---- 保底状态 ----
    if (gachaStateRes.data) {
        state.fiveStarPity = gachaStateRes.data.five_star_pity || 0;
        state.fourStarPity = gachaStateRes.data.four_star_pity || 0;
        state.guaranteedUp = gachaStateRes.data.guaranteed_up || false;
    } else {
        await sb.from('user_gacha_state').insert({
            user_id: userId,
            five_star_pity: 0,
            four_star_pity: 0,
            guaranteed_up: false
        });
        state.fiveStarPity = 0;
        state.fourStarPity = 0;
        state.guaranteedUp = false;
    }

    // ---- ★ 四星角色列表 ----
    state.fourStarChars = (fourStarRes.data || []).map(row => row.character_name);

    // ---- ★ 三星物品列表 ----
    state.threeStarItems = (threeStarRes.data || []).map(row => row.item_name);

    // ---- 常驻五星列表 ----
    state.permanentFiveStar = (permanentFiveRes.data || []).map(row => row.character_name);

    // ---- ★★★ 处理卡池列表 ★★★ ----
    const bannerData = bannerRes.data || [];
    state.bannerList = bannerData;

    if (bannerData.length > 0) {
        // 自动选中第一个池子（或按 display_order 最小的）
        selectBanner(0);  // 调用 state.js 中的 selectBanner
    } else {
        state.bannerList = [];
        state.currentBanner = null;
        state.upFiveStarList = [];
        state.selectedBannerIndex = -1;
        // 如果没有池子，显示无卡池状态
        state.bannerStart = null;
        state.bannerEnd = null;
    }

    // ---- 概率配置 ----
    if (configRes.data) {
        applyDatabaseConfig(configRes.data);
    }

    // ---- ★ 加载库存（自动判断星级） ----
    state.inventory.clear();
    if (constellationsRes.data) {
        for (const row of constellationsRes.data) {
            let star = row.star_level;
            if (star === null || star === undefined) {
                star = state.fourStarChars.includes(row.character_name) ? 4 : 5;
            }
            const key = `character_${row.character_name}`;
            state.inventory.set(key, {
                level: row.constellation_level || 0,
                star: star,
                type: 'character'
            });
        }
    }

    // ---- 历史记录 ----
    state.gachaHistory = (historyRes.data || []).map(h => ({
        name: h.item_name,
        star: h.star_level,
        type: 'character'
    }));

    // ---- 用户编号 ----
    if (profileRes.data) {
        state.userNumber = profileRes.data.user_number;
    }

    // ---- 重算统计 ----
    recalculateStats();

    // ---- 缓存 ----
    setCached('userData_' + userId, {
        userNumber: state.userNumber,
        starJade: state.starJade,
        tickets: state.tickets,
        fiveStarPity: state.fiveStarPity,
        fourStarPity: state.fourStarPity,
        guaranteedUp: state.guaranteedUp,
        inventory: Array.from(state.inventory.entries()),
        gachaHistory: state.gachaHistory,
        totalPulls: state.totalPulls,
        fiveStarCount: state.fiveStarCount,
        upFiveStarCount: state.upFiveStarCount
    });
}

// ================================================================
//  重算统计数据
// ================================================================
function recalculateStats() {
    state.totalPulls = 0;
    state.fiveStarCount = 0;
    state.fourStarCount = 0;
    state.threeStarCount = 0;
    state.upFiveStarCount = 0;
    state.fiveStarDistances = [];
    state.lastFiveStarPullIndex = 0;

    const reversed = [...state.gachaHistory].reverse();
    const upList = state.upFiveStarList || [];

    for (const record of reversed) {
        state.totalPulls++;
        if (record.star === 5) {
            state.fiveStarCount++;
            if (state.lastFiveStarPullIndex !== 0) {
                const dist = state.totalPulls - state.lastFiveStarPullIndex;
                state.fiveStarDistances.push(Math.min(dist, state.pity5Max));
            }
            state.lastFiveStarPullIndex = state.totalPulls;
            if (upList.includes(record.name)) {
                state.upFiveStarCount++;
            }
        } else if (record.star === 4) {
            state.fourStarCount++;
        } else {
            state.threeStarCount++;
        }
    }
}

// ================================================================
//  保存通用库存到 user_constellations
// ================================================================
export async function saveInventory(userId) {
    const sb = getSupabase();
    const items = [];

    for (const [key, value] of state.inventory) {
        if (value.type !== 'character') continue;
        const charName = key.substring('character_'.length);
        items.push({
            user_id: userId,
            character_name: charName,
            constellation_level: value.level,
            star_level: value.star,
            updated_at: new Date().toISOString()
        });
    }

    if (items.length === 0) return;

    const { error } = await sb.from('user_constellations')
        .upsert(items, { onConflict: 'user_id, character_name' });

    if (error) throw new Error('保存库存失败: ' + error.message);
}

// ================================================================
//  保存抽卡历史
// ================================================================
export async function saveBatchGachaResults(userId, results) {
    const sb = getSupabase();
    const inserts = results.map(r => ({
        user_id: userId,
        item_name: r.name,
        star_level: r.star,
        created_at: new Date().toISOString()
    }));
    const { error } = await sb.from('gacha_history').insert(inserts);
    if (error) throw error;
}

// ================================================================
//  保存资源与保底
// ================================================================
export async function saveResourcesAndPity(userId) {
    const sb = getSupabase();

    await sb.from('user_resources').upsert({
        user_id: userId,
        star_jade: state.starJade,
        tickets: state.tickets,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    await sb.from('user_gacha_state').upsert({
        user_id: userId,
        five_star_pity: state.fiveStarPity,
        four_star_pity: state.fourStarPity,
        guaranteed_up: state.guaranteedUp,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
}

// ================================================================
//  一次性保存所有数据（抽卡后调用）
// ================================================================
export async function saveAllAfterDraw(userId, results) {
    await Promise.all([
        saveResourcesAndPity(userId),
        saveInventory(userId),
        results && results.length > 0 ? saveBatchGachaResults(userId, results) : Promise.resolve()
    ]);
}

// ================================================================
//  重置所有抽卡数据
// ================================================================
export async function resetAllGachaData(userId) {
    const sb = getSupabase();
    await Promise.all([
        sb.from('gacha_history').delete().eq('user_id', userId),
        sb.from('user_constellations').delete().eq('user_id', userId),
        sb.from('user_gacha_state').update({
            five_star_pity: 0,
            four_star_pity: 0,
            guaranteed_up: false
        }).eq('user_id', userId),
        sb.from('user_resources').update({ star_jade: 1599840, tickets: 100 }).eq('user_id', userId)
    ]);
}

// ================================================================
//  获取卡池立绘
// ================================================================
export function getBannerSplashUrl(banner) {
    return banner?.splash_url || 'https://xiaochen1235789.github.io/images/changjinglu.webp';
}