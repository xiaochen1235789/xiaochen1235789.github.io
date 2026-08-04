import { SUPABASE_URL, SUPABASE_KEY, CONFIG, CHEST_CONFIG } from './config.js';
import { showNotification, getLocalDateString, clearProfileCache, setCachedProfile } from './utils.js';

let supabaseClient = null;

export function initSupabase() {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabaseClient;
    return supabaseClient;
}

export function getSupabase() {
    if (!supabaseClient) initSupabase();
    return supabaseClient;
}

// ========== 用户数据 ==========
export async function fetchUserFullData(userId) {
    const sb = getSupabase();
    const [profileRes, statsRes] = await Promise.all([
        sb.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
        sb.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
    ]);
    
    let profile = profileRes.data;
    if (!profile) {
        const { data: { user } } = await sb.auth.getUser();
        profile = {
            id: userId,
            username: user?.email?.split('@')[0] || '用户',
            bio: '',
            avatar_url: null,
            role: 'user',
            created_at: user?.created_at || new Date().toISOString(),
            owned_frames: ['nature'],
            equipped_frame: 'nature',
            equipped_title_id: null
        };
    }
    
    let stats = statsRes.data;
    if (!stats) {
        stats = {
            user_id: userId,
            candy_crumbles: 0,
            rainbow_lollipops: 0,
            dreamy_syrup: 0,
            active_points: 0,
            checkin_streak: 0,
            last_checkin_date: null,
            last_login: null,
            chest_count: 0,
            last_chest_grant_date: null,
            chest_pity_counter: 0
        };
    }
    return { ...profile, ...stats };
}

export async function updateUserProfile(userId, updates) {
    const sb = getSupabase();
    const { error } = await sb.from('user_profiles').update(updates).eq('id', userId);
    if (error) throw error;
    clearProfileCache();
}

export async function updateUserStats(userId, updates) {
    const sb = getSupabase();
    const { error } = await sb.from('user_stats').update(updates).eq('user_id', userId);
    if (error) throw error;
    clearProfileCache();
}

// ========== 签到 ==========
export async function getCheckinConfig(dayNum) {
    const sb = getSupabase();
    const { data, error } = await sb.from('checkin_config').select('candy, rainbow, active').eq('day_num', dayNum).maybeSingle();
    if (data) return data;
    const { data: fallback } = await sb.from('checkin_config').select('candy, rainbow, active').eq('day_num', 9999).single();
    return fallback || CONFIG.FALLBACK_CHECKIN_REWARD;
}

export async function loadAutoSignCardStatus(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_auto_sign_card').select('owned').eq('user_id', userId).maybeSingle();
    if (error && error.code !== 'PGRST116') return false;
    return data?.owned === true;
}

export async function purchaseAutoSignCard(userId, candyCost) {
    const sb = getSupabase();
    const { error: upsertError } = await sb.from('user_auto_sign_card').upsert({ user_id: userId, owned: true }, { onConflict: 'user_id' });
    if (upsertError) throw new Error(upsertError.message);
    const newCandy = (window.userStats?.candy_crumbles || 0) - candyCost;
    await sb.from('user_stats').update({ candy_crumbles: newCandy }).eq('user_id', userId);
    clearProfileCache();
    return newCandy;
}

// ========== 头像框（迁移至数据库） ==========
export async function getShopFrames() {
    const sb = getSupabase();
    const { data, error } = await sb.from('shop_frames')
        .select('*')
        .order('display_order', { ascending: true });
    if (error || !data || data.length === 0) {
        // 回退到 CONFIG.FRAMES
        return CONFIG.FRAMES.map(f => ({
            id: f.id,
            name: f.name,
            description: f.description,
            image_url: f.imageUrl,
            price_candy: f.price_candy || 0,
            price_rainbow: f.price_rainbow || 0,
            is_purchasable: !(f.id === 'frame_fox' || (f.price_candy === 0 && f.price_rainbow === 0 && f.id !== 'nature')),
            is_chest_exclusive: f.id === 'frame_fox' ? true : false,
            scale: f.scale || 1.0
        }));
    }
    return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.image_url,
        price_candy: item.price_candy,
        price_rainbow: item.price_rainbow,
        is_purchasable: item.is_purchasable,
        is_chest_exclusive: item.is_chest_exclusive,
        scale: 1.12 // 默认缩放，如需可从数据库扩展
    }));
}

export async function getFrameById(frameId) {
    const frames = await getShopFrames();
    return frames.find(f => f.id === frameId);
}

export async function loadUserFrames(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_profiles')
        .select('owned_frames, equipped_frame')
        .eq('id', userId)
        .maybeSingle();
    if (error || !data) return { owned: ['nature'], equipped: 'nature' };
    let owned = data.owned_frames || ['nature'];
    if (!owned.includes('nature')) owned.push('nature');
    let equipped = data.equipped_frame || 'nature';
    return { owned, equipped };
}

