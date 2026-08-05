// ========== 配置中心（管理后台专用版，图片链接集中管理） ==========

// Supabase 连接信息
export const SUPABASE_URL = 'https://ysmijycsyzpjoieaknmb.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbWlqeWNzeXpwam9pZWFrbm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNDgzNjMsImV4cCI6MjA4MjgyNDM2M30.H7dx2k_0099LVXprMrghHOFh16OoSSgtCUOib2otHPA';

// ★★★ 站长 ID ★★★
export const OWNER_ID = '2e617135-daa2-4619-a7df-dacd425da881';

// ========== ★★★ 所有固定图片 URL 集中管理 ★★★ ==========
export const IMAGES = {
    // 网站图标
    FAVICON: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/icon.png',
    
    // 道具图标（糖果碎、超级棒糖、星河糖浆）
    CANDY_ICON: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Crushed_sugar.webp',
    RAINBOW_ICON: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Super_Sweet.webp',
    SYRUP_ICON: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/props/Dream_galaxy_syrup.webp',
    
    // 头像框（所有头像框图片）
    FRAME_NATURE: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_putong.webp',
    FRAME_HUANBAO: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_huanbao.webp',
    FRAME_FOX: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_fox.webp',
    FRAME_SOAK: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_soak.webp',
    FRAME_GRASS: 'https://ysmijycsyzpjoieaknmb.supabase.co/storage/v1/object/public/items/profile_picture_frame/frame_grass.webp',
};

// ========== 通用配置 ==========
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
    
    // ★★★ 头像框列表（图片引用自 IMAGES） ★★★
    FRAMES: [
        { 
            id: 'nature', 
            name: '默认', 
            description: '默认静态头像框', 
            price_candy: 0, 
            price_rainbow: 0, 
            imageUrl: IMAGES.FRAME_NATURE,
            scale: 1.0
        },
        { 
            id: 'frame_huanbao', 
            name: '环保光环', 
            description: '绿色环保主题静态头像框', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: IMAGES.FRAME_HUANBAO,
            scale: 1.12
        },
        { 
            id: 'frame_fox', 
            name: '悠闲小狐狸', 
            description: '悠闲自在的小狐狸动态头像框', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: IMAGES.FRAME_FOX,
            scale: 1.12
        },
        { 
            id: 'frame_soak', 
            name: '冰蓝泡泡', 
            description: '泡泡包裹的静态头像框', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: IMAGES.FRAME_SOAK,
            scale: 1.24
        },
        { 
            id: 'frame_grass', 
            name: '幸运四叶草', 
            description: '象征好运的四叶草静态头像框', 
            price_candy: 1, 
            price_rainbow: 0, 
            imageUrl: IMAGES.FRAME_GRASS,
            scale: 1.54
        }
    ],
    
    // ★★★ 背包物品（图标引用自 IMAGES） ★★★
    BACKPACK_ITEMS: [
        { 
            id: 'candy', 
            name: '🍬 糖果碎', 
            desc: '基础货币，可用于购买头像框、自动签到卡等道具。', 
            icon: IMAGES.CANDY_ICON, 
            isImg: true, 
            type: 'currency' 
        },
        { 
            id: 'rainbow', 
            name: '🌈 超级棒糖', 
            desc: '中级稀有货币，可用于兑换高级物品。', 
            icon: IMAGES.RAINBOW_ICON, 
            isImg: true, 
            type: 'currency' 
        },
        { 
            id: 'dreamy_syrup', 
            name: '🌌 梦幻星河糖浆', 
            desc: '终极顶级货币！甜梦镇的最高信仰。', 
            icon: IMAGES.SYRUP_ICON, 
            isImg: true, 
            type: 'currency' 
        },
        { 
            id: 'autocard', 
            name: '📅 自动签到卡', 
            desc: '永久有效，每天上午8点自动签到（北京时间）。', 
            icon: 'fa-calendar-check', 
            isImg: false, 
            type: 'card' 
        }
    ],
    
    FALLBACK_CHECKIN_REWARD: { candy: 8000, rainbow: 150, active: 20 }
};

// ========== 特殊身份显示 ==========
export function getRoleDisplay(role, userId) {
    if (userId === OWNER_ID) {
        return { name: '是主人喵(>^ω^<)', color: '#FF69B4' };
    }
    if (userId === '7a2b1551-3c9a-4ee1-a310-f3f47c5a59a0') {
        return { name: '是言哥哥(｡>∀<｡)', color: '#FF69B4' };
    }
    return CONFIG.ROLE_MAP[role] || CONFIG.ROLE_MAP.user;
}

// ========== ★★★ 管理后台专用：数据表字段定义（动态表单） ★★★ ==========
export const TABLE_SCHEMA = {
    characters: { fields: [
        { name: 'name', label: '角色名', type: 'text', required: true },
        { name: 'description', label: '描述', type: 'text' },
        { name: 'element', label: '属性', type: 'text' },
        { name: 'path', label: '命途', type: 'text' },
        { name: 'rarity', label: '星级', type: 'number', default: 5 },
        { name: 'version', label: '版本', type: 'text' },
        { name: 'image_url', label: '图片URL', type: 'text' },
        { name: 'detail_url', label: '详情页URL', type: 'text' },
        { name: 'is_limited', label: '限定', type: 'checkbox', default: true },
        { name: 'display_order', label: '排序', type: 'number', default: 0 }
    ] },
    light_cones: { fields: [
        { name: 'name', label: '光锥名', type: 'text', required: true },
        { name: 'description', label: '描述', type: 'text' },
        { name: 'path', label: '命途', type: 'text' },
        { name: 'character_id', label: '关联角色ID', type: 'number' },
        { name: 'image_url', label: '图片URL', type: 'text' },
        { name: 'detail_url', label: '详情页URL', type: 'text' },
        { name: 'display_order', label: '排序', type: 'number', default: 0 }
    ] },
    materials: { fields: [
        { name: 'name', label: '材料名', type: 'text', required: true },
        { name: 'description', label: '描述', type: 'text' },
        { name: 'element', label: '属性分类', type: 'select', options: ['无', '冰', '风', '火', '雷', '水', '量子', '虚数', '物理'], default: '无' },
        { name: 'rarity', label: '稀有度(green/blue/purple/gold)', type: 'text' },
        { name: 'image_url', label: '图片URL', type: 'text' },
        { name: 'detail_url', label: '详情页URL', type: 'text' },
        { name: 'display_order', label: '排序', type: 'number', default: 0 }
    ] },
    items: { fields: [
        { name: 'name', label: '道具名', type: 'text', required: true },
        { name: 'description', label: '描述', type: 'text' },
        { name: 'rarity', label: '稀有度(green/blue/purple/gold)', type: 'text' },
        { name: 'image_url', label: '图片URL', type: 'text' },
        { name: 'detail_url', label: '详情页URL', type: 'text' },
        { name: 'display_order', label: '排序', type: 'number', default: 0 }
    ] }
};

// ========== 角色映射（用于显示标签） ==========
export const roleConfig = {
    owner: { name: '站长', class: 'role-owner' },
    admin: { name: '管理员', class: 'role-admin' },
    user: { name: '普通用户', class: 'role-user' }
};