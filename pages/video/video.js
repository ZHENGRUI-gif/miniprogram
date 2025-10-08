const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');
const { wsURL } = require('../../utils/config');

Page({
  data: {
    vid: 0,
    video: {},
    playUrl: '',
    uploader: null,
    related: [],
    danmus: [],
    socketOpen: false,
    inputDm: '',
    videoLoadError: false
  },
  onLoad(query) {
    const vid = Number(query.vid || 0);
    this.setData({ vid });
    this.fetchVideo(vid);
    this.fetchDanmu(vid);
    this.connectWS(vid);
    // 记录用户播放行为，创建UserVideo记录
    this.recordUserPlay(vid);
  },
  async fetchVideo(vid) {
    try {
      console.log('开始获取视频信息, vid:', vid);
      const res = await request({ url: '/video/getone', method: 'GET', data: { vid } });
      console.log('视频数据完整响应:', JSON.stringify(res, null, 2));
      
      if (res && res.data) {
        const data = res.data;
        console.log('视频数据结构:', JSON.stringify(data, null, 2));
        
        // 记录video对象的关键信息
        console.log('video对象字段:', Object.keys(data.video));
        console.log('videoUrl字段值:', data.video?.videoUrl);
        
        // 尝试多种可能的播放URL字段
        const playUrl = data.video?.videoUrl ||  // 主要字段
                       data.video?.play_url || 
                       data.play_url || 
                       data.video?.url || 
                       data.url || 
                       data.video?.video_url ||
                       data.video_url ||
                       data.video?.file_url ||
                       data.video?.video_file ||
                       data.video?.media_url ||
                       data.video?.stream_url ||
                       data.video?.src ||
                       data.video?.path || '';
        
        console.log('提取的播放URL:', playUrl);
        console.log('data.video:', data.video);
        console.log('data.video?.play_url:', data.video?.play_url);
        
        this.setData({ video: data, playUrl });

        // 规范化UP主信息
        const rawUp = data.up || data.uploader || data.user || data.author || (data.video && data.video.up) || null;
        if (rawUp) {
          const avatar = rawUp.avatar || rawUp.avatar_url || rawUp.head_image || rawUp.headimgurl || '';
          const name = rawUp.nickname || rawUp.name || rawUp.username || rawUp.nick || rawUp.uname || '';
          const desc = rawUp.signature || rawUp.desc || rawUp.bio || rawUp.intro || '';
          const uid = rawUp.uid || rawUp.id || rawUp.user_id || rawUp.userId || '';
          this.setData({ uploader: { avatar, name, desc, uid } });
        } else {
          this.setData({ uploader: null });
        }
        // 拉取相关推荐
        this.fetchRelated(vid, data.video && data.video.category);
        
        if (!playUrl) {
          console.error('未找到播放URL，数据结构:', data);
          wx.showToast({ title: '视频播放地址获取失败', icon: 'none' });
        } else {
          console.log('视频播放URL设置成功:', playUrl);
        }
      } else {
        console.error('响应数据格式错误:', res);
        wx.showToast({ title: '视频信息获取失败', icon: 'none' });
      }
    } catch (error) {
      console.error('获取视频信息失败:', error);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  },
  goAuthor(e) {
    const uid = e.currentTarget.dataset.uid || (this.data.uploader && this.data.uploader.uid);
    if (!uid) return;
    wx.navigateTo({ url: `/pages/user-space/user-space?uid=${uid}` });
  },
  // 相关推荐
  async fetchRelated(vid, category) {
    try {
      const res = await request({ url: '/video/random/visitor' });
      const list = (res && res.data) ? res.data : [];
      // 简单筛掉当前vid
      const filtered = list.filter(item => String(item.video.vid) !== String(vid));
      this.setData({ related: filtered.slice(0, 10) });
    } catch (_) {}
  },
  
  async fetchDanmu(vid) {
    const res = await request({ url: `/danmu-list/${vid}` });
    if (Array.isArray(res.data)) {
      // 简单生成top随机值
      const list = res.data.map(d => ({ ...d, top: Math.floor(Math.random() * 300) }));
      this.setData({ danmus: list });
    }
  },
  connectWS(vid) {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token') || '';
    const url = `${wsURL}/ws/danmu/${vid}`;
    const that = this;
    
    console.log('尝试连接WebSocket:', url);
    
    wx.connectSocket({ 
      url,
      success: () => {
        console.log('WebSocket连接请求已发送');
      },
      fail: (error) => {
        console.error('WebSocket连接失败:', error);
        wx.showToast({ title: '弹幕连接失败', icon: 'none' });
      }
    });
    
    wx.onSocketOpen(() => { 
      console.log('WebSocket连接成功');
      that.setData({ socketOpen: true }); 
    });
    
    wx.onSocketError((error) => {
      console.error('WebSocket错误:', error);
      that.setData({ socketOpen: false });
    });
    
    wx.onSocketClose(() => {
      console.log('WebSocket连接关闭');
      that.setData({ socketOpen: false });
    });
    
    wx.onSocketMessage(({ data }) => {
      try {
        const dm = JSON.parse(data);
        dm.top = Math.floor(Math.random() * 300);
        const list = that.data.danmus.concat(dm);
        that.setData({ danmus: list });
      } catch (e) {
        // 非弹幕消息忽略
      }
    });
    this._token = token;
  },
  onUnload() {
    try { wx.closeSocket(); } catch (e) {}
  },
  onTimeUpdate(e) {
    this._currentTime = e.detail.currentTime || 0;
  },
  onInput(e) { this.setData({ inputDm: e.detail.value }); },
  sendDanmu() {
    if (!this.data.socketOpen) { return; }
    const payload = {
      token: `Bearer ${this._token || ''}`,
      data: {
        content: this.data.inputDm,
        fontsize: 24,
        mode: 1,
        color: '#ffffff',
        timePoint: this._currentTime || 0
      }
    };
    wx.sendSocketMessage({ data: JSON.stringify(payload) });
    this.setData({ inputDm: '' });
  },
  formatNum(n) {
    const num = Number(n) || 0;
    if (num >= 10000) {
      return (num/10000).toFixed(1) + '万';
    } else if (num >= 1000) {
      return (num/1000).toFixed(1) + 'k';
    }
    return num.toString();
  },
  formatDuration(seconds) {
    return handleTime(seconds);
  },
  
  // 视频加载开始
  onVideoLoadStart() {
    console.log('视频开始加载');
    this.setData({ videoLoadError: false });
  },
  
  // 视频数据加载完成
  onVideoLoadedData() {
    console.log('视频数据加载完成');
    this.setData({ videoLoadError: false });
  },
  
  // 视频加载错误
  onVideoError(e) {
    console.error('视频加载失败:', e);
    this.setData({ videoLoadError: true });
    
    // 显示错误提示
    wx.showToast({
      title: '视频加载失败',
      icon: 'none',
      duration: 3000
    });
  },
  
  // 重新加载视频
  retryVideo() {
    console.log('重新加载视频');
    this.setData({ videoLoadError: false });
    
    // 重新设置视频源，触发重新加载
    const currentUrl = this.data.playUrl;
    this.setData({ playUrl: '' });
    
    setTimeout(() => {
      this.setData({ playUrl: currentUrl });
    }, 100);
  },

  // 记录用户播放行为，创建UserVideo记录
  async recordUserPlay(vid) {
    try {
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      if (!token) {
        console.log('用户未登录，跳过播放记录');
        return;
      }

      console.log('记录用户播放行为, vid:', vid);
      
      const res = await request({
        url: `/video/play/user?vid=${vid}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('播放记录接口响应:', res);
      
      if (res && res.data && res.data.data) {
        const userVideoData = res.data.data;
        console.log('用户视频互动数据:', userVideoData);
        
        // 更新点赞状态到页面数据
        this.setData({
          'video.isLiked': userVideoData.love === 1,
          'video.isDisliked': userVideoData.unlove === 1,
          'video.isCoined': userVideoData.coin === 1,
          'video.isCollected': userVideoData.collect === 1
        });
        
        console.log('用户互动状态已更新:', {
          isLiked: userVideoData.love === 1,
          isDisliked: userVideoData.unlove === 1,
          isCoined: userVideoData.coin === 1,
          isCollected: userVideoData.collect === 1
        });
      } else {
        console.log('播放记录接口响应格式异常:', res);
      }
    } catch (error) {
      console.error('记录用户播放行为失败:', error);
      // 不显示错误提示，避免影响用户体验
    }
  },

  // 点赞状态变化回调
  onLikeChange(e) {
    const { isLiked, isDisliked, likeCount, dislikeCount } = e.detail;
    
    // 更新视频数据中的点赞状态
    this.setData({
      'video.isLiked': isLiked,
      'video.isDisliked': isDisliked,
      'video.stats.good': likeCount,
      'video.stats.bad': dislikeCount
    });

    console.log('点赞状态更新:', {
      isLiked,
      isDisliked,
      likeCount,
      dislikeCount
    });
  }
});

