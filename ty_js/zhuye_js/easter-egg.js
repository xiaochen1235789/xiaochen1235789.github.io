// =========================================================
// ★ LOGO 彩蛋系统
// =========================================================

const EASTER_EGGS = {
    egg_3: {
        icon: '👿',
        title: '喂喂喂，你点我干嘛？',
        content: `
            <p>小兹表示受到了惊吓！这里既没有隐藏兑换码，也没有648，只有一只努力卖萌的小兹。</p>
            <p>既然你来都来了，不如去抽卡模拟器试个手气？( ˶‾᷄ ⁻̫ ‾᷅˵ )</p>
        `
    },
    egg_7: {
        icon: '🌙',
        title: '你真的很有耐心诶',
        content: `
            <p>居然点到第七次了……看来你是个喜欢探索细节的人。</p>
            <p>其实这个WIKI最初只是我一个人的小脑洞，想把自己瞎编的角色和世界观整理到一起。没想到慢慢变成了一个还像那么回事的小站点。</p>
            <p>能在这里遇到你，感觉就像在浩瀚的星海里碰到了同好。谢谢你愿意花时间停留，去各个分类逛逛吧，说不定还有惊喜哦！</p>
        `
    },
    egg_20: {
        icon: '🏆',
        title: '彩蛋',
        content: `
            <p>恭喜你触发了这个极其隐蔽的彩蛋！既然你诚心诚意地戳了20次……那就告诉你一个秘密吧：</p>
            <p>好吧好吧，其实没有什么秘密</p>
        `
    },
    egg_overflow: {
        icon: '😅',
        title: '你怎么还在点…',
        content: `
            <p>喂！彩蛋已经被你榨干了！再点下去小兹要罢工了！۶•̀д•́۶</p>
            <p>有这闲工夫，不如去好友系统看看有没有新邮件，或者去抽卡模拟器里大杀四方！快去吧快去吧！</p>
        `
    }
};

const DATE_EGGS = [
    {
        month: 11,
        day: 1,
        key: 'anniversary',
        icon: '🎂',
        title: '六哥荣耀WIKI，生日快乐！',
        content: `
            <p>今天是 11 月 1 日，是六哥荣耀WIKI 一周年的生日！</p>
            <p>感谢你陪伴站点走过的风风雨雨。希望你今天也能在这里找到快乐！站长请你吃虚拟蛋糕！🍰✨</p>
        `
    },
    // {
    //     month: 10,
    //     day: 1,
    //     key: 'national_day',
    //     icon: '🇨🇳',
    //     title: '欢度国庆！',
    //     content: `
    //         <p>普天同庆的日子里，六哥荣耀WIKI 也披上了节日的盛装！</p>
    //         <p>祝大家假期愉快，吃好喝好，抽卡把把出金！🎉</p>
    //     `
    // },
];

const PARTICLE_SYMBOLS = ['✨', '⭐', '🍬', '🌸', '🎀', '💖'];
let logoBounceTimer = null;
let logoHintTimer = null;

function spawnLogoParticles(x, y) {
    const count = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'logo-particle';
        span.textContent = PARTICLE_SYMBOLS[Math.floor(Math.random() * PARTICLE_SYMBOLS.length)];

        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        const distance = 60 + Math.random() * 50;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 20;

        span.style.left = x + 'px';
        span.style.top = y + 'px';
        span.style.setProperty('--dx', dx.toFixed(1) + 'px');
        span.style.setProperty('--dy', dy.toFixed(1) + 'px');
        span.style.animationDelay = (i * 25) + 'ms';

        document.body.appendChild(span);
        setTimeout(() => span.remove(), 1400);
    }
}

function showLogoHintOnce() {
    if (localStorage.getItem('logoHintShown') === '1') return;
    const hint = document.getElementById('logoHint');
    if (!hint) return;
    hint.classList.add('show');
    localStorage.setItem('logoHintShown', '1');
    if (logoHintTimer) clearTimeout(logoHintTimer);
    logoHintTimer = setTimeout(() => {
        hint.classList.remove('show');
        logoHintTimer = null;
    }, 3000);
}

function openEasterEgg(egg) {
    if (!egg) return;
    const modal = document.getElementById('easterEggModal');
    if (!modal) return;
    if (modal.classList.contains('active')) return;

    document.getElementById('eggIcon').textContent = egg.icon || '🎁';
    document.getElementById('eggTitle').textContent = egg.title || '';
    document.getElementById('eggContent').innerHTML = egg.content || '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEasterEgg() {
    const modal = document.getElementById('easterEggModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function findTodayDateEgg() {
    const today = new Date();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    return DATE_EGGS.find(e => e.month === m && e.day === d) || null;
}

function cleanupDateEggKeys() {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('logoDateEgg_') && k !== 'logoDateEgg_' + todayStr) {
            keysToRemove.push(k);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

function handleLogoClick(e) {
    const navTitle = document.querySelector('.nav-title');
    const logoImg = document.querySelector('.nav-logo-img');

    if (logoImg) {
        logoImg.classList.remove('logo-bounce');
        void logoImg.offsetWidth;
        logoImg.classList.add('logo-bounce');
        if (logoBounceTimer) clearTimeout(logoBounceTimer);
        logoBounceTimer = setTimeout(() => {
            logoImg.classList.remove('logo-bounce');
            logoBounceTimer = null;
        }, 650);
    }

    let px = e.clientX, py = e.clientY;
    if (!px && navTitle) {
        const rect = navTitle.getBoundingClientRect();
        px = rect.left + rect.width / 2;
        py = rect.top + rect.height / 2;
    }
    spawnLogoParticles(px, py);

    showLogoHintOnce();

    let count = parseInt(localStorage.getItem('logoClickCount') || '0', 10) + 1;
    localStorage.setItem('logoClickCount', count);

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const dateEggKey = 'logoDateEgg_' + todayStr;
    if (!localStorage.getItem(dateEggKey)) {
        const dateEgg = findTodayDateEgg();
        if (dateEgg) {
            localStorage.setItem(dateEggKey, '1');
            openEasterEgg(dateEgg);
            return;
        }
    }

    let egg = null;
    if (count === 3)              egg = EASTER_EGGS.egg_3;
    else if (count === 7)         egg = EASTER_EGGS.egg_7;
    else if (count === 20)        egg = EASTER_EGGS.egg_20;
    else if (count > 20)          egg = EASTER_EGGS.egg_overflow;

    if (egg) openEasterEgg(egg);
}

function setupLogoEasterEgg() {
    const navTitle = document.querySelector('.nav-title');
    if (!navTitle || navTitle._eggBound) return;
    navTitle.addEventListener('click', handleLogoClick);
    navTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleLogoClick({ clientX: 0, clientY: 0 });
        }
    });
    navTitle._eggBound = true;

    const closeBtn = document.getElementById('closeEggBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeEasterEgg);

    const modal = document.getElementById('easterEggModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeEasterEgg();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const m = document.getElementById('easterEggModal');
            if (m && m.classList.contains('active')) closeEasterEgg();
        }
    });

    cleanupDateEggKeys();
}

window.closeEasterEgg = closeEasterEgg;