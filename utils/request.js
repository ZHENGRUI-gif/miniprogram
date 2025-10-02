const { baseURL } = require('./config');

function request({ url, method = 'GET', data = {}, headers = {} }) {
  const token = wx.getStorageSync('teri_token') || wx.getStorageSync('token');
  const finalHeaders = Object.assign({}, headers);
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseURL + url,
      method,
      data,
      header: finalHeaders,
      success: (res) => {
        if (res.statusCode === 403) {
          try { 
            wx.removeStorageSync('teri_token'); 
            wx.removeStorageSync('token'); 
          } catch (e) {}
          wx.showToast({ title: '请先登录', icon: 'none' });
          wx.reLaunch({ url: '/pages/login/login' });
          return;
        }
        resolve(res.data);
      },
      fail: reject
    });
  });
}

module.exports = { request };

