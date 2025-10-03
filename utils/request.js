const { baseURL } = require('./config');

function request({ url, method = 'GET', data = {}, headers = {} }) {
  const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
  const finalHeaders = Object.assign({}, headers);
  
  // 设置默认Content-Type
  if (method === 'POST' && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  
  console.log('发送请求:', { url: baseURL + url, method, data, headers: finalHeaders });
  
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseURL + url,
      method,
      data,
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

