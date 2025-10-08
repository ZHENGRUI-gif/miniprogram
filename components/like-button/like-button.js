// 点赞按钮组件
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 视频ID
    videoId: {
      type: String,
      value: ''
    },
    // 初始点赞状态
    isLiked: {
      type: Boolean,
      value: false
    },
    // 初始点踩状态
    isDisliked: {
      type: Boolean,
      value: false
    },
    // 初始点赞数
    likeCount: {
      type: Number,
      value: 0
    },
    // 初始点踩数
    dislikeCount: {
      type: Number,
      value: 0
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // GIF动画相关
    gifDisplay: false,
    isGifShow: false,
    
    // 粒子效果
    showParticles: false,
    particles: [],
    
    // 防重复点击
    isProcessing: false
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 点赞按钮点击事件
     */
    async onLikeTap() {
      if (this.data.disabled || this.data.isProcessing) {
        return;
      }

      this.setData({
        isProcessing: true
      });

      try {
        const { isLiked, isDisliked, likeCount, dislikeCount } = this.data;
        
        if (isLiked) {
          // 取消点赞
          await this.loveOrNot(false, false);
          this.setData({
            isLiked: false,
            likeCount: Math.max(0, likeCount - 1)
          });
        } else {
          // 点赞
          await this.loveOrNot(true, true);
          this.setData({
            isLiked: true,
            likeCount: likeCount + 1
          });
          
          // 如果之前点踩了，取消点踩
          if (isDisliked) {
            this.setData({
              isDisliked: false,
              dislikeCount: Math.max(0, dislikeCount - 1)
            });
          }
          
          // 显示动画效果
          this.showLikeAnimation();
        }
        
        // 触发父组件事件
        this.triggerEvent('likechange', {
          isLiked: this.data.isLiked,
          isDisliked: this.data.isDisliked,
          likeCount: this.data.likeCount,
          dislikeCount: this.data.dislikeCount
        });
        
      } catch (error) {
        console.error('点赞操作失败:', error);
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      } finally {
        this.setData({
          isProcessing: false
        });
      }
    },

    /**
     * 点踩按钮点击事件
     */
    async onDislikeTap() {
      if (this.data.disabled || this.data.isProcessing) {
        return;
      }

      this.setData({
        isProcessing: true
      });

      try {
        const { isLiked, isDisliked, likeCount, dislikeCount } = this.data;
        
        if (isDisliked) {
          // 取消点踩
          await this.loveOrNot(false, false);
          this.setData({
            isDisliked: false,
            dislikeCount: Math.max(0, dislikeCount - 1)
          });
        } else {
          // 点踩
          await this.loveOrNot(false, true);
          this.setData({
            isDisliked: true,
            dislikeCount: dislikeCount + 1
          });
          
          // 如果之前点赞了，取消点赞
          if (isLiked) {
            this.setData({
              isLiked: false,
              likeCount: Math.max(0, likeCount - 1)
            });
          }
        }
        
        // 触发父组件事件
        this.triggerEvent('likechange', {
          isLiked: this.data.isLiked,
          isDisliked: this.data.isDisliked,
          likeCount: this.data.likeCount,
          dislikeCount: this.data.dislikeCount
        });
        
      } catch (error) {
        console.error('点踩操作失败:', error);
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      } finally {
        this.setData({
          isProcessing: false
        });
      }
    },

    /**
     * 调用后端点赞接口
     * @param {boolean} isLove - true表示点赞，false表示点踩
     * @param {boolean} isSet - true表示设置，false表示取消
     */
    async loveOrNot(isLove, isSet) {
      const app = getApp();
      const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
      
      if (!token) {
        throw new Error('用户未登录');
      }

      const vid = this.properties.videoId;
      
      const fullUrl = `${app.globalData.baseUrl}/video/love-or-not?vid=${parseInt(vid)}&isLove=${isLove}&isSet=${isSet}`;
      console.log('API调用参数:', {
        vid: vid,
        vidType: typeof vid,
        vidParsed: parseInt(vid),
        isLove,
        isSet,
        fullUrl: fullUrl
      });

      // 验证vid参数
      if (!vid || vid === 0 || vid === '0') {
        throw new Error('视频ID无效');
      }

      let response;
      try {
        response = await new Promise((resolve, reject) => {
          wx.request({
            url: `${app.globalData.baseUrl}/video/love-or-not?vid=${parseInt(vid)}&isLove=${isLove}&isSet=${isSet}`,
            method: 'POST',
            header: {
              'Authorization': `Bearer ${token}`
            },
            success: (res) => {
              console.log('wx.request success:', res);
              resolve(res);
            },
            fail: (err) => {
              console.error('wx.request fail:', err);
              reject(err);
            }
          });
        });
        
        console.log('API响应详情:', {
          statusCode: response.statusCode,
          data: response.data,
          header: response.header
        });
      } catch (requestError) {
        console.error('wx.request 请求异常:', requestError);
        throw new Error(`请求异常: ${requestError.message || requestError}`);
      }

      if (!response) {
        throw new Error('请求无响应');
      }

      if (response.statusCode !== 200) {
        console.error('请求失败详情:', {
          statusCode: response.statusCode,
          error: response.data
        });
        throw new Error(`网络请求失败: ${response.statusCode}`);
      }

      const result = response.data;
      if (result.code !== 200) {
        throw new Error(result.message || '操作失败');
      }

      return result.data;
    },

    /**
     * 显示点赞动画效果
     */
    showLikeAnimation() {
      // 显示GIF动画
      this.gifShow();
      
      // 显示粒子爆炸效果
      this.showParticleEffect();
    },

    /**
     * 显示GIF动画
     */
    gifShow() {
      console.log('开始显示GIF动画');
      
      // 先隐藏，然后显示，强制重新加载GIF
      this.setData({
        gifDisplay: false,
        isGifShow: false
      });
      
      // 短暂延迟后重新显示，确保GIF重新播放
      setTimeout(() => {
        this.setData({
          gifDisplay: true,
          isGifShow: true
        });
      }, 50);
      
      // 3秒后隐藏GIF
      setTimeout(() => {
        this.gifHide();
      }, 3000);
    },

    /**
     * 隐藏GIF动画
     */
    gifHide() {
      this.setData({
        isGifShow: false
      });
      
      setTimeout(() => {
        this.setData({
          gifDisplay: false
        });
      }, 300);
    },

    /**
     * 显示粒子爆炸效果
     */
    showParticleEffect() {
      const particles = [];
      const particleCount = 8;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 30 + Math.random() * 20;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        particles.push({
          x: x,
          y: y,
          delay: Math.random() * 200
        });
      }
      
      this.setData({
        showParticles: true,
        particles: particles
      });
      
      // 1秒后隐藏粒子
      setTimeout(() => {
        this.setData({
          showParticles: false,
          particles: []
        });
      }, 1000);
    },

    /**
     * 更新点赞状态（供外部调用）
     */
    updateLikeStatus(data) {
      this.setData({
        isLiked: data.isLiked || false,
        isDisliked: data.isDisliked || false,
        likeCount: data.likeCount || 0,
        dislikeCount: data.dislikeCount || 0
      });
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      console.log('点赞组件已加载');
    },
    
    detached() {
      console.log('点赞组件已卸载');
    }
  }
});
