const { request } = require('../../utils/request');

Page({
  data: {
    items: [],
    offset: 0,
    loading: false,
    more: true
  },
  onShow() {
    this.setData({ items: [], offset: 0, more: true });
    this.fetchRecent();
  },
  async fetchRecent() {
    if (this.data.loading || !this.data.more) return;
    this.setData({ loading: true });
    try {
      const res = await request({ url: '/msg/chat/recent-list', method: 'GET', data: { offset: this.data.offset } });
      const list = (res && (res.data || res.list)) || [];
      const mapped = list.map(it => {
        const another = it.another || it.anotherUser || it.user || {};
        const title = another.nickname || another.name || another.username || `用户${another.uid || another.id || ''}`;
        const desc = it.latestContent || it.latest || '';
        const time = it.latestTime || it.time || '';
        const avatar = another.avatar || another.avatar_url || another.head_image || '';
        const uid = another.uid || another.id || it.anotherId || it.uid;
        return { id: uid, uid, title, desc, time, avatar };
      });
      const items = this.data.items.concat(mapped);
      const more = list.length >= 20; // 后端每次20条
      this.setData({ items, offset: items.length, more });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  onReachBottom() { this.fetchRecent(); },
  goChat(e) {
    const uid = e.currentTarget.dataset.uid;
    if (!uid) return;
    wx.navigateTo({ url: `/pages/chat/chat?uid=${uid}` });
  },
  goReply() {
    // TODO: 实现回复与@功能
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },
  goLikes() {
    wx.navigateTo({
      url: '/pages/likes/likes'
    });
  },
  goFans() {
    // TODO: 实现新增粉丝功能
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  }
});


