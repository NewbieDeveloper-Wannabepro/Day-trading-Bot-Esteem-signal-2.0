// 1. CONFIGURATION - 
const config = {
    finnhubApiKey: 'd0kh4ohr01qn937kqp2gd0kh4ohr01qn937kqp30',
    telegramBotToken: '7610946823:AAEXmOV-Md2FkR3HMmqno4hyRsfoulA1MYM', 
    telegramChatId: '6469981362', 
    emaPeriod: 9,
    macdConfig: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
    },
    overbought: 70,
    oversold: 30
};

// 2. STATE MANAGEMENT
let state = {
    isConnected: false,
    isRunning: false,
    priceHistory: [],
    indicators: {
        rsi: null,
        ema9: null,
        macd: {
            macdLine: null,
            signalLine: null,
            histogram: null
        }
    },
    currentPrice: null,
    socket: null,
    currentPair: 'OANDA:EUR_USD'
};

// 3. DOM ELEMENTS
const elements = {
    pairSelect: document.getElementById('currency-pair'),
    connectBtn: document.getElementById('connect-btn'),
    startBtn: document.getElementById('start-btn'),
    currentPriceDisplay: document.getElementById('current-price'),
    rsiDisplay: document.getElementById('rsi-value'),
    ema9Display: document.getElementById('ema9-value'),
    macdDisplay: document.getElementById('macd-value'),
    signalDisplay: document.getElementById('signal-value'),
    historyList: document.getElementById('history-list')
};

// 4. INITIALIZATION
function init() {
    loadHistory();
    setupEventListeners();
}

// 5. WEBSOCKET CONNECTION
function connectWebSocket() {
    if (state.socket) {
        state.socket.close();
    }
    
    state.currentPair = elements.pairSelect.value;
    
    if (!config.finnhubApiKey) {
        console.error('Finnhub API key not configured');
        return;
    }
    
    state.socket = new WebSocket(`wss://ws.finnhub.io?token=${config.finnhubApiKey}`);
    
    state.socket.onopen = () => {
        state.isConnected = true;
        updateUI();
        subscribeToPair(state.currentPair);
        console.log('WebSocket connected');
    };
    
    state.socket.onclose = () => {
        state.isConnected = false;
        state.isRunning = false;
        updateUI();
        console.log('WebSocket disconnected');
    };
    
    state.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    state.socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === 'trade') {
            processPriceData(data.data[0].p);
        }
    };
}

function subscribeToPair(pair) {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({'type':'subscribe', 'symbol': pair}));
        console.log(`Subscribed to ${pair}`);
    }
}

function unsubscribeFromPair(pair) {
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({'type':'unsubscribe', 'symbol': pair}));
        console.log(`Unsubscribed from ${pair}`);
    }
}

// 6. PRICE PROCESSING
function processPriceData(price) {
    state.currentPrice = price;
    state.priceHistory.push(price);
    
    // Keep a reasonable history size
    if (state.priceHistory.length > 100) {
        state.priceHistory.shift();
    }
    
    updatePriceDisplay();
    calculateIndicators();
}

function updatePriceDisplay() {
    elements.currentPriceDisplay.textContent = state.currentPrice.toFixed(5);
}

// 7. TECHNICAL INDICATORS
function calculateIndicators() {
    if (state.priceHistory.length < Math.max(config.rsiPeriod, config.macdConfig.slowPeriod)) {
        return;
    }
    
    calculateRSI();
    calculateEMA();
    calculateMACD();
    generateSignal();
    updateIndicatorsDisplay();
}

function calculateRSI() {
    const period = config.rsiPeriod;
    if (state.priceHistory.length < period + 1) return;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
        const change = state.priceHistory[i] - state.priceHistory[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    const rs = avgGain / avgLoss;
    state.indicators.rsi = 100 - (100 / (1 + rs));
}

function calculateEMA() {
    const period = config.emaPeriod;
    if (state.priceHistory.length < period) return;
    
    // Simple SMA as initial EMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += state.priceHistory[state.priceHistory.length - period + i];
    }
    const sma = sum / period;
    
    // Calculate EMA
    const multiplier = 2 / (period + 1);
    let ema = sma;
    
    for (let i = period; i < state.priceHistory.length; i++) {
        ema = (state.priceHistory[i] - ema) * multiplier + ema;
    }
    
    state.indicators.ema9 = ema;
}

