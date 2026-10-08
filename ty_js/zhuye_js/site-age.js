// ==================== 网站运行天数 + 节日 + 时段祝福 ====================
async function fetchSiteMessages() {
    const launchDate = new Date(2025, 10, 1);
    const today = new Date();
    const days = Math.floor((today - launchDate) / (1000 * 60 * 60 * 24));
    const rawHour = new Date().getHours();

    let hourSlot;
    if (rawHour >= 0 && rawHour < 5) hourSlot = 0;
    else if (rawHour >= 5 && rawHour < 8) hourSlot = 5;
    else if (rawHour >= 8 && rawHour < 11) hourSlot = 8;
    else if (rawHour >= 11 && rawHour < 14) hourSlot = 11;
    else if (rawHour >= 14 && rawHour < 17) hourSlot = 14;
    else if (rawHour >= 17 && rawHour < 19) hourSlot = 17;
    else if (rawHour >= 19 && rawHour < 24) hourSlot = 19;
    else hourSlot = 0;

    const cacheKey = `site_msg_${days}_${hourSlot}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { try { return JSON.parse(cached); } catch (e) {} }

    let specialMessage = null;
    let isSpecialDay = false;
    let hourlyGreeting = null;

    if (supabaseClient) {
        try {
            const { data: specialData } = await supabaseClient
                .from('site_special_messages')
                .select('message')
                .eq('day_offset', days)
                .maybeSingle();
            if (specialData) {
                specialMessage = specialData.message;
                isSpecialDay = true;
            }

            const { data: hourlyData } = await supabaseClient
                .from('site_hourly_greetings')
                .select('greetings')
                .eq('hour_start', hourSlot)
                .maybeSingle();
            if (hourlyData && hourlyData.greetings && hourlyData.greetings.length > 0) {
                const arr = hourlyData.greetings;
                hourlyGreeting = arr[Math.floor(Math.random() * arr.length)];
            }
        } catch (e) {
            console.warn("数据库查询失败，尝试读取本地缓存...");
        }
    }

    const result = { days, specialMessage, isSpecialDay, hourlyGreeting };
    localStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
}

function initializeSiteAge() {
    const siteAgeElem = document.getElementById('site-age');

    async function updateUI() {
        if (!siteAgeElem) return;
        const res = await fetchSiteMessages();

        let htmlLines = [];
        if (res.isSpecialDay && res.specialMessage) {
            htmlLines.push(`✨ ${res.specialMessage} ✨`);
        } else {
            htmlLines.push(`六哥荣耀WIKI已存在 ${res.days} 天啦꒰˶>ᗜ<˶꒱`);
        }
        if (res.hourlyGreeting) {
            htmlLines.push(`💬 ${res.hourlyGreeting}🌸`);
        }

        siteAgeElem.innerHTML = htmlLines.join('<br>');
        siteAgeElem.classList.toggle('special', res.isSpecialDay);
    }

    updateUI();
    setInterval(updateUI, 3600000);
}