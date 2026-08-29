/**
 * AquaTimer Pro - メインアプリケーションコントローラー
 * 複数レーン × レーン毎複数人の時間差計測 & 縦割りマルチカラムUI
 */

import { TimerEngine } from './timer-engine.js';
import { LaneManager } from './lane-manager.js';
import { SoundFX } from './audio.js';
import { StorageManager } from './storage.js';
import { Exporter } from './exporter.js';

class AquaTimerApp {
  constructor() {
    this.timer = new TimerEngine();
    this.laneManager = new LaneManager();
    this.sound = new SoundFX();
    
    this.currentExportSession = null;
    this.currentExportFormat = 'text'; // 'text' | 'csv'
    this.activeTab = 'view-timer';

    this.elements = {};
  }

  /**
   * アプリケーション初期化
   */
  init() {
    this.cacheDomElements();
    this.loadSettings();
    this.loadPreset();
    this.bindEvents();
    this.renderLanes();
    this.renderHistory();
    this.registerServiceWorker();

    // タイマー更新リスナーの登録
    this.timer.subscribe((elapsedMs, state) => {
      this.onTimerTick(elapsedMs, state);
    });

    console.log('AquaTimer Pro initialized.');
  }

  /**
   * DOM要素のキャッシュ
   */
  cacheDomElements() {
    this.elements = {
      // ヘッダー
      btnToggleSound: document.getElementById('btn-toggle-sound'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      btnHeaderSave: document.getElementById('btn-header-save'),

      // メインタイマー
      mainTimeText: document.getElementById('main-time-text'),
      mainTimeCentis: document.getElementById('main-time-centis'),
      btnMainToggle: document.getElementById('btn-main-toggle'),
      btnMainToggleText: document.getElementById('btn-main-toggle-text'),
      btnMainLapAll: document.getElementById('btn-main-lap-all'),
      btnMainReset: document.getElementById('btn-main-reset'),

      // ツールバー
      lanesCountBadge: document.getElementById('lanes-count-badge'),
      swimmersCountBadge: document.getElementById('swimmers-count-badge'),
      btnAddLane: document.getElementById('btn-add-lane'),
      lanesColumnsContainer: document.getElementById('lanes-columns-container'),

      // 履歴
      historyListContainer: document.getElementById('history-list-container'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // ナビゲーション
      navTabs: document.querySelectorAll('.nav-tab'),
      viewSections: document.querySelectorAll('.view-section'),

      // トースト
      toastContainer: document.getElementById('toast-container'),

      // モーダル: スイマー編集/追加
      modalSwimmerEdit: document.getElementById('modal-swimmer-edit'),
      modalSwimmerTitle: document.getElementById('modal-swimmer-title'),
      editSwimmerLaneId: document.getElementById('edit-swimmer-lane-id'),
      editSwimmerId: document.getElementById('edit-swimmer-id'),
      inputSwimmerName: document.getElementById('input-swimmer-name'),
      inputSwimmerOffset: document.getElementById('input-swimmer-offset'),
      swimmerDeleteRow: document.getElementById('swimmer-delete-row'),
      btnDeleteSwimmer: document.getElementById('btn-delete-swimmer'),
      btnSaveSwimmer: document.getElementById('btn-save-swimmer'),
      swimmerOffsetPresetBtns: document.querySelectorAll('.swimmer-offset-preset-btn'),

      // モーダル: レーン編集/追加
      modalLaneEdit: document.getElementById('modal-lane-edit'),
      modalLaneTitle: document.getElementById('modal-lane-title'),
      editLaneId: document.getElementById('edit-lane-id'),
      inputLaneName: document.getElementById('input-lane-name'),
      laneDeleteRow: document.getElementById('lane-delete-row'),
      btnDeleteLane: document.getElementById('btn-delete-lane'),
      btnSaveLane: document.getElementById('btn-save-lane'),

      // モーダル: セッション保存
      modalSaveSession: document.getElementById('modal-save-session'),
      inputSessionTitle: document.getElementById('input-session-title'),
      btnConfirmSaveSession: document.getElementById('btn-confirm-save-session'),

      // モーダル: エクスポート
      modalExport: document.getElementById('modal-export'),
      exportModalTitle: document.getElementById('export-modal-title'),
      tabFmtText: document.getElementById('tab-fmt-text'),
      tabFmtCsv: document.getElementById('tab-fmt-csv'),
      exportPreviewContent: document.getElementById('export-preview-content'),
      btnActionShare: document.getElementById('btn-action-share'),
      btnActionCopy: document.getElementById('btn-action-copy'),
      btnActionDownload: document.getElementById('btn-action-download')
    };
  }

  /**
   * 設定の読み込み
   */
  loadSettings() {
    const settings = StorageManager.getSettings();
    this.sound.setEnabled(settings.soundEnabled);
    this.updateSoundIcon(settings.soundEnabled);
  }

  /**
   * プリセット復元
   */
  loadPreset() {
    const preset = StorageManager.getLanePreset();
    if (preset && preset.length > 0) {
      this.laneManager.loadFromConfig(preset);
    }
  }

  /**
   * イベントリスナーの登録
   */
  bindEvents() {
    // 強制最新化リフレッシュ
    const btnRefresh = document.getElementById('btn-force-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        window.location.reload(true);
      });
    }

    // タブ切り替え
    this.elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchView(tab.dataset.target);
      });
    });

    // 効果音切り替え
    this.elements.btnToggleSound.addEventListener('click', () => {
      const newState = !this.sound.enabled;
      this.sound.setEnabled(newState);
      this.updateSoundIcon(newState);
      StorageManager.saveSettings({ soundEnabled: newState });
      this.showToast(newState ? '効果音 ON' : '効果音 OFF');
    });

    // ヘッダー保存ボタン
    this.elements.btnHeaderSave.addEventListener('click', () => {
      this.openSaveSessionModal();
    });

    // メインタイマートグル (スタート/停止)
    this.elements.btnMainToggle.addEventListener('click', () => {
      this.toggleMainTimer();
    });

    // 全員一括ラップ
    this.elements.btnMainLapAll.addEventListener('click', () => {
      this.recordAllLaps();
    });

    // メインリセット
    this.elements.btnMainReset.addEventListener('click', () => {
      this.resetMainTimer();
    });

    // レーン追加
    this.elements.btnAddLane.addEventListener('click', () => {
      const lane = this.laneManager.addLane();
      this.savePresetAndRender();
      this.showToast(`${lane.name} を追加しました`);
    });

    // スイマー編集モーダル内イベント
    this.elements.swimmerOffsetPresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.inputSwimmerOffset.value = btn.dataset.offset;
      });
    });

    this.elements.btnSaveSwimmer.addEventListener('click', () => {
      this.saveSwimmerConfig();
    });

    this.elements.btnDeleteSwimmer.addEventListener('click', () => {
      const laneId = this.elements.editSwimmerLaneId.value;
      const swimmerId = this.elements.editSwimmerId.value;
      if (laneId && swimmerId) {
        this.laneManager.removeSwimmer(laneId, swimmerId);
        this.savePresetAndRender();
        this.closeModal(this.elements.modalSwimmerEdit);
        this.showToast('選手を削除しました');
      }
    });

    // レーン編集モーダル内イベント
    this.elements.btnSaveLane.addEventListener('click', () => {
      const laneId = this.elements.editLaneId.value;
      const name = this.elements.inputLaneName.value.trim();
      if (laneId) {
        this.laneManager.updateLane(laneId, { name });
        this.savePresetAndRender();
        this.closeModal(this.elements.modalLaneEdit);
        this.showToast('レーン設定を更新しました');
      }
    });

    this.elements.btnDeleteLane.addEventListener('click', () => {
      const laneId = this.elements.editLaneId.value;
      if (laneId) {
        this.laneManager.removeLane(laneId);
        this.savePresetAndRender();
        this.closeModal(this.elements.modalLaneEdit);
        this.showToast('レーンを削除しました');
      }
    });

    // セッション保存確認
    this.elements.btnConfirmSaveSession.addEventListener('click', () => {
      this.confirmSaveSession();
    });

    // 履歴全消去
    this.elements.btnClearHistory.addEventListener('click', () => {
      if (confirm('すべての計測履歴を消去してもよろしいですか？')) {
        StorageManager.clearAllSessions();
        this.renderHistory();
        this.showToast('履歴をすべて消去しました');
      }
    });

    // エクスポートモーダル内イベント
    this.elements.tabFmtText.addEventListener('click', () => this.switchExportFormat('text'));
    this.elements.tabFmtCsv.addEventListener('click', () => this.switchExportFormat('csv'));

    this.elements.btnActionShare.addEventListener('click', async () => {
      if (!this.currentExportSession) return;
      const res = await Exporter.shareSession(this.currentExportSession, this.currentExportFormat);
      if (res.success && res.method === 'native_share') {
        this.showToast('共有シートを開きました');
      } else if (res.success && res.method === 'download') {
        this.showToast('ファイルをダウンロードしました');
      }
    });

    this.elements.btnActionCopy.addEventListener('click', async () => {
      if (!this.currentExportSession) return;
      const ok = await Exporter.copyToClipboard(this.currentExportSession, this.currentExportFormat);
      if (ok) this.showToast('クリップボードにコピーしました！');
    });

    this.elements.btnActionDownload.addEventListener('click', () => {
      if (!this.currentExportSession) return;
      const isCsv = this.currentExportFormat === 'csv';
      const content = isCsv 
        ? Exporter.generateCsvFormat(this.currentExportSession)
        : Exporter.generateTextFormat(this.currentExportSession);
      const mime = isCsv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
      const ext = isCsv ? 'csv' : 'txt';
      const filename = `${this.currentExportSession.title || 'aquatimer_record'}_${Date.now()}.${ext}`;
      const blob = new Blob([content], { type: mime });
      Exporter.downloadFile(blob, filename);
      this.showToast('ファイルを保存しました');
    });

    // モーダル閉じるボタン
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById(btn.dataset.close);
        if (modal) this.closeModal(modal);
      });
    });
  }

  /**
   * タブ画面切り替え
   */
  switchView(targetViewId) {
    this.activeTab = targetViewId;
    this.elements.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.target === targetViewId);
    });

    this.elements.viewSections.forEach(section => {
      section.classList.toggle('active', section.id === targetViewId);
    });

    if (targetViewId === 'view-history') {
      this.renderHistory();
    }
  }

  /**
   * サウンドアイコンの更新
   */
  updateSoundIcon(enabled) {
    this.elements.btnToggleSound.classList.toggle('active', enabled);
    this.elements.iconSoundOn.style.display = enabled ? 'block' : 'none';
    this.elements.iconSoundOff.style.display = enabled ? 'none' : 'block';
  }

  /**
   * メインタイマートグル
   */
  toggleMainTimer() {
    if (this.timer.state === 'RUNNING') {
      this.timer.pause();
      const elapsed = this.timer.getElapsedTime();
      this.laneManager.stopAll(elapsed);
      this.sound.playStop();
      this.updateMainControlsUI('PAUSED');
      this.showToast('タイマーを停止しました');
    } else {
      const isInitialStart = this.timer.state === 'IDLE';
      this.timer.start();
      const elapsed = this.timer.getElapsedTime();

      if (isInitialStart) {
        this.laneManager.onMainStart(elapsed);
      }
      this.sound.playStart();
      this.updateMainControlsUI('RUNNING');
    }
    this.renderLanes();
  }

  /**
   * 全員一括ラップ
   */
  recordAllLaps() {
    const elapsed = this.timer.getElapsedTime();
    const results = this.laneManager.recordAllLaps(elapsed);
    if (results.length > 0) {
      this.sound.playLap();
      this.showToast(`全 ${results.length} 名のLAPを記録しました`);
      this.renderLanes();
    }
  }

  /**
   * メインリセット
   */
  resetMainTimer() {
    if (this.timer.state === 'RUNNING') {
      if (!confirm('計測中のタイマーをリセットしますか？')) return;
    }
    this.timer.reset();
    this.laneManager.resetAll();
    this.updateMainControlsUI('IDLE');
    this.renderLanes();
    this.updateClockDisplay(0);
    this.showToast('タイマーをリセットしました');
  }

  /**
   * メインコントロールUIの更新
   */
  updateMainControlsUI(state) {
    const btn = this.elements.btnMainToggle;
    const textSpan = this.elements.btnMainToggleText;

    if (state === 'RUNNING') {
      btn.className = 'main-btn main-btn-stop';
      textSpan.textContent = '全停止';
      btn.querySelector('svg path').setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
      this.elements.btnMainLapAll.style.display = 'flex';
    } else if (state === 'PAUSED') {
      btn.className = 'main-btn main-btn-start';
      textSpan.textContent = '再開';
      btn.querySelector('svg path').setAttribute('d', 'M8 5v14l11-7z');
      this.elements.btnMainLapAll.style.display = 'none';
    } else {
      btn.className = 'main-btn main-btn-start';
      textSpan.textContent = '一斉スタート';
      btn.querySelector('svg path').setAttribute('d', 'M8 5v14l11-7z');
      this.elements.btnMainLapAll.style.display = 'none';
    }
  }

  /**
   * 毎フレームのタイマー更新処理
   */
  onTimerTick(mainElapsedMs, mainState) {
    // 1. メイン時計の表示
    this.updateClockDisplay(mainElapsedMs);

    // 2. スイマーの時間差スタート判定
    const newlyStarted = this.laneManager.update(mainElapsedMs, mainState);
    if (newlyStarted.length > 0) {
      this.sound.playLaneStart();
      newlyStarted.forEach(swimmerId => {
        const card = document.getElementById(`swimmer-card-${swimmerId}`);
        if (card) {
          card.classList.add('flash-start');
          setTimeout(() => card.classList.remove('flash-start'), 600);
        }
      });
    }

    // 3. 各スイマーのタイマー数値を高速更新
    this.updateSwimmersTimeDisplay(mainElapsedMs);
  }

  /**
   * メイン時計のテキスト描画
   */
  updateClockDisplay(ms) {
    const formatted = TimerEngine.formatTime(ms);
    const dotIndex = formatted.lastIndexOf('.');
    if (dotIndex !== -1) {
      this.elements.mainTimeText.textContent = formatted.substring(0, dotIndex);
      this.elements.mainTimeCentis.textContent = formatted.substring(dotIndex);
    } else {
      this.elements.mainTimeText.textContent = formatted;
      this.elements.mainTimeCentis.textContent = '.00';
    }
  }

  /**
   * 各スイマーの個別タイマー数値・ボタン状態をDOM直接更新
   */
  updateSwimmersTimeDisplay(mainElapsedMs) {
    const isMainRunning = this.timer.state === 'RUNNING';

    this.laneManager.lanes.forEach(lane => {
      lane.swimmers.forEach(swimmer => {
        const timeElem = document.getElementById(`swimmer-clock-${swimmer.id}`);
        const statusElem = document.getElementById(`swimmer-status-${swimmer.id}`);
        const cardElem = document.getElementById(`swimmer-card-${swimmer.id}`);
        const btnLap = cardElem ? cardElem.querySelector('.swimmer-btn-lap') : null;
        const btnStop = cardElem ? cardElem.querySelector('[data-action="swimmer-stop"], [data-action="swimmer-resume"]') : null;
        if (!timeElem) return;

        const offsetMs = swimmer.startedAtMainElapsed || this.laneManager.getSwimmerAbsoluteOffsetMs(lane.id, swimmer.id);

        if (swimmer.state === 'STANDBY') {
          const remainingMs = offsetMs - mainElapsedMs;
          timeElem.className = 'swimmer-digital-clock standby';
          timeElem.innerHTML = `${TimerEngine.formatCountdown(remainingMs)}`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-standby';
            statusElem.textContent = '待機中';
          }
          if (cardElem) cardElem.className = `swimmer-card state-standby ${swimmer.isExpanded ? 'expanded' : ''}`;
          // メインタイマー稼働中はLAPボタンを有効にしておく（手動前倒しスタート・ラップも可能）
          if (btnLap) btnLap.disabled = !isMainRunning;
        } else if (swimmer.state === 'RUNNING') {
          timeElem.className = 'swimmer-digital-clock';
          const formatted = TimerEngine.formatTime(swimmer.currentElapsed);
          const dotIndex = formatted.lastIndexOf('.');
          timeElem.innerHTML = `<span>${formatted.substring(0, dotIndex)}</span><span class="centis">${formatted.substring(dotIndex)}</span>`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-running';
            statusElem.textContent = '計測中';
          }
          if (cardElem) cardElem.className = `swimmer-card state-running ${swimmer.isExpanded ? 'expanded' : ''}`;
          if (btnLap) btnLap.disabled = false;
        } else if (swimmer.state === 'STOPPED') {
          timeElem.className = 'swimmer-digital-clock';
          const formatted = TimerEngine.formatTime(swimmer.currentElapsed);
          const dotIndex = formatted.lastIndexOf('.');
          timeElem.innerHTML = `<span>${formatted.substring(0, dotIndex)}</span><span class="centis">${formatted.substring(dotIndex)}</span>`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-stopped';
            statusElem.textContent = '停止';
          }
          if (cardElem) cardElem.className = `swimmer-card state-stopped ${swimmer.isExpanded ? 'expanded' : ''}`;
          if (btnLap) btnLap.disabled = false;
        } else {
          // IDLE
          timeElem.className = 'swimmer-digital-clock';
          timeElem.innerHTML = `<span>00:00</span><span class="centis">.00</span>`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-idle';
            statusElem.textContent = '待機';
          }
          if (cardElem) cardElem.className = `swimmer-card state-idle ${swimmer.isExpanded ? 'expanded' : ''}`;
          if (btnLap) btnLap.disabled = true;
        }
      });
    });
  }

  /**
   * 縦割りマルチカラム レーン＆スイマー全体のレンダリング
   */
  renderLanes() {
    const container = this.elements.lanesColumnsContainer;
    let totalSwimmers = 0;
    this.laneManager.lanes.forEach(l => totalSwimmers += l.swimmers.length);

    this.elements.lanesCountBadge.textContent = `${this.laneManager.lanes.length} レーン`;
    this.elements.swimmersCountBadge.textContent = `${totalSwimmers} 名`;

    if (this.laneManager.lanes.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted); width:100%;">
          <p>レーンが登録されていません。「レーン追加」ボタンから登録してください。</p>
        </div>
      `;
      return;
    }

    const isTimerActive = this.timer.state === 'RUNNING' || this.timer.state === 'PAUSED';

    container.innerHTML = this.laneManager.lanes.map(lane => {
      // スイマーカード群のHTML
      const swimmersHtml = lane.swimmers.map(swimmer => {
        const isRunning = swimmer.state === 'RUNNING';
        const isStopped = swimmer.state === 'STOPPED';
        const isStandby = swimmer.state === 'STANDBY';

        let stateClass = 'state-idle';
        let statusBadge = '<span id="swimmer-status-' + swimmer.id + '" class="swimmer-status-tag status-badge-idle">待機</span>';

        if (isRunning) {
          stateClass = 'state-running';
          statusBadge = '<span id="swimmer-status-' + swimmer.id + '" class="swimmer-status-tag status-badge-running">計測中</span>';
        } else if (isStandby) {
          stateClass = 'state-standby';
          statusBadge = '<span id="swimmer-status-' + swimmer.id + '" class="swimmer-status-tag status-badge-standby">待機中</span>';
        } else if (isStopped) {
          stateClass = 'state-stopped';
          statusBadge = '<span id="swimmer-status-' + swimmer.id + '" class="swimmer-status-tag status-badge-stopped">停止</span>';
        }

        const lapsCount = swimmer.laps.length;
        const latestLap = lapsCount > 0 ? swimmer.laps[lapsCount - 1] : null;
        const latestLapStr = latestLap ? TimerEngine.formatTime(latestLap.lapTime) : '--:--.--';

        const offsetLabel = swimmer.offsetSeconds > 0 ? `+${swimmer.offsetSeconds}s` : '同時';
        const offsetClass = swimmer.offsetSeconds > 0 ? 'swimmer-offset-tag has-offset' : 'swimmer-offset-tag';

        const timeFormatted = TimerEngine.formatTime(swimmer.currentElapsed);
        const dotIndex = timeFormatted.lastIndexOf('.');
        const mainTimePart = dotIndex !== -1 ? timeFormatted.substring(0, dotIndex) : timeFormatted;
        const centisPart = dotIndex !== -1 ? timeFormatted.substring(dotIndex) : '.00';

        // LAPボタンの活性化: タイマー稼働中または選手が計測中/停止中なら常時押せる！
        const lapDisabled = (!isTimerActive && !isRunning && !isStopped);

        return `
          <div id="swimmer-card-${swimmer.id}" class="swimmer-card ${stateClass}">
            <!-- 上段: 選手名 & オフセット & ステータス -->
            <div class="swimmer-header-row">
              <div class="swimmer-name-wrap">
                <span class="swimmer-order-badge">#${swimmer.order}</span>
                <span class="swimmer-name">${this.escapeHtml(swimmer.name)}</span>
              </div>
              <div class="swimmer-meta-wrap">
                <span class="${offsetClass}" data-action="edit-swimmer" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}">
                  ${offsetLabel}
                </span>
                ${statusBadge}
                <button class="lane-edit-btn" data-action="edit-swimmer" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}" title="選手設定">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 中段: タイマー ＆ 最新LAP -->
            <div class="swimmer-timer-row">
              <div id="swimmer-clock-${swimmer.id}" class="swimmer-digital-clock">
                <span>${mainTimePart}</span><span class="centis">${centisPart}</span>
              </div>
              <div id="swimmer-lap-box-${swimmer.id}" class="swimmer-latest-lap-box">
                <span class="swimmer-lap-label">Lap ${lapsCount}</span>
                <strong class="swimmer-lap-val">${latestLapStr}</strong>
              </div>
            </div>

            <!-- 下段: 操作アクション (1画面で押しやすい大型LAPボタン) -->
            <div class="swimmer-actions-row">
              <button class="swimmer-btn-lap" data-action="swimmer-lap" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}" ${lapDisabled ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>
                </svg>
                <span>LAP</span>
              </button>

              ${isRunning ? `
                <button class="swimmer-btn-stop" data-action="swimmer-stop" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}">
                  停止
                </button>
              ` : isStopped ? `
                <button class="swimmer-btn-resume" data-action="swimmer-resume" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}">
                  再開
                </button>
              ` : `
                <button class="swimmer-btn-stop" style="opacity:0.4;" disabled>
                  停止
                </button>
              `}

              <button class="swimmer-btn-accordion ${swimmer.isExpanded ? 'open' : ''}" data-action="toggle-swimmer-accordion" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}" title="ラップ履歴">
                <span>履歴</span>
                <span class="swimmer-acc-count" style="font-size:0.65rem; font-family:var(--font-mono);">(${lapsCount})</span>
              </button>
            </div>

            <!-- ラップ履歴アコーディオン -->
            <div id="swimmer-accordion-${swimmer.id}" class="swimmer-laps-accordion ${swimmer.isExpanded ? 'show' : ''}">
              ${this.renderSwimmerLapsTable(swimmer)}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="lane-column" style="--lane-color: ${lane.color.bg};">
          <!-- レーン縦割りヘッダー -->
          <div class="lane-col-header">
            <div class="lane-col-header-left">
              <span class="lane-badge-tag" style="background:${lane.color.bg}; color:${lane.color.text};">
                LANE ${lane.laneNumber}
              </span>
              <span class="lane-col-title">${this.escapeHtml(lane.name)}</span>
              <span class="lane-swimmers-count">(${lane.swimmers.length}名)</span>
            </div>
            
            <div class="lane-col-header-actions">
              <button class="btn-add-swimmer-sm" data-action="add-swimmer-to-lane" data-lane-id="${lane.id}" title="選手追加">
                + 選手
              </button>
              <button class="btn-lane-menu" data-action="edit-lane" data-lane-id="${lane.id}" title="レーン設定">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- スイマーカードリスト -->
          <div class="swimmers-list">
            ${swimmersHtml}
          </div>
        </div>
      `;
    }).join('');

    this.bindLaneColumnEvents();
  }

  /**
   * スイマーのラップ一覧テーブル
   */
  renderSwimmerLapsTable(swimmer) {
    if (!swimmer.laps || swimmer.laps.length === 0) {
      return '<div class="empty-laps-msg" style="padding:4px 0;">まだラップ記録がありません</div>';
    }

    let minLapTime = Infinity;
    swimmer.laps.forEach(l => {
      if (l.lapTime < minLapTime) minLapTime = l.lapTime;
    });

    const rows = swimmer.laps.slice().reverse().map(lap => {
      const isBest = swimmer.laps.length > 1 && lap.lapTime === minLapTime;
      return `
        <tr class="${isBest ? 'best-lap' : ''}">
          <td>#${lap.lapNumber} ${isBest ? '👑' : ''}</td>
          <td>${TimerEngine.formatTime(lap.lapTime)}</td>
          <td>${TimerEngine.formatTime(lap.splitTime)}</td>
          <td>${TimerEngine.formatTime(lap.overallTime)}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="laps-table" style="font-size:0.72rem;">
        <thead>
          <tr>
            <th>No.</th>
            <th>区間(Lap)</th>
            <th>累積(Split)</th>
            <th>全体</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * レーン列・スイマーカード内イベント登録 (イベントデリゲーションで高信頼化)
   */
  bindLaneColumnEvents() {
    if (this.laneEventsBound) return;
    this.laneEventsBound = true;

    this.elements.lanesColumnsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();

      const action = btn.dataset.action;
      const laneId = btn.dataset.laneId;
      const swimmerId = btn.dataset.swimmerId;

      if (action === 'swimmer-lap') {
        const elapsed = this.timer.getElapsedTime();
        const lap = this.laneManager.recordSwimmerLap(laneId, swimmerId, elapsed);
        if (lap) {
          this.sound.playLap();
          // 該当スイマーのカード表示を高速部分更新
          this.updateSwimmerLapCardUi(laneId, swimmerId);
        }
      } else if (action === 'swimmer-stop') {
        const elapsed = this.timer.getElapsedTime();
        this.laneManager.stopSwimmer(laneId, swimmerId, elapsed);
        this.sound.playStop();
        this.renderLanes();
      } else if (action === 'swimmer-resume') {
        const elapsed = this.timer.getElapsedTime();
        this.laneManager.resumeSwimmer(laneId, swimmerId, elapsed);
        this.sound.playStart();
        this.renderLanes();
      } else if (action === 'toggle-swimmer-accordion') {
        this.laneManager.toggleSwimmerAccordion(laneId, swimmerId);
        this.renderLanes();
      } else if (action === 'add-swimmer-to-lane') {
        this.openSwimmerEditModal(laneId, null);
      } else if (action === 'edit-swimmer') {
        const lane = this.laneManager.lanes.find(l => l.id === laneId);
        const swimmer = lane ? lane.swimmers.find(s => s.id === swimmerId) : null;
        if (swimmer) this.openSwimmerEditModal(laneId, swimmer);
      } else if (action === 'edit-lane') {
        const lane = this.laneManager.lanes.find(l => l.id === laneId);
        if (lane) this.openLaneEditModal(lane);
      }
    });
  }

  /**
   * LAP打刻時のスイマーカード部分更新（DOM全再構築を避けて超高速レスポンス）
   */
  updateSwimmerLapCardUi(laneId, swimmerId) {
    const lane = this.laneManager.lanes.find(l => l.id === laneId);
    if (!lane) return;
    const swimmer = lane.swimmers.find(s => s.id === swimmerId);
    if (!swimmer) return;

    const lapsCount = swimmer.laps.length;
    const latestLap = lapsCount > 0 ? swimmer.laps[lapsCount - 1] : null;
    const latestLapStr = latestLap ? TimerEngine.formatTime(latestLap.lapTime) : '--:--.--';

    // 最新LAP表示を更新
    const lapBox = document.getElementById(`swimmer-lap-box-${swimmer.id}`);
    if (lapBox) {
      const label = lapBox.querySelector('.swimmer-lap-label');
      const val = lapBox.querySelector('.swimmer-lap-val');
      if (label) label.textContent = `Lap ${lapsCount}`;
      if (val) val.textContent = latestLapStr;
    }

    // アコーディオンカウントを更新
    const card = document.getElementById(`swimmer-card-${swimmer.id}`);
    if (card) {
      const accCount = card.querySelector('.swimmer-acc-count');
      if (accCount) accCount.textContent = `(${lapsCount})`;

      // アコーディオンテーブルの更新
      const accContainer = document.getElementById(`swimmer-accordion-${swimmer.id}`);
      if (accContainer) {
        accContainer.innerHTML = this.renderSwimmerLapsTable(swimmer);
      }
    }
  }

  /**
   * スイマー追加/編集モーダル
   */
  openSwimmerEditModal(laneId, swimmer = null) {
    const lane = this.laneManager.lanes.find(l => l.id === laneId);
    if (!lane) return;

    this.elements.editSwimmerLaneId.value = laneId;

    if (swimmer) {
      this.elements.modalSwimmerTitle.textContent = `${lane.name} - 選手設定`;
      this.elements.editSwimmerId.value = swimmer.id;
      this.elements.inputSwimmerName.value = swimmer.name;
      this.elements.inputSwimmerOffset.value = swimmer.offsetSeconds;
      this.elements.swimmerDeleteRow.style.display = 'flex';
    } else {
      const nextOrder = lane.swimmers.length + 1;
      const defaultOffset = nextOrder === 1 ? 0 : 5;
      this.elements.modalSwimmerTitle.textContent = `${lane.name} - 新規選手追加`;
      this.elements.editSwimmerId.value = '';
      this.elements.inputSwimmerName.value = `選手 ${lane.laneNumber}-${nextOrder}`;
      this.elements.inputSwimmerOffset.value = defaultOffset;
      this.elements.swimmerDeleteRow.style.display = 'none';
    }

    this.openModal(this.elements.modalSwimmerEdit);
  }

  /**
   * スイマー設定保存
   */
  saveSwimmerConfig() {
    const laneId = this.elements.editSwimmerLaneId.value;
    const swimmerId = this.elements.editSwimmerId.value;
    const name = this.elements.inputSwimmerName.value.trim();
    const offset = parseFloat(this.elements.inputSwimmerOffset.value) || 0;

    if (swimmerId) {
      this.laneManager.updateSwimmer(laneId, swimmerId, { name, offsetSeconds: offset });
      this.showToast('選手設定を更新しました');
    } else {
      this.laneManager.addSwimmer(laneId, name, offset);
      this.showToast('選手を追加しました');
    }

    this.savePresetAndRender();
    this.closeModal(this.elements.modalSwimmerEdit);
  }

  /**
   * レーン編集モーダル
   */
  openLaneEditModal(lane) {
    this.elements.modalLaneTitle.textContent = `レーン ${lane.laneNumber} 設定`;
    this.elements.editLaneId.value = lane.id;
    this.elements.inputLaneName.value = lane.name;
    this.elements.laneDeleteRow.style.display = 'flex';
    this.openModal(this.elements.modalLaneEdit);
  }

  /**
   * プリセット保存と再描画
   */
  savePresetAndRender() {
    StorageManager.saveLanePreset(this.laneManager.lanes);
    this.renderLanes();
  }

  /**
   * セッション保存モーダル
   */
  openSaveSessionModal() {
    const totalElapsed = this.timer.getElapsedTime();
    const now = new Date();
    const defaultTitle = `水泳計測 ${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.elements.inputSessionTitle.value = defaultTitle;
    this.openModal(this.elements.modalSaveSession);
  }

  /**
   * セッション保存実行
   */
  confirmSaveSession() {
    const title = this.elements.inputSessionTitle.value.trim();
    const totalElapsed = this.timer.getElapsedTime();
    const sessionData = this.laneManager.getSessionData(title, totalElapsed);

    const ok = StorageManager.saveSession(sessionData);
    if (ok) {
      this.closeModal(this.elements.modalSaveSession);
      this.showToast('計測セッションを履歴に保存しました！');
      this.renderHistory();
    } else {
      this.showToast('保存に失敗しました');
    }
  }

  /**
   * 履歴画面のレンダリング
   */
  renderHistory() {
    const container = this.elements.historyListContainer;
    const sessions = StorageManager.getSessions();

    if (!sessions || sessions.length === 0) {
      container.innerHTML = `
        <div class="history-empty-state">
          <div class="history-empty-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>
          <p class="history-empty-text">保存された計測履歴はありません。<br>計測後に「保存」を行うとここに蓄積されます。</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(session => {
      let pills = '';
      session.lanes.forEach(lane => {
        const swimmers = lane.swimmers || [];
        swimmers.forEach(s => {
          pills += `
            <div class="lane-pill">
              <span class="lane-pill-dot" style="background:${lane.color?.bg || '#00f0ff'};"></span>
              <span>[L${lane.laneNumber}] ${this.escapeHtml(s.name)}</span>
              <span class="lane-pill-time">${TimerEngine.formatTime(s.finalTime)}</span>
            </div>
          `;
        });
      });

      return `
        <div class="session-card" data-session-id="${session.id}">
          <div class="session-card-header">
            <div>
              <h4 class="session-title">${this.escapeHtml(session.title)}</h4>
              <span class="session-date">${session.displayDate || ''}</span>
            </div>
            <div class="session-meta-item">
              <span>総時間: </span>
              <strong>${TimerEngine.formatTime(session.totalElapsed, true)}</strong>
            </div>
          </div>

          <div class="session-lanes-preview">
            ${pills}
          </div>

          <div class="session-card-footer">
            <span style="font-size:0.78rem; color:var(--text-muted);">${session.lanes.length} レーン / ${session.totalSwimmers || session.lanes.reduce((acc, l) => acc + (l.swimmers ? l.swimmers.length : 1), 0)} 名</span>
            <div class="session-footer-actions">
              <button class="btn btn-secondary" data-session-action="export" data-session-id="${session.id}" style="font-size:0.82rem; padding:6px 12px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/>
                </svg>
                <span>共有 / 出力</span>
              </button>
              <button class="btn btn-danger" data-session-action="delete" data-session-id="${session.id}" style="font-size:0.82rem; padding:6px 10px;" title="削除">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.elements.historyListContainer.querySelectorAll('[data-session-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.sessionAction;
        const sessionId = btn.dataset.sessionId;
        const session = StorageManager.getSessionById(sessionId);

        if (action === 'export' && session) {
          this.openExportModal(session);
        } else if (action === 'delete') {
          if (confirm('この計測記録を削除しますか？')) {
            StorageManager.deleteSession(sessionId);
            this.renderHistory();
            this.showToast('記録を削除しました');
          }
        }
      });
    });
  }

  /**
   * エクスポートモーダル
   */
  openExportModal(session) {
    this.currentExportSession = session;
    this.currentExportFormat = 'text';
    this.elements.exportModalTitle.textContent = `記録出力: ${session.title}`;
    this.updateExportPreview();
    this.openModal(this.elements.modalExport);
  }

  switchExportFormat(format) {
    this.currentExportFormat = format;
    this.elements.tabFmtText.className = format === 'text' ? 'btn btn-primary' : 'btn btn-secondary';
    this.elements.tabFmtCsv.className = format === 'csv' ? 'btn btn-primary' : 'btn btn-secondary';
    this.updateExportPreview();
  }

  updateExportPreview() {
    if (!this.currentExportSession) return;
    const content = this.currentExportFormat === 'csv'
      ? Exporter.generateCsvFormat(this.currentExportSession)
      : Exporter.generateTextFormat(this.currentExportSession);
    this.elements.exportPreviewContent.textContent = content;
  }

  openModal(modalElement) {
    if (!modalElement) return;
    modalElement.style.display = 'flex';
    requestAnimationFrame(() => modalElement.classList.add('show'));
  }

  closeModal(modalElement) {
    if (!modalElement) return;
    modalElement.classList.remove('show');
    setTimeout(() => { modalElement.style.display = 'none'; }, 250);
  }

  showToast(message, duration = 2500) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--accent-cyan)">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <span>${this.escapeHtml(message)}</span>
    `;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.9)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.log('ServiceWorker registration skipped:', err));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AquaTimerApp();
  app.init();
});
