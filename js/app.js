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
    this.currentCycleSeconds = 0; // 0ならOFF

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
    this.timer.subscribe((elapsedMs, state, totalElapsedMs, cycleNumber) => {
      this.onTimerTick(elapsedMs, state, totalElapsedMs, cycleNumber);
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

      // 一括コントロール
      btnMainToggle: document.getElementById('btn-main-toggle'),
      btnMainToggleText: document.getElementById('btn-main-toggle-text'),
      btnMainLapAll: document.getElementById('btn-main-lap-all'),
      btnMainReset: document.getElementById('btn-main-reset'),

      // サイクル
      btnOpenCycleModal: document.getElementById('btn-open-cycle-modal'),
      cycleLabelText: document.getElementById('cycle-label-text'),
      cycleProgressWrap: document.getElementById('cycle-progress-wrap'),
      cycleRoundBadge: document.getElementById('cycle-round-badge'),
      cycleRemainText: document.getElementById('cycle-remain-text'),
      btnNextCycle: document.getElementById('btn-next-cycle'),
      modalCycleSettings: document.getElementById('modal-cycle-settings'),
      cyclePresetBtns: document.querySelectorAll('.cycle-preset-btn'),
      inputCycleMin: document.getElementById('input-cycle-min'),
      inputCycleSec: document.getElementById('input-cycle-sec'),
      btnSaveCycle: document.getElementById('btn-save-cycle'),

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

    // サイクル設定モーダル起動
    this.elements.btnOpenCycleModal.addEventListener('click', () => {
      this.openCycleModal();
    });

    // サイクルプリセットボタンクリック
    this.elements.cyclePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = Number(btn.dataset.seconds) || 0;
        this.elements.inputCycleMin.value = Math.floor(sec / 60);
        this.elements.inputCycleSec.value = sec % 60;
        // 選択スタイル
        this.elements.cyclePresetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // サイクル設定保存
    this.elements.btnSaveCycle.addEventListener('click', () => {
      this.saveCycleConfig();
    });

    // 手動で次サイクルへリセット進む
    this.elements.btnNextCycle.addEventListener('click', () => {
      this.advanceCycleManually();
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
   * 一斉タイマートグル (全選手スタート / 全停止 / 再開)
   */
  toggleMainTimer() {
    if (this.timer.state === 'RUNNING') {
      this.timer.pause();
      this.laneManager.stopAll();
      this.sound.playStop();
      this.updateMainControlsUI('PAUSED');
      this.showToast('全選手の計測を停止しました');
    } else if (this.timer.state === 'PAUSED') {
      this.timer.start();
      this.laneManager.resumeAll();
      this.sound.playStart();
      this.updateMainControlsUI('RUNNING');
      this.showToast('計測を再開しました');
    } else {
      // IDLEからの一斉スタート
      this.timer.start();
      this.laneManager.onMainStart();
      this.sound.playStart();
      this.updateMainControlsUI('RUNNING');
      this.showToast('一斉スタート！');
    }
    this.renderLanes();
  }

  /**
   * 全員一括ラップ
   */
  recordAllLaps() {
    const results = this.laneManager.recordAllLaps();
    if (results.length > 0) {
      this.sound.playLap();
      this.showToast(`全 ${results.length} 名のLAPを記録しました`);
      this.renderLanes();
    }
  }

  /**
   * 全リセット
   */
  resetMainTimer() {
    if (this.timer.state === 'RUNNING') {
      if (!confirm('計測中のタイマーをリセットしますか？')) return;
    }
    this.timer.reset();
    this.laneManager.resetAll();
    this.updateMainControlsUI('IDLE');
    if (this.currentCycleSeconds > 0) {
      this.updateCycleProgress(0, 1);
    }
    this.renderLanes();
    this.showToast('全タイマーをリセットしました');
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
   * サイクル設定モーダルを開く
   */
  openCycleModal() {
    const sec = this.currentCycleSeconds;
    this.elements.inputCycleMin.value = Math.floor(sec / 60);
    this.elements.inputCycleSec.value = sec % 60;

    this.elements.cyclePresetBtns.forEach(btn => {
      if (Number(btn.dataset.seconds) === sec) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.openModal(this.elements.modalCycleSettings);
  }

  /**
   * サイクル設定を保存して適用
   */
  saveCycleConfig() {
    const min = Number(this.elements.inputCycleMin.value) || 0;
    const sec = Number(this.elements.inputCycleSec.value) || 0;
    const totalSeconds = min * 60 + sec;

    this.currentCycleSeconds = totalSeconds;
    this.timer.setCycleTime(totalSeconds * 1000);

    if (totalSeconds > 0) {
      const formatted = TimerEngine.formatCycleLabel(totalSeconds * 1000);
      this.elements.cycleLabelText.textContent = `サイクル: ${formatted}`;
      this.elements.cycleProgressWrap.style.display = 'flex';
      this.showToast(`サイクルタイムを ${formatted} に設定しました`);
    } else {
      this.elements.cycleLabelText.textContent = 'サイクル: OFF';
      this.elements.cycleProgressWrap.style.display = 'none';
      this.showToast('サイクルタイムを OFF にしました');
    }

    this.closeModal(this.elements.modalCycleSettings);
  }

  /**
   * 手動で今すぐ次のサイクルへリセットスタート
   */
  advanceCycleManually() {
    if (this.timer.state !== 'RUNNING') {
      this.showToast('タイマー稼働中に実行できます');
      return;
    }
    this.timer.advanceToNextCycle();
  }

  /**
   * 毎フレームのタイマー更新処理（各選手が個別タイマーで駆動）
   */
  onTimerTick(cycleElapsedMs, mainState, totalElapsedMs, cycleNumber) {
    const cycleMs = this.currentCycleSeconds * 1000;

    // 1. サイクル進行状況＆カウントダウン音の更新
    if (this.currentCycleSeconds > 0) {
      this.updateCycleProgress(cycleElapsedMs, cycleNumber);
    }

    // 2. スイマーの個別時間差スタート判定＆個別サイクルリセット判定
    const { newlyStarted, newlyCycled } = this.laneManager.update(cycleMs);

    // 待機から自動スタートした選手
    if (newlyStarted && newlyStarted.length > 0) {
      this.sound.playLaneStart();
      newlyStarted.forEach(swimmerId => {
        const card = document.getElementById(`swimmer-card-${swimmerId}`);
        if (card) {
          card.classList.add('flash-start');
          setTimeout(() => card.classList.remove('flash-start'), 600);
        }
      });
    }

    // 個別サイクル到達で次の本数へ自動リセットスタートした選手
    if (newlyCycled && newlyCycled.length > 0) {
      this.sound.playLaneStart();
      newlyCycled.forEach(({ swimmer, cycleNumber }) => {
        const card = document.getElementById(`swimmer-card-${swimmer.id}`);
        if (card) {
          card.classList.add('flash-start');
          setTimeout(() => card.classList.remove('flash-start'), 600);
        }
        this.showToast(`${swimmer.name}: ${cycleNumber}本目 スタート！`, 1200);
      });
    }

    // 3. 各スイマーのタイマー数値を高速更新
    this.updateSwimmersTimeDisplay();
  }

  /**
   * サイクルプログレス・残り時間とカウントダウン音の処理
   */
  updateCycleProgress(cycleElapsedMs, cycleNumber) {
    const cycleMs = this.currentCycleSeconds * 1000;
    const remainingMs = Math.max(0, cycleMs - cycleElapsedMs);
    const remainSec = Math.ceil(remainingMs / 1000);

    this.elements.cycleRoundBadge.textContent = `${cycleNumber}本目`;
    this.elements.cycleRemainText.textContent = `次まで ${TimerEngine.formatTime(remainingMs)}`;

    // サイクル終了3秒前、2秒前、1秒前にピッ予告音を再生
    if (this.timer.state === 'RUNNING' && remainSec <= 3 && remainSec > 0) {
      if (this.timer.lastWarnSecond !== remainSec) {
        this.timer.lastWarnSecond = remainSec;
        this.sound.playCountdownTick();
      }
    }
  }

  /**
   * 各スイマーの個別タイマー数値・ボタン状態をDOM直接更新
   */
  updateSwimmersTimeDisplay() {
    const isMainRunning = this.timer.state === 'RUNNING';
    const isTimerActive = this.timer.state === 'RUNNING' || this.timer.state === 'PAUSED';

    this.laneManager.lanes.forEach(lane => {
      const hasSwimmers = lane.swimmers.length > 0;
      const isAnyActive = lane.swimmers.some(s => s.state === 'RUNNING' || s.state === 'STOPPED');
      const laneLapDisabled = !hasSwimmers || (!isTimerActive && !isAnyActive);

      const laneLapBtn = document.getElementById(`lane-quick-lap-btn-${lane.id}`);
      if (laneLapBtn) {
        laneLapBtn.disabled = laneLapDisabled;
      }

      lane.swimmers.forEach(swimmer => {
        const timeElem = document.getElementById(`swimmer-clock-${swimmer.id}`);
        const statusElem = document.getElementById(`swimmer-status-${swimmer.id}`);
        const cardElem = document.getElementById(`swimmer-card-${swimmer.id}`);
        if (!timeElem) return;

        if (swimmer.state === 'STANDBY') {
          const remainingMs = this.laneManager.getSwimmerStandbyRemainingMs(swimmer);
          timeElem.className = 'swimmer-digital-clock standby';
          timeElem.innerHTML = `${TimerEngine.formatCountdown(remainingMs)}`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-standby';
            statusElem.textContent = '待機中';
          }
          if (cardElem) cardElem.className = `swimmer-card state-standby ${swimmer.isExpanded ? 'expanded' : ''} ${cardElem.classList.contains('is-active-target') ? 'is-active-target' : ''}`;
        } else if (swimmer.state === 'RUNNING') {
          timeElem.className = 'swimmer-digital-clock';
          const formatted = TimerEngine.formatTime(swimmer.currentElapsed);
          const dotIndex = formatted.lastIndexOf('.');
          timeElem.innerHTML = `<span>${formatted.substring(0, dotIndex)}</span><span class="centis">${formatted.substring(dotIndex)}</span>`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-running';
            statusElem.textContent = '計測中';
          }
          if (cardElem) cardElem.className = `swimmer-card state-running ${swimmer.isExpanded ? 'expanded' : ''} ${cardElem.classList.contains('is-active-target') ? 'is-active-target' : ''}`;
        } else if (swimmer.state === 'STOPPED') {
          timeElem.className = 'swimmer-digital-clock';
          const formatted = TimerEngine.formatTime(swimmer.currentElapsed);
          const dotIndex = formatted.lastIndexOf('.');
          timeElem.innerHTML = `<span>${formatted.substring(0, dotIndex)}</span><span class="centis">${formatted.substring(dotIndex)}</span>`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-stopped';
            statusElem.textContent = '停止';
          }
          if (cardElem) cardElem.className = `swimmer-card state-stopped ${swimmer.isExpanded ? 'expanded' : ''} ${cardElem.classList.contains('is-active-target') ? 'is-active-target' : ''}`;
        } else {
          // IDLE
          timeElem.className = 'swimmer-digital-clock';
          timeElem.innerHTML = `<span>00:00</span><span class="centis">.00</span>`;
          if (statusElem) {
            statusElem.className = 'swimmer-status-tag status-badge-idle';
            statusElem.textContent = '待機';
          }
          if (cardElem) cardElem.className = `swimmer-card state-idle ${swimmer.isExpanded ? 'expanded' : ''} ${cardElem.classList.contains('is-active-target') ? 'is-active-target' : ''}`;
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
      const activeSwimmer = this.laneManager.getActiveSwimmer(lane.id);
      const nextSwimmer = this.laneManager.getNextSwimmer(lane.id);
      const hasSwimmers = lane.swimmers.length > 0;
      const isAnySwimmerActive = lane.swimmers.some(s => s.state === 'RUNNING' || s.state === 'STOPPED');
      const lapDisabled = !hasSwimmers || (!isTimerActive && !isAnySwimmerActive);

      // スイマーカード群のHTML
      const swimmersHtml = lane.swimmers.map(swimmer => {
        const isRunning = swimmer.state === 'RUNNING';
        const isStopped = swimmer.state === 'STOPPED';
        const isStandby = swimmer.state === 'STANDBY';
        const isActiveTarget = activeSwimmer && activeSwimmer.id === swimmer.id;

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
        const cycleNum = latestLap ? (latestLap.cycleNumber || 1) : 1;
        const cycleLapNum = latestLap ? (latestLap.cycleLapNumber || 1) : 1;
        const latestLapLabel = latestLap ? `#${cycleNum} [L${cycleLapNum}]` : 'Lap 0';

        const offsetLabel = swimmer.offsetSeconds > 0 ? `+${swimmer.offsetSeconds}s` : '同時';
        const offsetClass = swimmer.offsetSeconds > 0 ? 'swimmer-offset-tag has-offset' : 'swimmer-offset-tag';

        const timeFormatted = TimerEngine.formatTime(swimmer.currentElapsed);
        const dotIndex = timeFormatted.lastIndexOf('.');
        const mainTimePart = dotIndex !== -1 ? timeFormatted.substring(0, dotIndex) : timeFormatted;
        const centisPart = dotIndex !== -1 ? timeFormatted.substring(dotIndex) : '.00';

        const targetCardClass = isActiveTarget ? 'is-active-target' : '';

        return `
          <div id="swimmer-card-${swimmer.id}" class="swimmer-card ${stateClass} ${targetCardClass}" data-action="select-active-swimmer" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}">
            <!-- 上段: 選手名 & オフセット & ステータス & ターゲットバッジ -->
            <div class="swimmer-header-row">
              <div class="swimmer-name-wrap">
                <span class="swimmer-order-badge">#${swimmer.order}</span>
                <span class="swimmer-name">${this.escapeHtml(swimmer.name)}</span>
                <span class="swimmer-target-badge">🎯 NEXT</span>
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
                <span class="swimmer-lap-label">${latestLapLabel}</span>
                <strong class="swimmer-lap-val">${latestLapStr}</strong>
              </div>
            </div>

            <!-- 下段: 操作アクション (スキップ & ラップ履歴) -->
            <div class="swimmer-actions-row">
              <button class="swimmer-btn-skip" data-action="swimmer-skip" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}" title="この選手のLAPをパスして次の選手へ切り替え">
                <span class="btn-skip-icon">⏭️</span>
                <span>スキップ</span>
              </button>

              <button class="swimmer-btn-accordion ${swimmer.isExpanded ? 'open' : ''}" data-action="toggle-swimmer-accordion" data-lane-id="${lane.id}" data-swimmer-id="${swimmer.id}" title="ラップ履歴">
                <span>ラップ履歴</span>
                <span class="swimmer-acc-count" style="font-size:0.65rem; font-family:var(--font-mono); margin-left:2px;">(${lapsCount})</span>
              </button>
            </div>

            <!-- ラップ履歴アコーディオン -->
            <div id="swimmer-accordion-${swimmer.id}" class="swimmer-laps-accordion ${swimmer.isExpanded ? 'show' : ''}">
              ${this.renderSwimmerLapsTable(swimmer)}
            </div>
          </div>
        `;
      }).join('');

      // レーン専用 次泳者LAPボタン
      const targetNameStr = activeSwimmer ? this.escapeHtml(activeSwimmer.name) : '選手なし';
      const nextHintStr = nextSwimmer 
        ? `次 ▶ #${nextSwimmer.order} ${this.escapeHtml(nextSwimmer.name)}`
        : (lane.swimmers.length === 1 ? '1名のみ' : '選手未登録');

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

          <!-- ★ レーン専用 次泳者LAPボタン (押すと自動で次の泳者へ切り替え) ★ -->
          <div class="lane-quick-lap-wrap">
            <button id="lane-quick-lap-btn-${lane.id}" class="lane-btn-quick-lap" data-action="lane-quick-lap" data-lane-id="${lane.id}" ${lapDisabled ? 'disabled' : ''}>
              <div class="lap-btn-main-row">
                <div class="lap-btn-left">
                  <span class="lap-btn-icon-tag">⚡ LAP</span>
                  <span class="lap-target-name" id="lap-target-name-${lane.id}">#${activeSwimmer ? activeSwimmer.order : 1} ${targetNameStr}</span>
                </div>
                <div class="lap-btn-right">
                  <span class="lap-next-hint" id="lap-next-hint-${lane.id}">${nextHintStr}</span>
                </div>
              </div>
            </button>
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
   * スイマーのラップ一覧テーブル (本数を#とし、1本中のLAPタイムを改行して表示)
   */
  renderSwimmerLapsTable(swimmer) {
    if (!swimmer.laps || swimmer.laps.length === 0) {
      return '<div class="empty-laps-msg" style="padding:4px 0;">まだラップ記録がありません</div>';
    }

    let minLapTime = Infinity;
    swimmer.laps.forEach(l => {
      if (l.lapTime < minLapTime) minLapTime = l.lapTime;
    });

    // 本数（cycleNumber）ごとにグループ化
    const cycleMap = new Map();
    swimmer.laps.forEach(lap => {
      const cNum = lap.cycleNumber || 1;
      if (!cycleMap.has(cNum)) {
        cycleMap.set(cNum, []);
      }
      cycleMap.get(cNum).push(lap);
    });

    // 本数を新しい順（降順）に並べる
    const cycleNumbers = Array.from(cycleMap.keys()).sort((a, b) => b - a);

    const rows = cycleNumbers.map(cycleNum => {
      const lapsInCycle = cycleMap.get(cycleNum); // この本数内のLAPリスト (時系列順)
      const finalLap = lapsInCycle[lapsInCycle.length - 1];
      const finalTimeStr = TimerEngine.formatTime(finalLap.splitTime);

      const lapLinesHtml = lapsInCycle.map((l, idx) => {
        const isBest = swimmer.laps.length > 1 && l.lapTime === minLapTime;
        const lapLabel = lapsInCycle.length > 1 ? `L${idx + 1}` : 'LAP';
        const bestBadge = isBest ? '<span class="lap-crown-icon" title="最速ラップ">👑</span>' : '';
        const lapTimeFormatted = TimerEngine.formatTime(l.lapTime);
        const splitTimeFormatted = TimerEngine.formatTime(l.splitTime);

        return `
          <div class="lap-item-line ${isBest ? 'is-best-lap' : ''}">
            <span class="lap-item-num">${lapLabel}:</span>
            <strong class="lap-item-time">${lapTimeFormatted}</strong>
            <span class="lap-item-split">(累 ${splitTimeFormatted})</span>
            ${bestBadge}
          </div>
        `;
      }).join('');

      return `
        <tr class="cycle-row">
          <td class="cycle-num-cell">
            <span class="cycle-num-badge">#${cycleNum}</span>
          </td>
          <td class="cycle-laps-cell">
            <div class="cycle-laps-list">
              ${lapLinesHtml}
            </div>
          </td>
          <td class="cycle-final-cell">
            <span class="cycle-final-label">Goal</span>
            <strong class="cycle-final-time">${finalTimeStr}</strong>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="laps-cycle-table">
        <thead>
          <tr>
            <th style="width:36px; text-align:center;">本数</th>
            <th>1本中のLAPタイム (区間 / 累積)</th>
            <th style="width:52px; text-align:right;">Goal</th>
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

      if (action === 'lane-quick-lap') {
        // ★ レーンLAPボタン: 対象泳者のラップを打刻し、自動で次泳者へ切り替え
        const result = this.laneManager.recordLaneNextLap(laneId);
        if (result) {
          this.sound.playLap();
          // 打刻した選手のカード表示を高速更新
          this.updateSwimmerLapCardUi(laneId, result.swimmer.id);
          // レーンLAPボタンの対象表示を次泳者に更新
          this.updateLaneQuickLapBtnUi(laneId);
          // 対象泳者のハイライト枠線を更新
          this.updateActiveSwimmerHighlight(laneId);
          this.showToast(`${result.lane.name}: ${result.swimmer.name} のラップを記録しました`, 1000);
        }
      } else if (action === 'select-active-swimmer') {
        // スイマーカードタップで対象泳者を手動選択
        const swimmer = this.laneManager.setActiveSwimmer(laneId, swimmerId);
        if (swimmer) {
          this.updateLaneQuickLapBtnUi(laneId);
          this.updateActiveSwimmerHighlight(laneId);
        }
      } else if (action === 'swimmer-lap') {
        const lap = this.laneManager.recordSwimmerLap(laneId, swimmerId);
        if (lap) {
          this.sound.playLap();
          this.updateSwimmerLapCardUi(laneId, swimmerId);
        }
      } else if (action === 'swimmer-skip') {
        // ★ スキップ: 指定されたスイマーのLAPを取らずに次の泳者にターゲットを進める
        const res = this.laneManager.skipSwimmer(laneId, swimmerId);
        if (res) {
          this.sound.playCountdownTick();
          this.updateLaneQuickLapBtnUi(laneId);
          this.updateActiveSwimmerHighlight(laneId);
          this.showToast(`${res.skippedSwimmer.name} をスキップ（次 ▶ ${res.nextSwimmer.name}）`, 1000);
        }
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
   * レーンLAPボタンの表示（対象泳者名・次泳者ヒント）を高速更新
   */
  updateLaneQuickLapBtnUi(laneId) {
    const lane = this.laneManager.lanes.find(l => l.id === laneId);
    if (!lane) return;

    const activeSwimmer = this.laneManager.getActiveSwimmer(laneId);
    const nextSwimmer = this.laneManager.getNextSwimmer(laneId);

    const nameElem = document.getElementById(`lap-target-name-${laneId}`);
    const nextElem = document.getElementById(`lap-next-hint-${laneId}`);

    if (nameElem) {
      nameElem.textContent = activeSwimmer ? `#${activeSwimmer.order} ${activeSwimmer.name}` : '選手なし';
    }
    if (nextElem) {
      nextElem.textContent = nextSwimmer 
        ? `次 ▶ #${nextSwimmer.order} ${nextSwimmer.name}`
        : (lane.swimmers.length === 1 ? '1名のみ' : '選手未登録');
    }
  }

  /**
   * レーン内のアクティブ泳者ハイライト枠線を高速切り替え
   */
  updateActiveSwimmerHighlight(laneId) {
    const lane = this.laneManager.lanes.find(l => l.id === laneId);
    if (!lane) return;

    const activeSwimmer = this.laneManager.getActiveSwimmer(laneId);

    lane.swimmers.forEach(s => {
      const card = document.getElementById(`swimmer-card-${s.id}`);
      if (!card) return;
      if (activeSwimmer && s.id === activeSwimmer.id) {
        card.classList.add('is-active-target');
      } else {
        card.classList.remove('is-active-target');
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
    const cycleNum = latestLap ? (latestLap.cycleNumber || 1) : 1;
    const cycleLapNum = latestLap ? (latestLap.cycleLapNumber || 1) : 1;
    const lapLabelStr = latestLap ? `#${cycleNum} [L${cycleLapNum}]` : `Lap 0`;

    // 最新LAP表示を更新
    const lapBox = document.getElementById(`swimmer-lap-box-${swimmer.id}`);
    if (lapBox) {
      const label = lapBox.querySelector('.swimmer-lap-label');
      const val = lapBox.querySelector('.swimmer-lap-val');
      if (label) label.textContent = lapLabelStr;
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
