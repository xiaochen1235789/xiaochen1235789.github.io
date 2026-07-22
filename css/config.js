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
        user: { name: '普通用户', color: '#9ca3af' }
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
            description: '绿色环保主题静态头像框；来源于网络', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_huanbao.webp',
            scale: 1.18
        },
        { 
            id: 'frame_fox', 
            name: '悠闲小狐狸', 
            description: '悠闲自在的小狐狸动态头像框；来源于网络', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_fox.webp',
            scale: 1.0
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

export function getRoleDisplay(role) {
    return CONFIG.ROLE_MAP[role] || CONFIG.ROLE_MAP.user;
}