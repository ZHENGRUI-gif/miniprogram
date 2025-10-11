const { request } = require('../../utils/request');

Page({
  data: {
    uid: 0,
    type: '', // 'follows' 或 'fans'
    pageTitle: '',
    userList: [],
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    loadingMore: false,
    isOwn: false,
    currentUserId: 0,
    emptyText: ''
  },

  onLoad(query) {
    const uid = Number(query.uid || 0);
    const type = query.type || 'follows';
    const app = getApp();
    const currentUser = app.globalData.userInfo;
    
    this.setData({ 
      uid,
      type,
      isOwn: currentUser && currentUser.uid === uid,
      currentUserId: currentUser ? currentUser.uid : 0,
      pageTitle: type === 'follows' ? '关注列表' : '粉丝列表',
      emptyText: type === 'follows' ? '还没有关注任何人' : '还没有粉丝'
    });
    
    this.fetchUserList(true);
  },

  // 获取用户列表
  async fetchUserList(reset = false) {
    if (this.data.loadingMore && !reset) return;
    
    if (reset) {
      this.setData({ 
        currentPage: 1, 
        hasMore: true, 
        loadingMore: false,
        loading: true
      });
    } else {
      this.setData({ loadingMore: true });
    }
    
    try {
      const url = this.data.type === 'follows' ? '/follow/list' : '/follow/fans';
      const res = await request({ 
        url, 
        data: { 
          uid: this.data.uid,
          page: this.data.currentPage, 
          pageSize: this.data.pageSize 
        } 
      });
      
      if (res && res.data) {
        const newUsers = res.data.list || [];
        
        let userList;
        if (reset) {
          userList = newUsers;
        } else {
          userList = [...this.data.userList, ...newUsers];
        }
        
        // 检查关注状态
        if (!this.data.isOwn && this.data.currentUserId) {
          await this.checkFollowStatus(userList);
        }
        
        this.setData({ 
          userList,
          hasMore: newUsers.length === this.data.pageSize,
          currentPage: this.data.currentPage + 1
        });
      }
    } catch (e) {
      console.error('获取用户列表失败:', e);
      wx.showToast({ title: '获取列表失败', icon: 'none' });
    } finally {
      this.setData({ 
        loading: false,
        loadingMore: false 
      });
    }
  },

  // 检查关注状态
  async checkFollowStatus(userList) {
    try {
      const app = getApp();
      const token = app.globalData.token;
      
      if (!token) return;
      
      // 批量检查关注状态
      const promises = userList.map(async (user, index) => {
        try {
          const res = await request({ 
            url: '/follow/check', 
            data: { followingId: user.uid },
            header: { Authorization: `Bearer ${token}` }
          });
          
          if (res && res.data !== undefined) {
            userList[index].isFollowing = res.data;
          }
        } catch (e) {
          console.error(`检查用户${user.uid}关注状态失败:`, e);
        }
      });
      
      await Promise.all(promises);
      this.setData({ userList });
    } catch (e) {
      console.error('批量检查关注状态失败:', e);
    }
  },

  // 切换关注状态
  async toggleFollow(e) {
    const uid = e.currentTarget.dataset.uid;
    const index = e.currentTarget.dataset.index;
    
    const app = getApp();
    const token = app.globalData.token;
    
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    try {
      const res = await request({ 
        url: '/follow/toggle', 
        method: 'POST',
        data: { followingId: uid },
        header: { Authorization: `Bearer ${token}` }
      });
      
      if (res && res.data !== undefined) {
        const userList = this.data.userList;
        userList[index].isFollowing = res.data;
        this.setData({ userList });
        
        wx.showToast({ 
          title: res.data ? '关注成功' : '取消关注', 
          icon: 'success' 
        });
      }
    } catch (e) {
      console.error('关注操作失败:', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.fetchUserList(false);
    }
  },

  // 跳转到用户空间
  goToUserSpace(e) {
    const uid = e.currentTarget.dataset.uid;
    wx.navigateTo({ 
      url: `/pages/user-space/user-space?uid=${uid}` 
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  },

  // 格式化数字
  formatNum(n) {
    if (n >= 10000) return (n/10000).toFixed(1) + '万';
    return n || 0;
  }
});