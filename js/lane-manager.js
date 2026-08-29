/**
 * レーン＆スイマー管理マネージャー (LaneManager)
 * 「レーン」の中に「複数人のスイマー（泳者）」が所属する階層データ構造を管理し、
 * 時間差自動スタート判定、個別/レーン別/全体ラップ・スプリット計算を担当します。
 */

export const LANE_COLORS = [
  { name: 'シアン', bg: '#00f0ff', text: '#05131e', border: '#00c4d4' },
  { name: 'エメラルド', bg: '#10b981', text: '#022519', border: '#059669' },
  { name: 'アンバー', bg: '#f59e0b', text: '#291800', border: '#d97706' },
  { name: 'ローズ', bg: '#f43f5e', text: '#2a050e', border: '#e11d48' },
  { name: 'パープル', bg: '#a855f7', text: '#1b072e', border: '#9333ea' },
  { name: 'ブルー', bg: '#3b82f6', text: '#051633', border: '#2563eb' },
  { name: 'オレンジ', bg: '#f97316', text: '#2f1001', border: '#ea580c' },
  { name: 'ティール', bg: '#14b8a6', text: '#03231f', border: '#0d9488' }
];

export class LaneManager {
  constructor() {
    this.lanes = [];
    this.justStartedSwimmers = new Set();
    this.initializeDefaultStructure();
  }

  /**
   * 初期デフォルト構造の作成 (2レーン × 各2名)
   */
  initializeDefaultStructure() {
    const lane1 = this.createLaneObject(1, '第1レーン', 0);
    lane1.swimmers = [
      this.createSwimmerObject(lane1.id, 1, '選手 A', 0),
      this.createSwimmerObject(lane1.id, 2, '選手 B', 5)
    ];

    const lane2 = this.createLaneObject(2, '第2レーン', 1);
    lane2.swimmers = [
      this.createSwimmerObject(lane2.id, 1, '選手 C', 0),
      this.createSwimmerObject(lane2.id, 2, '選手 D', 5)
    ];

    this.lanes = [lane1, lane2];
  }

  /**
   * レーンオブジェクト生成
   */
  createLaneObject(laneNumber, name = '', colorIndex = 0) {
    const color = LANE_COLORS[(laneNumber - 1) % LANE_COLORS.length];
    return {
      id: `lane_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      laneNumber: Number(laneNumber),
      name: name || `第${laneNumber}レーン`,
      color: color,
      swimmers: []
    };
  }

  /**
   * スイマー（泳者）オブジェクト生成
   */
  createSwimmerObject(laneId, order, name = '', offsetSeconds = 0) {
    return {
      id: `swimmer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      laneId: laneId,
      order: Number(order),
      name: name || `泳者 ${order}`,
      offsetSeconds: Math.max(0, Number(offsetSeconds) || 0),
      state: 'IDLE', // 'IDLE' | 'STANDBY' | 'RUNNING' | 'STOPPED'
      currentElapsed: 0,
      startedAtMainElapsed: 0,
      stoppedAtElapsed: 0,
      laps: [], // { lapNumber, lapTime, splitTime, overallTime, recordedAt }
      isExpanded: false
    };
  }

  /**
   * レーンの追加
   */
  addLane(name = '') {
    const laneNumber = this.lanes.length + 1;
    const lane = this.createLaneObject(laneNumber, name, laneNumber - 1);
    // デフォルトで1名追加
    lane.swimmers.push(this.createSwimmerObject(lane.id, 1, `選手 ${laneNumber}-1`, 0));
    this.lanes.push(lane);
    return lane;
  }

  /**
   * レーンの削除
   */
  removeLane(laneId) {
    this.lanes = this.lanes.filter(l => l.id !== laneId);
    this.lanes.forEach((lane, idx) => {
      lane.laneNumber = idx + 1;
      lane.color = LANE_COLORS[idx % LANE_COLORS.length];
    });
  }

