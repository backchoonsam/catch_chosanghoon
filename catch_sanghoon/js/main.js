window.SanghoonApp = window.SanghoonApp || {};

(function () {
    const { CONFIG, CHARACTERS, AudioPlayer, Cutscenes } = window.SanghoonApp;

    const state = {
        ownedIds: new Set(),
        isSkipped: false,
        isGachaRunning: false,
        isEndingTriggered: false,
        isEndingPaused: false,
        isEndingCompleted: false,
        isExodiaEventActive: false,
        glitchTriggered: false,
        glitchPending: false,
        urRevealPending: false,
        exodiaRevealPending: false,
        lastGachaCount: 0
    };

    const characterMap = new Map(CHARACTERS.map(c => [c.id, c]));

    function getImgPath(imgFile) {
        return CONFIG.paths.images + imgFile;
    }

    function getGradeColor(grade) {
        return CONFIG.gradeColors[grade] || '#fff';
    }

    function getRequiredCollectionCards() {
        return CHARACTERS.filter(c => c.grade !== 'UR');
    }

    function getSortedList() {
        const order = CONFIG.collectionSortOrder;
        return [...CHARACTERS].sort((a, b) => {
            const rankA = order[a.grade] || 99;
            const rankB = order[b.grade] || 99;
            return rankA !== rankB ? rankA - rankB : a.id - b.id;
        });
    }

    function autoResizeText(element, baseRem) {
        if (!element) return;
        const textLength = element.innerText.length;
        let scale = 1.0;
        if (textLength > 12) scale = 0.65;
        else if (textLength > 9) scale = 0.7;
        else if (textLength > 7) scale = 0.8;
        element.style.fontSize = (baseRem * scale) + 'rem';
    }

    function setButtonsDisabled(disabled) {
        document.getElementById('btn1').disabled = disabled;
        document.getElementById('btn5').disabled = disabled;
        document.getElementById('btn10').disabled = disabled;
    }

    function decodeCardImage(card) {
        if (!card || !card.img) return;
        const img = new Image();
        img.src = getImgPath(card.img);
        if (typeof img.decode === 'function') {
            img.decode().catch(() => {});
        }
    }

    function preloadCutsceneAssets() {
        const priorityIds = new Set([
            CONFIG.events.urEndingCardId,
            CONFIG.events.exodia.rewardCardId,
            ...CONFIG.events.exodia.orderedPartIds
        ]);

        const priorityCards = CHARACTERS.filter(c => priorityIds.has(c.id));
        const otherCards = CHARACTERS.filter(c => !priorityIds.has(c.id));

        priorityCards.forEach(decodeCardImage);

        const loadRest = () => otherCards.forEach(decodeCardImage);
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(loadRest, { timeout: 2000 });
        } else {
            setTimeout(loadRest, 1000);
        }
    }

    function initCollection() {
        const totalSpan = document.getElementById('total-count');
        if (totalSpan) {
            totalSpan.innerText = getRequiredCollectionCards().length;
        }

        const grid = document.getElementById('collection-grid');
        grid.innerHTML = '';

        const sortedList = getSortedList();
        sortedList.forEach((c, idx) => {
            const item = document.createElement('div');
            item.id = `col-${c.id}`;
            item.className = 'col-item';
            item.style.borderColor = getGradeColor(c.grade);
            item.title = `도감 번호: ${idx + 1} (ID: ${c.id})`;

            const placeholderText = c.grade === 'UR' ? '???' : '?';
            item.innerHTML = `<div class="placeholder" style="color:${getGradeColor(c.grade)}">${placeholderText}</div>`;
            grid.appendChild(item);
        });
    }

    function showZoomCard(c) {
        const overlay = document.getElementById('zoom-overlay');
        const container = document.getElementById('zoomed-card-container');
        const gradeLower = c.grade.toLowerCase();

        container.innerHTML = `
            <div class="card-front front-${gradeLower}" style="width:100%; height:100%;">
                <img src="${getImgPath(c.img)}">
                <div class="info-tag">
                    <div class="char-name name-${gradeLower}" style="font-size: 1.5rem;">${c.name}</div>
                    <div class="char-grade grade-${gradeLower}" style="background:${getGradeColor(c.grade)}; font-size: 1rem; padding: 5px 15px;">${c.grade}</div>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';
    }

    function closeZoomCard() {
        document.getElementById('zoom-overlay').style.display = 'none';
    }

    function skipEffect() {
        state.isSkipped = true;
        document.getElementById('skip-btn').style.display = 'none';
        document.getElementById('portal-overlay').style.display = 'none';
    }

    function unlock(c) {
        if (!c || state.ownedIds.has(c.id)) return false;
        state.ownedIds.add(c.id);
        decodeCardImage(c);

        const countSpan = document.getElementById('count-val');
        if (countSpan) countSpan.innerText = state.ownedIds.size;

        // 1. 상훈디아 해금 조건 체크
        const { rewardCardId, orderedPartIds } = CONFIG.events.exodia;
        if (!state.ownedIds.has(rewardCardId) && orderedPartIds.every(p => state.ownedIds.has(p))) {
            state.exodiaRevealPending = true;
        }

        // 2. 최종 UR 엔딩 조건 체크
        const requiredCards = getRequiredCollectionCards();
        const urId = CONFIG.events.urEndingCardId;
        if (requiredCards.length > 0 &&
            state.ownedIds.size >= requiredCards.length &&
            !state.ownedIds.has(urId) &&
            !state.isEndingCompleted &&
            requiredCards.every(rc => state.ownedIds.has(rc.id))) {
            state.urRevealPending = true;
        }

        // 3. 이상현상 조건 체크
        if (state.ownedIds.size >= CONFIG.events.glitchThreshold && !state.glitchTriggered) {
            state.glitchTriggered = true;
            if (state.lastGachaCount >= 5 || state.isEndingPaused || state.exodiaRevealPending || state.urRevealPending) {
                state.glitchPending = true;
            } else {
                setTimeout(() => {
                    Cutscenes.triggerGlitch(state.isEndingTriggered, state.isEndingCompleted);
                }, CONFIG.timings.glitchDelay);
            }
        }

        // 4. 도감 UI 업데이트
        const el = document.getElementById(`col-${c.id}`);
        if (el) {
            el.classList.add('unlocked');
            el.onclick = function () { showZoomCard(c); };
            const gradeLower = c.grade.toLowerCase();
            el.innerHTML = `
                <div class="card-front front-${gradeLower}" style="width:100%; height:100%;">
                    <img src="${getImgPath(c.img)}">
                    <div class="info-tag">
                        <div class="char-name name-${gradeLower}">${c.name}</div>
                        <div class="char-grade grade-${gradeLower}" style="background:${getGradeColor(c.grade)}">${c.grade}</div>
                    </div>
                </div>
            `;
            autoResizeText(el.querySelector('.char-name'), 1.0);
        }

        return true;
    }

    function checkEnding() {
        if (state.isEndingTriggered || state.isEndingPaused || state.isEndingCompleted) return;
        const requiredCards = getRequiredCollectionCards();
        if (requiredCards.length === 0) return;

        const allCollected = requiredCards.every(c => state.ownedIds.has(c.id));
        if (allCollected && !state.ownedIds.has(CONFIG.events.urEndingCardId)) {
            triggerEnding();
        }
    }

    function triggerEnding() {
        if (state.isEndingCompleted || state.isEndingTriggered) return;
        state.isEndingTriggered = true;

        const urCard = characterMap.get(CONFIG.events.urEndingCardId);
        const sourceCards = getRequiredCollectionCards();

        Cutscenes.playMergeCutscene({
            mode: 'normal',
            headerHtml: '모든 조각이 모여...<br>진정한 형태를 이룹니다.',
            sourceCards,
            targetCard: urCard,
            badgeText: 'THE END',
            partIntervalMs: 60,
            introSound: CONFIG.audio.urIntro,
            onReveal: (card) => {
                unlock(card);
                setTimeout(() => {
                    AudioPlayer.playFile(CONFIG.audio.urFlip.file, CONFIG.audio.urFlip.volume);
                }, 200);
            }
        });
    }

    function triggerExodiaEvent() {
        if (state.isEndingTriggered) return;
        state.isEndingTriggered = true;
        state.isExodiaEventActive = true;

        const { rewardCardId, orderedPartIds } = CONFIG.events.exodia;
        const targetCard = characterMap.get(rewardCardId);
        const partsCollected = orderedPartIds.map(id => characterMap.get(id)).filter(Boolean);

        Cutscenes.playMergeCutscene({
            mode: 'exodia',
            headerHtml: "<span style='color: #ffd700; text-shadow: 0 0 15px #ffd700;'>봉인된 파츠가 모두 모여...<br>금지된 힘이 깨어납니다.</span>",
            sourceCards: partsCollected,
            targetCard,
            badgeText: '봉인 해제',
            partIntervalMs: 400,
            introSound: null,
            onPartSpawn: () => {
                AudioPlayer.playFile(CONFIG.audio.exodiaPart.file, CONFIG.audio.exodiaPart.volume);
            },
            onReveal: (card) => {
                unlock(card);
                AudioPlayer.playCardSound(card);
            }
        });
    }

    function closeEnding() {
        const revealContainer = document.getElementById('ur-reveal-container');
        if (!state.isEndingTriggered || revealContainer.dataset.canClose !== 'true') return;

        Cutscenes.resetEndingOverlayState();
        state.isEndingTriggered = false;

        if (state.isExodiaEventActive) {
            state.isExodiaEventActive = false;
            checkEnding();
            if (state.isEndingTriggered) return;

            if (state.glitchPending && !state.isEndingCompleted) {
                state.glitchPending = false;
                setTimeout(
                    () => Cutscenes.triggerGlitch(state.isEndingTriggered, state.isEndingCompleted),
                    CONFIG.timings.glitchAfterExodiaDelay
                );
            }
            return;
        }

        state.isEndingCompleted = true;
        state.glitchPending = false;
        state.urRevealPending = false;
        state.exodiaRevealPending = false;

        alert('축하합니다! 모든 컬렉션을 완성했습니다!');
        Cutscenes.applyAnomalyVisuals();
    }

    function processPendingEvents(delayMs) {
        const run = (fn) => (delayMs > 0 ? setTimeout(fn, delayMs) : fn());

        if (state.exodiaRevealPending) {
            state.exodiaRevealPending = false;
            run(() => triggerExodiaEvent());
            return true;
        }
        if (state.urRevealPending && !state.isEndingCompleted) {
            state.urRevealPending = false;
            run(() => triggerEnding());
            return true;
        }
        if (state.glitchPending && !state.isEndingCompleted) {
            state.glitchPending = false;
            run(() => Cutscenes.triggerGlitch(state.isEndingTriggered, state.isEndingCompleted));
            return true;
        }
        return false;
    }

    async function startGacha(count) {
        if (state.isGachaRunning || state.isEndingTriggered) return;
        state.isGachaRunning = true;
        state.lastGachaCount = count;
        state.isSkipped = false;

        const area = document.getElementById('display-area');
        const portal = document.getElementById('portal-overlay');
        const dim = document.getElementById('global-dim');
        const flash = document.getElementById('flash-overlay');
        const box = document.getElementById('game-box');
        const skipBtn = document.getElementById('skip-btn');
        const closeBtn = document.getElementById('close-btn');

        closeBtn.style.display = 'none';
        setButtonsDisabled(true);
        area.innerHTML = '';
        area.className = (count === 1) ? 'single-mode' : '';
        box.classList.remove('mode-5');

        if (count >= 5) {
            box.classList.add('active-result');
            dim.style.background = 'rgba(0,0,0,1)';
            dim.style.display = 'block';
            skipBtn.style.display = 'block';
            if (count === 5) box.classList.add('mode-5');
        } else {
            box.classList.remove('active-result');
            dim.style.display = 'none';
        }

        const gachaPool = CHARACTERS.filter(c => !c.excludeFromGacha);
        const rates = (count === 10) ? CONFIG.gachaRates.chanceUp10 : CONFIG.gachaRates.normal;
        const results = [];

        for (let i = 0; i < count; i++) {
            const rand = Math.random() * 100;
            const grade = rand < rates.SSR ? 'SSR' : rand < rates.SR ? 'SR' : rand < rates.R ? 'R' : 'C';
            const possible = gachaPool.filter(c => c.grade === grade);
            results.push(possible[Math.floor(Math.random() * possible.length)]);
        }

        if (count === 10) {
            Cutscenes.updatePortalColor('white');
            portal.style.display = 'flex';
            const hasSSR = results.some(r => r.grade === 'SSR');
            const hasSR = results.some(r => r.grade === 'SR');
            const { portalTicks, portalTickMs } = CONFIG.timings;
            const waitTicks = hasSSR ? portalTicks.ssr : (hasSR ? portalTicks.sr : portalTicks.normal);

            for (let t = 0; t < waitTicks; t++) {
                if (state.isSkipped) break;
                if (hasSSR) {
                    if (t === portalTicks.goldAt) Cutscenes.updatePortalColor('gold');
                    if (t === portalTicks.purpleAt) Cutscenes.updatePortalColor('purple');
                } else if (hasSR) {
                    if (t === portalTicks.goldAt) Cutscenes.updatePortalColor('gold');
                }
                await new Promise(r => setTimeout(r, portalTickMs));
            }
            portal.style.display = 'none';
        }

        const tempSessionOwned = new Set(state.ownedIds);
        results.forEach((res, i) => {
            const isHigh = (res.grade === 'SSR' || res.grade === 'SR');
            const fastClass = (count >= 5 && !isHigh) ? 'fast-flip' : '';
            const gradeLower = res.grade.toLowerCase();
            const isNew = !tempSessionOwned.has(res.id);
            if (isNew) tempSessionOwned.add(res.id);

            const card = document.createElement('div');
            card.className = 'result-card';
            card.id = `card-${i}`;
            card.onclick = function () {
                if (this.classList.contains('revealed')) showZoomCard(res);
            };
            card.innerHTML = `
                <div class="card-inner ${fastClass}">
                    <div class="card-back" style="border-color:${getGradeColor(res.grade)}">
                        <div class="grade-symbol" style="color:${getGradeColor(res.grade)}">${res.grade}</div>
                        <div class="grade-text" style="color:${getGradeColor(res.grade)}">${res.grade}</div>
                    </div>
                    <div class="card-front front-${gradeLower}">
                        ${isNew ? '<div class="new-badge">NEW!</div>' : ''}
                        <img src="${getImgPath(res.img)}">
                        <div class="info-tag">
                            <div class="char-name name-${gradeLower}">${res.name}</div>
                            <div class="char-grade grade-${gradeLower}" style="background:${getGradeColor(res.grade)}">${res.grade}</div>
                        </div>
                    </div>
                </div>
            `;
            area.appendChild(card);
            autoResizeText(card.querySelector('.char-name'), 1.15);
        });

        for (let i = 0; i < results.length; i++) {
            const res = results[i];
            const cardNode = document.getElementById(`card-${i}`);
            const isHigh = (res.grade === 'SSR' || res.grade === 'SR');
            const isFastMode = (count >= 5 && !isHigh);

            if (!state.isSkipped) {
                cardNode.classList.add('highlight');
                let delayTime = isFastMode ? CONFIG.timings.multiDelay.fast : CONFIG.timings.multiDelay.normal;
                if (count === 1) {
                    delayTime = CONFIG.timings.singleDelay[res.grade] ?? CONFIG.timings.singleDelay.default;
                }
                await new Promise(r => setTimeout(r, delayTime));
            }

            cardNode.classList.add('revealed');
            if (!state.isSkipped) {
                AudioPlayer.playCardSound(res);
                await new Promise(r => setTimeout(r, isFastMode ? CONFIG.timings.revealPostDelay.fast : CONFIG.timings.revealPostDelay.normal));

                if (isHigh) {
                    flash.style.backgroundColor = getGradeColor(res.grade);
                    flash.style.animation = 'none';
                    void flash.offsetWidth;
                    flash.style.animation = 'flashAnim 0.4s forwards';
                    document.body.style.backgroundColor = getGradeColor(res.grade) + '22';
                    document.body.classList.add('shake-active');
                    setTimeout(() => document.body.classList.remove('shake-active'), 300);
                }
            }

            unlock(res);

            if (!state.isSkipped) {
                const viewTime = isHigh ? CONFIG.timings.viewTime.high : (isFastMode ? CONFIG.timings.viewTime.fast : CONFIG.timings.viewTime.normal);
                await new Promise(r => setTimeout(r, viewTime));
                document.body.style.backgroundColor = '#050505';
                cardNode.classList.remove('highlight');
            } else {
                cardNode.classList.remove('highlight');
                document.body.style.backgroundColor = '#050505';
            }
        }

        skipBtn.style.display = 'none';
        state.isGachaRunning = false;

        if (count >= 5) {
            closeBtn.style.display = 'block';
        } else {
            setButtonsDisabled(false);
            processPendingEvents(CONFIG.timings.endingTriggerDelay);
        }
    }

    function closeResult() {
        const box = document.getElementById('game-box');
        const dim = document.getElementById('global-dim');
        const area = document.getElementById('display-area');
        const closeBtn = document.getElementById('close-btn');

        box.classList.remove('active-result', 'mode-5');
        dim.style.display = 'none';
        closeBtn.style.display = 'none';
        area.innerHTML = '<p style="color: #555;">소환 대기 중...</p>';
        area.className = 'single-mode';
        setButtonsDisabled(false);

        state.isSkipped = false;
        state.lastGachaCount = 0;

        processPendingEvents(0);
    }

    function handleAdminKey(e) {
        if (e.key !== CONFIG.adminKey) return;
        if (state.isGachaRunning || state.isEndingTriggered) return;

        const input = prompt("⚡ 관리자 모드 ⚡\n\n- 숫자 입력: 도감 순서(칸) 번호로 해제\n- 'ALL' 입력: UR을 제외한 모든 카드 해제\n- 등급 입력(C, R, SR, SSR): 해당 등급 모두 해제");
        if (!input) return;

        const upperInput = input.trim().toUpperCase();
        const targetNum = parseInt(upperInput, 10);
        const urId = CONFIG.events.urEndingCardId;

        let didUnlock = false;
        state.isEndingPaused = true;

        if (upperInput === 'ALL') {
            let count = 0;
            CHARACTERS.forEach(c => {
                if (c.grade !== 'UR') {
                    if (unlock(c)) didUnlock = true;
                    count++;
                }
            });
            alert(`[관리자] UR을 제외한 모든 카드(${count}장)가 해제되었습니다.`);
        } else if (['C', 'R', 'SR', 'SSR'].includes(upperInput)) {
            let count = 0;
            CHARACTERS.forEach(c => {
                if (c.grade === upperInput && c.id !== urId) {
                    if (unlock(c)) didUnlock = true;
                    count++;
                }
            });
            alert(`[관리자] ${upperInput} 등급 카드 ${count}장이 해제되었습니다.`);
        } else if (!isNaN(targetNum)) {
            const sortedList = getSortedList();
            const index = targetNum - 1;
            if (index >= 0 && index < sortedList.length) {
                const target = sortedList[index];
                if (target.grade === 'UR') {
                    alert('UR 카드는 강제로 해제할 수 없습니다. 다른 카드를 모두 모으세요.');
                } else {
                    if (unlock(target)) didUnlock = true;
                    alert(`[관리자] 도감 ${targetNum}번: ${target.name} 해제 완료.`);
                }
            } else {
                alert(`유효하지 않은 도감 번호입니다. (1 ~ ${sortedList.length})`);
            }
        } else {
            alert('올바르지 않은 명령입니다.');
        }

        state.isEndingPaused = false;

        if (!didUnlock) return;

        if (!processPendingEvents(0)) {
            checkEnding();
        }
    }

    function bindEvents() {
        document.getElementById('btn1').addEventListener('click', () => startGacha(1));
        document.getElementById('btn5').addEventListener('click', () => startGacha(5));
        document.getElementById('btn10').addEventListener('click', () => startGacha(10));
        document.getElementById('skip-btn').addEventListener('click', skipEffect);
        document.getElementById('close-btn').addEventListener('click', closeResult);
        document.getElementById('ending-overlay').addEventListener('click', closeEnding);
        document.getElementById('zoom-overlay').addEventListener('click', closeZoomCard);
        document.getElementById('zoomed-card-container').addEventListener('click', e => e.stopPropagation());
        window.addEventListener('keydown', handleAdminKey);
    }

    window.addEventListener('DOMContentLoaded', () => {
        initCollection();
        bindEvents();
        preloadCutsceneAssets();
        AudioPlayer.preloadAll();
    });
})();