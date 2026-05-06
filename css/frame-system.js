/**
 * frame-system.js
 * 头像框系统：样式注入 + 购买/装备逻辑，支持每个用户每框限购一次
 * 依赖：Supabase客户端已全局可用 (window.supabaseClient)
 * 依赖：用户会话 (window.currentUser)
 */
(function() {
    // ========== 1. 动态注入头像框样式 ==========
    const styleContent = `
        /* 移除浮动动画，固定头像位置 */
        .avatar-container {
            animation: none !important;
        }
        /* 基础头像样式（保留原始阴影） */
        .avatar {
            transition: all 0.3s ease;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        /* 头像框定义 */
        .avatar.frame-nature {
            box-shadow: 0 0 0 4px #81c784,
                        0 0 0 8px rgba(129, 199, 132, 0.3),
                        0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .avatar.frame-gold {
            box-shadow: 0 0 0 4px #fbbf24,
                        0 0 0 10px rgba(251, 191, 36, 0.5),
                        0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .avatar.frame-gold:hover {
            box-shadow: 0 0 0 6px #ffd966,
                        0 0 0 14px rgba(255, 217, 102, 0.6),
                        0 12px 40px rgba(0, 0, 0, 0.4);
        }
        .avatar.frame-ice {
            box-shadow: 0 0 0 4px #60a5fa,
                        0 0 0 10px rgba(96, 165, 250, 0.4),
                        0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .avatar.frame-ice:hover {
            box-shadow: 0 0 0 6px #93c5fd,
                        0 0 0 14px rgba(147, 197, 253, 0.5),
                        0 12px 40px rgba(0, 0, 0, 0.4);
        }
        .avatar.frame-shadow {
            box-shadow: 0 0 0 4px #a855f7,
                        0 0 0 10px rgba(168, 85, 247, 0.4),
                        0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .avatar.frame-shadow:hover {
            box-shadow: 0 0 0 6px #c084fc,
                        0 0 0 14px rgba(192, 132, 252, 0.5),
                        0 12px 40px rgba(0, 0, 0, 0.4);
        }
        .avatar.frame-fire {
            box-shadow: 0 0 0 4px #ef4444,
                        0 0 0 10px rgba(239, 68, 68, 0.4),
                        0 8px 32px rgba(0, 0, 0, 0.3);
        }
        .avatar.frame-fire:hover {
            box-shadow: 0 0 0 6px #f87171,
                        0 0 0 14px rgba(248, 113, 113, 0.5),
                        0 12px 40px rgba(0, 0, 0, 0.4);
        }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.textContent = styleContent;
    document.head.appendChild(styleSheet);

    // ========== 2. 头像框配置列表 ==========
    const FRAMES = [
        { id: 'nature', name: '翠绿自然', price_candy: 0, price_rainbow: 0, description: '默认自然框', cssClass: 'frame-nature' },
        { id: 'gold',   name: '金色传说', price_candy: 200, price_rainbow: 2, description: '闪耀的金色边框', cssClass: 'frame-gold' },
        { id: 'ice',    name: '冰蓝星辰', price_candy: 150, price_rainbow: 1, description: '冰霜星辰环绕', cssClass: 'frame-ice' },
        { id: 'shadow', name: '暗影紫罗兰', price_candy: 180, price_rainbow: 1, description: '神秘暗影之力', cssClass: 'frame-shadow' },
        { id: 'fire',   name: '烈焰之心', price_candy: 220, price_rainbow: 3, description: '炽热火焰之环', cssClass: 'frame-fire' }
    ];

    // 辅助函数
    function getFrameById(id) {
        return FRAMES.find(f => f.id === id) || FRAMES[0];
    }

    // 应用头像框样式到 .avatar 元素
    function applyFrameClass(frameId) {
        const avatarDiv = document.querySelector('.avatar');
        if (!avatarDiv) return;
        // 移除所有 frame-xxx 类
        const classesToRemove = Array.from(avatarDiv.classList).filter(c => c.startsWith('frame-'));
        classesToRemove.forEach(c => avatarDiv.classList.remove(c));
        // 添加新类
        const frame = getFrameById(frameId);
        if (frame && frame.cssClass) {
            avatarDiv.classList.add(frame.cssClass);
        }
    }

    // ========== 3. 数据库操作（需全局 supabaseClient 和 currentUser） ==========
    async function ensureUserFrameFields(userId) {
        // 确保 user_profiles 表有 owned_frames 和 equipped_frame 字段（首次访问时初始化）
        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .select('owned_frames, equipped_frame')
            .eq('id', userId)
            .single();
        if (error && error.code === 'PGRST116') {
            // 记录不存在，稍后会在 loadUserProfile 中创建，这里忽略
            return;
        }
        if (!error && (data.owned_frames === null || data.owned_frames === undefined)) {
            // 初始化字段
            await window.supabaseClient
                .from('user_profiles')
                .update({ owned_frames: ['nature'], equipped_frame: 'nature' })
                .eq('id', userId);
        }
    }

    // 加载用户拥有的头像框列表和当前装备的框
    async function loadUserFrames(userId) {
        const { data, error } = await window.supabaseClient
            .from('user_profiles')
            .select('owned_frames, equipped_frame')
            .eq('id', userId)
            .single();
        if (error) {
            console.warn('加载头像框数据失败', error);
            return { owned: ['nature'], equipped: 'nature' };
        }
        const owned = data.owned_frames || ['nature'];
        const equipped = data.equipped_frame || 'nature';
        return { owned, equipped };
    }

    // 装备头像框（切换）
    async function equipFrame(frameId) {
        if (!window.currentUser) throw new Error('未登录');
        const userId = window.currentUser.id;
        // 先检查是否拥有
        const { owned } = await loadUserFrames(userId);
        if (!owned.includes(frameId)) {
            throw new Error('您尚未拥有该头像框，无法装备');
        }
        const { error } = await window.supabaseClient
            .from('user_profiles')
            .update({ equipped_frame: frameId })
            .eq('id', userId);
        if (error) throw error;
        applyFrameClass(frameId);
        // 可选：通知刷新页面其他部分
        if (window.onFrameEquipped) window.onFrameEquipped(frameId);
        return true;
    }

    // 购买头像框（扣币+添加到 owned_frames）
    async function purchaseFrame(frameId, currentStats, updateStatsCallback) {
        if (!window.currentUser) throw new Error('未登录');
        const userId = window.currentUser.id;
        const frame = getFrameById(frameId);
        if (!frame) throw new Error('头像框不存在');
        // 检查是否已拥有
        const { owned } = await loadUserFrames(userId);
        if (owned.includes(frameId)) {
            throw new Error('您已经拥有该头像框，不能重复购买');
        }
        // 检查货币
        if (frame.price_candy > 0 && currentStats.candy_crumbles < frame.price_candy) {
            throw new Error(`糖果碎不足，需要 ${frame.price_candy} 个`);
        }
        if (frame.price_rainbow > 0 && currentStats.rainbow_lollipops < frame.price_rainbow) {
            throw new Error(`超级棒糖不足，需要 ${frame.price_rainbow} 个`);
        }
        // 执行事务：先扣币，再添加 owned_frames
        const newCandy = currentStats.candy_crumbles - frame.price_candy;
        const newRainbow = currentStats.rainbow_lollipops - frame.price_rainbow;
        // 更新 user_stats
        const { error: statsError } = await window.supabaseClient
            .from('user_stats')
            .update({ candy_crumbles: newCandy, rainbow_lollipops: newRainbow })
            .eq('user_id', userId);
        if (statsError) throw statsError;
        // 更新 user_profiles.owned_frames
        const newOwned = [...owned, frameId];
        const { error: profileError } = await window.supabaseClient
            .from('user_profiles')
            .update({ owned_frames: newOwned })
            .eq('id', userId);
        if (profileError) throw profileError;
        // 更新本地状态
        if (updateStatsCallback) {
            updateStatsCallback(newCandy, newRainbow);
        }
        // 自动装备新购买的框（可选）
        await equipFrame(frameId);
        return true;
    }

    // 对外暴露的 API
    window.FrameSystem = {
        FRAMES,
        getFrameById,
        loadUserFrames,
        equipFrame,
        purchaseFrame,
        applyFrameClass,   // 用于手动刷新
        ensureUserFrameFields
    };

    // 4. 自动初始化：当页面加载且用户登录后，加载装备的头像框并应用
    async function autoInit() {
        // 等待 supabaseClient 和 currentUser 准备好（由主页脚本设置）
        let retries = 0;
        while (!window.supabaseClient || !window.currentUser) {
            if (retries > 30) return; // 3秒超时
            await new Promise(r => setTimeout(r, 100));
            retries++;
        }
        try {
            await ensureUserFrameFields(window.currentUser.id);
            const { equipped } = await loadUserFrames(window.currentUser.id);
            applyFrameClass(equipped);
        } catch (err) {
            console.warn('头像框自动初始化失败', err);
        }
    }
    // 等待 DOM 加载完成后再执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
})();