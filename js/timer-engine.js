/**
 * 高精度タイマーエンジン (TimerEngine)
 * performance.now() と Date.now() による絶対時間差分計算方式を採用。
 * サイクルタイム（インターバル）機能、自動リセット＆リスタート、
 * バックグラウンド復帰時の補正に対応。
 */

export class TimerEngine {
  constructor() {
    this.state = 'IDLE'; // 'IDLE' | 'RUNNING' | 'PAUSED'
    this.startTime = 0;       // performance.now() 基準
    this.startDate = 0;       // Date.now() 基準 (バックグラウンド補正用)
    this.pausedElapsed = 0;   // 現在サイクル内の一時停止蓄積時間(ms)
    
    // サイクル機能関連
    this.cycleTimeMs = 0;         // サイクルタイム（0ならサイクル無効）
    this.cycleNumber = 1;         // 現在のサイクル本数 (1本目, 2本目...)
    this.pastCyclesTotalMs = 0;   // 過去サイクルの合計時間
    this.lastWarnSecond = -1;     // カウントダウン予告音の重複防止

    this.animationFrameId = null;
    this.intervalId = null;
    this.listeners = new Set();
    this.cycleListeners = new Set();
    
    // Page Visibility API のイベント登録（バックグラウンド復帰時の自動再同期）
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._handleVisibilityChange);
    }
  }

  /**
   * タイマーリスナーを登録
   * @param {Function} callback (cycleElapsedMs, state, totalElapsedMs, cycleNumber) => void
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * サイクル切り替えイベントリスナーを登録
   * @param {Function} callback (newCycleNumber) => void
   */
  onCycleChange(callback) {
    this.cycleListeners.add(callback);
    return () => this.cycleListeners.delete(callback);
  }

  /**
   * サイクルタイムの設定 (ms)
   * @param {number} ms サイクル秒数のミリ秒 (0ならOFF)
   */
  setCycleTime(ms) {
    this.cycleTimeMs = Math.max(0, Number(ms) || 0);
  }

  /**
   * 全リスナーへ通知
   */
  _notify() {
    const cycleElapsed = this.getElapsedTime();
    const totalElapsed = this.getTotalElapsedTime();

    // サイクル到達の自動判定
    if (this.state === 'RUNNING' && this.cycleTimeMs > 0 && cycleElapsed >= this.cycleTimeMs) {
      this.advanceToNextCycle();
      return;
    }

    for (const callback of this.listeners) {
      try {
        callback(cycleElapsed, this.state, totalElapsed, this.cycleNumber);
      } catch (err) {
        console.error('Timer listener error:', err);
      }
    }
  }

  /**
   * 次のサイクルへ進む（タイマーを0にリセットして即座に再開）
   */
  advanceToNextCycle() {
    this.pastCyclesTotalMs += (this.cycleTimeMs > 0 ? this.cycleTimeMs : this.getElapsedTime());
    this.cycleNumber += 1;
    this.startTime = performance.now();
    this.startDate = Date.now();
    this.pausedElapsed = 0;
    this.lastWarnSecond = -1;

    // サイクル変更リスナーへ通知
    for (const cb of this.cycleListeners) {
      try {
        cb(this.cycleNumber);
      } catch (e) {
        console.error('Cycle listener error:', e);
      }
    }

    this._notify();
  }

  /**
   * 現在のサイクル内での経過時間(ミリ秒)を取得
   */
  getElapsedTime() {
    if (this.state === 'IDLE') {
      return 0;
    }
    if (this.state === 'PAUSED') {
      return this.pausedElapsed;
    }
    const nowPerf = performance.now();
    const elapsedPerf = nowPerf - this.startTime;

    const nowDate = Date.now();
    const elapsedDate = nowDate - this.startDate;

    const effectiveElapsed = Math.max(elapsedPerf, elapsedDate);
    return this.pausedElapsed + effectiveElapsed;
  }

  /**
   * 過去サイクルを含めた総経過時間(ミリ秒)を取得
   */
  getTotalElapsedTime() {
    return this.pastCyclesTotalMs + this.getElapsedTime();
  }

  /**
   * タイマー開始 / 再開
   */
  start() {
    if (this.state === 'RUNNING') return;

    this.startTime = performance.now();
    this.startDate = Date.now();
    this.state = 'RUNNING';

    this._startLoop();
    this._notify();
  }

  /**
   * タイマー停止 (一時停止)
   */
  pause() {
    if (this.state !== 'RUNNING') return;

    this.pausedElapsed = this.getElapsedTime();
    this.state = 'PAUSED';
    this._stopLoop();
    this._notify();
  }

  /**
   * タイマーリセット (完全初期化)
   */
  reset() {
    this._stopLoop();
    this.state = 'IDLE';
    this.startTime = 0;
    this.startDate = 0;
    this.pausedElapsed = 0;
    this.cycleNumber = 1;
    this.pastCyclesTotalMs = 0;
    this.lastWarnSecond = -1;
    this._notify();
  }

  /**
   * 描画ループの開始
   */
  _startLoop() {
    this._stopLoop();

    const loop = () => {
      if (this.state === 'RUNNING') {
        this._notify();
        this.animationFrameId = requestAnimationFrame(loop);
      }
    };
    this.animationFrameId = requestAnimationFrame(loop);

    this.intervalId = setInterval(() => {
      if (this.state === 'RUNNING') {
        this._notify();
      }
    }, 100);
  }

  /**
   * 描画ループの停止
   */
  _stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * バックグラウンドから復帰時
   */
  _handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.state === 'RUNNING') {
      this._notify();
    }
  }

  /**
   * ミリ秒を 1/100 秒単位の文字列に整形
   */
  static formatTime(ms, forceHours = false) {
    if (ms < 0) ms = 0;
    
    const totalCentis = Math.floor(ms / 10);
    const centis = totalCentis % 100;
    const totalSeconds = Math.floor(totalCentis / 100);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    const pad = (n, len = 2) => String(n).padStart(len, '0');

    if (hours > 0 || forceHours) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
  }

  /**
   * カウントダウン用の残り秒数フォーマット
   */
  static formatCountdown(remainingMs) {
    const ms = Math.max(0, remainingMs);
    const formatted = TimerEngine.formatTime(ms);
    return `-${formatted}`;
  }

  /**
   * サイクルタイムの表示用フォーマット（例: "01:00", "00:45"）
   */
  static formatCycleLabel(ms) {
    if (!ms || ms <= 0) return 'OFF';
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(min)}:${pad(sec)}`;
  }
}
