/**
 * Web Audio API 音声シンセサイザー (SoundFX)
 * 外部音声ファイルへの依存なく、プールサイドでも聞き取りやすい
 * クリアな電子音（スタート合図音・カウントダウン音・ラップ打刻音）を生成します。
 */

export class SoundFX {
  constructor() {
    this.audioCtx = null;
    this.enabled = true; // 設定でON/OFF可能
  }

  /**
   * ユーザー操作時に AudioContext を初期化 (iOS Safari 対策)
   */
  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * 音声の有効/無効の切り替え
   */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  /**
   * 単一トーンの再生
   * @param {number} freq 周波数 (Hz)
   * @param {number} duration 秒数
   * @param {string} type 波形タイプ ('sine' | 'square' | 'triangle')
   */
  _playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.enabled) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback warning:', e);
    }
  }

  /**
   * スタート合図音 (長音の高音ピッ！)
   */
  playStart() {
    this._playTone(880, 0.45, 'triangle', 0.5);
  }

  /**
   * 時間差スタート（個別レーンの開始）音
   */
  playLaneStart() {
    this._playTone(1046.5, 0.25, 'sine', 0.4); // C6音
  }

  /**
   * ラップ打刻音 (軽快なクリップ音)
   */
  playLap() {
    this._playTone(1318.5, 0.08, 'triangle', 0.25); // E6音
  }

  /**
   * カウントダウン予告音 (ピ、ピ、ピ)
   */
  playCountdownTick() {
    this._playTone(587.33, 0.08, 'sine', 0.25); // D5音
  }

  /**
   * 停止音 (低めのトーン)
   */
  playStop() {
    this._playTone(440, 0.2, 'sine', 0.3); // A4音
  }
}
