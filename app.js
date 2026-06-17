const roundToStep = (val, step) => {
    const inv = 1 / step;
    return Math.round(val * inv) / inv;
};

// --- アプリケーション状態 ---
const state = {
    mode: 'free', round: 1, totalScore: 0, history: [],
    isSubmitted: false, showGradients: false, targetRgb: [], originalTargetRgb: [],
    guessParams: [0, 0, 0], targetParams: [0, 0, 0],
    currentScore: 0, currentDistance: 0, currentEvaluation: 'S',
    currentModelId: 'rgb',
    timerStart: null, timerInterval: null, elapsedMs: 0, currentTime: 0
};

// --- タイマー ---
const startTimer = () => {
    state.timerStart = Date.now();
    state.elapsedMs = 0;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.elapsedMs = Date.now() - state.timerStart;
        const sec = (state.elapsedMs / 1000).toFixed(1);
        if (el.timerDisplay) el.timerDisplay.textContent = sec + 's';
    }, 100);
};

const stopTimer = () => {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.currentTime = state.elapsedMs;
    if (el.timerDisplay) el.timerDisplay.textContent = (state.currentTime / 1000).toFixed(1) + 's';
};

// --- HTMLコンポーネントの動的生成 ---
document.getElementById('sliders-container').innerHTML = [0, 1, 2].map(i => `
    <div class="space-y-3">
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-widest">
            <span class="flex items-center gap-2">
                <span class="param-dot w-2 h-2 rounded-sm shrink-0"></span>
                <span class="param-name"></span>
            </span>
            <span class="param-val font-mono text-slate-800 text-xs bg-slate-50 px-2 py-0.5 rounded-sm"></span>
        </div>
        <div class="flex items-center gap-3">
            <button class="btn-minus w-8 h-8 shrink-0 flex items-center justify-center text-slate-300 hover:text-slate-800 hover:bg-slate-50 rounded-sm transition disabled:opacity-40">-</button>
            <input type="range" class="param-slider flex-1 min-w-0 h-1.5 rounded-sm bg-slate-100 border border-slate-300 cursor-pointer">
            <button class="btn-plus w-8 h-8 shrink-0 flex items-center justify-center text-slate-300 hover:text-slate-800 hover:bg-slate-50 rounded-sm transition disabled:opacity-40">+</button>
        </div>
    </div>
`).join('');

document.getElementById('result-grid-container').innerHTML = `
    <div class="flex justify-between gap-4 text-xs border-t border-b border-slate-100 py-6">
        <div class="flex-1 space-y-1.5">
            <p class="text-slate-400 font-bold tracking-widest text-[10px] mb-2">正解値</p>
            ${[0, 1, 2].map(() => `<p class="font-mono text-slate-800 text-sm"><span class="ans-label w-4 inline-block text-slate-400"></span> <span class="ans-val font-bold"></span></p>`).join('')}
        </div>
        <div class="flex-1 space-y-1.5 border-l border-slate-100 pl-6">
            <p class="text-slate-400 font-bold tracking-widest text-[10px] mb-2">あなたの予想</p>
            ${[0, 1, 2].map(() => `<p class="font-mono text-slate-800 text-sm"><span class="user-label w-4 inline-block text-slate-400"></span> <span class="user-val font-bold"></span></p>`).join('')}
        </div>
    </div>
`;

