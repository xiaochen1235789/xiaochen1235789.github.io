// ========== 配置中心 ==========
export const SUPABASE_URL = 'https://ysmijycsyzpjoieaknmb.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbWlqeWNzeXpwam9pZWFrbm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNDgzNjMsImV4cCI6MjA4MjgyNDM2M30.H7dx2k_0099LVXprMrghHOFh16OoSSgtCUOib2otHPA';

export const CONFIG = {
    AUTO_CARD_PRICE: 100,
    AVATAR_SIZE: 500,
    LONG_PRESS_DELAY: 500,
    CACHE_TTL: 3600000,
    
    ROLE_MAP: {
        owner: { name: '站长', color: '#f97316' },
        admin: { name: '管理员', color: '#60a5fa' },
        user: { name: '用户', color: '#9ca3af' }
    },
    
    FRAMES: [
        { 
            id: 'nature', 
            name: '默认', 
            description: '默认静态头像框', 
            price_candy: 0, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_putong.webp',
            scale: 1.0
        },
        { 
            id: 'frame_huanbao', 
            name: '环保光环', 
            description: '绿色环保主题静态头像框；素材来源于网络', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_huanbao.webp',
            scale: 1.12
        },
        { 
            id: 'frame_fox', 
            name: '悠闲小狐狸', 
            description: '悠闲自在的小狐狸动态头像框；素材来源于网络', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_fox.webp',
            scale: 1.12
        },
        { 
            id: 'frame_soak', 
            name: '冰蓝泡泡', 
            description: '泡泡包裹的静态头像框；素材来源于网络', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_soak.webp',
            scale: 1.24
        },
        { 
            id: 'frame_grass', 
            name: '幸运四叶草', 
            description: '象征好运的四叶草静态头像框；素材来源于网络', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_grass.webp',
            scale: 1.54
        }
    ],
    
    BACKPACK_ITEMS: [
        { id: 'candy', name: '🍬 糖果碎', desc: '基础货币，可用于购买头像框、自动签到卡等道具。', icon: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Crushed_sugar.webp', isImg: true, type: 'currency' },
        { id: 'rainbow', name: '🌈 超级棒糖', desc: '中级稀有货币，可用于兑换高级物品。', icon: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Super_Sweet.webp', isImg: true, type: 'currency' },
        { id: 'dreamy_syrup', name: '🌌 梦幻星河糖浆', desc: '终极顶级货币！甜梦镇的最高信仰。', icon: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Dream_galaxy_syrup.webp', isImg: true, type: 'currency' },
        { id: 'autocard', name: '📅 自动签到卡', desc: '永久有效，每天上午8点自动签到（北京时间）。', icon: 'fa-calendar-check', isImg: false, type: 'card' }
    ],
    
    FALLBACK_CHECKIN_REWARD: { candy: 8000, rainbow: 150, active: 20 }
};

// 特殊身份显示
export function getRoleDisplay(role, userId) {
    if (userId === '2e617135-daa2-4619-a7df-dacd425da881') {
        return { name: '是主人喵(>^ω^<)', color: '#FF69B4' };
    }
    if (userId === '7a2b1551-3c9a-4ee1-a310-f3f47c5a59a0') {
        return { name: '是言哥哥(｡>∀<｡)', color: '#FF69B4' };
    }
    return CONFIG.ROLE_MAP[role] || CONFIG.ROLE_MAP.user;
}

// 特殊称号映射
export const SPECIAL_TITLES = {
    '2e617135-daa2-4619-a7df-dacd425da881': 10001,
    '7a2b1551-3c9a-4ee1-a310-f3f47c5a59a0': 10002
};