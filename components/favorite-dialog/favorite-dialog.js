const { request } = require('../../utils/request');

Component({
  properties: {
    vid: { type: Number, value: 0 },
    visible: { type: Boolean, value: false },
    // 已收藏的收藏夹ID集合（来自父级）
    collectedFids: { type: Array, value: [] }
  },
  data: {
    favList: [],
    selectedSet: {},
    newTitle: '',
    visibleIdx: 0, // 0 公开 1 私密
    visibilityOptions: ['公开', '私密'],
    creating: false,
    submitting: false
  },
  observers: {
    visible(visible) {
      if (visible) {
        this.syncSelected();
        this.fetchFavList();
      }
    },
    collectedFids() {
      this.syncSelected();
    }
  },
  methods: {
    noop() {},
    close() { this.triggerEvent('close'); },

    syncSelected() {
      const set = {};
      (this.properties.collectedFids || []).forEach(fid => { set[fid] = true; });
      this.setData({ selectedSet: set });
    },

    async fetchFavList() {
      try {
        const app = getApp();
        const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
        let res;
        if (token) {
          res = await request({ url: '/favorite/get-all/user', data: { uid: app.globalData.userInfo?.uid }, headers: { Authorization: `Bearer ${token}` } });
        } else {
          res = await request({ url: '/favorite/get-all/visitor', data: { uid: app.globalData.userInfo?.uid } });
        }
        const list = res && res.data ? res.data : [];
        this.setData({ favList: list });
      } catch (e) {
        wx.showToast({ title: '获取收藏夹失败', icon: 'none' });
      }
    },

    toggleSelect(e) {
      const fid = Number(e.currentTarget.dataset.fid);
      const selectedSet = Object.assign({}, this.data.selectedSet);
      selectedSet[fid] = !selectedSet[fid];
      this.setData({ selectedSet });
    },

    onInputTitle(e) { this.setData({ newTitle: e.detail.value }); },
    onVisibleChange(e) { this.setData({ visibleIdx: Number(e.detail.value) }); },

    async createFavorite() {
      if (!this.data.newTitle.trim()) {
        wx.showToast({ title: '请输入收藏夹名称', icon: 'none' });
        return;
      }
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      if (!token) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
      this.setData({ creating: true });
      try {
        const formData = { title: this.data.newTitle.trim(), desc: '', visible: this.data.visibleIdx === 0 ? 1 : 0 };
        const res = await request({ url: '/favorite/create', method: 'POST', data: formData, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (res && res.data) {
          wx.showToast({ title: '创建成功', icon: 'success' });
          this.setData({ newTitle: '' });
          await this.fetchFavList();
        }
      } catch (e) {
        wx.showToast({ title: '创建失败', icon: 'none' });
      } finally {
        this.setData({ creating: false });
      }
    },

    async submit() {
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      if (!token) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
      const vid = Number(this.properties.vid || 0);
      if (!vid) { wx.showToast({ title: '视频无效', icon: 'none' }); return; }

      const before = new Set(this.properties.collectedFids || []);
      const after = new Set(Object.keys(this.data.selectedSet).filter(fid => this.data.selectedSet[fid]).map(Number));
      const adds = [...after].filter(x => !before.has(x));
      const removes = [...before].filter(x => !after.has(x));

      if (adds.length === 0 && removes.length === 0) { this.close(); return; }

      this.setData({ submitting: true });
      try {
        const form = { vid: vid, adds: adds.join(','), removes: removes.join(',') };
        const res = await request({ url: '/video/collect', method: 'POST', data: form, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (res && res.data) {
          wx.showToast({ title: '已更新收藏', icon: 'success' });
          this.triggerEvent('submitted', { fids: after, addCount: adds.length, removeCount: removes.length });
        }
      } catch (e) {
        wx.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        this.setData({ submitting: false });
      }
    }
  }
});


