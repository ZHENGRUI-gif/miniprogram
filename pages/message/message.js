const app = getApp();

Page({
  data: {
    msgUnread: [0, 0, 0, 0, 0, 0],
    msgTypes: [
      { name: '回复我的', path: '/pages/message/reply/reply', icon: '💬' },
      { name: '@ 我的', path: '/pages/message/at/at', icon: '📢' },
      { name: '收到的赞', path: '/pages/likes/likes', icon: '❤️' },
      { name: '系统通知', path: '/pages/message/system/system', icon: '🔔' },
      { name: '我的消息', path: '/pages/message/whisper/whisper', icon: '💌' },
      { name: '动态', path: '/pages/message/dynamic/dynamic', icon: '📱' }
    ]
  },

  onLoad() {
    console.log('消息页面加载');
    this.updateMsgUnread();
  },

  onShow() {
    console.log('消息页面显示');
    this.updateMsgUnread();
  },

  // 更新未读消息数量
  updateMsgUnread() {
    const msgUnread = app.globalData.msgUnread || [0, 0, 0, 0, 0, 0];
    
    console.log('更新消息未读数量:', { msgUnread, msgTypes: this.data.msgTypes });
    
    this.setData({
      msgUnread: msgUnread
    });
  },


  // 页面消息更新回调
  onMsgUpdate() {
    this.updateMsgUnread();
  },

  // 跳转到具体消息页面
  navigateToMsg(e) {
    const index = e.currentTarget.dataset.index;
    const msgType = this.data.msgTypes[index];
    
    if (msgType && msgType.path) {
      wx.navigateTo({
        url: msgType.path,
        fail: (error) => {
          console.error('跳转失败:', error);
          wx.showToast({
            title: '页面暂未实现',
            icon: 'none'
          });
        }
      });
    }
  },

  // 清除未读消息
  clearUnread(e) {
    const index = e.currentTarget.dataset.index;
    const msgTypeNames = ['reply', 'at', 'love', 'system', 'whisper', 'dynamic'];
    const column = msgTypeNames[index];
    
    if (!column) return;

    wx.showModal({
      title: '确认清除',
      content: `确定要清除${this.data.msgTypes[index].name}的未读消息吗？`,
      success: (res) => {
        if (res.confirm) {
          this.clearUnreadMessage(column, index);
        }
      }
    });
  },

  // 清除指定类型的未读消息
  async clearUnreadMessage(column, index) {
    try {
      const result = await app.clearUnreadMessage(column);
      if (result) {
        // 更新本地数据
        const msgUnread = [...this.data.msgUnread];
        msgUnread[index] = 0;
        const totalUnread = msgUnread.reduce((sum, count) => sum + count, 0);
        
        this.setData({
          msgUnread: msgUnread,
          totalUnread: totalUnread
        });
        
        wx.showToast({
          title: '清除成功',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('清除未读消息失败:', error);
      wx.showToast({
        title: '清除失败',
        icon: 'error'
      });
    }
  },


});
