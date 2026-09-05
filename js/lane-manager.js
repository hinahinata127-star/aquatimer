/**
 * レーン ＆ スイマー階層管理マネージャー (LaneManager)
 * 各スイマーが完全に独立した個別タイマーエンジンとして駆動するアーキテクチャ。
 * 個別計測・一斉スタート・時間差スタート・サイクルリセット・ラップ記録に対応。
 */

export class LaneManager {
  constructor() {
    this.lanes = [];
    this.justStartedSwimmers = new Set();
    this.initDefaultLanes();
  }

  /**
   * 初期デフォルトレーンの作成 (2レーン × 2名)
   */
  initDefaultLanes() {
    const laneColors = [
      { bg: 'linear-gradient(135deg, #00f0ff, #0284c7)', text: '#000000' },
      { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '#000000' },
      { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#000000' },
      { bg: 'linear-gradient(135deg, #ec4899, #be185d)', text: '#ffffff' }
    ];

    this.lanes = [
      {
        id: 'lane_1',
        laneNumber: 1,
        name: '第1レーン',
        color: laneColors[0],
        activeSwimmerIndex: 0,
        swimmers: [
          this._createSwimmer(1, '選手 A1', 0),
          this._createSwimmer(2, '選手 A2', 5)
        ]
      },
      {
        id: 'lane_2',
        laneNumber: 2,
        name: '第2レーン',
        color: laneColors[1],
        activeSwimmerIndex: 0,
        swimmers: [
          this._createSwimmer(1, '選手 B1', 0),
          this._createSwimmer(2, '選手 B2', 5)
        ]
      }
    ];
  }

  /**
   * スイマーオブジェクトの生成（個別タイマー内蔵）
   */
  _createSwimmer(order, name, offsetSeconds = 0) {
    return {
      id: 'swimmer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name || `選手 ${order}`,
      order,
      offsetSeconds: Number(offsetSeconds) || 0,
      state: 'IDLE', // 'IDLE' | 'STANDBY' | 'RUNNING' | 'STOPPED'
      
      // 個別タイマー計測プロパティ
      startTimePerf: 0,
      startDate: 0,
      pausedElapsed: 0,
      currentElapsed: 0,
      cycleNumber: 1, // 現在の本数
      
      // スタンバイ用
      standbyStartTimePerf: 0,
      standbyDurationMs: 0,
      
      laps: [],
      isExpanded: false
    };
  }

  /**
   * 新規レーンの追加
   */
  addLane(name = null) {
    const laneNumber = this.lanes.length + 1;
    const laneColors = [
      { bg: 'linear-gradient(135deg, #00f0ff, #0284c7)', text: '#000000' },
      { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '#000000' },
      { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#000000' },
      { bg: 'linear-gradient(135deg, #ec4899, #be185d)', text: '#ffffff' },
      { bg: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', text: '#ffffff' },
      { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', text: '#ffffff' }
    ];
    const color = laneColors[(laneNumber - 1) % laneColors.length];

    const newLane = {
      id: 'lane_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      laneNumber,
      name: name || `第${laneNumber}レーン`,
      color,
      activeSwimmerIndex: 0,
      swimmers: [
        this._createSwimmer(1, `選手 ${laneNumber}-1`, 0),
        this._createSwimmer(2, `選手 ${laneNumber}-2`, 5)
      ]
    };

    this.lanes.push(newLane);
    return newLane;
  }

  /**
   * レーンの削除
   */
  removeLane(laneId) {
    this.lanes = this.lanes.filter(l => l.id !== laneId);
    this.lanes.forEach((lane, idx) => {
      lane.laneNumber = idx + 1;
      if (lane.name.startsWith('第') && lane.name.endsWith('レーン')) {
        lane.name = `第${idx + 1}レーン`;
      }
    });
  }

  /**
   * レーン設定の更新
   */
  updateLane(laneId, updates) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    if (updates.name !== undefined) lane.name = updates.name.trim() || `第${lane.laneNumber}レーン`;
    return lane;
  }

  /**
   * レーン内へのスイマー追加
   */
  addSwimmer(laneId, name = null, offsetSeconds = null) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;

    const order = lane.swimmers.length + 1;
    const defaultOffset = (order === 1) ? 0 : 5;
    const offset = (offsetSeconds !== null && offsetSeconds !== undefined) 
      ? Number(offsetSeconds) 
      : defaultOffset;

    const swimmer = this._createSwimmer(order, name || `選手 ${lane.laneNumber}-${order}`, offset);
    lane.swimmers.push(swimmer);
    return swimmer;
  }

  /**
   * スイマーの削除
   */
  removeSwimmer(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return;

    lane.swimmers = lane.swimmers.filter(s => s.id !== swimmerId);
    lane.swimmers.forEach((s, idx) => {
      s.order = idx + 1;
    });
    if (lane.activeSwimmerIndex >= lane.swimmers.length) {
      lane.activeSwimmerIndex = Math.max(0, lane.swimmers.length - 1);
    }
  }

  /**
   * スイマー設定の更新
   */
  updateSwimmer(laneId, swimmerId, updates) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer) return null;

    if (updates.name !== undefined) swimmer.name = updates.name.trim() || `選手 ${swimmer.order}`;
    if (updates.offsetSeconds !== undefined) {
      swimmer.offsetSeconds = Math.max(0, parseFloat(updates.offsetSeconds) || 0);
    }
    return swimmer;
  }

