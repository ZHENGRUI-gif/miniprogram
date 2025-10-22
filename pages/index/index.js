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
    scrollThrottleTimer: null, // 滚动节流定时器
    msgUnread: 0, // 未读消息数量
    shownVideoIds: new Set(), // 已显示过的视频ID集合
    allVideosShown: false, // 是否所有视频都已显示过
  },
  onShow() {
    this.fetchFeed();
    this.checkLoginStatus();
    this.testDurationFormatting();
    this.updateMsgUnread(); // 更新消息未读数量
    
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
    
    // 初始化时记录已显示的视频ID
    this.initializeShownVideos(list);
    
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
  goCategory() {
    wx.navigateTo({ url: '/pages/category/category' });
  },

  // 计算消息未读数 - 参考blbl项目的实现
  updateMsgUnread() {
    const app = getApp();
    if (app && app.globalData) {
      let count = 0;
      for (let i = 0; i < 5; i++) {  // 只计算前5种消息类型
        count += app.globalData.msgUnread[i];
      }
      
      console.log('更新消息未读数量:', { 
        count, 
        msgUnread: app.globalData.msgUnread,
        msgTypes: app.globalData.msgTypeNames 
      });
      
      this.setData({
        msgUnread: count
      });
    }
  },

  // 页面消息更新回调
  onMsgUpdate() {
    this.updateMsgUnread();
  },

  // 检查WebSocket连接状态
  checkWebSocketStatus() {
    const app = getApp();
    const WebSocketManager = require('../../utils/websocket');
    const wsStatus = WebSocketManager.getConnectionStatus();
    
    // 检查存储中的token
    const teriToken = wx.getStorageSync('teri_token');
    const normalToken = wx.getStorageSync('token');
    
    const statusInfo = {
      isConnected: wsStatus.isConnected,
      isConnecting: wsStatus.isConnecting,
      reconnectAttempts: wsStatus.reconnectAttempts,
      maxAttempts: wsStatus.maxReconnectAttempts,
      globalWsConnected: app.globalData.wsConnected,
      globalToken: app.globalData.token ? '已设置' : '未设置',
      wsManagerToken: wsStatus.token,
      shouldReconnect: wsStatus.shouldReconnect,
      hasConnectionTimeout: wsStatus.hasConnectionTimeout,
      teriToken: teriToken ? '已设置' : '未设置',
      normalToken: normalToken ? '已设置' : '未设置',
      msgUnread: app.globalData.msgUnread,
      totalUnread: app.getTotalUnreadCount()
    };
    
    console.log('WebSocket连接状态:', statusInfo);
    
    const content = `连接状态: ${statusInfo.isConnected ? '已连接' : (statusInfo.isConnecting ? '连接中' : '未连接')}
重连次数: ${statusInfo.reconnectAttempts}/${statusInfo.maxAttempts}
全局状态: ${statusInfo.globalWsConnected ? '已连接' : '未连接'}
允许重连: ${statusInfo.shouldReconnect ? '是' : '否'}
连接超时: ${statusInfo.hasConnectionTimeout ? '是' : '否'}
全局Token: ${statusInfo.globalToken}
WS管理器Token: ${statusInfo.wsManagerToken}
teri_token: ${statusInfo.teriToken}
token: ${statusInfo.normalToken}
未读消息: ${statusInfo.msgUnread.join(', ')}
总未读数: ${statusInfo.totalUnread}`;
    
    wx.showModal({
      title: 'WebSocket状态',
      content: content,
      confirmText: '重新连接',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          this.reconnectWebSocket();
        }
      }
    });
  },

  // 重新连接WebSocket
  async reconnectWebSocket() {
    const app = getApp();
    const token = app.globalData.token;
    
    if (!token) {
      // 如果没有token，提供设置token的选项
      wx.showModal({
        title: '没有Token',
        content: '当前没有登录token，是否要手动设置一个测试token？',
        confirmText: '设置Token',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.setTestToken();
          }
        }
      });
      return;
    }
    
    wx.showLoading({
      title: '连接中...'
    });
    
    // 先断开现有连接
    const WebSocketManager = require('../../utils/websocket');
    WebSocketManager.disconnect();
    
    // 等待一段时间后重新连接
    setTimeout(async () => {
      try {
        // 重新启用重连
        WebSocketManager.shouldReconnect = true;
        WebSocketManager.reconnectAttempts = 0;
        
        await WebSocketManager.connect();
        
        wx.hideLoading();
        wx.showToast({
          title: '重连成功',
          icon: 'success'
        });
        
        this.updateMsgUnread();
      } catch (error) {
        wx.hideLoading();
        wx.showToast({
          title: '重连失败',
          icon: 'error'
        });
        console.error('重连失败:', error);
      }
    }, 1000);
  },

  // 设置测试Token
  setTestToken() {
    wx.showModal({
      title: '设置测试Token',
      content: '请输入一个测试token（可以是任意字符串）',
      editable: true,
      placeholderText: '输入token',
      success: (res) => {
        if (res.confirm && res.content) {
          const testToken = res.content.trim();
          if (testToken) {
            // 设置测试token
            const app = getApp();
            app.globalData.token = testToken;
            wx.setStorageSync('teri_token', testToken);
            
            // 同步到WebSocket管理器
            const WebSocketManager = require('../../utils/websocket');
            WebSocketManager.token = testToken;
            
            wx.showToast({
              title: 'Token已设置',
              icon: 'success'
            });
            
            // 尝试连接WebSocket
            setTimeout(() => {
              this.reconnectWebSocket();
            }, 1000);
          }
        }
      }
    });
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
    
    // 节流处理：限制执行频率为每150ms一次，减少频繁调用
    if (currentTime - this.data.lastScrollTime < 150) {
      return;
    }
    
    // 更新滚动时间（不使用setData，直接更新data）
    this.data.lastScrollTime = currentTime;
    
    // 批量更新数据，减少setData调用
    const updateData = {};
    
    // 当滚动超过500rpx时显示回到顶部按钮
    const showBackToTop = scrollTop > 500;
    if (this.data.showBackToTop !== showBackToTop) {
      updateData.showBackToTop = showBackToTop;
    }
    
    // 更新滚动位置（仅在变化较大时更新）
    if (Math.abs(this.data.scrollTop - scrollTop) > 50) {
      updateData.scrollTop = scrollTop;
    }
    
    // 如果有需要更新的数据，才调用setData
    if (Object.keys(updateData).length > 0) {
      this.setData(updateData);
    }
    
    // 延迟检查视频可见性，避免频繁执行
    if (this.data.scrollThrottleTimer) {
      clearTimeout(this.data.scrollThrottleTimer);
    }
    
    this.data.scrollThrottleTimer = setTimeout(() => {
      this.checkVideoVisibility();
    }, 300); // 增加延迟时间，减少检查频率
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
  
  // 初始化已显示的视频ID
  initializeShownVideos(videoList) {
    const shownVideoIds = new Set();
    videoList.forEach(video => {
      if (video.video && video.video.vid) {
        shownVideoIds.add(String(video.video.vid));
      }
    });
    
    this.setData({
      shownVideoIds,
      allVideosShown: shownVideoIds.size >= videoList.length
    });
    
    console.log('初始化已显示视频:', {
      totalVideos: videoList.length,
      shownCount: shownVideoIds.size,
      allShown: shownVideoIds.size >= videoList.length
    });
  },

  // 获取更多视频（优化循环逻辑）
  getMoreVideos(count) {
    const videos = this.data.videos;
    const shownVideoIds = this.data.shownVideoIds;
    const allVideosShown = this.data.allVideosShown;
    const newVideos = [];
    const newShownIds = new Set(shownVideoIds);
    
    console.log('获取更多视频:', {
      requestCount: count,
      totalVideos: videos.length,
      alreadyShown: shownVideoIds.size,
      allVideosShown
    });
    
    if (!allVideosShown) {
      // 优先显示未出现过的视频
      const unshownVideos = videos.filter(video => 
        video.video && video.video.vid && !shownVideoIds.has(String(video.video.vid))
      );
      
      console.log('未显示的视频数量:', unshownVideos.length);
      
      // 随机打乱未显示的视频顺序
      const shuffledUnshown = this.shuffleArray([...unshownVideos]);
      
      // 取需要的数量
      const selectedUnshown = shuffledUnshown.slice(0, count);
      newVideos.push(...selectedUnshown);
      
      // 记录新显示的视频ID
      selectedUnshown.forEach(video => {
        if (video.video && video.video.vid) {
          newShownIds.add(String(video.video.vid));
        }
      });
      
      // 如果还需要更多视频，从已显示的视频中随机选择
      if (newVideos.length < count) {
        const remainingCount = count - newVideos.length;
        const shownVideos = videos.filter(video => 
          video.video && video.video.vid && shownVideoIds.has(String(video.video.vid))
        );
        const shuffledShown = this.shuffleArray([...shownVideos]);
        const selectedShown = shuffledShown.slice(0, remainingCount);
        newVideos.push(...selectedShown);
      }
    } else {
      // 所有视频都已显示过，随机循环显示
      const shuffledVideos = this.shuffleArray([...videos]);
      const selectedVideos = shuffledVideos.slice(0, count);
      newVideos.push(...selectedVideos);
    }
    
    // 更新已显示的视频ID集合
    this.setData({
      shownVideoIds: newShownIds,
      allVideosShown: newShownIds.size >= videos.length
    });
    
    console.log('返回新视频:', {
      newVideoCount: newVideos.length,
      totalShown: newShownIds.size,
      allVideosShown: newShownIds.size >= videos.length
    });
    
    return newVideos;
  },

  // 数组随机打乱函数
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
          currentIndex: 0, // 重置循环索引
          shownVideoIds: new Set(), // 重置已显示视频ID集合
          allVideosShown: false // 重置所有视频已显示状态
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
    
    // 智能检查范围：进一步优化检查逻辑
    let startIndex, endIndex;
    
    if (currentPlayingVideo === null) {
      // 没有播放视频时，只检查前几个可能的大视频位置
      startIndex = 0;
      endIndex = Math.min(displayVideos.length, 50); // 限制检查范围
    } else {
      // 有播放视频时，只检查附近的大视频
      const checkRange = 2; // 减少检查范围：当前视频前后2个
      startIndex = Math.max(0, currentPlayingVideo - checkRange * 10);
      endIndex = Math.min(displayVideos.length, currentPlayingVideo + checkRange * 10);
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
    
    // 限制同时检查的视频数量，避免性能问题
    if (queries.length > 3) {
      queries.splice(3);
      videoIndices.splice(3);
    }
    
    // 一次性查询所有视频位置
    const query = wx.createSelectorQuery();
    queries.forEach(selector => {
      query.select(selector).boundingClientRect();
    });
    
    query.exec((res) => {
      const windowInfo = wx.getWindowInfo();
      const windowHeight = windowInfo.windowHeight;
      
      res.forEach((rect, i) => {
        if (rect) {
          const index = videoIndices[i];
          const isVisible = rect.top < windowHeight * 0.5 && rect.bottom > windowHeight * 0.5;
          
          if (isVisible && currentPlayingVideo !== index) {
            // 暂停当前播放的视频
            if (currentPlayingVideo !== null) {
              this.pauseVideo(currentPlayingVideo);
            }
            // 播放当前视频
            this.playVideo(index);
          } else if (!isVisible && currentPlayingVideo === index) {
            // 暂停不在可视区域的视频
            this.pauseVideo(index);
          }
        }
      });
    });
  },
  
  // 播放视频（优化版）
  playVideo(index) {
    const videoContext = wx.createVideoContext(`large-video-${index}`, this);
    if (videoContext) {
      try {
        videoContext.play();
        this.setData({
          currentPlayingVideo: index
        });
      } catch (error) {
        console.error(`播放视频 ${index} 失败:`, error);
      }
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

