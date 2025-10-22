// 全部分区数据（参考B站的分区）
const ALL_CATEGORIES = [
  { id: 'anime', name: '番剧', icon: '📺' },
  { id: 'guochuang', name: '国创', icon: '🍒' },
  { id: 'douga', name: '动画', icon: '▶️' },
  { id: 'movie', name: '电影', icon: '🎬' },
  { id: 'tv', name: '电视剧', icon: '🪑' },
  { id: 'variety', name: '综艺', icon: '💡' },
  { id: 'cinema', name: '影视', icon: '🌟' },
  { id: 'ent', name: '娱乐', icon: '🪄' },
  { id: 'music', name: '音乐', icon: '🎧' },
  { id: 'dance', name: '舞蹈', icon: '🌺' },
  { id: 'game', name: '游戏', icon: '🎮' },
  { id: 'knowledge', name: '知识', icon: '💡' },
  { id: 'tech', name: '科技数码', icon: '🔔' },
  { id: 'sports', name: '体育运动', icon: '🏃' },
  { id: 'car', name: '汽车', icon: '🚗' },
  { id: 'life', name: '生活', icon: '🏠' },
  { id: 'food', name: '美食', icon: '🍁' },
  { id: 'animal', name: '鬼畜', icon: '🐾' },
  { id: 'fashion', name: '时尚美妆', icon: '👗' },
  { id: 'information', name: '资讯', icon: '📰' },
  { id: 'outdoor', name: '户外潮流', icon: '🏔️' },
  { id: 'fitness', name: '健身', icon: '🏋️' },
  { id: 'vlog', name: '小剧场', icon: '🎭' },
  { id: 'travel', name: '旅游出行', icon: '🔒' }
];

Page({
  data: {
    quickAccess: [], // 快捷访问列表
    allCategories: [], // 全部分区列表（标记已添加状态）
    maxQuickAccess: 8 // 最多8个快捷访问
  },

  // 加载数据
  loadData() {
    try {
      // 加载快捷访问
      const quickAccess = wx.getStorageSync('quickAccess') || [];
      
      // 加载全部分区并标记已添加状态
      const quickAccessIds = quickAccess.map(item => item.id);
      const allCategories = ALL_CATEGORIES.map(item => ({
        ...item,
        added: quickAccessIds.includes(item.id)
      }));

      this.setData({
        quickAccess,
        allCategories
      });
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  },

  onLoad() {
    this.loadData();
    
    // 设置右上角保存按钮
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#ffffff'
    });
  },

  onReady() {
    // 添加右上角保存按钮（使用胶囊菜单）
    wx.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 页面卸载时保存
  onUnload() {
    this.saveToStorage();
  },

  // 保存到本地存储
  saveToStorage() {
    try {
      wx.setStorageSync('quickAccess', this.data.quickAccess);
      console.log('快捷访问已自动保存');
    } catch (e) {
      console.error('保存失败:', e);
    }
  },


  // 添加到快捷访问
  addItem(e) {
    const item = e.currentTarget.dataset.item;
    
    // 检查是否已添加
    if (item.added) {
      return;
    }

    // 检查是否已达到上限
    if (this.data.quickAccess.length >= this.data.maxQuickAccess) {
      wx.showToast({
        title: '最多添加8个',
        icon: 'none'
      });
      return;
    }

    // 添加到快捷访问
    const quickAccess = [...this.data.quickAccess, {
      id: item.id,
      name: item.name,
      icon: item.icon
    }];

    // 更新全部分区的状态
    const allCategories = this.data.allCategories.map(cat => {
      if (cat.id === item.id) {
        return { ...cat, added: true };
      }
      return cat;
    });

    this.setData({
      quickAccess,
      allCategories
    });
    
    // 自动保存
    this.saveToStorage();
  },

  // 从快捷访问移除
  removeItem(e) {
    const id = e.currentTarget.dataset.id;

    // 从快捷访问中移除
    const quickAccess = this.data.quickAccess.filter(item => item.id !== id);

    // 更新全部分区的状态
    const allCategories = this.data.allCategories.map(cat => {
      if (cat.id === id) {
        return { ...cat, added: false };
      }
      return cat;
    });

    this.setData({
      quickAccess,
      allCategories
    });
    
    // 自动保存
    this.saveToStorage();
  }
});

