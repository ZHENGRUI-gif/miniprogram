const { request } = require('../../utils/request');

Page({
  data: { username: '', password: '' },
  onUsername(e) { this.setData({ username: e.detail.value }); },
  onPassword(e) { this.setData({ password: e.detail.value }); },
  async onLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: '请输入账号密码', icon: 'none' });
      return;
    }
    try {
      const res = await request({ url: '/user/account/login', method: 'POST', data: { username, password } });
      if (res.code && res.code !== 200) {
        wx.showToast({ title: res.message || '登录失败', icon: 'none' });
        return;
      }
      const token = res.data?.token || res.token;
      if (token) {
        wx.setStorageSync('teri_token', token);
        // 登录成功后获取用户信息
        try {
          const userRes = await request({ url: '/user/personal/info' });
          if (userRes && userRes.data) {
            wx.setStorageSync('userInfo', userRes.data);
          }
        } catch (e) {
          console.error('获取用户信息失败:', e);
        }
        wx.switchTab ? wx.switchTab({ url: '/pages/index/index' }) : wx.reLaunch({ url: '/pages/index/index' });
      } else {
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});

