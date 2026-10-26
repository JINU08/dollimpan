/**
 * 돌려돌려 랜덤 돌림판 (Lucky Random Picker)
 * 순수 Vanilla JavaScript 구현
 */

(function () {
  'use strict';

  // ==========================================
  // 1. 상태(State) 및 상수
  // ==========================================
  const PASTEL_PALETTE = [
    { bg: '#FFB8C6', text: '#6D192B' }, // 딸기우유 핑크 (선명한 파스텔)
    { bg: '#AEE5C0', text: '#194A2A' }, // 피스타치오 민트
    { bg: '#A9D5F4', text: '#143F62' }, // 파스텔 스카이블루
    { bg: '#FFE58A', text: '#664B00' }, // 버터 옐로우
    { bg: '#D8B8E8', text: '#4D1E5E' }, // 라벤더 모브
    { bg: '#FFCFA2', text: '#6B3708' }, // 살구 피치
    { bg: '#A7EFE7', text: '#0D4A45' }, // 아이스 민트
    { bg: '#FFA9A0', text: '#6E1812' }, // 코랄 핑크
    { bg: '#D4EC98', text: '#384F0C' }, // 연두 라임
    { bg: '#DAC2FF', text: '#3E186D' }, // 바이올렛
    { bg: '#FFCFDC', text: '#6D1830' }, // 소프트 블러셔
    { bg: '#BAECBA', text: '#164A1F' }  // 멜론 세이지
  ];

  const SAMPLE_NAMES = ['민수', '서연', '지훈', '하은', '도윤', '유진'];

  let participants = [];
  let currentTitle = '오늘의 당첨자';
  let isSpinning = false;
  let currentAngle = 0; // 현재 룰렛 회전 각도 (라디안)
  let historyList = [];
  let soundEnabled = true;
  let viewMode = 'wheel'; // 'wheel' | 'card'

  // Web Audio Context (지연 초기화)
  let audioCtx = null;

  // ==========================================
  // 2. DOM 요소 참조
  // ==========================================
  const nameInput = document.getElementById('nameInput');
  const addNameForm = document.getElementById('addNameForm');
  const tagsContainer = document.getElementById('tagsContainer');
  const emptyState = document.getElementById('emptyState');
  const participantBadge = document.getElementById('participantBadge');
  const sampleDataBtn = document.getElementById('sampleDataBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');

  const wheelCanvas = document.getElementById('wheelCanvas');
  const wheelWrapper = document.querySelector('.wheel-wrapper');
  const wheelPointer = document.querySelector('.wheel-pointer');
  const centerSpinBtn = document.getElementById('centerSpinBtn');
  const spinBtn = document.getElementById('spinBtn');
  const resetBtn = document.getElementById('resetBtn');
  const currentEventTitle = document.getElementById('currentEventTitle');

  const winnerBanner = document.getElementById('winnerBanner');
  const winnerName = document.getElementById('winnerName');
  const winnerMessage = document.getElementById('winnerMessage');
  const excludeAndSpinBtn = document.getElementById('excludeAndSpinBtn');
  const copyResultBtn = document.getElementById('copyResultBtn');

  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const soundText = document.getElementById('soundText');

  const wheelContainer = document.getElementById('wheelContainer');
  const cardContainer = document.getElementById('cardContainer');
  const slotText = document.getElementById('slotText');
  const modeTabs = document.querySelectorAll('.mode-tab');

  const historyToggle = document.getElementById('historyToggle');
  const historyListWrap = document.getElementById('historyListWrap');
  const historyListEl = document.getElementById('historyList');
  const historyCount = document.getElementById('historyCount');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  const toastContainer = document.getElementById('toastContainer');
  const confettiCanvas = document.getElementById('confettiCanvas');

  // ==========================================
  // 3. Web Audio 효과음 발생기 (외부 파일 없이 작동)
  // ==========================================
  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTickSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  function playFanfareSound() {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;

      // 팡파레 C5, E5, G5, C6 하모니
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const now = audioCtx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.45);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.5);
      });
    } catch (e) {
      // Audio fallback
    }
  }

  // ==========================================
  // 4. 토스트 알림 메시지 함수
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '💡';
    if (type === 'warning') icon = '⚠️';
    if (type === 'success') icon = '🎉';
    
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastFadeOut 0.3s forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2500);
  }

  // ==========================================
  // 5. 로컬스토리지 저장 및 불러오기
  // ==========================================
  function saveStateToStorage() {
    try {
      localStorage.setItem('dollimpan_participants', JSON.stringify(participants));
      localStorage.setItem('dollimpan_history', JSON.stringify(historyList));
      localStorage.setItem('dollimpan_sound', JSON.stringify(soundEnabled));
    } catch (e) {
      // LocalStorage error ignored
    }
  }

  function loadStateFromStorage() {
    try {
      const savedNames = localStorage.getItem('dollimpan_participants');
      if (savedNames) {
        participants = JSON.parse(savedNames);
      }
      const savedHistory = localStorage.getItem('dollimpan_history');
      if (savedHistory) {
        historyList = JSON.parse(savedHistory);
      }
      const savedSound = localStorage.getItem('dollimpan_sound');
      if (savedSound !== null) {
        soundEnabled = JSON.parse(savedSound);
        updateSoundUI();
      }
    } catch (e) {
      // LocalStorage error ignored
    }

    if (participants.length === 0) {
      // 첫 방문 시 예시 명단 자동 세팅으로 친절한 첫인상 제공
      participants = [...SAMPLE_NAMES];
    }
  }

  // ==========================================
  // 6. 참가자 칩 UI 렌더링
  // ==========================================
  function renderParticipants() {
    tagsContainer.innerHTML = '';
    participantBadge.textContent = `${participants.length}명`;

    if (participants.length === 0) {
      tagsContainer.appendChild(emptyState);
      drawWheel();
      return;
    }

    participants.forEach((name, index) => {
      const palette = PASTEL_PALETTE[index % PASTEL_PALETTE.length];
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.style.backgroundColor = palette.bg;
      chip.style.color = palette.text;
      chip.dataset.index = index;

      chip.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <button type="button" class="tag-remove" aria-label="${name} 삭제" title="삭제">&times;</button>
      `;

      chip.querySelector('.tag-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeParticipant(index);
      });

      tagsContainer.appendChild(chip);
    });

    drawWheel();
    saveStateToStorage();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addParticipant(rawText) {
    if (!rawText || !rawText.trim()) return;

    // 쉼표, 줄바꿈, 띄어쓰기 등 복수 입력 지원
    const names = rawText
      .split(/[,/\n]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) return;

    let addedCount = 0;
    names.forEach(name => {
      if (participants.length >= 40) {
        showToast('최대 40명까지만 등록할 수 있습니다.', 'warning');
        return;
      }
      // 중복 방지 (선택 사항)
      if (participants.includes(name)) {
        showToast(`'${name}' 님은 이미 명단에 있습니다!`, 'warning');
        return;
      }
      participants.push(name);
      addedCount++;
    });

    if (addedCount > 0) {
      renderParticipants();
      nameInput.value = '';
    }
  }

  function removeParticipant(index) {
    if (isSpinning) return;
    const removedName = participants[index];
    participants.splice(index, 1);
    renderParticipants();
    showToast(`'${removedName}' 님이 제외되었습니다.`);
  }

  // ==========================================
  // 7. 룰렛 캔버스 그리기 (Retina 고화질 대응)
  // ==========================================
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = rect.width || 420;

    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, size };
  }

  function drawWheel() {
    if (!wheelCanvas) return;
    const { ctx, size } = setupCanvas(wheelCanvas);
    const center = size / 2;
    const radius = center - 12;

    ctx.clearRect(0, 0, size, size);

    const count = participants.length;

    // 참가자가 0명 또는 1명일 때의 안내용 플레이스홀더 휠
    if (count < 2) {
      drawPlaceholderWheel(ctx, center, radius, count === 1 ? participants[0] : null);
      return;
    }

    const sliceAngle = (2 * Math.PI) / count;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentAngle);

    // 슬라이스 그리기
    for (let i = 0; i < count; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const palette = PASTEL_PALETTE[i % PASTEL_PALETTE.length];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // 슬라이스 배경색 채우기
      ctx.fillStyle = palette.bg;
      ctx.fill();

      // 슬라이스 구분선
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // 이름 텍스트 그리기
      ctx.save();
      const midAngle = startAngle + sliceAngle / 2;
      ctx.rotate(midAngle);

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = palette.text;

      // 글자 크기 동적 조절 (인원수가 많을수록 조절)
      let fontSize = 16;
      if (count > 8) fontSize = 14;
      if (count > 16) fontSize = 12;
      if (count > 24) fontSize = 10;

      ctx.font = `bold ${fontSize}px Pretendard, sans-serif`;

      // 텍스트 길이 줄임표 처리
      let displayName = participants[i];
      if (displayName.length > 7) {
        displayName = displayName.substring(0, 6) + '…';
      }

      ctx.fillText(displayName, radius - 24, 0);
      ctx.restore();
    }

    // 외곽 금장/화이트 테두리
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.restore();

    // 휠 바깥쪽 은은한 섀도우 링
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 2, 0, 2 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(128, 96, 68, 0.2)';
    ctx.stroke();
    ctx.restore();
  }

  function drawPlaceholderWheel(ctx, center, radius, singleName) {
    ctx.save();
    ctx.translate(center, center);

    // 플레이스홀더 파스텔 원형
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFCF6';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#E8DCCF';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (singleName) {
      ctx.font = 'bold 16px Pretendard, sans-serif';
      ctx.fillStyle = '#49392F';
      ctx.fillText(`현재: ${singleName}`, 0, -10);
      ctx.font = '500 13px Pretendard, sans-serif';
      ctx.fillStyle = '#7A6A5E';
      ctx.fillText('1명 이상 더 추가해 주세요!', 0, 16);
    } else {
      ctx.font = 'bold 18px Pretendard, sans-serif';
      ctx.fillStyle = '#806044';
      ctx.fillText('🎡 참가자 등록 대기 중', 0, -10);
      ctx.font = '500 13px Pretendard, sans-serif';
      ctx.fillStyle = '#7A6A5E';
      ctx.fillText('2명 이상 입력하면 룰렛이 완성돼요', 0, 16);
    }

    ctx.restore();
  }

  // ==========================================
  // 8. 무작위 선정 로직 (돌림판 스핀 & 슬롯 롤링)
  // ==========================================
  function startRandomPick() {
    if (isSpinning) return;

    if (participants.length === 0) {
      showToast('참가자를 2명 이상 입력해 주세요!', 'warning');
      nameInput.focus();
      return;
    }

    if (participants.length === 1) {
      showToast('혼자서는 뽑을 수 없어요! 1명 더 추가해 주세요 😊', 'warning');
      nameInput.focus();
      return;
    }

    initAudio();
    winnerBanner.classList.add('hidden');
    isSpinning = true;
    updateButtonsState(true);

    if (viewMode === 'wheel') {
      spinRouletteWheel();
    } else {
      rollCardSlot();
    }
  }

  // 8-1. 룰렛 휠 물리 스핀 애니메이션
  function spinRouletteWheel() {
    const count = participants.length;
    const sliceAngle = (2 * Math.PI) / count;

    // 무작위 당첨자 선정 (0 ~ count - 1)
    const winnerIndex = Math.floor(Math.random() * count);
    const winner = participants[winnerIndex];

    // 화살표 바늘은 상단(12시 방향, -90도 = 3*PI/2)
    // 캔버스 좌표계에서 i번째 슬라이스의 중앙 각도는 (i + 0.5) * sliceAngle
    // 회전 후 12시 방향에 오려면: (currentAngle + targetSliceAngle) % 2PI = 3*PI/2 (혹은 -PI/2)
    // 약간의 랜덤 오프셋(-0.35 ~ +0.35 * sliceAngle)으로 슬라이스 내 정중앙이 아니어도 자연스럽게 착지
    const sliceCenterAngle = winnerIndex * sliceAngle + sliceAngle / 2;
    const jitter = (Math.random() - 0.5) * (sliceAngle * 0.7);
    const targetSliceAngle = sliceCenterAngle + jitter;

    // 12시 방향 각도
    const pointerAngle = (3 * Math.PI) / 2;

    // 현재 각도를 0 ~ 2*PI 로 정규화
    const normalizedCurrent = currentAngle % (2 * Math.PI);

    // 최소 회전 수 (5 ~ 8바퀴 도는 스릴감)
    const extraRounds = Math.floor(Math.random() * 3) + 6;

    // 목표 회전 각도 계산
    let delta = pointerAngle - (normalizedCurrent + targetSliceAngle);
    while (delta < 0) {
      delta += 2 * Math.PI;
    }
    const totalRotation = delta + extraRounds * 2 * Math.PI;

    const startRotation = currentAngle;
    const finalRotation = startRotation + totalRotation;
    const duration = 4000; // 4초간 긴장감 넘치는 스핀
    const startTime = performance.now();

    let lastTickSlice = -1;

    // ease-out-cubic 감속 곡선
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      currentAngle = startRotation + totalRotation * easedProgress;
      drawWheel();

      // 슬라이스 경계를 지나칠 때 틱(Tick) 사운드 및 바늘 튕김
      const currentSlice = Math.floor(((currentAngle % (2 * Math.PI)) / sliceAngle));
      if (currentSlice !== lastTickSlice) {
        lastTickSlice = currentSlice;
        playTickSound();
        triggerPointerTick();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 정지 완료
        currentAngle = finalRotation;
        drawWheel();
        onPickComplete(winner);
      }
    }

    requestAnimationFrame(animate);
  }

  function triggerPointerTick() {
    wheelPointer.classList.remove('tick');
    // reflow
    void wheelPointer.offsetWidth;
    wheelPointer.classList.add('tick');
  }

  // 8-2. 스피드 카드 롤링 모드
  function rollCardSlot() {
    let speed = 50;
    let iterations = 0;
    const maxIterations = 35;
    const count = participants.length;

    slotText.classList.add('rolling');

    function step() {
      iterations++;
      const tempIndex = Math.floor(Math.random() * count);
      slotText.textContent = participants[tempIndex];
      playTickSound();

      if (iterations < maxIterations) {
        speed += 6; // 점점 감속
        setTimeout(step, speed);
      } else {
        slotText.classList.remove('rolling');
        const finalWinner = participants[Math.floor(Math.random() * count)];
        slotText.textContent = finalWinner;
        onPickComplete(finalWinner);
      }
    }

    step();
  }

  // 8-3. 당첨 확정 시 축하 연출
  function onPickComplete(winner) {
    isSpinning = false;
    updateButtonsState(false);

    // 팡파레 효과음
    playFanfareSound();

    // 콘페티 축포 펑!
    triggerConfetti();

    // 당첨자 배너 표시
    winnerName.textContent = winner;
    winnerMessage.textContent = '오늘의 행운의 당첨자입니다! 🎉';
    winnerBanner.classList.remove('hidden');

    // 기록 추가
    addHistoryRecord(winner);

    // 모바일 등에서 배너가 화면에 잘 보이도록 부드럽게 스크롤
    winnerBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateButtonsState(spinning) {
    spinBtn.disabled = spinning;
    centerSpinBtn.disabled = spinning;
    resetBtn.disabled = spinning;
    sampleDataBtn.disabled = spinning;
    clearAllBtn.disabled = spinning;

    if (spinning) {
      spinBtn.style.opacity = '0.7';
      centerSpinBtn.style.transform = 'scale(0.9)';
      document.getElementById('spinBtnText').textContent = '추첨 중...';
    } else {
      spinBtn.style.opacity = '1';
      centerSpinBtn.style.transform = '';
      document.getElementById('spinBtnText').textContent = '랜덤 선정 시작!';
    }
  }

  // ==========================================
  // 9. 콘페티(축포) 캔버스 애니메이션
  // ==========================================
  let confettiParticles = [];
  let confettiAnimationId = null;

  function triggerConfetti() {
    confettiParticles = [];
    const colors = ['#B8875B', '#E5A876', '#EFA0A0', '#9EC6A2', '#C6A8DF', '#F3D27E'];
    const count = 55; // 과도하지 않고 자연스러운 축하 연출

    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    for (let i = 0; i < count; i++) {
      confettiParticles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 140,
        y: window.innerHeight * 0.42,
        w: Math.random() * 8 + 5,
        h: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() * -11) - 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.38,
        opacity: 1
      });
    }

    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId);
    }

    const ctx = confettiCanvas.getContext('2d');
    let frames = 0;

    function renderConfetti() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let aliveCount = 0;

      for (let p of confettiParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.009;

        if (p.opacity > 0 && p.y < window.innerHeight + 20) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(p.opacity, 0);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }

      frames++;
      if (aliveCount > 0 && frames < 180) {
        confettiAnimationId = requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    renderConfetti();
  }

  // ==========================================
  // 10. 기록(History) 관리
  // ==========================================
  function addHistoryRecord(winner) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    historyList.unshift({
      winner,
      event: currentTitle,
      time: timeStr
    });

    if (historyList.length > 20) {
      historyList.pop();
    }

    renderHistory();
    saveStateToStorage();
  }

  function renderHistory() {
    historyCount.textContent = historyList.length;

    if (historyList.length === 0) {
      historyListEl.innerHTML = '<li class="history-empty">아직 추첨 기록이 없습니다.</li>';
      return;
    }

    historyListEl.innerHTML = historyList
      .map(item => `
        <li class="history-item">
          <div>
            <span class="history-item-name">🎉 ${escapeHtml(item.winner)}</span>
          </div>
          <span class="history-item-time">${item.time}</span>
        </li>
      `)
      .join('');
  }

  // ==========================================
  // 11. 소리 UI 토글
  // ==========================================
  function updateSoundUI() {
    if (soundEnabled) {
      soundIcon.textContent = '🔊';
      soundText.textContent = '소리 ON';
      soundToggleBtn.classList.remove('muted');
    } else {
      soundIcon.textContent = '🔇';
      soundText.textContent = '소리 OFF';
      soundToggleBtn.classList.add('muted');
    }
  }

  // ==========================================
  // 12. 이벤트 리스너 등록
  // ==========================================
  function initEventListeners() {
    // 참가자 이름 추가
    addNameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addParticipant(nameInput.value);
    });

    // 엔터키 지원
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addParticipant(nameInput.value);
      }
    });

    // 예시 명단 채우기
    sampleDataBtn.addEventListener('click', () => {
      if (isSpinning) return;
      SAMPLE_NAMES.forEach(name => {
        if (!participants.includes(name)) {
          participants.push(name);
        }
      });
      renderParticipants();
      showToast('예시 명단이 등록되었습니다! ✨', 'success');
    });

    // 전체 비우기
    clearAllBtn.addEventListener('click', () => {
      if (isSpinning) return;
      if (participants.length === 0) return;
      if (confirm('모든 참가자 명단을 비우시겠습니까?')) {
        participants = [];
        renderParticipants();
        winnerBanner.classList.add('hidden');
        showToast('참가자 명단을 모두 비웠습니다.');
      }
    });

    // 돌리기 버튼들
    spinBtn.addEventListener('click', startRandomPick);
    centerSpinBtn.addEventListener('click', startRandomPick);
    resetBtn.addEventListener('click', () => {
      if (isSpinning) return;
      winnerBanner.classList.add('hidden');
      startRandomPick();
    });

    // 당첨자 제외하고 다시 뽑기
    excludeAndSpinBtn.addEventListener('click', () => {
      if (isSpinning) return;
      const currentWinner = winnerName.textContent;
      const idx = participants.indexOf(currentWinner);
      if (idx !== -1) {
        participants.splice(idx, 1);
        renderParticipants();
        showToast(`'${currentWinner}' 님을 제외하고 다시 추첨합니다!`);
        winnerBanner.classList.add('hidden');
        setTimeout(() => {
          startRandomPick();
        }, 300);
      }
    });

    // 결과 복사
    copyResultBtn.addEventListener('click', () => {
      const textToCopy = `[랜덤 추첨 결과 🎉] 당첨자: ${winnerName.textContent} 님!`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('결과가 클립보드에 복사되었습니다! 📋', 'success');
        }).catch(() => {
          prompt('결과를 복사하세요:', textToCopy);
        });
      } else {
        prompt('결과를 복사하세요:', textToCopy);
      }
    });

    // 사운드 토글
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      updateSoundUI();
      saveStateToStorage();
      if (soundEnabled) {
        initAudio();
        playTickSound();
      }
    });

    // 뷰 모드 탭 (룰렛 vs 카드 롤링)
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (isSpinning) return;
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        viewMode = tab.dataset.mode;

        if (viewMode === 'wheel') {
          wheelContainer.classList.remove('hidden');
          cardContainer.classList.add('hidden');
          drawWheel();
        } else {
          wheelContainer.classList.add('hidden');
          cardContainer.classList.remove('hidden');
          slotText.textContent = '준비 완료!';
        }
      });
    });

    // 기록 아코디언 토글
    historyToggle.addEventListener('click', () => {
      const parent = historyToggle.parentElement;
      const isOpen = !historyListWrap.classList.contains('hidden');
      if (isOpen) {
        historyListWrap.classList.add('hidden');
        parent.classList.remove('open');
      } else {
        historyListWrap.classList.remove('hidden');
        parent.classList.add('open');
      }
    });

    // 기록 삭제
    clearHistoryBtn.addEventListener('click', () => {
      historyList = [];
      renderHistory();
      saveStateToStorage();
      showToast('추첨 기록이 모두 삭제되었습니다.');
    });

    // 윈도우 리사이즈 시 룰렛 재렌더링
    window.addEventListener('resize', () => {
      if (viewMode === 'wheel') {
        drawWheel();
      }
    });
  }

  // ==========================================
  // 13. 초기 실행
  // ==========================================
  function init() {
    loadStateFromStorage();
    renderParticipants();
    renderHistory();
    initEventListeners();
    drawWheel();
  }

  // DOM 로드 완료 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
