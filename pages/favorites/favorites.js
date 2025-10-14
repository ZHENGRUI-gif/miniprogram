const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');

Page({
  data: {
    favorites: [],
    loading: false,
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    selectedTab: 0, // 0: 我的收藏夹, 1: 收藏的视频
    collectedVideos: [], // 收藏的视频列表
    currentFavorite: null // 当前选中的收藏夹
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    // 每次显示页面时刷新数据
    if (this.data.favorites.length > 0) {
      this.fetchFavorites();
    }
  },

  // 全局收藏夹列表更新回调
  onFavoritesUpdate(favorites) {
    this.setData({ favorites });
  },

  // 检查登录状态
  checkLogin() {
    const app = getApp();
    const token = app.globalData.token;
    
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      });
      return;
    }
    
    this.fetchFavorites();
  },

  // 获取收藏夹列表
  async fetchFavorites() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      const app = getApp();
      const token = app.globalData.token;
      
      const res = await request({
        url: '/favorite/get-all/user',
        data: { uid: app.globalData.userInfo.uid },
        header: { Authorization: `Bearer ${token}` }
      });
      
      if (res && res.data) {
        this.setData({ 
          favorites: res.data,
          loading: false
        });
        
        // 更新全局收藏夹列表
        app.updateUserFavorites(res.data);
        
        // 如果有收藏夹，默认选择第一个
        if (res.data.length > 0) {
          this.setData({ currentFavorite: res.data[0] });
          this.fetchCollectedVideos(res.data[0].fid, true);
        }
      }
    } catch (error) {
      console.error('获取收藏夹列表失败:', error);
      wx.showToast({
        title: '获取收藏夹失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 获取收藏夹内的视频
  async fetchCollectedVideos(fid, reset = false) {
    if (this.data.loadingMore && !reset) return;
    
    if (reset) {
      this.setData({ 
        currentPage: 1, 
        hasMore: true,
        loadingMore: false,
        loading: true
      });
    } else {
      this.setData({ loadingMore: true });
    }
    
    try {
      const res = await request({ 
        url: '/video/user-collect', 
        data: { 
          fid: fid,
          rule: 1, // 按时间排序
          page: this.data.currentPage,
          quantity: this.data.pageSize
        } 
      });
      
      if (res && res.data) {
        const newVideos = res.data || [];
        const allVideos = reset ? newVideos : [...this.data.collectedVideos, ...newVideos];
        
        this.setData({ 
          collectedVideos: allVideos,
          hasMore: newVideos.length === this.data.pageSize,
          currentPage: this.data.currentPage + 1
        });
      } else {
        this.setData({ 
          collectedVideos: reset ? [] : this.data.collectedVideos,
          hasMore: false
        });
      }
      
    } catch (error) {
      console.error('获取收藏视频失败:', error);
      wx.showToast({ title: '获取视频失败', icon: 'none' });
      
      this.setData({ 
        collectedVideos: reset ? [] : this.data.collectedVideos,
        hasMore: false
      });
    } finally {
      this.setData({ 
        loading: false,
        loadingMore: false 
      });
    }
  },

  // 切换标签页
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ selectedTab: tab });
    
    if (tab === 1 && this.data.collectedVideos.length === 0 && this.data.favorites.length > 0) {
      // 切换到收藏视频标签，加载第一个收藏夹的视频
      this.fetchCollectedVideos(this.data.favorites[0].fid, true);
    }
  },

  // 选择收藏夹
  onFavoriteSelect(e) {
    const fid = e.currentTarget.dataset.fid;
    const favorite = this.data.favorites.find(f => f.fid === fid);
    
    if (favorite) {
      this.setData({ currentFavorite: favorite });
      this.fetchCollectedVideos(fid, true);
    }
  },

  // 跳转到视频详情
  goToVideo(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
  },

  // 跳转到收藏夹详情
  goToFavoriteDetail(e) {
    const fid = e.currentTarget.dataset.fid;
    const uid = e.currentTarget.dataset.uid;
    wx.navigateTo({ 
      url: `/pages/video-detail/video-detail?fid=${fid}&uid=${uid}` 
    });
  },

  // 创建新收藏夹
  createFavorite() {
    wx.showModal({
      title: '创建收藏夹',
      editable: true,
      placeholderText: '请输入收藏夹名称',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const app = getApp();
            const token = app.globalData.token;
            
            const favoriteRes = await request({
              url: '/favorite/create',
              method: 'POST',
              data: {
                title: res.content,
                desc: '',
                visible: 1
              },
              header: { Authorization: `Bearer ${token}` }
            });

            if (favoriteRes && favoriteRes.data) {
              wx.showToast({
                title: '创建成功',
                icon: 'success'
              });
              
              // 刷新收藏夹列表
              this.fetchFavorites();
            }
          } catch (error) {
            console.error('创建收藏夹失败:', error);
            wx.showToast({
              title: '创建失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 加载更多视频
  loadMoreVideos() {
    if (this.data.hasMore && !this.data.loadingMore && this.data.currentFavorite) {
      this.fetchCollectedVideos(this.data.currentFavorite.fid, false);
    }
  },

  // 格式化数字
  formatNum(n) {
    if (n >= 10000) return (n/10000).toFixed(1) + '万';
    return n || 0;
  },

  // 格式化时长
  formatDuration(seconds) {
    return handleTime(seconds);
  },

  // 格式化上传时间
  formatUploadTime(dateTime) {
    if (!dateTime) return '';
    const now = new Date();
    const date = new Date(dateTime);
    const diff = now - date;
    
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / 1000 / 60);
      return `${minutes}分钟前`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / 1000 / 60 / 60);
      return `${hours}小时前`;
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / 1000 / 60 / 60 / 24);
      return `${days}天前`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchFavorites();
    wx.stopPullDownRefresh();
  }
});
