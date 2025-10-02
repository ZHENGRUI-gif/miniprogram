const { request } = require('../../utils/request');

Page({
  data: {
    logs: [],
    testResults: {}
  },
  
  onLoad() {
    this.addLog('调试页面已加载');
  },
  
  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logs = this.data.logs.concat([`[${timestamp}] ${message}`]);
    this.setData({ logs });
    console.log(message);
  },
  
  async testEndpoints() {
    this.addLog('开始测试 /api/endpoints 接口...');
    try {
      const res = await request({ url: '/api/endpoints' });
      this.addLog(`endpoints 响应: ${JSON.stringify(res).substring(0, 200)}...`);
      this.setData({ 'testResults.endpoints': res });
    } catch (error) {
      this.addLog(`endpoints 错误: ${error.message || error}`);
    }
  },
  
  async testBasicConnection() {
    this.addLog('开始测试基本连接...');
    try {
      const res = await request({ url: '/video/random/visitor' });
      this.addLog(`基本连接成功，响应: ${JSON.stringify(res).substring(0, 200)}...`);
      
      if (res && res.data && Array.isArray(res.data)) {
        this.addLog(`视频列表数量: ${res.data.length}`);
        if (res.data.length > 0) {
          const firstVideo = res.data[0];
          this.addLog(`第一个视频数据结构:`);
          this.addLog(`- video字段: ${Object.keys(firstVideo.video || {}).join(', ')}`);
          this.addLog(`- coverUrl: ${firstVideo.video?.coverUrl || '未找到'}`);
          this.addLog(`- title: ${firstVideo.video?.title || '未找到'}`);
          this.addLog(`- duration: ${firstVideo.video?.duration || '未找到'}`);
        }
      }
      
      this.setData({ 'testResults.basic': res });
    } catch (error) {
      this.addLog(`基本连接错误: ${error.message || error}`);
    }
  },
  
  async testVideoInfo() {
    this.addLog('开始测试视频信息接口...');
    try {
      const res = await request({ url: '/video/getone', data: { vid: 15 } });
      this.addLog(`视频信息响应: ${JSON.stringify(res).substring(0, 200)}...`);
      
      if (res && res.data && res.data.video) {
        this.addLog(`video对象字段: ${Object.keys(res.data.video).join(', ')}`);
        this.addLog(`video对象内容: ${JSON.stringify(res.data.video, null, 2)}`);
      }
      
      this.setData({ 'testResults.video': res });
    } catch (error) {
      this.addLog(`视频信息错误: ${error.message || error}`);
    }
  },
  
  async testDanmuList() {
    this.addLog('开始测试弹幕列表接口...');
    try {
      const res = await request({ url: '/danmu-list/15' });
      this.addLog(`弹幕列表响应: ${JSON.stringify(res).substring(0, 200)}...`);
      this.setData({ 'testResults.danmu': res });
    } catch (error) {
      this.addLog(`弹幕列表错误: ${error.message || error}`);
    }
  },
  
  async testUserInfo() {
    this.addLog('开始测试用户信息接口...');
    try {
      const res = await request({ url: '/user/personal/info' });
      this.addLog(`用户信息响应: ${JSON.stringify(res).substring(0, 200)}...`);
      this.setData({ 'testResults.user': res });
    } catch (error) {
      this.addLog(`用户信息错误: ${error.message || error}`);
    }
  },
  
  async testPlayUrl() {
    this.addLog('开始测试视频播放接口...');
    try {
      const res = await request({ url: '/video/play/visitor', data: { vid: 15 } });
      this.addLog(`播放接口响应: ${JSON.stringify(res, null, 2)}`);
      this.setData({ 'testResults.playUrl': res });
    } catch (error) {
      this.addLog(`播放接口错误: ${error.message || error}`);
    }
  },
  
  testWebSocket() {
    this.addLog('开始测试WebSocket连接...');
    const { wsURL } = require('../../utils/config');
    const url = `${wsURL}/ws/danmu/2`;
    this.addLog(`WebSocket URL: ${url}`);
    
    wx.connectSocket({ 
      url,
      success: () => {
        this.addLog('WebSocket连接请求已发送');
      },
      fail: (error) => {
        this.addLog(`WebSocket连接失败: ${JSON.stringify(error)}`);
      }
    });
    
    wx.onSocketOpen(() => {
      this.addLog('WebSocket连接成功');
      wx.closeSocket();
    });
    
    wx.onSocketError((error) => {
      this.addLog(`WebSocket错误: ${JSON.stringify(error)}`);
    });
    
    wx.onSocketClose(() => {
      this.addLog('WebSocket连接关闭');
    });
  },
  
  clearLogs() {
    this.setData({ logs: [], testResults: {} });
  },
  
  copyLogs() {
    const logsText = this.data.logs.join('\n');
    wx.setClipboardData({
      data: logsText,
      success: () => {
        wx.showToast({ title: '日志已复制', icon: 'success' });
      }
    });
  }
});