function calculateMACD() {
    const fastPeriod = config.macdConfig.fastPeriod;
    const slowPeriod = config.macdConfig.slowPeriod;
    const signalPeriod = config.macdConfig.signalPeriod;
    
    if (state.priceHistory.length < slowPeriod + signalPeriod) return;
    
    // Calculate fast EMA
    let fastSum = 0;
    for (let i = 0; i < fastPeriod; i++) {
        fastSum += state.priceHistory[state.priceHistory.length - fastPeriod + i];
    }
    let fastEMA = fastSum / fastPeriod;
    const fastMultiplier = 2 / (fastPeriod + 1);
    
    for (let i = fastPeriod; i < state.priceHistory.length; i++) {
        fastEMA = (state.priceHistory[i] - fastEMA) * fastMultiplier + fastEMA;
    }
    
    // Calculate slow EMA
    let slowSum = 0;
    for (let i = 0; i < slowPeriod; i++) {
        slowSum += state.priceHistory[state.priceHistory.length - slowPeriod + i];
    }
    let slowEMA = slowSum / slowPeriod;
    const slowMultiplier = 2 / (slowPeriod + 1);
    
    for (let i = slowPeriod; i < state.priceHistory.length; i++) {
        slowEMA = (state.priceHistory[i] - slowEMA) * slowMultiplier + slowEMA;
    }
    
    // MACD Line
    const macdLine = fastEMA - slowEMA;
    
    // Signal Line (EMA of MACD Line)
    let signalSum = 0;
    const macdValues = [];
    for (let i = 0; i < signalPeriod; i++) {
        const idx = state.priceHistory.length - slowPeriod - signalPeriod + i;
        if (idx >= 0) {
            // Simplified - in reality we'd need to track MACD values over time
            macdValues.push(fastEMA - slowEMA); // Approximation
            signalSum += macdValues[i];
        }
    }
    let signalLine = signalSum / signalPeriod;
    const signalMultiplier = 2 / (signalPeriod + 1);
    
    for (let i = signalPeriod; i < macdValues.length; i++) {
        signalLine = (macdValues[i] - signalLine) * signalMultiplier + signalLine;
    }
    
    state.indicators.macd = {
        macdLine: macdLine,
        signalLine: signalLine,
        histogram: macdLine - signalLine
    };
}

// 8. SIGNAL GENERATION
function generateSignal() {
    if (!state.indicators.rsi || !state.indicators.ema9 || !state.indicators.macd.macdLine) {
        return;
    }
    
    const rsi = state.indicators.rsi;
    const ema9 = state.indicators.ema9;
    const macd = state.indicators.macd;
    const price = state.currentPrice;
    
    let signal = null;
    
    // Buy signal conditions
    if (rsi < config.oversold && 
        price > ema9 && 
        macd.macdLine > macd.signalLine && 
        macd.histogram > 0) {
        signal = { type: 'BUY', timestamp: new Date() };
    }
    // Sell signal conditions
    else if (rsi > config.overbought && 
             price < ema9 && 
             macd.macdLine < macd.signalLine && 
             macd.histogram < 0) {
        signal = { type: 'SELL', timestamp: new Date() };
    }
    
    if (signal) {
        addSignalToHistory(signal);
        if (state.isRunning) {
            sendTelegramAlert(signal);
        }
    }
}

// 9. TELEGRAM ALERTS
function sendTelegramAlert(signal) {
    if (!config.telegramBotToken || !config.telegramChatId) {
        console.log('Telegram credentials not configured');
        return;
    }
    
    const pairName = elements.pairSelect.options[elements.pairSelect.selectedIndex].text;
    const message = `🚨 ${signal.type} Signal for ${pairName} 🚨
Price: ${state.currentPrice.toFixed(5)}
RSI: ${state.indicators.rsi.toFixed(2)}
EMA9: ${state.indicators.ema9.toFixed(5)}
MACD: ${state.indicators.macd.macdLine.toFixed(5)} / ${state.indicators.macd.signalLine.toFixed(5)}
Time: ${signal.timestamp.toLocaleTimeString()}`;
    
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage?chat_id=${config.telegramChatId}&text=${encodeURIComponent(message)}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => console.log('Telegram alert sent:', data))
        .catch(error => console.error('Error sending Telegram alert:', error));
}

