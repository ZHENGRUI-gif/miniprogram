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
    allCategories: ALL_CATEGORIES
  },

  onLoad() {
    this.loadQuickAccess();
  },

  onShow() {
    // 从编辑页面返回时重新加载快捷访问
    this.loadQuickAccess();
  },

  // 加载快捷访问
  loadQuickAccess() {
    try {
      const quickAccess = wx.getStorageSync('quickAccess');
      if (quickAccess) {
        this.setData({ quickAccess });
      }
    } catch (e) {
      console.error('加载快捷访问失败:', e);
    }
  },

  // 跳转到编辑页面
  goEdit() {
    wx.navigateTo({
      url: '/pages/category-edit/category-edit'
    });
  },

  // 跳转到视频列表
  goVideos(e) {
    const category = e.currentTarget.dataset.category;
    wx.navigateTo({
      url: `/pages/category-videos/category-videos?mcId=${category.id}&name=${category.name}`
    });
  }
});

