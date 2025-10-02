const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');

Page({
  data: { videos: [] },
  onShow() {
    const token = wx.getStorageSync('token');
    if (!token) { this.setData({ videos: [] }); return; }
    this.fetchFollow();
  },
  async fetchFollow() {
    // TODO: 后端有关注流接口时替换为该接口
    const res = await request({ url: '/video/random/visitor' });
    this.setData({ videos: res.data || [] });
  },
  goDetail(e) { wx.navigateTo({ url: `/pages/video/video?vid=${e.currentTarget.dataset.vid}` }); },
  formatNum(n) { return n >= 10000 ? (n/10000).toFixed(1) + '万' : (n || 0); },
  formatDuration(seconds) {
    return handleTime(seconds);
  }
});
