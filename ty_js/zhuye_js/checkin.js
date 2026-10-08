// ==================== 签到核心逻辑 ====================
async function fetchCheckinReward(streak) {
    const { data, error } = await supabaseClient
        .from('checkin_config')
        .select('candy, rainbow, active')
        .eq('day_num', streak)
        .maybeSingle();
    if (!data) {
        const { data: defaultData, error: defaultErr } = await supabaseClient
            .from('checkin_config')
            .select('candy, rainbow, active')
            .eq('day_num', 9999)
            .maybeSingle();
        if (defaultErr || !defaultData) {
            return { candy: 0, rainbow: 0, active: 0 };
        }
        return defaultData;
    }
    return data;
}

async function executeCheckin(autoTriggered = false) {
    if (!currentUser) {
        showNotification('请先登录', 'error');
        return false;
    }
    if (!userStats) {
        showNotification('用户统计未加载，请刷新页面重试', 'error');
        return false;
    }
    const today = getLocalDateString();
    if (userStats.last_checkin_date === today) {
        if (!autoTriggered) showNotification('您今天已经签到过了亲，请明天再来吧ღ( ´･ᴗ･ )比心。', 'warning');
        return false;
    }

    let newStreak = 1;
    const last = userStats.last_checkin_date;
    if (last) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);
        if (last === yesterdayStr) newStreak = (userStats.checkin_streak || 0) + 1;
    }

    const rewards = await fetchCheckinReward(newStreak);
    if (!rewards) {
        showNotification('签到奖励配置错误', 'error');
        return false;
    }

    const newCandy = (userStats.candy_crumbles || 0) + rewards.candy;
    const newRainbow = (userStats.rainbow_lollipops || 0) + rewards.rainbow;
    const newActive = (userStats.active_points || 0) + rewards.active;

    const { error: updateErr } = await supabaseClient
        .from('user_stats')
        .update({
            candy_crumbles: newCandy,
            rainbow_lollipops: newRainbow,
            active_points: newActive,
            last_checkin_date: today,
            checkin_streak: newStreak
        })
        .eq('user_id', currentUser.id);

    if (updateErr) {
        showNotification('签到失败', 'error');
        return false;
    }

    userStats.candy_crumbles = newCandy;
    userStats.rainbow_lollipops = newRainbow;
    userStats.active_points = newActive;
    userStats.last_checkin_date = today;
    userStats.checkin_streak = newStreak;
    localStorage.setItem('cachedUserStats', JSON.stringify(userStats));

    const rewardMsg =
        `+${rewards.candy.toLocaleString()}🍬 ${rewards.rainbow>0?`+${rewards.rainbow}🌈 `:''}+${rewards.active}⚡`;

    if (autoTriggered) {
        showNotification(`✨ 自动签到卡已为您签到！获得 ${rewardMsg}`, 'auto-sign');
    } else {
        showNotification(`签到成功！获得 ${rewardMsg} 明天记得再来！`, 'success');
    }
    return true;
}

async function performCheckin() {
    await executeCheckin(false);
}