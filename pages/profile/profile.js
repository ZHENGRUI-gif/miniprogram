const { request } = require('../../utils/request');
const config = require('../../utils/config');

Page({
  data: { 
    user: {},
    userAvatar: '',
    hasLogin: false 
  },
  onShow() {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
    if (!token) { 
      this.setData({ hasLogin: false, user: {}, userAvatar: '' }); 
      return; 
    }
    // 先读本地缓存，提升首屏体验
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo) {
      const cachedAvatar = cachedUserInfo.avatar || cachedUserInfo.head_image || cachedUserInfo.avatar_url || '';
      this.setData({ 
        hasLogin: true,
        user: cachedUserInfo,
        userAvatar: this.isValidImage(cachedAvatar) ? cachedAvatar : ''
      });
    }
    // 拉取最新信息
    this.fetchMe();
  },
  // 头像链接校验
  isValidImage(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    if (url.startsWith('wxfile://') || url.startsWith('assets://') || url.startsWith('asset://')) return true;
    if (url.startsWith('data:image')) return true;
    return false;
  },
  // 回退方式获取用户信息
  async fetchUserInfoWithFallback() {
    const candidates = (config && config.userInfoEndpoints) ? config.userInfoEndpoints : [
      '/user/personal/info',
      '/user/account/info',
      '/user/info',
      '/account/info'
    ];
    for (const url of candidates) {
      try {
        const res = await request({ url });
        const data = res && (res.data || res.result || res.user);
        if (data && (data.avatar || data.head_image || data.avatar_url || data.id || data.uid)) {
          return data;
        }
      } catch (_) {}
    }
    return null;
  },
  async fetchMe() {
    try {
      const user = await this.fetchUserInfoWithFallback();
      if (user) {
        wx.setStorageSync('userInfo', user);
        const avatar = user.avatar || user.head_image || user.avatar_url || '';
        this.setData({ 
          hasLogin: true,
          user,
          userAvatar: this.isValidImage(avatar) ? avatar : ''
        });
      } else {
        this.setData({ hasLogin: false });
      }
    } catch (e) {
      this.setData({ hasLogin: false });
    }
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); }
});

