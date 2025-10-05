// 调试页面
Page({
  data: {
    wsStatus: {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      maxAttempts: 5,
      globalWsConnected: false,
      token: null
    },
    logs: []
  },

  onLoad() {
    this.addLog('调试页面加载完成');
    this.updateWsStatus();
  },

  // 添加日志
  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${message}`;
    console.log(log);
    
    this.setData({
      logs: [...this.data.logs, log].slice(-20) // 只保留最近20条日志
    });
  },

  // 更新WebSocket状态
  updateWsStatus() {
    const WebSocketManager = require('../../utils/websocket');
    const status = WebSocketManager.getConnectionStatus();
    this.setData({
      wsStatus: status
    });
  },

  // 手动连接WebSocket
  async connectWebSocket() {
    this.addLog('手动连接WebSocket...');
    try {
      const WebSocketManager = require('../../utils/websocket');
      const token = wx.getStorageSync('teri_token');
      if (token) {
        await WebSocketManager.connect(token);
        this.addLog('WebSocket连接成功');
      } else {
        this.addLog('没有token，无法连接WebSocket');
      }
    } catch (error) {
      this.addLog(`WebSocket连接失败: ${error.message}`);
    }
    this.updateWsStatus();
  },

  // 断开WebSocket连接
  disconnectWebSocket() {
    this.addLog('断开WebSocket连接...');
    const WebSocketManager = require('../../utils/websocket');
    WebSocketManager.disconnect();
    this.addLog('WebSocket连接已断开');
    this.updateWsStatus();
  },

  // 测试HTTP连接
  async testHttpConnection() {
    this.addLog('测试HTTP连接...');
    try {
      const { request } = require('../../utils/request');
      const res = await request({
        url: '/msg-unread/all',
        method: 'GET'
      });
      this.addLog(`HTTP请求成功: ${JSON.stringify(res.data)}`);
    } catch (error) {
      this.addLog(`HTTP请求失败: ${error.message}`);
    }
  },

  // 测试WebSocket连接（简单测试）
  async testWebSocketConnection() {
    this.addLog('测试WebSocket连接...');
    
    return new Promise((resolve) => {
      const config = require('../../utils/config');
      const wsUrl = config.imWSURL;
      
      this.addLog(`连接地址: ${wsUrl}`);
      
      const socket = wx.connectSocket({
        url: wsUrl,
        success: () => {
          this.addLog('WebSocket连接请求发送成功');
        },
        fail: (error) => {
          this.addLog(`WebSocket连接请求失败: ${JSON.stringify(error)}`);
          resolve(false);
        }
      });

      const timeout = setTimeout(() => {
        socket.close();
        this.addLog('WebSocket连接超时');
        resolve(false);
      }, 5000);

      socket.onOpen(() => {
        clearTimeout(timeout);
        this.addLog('WebSocket连接成功');
        socket.close();
        resolve(true);
      });

      socket.onError((error) => {
        clearTimeout(timeout);
        this.addLog(`WebSocket连接错误: ${JSON.stringify(error)}`);
        resolve(false);
      });

      socket.onClose((res) => {
        clearTimeout(timeout);
        this.addLog(`WebSocket连接关闭: code=${res.code}, reason=${res.reason}`);
        if (res.code === 1000) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },

  // 运行网络诊断
  async runDiagnostic() {
    this.addLog('开始网络诊断...');
    
    // 测试HTTP连接
    await this.testHttpConnection();
    
    // 测试WebSocket连接
    const wsResult = await this.testWebSocketConnection();
    
    if (wsResult) {
      this.addLog('网络诊断完成：连接正常');
    } else {
      this.addLog('网络诊断完成：连接异常');
    }
  },

  // 清除日志
  clearLogs() {
    this.setData({
      logs: []
    });
    this.addLog('日志已清除');
  },

  // 刷新状态
  refreshStatus() {
    this.updateWsStatus();
    this.addLog('状态已刷新');
  },

  // 检查token
  checkToken() {
    const token = wx.getStorageSync('teri_token');
    if (token) {
      this.addLog(`Token存在: ${token.substring(0, 20)}...`);
    } else {
      this.addLog('Token不存在');
    }
  }
});