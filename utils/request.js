const { baseURL } = require('./config');

function request({ url, method = 'GET', data = {}, headers = {} }) {
  const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
  const finalHeaders = Object.assign({}, headers);
  
  // 设置默认Content-Type
  if (method === 'POST' && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  
  // 处理application/x-www-form-urlencoded格式的数据
  let requestData = data;
  if (method === 'POST' && finalHeaders['Content-Type'] === 'application/x-www-form-urlencoded') {
    if (typeof data === 'object') {
      // 手动构建查询字符串格式
      const params = [];
      Object.keys(data).forEach(key => {
        if (Array.isArray(data[key])) {
          // 对于数组，每个元素都作为单独的参数
          data[key].forEach(item => {
            params.push(`${key}=${encodeURIComponent(item)}`);
          });
        } else {
          params.push(`${key}=${encodeURIComponent(data[key])}`);
        }
      });
      requestData = params.join('&');
    }
  }
  
  console.log('发送请求:', { url: baseURL + url, method, data: requestData, headers: finalHeaders });
  console.log('原始数据:', data);
  console.log('转换后数据:', requestData);
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseURL + url,
      method,
      data: requestData,
      header: finalHeaders,
      success: (res) => {
        console.log('请求响应:', { url, statusCode: res.statusCode, data: res.data });
        
        if (res.statusCode === 403) {
          try { 
            wx.removeStorageSync('teri_token'); 
            wx.removeStorageSync('token'); 
          } catch (e) {}
          wx.showToast({ title: '请先登录', icon: 'none' });
          wx.reLaunch({ url: '/pages/login/login' });
          return;
        }
        
        if (res.statusCode >= 400) {
          console.error('请求失败:', { url, statusCode: res.statusCode, data: res.data });
          reject(new Error(`请求失败: ${res.statusCode}`));
          return;
        }
        
        resolve(res.data);
      },
      fail: (error) => {
        console.error('请求错误:', { url, error });
        reject(error);
      }
    });
  });
}

module.exports = { request };

