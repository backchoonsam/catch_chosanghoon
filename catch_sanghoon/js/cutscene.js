window.SanghoonApp = window.SanghoonApp || {};

window.SanghoonApp.Cutscenes = (function () {
    const { CONFIG, AudioPlayer } = window.SanghoonApp;
    let activeTimers = [];

    function scheduleTimer(fn, delay) {
        const id = setTimeout(fn, delay);
        activeTimers.push(id);
        return id;
    }

    function clearCutsceneTimers() {
        activeTimers.forEach(id => clearTimeout(id));
        activeTimers = [];
    }

    function getImgPath(imgFile) {
        return CONFIG.paths.images + imgFile;
    }

    function getGradeColor(grade) {
        return CONFIG.gradeColors[grade] || '#fff';
    }

    function updatePortalColor(type) {
        const rings = document.querySelectorAll('.portal-ring');
        const core = document.querySelector('.portal-core');
        const text = document.getElementById('portal-text');

        let color = 'white';
        let shadowColor = 'white';
        if (type === 'gold') {
            color = '#ffcc00';
            shadowColor = '#ffcc00';
        } else if (type === 'purple') {
            color = '#ff00ff';
            shadowColor = '#ff00ff';
        }

        rings.forEach(r => { r.style.borderTopColor = color; });
        core.style.boxShadow = `0 0 60px 20px ${shadowColor}`;
        text.style.textShadow = `0 0 20px ${shadowColor}`;
    }

    function triggerGlitch(isEndingTriggered, isEndingCompleted) {
        if (isEndingTriggered || isEndingCompleted) return;

        const warningDiv = document.createElement('div');
        warningDiv.innerHTML = '⚠ WARNING ⚠<br>도감 내 이상현상 발생!';

        Object.assign(warningDiv.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            color: '#ff3e3e',
            padding: '30px 60px',
            border: '3px solid #ff3e3e',
            borderRadius: '15px',
            fontSize: '1.8rem',
            fontWeight: 'bold',
            zIndex: '20000',
            boxShadow: '0 0 50px rgba(255, 62, 62, 0.8)',
            textAlign: 'center',
            pointerEvents: 'none',
            animation: 'blinkTwiceEffect 3.5s ease-in-out forwards'
        });

        document.body.appendChild(warningDiv);
        AudioPlayer.playBeep();
        setTimeout(() => AudioPlayer.playBeep(), 1800);
        setTimeout(() => warningDiv.remove(), 3500);

        applyAnomalyVisuals();
    }

    function applyAnomalyVisuals() {
        const countSpan = document.getElementById('count-val');
        if (countSpan) {
            countSpan.style.color = '#ff3e3e';
            countSpan.style.textShadow = '0 0 10px red';
        }

        const urCard = document.getElementById(`col-${CONFIG.events.urEndingCardId}`);
        const grid = document.getElementById('collection-grid');
        if (urCard && grid) {
            grid.prepend(urCard);
            urCard.style.transition = 'box-shadow 0.5s';
            urCard.style.boxShadow = '0 0 30px var(--ur-color)';
            setTimeout(() => { urCard.style.boxShadow = ''; }, 2000);
        }
    }

    function resetEndingOverlayState() {
        clearCutsceneTimers();

        const overlay = document.getElementById('ending-overlay');
        const godRays = document.getElementById('god-rays');
        const silhouette = document.getElementById('silhouette-card');
        const revealContainer = document.getElementById('ur-reveal-container');
        const endingHint = document.getElementById('ending-hint');

        overlay.style.display = 'none';
        godRays.style.display = 'none';
        godRays.style.opacity = '0';

        silhouette.style.display = 'none';
        silhouette.style.opacity = '1';
        silhouette.style.transition = '';
        silhouette.style.animation = '';
        silhouette.classList.remove('exodia-mode');

        revealContainer.style.display = 'none';
        revealContainer.style.pointerEvents = 'none';
        revealContainer.dataset.canClose = 'false';
        revealContainer.classList.remove('exodia-mode', 'revealed', 'landing-active');

        endingHint.style.display = 'none';
        document.querySelectorAll('.gathering-card').forEach(el => el.remove());
    }

    /**
     * UR 엔딩과 상훈디아 합체 이벤트를 공통 처리하는 합체 컷신 엔진
     */
    function playMergeCutscene(options) {
        const {
            mode,              // 'normal' | 'exodia'
            headerHtml,
            sourceCards,
            targetCard,
            badgeText,
            partIntervalMs,
            introSound,
            onPartSpawn,
            onReveal
        } = options;

        clearCutsceneTimers();
        document.querySelectorAll('.gathering-card').forEach(el => el.remove());

        document.getElementById('global-dim').style.display = 'none';
        document.getElementById('game-box').classList.remove('active-result');

        const overlay = document.getElementById('ending-overlay');
        const shakeContainer = document.getElementById('shake-container');
        const revealContainer = document.getElementById('ur-reveal-container');
        const silhouette = document.getElementById('silhouette-card');
        const flash = document.getElementById('flash-overlay');
        const endingHint = document.getElementById('ending-hint');
        const godRays = document.getElementById('god-rays');
        const endingText = document.getElementById('ending-text');

        // 이전 상태 초기화
        revealContainer.dataset.canClose = 'false';
        revealContainer.classList.remove('exodia-mode', 'revealed', 'landing-active');
        silhouette.classList.remove('exodia-mode');
        silhouette.style.opacity = '1';
        silhouette.style.transition = '';
        silhouette.style.animation = '';
        godRays.style.display = 'none';
        godRays.style.opacity = '0';
        endingHint.style.display = 'none';

        if (mode === 'exodia') {
            revealContainer.classList.add('exodia-mode');
            silhouette.classList.add('exodia-mode');
        }

        if (introSound) {
            AudioPlayer.playFile(introSound.file, introSound.volume);
        }

        endingText.innerHTML = headerHtml;
        overlay.style.display = 'block';
        silhouette.style.display = 'block';
        revealContainer.style.display = 'none';

        const w = window.innerWidth;
        const h = window.innerHeight;
        const cx = w / 2;
        const cy = h / 2;
        const activeParts = [];

        // 1단계: 재료 카드 모이는 연출
        sourceCards.forEach((c, idx) => {
            scheduleTimer(() => {
                if (onPartSpawn) onPartSpawn(c);

                const img = document.createElement('div');
                img.className = `gathering-card ${mode === 'exodia' ? 'exodia-mode' : 'normal-mode'}`;
                img.style.backgroundImage = `url('${getImgPath(c.img)}')`;

                if (mode === 'exodia') {
                    const layout = CONFIG.events.exodia.partLayouts[c.id];
                    const [startX, startY] = layout ? layout.startOffset(w, h, cx, cy) : [cx, cy];
                    const [targetX, targetY] = layout ? layout.targetOffset(cx, cy) : [cx, cy];

                    img.style.left = startX + 'px';
                    img.style.top = startY + 'px';
                    img.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(0.8)';

                    document.body.appendChild(img);
                    activeParts.push(img);

                    img.animate([
                        {
                            left: startX + 'px',
                            top: startY + 'px',
                            transform: 'translate(-50%, -50%) rotate(0deg) scale(0.8)',
                            opacity: 1
                        },
                        {
                            left: targetX + 'px',
                            top: targetY + 'px',
                            transform: 'translate(-50%, -50%) rotate(0deg) scale(0.4)',
                            opacity: 0.8
                        }
                    ], {
                        duration: 1000,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'forwards'
                    });

                    scheduleTimer(() => {
                        shakeContainer.classList.remove('impact-shake');
                        void shakeContainer.offsetWidth;
                        shakeContainer.classList.add('impact-shake');
                    }, 900);
                } else {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.max(w, h) * 0.8;
                    const startX = Math.cos(angle) * distance + cx;
                    const startY = Math.sin(angle) * distance + cy;
                    const randDeg = Math.random() * 360;

                    img.style.left = startX + 'px';
                    img.style.top = startY + 'px';
                    img.style.transform = `translate(-50%, -50%) rotate(${randDeg}deg)`;

                    document.body.appendChild(img);

                    img.animate([
                        {
                            left: startX + 'px',
                            top: startY + 'px',
                            transform: `translate(-50%, -50%) rotate(${randDeg}deg) scale(1)`,
                            opacity: 1
                        },
                        {
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%) rotate(0deg) scale(0.4)',
                            opacity: 0
                        }
                    ], {
                        duration: 1200,
                        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                        fill: 'forwards'
                    });

                    scheduleTimer(() => {
                        shakeContainer.classList.remove('impact-shake');
                        void shakeContainer.offsetWidth;
                        shakeContainer.classList.add('impact-shake');
                    }, 1000);

                    scheduleTimer(() => img.remove(), 1500);
                }
            }, idx * partIntervalMs);
        });

        if (mode === 'exodia') {
            const vanishTime = (sourceCards.length * partIntervalMs) + 1200;
            scheduleTimer(() => {
                activeParts.forEach(part => {
                    part.animate([
                        { opacity: 0.8 },
                        { opacity: 0 }
                    ], {
                        duration: 500,
                        easing: 'ease-out',
                        fill: 'forwards'
                    });
                });
                scheduleTimer(() => {
                    activeParts.forEach(part => part.remove());
                }, 500);
            }, vanishTime);
        }

        // 2단계: 결과 카드 DOM 준비
        const gradeLower = targetCard.grade.toLowerCase();
        const isUR = targetCard.grade === 'UR';
        const backGlowClass = isUR ? 'ur-back-glow' : 'ssr-back-glow';
        const backSymbolColor = isUR ? '#fff' : getGradeColor(targetCard.grade);
        const frontBorderStyle = isUR ? '' : `style="width:100%; height:100%; border: 4px solid var(--ssr-color);"`;
        const gradeBadgeStyle = isUR ? '' : `style="background:${getGradeColor(targetCard.grade)}"`;

        revealContainer.innerHTML = `
            <div class="card-inner" style="transition: transform 3s ease;">
                <div class="card-back ${backGlowClass}" style="border-color:${getGradeColor(targetCard.grade)}; background: #000;">
                    <div class="grade-symbol" style="color: ${backSymbolColor};">${targetCard.grade}</div>
                </div>
                <div class="card-front front-${gradeLower}" ${frontBorderStyle}>
                    <div class="new-badge">${badgeText}</div>
                    <img src="${getImgPath(targetCard.img)}">
                    <div class="info-tag">
                        <div class="char-name name-${gradeLower}">${targetCard.name}</div>
                        <div class="char-grade grade-${gradeLower}" ${gradeBadgeStyle}>${targetCard.grade}</div>
                    </div>
                </div>
            </div>
        `;

        // 3단계: 섬광 -> 실루엣 소멸 -> 카드 공개
        const totalDelay = sourceCards.length * partIntervalMs + 1500;

        scheduleTimer(() => {
            flash.style.backgroundColor = '';
            flash.style.animation = 'none';
            void flash.offsetWidth;
            flash.style.animation = 'superFlash 4s forwards';

            godRays.style.display = 'block';
            scheduleTimer(() => { godRays.style.opacity = '1'; }, 100);

            scheduleTimer(() => {
                revealContainer.style.display = 'block';
                revealContainer.style.pointerEvents = 'auto';

                silhouette.style.animation = 'none';
                void silhouette.offsetWidth;
                silhouette.style.transition = 'opacity 0.8s ease-out';
                silhouette.style.opacity = '0';

                scheduleTimer(() => {
                    silhouette.style.display = 'none';
                    silhouette.style.opacity = '1';
                    silhouette.style.transition = '';
                }, 800);
            }, 2000);

            scheduleTimer(() => {
                revealContainer.classList.add('revealed');

                scheduleTimer(() => {
                    revealContainer.classList.add('landing-active');
                }, 100);

                // 사운드 오류가 나더라도 도감 해금이 절대 중단되지 않도록 예외 격리
                if (onReveal) {
                    try {
                        onReveal(targetCard);
                    } catch (e) {
                        console.error('onReveal error:', e);
                    }
                }

                shakeContainer.classList.add('shake-active');
                scheduleTimer(() => shakeContainer.classList.remove('shake-active'), 4000);

                // 3초 뒤집기 애니메이션으로 카드 앞면이 완전히 공개된 뒤 닫기 허용 및 안내 표시
                scheduleTimer(() => {
                    revealContainer.dataset.canClose = 'true';
                    endingHint.style.display = 'block';
                }, 3000);
            }, 4000);
        }, totalDelay);
    }

    return {
        updatePortalColor,
        triggerGlitch,
        applyAnomalyVisuals,
        resetEndingOverlayState,
        playMergeCutscene
    };
})();