// --- DOM キャッシュ ---
const el = {};
document.querySelectorAll('[id]').forEach(n => el[n.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = n);

const queryAll = sel => Array.from(document.querySelectorAll(sel));
const sliders = queryAll('.param-slider'), valDisplays = queryAll('.param-val');
const btnMinus = queryAll('.btn-minus'), btnPlus = queryAll('.btn-plus');
const paramDots = queryAll('.param-dot'), paramNames = queryAll('.param-name'), paramDescs = queryAll('.param-desc');
const ansLabels = queryAll('.ans-label'), ansValues = queryAll('.ans-val');
const userLabels = queryAll('.user-label'), userValues = queryAll('.user-val');

// --- ユーティリティ ---
const showToast = msg => {
    el.toastMessage.textContent = msg;
    el.toast.classList.remove('translate-y-10', 'opacity-0');
    setTimeout(() => el.toast.classList.add('translate-y-10', 'opacity-0'), 2500);
};

const toggleControls = disabled => {
    sliders.forEach(s => s.disabled = disabled);
    btnMinus.forEach(b => b.disabled = disabled);
    btnPlus.forEach(b => b.disabled = disabled);
    el.modelSelect.disabled = disabled;
    state.isSubmitted = disabled;
};

// --- イベント登録 & UI更新 ---
const updateUIFromGuess = () => {
    const model = models[el.modelSelect.value];
    if (!state.isSubmitted) {
        state.guessParams = sliders.map(s => parseFloat(s.value));
        valDisplays.forEach((disp, i) => disp.textContent = model.sliders[i].format(state.guessParams[i]));
        el.colorGuess.style.backgroundColor = model.toCss(...state.guessParams);
    }
    const bgs = model.sliderBg(state.guessParams);
    sliders.forEach((s, i) => s.style.background = state.showGradients ? bgs[i] : '');
};

const setupAdjustButtons = () => {
    [0, 1, 2].forEach(i => {
        const s = models[el.modelSelect.value].sliders[i];

        const setupLongPress = (btn, diff) => {
            let timer = null, interval = null;

            const adjust = () => {
                if (state.isSubmitted) return;
                const min = parseFloat(sliders[i].min);
                const max = parseFloat(sliders[i].max);
                const nextVal = parseFloat(sliders[i].value) + diff;
                sliders[i].value = Math.max(min, Math.min(max, nextVal));
                updateUIFromGuess();
            };

            const start = (e) => {
                e.preventDefault();
                adjust();
                timer = setTimeout(() => {
                    interval = setInterval(adjust, 50);
                }, 300);
            };

            const stop = () => {
                clearTimeout(timer);
                clearInterval(interval);
            };

            btn.onmousedown = start;
            btn.ontouchstart = start;
            btn.onmouseup = stop;
            btn.onmouseleave = stop;
            btn.ontouchend = stop;
            btn.ontouchcancel = stop;
        };

        setupLongPress(btnMinus[i], -s.step);
        setupLongPress(btnPlus[i], s.step);
    });
};

const updateModelLayout = () => {
    const model = models[el.modelSelect.value];
    paramNames.forEach((n, i) => n.textContent = model.labels[i]);
    paramDescs.forEach((n, i) => n.textContent = model.descs[i]);
    paramDots.forEach((n, i) => n.className = `param-dot w-2 h-2 rounded-full shrink-0 ${model.dots[i]}`);

    sliders.forEach((s, i) => {
        s.min = model.sliders[i].min;
        s.max = model.sliders[i].max;
        s.step = model.sliders[i].step;
    });

    if (state.originalTargetRgb && state.originalTargetRgb.length > 0) {
        const rawTargetParams = model.fromRgb(...state.originalTargetRgb);
        state.targetParams = rawTargetParams.map((v, i) => roundToStep(v, model.sliders[i].step));
        state.targetRgb = model.toRgb(...state.targetParams).map(Math.round);

        if (state.currentModelId && state.currentModelId !== el.modelSelect.value) {
            const guessRgb = models[state.currentModelId].toRgb(...state.guessParams);
            state.guessParams = model.fromRgb(...guessRgb);
        }
        state.guessParams = state.guessParams.map((v, i) => roundToStep(v, model.sliders[i].step));
        sliders.forEach((s, i) => s.value = state.guessParams[i]);
    }

    if (state.targetRgb.length > 0) {
        el.colorTarget.style.backgroundColor = `rgb(${state.targetRgb.join(',')})`;
    }

    state.currentModelId = el.modelSelect.value;
    localStorage.setItem('color_guesser_model', el.modelSelect.value);
    setupAdjustButtons();
    updateUIFromGuess();
};

const initGame = (isNewGame = false) => {
    if (isNewGame) {
        state.round = 1; state.totalScore = 0; state.history = [];
        el.challengeTotalScore.textContent = "SCORE: 0";
    }

    const model = models[el.modelSelect.value];
    if (state.targetRgb.length === 0) {
        state.originalTargetRgb = [Math.floor(Math.random() * 210 + 25), Math.floor(Math.random() * 210 + 25), Math.floor(Math.random() * 210 + 25)];
        state.targetRgb = [...state.originalTargetRgb];
        
        const rawTargetParams = model.fromRgb(...state.originalTargetRgb);
        state.targetParams = rawTargetParams.map((v, i) => roundToStep(v, model.sliders[i].step));

        sliders.forEach((s, i) => {
            let val = state.targetParams[i] + (model.sliders[i].max - model.sliders[i].min) * (Math.random() * 0.4 - 0.2);
            val = Math.max(model.sliders[i].min, Math.min(model.sliders[i].max, val));
            s.value = roundToStep(val, model.sliders[i].step);
            state.guessParams[i] = parseFloat(s.value);
        });
        state.currentModelId = el.modelSelect.value;
    }

    el.colorTarget.style.backgroundColor = `rgb(${state.targetRgb.join(',')})`;
    el.challengeRound.textContent = `ROUND: ${state.round} / 5`;

    toggleControls(false);
    el.btnSubmit.classList.remove('hidden');
    el.btnNext.classList.add('hidden');
    el.resultPanel.classList.add('hidden');
    updateModelLayout();
    startTimer();
};

const submitGuess = () => {
    stopTimer();
    const timeSec = (state.currentTime / 1000).toFixed(1);
    toggleControls(true);
    el.btnSubmit.classList.add('hidden');
    el.btnNext.classList.remove('hidden');
    el.resultPanel.classList.remove('hidden');

    const model = models[el.modelSelect.value];
    let distanceSq = 0;

    state.targetParams.forEach((tVal, i) => {
        let diff = Math.abs(tVal - state.guessParams[i]);
        if (i === model.hueIndex) {
            if (diff > 180) diff = 360 - diff;
            diff /= 180;
        } else {
            const p = model.sliders[i];
            diff /= (p.max - p.min);
        }
        distanceSq += diff ** 2;
    });

    const distance = Math.sqrt(distanceSq);
    const isExactMatch = state.targetParams.every((tVal, i) => tVal === state.guessParams[i]);
    let score = 0;
    if (isExactMatch) {
        score = 100;
    } else {
        score = Math.max(0, Math.min(99, Math.round(100 * (1 - distance / 0.35))));
    }

    const evals = [
        { min: 100, txt: 'SS', color: 'bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-amber-500 to-yellow-400 font-extrabold' },
        { min: 95, txt: 'S', color: 'text-amber-500' }, { min: 85, txt: 'A', color: 'text-emerald-500' },
        { min: 70, txt: 'B', color: 'text-blue-500' }, { min: 50, txt: 'C', color: 'text-purple-500' },
        { min: 30, txt: 'D', color: 'text-yellow-600' }, { min: 0, txt: 'E', color: 'text-rose-500' }
    ];
    const evaluation = evals.find(e => score >= e.min);

    el.scoreDisplay.textContent = score;
    el.evaluationText.textContent = evaluation.txt;
    el.evaluationText.className = `text-5xl font-bold ${evaluation.color}`;

    // タイム表示を結果エリアに更新
    if (el.resultTimeDisplay) el.resultTimeDisplay.textContent = timeSec + 's';

    state.currentScore = score;
    state.currentDistance = distance;
    state.currentEvaluation = evaluation.txt;

    ansLabels.forEach((l, i) => l.textContent = model.labels[i]);
    ansValues.forEach((v, i) => v.textContent = model.sliders[i].format(state.targetParams[i]));
    userLabels.forEach((l, i) => l.textContent = model.labels[i]);
    userValues.forEach((v, i) => v.textContent = model.sliders[i].format(state.guessParams[i]));

    if (state.mode === 'challenge') {
        state.totalScore += score;
        const guessRgb = model.toRgb(...state.guessParams).map(Math.round);
        state.history.push({
            round: state.round,
            score,
            distance,
            time: state.currentTime,
            targetColorCSS: `rgb(${state.targetRgb.join(',')})`,
            guessColorCSS: `rgb(${guessRgb.join(',')})`,
            model: el.modelSelect.options[el.modelSelect.selectedIndex].text,
            modelId: el.modelSelect.value,
            targetParams: [...state.targetParams],
            guessParams: [...state.guessParams],
            grad: state.showGradients
        });
        el.challengeTotalScore.textContent = `SCORE: ${state.totalScore}`;
        el.nextText.textContent = state.round < 5 ? "次のラウンドへ" : "結果発表";
        if (el.freeShareContainer) el.freeShareContainer.classList.add('hidden');
    } else {
        el.nextText.textContent = "次の色へ";
        if (el.freeShareContainer) el.freeShareContainer.classList.remove('hidden');
    }
    lucide.createIcons();
};

const handleNext = () => {
    if (state.mode === 'challenge' && state.round >= 5) {
        const totalTimeMs = state.history.reduce((acc, h) => acc + h.time, 0);
        const totalTimeSec = (totalTimeMs / 1000).toFixed(1);
        el.summaryTotalScore.innerHTML = `${state.totalScore} <span class="text-xl text-slate-400 font-medium">/500</span>`;
        el.summaryFeedback.textContent = state.totalScore >= 450 ? "素晴らしい結果です！" : state.totalScore >= 350 ? "良い目を持っていますね！" : "あと少し！練習あるのみ！";
        if (el.summaryTotalTime) el.summaryTotalTime.textContent = totalTimeSec + 's';
        el.summaryHistory.innerHTML = state.history.map(item => {
            const model = models[item.modelId];
            const paramsText = model ? model.labels.map((label, idx) => {
                const targetFmt = model.sliders[idx].format(item.targetParams[idx]);
                const guessFmt = model.sliders[idx].format(item.guessParams[idx]);
                return `<span class="inline-block mr-2"><span class="text-slate-400 font-bold">${label}:</span> <span class="text-slate-500 font-mono text-[9px]">${targetFmt}</span><span class="text-slate-300 mx-0.5">→</span><span class="text-slate-800 font-bold font-mono text-[9px]">${guessFmt}</span></span>`;
            }).join(' ') : '';

            return `
            <div class="flex flex-col p-2.5 border-b border-slate-50 last:border-0 gap-1">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 flex-1">
                        <span class="font-bold w-6 text-slate-400 text-xs">R${item.round}</span>
                        <div class="flex gap-1">
                            <div class="w-5 h-5 rounded-sm ring-1 ring-slate-100" style="background:${item.targetColorCSS}" title="目標値"></div>
                            <div class="w-5 h-5 rounded-sm ring-1 ring-slate-100" style="background:${item.guessColorCSS}" title="入力値"></div>
                        </div>
                        <div class="text-[9px] font-bold text-slate-400 tracking-wider ml-1">
                            ${item.model} · ${item.grad ? 'ガイド有' : 'ガイド無'} · ${(item.time / 1000).toFixed(1)}s
                        </div>
                    </div>
                    <span class="font-mono text-slate-800 text-sm font-bold w-8 text-right">${item.score}</span>
                </div>
                <div class="text-[10px] pl-8 leading-none">
                    ${paramsText}
                </div>
            </div>
            `;
        }).join('');
        el.modalSummary.classList.remove('hidden');
    } else {
        if (state.mode === 'challenge') state.round++;
        state.targetRgb = [];
        initGame();
    }
};

const switchMode = (newMode) => {
    if (state.mode === newMode) return;
    state.mode = newMode;
    const act = "font-bold text-slate-900 border-b-2 border-slate-900 pb-1.5 transition";
    const inact = "font-bold text-slate-400 hover:text-slate-600 border-b-2 border-transparent pb-1.5 transition";
    el.modeFree.className = newMode === 'free' ? act : inact;
    el.modeChallenge.className = newMode !== 'free' ? act : inact;
    el.challengeStatus.classList.toggle('hidden', newMode === 'free');
    state.targetRgb = [];
    initGame(newMode === 'challenge');
};

// --- シェアURL生成 ---
// URL-safe Base64（+→- /→_ =除去）で環境差異を吸収
const encodeShareData = data =>
    btoa(JSON.stringify(data))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

const decodeShareData = enc => {
    // URL-safe → 標準Base64に戻してからデコード
    const b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    return JSON.parse(atob(pad ? b64 + '='.repeat(4 - pad) : b64));
};

const getBaseUrl = () => location.href.replace(/#.*$/, '');

const getFreeShareUrl = () => {
    const model = models[el.modelSelect.value];
    const guessRgb = model.toRgb(...state.guessParams).map(Math.round);
    const data = {
        v: 1, mode: 'free',
        model: el.modelSelect.value,
        grad: state.showGradients,
        tRgb: state.targetRgb,
        gRgb: guessRgb,
        score: state.currentScore,
        eval: state.currentEvaluation,
        time: state.currentTime
    };
    return `${getBaseUrl()}#r=${encodeShareData(data)}`;
};

const getChallengeShareUrl = () => {
    const data = {
        v: 1, mode: 'challenge',
        totalScore: state.totalScore,
        totalTime: state.history.reduce((a, h) => a + h.time, 0),
        history: state.history.map(h => ({
            r: h.round,
            tRgb: h.targetColorCSS.replace(/rgb\(|\)/g, '').split(/[\s,]+/).map(Number),
            gCss: h.guessColorCSS,
            s: h.score,
            t: h.time,
            m: h.model,
            mId: h.modelId,
            tP: h.targetParams,
            gP: h.guessParams,
            g: h.grad
        }))
    };
    return `${getBaseUrl()}#r=${encodeShareData(data)}`;
};

// クリップボード用（URLあり）
const getShareText = () => {
    const totalTimeMs = state.history.reduce((acc, h) => acc + h.time, 0);
    const totalTimeSec = (totalTimeMs / 1000).toFixed(1);
    const url = getChallengeShareUrl();
    return `🎨 Color Guesser チャレンジ結果 🎨\nスコア: ${state.totalScore} / 500  ⏱ ${totalTimeSec}s\n\n` +
        state.history.map(i => `Round ${i.round}: ${i.score}点  ${(i.time / 1000).toFixed(1)}s (${i.model}・${i.grad ? 'ガイド有' : 'ガイド無'})`).join('\n') +
        `\n\n${url}\n#ColorGuesser`;
};

const getFreeShareText = () => {
    const url = getFreeShareUrl();
    const gradText = state.showGradients ? 'あり' : 'なし';
    return `🎨 Color Guesser フリープレイ 🎨\nモデル: ${el.modelSelect.options[el.modelSelect.selectedIndex].text}\nグラデーションガイド: ${gradText}\n評価: ${state.currentEvaluation} (スコア: ${state.currentScore}点 / ${(state.currentTime / 1000).toFixed(1)}s)\n\n${url}\n#ColorGuesser`;
};

// Xツイート用（URLは別パラメーターでt.co短縮）
const getShareTweetText = () => {
    const totalTimeMs = state.history.reduce((acc, h) => acc + h.time, 0);
    const totalTimeSec = (totalTimeMs / 1000).toFixed(1);
    return `🎨 Color Guesser チャレンジ結果 🎨\nスコア: ${state.totalScore} / 500  ⏱ ${totalTimeSec}s\n\n` +
        state.history.map(i => `Round ${i.round}: ${i.score}点  ${(i.time / 1000).toFixed(1)}s (${i.model}・${i.grad ? 'ガイド有' : 'ガイド無'})`).join('\n');
};

const getFreeTweetText = () => {
    const gradText = state.showGradients ? 'あり' : 'なし';
    return `🎨 Color Guesser フリープレイ 🎨\nモデル: ${el.modelSelect.options[el.modelSelect.selectedIndex].text}\nグラデーションガイド: ${gradText}\n評価: ${state.currentEvaluation} (スコア: ${state.currentScore}点 / ${(state.currentTime / 1000).toFixed(1)}s)`;
};

const openXShare = (text, url) => {
    const params = new URLSearchParams({ text, url, hashtags: 'ColorGuesser' });
    window.open(`https://twitter.com/intent/tweet?${params}`, '_blank');
};

sliders.forEach(s => s.addEventListener('input', updateUIFromGuess));
el.modelSelect.addEventListener('change', updateModelLayout);
el.btnSubmit.addEventListener('click', submitGuess);
el.btnNext.addEventListener('click', handleNext);
el.modeFree.addEventListener('click', () => switchMode('free'));
el.modeChallenge.addEventListener('click', () => switchMode('challenge'));
el.btnRestart.addEventListener('click', () => { el.modalSummary.classList.add('hidden'); state.targetRgb = []; initGame(true); });
el.btnShare.addEventListener('click', () => navigator.clipboard.writeText(getShareText()).then(() => showToast("コピーしました")).catch(() => showToast("失敗しました")));
el.btnShareX.addEventListener('click', () => openXShare(getShareTweetText(), getChallengeShareUrl()));
if (el.btnShareFree) el.btnShareFree.addEventListener('click', () => navigator.clipboard.writeText(getFreeShareText()).then(() => showToast("コピーしました")).catch(() => showToast("失敗しました")));
if (el.btnShareXFree) el.btnShareXFree.addEventListener('click', () => openXShare(getFreeTweetText(), getFreeShareUrl()));
el.toggleGradient.addEventListener('change', e => {
    state.showGradients = e.target.checked;
    localStorage.setItem('color_guesser_show_gradients', state.showGradients);
    updateUIFromGuess();
});

// --- シェア結果表示 ---
const showSharedResult = data => {
    const modal = el.modalSharedResult;
    const content = el.sharedResultContent;
    if (!modal || !content) return;

    let html = '';
    if (data.mode === 'free') {
        const tCss = `rgb(${data.tRgb.join(',')})`;
        const gCss = `rgb(${data.gRgb.join(',')})`;
        const evalColors = {
            SS: 'bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-amber-500 to-yellow-400 font-extrabold',
            S: 'text-amber-500',
            A: 'text-emerald-500',
            B: 'text-blue-500',
            C: 'text-purple-500',
            D: 'text-yellow-600',
            E: 'text-rose-500'
        };
        const evalColor = evalColors[data.eval] || 'text-slate-800';

        const model = models[data.model];
        let paramsText = '';
        if (model) {
            const tParams = model.fromRgb(...data.tRgb);
            const gParams = model.fromRgb(...data.gRgb);
            paramsText = model.labels.map((label, idx) => {
                const targetFmt = model.sliders[idx].format(tParams[idx]);
                const guessFmt = model.sliders[idx].format(gParams[idx]);
                return `<span class="inline-block mr-3"><span class="text-slate-400 font-bold">${label}:</span> <span class="text-slate-500 font-mono text-[10px]">${targetFmt}</span><span class="text-slate-300 mx-1">→</span><span class="text-slate-800 font-bold font-mono text-[10px]">${guessFmt}</span></span>`;
            }).join(' ');
        }

        html = `
            <div class="space-y-1.5 mb-6">
                <div class="flex justify-between px-2 text-[10px] font-bold text-slate-400 tracking-widest">
                    <span>TARGET</span><span>GUESS</span>
                </div>
                <div class="relative w-full aspect-[2/1] rounded-sm flex overflow-hidden ring-1 ring-slate-200">
                    <div class="w-1/2 h-full" style="background:${tCss}"></div>
                    <div class="w-1/2 h-full" style="background:${gCss}"></div>
                </div>
                <div class="text-center text-[10px] font-bold text-slate-400 tracking-wider pt-2">
                    モデル: <span class="text-slate-700">${(data.model || '').toUpperCase()}</span> · グラデーションガイド: <span class="text-slate-700">${data.grad ? 'あり' : 'なし'}</span>
                </div>
                ${paramsText ? `
                <div class="text-center text-[10px] pt-3 border-t border-slate-100 mt-2 leading-none">
                    ${paramsText}
                </div>` : ''}
            </div>
            <div class="flex justify-center gap-8 text-center pt-2">
                <div>
                    <p class="text-5xl font-black ${evalColor}">${data.eval}</p>
                    <p class="text-[10px] font-bold text-slate-400 tracking-widest mt-2">評価</p>
                </div>
                <div>
                    <p class="text-5xl font-black text-slate-800">${data.score}</p>
                    <p class="text-[10px] font-bold text-slate-400 tracking-widest mt-2">スコア</p>
                </div>
                <div>
                    <p class="text-5xl font-black text-slate-800">${(data.time / 1000).toFixed(1)}<span class="text-2xl text-slate-400">s</span></p>
                    <p class="text-[10px] font-bold text-slate-400 tracking-widest mt-2">タイム</p>
                </div>
            </div>
        `;
    } else {
        const totalTimeSec = (data.totalTime / 1000).toFixed(1);
        html = `
            <div class="flex justify-center gap-10 text-center mb-8">
                <div>
                    <p class="text-4xl font-black text-slate-800">${data.totalScore}<span class="text-lg text-slate-400 font-medium">/500</span></p>
                    <p class="text-[10px] font-bold text-slate-400 tracking-widest mt-2">総合スコア</p>
                </div>
                <div>
                    <p class="text-4xl font-black text-slate-800">${totalTimeSec}<span class="text-lg text-slate-400">s</span></p>
                    <p class="text-[10px] font-bold text-slate-400 tracking-widest mt-2">合計タイム</p>
                </div>
            </div>
            <div class="space-y-0 border-t border-slate-100 pt-2">
                ${data.history.map(h => {
            const tCss = `rgb(${h.tRgb.join(',')})`;
            const model = models[h.mId];
            const paramsText = (model && h.tP && h.gP) ? model.labels.map((label, idx) => {
                const targetFmt = model.sliders[idx].format(h.tP[idx]);
                const guessFmt = model.sliders[idx].format(h.gP[idx]);
                return `<span class="inline-block mr-2"><span class="text-slate-400 font-bold">${label}:</span> <span class="text-slate-500 font-mono text-[9px]">${targetFmt}</span><span class="text-slate-300 mx-0.5">→</span><span class="text-slate-800 font-bold font-mono text-[9px]">${guessFmt}</span></span>`;
            }).join(' ') : '';

            return `
                    <div class="flex flex-col p-2.5 border-b border-slate-50 last:border-0 gap-1">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2 flex-1">
                                <span class="font-bold w-6 text-slate-400 text-xs">R${h.r}</span>
                                <div class="flex gap-1">
                                    <div class="w-5 h-5 rounded-sm ring-1 ring-slate-100" style="background:${tCss}"></div>
                                    <div class="w-5 h-5 rounded-sm ring-1 ring-slate-100" style="background:${h.gCss}"></div>
                                </div>
                                <div class="text-[9px] font-bold text-slate-400 tracking-wider ml-1">
                                    ${(h.m || 'RGB').toUpperCase()} · ${h.g ? 'ガイド有' : 'ガイド無'} · ${(h.t / 1000).toFixed(1)}s
                                </div>
                            </div>
                            <span class="font-mono text-slate-800 font-bold w-8 text-right ml-3">${h.s}</span>
                        </div>
                        ${paramsText ? `<div class="text-[10px] pl-8 leading-none">${paramsText}</div>` : ''}
                    </div>`;
        }).join('')}
            </div>
        `;
    }
    content.innerHTML = html;
    modal.classList.remove('hidden');
    lucide.createIcons();
};

if (el.btnPlayMyself) el.btnPlayMyself.addEventListener('click', () => {
    el.modalSharedResult.classList.add('hidden');
    history.replaceState(null, '', location.pathname + location.search);
});

// ページ読み込み時にシェアリンクを確認
const checkSharedResult = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#r=')) {
        try {
            const data = decodeShareData(hash.slice(3));
            if (data && data.v === 1) showSharedResult(data);
        } catch (e) {
            console.warn('シェアリンクの解析に失敗:', e);
        }
    }
};

// localStorageから設定を復元
const savedShowGradients = localStorage.getItem('color_guesser_show_gradients');
if (savedShowGradients !== null) {
    state.showGradients = savedShowGradients === 'true';
    el.toggleGradient.checked = state.showGradients;
}

const savedModel = localStorage.getItem('color_guesser_model');
if (savedModel && models[savedModel]) {
    el.modelSelect.value = savedModel;
    state.currentModelId = savedModel;
}

initGame(true);
checkSharedResult();
