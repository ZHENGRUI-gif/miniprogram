const { request } = require('../../utils/request');

Page({
  data: {
    rankList: [],
    loading: false
  },

  onLoad() {
    this.loadRank();
  },

  onPullDownRefresh() {
    this.loadRank();
  },

  async loadRank() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await request({
        url: '/video/rank',
        data: { limit: 50 }
      });

      // res结构: { code: 200, message: "OK", data: [...] }
      if (res.code === 200) {
        this.setData({
          rankList: res.data || []
        });
      } else {
         // 即使 code 不是 200，也可能是直接返回的数据（取决于 request 封装），
         // 但根据 utils/request.js，它返回 res.data。
         // 用户描述返回 JSON: { "code": 200, ... }
         // utils/request.js: resolve(res.data)
         // 所以这里拿到的 res 就是那个 JSON 对象。
      }
    } catch (err) {
      console.error('获取排行榜失败', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onItemTap(e) {
    const vid = e.currentTarget.dataset.vid;
    if (vid) {
      wx.navigateTo({
        url: `/pages/video/video?vid=${vid}`
      });
    }
  }
});

