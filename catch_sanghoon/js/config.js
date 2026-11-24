window.SanghoonApp = window.SanghoonApp || {};

window.SanghoonApp.CONFIG = {
    paths: {
        images: 'assets/images/',
        audio: 'assets/audio/'
    },

    gradeColors: {
        UR: 'var(--ur-color)',
        SSR: 'var(--ssr-color)',
        SR: 'var(--sr-color)',
        R: 'var(--r-color)',
        C: 'var(--c-color)'
    },

    collectionSortOrder: {
        UR: 5,
        SSR: 1,
        SR: 2,
        R: 3,
        C: 4
    },

    gachaRates: {
        normal: { SSR: 0.5, SR: 5.5, R: 45.5 }, // 누적 확률(%)
        chanceUp10: { SSR: 1, SR: 10, R: 60 }
    },

    timings: {
        portalTickMs: 100,
        portalTicks: { ssr: 55, goldAt: 20, purpleAt: 35, sr: 42, normal: 25 },
        singleDelay: { SSR: 2300, SR: 1200, default: 500 },
        multiDelay: { fast: 100, normal: 500 },
        revealPostDelay: { fast: 150, normal: 500 },
        viewTime: { high: 1500, fast: 100, normal: 400 },
        endingTriggerDelay: 1000,
        glitchDelay: 1000,
        glitchAfterExodiaDelay: 500
    },

    audio: {
        beep: { file: 'beep.mp3', volume: 0.8 },
        urIntro: { file: 'UR01.mp3', volume: 1.0 },
        urFlip: { file: 'UR02.mp3', volume: 1.0 },
        exodiaPart: { file: 'ex01.mp3', volume: 0.6 },
        defaultGradeSounds: {
            SR: { file: 'SR.mp3', volume: 0.3 },
            R: { file: 'CandR.mp3', volume: 0.3 },
            C: { file: 'CandR.mp3', volume: 0.3 }
        },
        fallbackVolume: 0.3
    },

    events: {
        urEndingCardId: 999,
        glitchThreshold: 70, // 도감 70장 이상 시 이상현상 발동
        exodia: {
            rewardCardId: 26,
            orderedPartIds: [71, 75, 73, 72, 74], // 합체 연출 등장 순서
            // 화면 중앙(cx, cy) 기준 각 파츠별 출발 및 도착 오프셋
            partLayouts: {
                71: { startOffset: (w, h, cx, cy) => [cx, -400],       targetOffset: (cx, cy) => [cx, cy - 110] },
                74: { startOffset: (w, h, cx, cy) => [-400, cy - 100], targetOffset: (cx, cy) => [cx - 50, cy + 10] },
                72: { startOffset: (w, h, cx, cy) => [w + 400, cy - 100], targetOffset: (cx, cy) => [cx + 50, cy + 10] },
                75: { startOffset: (w, h, cx, cy) => [cx - 100, h + 400], targetOffset: (cx, cy) => [cx - 100, cy + 220] },
                73: { startOffset: (w, h, cx, cy) => [cx + 100, h + 400], targetOffset: (cx, cy) => [cx + 100, cy + 220] }
            }
        }
    },

    adminKey: '0'
};