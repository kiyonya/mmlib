const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class Logger {
  constructor(options = {}) {
    this.options = {
      logDirectory: './logs',       // 日志目录
      fileNameFormat: 'yyyy-MM-dd', // 日志文件名格式
      dateFormat: 'yyyy-MM-dd HH:mm:ss', // 日志时间格式
      maxFileSize: 1024 * 1024 * 10, // 10MB
      ...options
    };

    // 确保日志目录存在
    if (!fs.existsSync(this.options.logDirectory)) {
      fs.mkdirSync(this.options.logDirectory, { recursive: true });
    }

    this.currentDate = format(new Date(), this.options.fileNameFormat);
    this.currentFile = this.getLogFilePath();
    this.initializeStream();
  }

  getLogFilePath() {
    return path.join(
      this.options.logDirectory,
      `${this.currentDate}-${Date.now()}.log`
    );
  }

  initializeStream() {
    // 如果日期变化或文件大小超过限制，创建新文件
    const today = format(new Date(), this.options.fileNameFormat);
    if (today !== this.currentDate || this.checkFileSize()) {
      this.currentDate = today;
      this.currentFile = this.getLogFilePath();
    }
    if (this.stream) {
      this.stream.end();
    }
    // 创建可写流（追加模式）
    this.stream = fs.createWriteStream(this.currentFile, {
      flags: 'a',
      encoding: 'utf8'
    });
  }
  checkFileSize() {
    try {
      const stats = fs.statSync(this.currentFile);
      return stats.size > this.options.maxFileSize;
    } catch (err) {
      return false;
    }
  }
  log(level, message, ...args) {
    const timestamp = format(new Date(), this.options.dateFormat);
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (args.length > 0) {
      logMessage += ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : arg
      ).join(' ');
    }
    this.stream.write(logMessage + '\n');
    console[level](logMessage);
  }
  info(message, ...args) {
    this.log('info', message, ...args);
  }
  warn(message, ...args) {
    this.log('warn', message, ...args);
  }
  error(message, ...args) {
    this.log('error', message, ...args);
  }
  close() {
    if (this.stream) {
      this.stream.end();
    }
  }
}
// 导出单例实例
module.exports = new Logger();