  /**
   * レーン情報の更新
   */
  updateLane(laneId, updates) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    if (updates.name !== undefined) lane.name = updates.name.trim() || `第${lane.laneNumber}レーン`;
    return lane;
  }

  /**
   * 指定レーンにスイマーを追加
   */
  addSwimmer(laneId, name = '', offsetSeconds = undefined) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;

    const order = lane.swimmers.length + 1;
    const defaultOffset = order === 1 ? 0 : 5; // 1人目は0秒、2人目以降は前者から+5秒
    const swimmer = this.createSwimmerObject(
      lane.id, 
      order, 
      name || `選手 ${lane.laneNumber}-${order}`, 
      offsetSeconds !== undefined ? offsetSeconds : defaultOffset
    );
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
  }

  /**
   * スイマー情報の更新
   */
  updateSwimmer(laneId, swimmerId, updates) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer) return null;

    if (updates.name !== undefined) swimmer.name = updates.name.trim() || `泳者 ${swimmer.order}`;
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
   * スイマーの絶対スタート時刻（全体経過時間基準のミリ秒）を取得
   * レーン内の先頭選手から順に遅延秒数を加算（前者からの+秒数）
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
   * メインタイマー開始時の全スイマー初期化
   * 各選手のスタート時刻 = 前者のスタート時刻 + 当該選手の遅延秒数
   */
  onMainStart(mainElapsedMs) {
    this.lanes.forEach(lane => {
      let accumulatedOffsetMs = 0;
      lane.swimmers.forEach(swimmer => {
        accumulatedOffsetMs += swimmer.offsetSeconds * 1000;
        if (swimmer.state === 'IDLE') {
          if (accumulatedOffsetMs <= mainElapsedMs) {
            swimmer.state = 'RUNNING';
            swimmer.startedAtMainElapsed = accumulatedOffsetMs;
            swimmer.currentElapsed = mainElapsedMs - accumulatedOffsetMs;
            this.justStartedSwimmers.add(swimmer.id);
          } else {
            swimmer.state = 'STANDBY';
            swimmer.startedAtMainElapsed = accumulatedOffsetMs;
            swimmer.currentElapsed = 0;
          }
          swimmer.laps = [];
        }
      });
    });
  }

  /**
   * 毎フレームの更新処理（前者からの累積時間差自動スタート判定と経過時間更新）
   * @returns {Array<string>} 新たに自動スタートしたスイマーIDの配列
   */
  update(mainElapsedMs, mainState) {
    const newlyStarted = [];

    this.lanes.forEach(lane => {
      let accumulatedOffsetMs = 0;
      lane.swimmers.forEach(swimmer => {
        accumulatedOffsetMs += swimmer.offsetSeconds * 1000;

        if (mainState === 'IDLE') {
          swimmer.currentElapsed = 0;
          return;
        }

        if (swimmer.state === 'STANDBY') {
          if (mainElapsedMs >= accumulatedOffsetMs) {
            // オフセット到達！自動スタート
            swimmer.state = 'RUNNING';
            swimmer.startedAtMainElapsed = accumulatedOffsetMs;
            swimmer.currentElapsed = mainElapsedMs - accumulatedOffsetMs;
            newlyStarted.push(swimmer.id);
            this.justStartedSwimmers.add(swimmer.id);
          } else {
            swimmer.currentElapsed = 0;
          }
        } else if (swimmer.state === 'RUNNING') {
          if (mainState === 'RUNNING') {
            swimmer.currentElapsed = Math.max(0, mainElapsedMs - swimmer.startedAtMainElapsed);
          }
        }
      });
    });

    return newlyStarted;
  }

  /**
   * 個別スイマーのラップ打刻
   * 計測中または停止中はもちろん、待機中に手動で押された場合も即座にスタート＆打刻可能
   */
  recordSwimmerLap(laneId, swimmerId, mainElapsedMs) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return null;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer) return null;

    // 待機中または未スタートでLAPが押された場合は手動即時スタート扱い
    if (swimmer.state === 'STANDBY' || swimmer.state === 'IDLE') {
      swimmer.state = 'RUNNING';
      swimmer.startedAtMainElapsed = mainElapsedMs;
      swimmer.currentElapsed = 0;
    }

    const splitTime = swimmer.currentElapsed;
    const lapNumber = swimmer.laps.length + 1;
    const prevSplit = swimmer.laps.length > 0 
      ? swimmer.laps[swimmer.laps.length - 1].splitTime 
      : 0;

    const lapTime = splitTime - prevSplit;

    const lapRecord = {
      lapNumber,
      lapTime,
      splitTime,
      overallTime: mainElapsedMs,
      recordedAt: new Date().toISOString()
    };

    swimmer.laps.push(lapRecord);
    return lapRecord;
  }

  /**
   * 指定レーン内の動作中全スイマーの一括ラップ打刻
   */
  recordLaneAllLaps(laneId, mainElapsedMs) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return [];

    const results = [];
    lane.swimmers.forEach(swimmer => {
      if (swimmer.state === 'RUNNING') {
        const lap = this.recordSwimmerLap(lane.id, swimmer.id, mainElapsedMs);
        if (lap) results.push({ laneId: lane.id, swimmerId: swimmer.id, lap });
      }
    });
    return results;
  }

  /**
   * 全レーン・全スイマーの一斉ラップ打刻
   */
  recordAllLaps(mainElapsedMs) {
    const results = [];
    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        if (swimmer.state === 'RUNNING') {
          const lap = this.recordSwimmerLap(lane.id, swimmer.id, mainElapsedMs);
          if (lap) results.push({ laneId: lane.id, swimmerId: swimmer.id, lap });
        }
      });
    });
    return results;
  }

  /**
   * 個別スイマーの停止
   */
  stopSwimmer(laneId, swimmerId, mainElapsedMs) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer || swimmer.state !== 'RUNNING') return;

    swimmer.state = 'STOPPED';
    swimmer.stoppedAtElapsed = swimmer.currentElapsed;
  }

  /**
   * 個別スイマーの再開
   */
  resumeSwimmer(laneId, swimmerId, mainElapsedMs) {
    const lane = this.lanes.find(l => l.id === laneId);
    if (!lane) return;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer || swimmer.state !== 'STOPPED') return;

    swimmer.state = 'RUNNING';
    swimmer.startedAtMainElapsed = mainElapsedMs - swimmer.stoppedAtElapsed;
  }

  /**
   * 全スイマーの一括停止
   */
  stopAll(mainElapsedMs) {
    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        if (swimmer.state === 'RUNNING') {
          this.stopSwimmer(lane.id, swimmer.id, mainElapsedMs);
        }
      });
    });
  }

  /**
   * 全リセット
   */
  resetAll() {
    this.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        swimmer.state = 'IDLE';
        swimmer.currentElapsed = 0;
        swimmer.startedAtMainElapsed = 0;
        swimmer.stoppedAtElapsed = 0;
        swimmer.laps = [];
      });
    });
    this.justStartedSwimmers.clear();
  }

  /**
   * 現在の全階層セッションデータをエクスポート用オブジェクトとして出力
   */
  getSessionData(sessionTitle = '', mainTotalElapsed = 0) {
    const now = new Date();
    const formattedDate = now.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let totalSwimmers = 0;
    this.lanes.forEach(l => totalSwimmers += l.swimmers.length);

    return {
      id: `session_${Date.now()}`,
      title: sessionTitle || `水泳計測 ${formattedDate}`,
      createdAt: now.toISOString(),
      displayDate: formattedDate,
      totalElapsed: mainTotalElapsed,
      totalLanes: this.lanes.length,
      totalSwimmers: totalSwimmers,
      lanes: this.lanes.map(lane => {
        return {
          id: lane.id,
          laneNumber: lane.laneNumber,
          name: lane.name,
          color: lane.color,
          swimmers: lane.swimmers.map(swimmer => {
            let bestLap = null;
            let avgLap = null;
            if (swimmer.laps.length > 0) {
              const times = swimmer.laps.map(l => l.lapTime);
              bestLap = Math.min(...times);
              avgLap = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            }
            return {
              id: swimmer.id,
              order: swimmer.order,
              name: swimmer.name,
              offsetSeconds: swimmer.offsetSeconds,
              finalTime: swimmer.currentElapsed,
              bestLap,
              avgLap,
              laps: [...swimmer.laps]
            };
          })
        };
      })
    };
  }

  /**
   * 設定プリセットから復元 (旧バージョンデータ互換対応)
   */
  loadFromConfig(configList) {
    if (!Array.isArray(configList) || configList.length === 0) return;
    
    this.lanes = configList.map((cfgLane, idx) => {
      const lane = this.createLaneObject(idx + 1, cfgLane.name, idx);

      if (Array.isArray(cfgLane.swimmers) && cfgLane.swimmers.length > 0) {
        // 新形式: swimmers 配列がある場合
        lane.swimmers = cfgLane.swimmers.map((cfgSwimmer, sIdx) => {
          return this.createSwimmerObject(
            lane.id,
            sIdx + 1,
            cfgSwimmer.name,
            cfgSwimmer.offsetSeconds
          );
        });
      } else {
        // 旧形式（1レーン1人）からの互換移行、または空の場合
        const initialName = cfgLane.name || `選手 ${idx + 1}-1`;
        const initialOffset = cfgLane.offsetSeconds !== undefined ? cfgLane.offsetSeconds : 0;
        lane.swimmers = [
          this.createSwimmerObject(lane.id, 1, initialName, initialOffset)
        ];
      }
      return lane;
    });

    // もしレーンが0件になった場合はデフォルト構造を再生成
    if (this.lanes.length === 0) {
      this.initializeDefaultStructure();
    }
  }
}
