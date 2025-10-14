const { request } = require('../../utils/request');

Component({
  properties: {
    videoId: {
      type: Number,
      value: 0
    },
    isCollected: {
      type: Boolean,
      value: false
    },
    collectCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    isCollected: false,
    collectCount: 0,
    favorites: [],
    showFavoriteList: false,
    selectedFavorites: [],
    loading: false
  },

  lifetimes: {
    attached() {
      // 组件初始化时获取用户收藏夹列表
      this.fetchUserFavorites();
    }
  },

  methods: {
    // 获取用户收藏夹列表
    async fetchUserFavorites() {
      try {
        const app = getApp();
        const token = app.globalData.token;
        
        if (!token) {
          console.log('用户未登录，无法获取收藏夹');
          return;
        }

        const res = await request({
          url: '/favorite/get-all/user',
          data: { uid: app.globalData.userInfo.uid },
          header: { Authorization: `Bearer ${token}` }
        });

        if (res && res.data) {
          this.setData({ favorites: res.data });
          console.log('用户收藏夹列表:', res.data);
        }
      } catch (error) {
        console.error('获取收藏夹列表失败:', error);
      }
    },

    // 获取视频已收藏的收藏夹ID
    async fetchCollectedFids() {
      try {
        const app = getApp();
        const token = app.globalData.token;
        
        if (!token) return new Set();

        const res = await request({
          url: '/video/collected-fids',
          data: { vid: this.data.videoId },
          header: { Authorization: `Bearer ${token}` }
        });

        if (res && res.data) {
          return new Set(res.data);
        }
        return new Set();
      } catch (error) {
        console.error('获取已收藏收藏夹失败:', error);
        return new Set();
      }
    },

    // 点击收藏按钮
    async onFavoriteTap() {
      const app = getApp();
      const token = app.globalData.token;
      
      if (!token) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      if (this.data.loading) return;

      this.setData({ loading: true });

      try {
        // 获取当前已收藏的收藏夹
        const collectedFids = await this.fetchCollectedFids();
        
        if (collectedFids.size > 0) {
          // 如果已收藏，显示收藏夹选择列表
          this.setData({ 
            showFavoriteList: true,
            selectedFavorites: Array.from(collectedFids)
          });
        } else {
          // 如果未收藏，显示收藏夹选择列表
          this.setData({ 
            showFavoriteList: true,
            selectedFavorites: []
          });
        }
      } catch (error) {
        console.error('获取收藏状态失败:', error);
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    // 选择/取消选择收藏夹
    onFavoriteSelect(e) {
      const fid = parseInt(e.currentTarget.dataset.fid);
      let selectedFavorites = [...this.data.selectedFavorites];
      
      const index = selectedFavorites.indexOf(fid);
      if (index > -1) {
        // 如果已选中，则取消选中
        selectedFavorites.splice(index, 1);
      } else {
        // 如果未选中，则选中
        selectedFavorites.push(fid);
      }
      
      this.setData({ selectedFavorites });
      console.log('选择收藏夹:', fid, '当前选择:', selectedFavorites);
    },

    // 确认收藏操作
    async confirmFavorite() {
      if (this.data.loading) return;

      this.setData({ loading: true });

      try {
        const app = getApp();
        const token = app.globalData.token;
        
        // 获取当前已收藏的收藏夹
        const currentCollected = await this.fetchCollectedFids();
        const newSelected = new Set(this.data.selectedFavorites);
        
        // 计算需要添加和移除的收藏夹
        const addArray = this.data.selectedFavorites.filter(fid => !currentCollected.has(fid));
        const removeArray = Array.from(currentCollected).filter(fid => !newSelected.has(fid));
        
        console.log('收藏操作:', {
          add: addArray,
          remove: removeArray,
          videoId: this.data.videoId,
          selectedFavorites: this.data.selectedFavorites,
          currentCollected: Array.from(currentCollected)
        });

        // 确保数组不为空，如果为空则发送空字符串数组
        const adds = addArray.length > 0 ? addArray : [''];
        const removes = removeArray.length > 0 ? removeArray : [''];

        // 直接使用wx.request发送请求，绕过request工具函数
        const res = await new Promise((resolve, reject) => {
          // 构建查询字符串
          let queryString = `vid=${this.data.videoId}`;
          adds.forEach(add => {
            queryString += `&adds=${add}`;
          });
          removes.forEach(remove => {
            queryString += `&removes=${remove}`;
          });
          
          console.log('直接发送的查询字符串:', queryString);
          
          wx.request({
            url: 'http://localhost:7070/video/collect',
            method: 'POST',
            data: queryString,
            header: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            success: (res) => {
              console.log('直接请求响应:', res);
              if (res.statusCode >= 400) {
                reject(new Error(`请求失败: ${res.statusCode}`));
              } else {
                resolve(res.data);
              }
            },
            fail: (error) => {
              console.error('直接请求错误:', error);
              reject(error);
            }
          });
        });

        if (res && res.code === 200) {
          // 更新收藏状态
          const isCollected = newSelected.size > 0;
          const collectCount = this.data.collectCount + (isCollected ? 1 : -1);
          
          this.setData({
            isCollected,
            collectCount: Math.max(0, collectCount),
            showFavoriteList: false
          });

          // 更新全局状态
          app.updateFavoriteStatus(this.data.videoId, isCollected, this.data.collectCount);

          // 通知父组件
          this.triggerEvent('favoritechange', {
            isCollected,
            collectCount: this.data.collectCount,
            selectedFavorites: Array.from(newSelected)
          });

          wx.showToast({
            title: isCollected ? '收藏成功' : '取消收藏',
            icon: 'success'
          });
        } else {
          throw new Error(res.message || '操作失败');
        }
      } catch (error) {
        console.error('收藏操作失败:', error);
        wx.showToast({
          title: error.message || '操作失败',
          icon: 'none'
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    // 取消收藏操作
    cancelFavorite() {
      this.setData({ 
        showFavoriteList: false,
        selectedFavorites: []
      });
    },

    // 创建新收藏夹
    createNewFavorite() {
      wx.showModal({
        title: '创建收藏夹',
        editable: true,
        placeholderText: '请输入收藏夹名称',
        success: async (res) => {
          if (res.confirm && res.content) {
            try {
              const app = getApp();
              const token = app.globalData.token;
              
              const favoriteRes = await request({
                url: '/favorite/create',
                method: 'POST',
                data: {
                  title: res.content,
                  desc: '',
                  visible: 1
                },
                header: { Authorization: `Bearer ${token}` }
              });

              if (favoriteRes && favoriteRes.data) {
                // 刷新收藏夹列表
                await this.fetchUserFavorites();
                
                // 自动选择新创建的收藏夹
                const newFid = favoriteRes.data.fid;
                const selectedFavorites = [...this.data.selectedFavorites, newFid];
                this.setData({ selectedFavorites });
                
                wx.showToast({
                  title: '收藏夹创建成功',
                  icon: 'success'
                });
              }
            } catch (error) {
              console.error('创建收藏夹失败:', error);
              wx.showToast({
                title: '创建失败',
                icon: 'none'
              });
            }
          }
        }
      });
    },

    // 更新收藏状态（供外部调用）
    updateFavoriteStatus(isCollected, collectCount) {
      this.setData({
        isCollected,
        collectCount
      });
    }
  }
});