// 10. SIGNAL HISTORY
function addSignalToHistory(signal) {
    const signals = getSignalHistory();
    signals.push({
        type: signal.type,
        timestamp: signal.timestamp,
        price: state.currentPrice,
        pair: elements.pairSelect.options[elements.pairSelect.selectedIndex].text,
        rsi: state.indicators.rsi,
        ema9: state.indicators.ema9,
        macd: state.indicators.macd
    });
    
    localStorage.setItem('tradingBotSignals', JSON.stringify(signals));
    loadHistory();
}

function getSignalHistory() {
    const history = localStorage.getItem('tradingBotSignals');
    return history ? JSON.parse(history) : [];
}

function loadHistory() {
    const signals = getSignalHistory();
    elements.historyList.innerHTML = '';
    
    // Display only the last 20 signals
    const recentSignals = signals.slice(-20).reverse();
    
    recentSignals.forEach(signal => {
        const signalElement = document.createElement('div');
        signalElement.className = `signal-item ${signal.type.toLowerCase()}-signal`;
        
        const timeStr = new Date(signal.timestamp).toLocaleString();
        signalElement.innerHTML = `
            <strong>${signal.type} - ${signal.pair}</strong>
            <div>Price: ${signal.price.toFixed(5)}</div>
            <div>RSI: ${signal.rsi.toFixed(2)}, EMA9: ${signal.ema9.toFixed(5)}</div>
            <div>MACD: ${signal.macd.macdLine.toFixed(5)} / ${signal.macd.signalLine.toFixed(5)}</div>
            <div class="time">${timeStr}</div>
        `;
        
        elements.historyList.appendChild(signalElement);
    });
}

// 11. EVENT LISTENERS
function setupEventListeners() {
    elements.connectBtn.addEventListener('click', () => {
        if (state.isConnected) {
            state.socket.close();
        } else {
            connectWebSocket();
        }
    });
    
    elements.startBtn.addEventListener('click', () => {
        state.isRunning = !state.isRunning;
        updateUI();
    });
    
    elements.pairSelect.addEventListener('change', () => {
        if (state.isConnected) {
            unsubscribeFromPair(state.currentPair);
            state.currentPair = elements.pairSelect.value;
            subscribeToPair(state.currentPair);
        }
    });
}

function updateUI() {
    elements.connectBtn.textContent = state.isConnected ? 'Disconnect' : 'Connect';
    elements.startBtn.disabled = !state.isConnected;
    elements.startBtn.textContent = state.isRunning ? 'Stop Bot' : 'Start Bot';
    
    if (state.isConnected) {
        elements.connectBtn.classList.add('status-connected');
        elements.connectBtn.classList.remove('status-disconnected');
    } else {
        elements.connectBtn.classList.add('status-disconnected');
        elements.connectBtn.classList.remove('status-connected');
    }
}

function updateIndicatorsDisplay() {
    elements.rsiDisplay.textContent = state.indicators.rsi ? state.indicators.rsi.toFixed(2) : '-';
    elements.ema9Display.textContent = state.indicators.ema9 ? state.indicators.ema9.toFixed(5) : '-';
    
    if (state.indicators.macd.macdLine) {
        elements.macdDisplay.textContent = `${state.indicators.macd.macdLine.toFixed(5)} / ${state.indicators.macd.signalLine.toFixed(5)}`;
    } else {
        elements.macdDisplay.textContent = '-';
    }
    
    // Update signal display based on conditions
    if (state.indicators.rsi && state.indicators.ema9 && state.indicators.macd.macdLine) {
        if (state.indicators.rsi < config.oversold && 
            state.currentPrice > state.indicators.ema9 && 
            state.indicators.macd.macdLine > state.indicators.macd.signalLine) {
            elements.signalDisplay.textContent = 'BUY';
            elements.signalDisplay.className = 'buy-signal';
        } else if (state.indicators.rsi > config.overbought && 
                  state.currentPrice < state.indicators.ema9 && 
                  state.indicators.macd.macdLine < state.indicators.macd.signalLine) {
            elements.signalDisplay.textContent = 'SELL';
            elements.signalDisplay.className = 'sell-signal';
        } else {
            elements.signalDisplay.textContent = 'NEUTRAL';
            elements.signalDisplay.className = '';
        }
    } else {
        elements.signalDisplay.textContent = '-';
        elements.signalDisplay.className = '';
    }
}

// Initialize the application
init();