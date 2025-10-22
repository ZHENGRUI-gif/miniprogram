const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');

Page({
  data: {
    mcId: '', // 主分类ID
    scId: '', // 子分类ID（可选）
    categoryName: '', // 分类名称
    sortRule: 1, // 排序规则：1-最新投稿 2-最多播放 3-最多点赞
    videoList: [], // 视频列表
    currentPage: 1, // 当前页码
    pageSize: 20, // 每页数量
    loading: false, // 是否正在加载
    hasMore: true // 是否还有更多
  },

  onLoad(options) {
    const { mcId, scId, name } = options;
    
    this.setData({
      mcId: mcId || '',
      scId: scId || '',
      categoryName: name || '分区视频'
    });

    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.categoryName
    });

    // 加载视频列表
    this.loadVideos();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      videoList: [],
      hasMore: true
    });

    this.loadVideos().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 切换排序规则
  changeSortRule(e) {
    const rule = parseInt(e.currentTarget.dataset.rule);
    
    this.setData({
      sortRule: rule,
      currentPage: 1,
      videoList: [],
      hasMore: true
    });

    this.loadVideos();
  },

  // 加载视频列表
  async loadVideos() {
    if (this.data.loading) {
      return;
    }

    // 如果是第一页，允许重新加载
    if (this.data.currentPage !== 1 && !this.data.hasMore) {
      return;
    }

    this.setData({ loading: true });

    try {
      const params = {
        mcId: this.data.mcId,
        rule: this.data.sortRule,
        page: this.data.currentPage,
        quantity: this.data.pageSize
      };

      // 如果有子分类ID，添加到参数中
      if (this.data.scId) {
        params.scId = this.data.scId;
      }

      console.log('请求参数:', params);

      const res = await request({
        url: '/video/category',
        method: 'GET',
        data: params
      });

      console.log('分区视频响应:', res);

      if (res && res.data) {
        const newVideos = res.data.list || [];
        const videoList = this.data.currentPage === 1 
          ? newVideos 
          : [...this.data.videoList, ...newVideos];

        this.setData({
          videoList,
          hasMore: newVideos.length === this.data.pageSize,
          loading: false
        });
      } else {
        this.setData({
          loading: false,
          hasMore: false
        });
      }
    } catch (error) {
      console.error('加载视频列表失败:', error);
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });

      this.setData({
        loading: false,
        hasMore: false
      });
    }
  },

  // 加载更多
  loadMore() {
    if (this.data.loading || !this.data.hasMore) {
      return;
    }

    this.setData({
      currentPage: this.data.currentPage + 1
    });

    this.loadVideos();
  },

  // 跳转到视频详情
  goDetail(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({
      url: `/pages/video/video?vid=${vid}`
    });
  },

  // 格式化数字
  formatNum(n) {
    if (!n) return 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n;
  },

  // 格式化时长
  formatDuration(seconds) {
    return handleTime(seconds);
  },

  // 格式化上传时间
  formatUploadTime(dateTime) {
    if (!dateTime) return '';
    
    const now = new Date();
    const date = new Date(dateTime);
    const diff = now - date;

    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / 1000 / 60);
      return `${minutes}分钟前`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / 1000 / 60 / 60);
      return `${hours}小时前`;
    } else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const currentYear = now.getFullYear();

      if (year < currentYear) {
        return `${year}-${month}-${day}`;
      } else {
        return `${month}-${day}`;
      }
    }
  }
});

