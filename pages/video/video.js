const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');
const config = require('../../utils/config');

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
    videoLoadError: false,
    // 收藏弹窗与状态
    favDialogVisible: false,
    collectedFids: [],
    // 弹幕相关
    currentTime: 0,
    danmuEnabled: true,
    danmuOpacity: 0.8,
    danmuSpeed: 2,
    token: ''
  },
  
  // 私有变量
  _lastTime: 0,
  _lastUpdateTime: 0,
  async onLoad(query) {
    const vid = Number(query.vid || 0);
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token') || '';
    
    this.setData({ 
      vid,
      token
    });
    
    // 先获取视频数据
    await this.fetchVideo(vid);
    
    // 然后获取其他数据
    this.fetchDanmu(vid);
    this.connectWS(vid);
    
    // 最后记录用户播放行为，创建UserVideo记录
    this.recordUserPlay(vid);
    // 获取该视频用户已收藏的收藏夹ID
    this.fetchCollectedFids(vid);
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
    try {
      const res = await request({ url: `/danmu-list/${vid}` });
      if (Array.isArray(res.data)) {
        // 按时间排序弹幕
        const list = res.data.sort((a, b) => a.timePoint - b.timePoint);
        this.setData({ danmus: list });
        console.log('弹幕数据加载完成:', list.length, '条');
        
        // 如果有历史弹幕，显示提示
        if (list.length > 0) {
          wx.showToast({
            title: `已加载${list.length}条历史弹幕`,
            icon: 'none',
            duration: 2000
          });
        }
      }
    } catch (error) {
      console.error('获取弹幕失败:', error);
    }
  },
  connectWS(vid) {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token') || '';
    const url = `${config.wsURL}/ws/danmu/${vid}`;
    const that = this;
    
    console.log('尝试连接WebSocket:', url);
    console.log('当前token状态:', token ? '已设置' : '未设置');
    
    // 先关闭之前的连接
    try {
      wx.closeSocket();
    } catch (e) {
      console.log('关闭旧连接失败:', e);
    }
    
    wx.connectSocket({ 
      url,
      success: () => {
        console.log('WebSocket连接请求已发送');
      },
      fail: (error) => {
        console.error('WebSocket连接失败:', error);
        that.setData({ socketOpen: false });
        
        // 显示具体错误信息
        let errorMsg = '弹幕连接失败';
        if (error.errMsg) {
          if (error.errMsg.includes('timeout')) {
            errorMsg = '连接超时，请检查网络';
          } else if (error.errMsg.includes('fail')) {
            errorMsg = '服务器连接失败';
          } else if (error.errMsg.includes('domain')) {
            errorMsg = '域名未配置，请联系管理员';
          }
        }
        
        wx.showToast({ 
          title: errorMsg, 
          icon: 'none',
          duration: 3000
        });
        
        // 3秒后重试连接
        setTimeout(() => {
          console.log('重试连接WebSocket');
          that.connectWS(vid);
        }, 3000);
      }
    });
    
    wx.onSocketOpen(() => { 
      console.log('WebSocket连接成功');
      that.setData({ socketOpen: true });
      
      wx.showToast({
        title: '弹幕连接成功',
        icon: 'success',
        duration: 1000
      });
    });
    
    wx.onSocketError((error) => {
      console.error('WebSocket错误:', error);
      that.setData({ socketOpen: false });
      
      wx.showToast({
        title: '弹幕连接错误',
        icon: 'none',
        duration: 2000
      });
    });
    
    wx.onSocketClose((res) => {
      console.log('WebSocket连接关闭:', res);
      that.setData({ socketOpen: false });
      
      // 如果不是主动关闭，尝试重连
      if (res.code !== 1000) {
        console.log('连接异常关闭，尝试重连');
        setTimeout(() => {
          that.connectWS(vid);
        }, 2000);
      }
    });
    
    wx.onSocketMessage(({ data }) => {
      try {
        // 处理观看人数消息
        if (data.includes('当前观看人数')) {
          console.log('观看人数更新:', data);
          return;
        }
        
        const dm = JSON.parse(data);
        console.log('收到新弹幕:', dm);
        
        // 添加新弹幕到列表
        const list = [...that.data.danmus, dm].sort((a, b) => a.timePoint - b.timePoint);
        that.setData({ danmus: list });
        
        // 如果是当前时间附近的弹幕，立即显示
        const currentTime = that.data.currentTime;
        if (Math.abs(dm.timePoint - currentTime) <= 1) {
          const danmuDisplay = that.selectComponent('danmu-display');
          if (danmuDisplay) {
            danmuDisplay.addDanmu(dm);
          }
        }
      } catch (e) {
        console.log('非弹幕消息:', data);
      }
    });
    
    this._token = token;
  },
  onUnload() {
    try { wx.closeSocket(); } catch (e) {}
  },
  onTimeUpdate(e) {
    const currentTime = e.detail.currentTime || 0;
    this._currentTime = currentTime;
    
    // 降低更新频率，每0.5秒更新一次弹幕时间
    if (!this._lastUpdateTime || currentTime - this._lastUpdateTime >= 0.5) {
      this.setData({ currentTime });
      this._lastUpdateTime = currentTime;
    }
    
    // 如果播放时间回到0，说明视频重新开始播放，需要记录播放行为
    if (currentTime === 0 && this._lastTime > 0) {
      console.log('视频重新开始播放，记录播放行为');
      this.recordUserPlay(this.data.vid);
    }
    
    this._lastTime = currentTime;
  },
  onInput(e) { this.setData({ inputDm: e.detail.value }); },
  // 切换弹幕开关
  toggleDanmu() {
    this.setData({ 
      danmuEnabled: !this.data.danmuEnabled 
    });
    
    wx.showToast({
      title: this.data.danmuEnabled ? '弹幕已开启' : '弹幕已关闭',
      icon: 'none',
      duration: 1000
    });
  },

  // 手动重连弹幕
  reconnectDanmu() {
    console.log('手动重连弹幕');
    this.connectWS(this.data.vid);
  },
  // 获取已收藏该视频的收藏夹ID
  async fetchCollectedFids(vid) {
    try {
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      if (!token) return;
      const res = await request({ url: '/video/collected-fids', data: { vid }, headers: { Authorization: `Bearer ${token}` } });
      if (res && res.data) {
        this.setData({ collectedFids: res.data });
      }
    } catch (e) {
      // 静默失败
    }
  },
  // 打开收藏弹窗
  openFavoriteDialog() {
    const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
    if (!token) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    this.setData({ favDialogVisible: true });
  },
  // 关闭收藏弹窗
  closeFavoriteDialog() { this.setData({ favDialogVisible: false }); },
  // 收藏提交回调
  onFavoriteSubmitted(e) {
    const { fids, addCount, removeCount } = e.detail || {};
    this.setData({ collectedFids: Array.from(fids || []), favDialogVisible: false });
    // 同步更新视频收藏数（与Web端逻辑保持一致：增加addCount，减少removeCount不在此处理或按需处理）
    try {
      const current = Number(this.data.video?.stats?.collect || 0);
      const next = current + Number(addCount || 0);
      this.setData({ 'video.stats.collect': next });
    } catch (_) {}
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
      console.log('响应数据结构检查:', {
        hasRes: !!res,
        hasData: !!(res && res.data),
        hasDataData: !!(res && res.data && res.data.data),
        resData: res?.data,
        resDataData: res?.data?.data
      });
      
      // 检查响应格式，兼容不同的数据结构
      let userVideoData = null;
      if (res && res.data) {
        // 尝试不同的数据路径
        userVideoData = res.data.data || res.data;
        console.log('用户视频互动数据:', userVideoData);
        
        // 检查数据是否包含用户互动信息
        if (userVideoData && (userVideoData.love !== undefined || userVideoData.unlove !== undefined)) {
          // 更新点赞状态到页面数据
          this.setData({
            'video.isLiked': userVideoData.love === 1,
            'video.isDisliked': userVideoData.unlove === 1,
            'video.isCoined': userVideoData.coin === 1,
            'video.isCollected': userVideoData.collect === 1
          });
          
          // 同步更新like-button组件的状态
          const likeButton = this.selectComponent('like-button');
          if (likeButton) {
            const updateData = {
              isLiked: userVideoData.love === 1,
              isDisliked: userVideoData.unlove === 1,
              likeCount: this.data.video.stats.good || 0,
              dislikeCount: this.data.video.stats.bad || 0
            };
            
            console.log('准备更新like-button组件状态:', updateData);
            console.log('userVideoData原始数据:', userVideoData);
            console.log('video.stats数据:', this.data.video.stats);
            
            likeButton.updateLikeStatus(updateData);
          } else {
            console.log('未找到like-button组件');
          }
          
          console.log('用户互动状态已更新:', {
            isLiked: userVideoData.love === 1,
            isDisliked: userVideoData.unlove === 1,
            isCoined: userVideoData.coin === 1,
            isCollected: userVideoData.collect === 1
          });
        } else {
          console.log('用户互动数据格式不正确:', userVideoData);
        }
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
  },

  // 收藏状态变化回调
  onFavoriteChange(e) {
    const { isCollected, collectCount, selectedFavorites } = e.detail;
    
    // 更新视频数据中的收藏状态
    this.setData({
      'video.isCollected': isCollected,
      'video.stats.collect': collectCount
    });

    console.log('收藏状态更新:', {
      isCollected,
      collectCount,
      selectedFavorites
    });
  },

  // 全局收藏状态更新回调
  onFavoriteUpdate(vid, isCollected, collectCount) {
    if (vid === this.data.vid) {
      this.setData({
        'video.isCollected': isCollected,
        'video.stats.collect': collectCount
      });
    }
  }
});