  /**
   * スイマーのラップ履歴アコーディオン開閉
   */
  toggleSwimmerAccordion(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (swimmer) {
      swimmer.isExpanded = !swimmer.isExpanded;
    }
  }

  /**
   * 前者基準の累積スタート遅延（ミリ秒）を取得
   */
  getSwimmerAbsoluteOffsetMs(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return 0;
    let totalMs = 0;
    for (const s of lane.swimmers) {
      totalMs += s.offsetSeconds * 1000;
      if (s.id === swimmerId) {
        return totalMs;
      }
    }
    return 0;
  }

  /**
   * スイマーの個別正確経過時間 (ms) の計算
   */
  _calculateSwimmerElapsed(swimmer) {
    if (swimmer.state !== 'RUNNING') return swimmer.currentElapsed;
    const nowPerf = performance.now();
    const elapsedPerf = nowPerf - swimmer.startTimePerf;

    const nowDate = Date.now();
    const elapsedDate = nowDate - swimmer.startDate;

    const effective = Math.max(elapsedPerf, elapsedDate);
    return swimmer.pausedElapsed + effective;
  }

  /**
   * 全選手一斉スタート
   * 先頭選手は即座に個別RUNNING、後者は累積時間差で個別STANDBY開始
   */
  onMainStart() {
    const nowPerf = performance.now();
    const nowDate = Date.now();

    this.lanes.forEach(lane => {
      lane.activeSwimmerIndex = 0; // スタート時は先頭泳者へリセット
      let accumulatedOffsetMs = 0;
      lane.swimmers.forEach(swimmer => {
        accumulatedOffsetMs += swimmer.offsetSeconds * 1000;

        if (accumulatedOffsetMs === 0) {
          // 即座に個別スタート
          swimmer.state = 'RUNNING';
          swimmer.startTimePerf = nowPerf;
          swimmer.startDate = nowDate;
          swimmer.pausedElapsed = 0;
          swimmer.currentElapsed = 0;
          swimmer.cycleNumber = 1;
          this.justStartedSwimmers.add(swimmer.id);
        } else {
          // 個別スタンバイ開始
          swimmer.state = 'STANDBY';
          swimmer.standbyStartTimePerf = nowPerf;
          swimmer.standbyDurationMs = accumulatedOffsetMs;
          swimmer.pausedElapsed = 0;
          swimmer.currentElapsed = 0;
          swimmer.cycleNumber = 1;
        }
        swimmer.laps = [];
      });
    });
  }

