Component({
  properties: {
    // 视频ID
    videoId: {
      type: Number,
      value: 0
    },
    // 当前播放时间
    currentTime: {
      type: Number,
      value: 0
    },
    // WebSocket连接状态
    socketConnected: {
      type: Boolean,
      value: false
    },
    // 用户token
    token: {
      type: String,
      value: ''
    }
  },

  data: {
    inputValue: '',
    showInput: false,
    danmuStyle: {
      fontSize: 24,
      mode: 1, // 1: 滚动, 2: 顶部, 3: 底部
      color: '#ffffff'
    },
    colorOptions: [
      '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
      '#ffff00', '#ff00ff', '#00ffff', '#ff8000',
      '#8000ff', '#ff0080', '#80ff00', '#0080ff'
    ],
    modeOptions: [
      { value: 1, label: '滚动' },
      { value: 2, label: '顶部' },
      { value: 3, label: '底部' }
    ]
  },

  methods: {
    // 显示输入框
    showInputBox() {
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      if (!token) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      if (!this.data.socketConnected) {
        wx.showToast({
          title: '弹幕连接未建立',
          icon: 'none'
        });
        return;
      }

      this.setData({ showInput: true });
    },

    // 隐藏输入框
    hideInputBox() {
      this.setData({ 
        showInput: false,
        inputValue: ''
      });
    },

    // 输入内容变化
    onInputChange(e) {
      this.setData({ inputValue: e.detail.value });
    },

    // 发送弹幕
    sendDanmu() {
      const content = this.data.inputValue.trim();
      if (!content) {
        wx.showToast({
          title: '请输入弹幕内容',
          icon: 'none'
        });
        return;
      }

      if (content.length > 50) {
        wx.showToast({
          title: '弹幕内容不能超过50字',
          icon: 'none'
        });
        return;
      }

      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      if (!token) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      if (!this.data.socketConnected) {
        wx.showToast({
          title: '弹幕连接未建立',
          icon: 'none'
        });
        return;
      }

      // 构建弹幕数据
      const danmuData = {
        token: `Bearer ${token}`,
        data: {
          content: content,
          fontsize: this.data.danmuStyle.fontSize,
          mode: this.data.danmuStyle.mode,
          color: this.data.danmuStyle.color,
          timePoint: this.data.currentTime
        }
      };

      // 发送WebSocket消息
      wx.sendSocketMessage({
        data: JSON.stringify(danmuData),
        success: () => {
          console.log('弹幕发送成功');
          this.hideInputBox();
          wx.showToast({
            title: '弹幕发送成功',
            icon: 'success',
            duration: 1000
          });
        },
        fail: (error) => {
          console.error('弹幕发送失败:', error);
          wx.showToast({
            title: '弹幕发送失败',
            icon: 'none'
          });
        }
      });
    },

    // 改变弹幕颜色
    changeColor(e) {
      const color = e.currentTarget.dataset.color;
      this.setData({
        'danmuStyle.color': color
      });
    },

    // 改变弹幕模式
    changeMode(e) {
      const mode = e.currentTarget.dataset.mode;
      this.setData({
        'danmuStyle.mode': mode
      });
    },

    // 改变字体大小
    changeFontSize(e) {
      const fontSize = e.currentTarget.dataset.size;
      this.setData({
        'danmuStyle.fontSize': fontSize
      });
    },

    // 点击遮罩关闭
    onMaskTap() {
      this.hideInputBox();
    },

    // 阻止事件冒泡
    stopPropagation() {
      // 阻止事件冒泡
    }
  }
});
