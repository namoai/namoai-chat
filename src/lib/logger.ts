/**
 * セキュリティ強化: ロギング＆モニタリング整備
 * アクセスログ／エラーログの体系化、異常検知やアラートの設定
 */

import { NextRequest } from 'next/server';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogContext extends Record<string, unknown> {
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30秒

  constructor() {
    // 定期的にバッファをフラッシュ（本番環境では外部サービスに送信）
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogEntry['context']
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };
  }

  private log(level: LogLevel, message: string, context?: LogEntry['context']) {
    const entry = this.createLogEntry(level, message, context);
    
    // 開発環境ではコンソールに出力
    if (this.isDevelopment) {
      const logMethod = level === LogLevel.ERROR || level === LogLevel.CRITICAL 
        ? console.error 
        : level === LogLevel.WARN 
        ? console.warn 
        : console.log;
      
      logMethod(`[${entry.timestamp}] [${level}] ${message}`, context || '');
    }

    // 本番環境ではバッファに保存（外部サービスに送信可能）
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift(); // 古いログを削除
    }

    // 重大なエラーは即座にアラート
    if (level === LogLevel.CRITICAL) {
      this.sendAlert(entry);
    }
  }

  private sendAlert(entry: LogEntry) {
    // TODO: 本番環境では外部アラートサービス（Sentry、Datadog等）に送信
    if (this.isDevelopment) {
      console.error('🚨 CRITICAL ALERT:', entry);
    }
  }

  private flush() {
    if (this.logBuffer.length === 0) return;
    
    // TODO: 本番環境では外部ログサービスに送信
    // 例: Cloud Logging, Datadog, Sentry等
    if (this.isDevelopment) {
      // 開発環境では何もしない（既にコンソールに出力済み）
      this.logBuffer = [];
    } else {
      // 本番環境ではここで外部サービスに送信
      // await sendToLoggingService(this.logBuffer);
      this.logBuffer = [];
    }
  }

  debug(message: string, context?: LogEntry['context']) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogEntry['context']) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogEntry['context']) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogEntry['context']) {
    this.log(LogLevel.ERROR, message, context);
  }

  critical(message: string, context?: LogEntry['context']) {
    this.log(LogLevel.CRITICAL, message, context);
  }

  // アクセスログ用のヘルパー
  logAccess(request: NextRequest, statusCode: number, userId?: string) {
    const ip = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    this.info('API Access', {
      userId,
      ip,
      userAgent,
      path: request.nextUrl.pathname,
      method: request.method,
      statusCode,
    });
  }

  // エラーログ用のヘルパー
  logError(
    error: Error,
    request?: NextRequest,
    userId?: string,
    metadata?: Record<string, unknown>
  ) {
    const context: LogEntry['context'] = {
      userId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      metadata,
    };

    if (request) {
      context.ip = this.getClientIp(request);
      context.userAgent = request.headers.get('user-agent') || 'unknown';
      context.path = request.nextUrl.pathname;
      context.method = request.method;
    }

    this.error(`Error: ${error.message}`, context);
  }

  // 異常検知: 複数の失敗した認証試行を検出
  logFailedAuth(ip: string, email?: string) {
    this.warn('Failed authentication attempt', {
      ip,
      email: email ? email.substring(0, 3) + '***' : undefined, // プライバシー保護
      path: '/api/auth/signin',
    });
  }

  // 異常検知: 異常なリクエストパターンを検出
  logSuspiciousActivity(
    message: string,
    request: NextRequest,
    userId?: string,
    metadata?: Record<string, unknown>
  ) {
    this.warn(`Suspicious activity: ${message}`, {
      userId,
      ip: this.getClientIp(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      path: request.nextUrl.pathname,
      method: request.method,
      metadata,
    });
  }

  private getClientIp(request: NextRequest): string {
    // プロキシ経由の場合のIP取得
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }
    
    return 'unknown';
  }

  // ログを取得（デバッグ用）
  getLogs(level?: LogLevel, limit = 50): LogEntry[] {
    let logs = [...this.logBuffer];
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    return logs.slice(-limit);
  }
}

export const logger = new Logger();

