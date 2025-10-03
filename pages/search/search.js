const { request } = require('../../utils/request');
const { handleTime } = require('../../utils/time');

Page({
  data: { 
    keyword: '', 
    searchKeyword: '',
    suggest: [], 
    videos: [],
    users: [], // 用户搜索结果
    hotSearches: [],
    searchHistory: [],
    inputFocus: false,
    showKeyboard: false,
    matchingWords: [], // 实时搜索推荐
    loading: false,
    page: 1,
    userPage: 1, // 用户搜索分页
    hasMore: true,
    userHasMore: true, // 用户搜索是否还有更多
    activeTab: 'video' // 当前激活的标签页
  },
  onLoad() {
    this.loadHotSearches();
    this.loadSearchHistory();
  },
  onShow() {
    // 每次显示页面时刷新搜索历史
    this.loadSearchHistory();
  },
  // 加载热搜数据
  async loadHotSearches() {
    try {
      // 模拟热搜数据，实际应该从后端获取
      const hotSearches = [
        { keyword: '韩立重新定义生死', tag: '💰' },
        { keyword: 'GEN无法选取T1当底座', tag: '' },
        { keyword: '莫愁乡 但歌词全描…梗', tag: '梗' },
        { keyword: '童年被刀的狼王… 独家', tag: '独家' },
        { keyword: '9月世界局势分析盘点', tag: '' },
        { keyword: '原神爱诺角色预告新', tag: '新' },
        { keyword: '棋圣战决赛柯…直播中', tag: '直播中' },
        { keyword: '净网 网警起底网络水…', tag: '' },
        { keyword: '以总理演讲多国代表…', tag: '' },
        { keyword: '川超广安VS…直播中', tag: '直播中' }
      ];
      this.setData({ hotSearches });
    } catch (e) {
      console.error('加载热搜失败:', e);
    }
  },
  // 加载搜索历史
  loadSearchHistory() {
    try {
      const history = wx.getStorageSync('searchHistory') || [];
      this.setData({ searchHistory: history });
    } catch (e) {
      console.error('加载搜索历史失败:', e);
    }
  },
  // 保存搜索历史
  saveSearchHistory(keyword) {
    try {
      let history = wx.getStorageSync('searchHistory') || [];
      // 移除重复项
      history = history.filter(item => item.keyword !== keyword);
      // 添加到开头
      history.unshift({ keyword, time: this.formatTime(new Date()) });
      // 限制历史记录数量
      history = history.slice(0, 12);
      wx.setStorageSync('searchHistory', history);
      this.setData({ searchHistory: history });
    } catch (e) {
      console.error('保存搜索历史失败:', e);
    }
  },
  // 格式化时间
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (days > 0) return `${days}天前更新`;
    if (hours > 0) return `${hours}小时前更新`;
    return '刚刚更新';
  },
  onInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    if (!keyword) { 
      this.setData({ suggest: [], searchKeyword: '', matchingWords: [] }); 
      return; 
    }
    this.getMatchingWords(keyword);
  },
  // 输入框获得焦点
  onInputFocus() {
    this.setData({ 
      inputFocus: true, 
      showKeyboard: true,
      searchKeyword: '',
      videos: []
    });
  },
  // 输入框失去焦点
  onInputBlur() {
    this.setData({ inputFocus: false });
    // 延迟隐藏键盘状态，避免点击建议项时键盘闪烁
    setTimeout(() => {
      this.setData({ showKeyboard: false });
    }, 200);
  },
  // 获取实时搜索推荐
  async getMatchingWords(keyword) {
    try {
      const res = await request({ url: '/search/word/get', method: 'GET', data: { keyword } });
      const matchingWords = (res.data || []).map(item => ({
        content: item.content || item,
        type: item.type || 1
      }));
      this.setData({ matchingWords });
    } catch (e) {
      console.error('获取搜索推荐失败:', e);
      this.setData({ matchingWords: [] });
    }
  },
  async fetchSuggest(keyword) {
    const res = await request({ url: '/search/word/get', method: 'GET', data: { keyword } });
    this.setData({ suggest: res.data || [] });
  },
  useSuggest(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ keyword: text, suggest: [], inputFocus: false, matchingWords: [] });
    this.onSearch();
  },
  // 使用搜索推荐
  useMatchingWord(e) {
    const content = e.currentTarget.dataset.content;
    this.setData({ keyword: content, matchingWords: [], inputFocus: false });
    this.onSearch();
  },
  async onSearch() {
    const { keyword } = this.data;
    if (!keyword) return;
    
    // 保存搜索历史
    this.saveSearchHistory(keyword);
    
    // 设置搜索关键词
    this.setData({ 
      searchKeyword: keyword, 
      suggest: [],
      matchingWords: [],
      page: 1,
      userPage: 1,
      hasMore: true,
      userHasMore: true,
      activeTab: 'video' // 默认显示视频结果
    });
    
    try {
      // 先尝试记录搜索关键词，如果失败也不影响搜索功能
      try {
        await request({ 
          url: '/search/word/add', 
          method: 'POST', 
          data: { keyword: keyword.trim() },
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (addError) {
        console.warn('记录搜索关键词失败，但不影响搜索功能:', addError);
      }
      
      // 同时搜索视频和用户
      await Promise.all([
        this.searchVideos(keyword.trim()),
        this.searchUsers(keyword.trim())
      ]);
    } catch (e) {
      console.error('搜索失败:', e);
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },
  // 搜索框点击事件
  onSearchBoxTap() {
    // 可以在这里添加输入框聚焦逻辑
    console.log('搜索框被点击');
  },
  // 搜索按钮点击事件
  onSearchBtnTap() {
    this.onSearch();
  },
  // 使用热搜关键词
  useHotSearch(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ 
      keyword, 
      inputFocus: false,
      showKeyboard: false,
      suggest: []
    });
    this.onSearch();
  },
  // 使用搜索历史
  useHistorySearch(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ 
      keyword, 
      inputFocus: false,
      showKeyboard: false,
      suggest: []
    });
    this.onSearch();
  },
  // 刷新发现
  refreshDiscovery() {
    wx.showToast({ title: '已刷新', icon: 'success' });
    this.loadSearchHistory();
  },
  // 清除历史
  // 删除单个搜索历史
  removeHistory(e) {
    const index = e.currentTarget.dataset.index;
    let history = [...this.data.searchHistory];
    history.splice(index, 1);
    wx.setStorageSync('searchHistory', history);
    this.setData({ searchHistory: history });
  },
  // 清空所有搜索历史
  clearAllHistory() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ searchHistory: [] });
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },
  clearHistory() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ searchHistory: [] });
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },
  // 显示反馈
  showFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '如有问题或建议，请联系客服',
      showCancel: false
    });
  },
  goDetail(e) {
    const vid = e.currentTarget.dataset.vid;
    wx.navigateTo({ url: `/pages/video/video?vid=${vid}` });
  },
  // 下拉刷新
  onPullDownRefresh() {
    if (this.data.searchKeyword) {
      this.onSearch();
    } else {
      this.loadHotSearches();
      this.loadSearchHistory();
    }
    wx.stopPullDownRefresh();
  },
  // 上拉加载更多
  onReachBottom() {
    if (this.data.searchKeyword && !this.data.loading) {
      if (this.data.activeTab === 'video' && this.data.hasMore) {
        this.loadMoreVideos();
      } else if (this.data.activeTab === 'user' && this.data.userHasMore) {
        this.loadMoreUsers();
      }
    }
  },
  // 加载更多视频
  async loadMoreVideos() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      let res;
      
      try {
        res = await request({ 
          url: '/search/video/only-pass', 
          method: 'GET', 
          data: { keyword: this.data.searchKeyword.trim(), page: nextPage } 
        });
      } catch (searchError) {
        console.warn('主要搜索接口失败，尝试备用接口:', searchError);
        res = await request({ 
          url: '/search/video', 
          method: 'GET', 
          data: { keyword: this.data.searchKeyword.trim(), page: nextPage } 
        });
      }
      
      console.log('加载更多搜索结果:', res);
      const newVideos = res.data || [];
      if (newVideos.length > 0) {
        this.setData({ 
          videos: this.data.videos.concat(newVideos),
          page: nextPage
        });
      } else {
        this.setData({ hasMore: false });
      }
    } catch (e) {
      console.error('加载更多失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  formatNum(n) {
    const num = Number(n) || 0;
    if (num >= 10000) {
      return (num/10000).toFixed(1) + '万';
    } else if (num >= 1000) {
      return (num/1000).toFixed(1) + 'k';
    }
    return num.toString();
  },
  formatDuration(seconds) {
    return handleTime(seconds);
  },
  
  // 搜索视频
  async searchVideos(keyword) {
    try {
      let res;
      try {
        res = await request({ 
          url: '/search/video/only-pass', 
          method: 'GET', 
          data: { keyword, page: 1 } 
        });
      } catch (searchError) {
        console.warn('主要视频搜索接口失败，尝试备用接口:', searchError);
        res = await request({ 
          url: '/search/video', 
          method: 'GET', 
          data: { keyword, page: 1 } 
        });
      }
      
      console.log('视频搜索结果:', res);
      this.setData({ videos: res.data || [] });
    } catch (e) {
      console.error('视频搜索失败:', e);
      this.setData({ videos: [] });
    }
  },
  
  // 搜索用户
  async searchUsers(keyword) {
    try {
      let res;
      try {
        res = await request({ 
          url: '/search/user', 
          method: 'GET', 
          data: { keyword, page: 1 } 
        });
      } catch (searchError) {
        console.warn('主要用户搜索接口失败，尝试备用接口:', searchError);
        try {
          res = await request({ 
            url: '/user/search', 
            method: 'GET', 
            data: { keyword, page: 1 } 
          });
        } catch (backupError) {
          console.warn('备用用户搜索接口也失败，使用模拟数据:', backupError);
          // 使用模拟用户数据
          res = {
            data: [
              {
                uid: 1,
                nickname: '三九耳朵不太好',
                avatar_url: 'https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/17589826820698d3c667d028d440d9abf513e80ae7101.jpg',
                level: 0,
                description: '0粉丝·0个视频 愿意音乐带给你快乐',
                fans: 0,
                videos: 0
              }
            ]
          };
        }
      }
      
      console.log('用户搜索结果:', res);
      console.log('用户数据结构:', res.data);
      if (res.data && res.data.length > 0) {
        console.log('第一个用户数据:', res.data[0]);
        console.log('头像字段:', res.data[0].avatar, res.data[0].avatar_url);
      }
      this.setData({ users: res.data || [] });
    } catch (e) {
      console.error('用户搜索失败:', e);
      this.setData({ users: [] });
    }
  },
  
  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },
  
  // 跳转到用户空间
  goUserSpace(e) {
    const uid = e.currentTarget.dataset.uid;
    wx.navigateTo({ 
      url: `/pages/user-space/user-space?uid=${uid}` 
    });
  },
  
  // 关注用户
  followUser(e) {
    const uid = e.currentTarget.dataset.uid;
    console.log('关注用户:', uid);
    wx.showToast({
      title: '关注成功',
      icon: 'success'
    });
  },
  
  // 加载更多用户
  async loadMoreUsers() {
    if (this.data.loading || !this.data.userHasMore) return;
    
    this.setData({ loading: true });
    try {
      const nextPage = this.data.userPage + 1;
      let res;
      
      try {
        res = await request({ 
          url: '/search/user', 
          method: 'GET', 
          data: { keyword: this.data.searchKeyword.trim(), page: nextPage } 
        });
      } catch (searchError) {
        console.warn('主要用户搜索接口失败，尝试备用接口:', searchError);
        res = await request({ 
          url: '/user/search', 
          method: 'GET', 
          data: { keyword: this.data.searchKeyword.trim(), page: nextPage } 
        });
      }
      
      console.log('加载更多用户搜索结果:', res);
      const newUsers = res.data || [];
      if (newUsers.length > 0) {
        this.setData({ 
          users: this.data.users.concat(newUsers),
          userPage: nextPage
        });
      } else {
        this.setData({ userHasMore: false });
      }
    } catch (e) {
      console.error('加载更多用户失败:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});

