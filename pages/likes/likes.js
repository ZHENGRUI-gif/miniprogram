const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');

Page({
  data: {
    likeList: [],           // 点赞列表
    loading: false,         // 加载状态
    hasMore: true,          // 是否还有更多
    offset: 0,              // 偏移量
    quantity: 10,           // 每页数量
    isOrganized: false,     // 是否已整理
    expandedGroups: {},     // 展开的分组
    groupedLikes: {}        // 分组后的点赞数据
  },

  onLoad() {
    this.getReceivedLikes();
    this.clearUnreadLikes();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.setData({
      likeList: [],
      offset: 0,
      hasMore: true,
      isOrganized: false,
      expandedGroups: {},
      groupedLikes: {}
    });
    this.getReceivedLikes();
  },

  // 获取收到的点赞列表
  async getReceivedLikes() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    try {
      const res = await request({
        url: '/video/received-likes',
        method: 'GET',
        data: {
          offset: this.data.offset,
          quantity: this.data.quantity
        }
      });
      
      if (res && res.data) {
        const newLikes = res.data;
        
        // 处理数据格式
        const processedLikes = newLikes.map(item => ({
          ...item,
          formattedTime: this.formatTime(item.userVideo?.loveTime || item.loveTime)
        }));
        
        if (newLikes.length < this.data.quantity) {
          this.setData({ hasMore: false });
        }
        
        const updatedList = [...this.data.likeList, ...processedLikes];
        this.setData({
          likeList: updatedList,
          offset: this.data.offset + newLikes.length
        });
        
        // 如果当前是整理模式，更新分组数据
        if (this.data.isOrganized) {
          this.updateGroupedLikes(updatedList);
        }
      }
    } catch (error) {
      console.error('获取收到的点赞失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 清除未读消息
  async clearUnreadLikes() {
    try {
      // 后端接口期望通过URL参数接收column参数
      await request({
        url: '/msg-unread/clear?column=love',
        method: 'POST',
        data: {} // 空请求体
      });
      console.log('清除未读消息成功');
    } catch (error) {
      console.error('清除未读消息失败:', error);
      // 不显示错误提示给用户，因为这不是关键功能
    }
  },

  // 格式化时间
  formatTime(timeStr) {
    if (!timeStr) return '';
    return handleTime(timeStr);
  },

  // 切换整理状态
  toggleOrganize() {
    const isOrganized = !this.data.isOrganized;
    let expandedGroups = {};
    
    if (isOrganized) {
      // 整理时，默认展开所有分组
      const groupedLikes = this.getGroupedLikes();
      Object.keys(groupedLikes).forEach(videoId => {
        expandedGroups[videoId] = true;
      });
      this.setData({ groupedLikes });
    }
    
    this.setData({
      isOrganized: isOrganized,
      expandedGroups: expandedGroups
    });
  },

  // 按视频分组
  getGroupedLikes() {
    const groups = {};
    this.data.likeList.forEach(item => {
      const videoId = item.video?.vid || item.vid;
      if (!videoId) return;
      
      if (!groups[videoId]) {
        groups[videoId] = {
          video: item.video || item,
          stats: item.stats || {},
          likes: []
        };
      }
      groups[videoId].likes.push(item);
    });
    
    // 按点赞时间排序
    Object.keys(groups).forEach(videoId => {
      groups[videoId].likes.sort((a, b) => {
        const timeA = new Date(a.userVideo?.loveTime || a.loveTime || 0);
        const timeB = new Date(b.userVideo?.loveTime || b.loveTime || 0);
        return timeB - timeA;
      });
    });
    
    return groups;
  },

  // 更新分组数据
  updateGroupedLikes(likeList) {
    const groupedLikes = this.getGroupedLikes();
    this.setData({ groupedLikes });
  },

  // 切换分组展开状态
  toggleGroup(e) {
    const videoId = e.currentTarget.dataset.videoId;
    const expandedGroups = { ...this.data.expandedGroups };
    expandedGroups[videoId] = !expandedGroups[videoId];
    this.setData({ expandedGroups });
  },

  // 跳转到视频详情页
  openVideo(e) {
    const vid = e.currentTarget.dataset.vid;
    if (!vid) return;
    
    wx.navigateTo({
      url: `/pages/video/video?vid=${vid}`
    });
  },

  // 跳转到用户空间
  openUserSpace(e) {
    const uid = e.currentTarget.dataset.uid;
    if (!uid) return;
    
    wx.navigateTo({
      url: `/pages/user-space/user-space?uid=${uid}`
    });
  },

  // 上拉加载更多
  onReachBottom() {
    this.getReceivedLikes();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      likeList: [],
      offset: 0,
      hasMore: true,
      isOrganized: false,
      expandedGroups: {},
      groupedLikes: {}
    });
    this.getReceivedLikes().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 格式化数字
  formatNum(num) {
    if (!num) return '0';
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  }
});
