const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');

Page({
  data: {
    fid: 0,
    uid: 0,
    favoriteInfo: {},
    videos: [],
    loading: false,
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    isOwn: false
  },

  onLoad(query) {
    const fid = Number(query.fid || 0);
    const uid = Number(query.uid || 0);
    const app = getApp();
    const currentUser = app.globalData.userInfo;
    
    this.setData({ 
      fid,
      uid,
      isOwn: currentUser && currentUser.uid === uid
    });
    
    this.fetchFavoriteInfo();
    this.fetchFavoriteVideos(true);
  },

  // 获取收藏夹信息
  async fetchFavoriteInfo() {
    try {
      // 由于没有单独的收藏夹详情接口，我们从收藏夹列表中获取信息
      const app = getApp();
      const token = app.globalData.token;
      
      let res;
      if (token && this.data.isOwn) {
        // 登录用户查看自己的收藏夹
        res = await request({ 
          url: '/favorite/get-all/user', 
          data: { uid: this.data.uid },
          header: { Authorization: `Bearer ${token}` }
        });
      } else {
        // 游客或查看他人收藏夹
        res = await request({ 
          url: '/favorite/get-all/visitor', 
          data: { uid: this.data.uid } 
        });
      }
      
      if (res && res.data) {
        // 找到对应的收藏夹
        const favorite = res.data.find(item => item.fid === this.data.fid);
        if (favorite) {
          this.setData({ favoriteInfo: favorite });
          
          // 设置页面标题
          wx.setNavigationBarTitle({
            title: favorite.title || '收藏夹'
          });
        }
      }
    } catch (e) {
      console.error('获取收藏夹信息失败:', e);
      wx.showToast({ title: '获取收藏夹信息失败', icon: 'none' });
    }
  },

  // 获取收藏夹内的视频
  async fetchFavoriteVideos(reset = false) {
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
      console.log('获取收藏夹视频，fid:', this.data.fid, 'page:', this.data.currentPage);
      
      // 使用正确的API接口获取收藏夹视频
      const res = await request({ 
        url: '/video/user-collect', 
        data: { 
          fid: this.data.fid,
          rule: 1, // 按时间排序
          page: this.data.currentPage,
          quantity: this.data.pageSize
        } 
      });
      
      console.log('收藏夹视频API响应:', res);
      
      if (res && res.data) {
        const newVideos = res.data || [];
        const allVideos = reset ? newVideos : [...this.data.videos, ...newVideos];
        
        this.setData({ 
          videos: allVideos,
          hasMore: newVideos.length === this.data.pageSize,
          currentPage: this.data.currentPage + 1
        });
        
        console.log('收藏夹视频数量:', allVideos.length);
        
        // 如果没有视频，显示提示
        if (allVideos.length === 0 && reset) {
          wx.showToast({ 
            title: '收藏夹暂无视频', 
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        this.setData({ 
          videos: reset ? [] : this.data.videos,
          hasMore: false
        });
      }
      
    } catch (e) {
      console.error('获取收藏夹视频失败:', e);
      wx.showToast({ title: '获取视频失败', icon: 'none' });
      
      // 出错时保持原有数据
      this.setData({ 
        videos: reset ? [] : this.data.videos,
        hasMore: false
      });
    } finally {
      this.setData({ 
        loading: false,
        loadingMore: false 
      });
    }
  },

  // 加载更多视频
  loadMoreVideos() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.fetchFavoriteVideos(false);
    }
  },

  // 跳转到视频详情
  goToVideo(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
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
    this.fetchFavoriteInfo();
    this.fetchFavoriteVideos(true);
    wx.stopPullDownRefresh();
  }
});