export async function ensureUserFrameFields(userId) {
    const sb = getSupabase();
    const { data: profile } = await sb.from('user_profiles')
        .select('owned_frames, equipped_frame')
        .eq('id', userId)
        .maybeSingle();
    let needUpdate = false;
    let owned = profile?.owned_frames || ['nature'];
    let equipped = profile?.equipped_frame || null;
    if (!owned.includes('nature')) { owned.push('nature'); needUpdate = true; }
    if (!equipped) { equipped = 'nature'; needUpdate = true; }
    if (needUpdate) {
        await sb.from('user_profiles').update({ owned_frames: owned, equipped_frame: equipped }).eq('id', userId);
    }
}

// ========== 称号 ==========
export async function loadAllTitles() {
    const sb = getSupabase();
    const { data, error } = await sb.from('titles').select('*');
    if (error) return [];
    return data;
}

export async function loadUserOwnedTitles(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_titles').select('title_id').eq('user_id', userId);
    if (error) return [];
    return data.map(item => item.title_id);
}

export async function grantTitle(userId, titleId) {
    const sb = getSupabase();
    const { error } = await sb.from('user_titles').insert({ user_id: userId, title_id: titleId });
    if (error) throw error;
}

// =====================================================
// ★★★ 新增：宝箱系统 API ★★★
// =====================================================

// ---- 从数据库读取价格和保底次数（安全） ----
export async function getChestPrice() {
    const sb = getSupabase();
    const { data, error } = await sb.from('system_config')
        .select('value')
        .eq('key', 'chest_price_candy')
        .maybeSingle();
    if (error || !data) {
        return CHEST_CONFIG.price_candy; // 回退到 config
    }
    return parseInt(data.value) || 100;
}

export async function getPityLimit() {
    const sb = getSupabase();
    const { data, error } = await sb.from('system_config')
        .select('value')
        .eq('key', 'chest_pity_limit')
        .maybeSingle();
    if (error || !data) {
        return CHEST_CONFIG.pity_limit;
    }
    return parseInt(data.value) || 100;
}

// ---- 概率配置 ----
export async function getChestProbabilities() {
    const sb = getSupabase();
    const { data, error } = await sb.from('chest_probs').select('*');
    if (error || !data || data.length === 0) {
        return CHEST_CONFIG.default_probs.map(p => ({
            reward_type: p.type,
            reward_extra: p.extra,
            weight: p.weight,
            is_limited: p.is_limited,
            description: p.desc
        }));
    }
    return data;
}

// ---- 宝箱数量 ----
export async function getChestCount(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_stats')
        .select('chest_count, last_chest_grant_date, chest_pity_counter')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data || { chest_count: 0, last_chest_grant_date: null, chest_pity_counter: 0 };
}

export async function updateChestCount(userId, delta) {
    const sb = getSupabase();
    const current = await getChestCount(userId);
    const newCount = (current.chest_count || 0) + delta;
    const { error } = await sb.from('user_stats')
        .update({ chest_count: newCount })
        .eq('user_id', userId);
    if (error) throw error;
    return newCount;
}

// ---- 每日赠送 ----
export async function grantDailyChest(userId) {
    const sb = getSupabase();
    const today = getLocalDateString();
    const { data, error } = await sb.from('user_stats')
        .select('chest_count, last_chest_grant_date')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (data?.last_chest_grant_date === today) return false;
    const newCount = (data?.chest_count || 0) + 1;
    const { error: updateErr } = await sb.from('user_stats')
        .update({ chest_count: newCount, last_chest_grant_date: today })
        .eq('user_id', userId);
    if (updateErr) throw updateErr;
    return true;
}

// ---- 商店购买（价格从数据库读取） ----
export async function purchaseChests(userId, amount, stats) {
    const sb = getSupabase();
    const price = await getChestPrice();
    const totalCost = price * amount;
    if (stats.candy_crumbles < totalCost) {
        throw new Error(`糖果碎不足，需要 ${totalCost.toLocaleString()}`);
    }
    const newCandy = stats.candy_crumbles - totalCost;
    const newChest = (stats.chest_count || 0) + amount;
    const { error } = await sb.from('user_stats')
        .update({ candy_crumbles: newCandy, chest_count: newChest })
        .eq('user_id', userId);
    if (error) throw error;
    return { newCandy, newChest };
}

// ---- 保底计数器 ----
export async function getPityCounter(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_stats')
        .select('chest_pity_counter')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data?.chest_pity_counter || 0;
}

export async function resetPityCounter(userId) {
    const sb = getSupabase();
    await sb.from('user_stats').update({ chest_pity_counter: 0 }).eq('user_id', userId);
}

export async function incrementPityCounter(userId) {
    const sb = getSupabase();
    const current = await getPityCounter(userId);
    await sb.from('user_stats').update({ chest_pity_counter: current + 1 }).eq('user_id', userId);
    return current + 1;
}

