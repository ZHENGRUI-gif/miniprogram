const { request } = require('../../utils/request');
const config = require('../../utils/config');
const { handleTime, needHourFormat } = require('../../utils/time');

Page({
  data: { 
    placeholder: '搜索',
    tabs: ['推荐','热门','追番','影视','科技','游戏','音乐','知识'],
    activeTab: '推荐',
    banners: [],
    videos: [], // 原始视频数据
    displayVideos: [], // 显示的视频数据（包含循环）
    userInfo: null,
    userAvatar: '', // 仅存放有效图片地址，空则用表情占位
    showVideoPreview: false, // 是否显示视频预览
    previewVideo: {}, // 预览视频数据
    currentIndex: 0, // 当前循环索引
    loading: false, // 是否正在加载
    refreshing: false, // 是否正在刷新
    showBackToTop: false, // 是否显示回到顶部按钮
    currentPlayingVideo: null, // 当前播放的视频索引
    videoContexts: {}, // 视频上下文对象
    scrollTop: 0, // 滚动位置
    lastScrollTime: 0, // 上次滚动时间
    scrollThrottleTimer: null // 滚动节流定时器
  },
  onShow() {
    this.fetchFeed();
    this.checkLoginStatus();
    this.testDurationFormatting();
    
    // 延迟检查视频可见性，确保页面渲染完成
    setTimeout(() => {
      this.checkVideoVisibility();
    }, 500);
  },
  
  // 测试时长格式化功能
  testDurationFormatting() {
    console.log('=== 时长格式化测试 ===');
    const testCases = [
      { input: 125, expected: '02:05' },
      { input: '125', expected: '02:05' },
      { input: 3661, expected: '01:01:01' },
      { input: 0, expected: '00:00' },
      { input: null, expected: '00:00' },
      { input: undefined, expected: '00:00' },
      { input: '', expected: '00:00' }
    ];
    
    testCases.forEach((testCase, index) => {
      const result = this.formatDuration(testCase.input);
      console.log(`测试${index + 1}: 输入=${testCase.input}, 期望=${testCase.expected}, 实际=${result}, 通过=${result === testCase.expected}`);
    });
  },
  async fetchFeed() {
    const res = await request({ url: '/video/random/visitor' });
    const list = res && res.data ? res.data : [];
    
    // 调试信息：检查视频数据结构
    if (list.length > 0) {
      const firstVideo = list[0];
      console.log('=== 视频数据调试信息 ===');
      console.log('完整视频对象:', firstVideo);
      console.log('video字段:', firstVideo.video);
      console.log('duration字段值:', firstVideo.video?.duration);
      console.log('duration字段类型:', typeof firstVideo.video?.duration);
      console.log('所有video字段:', Object.keys(firstVideo.video || {}));
      
      // 测试时长格式化
      const testDuration = firstVideo.video?.duration;
      console.log('测试时长格式化:');
      console.log('输入:', testDuration, '类型:', typeof testDuration);
      console.log('格式化结果:', this.formatDuration(testDuration));
    }
    
    // 使用配置文件中的轮播图数据
    this.setData({ 
      videos: list, 
      displayVideos: list,
      banners: config.banners 
    });
    
    // 数据加载完成后，延迟检查视频可见性
    setTimeout(() => {
      this.checkVideoVisibility();
    }, 300);
  },
  switchTab(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }); },
  goDetail(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
  },
  // 跳转到UP主空间
  goUpSpace(e) {
    const uid = e.currentTarget.dataset.uid;
    if (uid) {
      wx.navigateTo({ url: `/pages/user-space/user-space?uid=${uid}` });
    }
  },
  goSearch() { 
    wx.navigateTo({ url: '/pages/search/search' }); 
  },
  goInbox() {
    wx.navigateTo({ url: '/pages/inbox/inbox' });
  },
  // 轮播图点击事件
  onBannerTap(e) {
    const target = e.currentTarget.dataset.target;
    if (target) {
      // 从 target 路径中提取视频ID
      const vid = target.split('/').pop();
      wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
    }
  },
  formatNum(n) {
    if (n >= 10000) return (n/10000).toFixed(1) + '万';
    return n || 0;
  },
  formatDuration(seconds) {
    // 调试信息
    console.log('formatDuration 被调用，输入:', seconds, '类型:', typeof seconds);
    
    // 使用统一的时长处理函数
    const result = handleTime(seconds);
    console.log('formatDuration 输出:', result);
    return result;
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
    } else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const currentYear = now.getFullYear();
      
      if (year < currentYear) {
        return `${year}-${month}-${day}`;
      } else {
        return `${month}-${day}`;
      }
    }
  },
  // 校验是否为有效的图片地址
  isValidImage(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    if (url.startsWith('wxfile://') || url.startsWith('assets://') || url.startsWith('asset://')) return true;
    if (url.startsWith('data:image')) return true;
    return false;
  },
  // 依次尝试多个用户信息接口，返回第一个有效结果
  async fetchUserInfoWithFallback() {
    const candidates = (config && config.userInfoEndpoints) ? config.userInfoEndpoints : [
      '/user/personal/info',
      '/user/account/info',
      '/user/info',
      '/account/info'
    ];
    for (const url of candidates) {
      try {
        const res = await request({ url });
        const data = res && (res.data || res.result || res.user);
        if (data && (data.avatar || data.head_image || data.avatar_url || data.id || data.uid)) {
          return data;
        }
      } catch (_) {
        // 忽略单个接口失败，继续尝试下一个
      }
    }
    return null;
  },
  // 检查登录状态
  async checkLoginStatus() {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
    if (token) {
      // 先从本地存储获取用户信息
      const cachedUserInfo = wx.getStorageSync('userInfo');
      if (cachedUserInfo) {
        const cachedAvatar = cachedUserInfo.avatar || cachedUserInfo.head_image || '';
        this.setData({ 
          userInfo: cachedUserInfo,
          userAvatar: this.isValidImage(cachedAvatar) ? cachedAvatar : ''
        });
      }
      
      try {
        // 尝试多种接口，避免404导致无法获取用户信息
        const userInfo = await this.fetchUserInfoWithFallback();
        if (userInfo) {
          wx.setStorageSync('userInfo', userInfo);
          const latestAvatar = userInfo.avatar || userInfo.head_image || userInfo.avatar_url || '';
          this.setData({
            userInfo,
            userAvatar: this.isValidImage(latestAvatar) ? latestAvatar : ''
          });
        }
      } catch (e) {
        console.error('获取用户信息失败:', e);
        // 如果获取用户信息失败，清除token和用户信息
        wx.removeStorageSync('teri_token');
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        this.setData({ userInfo: null, userAvatar: '' });
      }
    } else {
      this.setData({ userInfo: null, userAvatar: '' });
    }
  },
  // 点击头像处理
  onAvatarTap() {
    if (this.data.userInfo) {
      // 已登录，跳转到个人信息页面
      wx.navigateTo({ url: '/pages/profile/profile' });
    } else {
      // 未登录，跳转到登录页面
      wx.navigateTo({ url: '/pages/login/login' });
    }
  },
  
  // 预览视频功能
  previewVideo(e) {
    const vid = e.currentTarget.dataset.vid;
    console.log('预览视频:', vid);
    
    // 找到对应的视频数据
    const videoData = this.data.videos.find(item => item.video.vid == vid);
    if (!videoData) {
      wx.showToast({
        title: '视频数据不存在',
        icon: 'error'
      });
      return;
    }
    
    // 设置预览视频数据
    this.setData({
      showVideoPreview: true,
      previewVideo: {
        vid: videoData.video.vid,
        title: videoData.video.title,
        videoUrl: videoData.video.videoUrl || videoData.video.url || '', // 视频播放地址
        coverUrl: videoData.video.coverUrl,
        upName: videoData.user.nickname || 'UP主',
        uid: videoData.user.uid,
        uploadTime: this.formatUploadTime(videoData.video.uploadDate),
        playCount: videoData.stats.play || 0,
        danmuCount: videoData.stats.danmu || 0,
        likeCount: videoData.stats.like || 0
      }
    });
  },
  
  // 关闭视频预览
  closeVideoPreview() {
    this.setData({
      showVideoPreview: false,
      previewVideo: {}
    });
  },
  
  // 视频播放事件
  onVideoPlay(e) {
    console.log('视频开始播放');
  },
  
  // 视频暂停事件
  onVideoPause(e) {
    console.log('视频暂停');
  },
  
  // 视频结束事件
  onVideoEnded(e) {
    console.log('视频播放结束');
  },
  
  // 页面滚动事件（节流优化）
  onPageScroll(e) {
    const scrollTop = e.detail.scrollTop;
    const currentTime = Date.now();
    
    // 节流处理：限制执行频率为每100ms一次
    if (currentTime - this.data.lastScrollTime < 100) {
      return;
    }
    
    // 更新滚动时间
    this.setData({ lastScrollTime: currentTime });
    
    // 当滚动超过500rpx时显示回到顶部按钮
    const showBackToTop = scrollTop > 500;
    if (this.data.showBackToTop !== showBackToTop) {
      this.setData({ showBackToTop });
    }
    
    // 更新滚动位置（仅在需要时更新）
    if (Math.abs(this.data.scrollTop - scrollTop) > 10) {
      this.setData({ scrollTop });
    }
    
    // 延迟检查视频可见性，避免频繁执行
    if (this.data.scrollThrottleTimer) {
      clearTimeout(this.data.scrollThrottleTimer);
    }
    
    this.data.scrollThrottleTimer = setTimeout(() => {
      this.checkVideoVisibility();
    }, 200);
  },
  
  // 加载更多视频（无限滚动）
  loadMoreVideos() {
    if (this.data.loading || this.data.videos.length === 0) {
      return;
    }
    
    this.setData({ loading: true });
    
    // 模拟加载延迟
    setTimeout(() => {
      // 循环显示已有视频
      const newVideos = this.getMoreVideos(20); // 每次加载20个视频
      this.setData({
        displayVideos: [...this.data.displayVideos, ...newVideos],
        loading: false
      });
    }, 1000);
  },
  
  // 获取更多视频（循环逻辑）
  getMoreVideos(count) {
    const videos = this.data.videos;
    const currentIndex = this.data.currentIndex;
    const newVideos = [];
    
    for (let i = 0; i < count; i++) {
      const videoIndex = (currentIndex + i) % videos.length;
      newVideos.push(videos[videoIndex]);
    }
    
    // 更新循环索引
    this.setData({
      currentIndex: (currentIndex + count) % videos.length
    });
    
    return newVideos;
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true });
    
    // 模拟刷新延迟
    setTimeout(() => {
      // 重新获取数据
      this.fetchFeed().then(() => {
        this.setData({ 
          refreshing: false,
          currentIndex: 0 // 重置循环索引
        });
      });
    }, 1500);
  },
  
  // 回到顶部
  scrollToTop() {
    console.log('点击回到顶部按钮');
    // 使用scroll-view的scroll-top属性控制滚动
    this.setData({
      scrollTop: 0
    });
    
    // 添加一个小的延迟，然后重置scrollTop，确保下次点击还能生效
    setTimeout(() => {
      this.setData({
        scrollTop: 0
      });
    }, 100);
  },
  
  // 检查视频可见性（性能优化版）
  checkVideoVisibility() {
    const displayVideos = this.data.displayVideos;
    const currentPlayingVideo = this.data.currentPlayingVideo;
    
    // 智能检查范围：如果没有当前播放视频，检查所有大视频；否则只检查附近的大视频
    let startIndex, endIndex;
    
    if (currentPlayingVideo === null) {
      // 没有播放视频时，检查所有大视频
      startIndex = 0;
      endIndex = displayVideos.length;
    } else {
      // 有播放视频时，只检查附近的大视频
      const checkRange = 3; // 检查范围：当前视频前后3个
      startIndex = Math.max(0, currentPlayingVideo - checkRange);
      endIndex = Math.min(displayVideos.length, currentPlayingVideo + checkRange + 1);
    }
    
    // 批量查询，减少DOM操作
    const queries = [];
    const videoIndices = [];
    
    for (let index = startIndex; index < endIndex; index++) {
      if (index > 0 && index % 10 === 0) {
        queries.push(`#large-video-${index}`);
        videoIndices.push(index);
      }
    }
    
    if (queries.length === 0) return;
    
    // 一次性查询所有视频位置
    const query = wx.createSelectorQuery();
    queries.forEach(selector => {
      query.select(selector).boundingClientRect();
    });
    
    query.exec((res) => {
      const windowInfo = wx.getWindowInfo();
      const windowHeight = windowInfo.windowHeight;
      
      console.log(`🔍 检查 ${queries.length} 个大视频的可见性，当前播放: ${currentPlayingVideo}`);
      
      res.forEach((rect, i) => {
        if (rect) {
          const index = videoIndices[i];
          const isVisible = rect.top < windowHeight * 0.5 && rect.bottom > windowHeight * 0.5;
          
          console.log(`视频 ${index} 可见性:`, {
            rect: rect,
            windowHeight: windowHeight,
            isVisible: isVisible,
            currentPlaying: currentPlayingVideo
          });
          
          if (isVisible && currentPlayingVideo !== index) {
            console.log(`🎥 视频 ${index} 进入可视区域，开始播放`);
            // 暂停当前播放的视频
            if (currentPlayingVideo !== null) {
              this.pauseVideo(currentPlayingVideo);
            }
            // 播放当前视频
            this.playVideo(index);
          } else if (!isVisible && currentPlayingVideo === index) {
            console.log(`⏸️ 视频 ${index} 离开可视区域，暂停播放`);
            // 暂停不在可视区域的视频
            this.pauseVideo(index);
          }
        }
      });
    });
  },
  
  // 播放视频（优化版）
  playVideo(index) {
    console.log(`🎥 尝试播放视频 ${index}`);
    const videoContext = wx.createVideoContext(`large-video-${index}`, this);
    if (videoContext) {
      try {
        videoContext.play();
        this.setData({
          currentPlayingVideo: index
        });
        console.log(`✅ 成功播放视频 ${index}`);
      } catch (error) {
        console.error(`❌ 播放视频 ${index} 失败:`, error);
      }
    } else {
      console.error(`❌ 无法创建视频上下文，视频ID: large-video-${index}`);
    }
  },
  
  // 暂停视频（优化版）
  pauseVideo(index) {
    const videoContext = wx.createVideoContext(`large-video-${index}`, this);
    if (videoContext) {
      try {
        videoContext.pause();
        if (this.data.currentPlayingVideo === index) {
          this.setData({
            currentPlayingVideo: null
          });
        }
      } catch (error) {
        console.error(`暂停视频 ${index} 失败:`, error);
      }
    }
  },
  
  // 大视频播放事件
  onLargeVideoPlay(e) {
    // 静默处理，减少日志输出
  },
  
  // 大视频暂停事件
  onLargeVideoPause(e) {
    // 静默处理，减少日志输出
  },
  
  // 大视频结束事件
  onLargeVideoEnded(e) {
    // 视频结束后重新开始播放（因为设置了loop）
  },
  
  // 大视频错误事件
  onLargeVideoError(e) {
    const index = e.currentTarget.dataset.index;
    console.error(`大视频播放错误: ${index}`, e.detail);
  }
});

