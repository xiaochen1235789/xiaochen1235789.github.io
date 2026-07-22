import { CONFIG } from './config.js';
import { getSupabase, loadUserFrames, ensureUserFrameFields } from './api.js';

export function getFrameById(id) {
    return CONFIG.FRAMES.find(f => f.id === id);
}

export async function purchaseFrame(frameId, stats, onSuccess) {
    const sb = getSupabase();
    const frame = getFrameById(frameId);
    if (!frame || (frame.price_candy === 0 && frame.price_rainbow === 0)) throw new Error('无效头像框');
    
    const { owned } = await loadUserFrames(window.currentUser.id);
    if (owned.includes(frameId)) throw new Error('已拥有');
    if (stats.candy_crumbles < frame.price_candy) throw new Error(`糖果碎不足，需 ${frame.price_candy.toLocaleString()}`);
    if (stats.rainbow_lollipops < frame.price_rainbow) throw new Error(`超级棒糖不足，需 ${frame.price_rainbow.toLocaleString()}`);
    
    let newCandy = stats.candy_crumbles - frame.price_candy;
    let newRainbow = stats.rainbow_lollipops - frame.price_rainbow;
    await sb.from('user_stats').update({ candy_crumbles: newCandy, rainbow_lollipops: newRainbow }).eq('user_id', window.currentUser.id);
    
    const { data: profile } = await sb.from('user_profiles').select('owned_frames').eq('id', window.currentUser.id).maybeSingle();
    let currentOwned = profile?.owned_frames || ['nature'];
    if (!currentOwned.includes(frameId)) currentOwned.push(frameId);
    await sb.from('user_profiles').update({ owned_frames: currentOwned }).eq('id', window.currentUser.id);
    
    if (window.userStats) {
        window.userStats.candy_crumbles = newCandy;
        window.userStats.rainbow_lollipops = newRainbow;
    }
    if (onSuccess) onSuccess(newCandy, newRainbow);
}

export async function equipFrame(frameId) {
    const sb = getSupabase();
    const { owned } = await loadUserFrames(window.currentUser.id);
    if (!owned.includes(frameId)) throw new Error('未拥有');
    await sb.from('user_profiles').update({ equipped_frame: frameId }).eq('id', window.currentUser.id);
    await applyFrameClassByFrameId(frameId);
}

export async function applyFrameClassByFrameId(frameId) {
    const frameImg = document.getElementById('avatarFrameImg');
    if (!frameImg) return;

    // ★ 默认框直接移除，杜绝边框
    if (frameId === 'nature' || !frameId) {
        frameImg.remove();
        return;
    }

    const frame = getFrameById(frameId);
    if (frame && frame.imageUrl && frame.imageUrl.trim() !== '') {
        const avatarDiv = document.getElementById('userAvatar');
        if (avatarDiv && !document.getElementById('avatarFrameImg')) {
            const newImg = document.createElement('img');
            newImg.className = 'avatar-frame-img';
            newImg.id = 'avatarFrameImg';
            newImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:contain;pointer-events:none;z-index:2;background:transparent!important;border:none!important;box-shadow:none!important;';
            avatarDiv.appendChild(newImg);
        }
        const img = document.getElementById('avatarFrameImg');
        if (img) {
            img.src = frame.imageUrl;
            img.style.display = 'block';
            const scale = frame.scale || 1.0;
            img.style.transform = `scale(${scale})`;
        }
    } else {
        const img = document.getElementById('avatarFrameImg');
        if (img) img.remove();
    }
}

export async function initFrameForUser(userId) {
    await ensureUserFrameFields(userId);
    const { equipped } = await loadUserFrames(userId);
    await applyFrameClassByFrameId(equipped);
}