// ---- 核心：开启单个宝箱（含小狐狸特殊转换 + 保底） ----
export async function openChest(userId, stats, onReward) {
    const sb = getSupabase();
    const probs = await getChestProbabilities();
    const pityLimit = await getPityLimit();
    let pityCounter = await getPityCounter(userId);

    let selected = null;
    let isGuaranteed = false;

    // 检查是否触发保底
    if (pityCounter >= pityLimit - 1) {
        const limited = probs.filter(p => p.is_limited);
        if (limited.length > 0) {
            selected = limited[Math.floor(Math.random() * limited.length)];
            isGuaranteed = true;
            await resetPityCounter(userId);
        }
    }

    if (!selected) {
        // 加权随机
        const totalWeight = probs.reduce((s, p) => s + p.weight, 0);
        let rand = Math.random() * totalWeight;
        for (let p of probs) {
            rand -= p.weight;
            if (rand <= 0) { selected = p; break; }
        }
        if (!selected) selected = probs[0];
        // 更新保底计数
        if (selected.is_limited) {
            await resetPityCounter(userId);
        } else {
            await incrementPityCounter(userId);
        }
    }

    // ----- 应用奖励 -----
    const type = selected.reward_type;
    const extra = selected.reward_extra;
    let updates = {};
    let rewardDesc = '';
    let rewardTypeForSummary = type; // 用于汇总

    switch (type) {
        case 'candy': {
            const amount = parseInt(extra) || 1000;
            updates.candy_crumbles = (stats.candy_crumbles || 0) + amount;
            rewardDesc = `🍬 +${amount.toLocaleString()} 糖果碎`;
            break;
        }
        case 'rainbow': {
            const amount = parseInt(extra) || 10;
            updates.rainbow_lollipops = (stats.rainbow_lollipops || 0) + amount;
            rewardDesc = `🌈 +${amount.toLocaleString()} 超级棒糖`;
            break;
        }
        case 'active': {
            const amount = parseInt(extra) || 100;
            updates.active_points = (stats.active_points || 0) + amount;
            rewardDesc = `⚡ +${amount.toLocaleString()} 活跃度`;
            break;
        }
        case 'frame': {
            const frameId = extra;
            const { data: profile } = await sb.from('user_profiles')
                .select('owned_frames')
                .eq('id', userId)
                .maybeSingle();
            let owned = profile?.owned_frames || ['nature'];
            if (!owned.includes(frameId)) {
                // 未拥有，正常获得
                owned.push(frameId);
                await sb.from('user_profiles').update({ owned_frames: owned }).eq('id', userId);
                const frame = await getFrameById(frameId);
                rewardDesc = `🖼️ 获得头像框「${frame?.name || frameId}」`;
                rewardTypeForSummary = `头像框「${frame?.name || frameId}」`;
            } else {
                // 已拥有，检查是否是小狐狸（特殊转换）
                if (frameId === 'frame_fox') {
                    const newSyrup = (stats.dreamy_syrup || 0) + 100;
                    updates.dreamy_syrup = newSyrup;
                    rewardDesc = `🦊 已拥有小狐狸，转化为 🌌 +100 梦幻星河糖浆`;
                    rewardTypeForSummary = '梦幻星河糖浆 +100';
                } else {
                    updates.candy_crumbles = (stats.candy_crumbles || 0) + 500;
                    rewardDesc = `🖼️ 已有头像框，转化为 +500 糖果碎`;
                    rewardTypeForSummary = '糖果碎 +500';
                }
            }
            break;
        }
        case 'title': {
            const titleId = parseInt(extra);
            const { data: titles } = await sb.from('user_titles')
                .select('title_id')
                .eq('user_id', userId)
                .eq('title_id', titleId);
            if (!titles || titles.length === 0) {
                await sb.from('user_titles').insert({ user_id: userId, title_id: titleId });
                const allTitles = await loadAllTitles();
                const titleObj = allTitles.find(t => t.id === titleId);
                rewardDesc = `🏅 获得称号「${titleObj?.name || titleId}」`;
                rewardTypeForSummary = `称号「${titleObj?.name || titleId}」`;
            } else {
                updates.rainbow_lollipops = (stats.rainbow_lollipops || 0) + 1;
                rewardDesc = `🏅 已有称号，转化为 +1 超级棒糖`;
                rewardTypeForSummary = '超级棒糖 +1';
            }
            break;
        }
        default:
            rewardDesc = '🎁 宝箱开启，但什么也没有……';
            rewardTypeForSummary = '空';
    }

    // 消耗一个宝箱
    updates.chest_count = (stats.chest_count || 0) - 1;

    const { error } = await sb.from('user_stats').update(updates).eq('user_id', userId);
    if (error) throw error;

    const newStats = { ...stats, ...updates };
    if (onReward) onReward(rewardDesc, newStats, isGuaranteed);
    return { 
        rewardDesc, 
        newStats, 
        isGuaranteed,
        summary: rewardTypeForSummary
    };
}

// ---- 批量开启 ----
export async function batchOpenChests(userId, amount) {
    const sb = getSupabase();
    const { data: stats, error } = await sb.from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!stats || stats.chest_count < amount) throw new Error('宝箱数量不足');

    let currentStats = { ...stats };
    const results = [];

    for (let i = 0; i < amount; i++) {
        const result = await openChest(userId, currentStats, null);
        currentStats = result.newStats;
        results.push({
            type: result.summary || result.rewardDesc,
            isGuaranteed: result.isGuaranteed
        });
    }

    // 重新获取最终数据（确保一致性）
    const { data: finalStats } = await sb.from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
    return { results, newStats: finalStats };
}