import { CONFIG } from './config.js';
import { getSupabase, loadUserFrames, ensureUserFrameFields } from './api.js';

export function getFrameById(id) {
    return CONFIG.FRAMES.find(f => f.id === id);
}

// ★ RPC 版：所有逻辑在数据库 purchase_frame 里
export async function purchaseFrame(frameId, stats, onSuccess) {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('purchase_frame', {
        p_frame_id: frameId
    });
    if (error) throw new Error(error.message);

    if (window.userStats) {
        window.userStats.candy_crumbles    = data.new_candy;
        window.userStats.rainbow_lollipops = data.new_rainbow;
    }
    if (onSuccess) onSuccess(data.new_candy, data.new_rainbow);
}

export async function equipFrame(frameId) {
    const sb = getSupabase();
    const { owned } = await loadUserFrames(window.currentUser.id);
    if (!owned.includes(frameId)) throw new Error('未拥有');
    await sb.from('user_profiles').update({ equipped_frame: frameId }).eq('id', window.currentUser.id);
    await applyFrameClassByFrameId(frameId);
}

// ★ 防抖：src 没变就不重设
export async function applyFrameClassByFrameId(frameId) {
    const frameImg = document.getElementById('avatarFrameImg');
    if (!frameImg) return;

    const frame = getFrameById(frameId);
    if (frame && frame.imageUrl) {
        if (frameImg.dataset.frameId !== frameId) {
            frameImg.src = frame.imageUrl;
            frameImg.dataset.frameId = frameId;
        }
        frameImg.style.display = 'block';
        const scale = frame.scale || 1.0;
        frameImg.style.transform = `scale(${scale})`;
    } else {
        frameImg.src = '';
        frameImg.dataset.frameId = '';
        frameImg.style.display = 'none';
        frameImg.style.transform = 'scale(1.0)';
    }
}

export async function initFrameForUser(userId) {
    // ★ 切换账号场景：清空 dataset，强制重设 src
    const frameImg = document.getElementById('avatarFrameImg');
    if (frameImg) {
        frameImg.dataset.frameId = '';
        frameImg.src = '';
    }
    await ensureUserFrameFields(userId);
    const { equipped } = await loadUserFrames(userId);
    await applyFrameClassByFrameId(equipped);
}