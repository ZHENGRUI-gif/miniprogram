/**
 * WebSocket管理器 - 实现实时消息推送
 * 参考blbl项目的IMServer实现
 */

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isConnected = false;
    this.isConnecting = false; // 添加连接中状态
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.token = null; // 添加token属性
    this.shouldReconnect = true; // 添加重连控制标志
    this.connectionTimeout = null; // 添加连接超时定时器
  }

  // 连接WebSocket
  connect(token) {
    return new Promise((resolve, reject) => {
      // 如果没有传入token，尝试从存储中获取
      if (!token) {
        token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      }
      
      if (!token) {
        console.log('没有token，无法连接WebSocket');
        this.token = "未设置";
        reject(new Error('Token未设置'));
        return;
      }

      // 如果正在连接中，跳过重复连接
      if (this.isConnecting) {
        console.log('WebSocket正在连接中，跳过重复连接');
        resolve();
        return;
      }

      // 如果已经连接，跳过重复连接
      if (this.isConnected) {
        console.log('WebSocket已连接，跳过重复连接');
        resolve();
        return;
      }

      this.isConnecting = true;
      this.token = token; // 保存token
      this.shouldReconnect = true;

      const config = require('./config');
      const wsUrl = config.imWSURL;
      
      console.log('正在连接WebSocket:', wsUrl);
      console.log('使用token:', token.substring(0, 20) + '...');

      // 先清理现有连接
      if (this.socket) {
        this.cleanupSocket();
      }
      
      try {
        this.socket = wx.connectSocket({
          url: wsUrl,
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: () => {
            console.log('WebSocket连接请求发送成功');
          },
          fail: (error) => {
            console.error('WebSocket连接请求失败:', error);
            this.isConnecting = false;
            this.handleConnectionError(error);
            reject(error);
          }
        });

        // 设置连接超时
        this.connectionTimeout = setTimeout(() => {
          if (this.isConnecting) {
            console.log('WebSocket连接超时');
            this.cleanupSocket();
            this.isConnecting = false;
            this.handleConnectionError(new Error('连接超时'));
            reject(new Error('连接超时'));
          }
        }, 10000); // 10秒超时

      } catch (error) {
        console.error('创建WebSocket连接异常:', error);
        this.isConnecting = false;
        this.handleConnectionError(error);
        reject(error);
        return;
      }

      this.socket.onOpen(() => {
        console.log('WebSocket连接成功');
        clearTimeout(this.connectionTimeout);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // 发送认证信息
        this.sendAuth();
        
        this.startHeartbeat();
        
        // 通知应用连接成功
        const app = getApp();
        if (app) {
          app.globalData.wsConnected = true;
          if (app.onWebSocketConnected) {
            app.onWebSocketConnected();
          }
          // 触发页面更新
          app.triggerMsgUpdate();
        }
        
        // 显示连接成功提示
        wx.showToast({
          title: 'WebSocket连接成功',
          icon: 'success',
          duration: 2000
        });
        
        resolve();
      });

      this.socket.onMessage((res) => {
        try {
          const data = JSON.parse(res.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      });

      this.socket.onClose((res) => {
        console.log('WebSocket连接关闭:', res);
        clearTimeout(this.connectionTimeout);
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        
        // 清理socket引用
        this.socket = null;
        
        // 更新全局连接状态
        const app = getApp();
        if (app) {
          app.globalData.wsConnected = false;
          app.triggerMsgUpdate();
        }
        
        // 分析关闭原因
        this.analyzeCloseReason(res);
        
        // 如果不是主动关闭且允许重连，则尝试重连
        if (res.code !== 1000 && this.shouldReconnect) {
          this.reconnect();
        }
      });

      this.socket.onError((error) => {
        console.error('WebSocket错误:', error);
        clearTimeout(this.connectionTimeout);
        this.isConnected = false;
        this.isConnecting = false;
        this.socket = null;
        
        // 更新全局连接状态
        const app = getApp();
        if (app) {
          app.globalData.wsConnected = false;
          app.triggerMsgUpdate();
        }
        
        this.handleConnectionError(error);
        reject(error);
      });
    });
  }

  // 清理socket连接
  cleanupSocket() {
    if (this.socket) {
      try {
        // 移除所有事件监听器
        this.socket.onOpen = null;
        this.socket.onMessage = null;
        this.socket.onClose = null;
        this.socket.onError = null;
        
        // 关闭连接
        this.socket.close({
          code: 1000,
          reason: '清理连接'
        });
      } catch (error) {
        console.error('清理WebSocket连接异常:', error);
      }
      this.socket = null;
    }
  }

  // 处理连接错误
  handleConnectionError(error) {
    console.error('WebSocket连接错误:', error);
    
    // 显示连接失败提示
    wx.showToast({
      title: 'WebSocket连接失败',
      icon: 'error',
      duration: 2000
    });
  }

  // 分析连接关闭原因
  analyzeCloseReason(res) {
    const closeCodes = {
      1000: '正常关闭',
      1001: '端点离开',
      1002: '协议错误',
      1003: '不支持的数据类型',
      1006: '异常关闭',
      1011: '服务器错误',
      1012: '服务重启',
      1013: '稍后再试',
      1014: '网关错误',
      1015: 'TLS握手失败'
    };
    
    const reason = closeCodes[res.code] || `未知原因(${res.code})`;
    console.log(`WebSocket关闭原因: ${reason}, 原因: ${res.reason || '无'}`);
    
    // 根据关闭原因决定是否重连
    if (res.code === 1006) {
      console.log('检测到异常关闭，可能是网络问题');
    } else if (res.code === 1011) {
      console.log('服务器错误，稍后重连');
    }
  }

  // 发送认证信息 - 按照blbl项目的认证机制
  sendAuth() {
    if (this.socket && this.isConnected && this.token) {
      // 确保认证消息格式与后端期望完全一致
      const authMessage = {
        code: 100,
        content: "Bearer " + this.token
      };
      
      try {
        this.socket.send({
          data: JSON.stringify(authMessage),
          success: () => {
            console.log('认证信息发送成功:', authMessage);
          },
          fail: (error) => {
            console.error('认证信息发送失败:', error);
          }
        });
      } catch (error) {
        console.error('发送认证信息异常:', error);
      }
    } else {
      console.warn('无法发送认证信息:', {
        hasSocket: !!this.socket,
        isConnected: this.isConnected,
        hasToken: !!this.token
      });
    }
  }

  // 处理消息 - 参考blbl项目的handleWsMessage
  handleMessage(data) {
    console.log('收到WebSocket消息:', data);
    
    const app = getApp();
    if (!app || !app.globalData) return;

    // 根据消息类型更新未读数量
    switch(data.type) {
      case 'love': // 收到的赞
        if(data.data && data.data.type === '接收') {
          this.updateUnreadCount('love', 1);
          this.showNotification('收到新的点赞');
        } else if(data.data && data.data.type === '全部已读') {
          this.updateUnreadCount('love', 0, true); // 清除未读数
        }
        break;
        
      case 'reply': // 回复我的
        if(data.data && data.data.type === '接收') {
          this.updateUnreadCount('reply', 1);
          this.showNotification('收到新的回复');
        } else if(data.data && data.data.type === '全部已读') {
          this.updateUnreadCount('reply', 0, true);
        }
        break;
        
      case 'at': // @我的
        if(data.data && data.data.type === '接收') {
          this.updateUnreadCount('at', 1);
          this.showNotification('有人@了你');
        } else if(data.data && data.data.type === '全部已读') {
          this.updateUnreadCount('at', 0, true);
        }
        break;
        
      case 'whisper': // 私聊消息
        if(data.data && data.data.type === '接收') {
          this.updateUnreadCount('whisper', 1);
          this.showNotification('收到新的私聊');
        } else if(data.data && data.data.type === '全部已读') {
          this.updateUnreadCount('whisper', 0, true);
        }
        break;
        
      case 'dynamic': // 动态
        if(data.data && data.data.type === '接收') {
          this.updateUnreadCount('dynamic', 1);
          this.showNotification('收到新的动态');
        } else if(data.data && data.data.type === '全部已读') {
          this.updateUnreadCount('dynamic', 0, true);
        }
        break;
        
      case 'CONNETION': // 心跳响应
        console.log('收到心跳响应');
        break;
        
      default:
        console.log('未知消息类型:', data.type);
    }
  }

  // 更新未读数量
  updateUnreadCount(type, count, isClear = false) {
    const app = getApp();
    if (!app || !app.globalData) return;

    const msgTypes = ['reply', 'at', 'love', 'system', 'whisper', 'dynamic'];
    const index = msgTypes.indexOf(type);
    
    if (index !== -1) {
      if (isClear) {
        app.globalData.msgUnread[index] = 0;
      } else {
        app.globalData.msgUnread[index] += count;
      }
      
      console.log(`更新${type}未读数量:`, app.globalData.msgUnread[index]);
      
      // 触发页面更新
      app.triggerMsgUpdate();
    }
  }

  // 显示通知
  showNotification(message) {
    // 检查是否允许显示通知
    const notificationEnabled = wx.getStorageSync('notificationEnabled');
    if (notificationEnabled === false) return;

    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  }

  // 心跳检测 - 按照blbl项目的实现
  startHeartbeat() {
    this.stopHeartbeat(); // 先清除之前的定时器
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.isConnected && this.token) {
        try {
          // 按照blbl项目的心跳格式，与认证消息格式保持一致
          const heartbeat = {
            code: 100, // 连接保持
            content: "Bearer " + this.token
          };
          this.socket.send({
            data: JSON.stringify(heartbeat),
            success: () => {
              console.log('心跳发送成功');
            },
            fail: (error) => {
              console.error('心跳发送失败:', error);
            }
          });
        } catch (error) {
          console.error('发送心跳异常:', error);
        }
      }
    }, 30000); // 30秒发送一次心跳
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 重连机制
  reconnect() {
    if (!this.shouldReconnect) {
      console.log('重连被禁用');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('达到最大重连次数，停止重连');
      wx.showToast({
        title: '连接失败，请检查网络',
        icon: 'error'
      });
      return;
    }

    if (this.reconnectTimer) {
      console.log('重连定时器已存在，跳过');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // 指数退避，最大10秒
    
    console.log(`WebSocket重连尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}，${delay}ms后重连`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('重连WebSocket，使用token:', this.token ? this.token.substring(0, 20) + '...' : '无token');
      
      this.connect().catch(error => {
        console.error('重连失败:', error);
      });
    }, delay);
  }

  // 断开连接
  disconnect() {
    console.log('主动断开WebSocket连接');
    this.shouldReconnect = false; // 禁用重连
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    this.cleanupSocket();
    
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    // 注意：不断开连接时不清除token，保持token状态
  }

  // 发送消息
  sendMessage(message) {
    if (this.socket && this.isConnected) {
      try {
        this.socket.send({
          data: JSON.stringify(message)
        });
        return true;
      } catch (error) {
        console.error('发送消息失败:', error);
        return false;
      }
    }
    return false;
  }

  // 获取连接状态
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      token: this.token || "未设置",
      shouldReconnect: this.shouldReconnect,
      hasConnectionTimeout: !!this.connectionTimeout
    };
  }
}

// 导出单例
module.exports = new WebSocketManager();
