App({
  globalData: {
    token: ''
  },
  onLaunch() {
    try {
      const token = wx.getStorageSync('token') || '';
      this.globalData.token = token;
    } catch (e) {}
  }
});

