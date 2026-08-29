/**
 * ローカルストレージ管理 (StorageManager)
 * 階層化セッション履歴の保存、およびレーン・スイマー構成プリセットの永続化を担当します。
 */

const STORAGE_KEYS = {
  SESSIONS: 'aquatimer_sessions_v2',
  SETTINGS: 'aquatimer_settings_v1',
  LANE_PRESET: 'aquatimer_lane_presets_v2'
};

export class StorageManager {
  /**
   * 全セッション履歴を取得（新しい順）
   */
  static getSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to get sessions:', e);
      return [];
    }
  }

  /**
   * 単一セッションを取得
   */
  static getSessionById(sessionId) {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  /**
   * 新しいセッションを保存
   */
  static saveSession(sessionData) {
    try {
      const sessions = this.getSessions();
      sessions.unshift(sessionData);
      if (sessions.length > 100) {
        sessions.length = 100;
      }
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      return true;
    } catch (e) {
      console.error('Failed to save session:', e);
      return false;
    }
  }

  /**
   * セッション削除
   */
  static deleteSession(sessionId) {
    try {
      const sessions = this.getSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('Failed to delete session:', e);
      return false;
    }
  }

  /**
   * 全セッション消去
   */
  static clearAllSessions() {
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 設定取得
   */
  static getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const defaults = { soundEnabled: true };
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch (e) {
      return { soundEnabled: true };
    }
  }

  /**
   * 設定保存
   */
  static saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * レーン＆スイマー構成プリセットを保存
   */
  static saveLanePreset(lanes) {
    try {
      const simplified = lanes.map(lane => ({
        name: lane.name,
        swimmers: lane.swimmers.map(s => ({
          name: s.name,
          offsetSeconds: s.offsetSeconds
        }))
      }));
      localStorage.setItem(STORAGE_KEYS.LANE_PRESET, JSON.stringify(simplified));
      return true;
    } catch (e) {
      console.error('Failed to save lane preset:', e);
      return false;
    }
  }

  /**
   * レーン＆スイマー構成プリセットを復元
   */
  static getLanePreset() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LANE_PRESET);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
}
