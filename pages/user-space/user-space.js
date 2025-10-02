const { request } = require('../../utils/request');
const config = require('../../utils/config');
const { handleTime } = require('../../utils/time');

Page({
  data: {
    uid: 0,
    user: {},
    activeTab: 'home',
    videos: [],
    loading: false
  },
  onLoad(query) {
    const uid = Number(query.uid || 0);
    this.setData({ uid });
    this.fetchUserInfo(uid);
  },
  async fetchUserInfo(uid) {
    this.setData({ loading: true });
    try {
      // 获取用户基本信息
      const userRes = await request({ url: '/user/info/get-one', data: { uid } });
      const userData = userRes && (userRes.data || userRes.user) || {};
      
      // 获取用户统计数据
      const statsRes = await request({ url: '/video/user-works-count', data: { uid } });
      const stats = statsRes && statsRes.data || {};
      
      // 合并用户信息
      const user = {
        uid: uid,
        nickname: userData.nickname || userData.name || userData.username || '用户',
        avatar_url: userData.avatar_url || userData.avatar || userData.head_image || '',
        auth: userData.auth || userData.verified || false,
        vip: userData.vip || userData.vip_level || 0,
        level: userData.level || userData.user_level || 1,
        exp: userData.exp || userData.experience || 0,
        expPercent: userData.expPercent || 0,
        description: userData.description || userData.signature || userData.bio || '',
        followsCount: userData.followsCount || userData.follow_count || 0,
        fansCount: userData.fansCount || userData.fan_count || 0,
        loveCount: userData.loveCount || userData.like_count || 0,
        playCount: stats.playCount || stats.total_play || 0
      };
      
      this.setData({ user });
    } catch (e) {
      console.error('获取用户信息失败:', e);
      wx.showToast({ title: '获取用户信息失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  async fetchVideos(uid) {
    try {
      const endpoints = (config && config.authorVideosEndpoints) || [];
      let list = [];
      for (const path of endpoints) {
        try {
          const res = await request({ url: path, data: { uid, userId: uid, authorId: uid } });
          const data = res && (res.data || res.list);
          if (Array.isArray(data) && data.length) { list = data; break; }
        } catch (_) { /* try next */ }
      }
      // 仅保留作者自己的投稿
      const filtered = list.filter(it => {
        const au = (it.up || it.uploader || it.author || it.user || (it.video && it.video.up)) || {};
        const auid = au.uid || au.id || au.user_id || au.userId;
        const ownerUid = auid || it.userId || it.uid || (it.video && (it.video.userId || it.video.uid || it.video.authorId));
        return ownerUid != null && String(ownerUid) === String(uid);
      });
      this.setData({ videos: filtered });
    } catch (_) {}
  },
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    
    if (tab === 'videos' && this.data.videos.length === 0) {
      this.fetchVideos(this.data.uid);
    }
  },
  formatNum(n) {
    if (n >= 10000) return (n/10000).toFixed(1) + '万';
    return n || 0;
  },
  formatDuration(seconds) {
    return handleTime(seconds);
  },
  formatUploadTime(dateTime) {
    if (!dateTime) return '';
    const now = new Date();
    const date = new Date(dateTime);
    const diff = now - date;
    
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / 1000 / 60);
      return `${minutes}分钟前`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / 1000 / 60 / 60);
      return `${hours}小时前`;
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / 1000 / 60 / 60 / 24);
      return `${days}天前`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  },
  goChat() { 
    wx.navigateTo({ url: `/pages/chat/chat?uid=${this.data.uid}` }); 
  },
  goDetail(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
  },
  goFollows() {
    wx.showToast({ title: '关注列表功能开发中', icon: 'none' });
  },
  goFans() {
    wx.showToast({ title: '粉丝列表功能开发中', icon: 'none' });
  }
});
