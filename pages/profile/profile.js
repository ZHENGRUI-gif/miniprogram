const { request } = require('../../utils/request');
const config = require('../../utils/config');

Page({
  data: { 
    user: {},
    userAvatar: '',
    hasLogin: false,
    // 切换账号相关
    showSwitchModal: false, // 是否显示切换账号弹窗
    currentUser: null, // 当前用户信息
    otherAccounts: [] // 其他账号列表
  },
  onShow() {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
    if (!token) { 
      this.setData({ 
        hasLogin: false, 
        user: {}, 
        userAvatar: '',
        currentUser: null,
        otherAccounts: []
      }); 
      return; 
    }
    // 先读本地缓存，提升首屏体验
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo) {
      const cachedAvatar = cachedUserInfo.avatar || cachedUserInfo.head_image || cachedUserInfo.avatar_url || '';
      this.setData({ 
        hasLogin: true,
        user: cachedUserInfo,
        userAvatar: this.isValidImage(cachedAvatar) ? cachedAvatar : '',
        currentUser: cachedUserInfo
      });
      this.loadOtherAccounts();
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
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },
  
  // 加载其他账号列表
  loadOtherAccounts() {
    try {
      const accounts = wx.getStorageSync('otherAccounts') || [];
      this.setData({ otherAccounts: accounts });
    } catch (e) {
      console.error('加载其他账号失败:', e);
      this.setData({ otherAccounts: [] });
    }
  },
  
  // 显示切换账号弹窗
  showSwitchAccount() {
    this.setData({ showSwitchModal: true });
  },
  
  // 隐藏切换账号弹窗
  hideSwitchAccount() {
    this.setData({ showSwitchModal: false });
  },
  
  // 切换到指定账号
  switchToAccount(e) {
    const account = e.currentTarget.dataset.account;
    if (!account) return;
    
    wx.showModal({
      title: '确认切换',
      content: `确定要切换到账号"${account.nickname || account.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.performAccountSwitch(account);
        }
      }
    });
  },
  
  // 执行账号切换
  performAccountSwitch(account) {
    try {
      // 保存当前账号到其他账号列表
      const currentUser = this.data.currentUser;
      if (currentUser) {
        const otherAccounts = this.data.otherAccounts.filter(acc => acc.uid !== currentUser.uid);
        otherAccounts.unshift(currentUser);
        wx.setStorageSync('otherAccounts', otherAccounts);
      }
      
      // 切换到新账号
      wx.setStorageSync('teri_token', account.token);
      wx.setStorageSync('userInfo', account);
      
      // 更新页面状态
      this.setData({
        currentUser: account,
        showSwitchModal: false
      });
      
      // 重新加载其他账号列表
      this.loadOtherAccounts();
      
      wx.showToast({
        title: '切换成功',
        icon: 'success'
      });
      
      // 刷新页面数据
      this.onShow();
      
    } catch (e) {
      console.error('切换账号失败:', e);
      wx.showToast({
        title: '切换失败',
        icon: 'error'
      });
    }
  },
  
  // 添加新账号
  addNewAccount() {
    wx.showModal({
      title: '添加新账号',
      content: '是否要退出当前账号并登录新账号？',
      success: (res) => {
        if (res.confirm) {
          // 清除当前登录信息
          wx.removeStorageSync('teri_token');
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          
          // 跳转到登录页面
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
});

