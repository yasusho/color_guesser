// --- アプリケーション状態 ---
const state = {
    mode: 'free', round: 1, totalScore: 0, history: [],
    isSubmitted: false, showGradients: false, targetRgb: [],
    guessParams: [0, 0, 0], targetParams: [0, 0, 0],
    currentScore: 0, currentDistance: 0, currentEvaluation: 'S',
    currentModelId: 'rgb'
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
        const adjust = diff => {
            if (state.isSubmitted) return;
            sliders[i].value = Math.max(parseFloat(sliders[i].min), Math.min(parseFloat(sliders[i].max), parseFloat(sliders[i].value) + diff));
            updateUIFromGuess();
        };
        const s = models[el.modelSelect.value].sliders[i];
        btnMinus[i].onclick = () => adjust(-s.step);
        btnPlus[i].onclick = () => adjust(s.step);
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

    if (state.targetRgb.length > 0) {
        state.targetParams = model.fromRgb(...state.targetRgb);
        if (state.currentModelId && state.currentModelId !== el.modelSelect.value) {
            const oldModel = models[state.currentModelId];
            const guessRgb = oldModel.toRgb(...state.guessParams);
            state.guessParams = model.fromRgb(...guessRgb);
        }
        sliders.forEach((s, i) => s.value = state.guessParams[i]);
    }
    
    state.currentModelId = el.modelSelect.value;
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
        state.targetRgb = [Math.floor(Math.random()*210+25), Math.floor(Math.random()*210+25), Math.floor(Math.random()*210+25)];
        state.targetParams = model.fromRgb(...state.targetRgb);
        sliders.forEach((s, i) => {
            s.value = state.targetParams[i] + (model.sliders[i].max - model.sliders[i].min) * (Math.random()*0.4 - 0.2);
            state.guessParams[i] = parseFloat(s.value);
        });
        state.currentModelId = el.modelSelect.value;
    }
    
    el.colorTarget.style.backgroundColor = `rgb(${state.targetRgb.join(',')})`;
    el.challengeRound.textContent = `ROUND: ${state.round} / 5`;
    
    toggleControls(false);
    el.actionPanel.classList.remove('hidden');
    el.resultPanel.classList.add('hidden');
    updateModelLayout();
};

const submitGuess = () => {
    toggleControls(true);
    el.actionPanel.classList.add('hidden');
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
    let score = Math.max(0, Math.min(100, Math.round(100 * (1 - distance / 0.35))));
    if (distance < 0.01) score = 100;

    const evals = [
        { min: 95, txt: 'S', color: 'text-amber-500' }, { min: 85, txt: 'A', color: 'text-emerald-500' },
        { min: 70, txt: 'B', color: 'text-blue-500' }, { min: 50, txt: 'C', color: 'text-purple-500' },
        { min: 30, txt: 'D', color: 'text-yellow-600' }, { min: 0, txt: 'E', color: 'text-rose-500' }
    ];
    const evaluation = evals.find(e => score >= e.min);

    el.scoreDisplay.textContent = score;
    el.evaluationText.textContent = evaluation.txt;
    el.evaluationText.className = `text-5xl font-bold ${evaluation.color}`;

    state.currentScore = score;
    state.currentDistance = distance;
    state.currentEvaluation = evaluation.txt;

    ansLabels.forEach((l, i) => l.textContent = model.labels[i]);
    ansValues.forEach((v, i) => v.textContent = model.sliders[i].format(state.targetParams[i]));
    userLabels.forEach((l, i) => l.textContent = model.labels[i]);
    userValues.forEach((v, i) => v.textContent = model.sliders[i].format(state.guessParams[i]));

    if (state.mode === 'challenge') {
        state.totalScore += score;
        state.history.push({ round: state.round, score, distance, targetColorCSS: `rgb(${state.targetRgb.join(' ')})`, guessColorCSS: model.toCss(...state.guessParams) });
        el.challengeTotalScore.textContent = `SCORE: ${state.totalScore}`;
        el.nextText.textContent = state.round < 5 ? "次のラウンドへ" : "結果発表";
        if(el.freeShareContainer) el.freeShareContainer.classList.add('hidden');
    } else {
        el.nextText.textContent = "次の色へ";
        if(el.freeShareContainer) el.freeShareContainer.classList.remove('hidden');
    }
    lucide.createIcons();
};

const handleNext = () => {
    if (state.mode === 'challenge' && state.round >= 5) {
        el.summaryTotalScore.innerHTML = `${state.totalScore} <span class="text-xl text-slate-400 font-medium">/500</span>`;
        el.summaryFeedback.textContent = state.totalScore >= 450 ? "素晴らしい結果です！" : state.totalScore >= 350 ? "良い目を持っていますね！" : "あと少し！練習あるのみ！";
        el.summaryHistory.innerHTML = state.history.map(item => `
            <div class="flex items-center justify-between p-2.5">
                <span class="font-bold w-8 text-slate-400">R${item.round}</span>
                <div class="flex gap-1.5 flex-1 px-2">
                    <div class="w-5 h-5 rounded-sm" style="background:${item.targetColorCSS}"></div>
                    <div class="w-5 h-5 rounded-sm" style="background:${item.guessColorCSS}"></div>
                </div>
                <span class="font-mono text-slate-800 text-base">${item.score}</span>
            </div>
        `).join('');
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

const getShareText = () => `🎨 Color Guesser チャレンジ結果 🎨\nスコア: ${state.totalScore} / 500\n\n` +
    state.history.map(i => `Round ${i.round}: ${i.score}点 (誤差: ${i.distance.toFixed(3)})`).join('\n') + `\n\nhttps://yasusho.github.io/color_guesser/\n#ColorGuesser`;

const getFreeShareText = () => `🎨 Color Guesser フリープレイ 🎨\nモデル: ${el.modelSelect.options[el.modelSelect.selectedIndex].text}\n評価: ${state.currentEvaluation} (スコア: ${state.currentScore}点 / 誤差: ${state.currentDistance.toFixed(3)})\n\nhttps://yasusho.github.io/color_guesser/\n#ColorGuesser`;

sliders.forEach(s => s.addEventListener('input', updateUIFromGuess));
el.modelSelect.addEventListener('change', updateModelLayout);
el.btnSubmit.addEventListener('click', submitGuess);
el.btnNext.addEventListener('click', handleNext);
el.modeFree.addEventListener('click', () => switchMode('free'));
el.modeChallenge.addEventListener('click', () => switchMode('challenge'));
el.btnRestart.addEventListener('click', () => { el.modalSummary.classList.add('hidden'); state.targetRgb = []; initGame(true); });
el.btnShare.addEventListener('click', () => navigator.clipboard.writeText(getShareText()).then(() => showToast("コピーしました")).catch(() => showToast("失敗しました")));
el.btnShareX.addEventListener('click', () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`, '_blank'));
if (el.btnShareFree) el.btnShareFree.addEventListener('click', () => navigator.clipboard.writeText(getFreeShareText()).then(() => showToast("コピーしました")).catch(() => showToast("失敗しました")));
if (el.btnShareXFree) el.btnShareXFree.addEventListener('click', () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getFreeShareText())}`, '_blank'));
el.toggleGradient.addEventListener('change', e => { state.showGradients = e.target.checked; updateUIFromGuess(); });

initGame(true);
