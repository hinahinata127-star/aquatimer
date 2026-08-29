/**
 * 高精度タイマーエンジン (TimerEngine)
 * performance.now() と Date.now() による絶対時間差分計算方式を採用し、
 * iOSのバックグラウンド移行や画面スリープからの復帰時にも正確な経過時間を維持します。
 */

export class TimerEngine {
  constructor() {
    this.state = 'IDLE'; // 'IDLE' | 'RUNNING' | 'PAUSED'
    this.startTime = 0;       // performance.now() 基準
    this.startDate = 0;       // Date.now() 基準 (バックグラウンド補正用)
    this.pausedElapsed = 0;   // 一時停止時の蓄積時間(ms)
    this.animationFrameId = null;
    this.intervalId = null;
    this.listeners = new Set();
    
    // Page Visibility API のイベント登録（バックグラウンド復帰時の自動再同期）
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._handleVisibilityChange);
    }
  }

  /**
   * タイマーリスナーを登録
   * @param {Function} callback (elapsedMs, state) => void
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 全リスナーへ現在の経過時間を通知
   */
  _notify() {
    const elapsed = this.getElapsedTime();
    for (const callback of this.listeners) {
      try {
        callback(elapsed, this.state);
      } catch (err) {
        console.error('Timer listener error:', err);
      }
    }
  }

  /**
   * 現在の正確な総経過時間(ミリ秒)を取得
   */
  getElapsedTime() {
    if (this.state === 'IDLE') {
      return 0;
    }
    if (this.state === 'PAUSED') {
      return this.pausedElapsed;
    }
    // RUNNING時: 開始時からの差分 + 過去の一時停止蓄積時間
    const nowPerf = performance.now();
    const elapsedPerf = nowPerf - this.startTime;

    // Date.now() によるバックグラウンド長期間経過の補正検証
    const nowDate = Date.now();
    const elapsedDate = nowDate - this.startDate;

    // performance.now() のサスペンドによるズレが発生した場合、Date.now() を優先
    const effectiveElapsed = Math.max(elapsedPerf, elapsedDate);
    return this.pausedElapsed + effectiveElapsed;
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
   * タイマーリセット
   */
  reset() {
    this._stopLoop();
    this.state = 'IDLE';
    this.startTime = 0;
    this.startDate = 0;
    this.pausedElapsed = 0;
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

    // requestAnimationFrame がスロットリングされるバックグラウンド用フォールバック
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
   * バックグラウンドからフォアグラウンドへ復帰時の処理
   */
  _handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.state === 'RUNNING') {
      // 復帰時に即座に正確な時間を通知して再描画
      this._notify();
    }
  }

  /**
   * ミリ秒を 1/100 秒単位の文字列に整形
   * @param {number} ms ミリ秒
   * @param {boolean} forceHours 1時間未満でも時間を含めるか
   * @returns {string} 例: "01:23.45" または "1:02:03.45"
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
   * @param {number} remainingMs 残りミリ秒
   * @returns {string} 例: "-00:04.25"
   */
  static formatCountdown(remainingMs) {
    const ms = Math.max(0, remainingMs);
    const formatted = TimerEngine.formatTime(ms);
    return `-${formatted}`;
  }
}
