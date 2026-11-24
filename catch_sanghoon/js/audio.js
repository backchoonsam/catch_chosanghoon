window.SanghoonApp = window.SanghoonApp || {};

window.SanghoonApp.AudioPlayer = (function () {
    const { CONFIG, CHARACTERS } = window.SanghoonApp;

    const isFileProtocol = window.location.protocol === 'file:';
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    let audioCtx = null;
    let keepAliveStarted = false;

    // Web Audio API 버퍼 캐시 (http/https 환경)
    const bufferCache = new Map();
    const pendingDecodes = new Map();

    // HTMLAudioElement 재사용 풀 (file:// 환경 및 로딩 중 폴백)
    const htmlAudioPools = new Map();
    const poolCursor = new Map();

    // 짧고 반복 빈도가 높은 효과음은 다중 슬롯 확보
    const HIGH_FREQUENCY_FILES = new Set([
        CONFIG.audio.beep.file,
        CONFIG.audio.exodiaPart.file,
        CONFIG.audio.defaultGradeSounds.SR.file,
        CONFIG.audio.defaultGradeSounds.R.file,
        CONFIG.audio.defaultGradeSounds.C.file
    ]);

    function getAudioPath(fileName) {
        return CONFIG.paths.audio + fileName;
    }

    function collectAllAudioFiles() {
        const files = new Set([
            CONFIG.audio.beep.file,
            CONFIG.audio.urIntro.file,
            CONFIG.audio.urFlip.file,
            CONFIG.audio.exodiaPart.file
        ]);

        Object.values(CONFIG.audio.defaultGradeSounds).forEach(entry => {
            if (entry && entry.file) files.add(entry.file);
        });

        CHARACTERS.forEach(c => {
            if (c.sound) files.add(c.sound);
        });

        return [...files];
    }

    function ensureAudioContext() {
        if (!AudioCtx) return null;
        if (!audioCtx) {
            audioCtx = new AudioCtx();
        }
        return audioCtx;
    }

    /**
     * 완전 무음(0 샘플) 버퍼로 오디오 출력 스트림을 활성 상태로 유지하여
     * 오디오 장치 절전 복귀 시 효과음 앞부분이 잘리는 현상을 방지
     */
    function startAudioKeepAlive() {
        if (keepAliveStarted || !audioCtx) return;
        try {
            const silentBuffer = audioCtx.createBuffer(1, 1, 22050);
            const source = audioCtx.createBufferSource();
            source.buffer = silentBuffer;
            source.loop = true;

            const gain = audioCtx.createGain();
            gain.gain.value = 0;

            source.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(0);
            keepAliveStarted = true;
        } catch (e) {
            // 무시
        }
    }

    function unlockAudio() {
        const ctx = ensureAudioContext();
        if (!ctx) return;

        if (ctx.state === 'running') {
            startAudioKeepAlive();
        } else if (ctx.state === 'suspended') {
            ctx.resume().then(startAudioKeepAlive).catch(() => {});
        }
    }

    // --- 1. HTMLAudioElement 프리로드 풀 ---
    function createHtmlAudioInstance(fileName) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = getAudioPath(fileName);
        try {
            audio.load();
        } catch (e) {}
        return audio;
    }

    function ensureHtmlPool(fileName) {
        if (htmlAudioPools.has(fileName)) return htmlAudioPools.get(fileName);

        const poolSize = HIGH_FREQUENCY_FILES.has(fileName) ? 6 : 2;
        const pool = [];
        for (let i = 0; i < poolSize; i++) {
            pool.push(createHtmlAudioInstance(fileName));
        }
        htmlAudioPools.set(fileName, pool);
        poolCursor.set(fileName, 0);
        return pool;
    }

    function playViaHtmlPool(fileName, volume) {
        try {
            const pool = ensureHtmlPool(fileName);
            let target = pool.find(a => a.paused || a.ended);

            if (!target) {
                const idx = poolCursor.get(fileName) || 0;
                target = pool[idx];
                poolCursor.set(fileName, (idx + 1) % pool.length);
            }

            if (!target.paused) {
                target.pause();
            }
            target.currentTime = 0;
            target.volume = volume;
            target.play().catch(err => console.log('Audio play error:', err));
        } catch (e) {
            console.error(fileName + ' 재생 실패:', e);
        }
    }

    // --- 2. Web Audio API 프리로드 & 디코드 ---
    function loadWebAudioBuffer(fileName) {
        if (isFileProtocol || !AudioCtx) return Promise.resolve(null);
        if (bufferCache.has(fileName)) return Promise.resolve(bufferCache.get(fileName));
        if (pendingDecodes.has(fileName)) return pendingDecodes.get(fileName);

        const ctx = ensureAudioContext();
        if (!ctx) return Promise.resolve(null);

        const promise = fetch(getAudioPath(fileName))
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.arrayBuffer();
            })
            .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
            .then(decoded => {
                bufferCache.set(fileName, decoded);
                pendingDecodes.delete(fileName);
                return decoded;
            })
            .catch(() => {
                pendingDecodes.delete(fileName);
                return null;
            });

        pendingDecodes.set(fileName, promise);
        return promise;
    }

    function playWebAudioBuffer(buffer, volume) {
        try {
            const ctx = ensureAudioContext();
            if (!ctx || ctx.state === 'closed' || !buffer) return false;

            const startSource = () => {
                try {
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;

                    const gainNode = ctx.createGain();
                    gainNode.gain.value = volume;

                    source.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    source.start(0);
                } catch (e) {
                    console.log('WebAudio start error:', e);
                }
            };

            if (ctx.state === 'suspended') {
                ctx.resume().then(() => {
                    startAudioKeepAlive();
                    startSource();
                }).catch(() => {});
            } else {
                startAudioKeepAlive();
                startSource();
            }
            return true;
        } catch (e) {
            return false;
        }
    }


    // --- 3. 공개 API ---
    function preloadAll() {
        const allFiles = collectAllAudioFiles();
        const priority = allFiles.filter(
            f => HIGH_FREQUENCY_FILES.has(f) ||
                 f === CONFIG.audio.urIntro.file ||
                 f === CONFIG.audio.urFlip.file
        );
        const rest = allFiles.filter(f => !priority.includes(f));

        const preloadList = (list) => {
            list.forEach(fileName => {
                if (isFileProtocol || !AudioCtx) {
                    ensureHtmlPool(fileName);
                } else {
                    loadWebAudioBuffer(fileName);
                }
            });
        };

        preloadList(priority);
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => preloadList(rest), { timeout: 2000 });
        } else {
            setTimeout(() => preloadList(rest), 500);
        }
    }

    function playFile(fileName, volume = CONFIG.audio.fallbackVolume) {
        if (!fileName) return;

        if (!isFileProtocol && bufferCache.has(fileName)) {
            if (playWebAudioBuffer(bufferCache.get(fileName), volume)) {
                return;
            }
        }

        // 아직 디코딩 완료 전이거나 file:// 환경일 때 풀로 즉시 재생
        playViaHtmlPool(fileName, volume);

        if (!isFileProtocol && !bufferCache.has(fileName)) {
            loadWebAudioBuffer(fileName);
        }
    }

    function playBeep() {
        playFile(CONFIG.audio.beep.file, CONFIG.audio.beep.volume);
    }

    function playCardSound(card) {
        if (card.sound) {
            playFile(card.sound, card.soundVolume ?? CONFIG.audio.fallbackVolume);
            return;
        }
        const gradeDefault = CONFIG.audio.defaultGradeSounds[card.grade];
        if (gradeDefault) {
            playFile(gradeDefault.file, gradeDefault.volume);
        }
    }

    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });

    return {
        preloadAll,
        unlockAudio,
        playFile,
        playBeep,
        playCardSound
    };
})();