  /**
   * 毎フレームの更新処理（各スイマーが独立して時間を刻み、個別サイクル到達でリセット）
   * @param {number} cycleTimeMs 設定されているサイクル時間 (ms, 0なら無効)
   * @returns {{ newlyStarted: Array<string>, newlyCycled: Array<Object> }}
   */
  update(cycleTimeMs = 0) {
    const nowPerf = performance.now();
    const nowDate = Date.now();
    const newlyStarted = [];
    const newlyCycled = [];

    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        if (swimmer.state === 'RUNNING') {
          swimmer.currentElapsed = this._calculateSwimmerElapsed(swimmer);

          // サイクル設定がある場合、選手個別の経過時間がサイクル時間に達したら次本へ個別リセット！
          if (cycleTimeMs > 0 && swimmer.currentElapsed >= cycleTimeMs) {
            swimmer.cycleNumber = (swimmer.cycleNumber || 1) + 1;
            swimmer.startTimePerf = nowPerf;
            swimmer.startDate = nowDate;
            swimmer.pausedElapsed = 0;
            swimmer.currentElapsed = 0;
            newlyCycled.push({ lane, swimmer, cycleNumber: swimmer.cycleNumber });
            this.justStartedSwimmers.add(swimmer.id);
          }
        } else if (swimmer.state === 'STANDBY') {
          const elapsedStandby = nowPerf - swimmer.standbyStartTimePerf;
          if (elapsedStandby >= swimmer.standbyDurationMs) {
            // スタンバイ完了！個別タイマー起動
            swimmer.state = 'RUNNING';
            swimmer.startTimePerf = nowPerf;
            swimmer.startDate = nowDate;
            swimmer.pausedElapsed = 0;
            swimmer.currentElapsed = 0;
            newlyStarted.push(swimmer.id);
            this.justStartedSwimmers.add(swimmer.id);
          }
        }
      });
    });

    return { newlyStarted, newlyCycled };
  }

  /**
   * 個別スイマーのスタンバイ残り時間 (ms)
   */
  getSwimmerStandbyRemainingMs(swimmer) {
    if (swimmer.state !== 'STANDBY') return 0;
    const nowPerf = performance.now();
    const elapsedStandby = nowPerf - swimmer.standbyStartTimePerf;
    return Math.max(0, swimmer.standbyDurationMs - elapsedStandby);
  }

  /**
   * 個別スイマーのラップ打刻
   * サイクル練習（本数リセット）時も、各本数内での正確な区間タイムとスプリットタイムを計算
   */
  recordSwimmerLap(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer) return null;

    // 待機中または未スタートでLAPが押された場合は手動即時スタート扱い
    if (swimmer.state === 'STANDBY' || swimmer.state === 'IDLE') {
      swimmer.state = 'RUNNING';
      swimmer.startTimePerf = performance.now();
      swimmer.startDate = Date.now();
      swimmer.pausedElapsed = 0;
      swimmer.currentElapsed = 0;
    } else if (swimmer.state === 'RUNNING') {
      swimmer.currentElapsed = this._calculateSwimmerElapsed(swimmer);
    }

    const currentCycle = swimmer.cycleNumber || 1;
    const splitTime = swimmer.currentElapsed; // この本数（サイクル）のスタートからの経過時間

    // 現在の本数（サイクル）内での過去ラップ記録を探す
    const currentCycleLaps = swimmer.laps.filter(l => (l.cycleNumber || 1) === currentCycle);
    const prevSplitInCycle = currentCycleLaps.length > 0
      ? currentCycleLaps[currentCycleLaps.length - 1].splitTime
      : 0;

    // この本数内での区間タイム (タイマーリセット後も正確に0秒基準で計算)
    const lapTime = Math.max(0, splitTime - prevSplitInCycle);
    const lapNumber = swimmer.laps.length + 1;
    const cycleLapNumber = currentCycleLaps.length + 1;

    const lapRecord = {
      lapNumber,
      cycleNumber: currentCycle,
      cycleLapNumber,
      lapTime,
      splitTime,
      recordedAt: new Date().toISOString()
    };

    swimmer.laps.push(lapRecord);
    return lapRecord;
  }

  /**
   * レーンの現在LAP対象スイマーを取得
   */
  getActiveSwimmer(laneId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane || lane.swimmers.length === 0) return null;
    const idx = (lane.activeSwimmerIndex !== undefined && lane.activeSwimmerIndex >= 0 && lane.activeSwimmerIndex < lane.swimmers.length)
      ? lane.activeSwimmerIndex
      : 0;
    lane.activeSwimmerIndex = idx;
    return lane.swimmers[idx];
  }

  /**
   * レーンの次回LAP対象スイマーを取得 (プレビュー用)
   */
  getNextSwimmer(laneId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane || lane.swimmers.length <= 1) return null;
    const currentIdx = (lane.activeSwimmerIndex !== undefined && lane.activeSwimmerIndex >= 0 && lane.activeSwimmerIndex < lane.swimmers.length)
      ? lane.activeSwimmerIndex
      : 0;
    const nextIdx = (currentIdx + 1) % lane.swimmers.length;
    return lane.swimmers[nextIdx];
  }

  /**
   * レーンのLAP対象スイマーを手動変更
   */
  setActiveSwimmer(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    const idx = lane.swimmers.findIndex(s => s.id === swimmerId);
    if (idx !== -1) {
      lane.activeSwimmerIndex = idx;
      return lane.swimmers[idx];
    }
    return null;
  }

  /**
   * レーンの次泳者LAPを一発打刻し、自動で次の泳者へ切り替える
   * @param {string} laneId レーンID
   * @returns {{ swimmer: Object, lap: Object, nextSwimmer: Object, lane: Object } | null}
   */
  recordLaneNextLap(laneId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane || lane.swimmers.length === 0) return null;

    const currentIdx = (lane.activeSwimmerIndex !== undefined && lane.activeSwimmerIndex >= 0 && lane.activeSwimmerIndex < lane.swimmers.length)
      ? lane.activeSwimmerIndex
      : 0;
    
    const targetSwimmer = lane.swimmers[currentIdx];
    if (!targetSwimmer) return null;

    // 対象スイマーのラップを記録
    const lap = this.recordSwimmerLap(laneId, targetSwimmer.id);
    if (!lap) return null;

    // 次の泳者へインデックスを進める (最後の泳者の次は1人目へループ)
    const nextIdx = (currentIdx + 1) % lane.swimmers.length;
    lane.activeSwimmerIndex = nextIdx;
    const nextSwimmer = lane.swimmers[nextIdx];

    return {
      swimmer: targetSwimmer,
      lap,
      nextSwimmer,
      lane
    };
  }

  /**
   * 指定したスイマーをスキップして次の泳者にターゲットを進める
   * @param {string} laneId レーンID
   * @param {string} swimmerId スキップ対象のスイマーID
   * @returns {{ skippedSwimmer: Object, nextSwimmer: Object, lane: Object } | null}
   */
  skipSwimmer(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane || lane.swimmers.length === 0) return null;

    const idx = lane.swimmers.findIndex(s => s.id === swimmerId);
    if (idx === -1) return null;

    const skippedSwimmer = lane.swimmers[idx];
    const nextIdx = (idx + 1) % lane.swimmers.length;
    lane.activeSwimmerIndex = nextIdx;
    const nextSwimmer = lane.swimmers[nextIdx];

    return {
      skippedSwimmer,
      nextSwimmer,
      lane
    };
  }

  /**
   * 全員のLAPを一括打刻
   */
  recordAllLaps() {
    const results = [];
    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        if (swimmer.state === 'RUNNING') {
          const lap = this.recordSwimmerLap(lane.id, swimmer.id);
          if (lap) results.push({ lane, swimmer, lap });
        }
      });
    });
    return results;
  }

  /**
   * 個別スイマーの停止
   */
  stopSwimmer(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer || swimmer.state !== 'RUNNING') return;

    swimmer.pausedElapsed = this._calculateSwimmerElapsed(swimmer);
    swimmer.currentElapsed = swimmer.pausedElapsed;
    swimmer.state = 'STOPPED';
  }

  /**
   * 個別スイマーの再開
   */
  resumeSwimmer(laneId, swimmerId) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer || swimmer.state !== 'STOPPED') return;

    swimmer.startTimePerf = performance.now();
    swimmer.startDate = Date.now();
    swimmer.state = 'RUNNING';
  }

  /**
   * 全スイマーの一括停止
   */
  stopAll() {
    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        if (swimmer.state === 'RUNNING') {
          this.stopSwimmer(lane.id, swimmer.id);
        }
      });
    });
  }

  /**
   * 全スイマーの一括再開
   */
  resumeAll() {
    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        if (swimmer.state === 'STOPPED') {
          this.resumeSwimmer(lane.id, swimmer.id);
        }
      });
    });
  }

  /**
   * サイクル到達時のリセット（記録・ラップ履歴は消さずに保持して全選手個別再スタート）
   * @param {number} cycleIndex 次のサイクル番号 (1, 2, 3...)
   */
  onCycleReset(cycleIndex = 1) {
    const nowPerf = performance.now();
    const nowDate = Date.now();

    this.lanes.forEach(lane => {
      lane.activeSwimmerIndex = 0; // サイクル時も先頭泳者へリセット
      let accumulatedOffsetMs = 0;
      lane.swimmers.forEach(swimmer => {
        accumulatedOffsetMs += swimmer.offsetSeconds * 1000;
        
        if (accumulatedOffsetMs === 0) {
          // 先頭選手は0秒スタート
          swimmer.state = 'RUNNING';
          swimmer.startTimePerf = nowPerf;
          swimmer.startDate = nowDate;
          swimmer.pausedElapsed = 0;
          swimmer.currentElapsed = 0;
          this.justStartedSwimmers.add(swimmer.id);
        } else {
          // 2人目以降は待機状態
          swimmer.state = 'STANDBY';
          swimmer.standbyStartTimePerf = nowPerf;
          swimmer.standbyDurationMs = accumulatedOffsetMs;
          swimmer.pausedElapsed = 0;
          swimmer.currentElapsed = 0;
        }
        // 重要: 各選手の過去の swimmer.laps は消さずにそのまま保持
      });
    });
  }

  /**
   * 全リセット (完全初期化)
   */
  resetAll() {
    this.lanes.forEach(lane => {
      lane.activeSwimmerIndex = 0;
      lane.swimmers.forEach(swimmer => {
        swimmer.state = 'IDLE';
        swimmer.startTimePerf = 0;
        swimmer.startDate = 0;
        swimmer.pausedElapsed = 0;
        swimmer.currentElapsed = 0;
        swimmer.standbyStartTimePerf = 0;
        swimmer.standbyDurationMs = 0;
        swimmer.cycleNumber = 1;
        swimmer.laps = [];
      });
    });
    this.justStartedSwimmers.clear();
  }

  /**
   * 現在の全レーン・スイマーの計測結果をセッション保存用オブジェクトとして生成
   * @param {string} title セッション名
   * @param {number} totalElapsed 総経過時間 (ms)
   * @returns {Object} セッションデータ
   */
  getSessionData(title, totalElapsed = 0) {
    const now = new Date();
    const lanesData = this.lanes.map(lane => {
      const swimmersData = lane.swimmers.map(swimmer => {
        const laps = swimmer.laps ? swimmer.laps.slice() : [];
        let finalTime = swimmer.currentElapsed;
        if (laps.length > 0) {
          finalTime = laps[laps.length - 1].splitTime;
        }

        let bestLap = null;
        let avgLap = null;
        if (laps.length > 0) {
          let minLap = Infinity;
          let sumLap = 0;
          laps.forEach(l => {
            if (l.lapTime < minLap) minLap = l.lapTime;
            sumLap += l.lapTime;
          });
          bestLap = minLap;
          avgLap = Math.round(sumLap / laps.length);
        }

        return {
          id: swimmer.id,
          order: swimmer.order,
          name: swimmer.name,
          offsetSeconds: swimmer.offsetSeconds,
          finalTime,
          bestLap,
          avgLap,
          laps
        };
      });

      return {
        id: lane.id,
        laneNumber: lane.laneNumber,
        name: lane.name,
        color: lane.color,
        swimmers: swimmersData
      };
    });

    let totalSwimmers = 0;
    this.lanes.forEach(l => totalSwimmers += l.swimmers.length);

    return {
      id: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: title || `水泳計測 ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      createdAt: now.toISOString(),
      displayDate: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      totalElapsed: Math.max(0, totalElapsed),
      totalSwimmers,
      lanes: lanesData
    };
  }

  /**
   * プリセット保存用データ形式へ変換
   */
  toConfig() {
    return this.lanes.map(lane => ({
      laneNumber: lane.laneNumber,
      name: lane.name,
      color: lane.color,
      swimmers: lane.swimmers.map(s => ({
        order: s.order,
        name: s.name,
        offsetSeconds: s.offsetSeconds
      }))
    }));
  }

  /**
   * プリセットデータから復元
   */
  loadFromConfig(config) {
    if (!Array.isArray(config) || config.length === 0) return;

    this.lanes = config.map((lData, lIdx) => ({
      id: 'lane_' + (lIdx + 1),
      laneNumber: lData.laneNumber || (lIdx + 1),
      name: lData.name || `第${lIdx + 1}レーン`,
      color: lData.color || { bg: 'linear-gradient(135deg, #00f0ff, #0284c7)', text: '#000' },
      activeSwimmerIndex: 0,
      swimmers: Array.isArray(lData.swimmers) ? lData.swimmers.map((sData, sIdx) => {
        return this._createSwimmer(
          sData.order || (sIdx + 1),
          sData.name || `選手 ${lIdx + 1}-${sIdx + 1}`,
          sData.offsetSeconds !== undefined ? sData.offsetSeconds : (sIdx === 0 ? 0 : 5)
        );
      }) : []
    }));
  }
}
