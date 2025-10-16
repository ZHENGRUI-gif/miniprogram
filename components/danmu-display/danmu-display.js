Component({
  properties: {
    // 弹幕列表
    danmus: {
      type: Array,
      value: []
    },
    // 视频播放时间
    currentTime: {
      type: Number,
      value: 0
    },
    // 弹幕是否开启
    enabled: {
      type: Boolean,
      value: true
    },
    // 弹幕透明度
    opacity: {
      type: Number,
      value: 0.8
    },
    // 弹幕速度
    speed: {
      type: Number,
      value: 2
    }
  },

  data: {
    visibleDanmus: [], // 当前显示的弹幕
    lastTime: 0, // 上次播放时间
    danmuIndex: -1, // 当前弹幕索引
    rollRows: new Array(12).fill(-1), // 滚动弹幕行记录
    topRows: new Array(12).fill(-1), // 顶部弹幕行记录
    bottomRows: new Array(12).fill(-1), // 底部弹幕行记录
    cleanupTimer: null // 清理定时器
  },

  observers: {
    'currentTime': function(currentTime) {
      this.updateDanmus(currentTime);
    },
    'danmus': function(danmus) {
      // 避免在observers中调用setData，只更新内部数据
      if (danmus && danmus.length > 0) {
        this.data.danmus = [...danmus].sort((a, b) => a.timePoint - b.timePoint);
        // 初始化历史弹幕显示
        this.initHistoryDanmus();
      }
    }
  },

  methods: {
    // 对弹幕按时间排序
    sortDanmus() {
      const sorted = [...this.data.danmus].sort((a, b) => a.timePoint - b.timePoint);
      this.setData({ danmus: sorted });
    },

    // 更新弹幕显示
    updateDanmus(currentTime) {
      if (!this.data.enabled) return;

      const danmus = this.data.danmus;
      const lastTime = this.data.lastTime;
      let danmuIndex = this.data.danmuIndex;

      // 限制处理数量，避免性能问题
      if (!danmus || danmus.length === 0) return;

      // 找出当前时间需要显示的弹幕
      const newDanmus = [];
      let processedCount = 0;
      const maxProcessCount = 10; // 限制每次最多处理10条弹幕

      while (danmuIndex + 1 < danmus.length && 
             danmus[danmuIndex + 1].timePoint <= currentTime && 
             processedCount < maxProcessCount) {
        const danmu = danmus[danmuIndex + 1];
        if (danmu.timePoint > lastTime) {
          newDanmus.push(danmu);
        }
        danmuIndex++;
        processedCount++;
      }

      // 添加新弹幕到显示列表
      if (newDanmus.length > 0) {
        const visibleDanmus = [...this.data.visibleDanmus];
        newDanmus.forEach(danmu => {
          const danmuItem = this.createDanmuItem(danmu);
          visibleDanmus.push(danmuItem);
        });
        
        // 限制显示弹幕数量，避免内存泄漏
        if (visibleDanmus.length > 50) {
          visibleDanmus.splice(0, visibleDanmus.length - 50);
        }
        
        this.setData({ 
          visibleDanmus,
          danmuIndex,
          lastTime: currentTime
        });
      }
    },

    // 初始化历史弹幕显示
    initHistoryDanmus() {
      if (!this.data.enabled) return;
      
      const danmus = this.data.danmus;
      if (!danmus || danmus.length === 0) return;

      // 显示视频开始时的弹幕（时间点0-5秒）
      const earlyDanmus = danmus.filter(danmu => danmu.timePoint >= 0 && danmu.timePoint <= 5);
      
      if (earlyDanmus.length > 0) {
        const visibleDanmus = [];
        earlyDanmus.forEach(danmu => {
          const danmuItem = this.createDanmuItem(danmu);
          visibleDanmus.push(danmuItem);
        });
        
        this.setData({ 
          visibleDanmus,
          danmuIndex: earlyDanmus.length - 1,
          lastTime: 5
        });
        
        console.log('初始化历史弹幕:', earlyDanmus.length, '条');
      }
    },

    // 创建弹幕显示项
    createDanmuItem(danmu) {
      const id = `danmu_${Date.now()}_${Math.random()}`;
      const row = this.getAvailableRow(danmu.mode);
      
      return {
        id,
        content: danmu.content,
        color: danmu.color || '#ffffff',
        fontSize: danmu.fontsize || 24,
        mode: danmu.mode || 1,
        row,
        uid: danmu.uid,
        timePoint: danmu.timePoint,
        duration: this.calculateDuration(danmu.content, danmu.mode)
      };
    },

    // 获取可用行
    getAvailableRow(mode) {
      const now = Date.now();
      let rows;
      
      switch (mode) {
        case 1: // 滚动
          rows = this.data.rollRows;
          break;
        case 2: // 顶部
          rows = this.data.topRows;
          break;
        case 3: // 底部
          rows = this.data.bottomRows;
          break;
        default:
          rows = this.data.rollRows;
      }

      // 找到最早结束的行
      let minTime = Infinity;
      let minIndex = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] < minTime) {
          minTime = rows[i];
          minIndex = i;
        }
      }

      // 更新行时间（只更新内部数据，不触发setData）
      const duration = this.calculateDuration('', mode);
      rows[minIndex] = now + duration;

      return minIndex;
    },

    // 计算弹幕持续时间
    calculateDuration(content, mode) {
      if (mode === 1) { // 滚动
        const baseDuration = 4000; // 基础4秒，确保足够时间移出屏幕
        const contentLength = content ? content.length : 10;
        return baseDuration + (contentLength * 150); // 每个字符增加150ms
      } else { // 顶部和底部
        return 3000; // 固定3秒
      }
    },

    // 移除弹幕
    removeDanmu(id) {
      const visibleDanmus = this.data.visibleDanmus.filter(item => item.id !== id);
      this.setData({ visibleDanmus });
    },

    // 清空所有弹幕
    clearDanmus() {
      this.setData({ 
        visibleDanmus: [],
        lastTime: 0,
        danmuIndex: -1,
        rollRows: new Array(12).fill(-1),
        topRows: new Array(12).fill(-1),
        bottomRows: new Array(12).fill(-1)
      });
    },

    // 添加新弹幕（用于实时接收）
    addDanmu(danmu) {
      const danmuItem = this.createDanmuItem(danmu);
      const visibleDanmus = [...this.data.visibleDanmus, danmuItem];
      
      // 限制显示弹幕数量，避免内存泄漏
      if (visibleDanmus.length > 50) {
        visibleDanmus.splice(0, visibleDanmus.length - 50);
      }
      
      this.setData({ visibleDanmus });
      
      // 设置定时器自动移除弹幕（备用方案）
      setTimeout(() => {
        this.removeDanmu(danmuItem.id);
      }, danmuItem.duration + 1000); // 额外延迟1秒确保动画完成
    },

    // 弹幕动画结束事件
    onDanmuAnimationEnd(e) {
      const id = e.currentTarget.dataset.id;
      if (id) {
        this.removeDanmu(id);
      }
    }
  },

  lifetimes: {
    attached() {
      // 组件初始化
      console.log('弹幕显示组件已加载');
      this.startCleanupTimer();
    },
    
    detached() {
      // 组件销毁时清理定时器
      console.log('弹幕显示组件已销毁');
      this.stopCleanupTimer();
    }
  },

  methods: {
    // 启动清理定时器
    startCleanupTimer() {
      this.stopCleanupTimer(); // 先清除之前的定时器
      this.data.cleanupTimer = setInterval(() => {
        this.cleanupExpiredDanmus();
      }, 2000); // 每2秒清理一次
    },

    // 停止清理定时器
    stopCleanupTimer() {
      if (this.data.cleanupTimer) {
        clearInterval(this.data.cleanupTimer);
        this.data.cleanupTimer = null;
      }
    },

    // 清理过期弹幕
    cleanupExpiredDanmus() {
      const now = Date.now();
      const visibleDanmus = this.data.visibleDanmus.filter(item => {
        // 保留创建时间在10秒内的弹幕
        const createTime = parseInt(item.id.split('_')[1]);
        return now - createTime < 10000;
      });

      if (visibleDanmus.length !== this.data.visibleDanmus.length) {
        this.setData({ visibleDanmus });
        console.log('清理过期弹幕，剩余:', visibleDanmus.length);
      }
    },

    // 对弹幕按时间排序
    sortDanmus() {
      const sorted = [...this.data.danmus].sort((a, b) => a.timePoint - b.timePoint);
      this.setData({ danmus: sorted });
    },

    // 更新弹幕显示
    updateDanmus(currentTime) {
      if (!this.data.enabled) return;

      const danmus = this.data.danmus;
      const lastTime = this.data.lastTime;
      let danmuIndex = this.data.danmuIndex;

      // 限制处理数量，避免性能问题
      if (!danmus || danmus.length === 0) return;

      // 找出当前时间需要显示的弹幕
      const newDanmus = [];
      let processedCount = 0;
      const maxProcessCount = 10; // 限制每次最多处理10条弹幕

      while (danmuIndex + 1 < danmus.length && 
             danmus[danmuIndex + 1].timePoint <= currentTime && 
             processedCount < maxProcessCount) {
        const danmu = danmus[danmuIndex + 1];
        if (danmu.timePoint > lastTime) {
          newDanmus.push(danmu);
        }
        danmuIndex++;
        processedCount++;
      }

      // 添加新弹幕到显示列表
      if (newDanmus.length > 0) {
        const visibleDanmus = [...this.data.visibleDanmus];
        newDanmus.forEach(danmu => {
          const danmuItem = this.createDanmuItem(danmu);
          visibleDanmus.push(danmuItem);
        });
        
        // 限制显示弹幕数量，避免内存泄漏
        if (visibleDanmus.length > 50) {
          visibleDanmus.splice(0, visibleDanmus.length - 50);
        }
        
        this.setData({ 
          visibleDanmus,
          danmuIndex,
          lastTime: currentTime
        });
      }
    },

    // 初始化历史弹幕显示
    initHistoryDanmus() {
      if (!this.data.enabled) return;
      
      const danmus = this.data.danmus;
      if (!danmus || danmus.length === 0) return;

      // 显示视频开始时的弹幕（时间点0-5秒）
      const earlyDanmus = danmus.filter(danmu => danmu.timePoint >= 0 && danmu.timePoint <= 5);
      
      if (earlyDanmus.length > 0) {
        const visibleDanmus = [];
        earlyDanmus.forEach(danmu => {
          const danmuItem = this.createDanmuItem(danmu);
          visibleDanmus.push(danmuItem);
        });
        
        this.setData({ 
          visibleDanmus,
          danmuIndex: earlyDanmus.length - 1,
          lastTime: 5
        });
        
        console.log('初始化历史弹幕:', earlyDanmus.length, '条');
      }
    },

    // 创建弹幕显示项
    createDanmuItem(danmu) {
      const id = `danmu_${Date.now()}_${Math.random()}`;
      const row = this.getAvailableRow(danmu.mode);
      
      return {
        id,
        content: danmu.content,
        color: danmu.color || '#ffffff',
        fontSize: danmu.fontsize || 24,
        mode: danmu.mode || 1,
        row,
        uid: danmu.uid,
        timePoint: danmu.timePoint,
        duration: this.calculateDuration(danmu.content, danmu.mode)
      };
    },

    // 获取可用行
    getAvailableRow(mode) {
      const now = Date.now();
      let rows;
      
      switch (mode) {
        case 1: // 滚动
          rows = this.data.rollRows;
          break;
        case 2: // 顶部
          rows = this.data.topRows;
          break;
        case 3: // 底部
          rows = this.data.bottomRows;
          break;
        default:
          rows = this.data.rollRows;
      }

      // 找到最早结束的行
      let minTime = Infinity;
      let minIndex = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] < minTime) {
          minTime = rows[i];
          minIndex = i;
        }
      }

      // 更新行时间（只更新内部数据，不触发setData）
      const duration = this.calculateDuration('', mode);
      rows[minIndex] = now + duration;

      return minIndex;
    },

    // 计算弹幕持续时间
    calculateDuration(content, mode) {
      if (mode === 1) { // 滚动
        const baseDuration = 4000; // 基础4秒，确保足够时间移出屏幕
        const contentLength = content ? content.length : 10;
        return baseDuration + (contentLength * 150); // 每个字符增加150ms
      } else { // 顶部和底部
        return 3000; // 固定3秒
      }
    },

    // 移除弹幕
    removeDanmu(id) {
      const visibleDanmus = this.data.visibleDanmus.filter(item => item.id !== id);
      this.setData({ visibleDanmus });
    },

    // 清空所有弹幕
    clearDanmus() {
      this.setData({ 
        visibleDanmus: [],
        lastTime: 0,
        danmuIndex: -1,
        rollRows: new Array(12).fill(-1),
        topRows: new Array(12).fill(-1),
        bottomRows: new Array(12).fill(-1)
      });
    },

    // 添加新弹幕（用于实时接收）
    addDanmu(danmu) {
      const danmuItem = this.createDanmuItem(danmu);
      const visibleDanmus = [...this.data.visibleDanmus, danmuItem];
      
      // 限制显示弹幕数量，避免内存泄漏
      if (visibleDanmus.length > 50) {
        visibleDanmus.splice(0, visibleDanmus.length - 50);
      }
      
      this.setData({ visibleDanmus });
      
      // 设置定时器自动移除弹幕（备用方案）
      setTimeout(() => {
        this.removeDanmu(danmuItem.id);
      }, danmuItem.duration + 1000); // 额外延迟1秒确保动画完成
    },

    // 弹幕动画结束事件
    onDanmuAnimationEnd(e) {
      const id = e.currentTarget.dataset.id;
      if (id) {
        this.removeDanmu(id);
      }
    }
  }
});
