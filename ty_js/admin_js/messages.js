// =============================================================
// messages.js —— 错误码 → 人话
//
// SQL 里只抛码：raise exception '... #ROLE_FOUNDER_ONLY#'
// 这里负责翻译。改文案只改这个文件，不用碰数据库。
// =============================================================

export const ERROR_TEXT = {
    // 权限
    NOT_STAFF:              '你还没有这个操作权限哦',
    ROLE_FOUNDER_ONLY:      '只有「小兹」能改成员身份，其他人只能改资料',
    ROLE_INVALID:           '角色只能是 owner / admin / user 三种',
    FOUNDER_IMMUTABLE:      '小兹的账号的身份不能改动',
    STATS_FORBIDDEN:        '只有小兹以及站长能改用户资产',
    PROFILE_ROLE_LOCKED:    '身份请到后台「改角色」修改，不能直接改资料',

    // 数据
    USER_NOT_FOUND:         '找不到这个用户',
    CANNOT_DELETE_FOUNDER:  '最高权限账号不能删除',
    CANNOT_DELETE_SELF:     '不能删除自己',
};

// 匹配 #CODE#（3~64 位大写字母/数字/下划线）
const CODE_RE = /#([A-Z0-9_]{3,64})#/;
const CODE_STRIP = /#[A-Z0-9_]{3,64}#\s*/g;

/**
 * 把数据库抛出的错误消息翻译成人话。
 * - 有已知错误码 → 用表里的文案
 * - 没码或未知码 → 去掉标记后原样返回
 * - 空 → 用 fallback
 */
export function errText(msg, fallback = '操作没有生效') {
    if (msg === null || msg === undefined || msg === '') return fallback;

    const raw = String(msg);
    const hit = raw.match(CODE_RE);

    if (hit && ERROR_TEXT[hit[1]]) {
        return ERROR_TEXT[hit[1]];
    }

    const cleaned = raw.replace(CODE_STRIP, '').trim();
    return cleaned || fallback;
}

// 方便在控制台里直接试
if (typeof window !== 'undefined') {
    window.errText = errText;
    window.ERROR_TEXT = ERROR_TEXT;
}