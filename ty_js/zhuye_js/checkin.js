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

    // ★ 改为调用服务端 RPC：
    //   以前是「前端算奖励 + 直写 user_stats」，
    //   但 user_stats 现在只允许写 last_login（防刷钱），
    //   所以签到必须由 do_checkin() 在数据库里完成。
    //   保底/连签/发奖也一并交给它，前端只负责显示。
    let data;
    try {
        const res = await supabaseClient.rpc('do_checkin');
        if (res.error) {
            showNotification('签到失败: ' + res.error.message, 'error');
            return false;
        }
        data = res.data;
    } catch (e) {
        showNotification('签到失败: ' + (e.message || '网络错误'), 'error');
        return false;
    }

    if (!data || !data.success) {
        if (!autoTriggered) {
            showNotification(data?.error || '今天已经签到过啦', 'warning');
        }
        return false;
    }

    // 以服务端返回的数值为准
    const rewards = {
        candy:   data.reward_candy   ?? 0,
        rainbow: data.reward_rainbow ?? 0,
        active:  data.reward_active  ?? 0
    };

    userStats.candy_crumbles    = data.new_candy;
    userStats.rainbow_lollipops = data.new_rainbow;
    userStats.active_points     = data.new_active;
    userStats.checkin_streak    = data.new_streak;
    userStats.last_checkin_date = data.today;
    // 与个人主页保持一致：经验/等级也以服务端返回为准（主页不显示，但缓存要保持新鲜）
    if (data.new_exp   != null) userStats.exp   = data.new_exp;
    if (data.new_level != null) userStats.level = data.new_level;
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