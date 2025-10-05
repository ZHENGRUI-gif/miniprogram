/**
 * 视频时长处理工具函数
 * 参考blbl项目的handleTime函数实现
 */

/**
 * 处理视频时长，将秒数转换为分钟和秒的格式
 * @param {Number|String} time 传入的总时长，以秒为单位
 * @returns {String} 处理后的时间字符串，格式为 'mm:ss'
 */
function handleTime(time) {
    console.log('handleTime 输入:', time, '类型:', typeof time);
    
    // 处理各种输入情况
    if (!time || time === 0 || time === '0') {
        console.log('handleTime 返回默认值 00:00，原因：空值或0');
        return '00:00';
    }
    
    // 处理字符串类型
    if (typeof time === 'string') {
        console.log('handleTime 字符串转换前:', time);
        time = parseFloat(time);
        console.log('handleTime 字符串转换后:', time);
    }
    
    // 处理异常值
    if (isNaN(time) || time < 0) {
        console.log('handleTime 返回默认值 00:00，原因：无效值或负数');
        return '00:00';
    }
    
    // 处理过大的数值（超过24小时）
    if (time > 86400) {
        return handleLongTime(time);
    }
    
    time = parseInt(time);        // 转换为整数
    time = Math.floor(time);      // 向下取整
    
    let minutes = Math.floor(time / 60); // 计算分钟
    let seconds = Math.floor(time % 60); // 计算秒数
    
    // 补零处理
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    
    const result = minutes + ':' + seconds;
    console.log('handleTime 最终结果:', result);
    return result;
}

/**
 * 处理大于1小时的时长，显示为 'hh:mm:ss' 格式
 * @param {Number} time 传入的总时长，以秒为单位
 * @returns {String} 处理后的时间字符串
 */
function handleLongTime(time) {
    if (!time || time === 0) return '00:00:00';
    
    time = parseInt(time);
    time = Math.floor(time);
    
    let hours = Math.floor(time / 3600);
    let minutes = Math.floor((time % 3600) / 60);
    let seconds = Math.floor(time % 60);
    
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    
    return hours + ':' + minutes + ':' + seconds;
}

/**
 * 支持多种时长格式的格式化函数
 * @param {Number|String} duration 时长（秒）
 * @param {String} format 格式类型：'mm:ss', 'hh:mm:ss', 'm:s'
 * @returns {String} 格式化后的时长字符串
 */
function formatDuration(duration, format = 'mm:ss') {
    if (!duration) return '00:00';
    
    const time = parseInt(duration);
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    switch (format) {
        case 'mm:ss':
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        case 'hh:mm:ss':
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        case 'm:s':
            return `${minutes}:${seconds}`;
        default:
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

/**
 * 判断是否需要显示小时格式
 * @param {Number} time 时长（秒）
 * @returns {Boolean} 是否需要显示小时
 */
function needHourFormat(time) {
    return time && time >= 3600; // 超过1小时
}

/**
 * 格式化时间戳为相对时间
 * @param {String|Number} timestamp 时间戳字符串或数字
 * @returns {String} 格式化后的相对时间
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    // 处理时间戳格式
    let date;
    if (typeof timestamp === 'string') {
        // 如果是字符串，尝试解析
        date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
        // 如果是数字，判断是秒还是毫秒
        if (timestamp > 1000000000000) {
            // 毫秒时间戳
            date = new Date(timestamp);
        } else {
            // 秒时间戳
            date = new Date(timestamp * 1000);
        }
    } else {
        return '';
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
        return '';
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 计算时间差
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    // 根据时间差返回相对时间
    if (seconds < 60) {
        return '刚刚';
    } else if (minutes < 60) {
        return `${minutes}分钟前`;
    } else if (hours < 24) {
        return `${hours}小时前`;
    } else if (days < 30) {
        return `${days}天前`;
    } else if (months < 12) {
        return `${months}个月前`;
    } else {
        return `${years}年前`;
    }
}

// 小程序不支持ES6 export，使用module.exports
module.exports = {
    handleTime,
    handleLongTime,
    formatDuration,
    needHourFormat,
    formatTimestamp
};