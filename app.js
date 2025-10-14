const WebSocketManager = require('./utils/websocket');
const config = require('./utils/config');

App({
  globalData: {
    token: '',
    userInfo: null,
    // 后端API基础地址
    baseUrl: config.baseURL,
    // 未读消息数组，对应6种消息类型：['reply', 'at', 'love', 'system', 'whisper', 'dynamic']
    msgUnread: [0, 0, 0, 0, 0, 0],
    // 消息类型名称
    msgTypeNames: ['回复我的', '@ 我的', '收到的赞', '系统通知', '我的消息', '动态'],
    // WebSocket连接状态
    wsConnected: false,
    // 收藏状态管理
    favoriteStatus: new Map(), // 存储视频收藏状态 {vid: {isCollected: boolean, collectCount: number}}
    userFavorites: [] // 用户收藏夹列表
  },
  onLaunch() {
    try {
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token') || '';
      this.globalData.token = token;
      
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
      }
      
      console.log('App启动，token状态:', token ? '已设置' : '未设置');
      if (token) {
        console.log('Token内容:', token.substring(0, 20) + '...');
      }
      
      // 如果有token，连接WebSocket并获取初始未读消息数量
      if (token) {
        this.connectWebSocket();
        this.fetchInitialUnreadCount();
      } else {
        console.log('没有token，跳过WebSocket连接');
      }
    } catch (e) {
      console.error('App启动失败:', e);
    }
  },

  // 获取初始未读消息数量
  async fetchInitialUnreadCount() {
    const token = this.globalData.token;
    if (!token) return;

    try {
      const { request } = require('./utils/request');
      
      // 尝试多个可能的API端点
      const endpoints = ['/msg-unread/all', '/msg-unread/count', '/message/unread'];
      let success = false;
      
      for (const endpoint of endpoints) {
        try {
          const res = await request({
            url: endpoint,
            method: 'GET'
          });

          if (res && res.data) {
            // 假设后端返回格式：{ reply: 0, at: 0, love: 0, system: 0, whisper: 0, dynamic: 0 }
            const msgTypes = ['reply', 'at', 'love', 'system', 'whisper', 'dynamic'];
            const newUnread = msgTypes.map(type => res.data[type] || 0);
            
            this.globalData.msgUnread = newUnread;
            console.log('初始未读消息数量:', newUnread);
            
            // 触发页面更新
            this.triggerMsgUpdate();
            success = true;
            break;
          }
        } catch (endpointError) {
          console.log(`API端点 ${endpoint} 失败:`, endpointError.message);
          continue;
        }
      }
      
      if (!success) {
        console.log('所有消息API端点都失败，使用默认值');
        this.globalData.msgUnread = [0, 0, 0, 0, 0, 0];
        this.triggerMsgUpdate();
      }
    } catch (error) {
      console.error('获取初始未读消息数量失败:', error);
      // 使用默认值
      this.globalData.msgUnread = [0, 0, 0, 0, 0, 0];
      this.triggerMsgUpdate();
    }
  },

  // 触发消息更新 - 通知所有页面更新消息状态
  triggerMsgUpdate() {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.onMsgUpdate && typeof page.onMsgUpdate === 'function') {
        page.onMsgUpdate();
      }
    });
  },

  // 获取总未读消息数量（只计算前5种消息类型，排除dynamic）
  getTotalUnreadCount() {
    let count = 0;
    for (let i = 0; i < 5; i++) {  // 只计算前5种消息类型
      count += this.globalData.msgUnread[i];
    }
    return count;
  },

  // 获取指定类型的未读消息数量
  getUnreadCount(type) {
    const msgTypes = ['reply', 'at', 'love', 'system', 'whisper', 'dynamic'];
    const index = msgTypes.indexOf(type);
    return index !== -1 ? this.globalData.msgUnread[index] : 0;
  },

  // 连接WebSocket
  async connectWebSocket() {
    const token = this.globalData.token;
    if (token) {
      // 确保WebSocket管理器有正确的token
      WebSocketManager.token = token;
      WebSocketManager.shouldReconnect = true;
      
      try {
        await WebSocketManager.connect(token);
        console.log('WebSocket连接成功');
      } catch (error) {
        console.error('WebSocket连接失败:', error);
      }
    } else {
      console.log('没有token，无法连接WebSocket');
      WebSocketManager.token = "未设置";
    }
  },

  // 断开WebSocket
  disconnectWebSocket() {
    WebSocketManager.disconnect();
  },

  // WebSocket连接成功回调
  onWebSocketConnected() {
    this.globalData.wsConnected = true;
    console.log('WebSocket连接成功');
  },

  // 登录后连接WebSocket
  async onLogin(token) {
    this.globalData.token = token;
    wx.setStorageSync('teri_token', token);
    console.log('用户登录，保存token:', token.substring(0, 20) + '...');
    
    // 同步token到WebSocket管理器
    WebSocketManager.token = token;
    
    try {
      this.connectWebSocket();
      await this.fetchInitialUnreadCount();
      console.log('登录后WebSocket连接成功');
    } catch (error) {
      console.error('登录后WebSocket连接失败:', error);
    }
  },

  // 登出时断开WebSocket
  onLogout() {
    this.disconnectWebSocket();
    this.globalData.token = '';
    this.globalData.userInfo = null;
    this.globalData.msgUnread = [0, 0, 0, 0, 0, 0];
    this.globalData.favoriteStatus.clear();
    this.globalData.userFavorites = [];
    wx.removeStorageSync('teri_token');
    wx.removeStorageSync('userInfo');
    
    // 清除WebSocket管理器的token
    WebSocketManager.token = "未设置";
    
    console.log('用户登出，清除token和WebSocket连接');
  },

  // 更新视频收藏状态
  updateFavoriteStatus(vid, isCollected, collectCount) {
    this.globalData.favoriteStatus.set(vid, {
      isCollected,
      collectCount
    });
    
    // 通知所有页面更新收藏状态
    this.triggerFavoriteUpdate(vid, isCollected, collectCount);
  },

  // 获取视频收藏状态
  getFavoriteStatus(vid) {
    return this.globalData.favoriteStatus.get(vid) || {
      isCollected: false,
      collectCount: 0
    };
  },

  // 触发收藏状态更新 - 通知所有页面更新收藏状态
  triggerFavoriteUpdate(vid, isCollected, collectCount) {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.onFavoriteUpdate && typeof page.onFavoriteUpdate === 'function') {
        page.onFavoriteUpdate(vid, isCollected, collectCount);
      }
    });
  },

  // 更新用户收藏夹列表
  updateUserFavorites(favorites) {
    this.globalData.userFavorites = favorites;
    
    // 通知所有页面更新收藏夹列表
    this.triggerFavoritesUpdate(favorites);
  },

  // 触发收藏夹列表更新
  triggerFavoritesUpdate(favorites) {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.onFavoritesUpdate && typeof page.onFavoritesUpdate === 'function') {
        page.onFavoritesUpdate(favorites);
      }
    });
  }
});