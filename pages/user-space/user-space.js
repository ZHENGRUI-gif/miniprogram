const { request } = require('../../utils/request');
const config = require('../../utils/config');
const { handleTime } = require('../../utils/time');

Page({
  data: {
    uid: 0,
    user: {},
    activeTab: 'home',
    videos: [],
    loading: false,
    // 主页数据
    homeVideos: [],
    videoCount: 0,
    favList: [],
    loveVideos: [],
    isOwn: false,
    // 关注状态
    isFollowing: false,
    followLoading: false,
    // 投稿页面数据
    sortRule: 1, // 排序规则 1最新发布 2最多播放 3最多点赞
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false
  },
  onLoad(query) {
    const uid = Number(query.uid || 0);
    const app = getApp();
    const currentUser = app.globalData.userInfo;
    
    this.setData({ 
      uid,
      isOwn: currentUser && currentUser.uid === uid
    });
    
    this.fetchUserInfo(uid);
    this.fetchHomeData(uid);
  },
  async fetchUserInfo(uid) {
    this.setData({ loading: true });
    try {
      // 获取用户基本信息
      const userRes = await request({ url: '/user/info/get-one', data: { uid } });
      console.log('用户信息API响应:', userRes);
      
      // 检查响应结构并提取用户数据
      let userData = {};
      if (userRes && userRes.code === 200 && userRes.data) {
        // 标准CustomResponse结构
        userData = userRes.data;
        console.log('使用标准结构，用户数据:', userData);
      } else if (userRes && userRes.data) {
        // 直接返回数据
        userData = userRes.data;
        console.log('使用直接数据，用户数据:', userData);
      } else if (userRes) {
        // 直接是用户数据
        userData = userRes;
        console.log('直接使用响应，用户数据:', userData);
      }
      
      console.log('用户数据字段:', Object.keys(userData));
      console.log('统计数据字段:', {
        followsCount: userData.followsCount,
        fansCount: userData.fansCount,
        loveCount: userData.loveCount,
        playCount: userData.playCount,
        videoCount: userData.videoCount
      });
      
      // 直接使用API返回的完整用户信息
      const user = {
        uid: userData.uid || uid,
        nickname: userData.nickname || '用户',
        avatar_url: userData.avatar_url || '',
        auth: userData.auth || 0,
        vip: userData.vip || 0,
        level: userData.level || 1,
        exp: userData.exp || 0,
        expPercent: userData.expPercent || 0,
        description: userData.description || '这个人很神秘，什么都没有写',
        signature: userData.description || '这个人很神秘，什么都没有写',
        followsCount: userData.followsCount || 0,
        fansCount: userData.fansCount || 0,
        loveCount: userData.loveCount || 0,
        playCount: userData.playCount || 0,
        videoCount: userData.videoCount || 0
      };
      
      console.log('最终用户对象:', user);
      console.log('formatNum测试:', {
        fansCount: this.formatNum(user.fansCount),
        followsCount: this.formatNum(user.followsCount),
        loveCount: this.formatNum(user.loveCount)
      });
      
      this.setData({ user });
      
      // 强制触发页面更新
      this.setData({ 
        'user.fansCount': user.fansCount,
        'user.followsCount': user.followsCount,
        'user.loveCount': user.loveCount
      });
      
      // 检查数据是否正确设置
      setTimeout(() => {
        console.log('页面数据检查:', {
          user: this.data.user,
          fansCount: this.data.user?.fansCount,
          followsCount: this.data.user?.followsCount,
          loveCount: this.data.user?.loveCount
        });
      }, 100);
      
      // 如果不是自己的空间，检查关注状态
      if (!this.data.isOwn) {
        this.checkFollowStatus(uid);
      }
    } catch (e) {
      console.error('获取用户信息失败:', e);
      console.error('错误详情:', e.message, e.stack);
      wx.showToast({ title: '获取用户信息失败', icon: 'none' });
      
      // 设置默认用户数据用于调试
      this.setData({ 
        user: {
          uid: uid,
          nickname: '测试用户',
          avatar_url: '',
          auth: 0,
          vip: 0,
          level: 1,
          exp: 0,
          expPercent: 0,
          description: '测试描述',
          signature: '测试签名',
          followsCount: 999,
          fansCount: 888,
          loveCount: 777,
          playCount: 666,
          videoCount: 555
        }
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 获取主页数据
  async fetchHomeData(uid) {
    try {
      await Promise.all([
        this.fetchHomeVideos(uid),
        this.fetchFavList(uid),
        this.fetchLoveVideos(uid)
      ]);
    } catch (e) {
      console.error('获取主页数据失败:', e);
    }
  },

  // 获取主页视频（前6个）
  async fetchHomeVideos(uid) {
    try {
      const res = await request({ 
        url: '/video/user-works', 
        data: { 
          uid, 
          rule: 1, 
          page: 1, 
          quantity: 6 
        } 
      });
      
      if (res && res.data) {
        this.setData({ 
          homeVideos: res.data.list || [],
          videoCount: res.data.count || 0
        });
      }
    } catch (e) {
      console.error('获取主页视频失败:', e);
    }
  },

  // 获取收藏夹列表
  async fetchFavList(uid) {
    try {
      const app = getApp();
      const token = app.globalData.token;
      
      let res;
      if (token && this.data.isOwn) {
        // 登录用户查看自己的收藏夹
        res = await request({ 
          url: '/favorite/get-all/user', 
          data: { uid },
          header: { Authorization: `Bearer ${token}` }
        });
      } else {
        // 游客或查看他人收藏夹
        res = await request({ 
          url: '/favorite/get-all/visitor', 
          data: { uid } 
        });
      }
      
      if (res && res.data) {
        // 将默认收藏夹置顶
        const defaultFav = res.data.find(item => item.type === 1);
        const list = res.data.filter(item => item.type !== 1);
        if (defaultFav) {
          list.unshift(defaultFav);
        }
        this.setData({ favList: list });
      }
    } catch (e) {
      console.error('获取收藏夹失败:', e);
    }
  },

  // 获取最近点赞的视频
  async fetchLoveVideos(uid) {
    try {
      const res = await request({ 
        url: '/video/user-love', 
        data: { 
          uid, 
          offset: 0, 
          quantity: 6 
        } 
      });
      
      if (res && res.data) {
        this.setData({ loveVideos: res.data || [] });
      }
    } catch (e) {
      console.error('获取点赞视频失败:', e);
    }
  },

  // 检查关注状态
  async checkFollowStatus(uid) {
    try {
      const app = getApp();
      const token = app.globalData.token;
      
      if (!token) return;
      
      const res = await request({ 
        url: '/follow/check', 
        data: { followingId: uid },
        header: { Authorization: `Bearer ${token}` }
      });
      
      if (res && res.data) {
        this.setData({ isFollowing: res.data });
      }
    } catch (e) {
      console.error('检查关注状态失败:', e);
    }
  },

  // 切换关注状态
  async toggleFollow() {
    if (this.data.followLoading) return;
    
    const app = getApp();
    const token = app.globalData.token;
    
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    this.setData({ followLoading: true });
    
    try {
      const res = await request({ 
        url: '/follow/toggle', 
        method: 'POST',
        data: { followingId: this.data.uid },
        header: { Authorization: `Bearer ${token}` }
      });
      
      if (res && res.data !== undefined) {
        this.setData({ isFollowing: res.data });
        
        // 更新用户信息中的粉丝数
        const user = this.data.user;
        if (res.data) {
          user.fansCount = (user.fansCount || 0) + 1;
        } else {
          user.fansCount = Math.max((user.fansCount || 0) - 1, 0);
        }
        this.setData({ user });
        
        wx.showToast({ 
          title: res.data ? '关注成功' : '取消关注', 
          icon: 'success' 
        });
      }
    } catch (e) {
      console.error('关注操作失败:', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      this.setData({ followLoading: false });
    }
  },
  async fetchVideos(uid, reset = false) {
    if (this.data.loadingMore && !reset) return;
    
    if (reset) {
      this.setData({ 
        currentPage: 1, 
        hasMore: true, 
        loadingMore: false 
      });
    } else {
      this.setData({ loadingMore: true });
    }
    
    try {
      const res = await request({ 
        url: '/video/user-works', 
        data: { 
          uid, 
          rule: this.data.sortRule, 
          page: this.data.currentPage, 
          quantity: this.data.pageSize 
        } 
      });
      
      if (res && res.data) {
        const newVideos = res.data.list || [];
        const totalCount = res.data.count || 0;
        
        let videos;
        if (reset) {
          videos = newVideos;
        } else {
          videos = [...this.data.videos, ...newVideos];
        }
        
        this.setData({ 
          videos,
          videoCount: totalCount,
          hasMore: videos.length < totalCount,
          currentPage: this.data.currentPage + 1
        });
      }
    } catch (e) {
      console.error('获取视频列表失败:', e);
      wx.showToast({ title: '获取视频失败', icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
    }
  },
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    
    if (tab === 'videos' && this.data.videos.length === 0) {
      this.fetchVideos(this.data.uid, true);
    }
  },

  // 改变排序规则
  changeSortRule(e) {
    const rule = Number(e.currentTarget.dataset.rule);
    if (rule === this.data.sortRule) return;
    
    this.setData({ sortRule: rule });
    this.fetchVideos(this.data.uid, true);
  },

  // 加载更多视频
  loadMoreVideos() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.fetchVideos(this.data.uid, false);
    }
  },
  formatNum(n) {
    if (n >= 10000) return (n/10000).toFixed(1) + '万';
    return n || 0;
  },
  formatDuration(seconds) {
    return handleTime(seconds);
  },
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
  goChat() { 
    wx.navigateTo({ url: `/pages/chat/chat?uid=${this.data.uid}` }); 
  },
  goDetail(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
  },
  goFollows() {
    wx.navigateTo({ 
      url: `/pages/follow/follow?uid=${this.data.uid}&type=follows` 
    });
  },
  goFans() {
    wx.navigateTo({ 
      url: `/pages/follow/follow?uid=${this.data.uid}&type=fans` 
    });
  },

  // 跳转到视频页面
  goToVideos() {
    this.switchTab({ currentTarget: { dataset: { tab: 'videos' } } });
  },

  // 跳转到收藏页面
  goToFavorites() {
    this.switchTab({ currentTarget: { dataset: { tab: 'favorites' } } });
  },

  // 跳转到收藏夹详情
  goToFavDetail(e) {
    const fid = e.currentTarget.dataset.fid;
    wx.navigateTo({ 
      url: `/pages/video-detail/video-detail?fid=${fid}&uid=${this.data.uid}` 
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchUserInfo(this.data.uid);
    this.fetchHomeData(this.data.uid);
    if (this.data.activeTab === 'videos') {
      this.fetchVideos(this.data.uid, true);
    }
    wx.stopPullDownRefresh();
  },

  // 页面显示时刷新数据
  onShow() {
    // 如果是从关注页面返回，刷新关注状态
    if (!this.data.isOwn) {
      this.checkFollowStatus(this.data.uid);
    }
  }
});
