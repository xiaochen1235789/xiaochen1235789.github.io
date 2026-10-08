// ==================== 全局变量 ====================
let supabaseClient = null;
let currentUser = null;
let userStats = null;
let searchTimeout;
let hasAutoSignCard = false;
let autoSignAttempted = false;
let autoSignNotificationTimer = null;
let isJumping = false;
let emailBadgeTimer = null;
let isLoadingLazy = {};
let globalNotificationTimer = null;

const SUPABASE_URL = 'https://ysmijycsyzpjoieaknmb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbWlqeWNzeXpwam9pZWFrbm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyNDgzNjMsImV4cCI6MjA4MjgyNDM2M30.H7dx2k_0099LVXprMrghHOFh16OoSSgtCUOib2otHPA';