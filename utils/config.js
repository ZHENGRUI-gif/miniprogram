const config = {
  baseURL: "http://192.168.137.1:7070", // 替换为你的后端域名/端口，需在小程序后台配置request合法域名
  wsURL: "ws://192.168.137.1:7070", // 弹幕WebSocket地址，与后端服务同端口
  imWSURL: "ws://192.168.137.1:7071", // IM WebSocket地址，Netty服务端口
  // 用户信息接口（按优先级依次尝试，避免404）
  userInfoEndpoints: [
    "/user/personal/info",
    "/user/account/info",
    "/user/info",
    "/account/info"
  ],
  // 作者投稿列表接口（优先级从前到后）
  authorVideosEndpoints: [
    "/video/list/by-user",
    "/video/list/author",
    "/video/user/list",
    "/video/by/uid"
  ],
  // 用户空间相关接口
  userSpaceEndpoints: {
    userInfo: '/user/info/get-one',
    userStats: '/video/user-works-count',
    userVideos: ['/video/list/by-user', '/video/list/author', '/video/user/list', '/video/by/uid'],
    userFavorites: ['/favorite/get-all/visitor', '/favorite/get-all/user']
  },
  
  // 轮播图配置
  banners: [
    {
      "url": "https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/17589826820698d3c667d028d440d9abf513e80ae7101.jpg",
      "title": "遇事不决，可问春风！",
      "color": "#ca8d6b",
      "target": "/video/15"
    },
    {
      "url": "https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/17589768399379eadaee17ca1464dbfb7e8fc4a5ec587.jpg",
      "title": "安和桥一响，你也会遗憾吗？",
      "color": "#5894d4",
      "target": "/video/2"
    },
    {
      "url": "https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/1758984031100d9077a98b81d406d8388aa87bdaac3dc.jpg",
      "title": "有有眼无珠最新力作",
      "color": "#836e61",
      "target": "/video/20"
    },
    {
      "url": "https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/1758979140523104b819c97174dd4a0ff8efc5c9fa650.jpg",
      "title": "巅峰产生虚伪的拥护 黄昏见证虔诚的信徒",
      "color": "#728cb4",
      "target": "/video/4"
    },
    {
      "url": "https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/17589799661147452c8c748944505bd6c49642430cce3.jpg",
      "title": "卡芙卡角色PV——「戏剧性反讽」",
      "color": "#564e3e",
      "target": "/video/10"
    },
    {
      "url": "https://blblcc.oss-cn-hangzhou.aliyuncs.com/20250927/img/cover/17589847753139a04c3aae3774cc98ef4dd4ae4bb08f4.jpg",
      "title": "要是 小申鹤 和 甘雨这两个孩子小时候见面 ..这孩子胖到只要稍一失足，就会咕噜咕噜溜到山脚",
      "color": "#724b50",
      "target": "/video/28"
    }
  ]
};

module.exports = config;

