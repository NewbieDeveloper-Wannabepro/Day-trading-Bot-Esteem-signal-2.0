/// 1. ENHANCED CONFIGURATION
const config = {
    finnhubApiKey: 'd0kh4ohr01qn937kqp2gd0kh4ohr01qn937kqp30',
    telegramBotToken: '7610946823:AAEXmOV-Md2FkR3HMmqno4hyRsfoulA1MYM', 
    telegramChatId: '6469981362', 
    emaPeriod: 9,
    rsiPeriod: 14,
    macdConfig: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
    },
    overbought: 70,
    oversold: 30,
    maxHistorySize: 100,
    initialHistoryCount: 50  // Number of historical data points to load initially
};

// 2. OPTIMIZED STATE MANAGEMENT
let state = {
    isConnected: false,
    isRunning: false,
    priceHistory: [],
    indicators: {
        rsi: null,
        prevGain: null,
        prevLoss: null,
        ema9: null,
        macd: {
            macdLine: null,
            signalLine: null,
            histogram: null,
            fastEMA: null,
            slowEMA: null,
            signalEMA: null,
            macdValues: []
        }
    },
    currentPrice: null,
    socket: null,
    currentPair: 'OANDA:EUR_USD',
    lastProcessTime: null
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
    historyList: document.getElementById('history-list'),
    statusDisplay: document.getElementById('connection-status')
};

// 4. INITIALIZATION
async function init() {
    loadHistory();
    setupEventListeners();
    // Pre-load some historical data when page loads
    await loadInitialHistoricalData();
}

async function loadInitialHistoricalData() {
    try {
        const history = await fetchHistoricalData(state.currentPair, config.initialHistoryCount);
        if (history.length > 0) {
            state.priceHistory = history;
            calculateIndicators(); // Pre-calculate indicators
            updateIndicatorsDisplay();
            updateUI();
            console.log(`Pre-loaded ${history.length} historical data points`);
        }
    } catch (error) {
        console.error("Error loading initial history:", error);
    }
}

// 5. HISTORICAL DATA LOADING
async function fetchHistoricalData(symbol, count) {
    const resolution = '15'; // 15-minute intervals (can be changed to D for daily, etc.)
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&count=${count}&token=${config.finnhubApiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.c && data.c.length > 0) {
            return data.c; // array of closing prices
        }
        return [];
    } catch (error) {
        console.error("Error fetching history:", error);
        return [];
    }
}

// 6. WEBSOCKET CONNECTION (Optimized)
async function connectWebSocket() {
    if (state.socket) {
        state.socket.close();
    }
    
    state.currentPair = elements.pairSelect.value;
    
    if (!config.finnhubApiKey) {
        console.error('Finnhub API key not configured');
        updateStatus('Error: API key missing');
        return;
    }
    
    // Show loading status
    updateStatus('Loading historical data...');
    
    try {
        // Load additional history if needed
        if (state.priceHistory.length < config.initialHistoryCount) {
            const additionalNeeded = config.initialHistoryCount - state.priceHistory.length;
            const additionalHistory = await fetchHistoricalData(state.currentPair, additionalNeeded);
            state.priceHistory = [...additionalHistory, ...state.priceHistory].slice(-config.maxHistorySize);
        }
        
        updateStatus('Connecting to WebSocket...');
        
        state.socket = new WebSocket(`wss://ws.finnhub.io?token=${config.finnhubApiKey}`);
        
        state.socket.onopen = () => {
            state.isConnected = true;
            updateUI();
            subscribeToPair(state.currentPair);
            updateStatus('Connected - Waiting for data...');
            console.log('WebSocket connected');
        };
        
        state.socket.onclose = () => {
            state.isConnected = false;
            state.isRunning = false;
            updateUI();
            updateStatus('Disconnected');
            console.log('WebSocket disconnected');
        };
        
        state.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateStatus(`Error: ${error.message}`);
        };
        
        state.socket.onmessage = (message) => {
            const data = JSON.parse(message.data);
            if (data.type === 'trade' && data.data && data.data[0]) {
                // Throttle processing to avoid overwhelming the system
                if (!state.lastProcessTime || Date.now() - state.lastProcessTime > 100) {
                    state.lastProcessTime = Date.now();
                    processPriceData(data.data[0].p);
                    updateStatus('Connected - Receiving data');
                }
            }
        };
    } catch (error) {
        console.error("Connection error:", error);
        updateStatus(`Error: ${error.message}`);
    }
}

function updateStatus(message) {
    if (elements.statusDisplay) {
        elements.statusDisplay.textContent = message;
    }
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

// 7. OPTIMIZED PRICE PROCESSING
function processPriceData(price) {
    requestAnimationFrame(() => {
        state.currentPrice = price;
        
        // Update price history efficiently
        state.priceHistory.push(price);
        if (state.priceHistory.length > config.maxHistorySize) {
            state.priceHistory = state.priceHistory.slice(-config.maxHistorySize);
        }
        
        updatePriceDisplay();
        calculateIndicators();
    });
}

function updatePriceDisplay() {
    elements.currentPriceDisplay.textContent = state.currentPrice.toFixed(5);
}

// 8. OPTIMIZED TECHNICAL INDICATORS
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
    
    // Initial calculation
    if (state.indicators.prevGain === null || state.indicators.prevLoss === null) {
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
        
        state.indicators.prevGain = gains / period;
        state.indicators.prevLoss = losses / period;
    } 
    // Incremental update
    else {
        const change = state.priceHistory[state.priceHistory.length - 1] - 
                      state.priceHistory[state.priceHistory.length - 2];
        
        const currentGain = change > 0 ? change : 0;
        const currentLoss = change < 0 ? -change : 0;
        
        // Smooth the averages
        state.indicators.prevGain = ((state.indicators.prevGain * (period - 1)) + currentGain) / period;
        state.indicators.prevLoss = ((state.indicators.prevLoss * (period - 1)) + currentLoss) / period;
    }
    
    const rs = state.indicators.prevLoss === 0 ? Infinity : 
               (state.indicators.prevGain / state.indicators.prevLoss);
    state.indicators.rsi = 100 - (100 / (1 + rs));
}

function calculateEMA() {
    const period = config.emaPeriod;
    if (state.priceHistory.length < period) return;
    
    if (state.indicators.ema9 === null) {
        // Initial SMA calculation
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += state.priceHistory[state.priceHistory.length - period + i];
        }
        state.indicators.ema9 = sum / period;
    } else {
        // Incremental EMA update
        const multiplier = 2 / (period + 1);
        state.indicators.ema9 = (state.currentPrice - state.indicators.ema9) * multiplier + state.indicators.ema9;
    }
}

// OPTIMIZED MACD CALCULATION
function calculateMACD() {
    const { fastPeriod, slowPeriod, signalPeriod } = config.macdConfig;
    
    // Initialize EMAs if needed
    if (state.indicators.macd.fastEMA === null && state.priceHistory.length >= fastPeriod) {
        initEMAs();
    }
    
    // Update EMAs incrementally if initialized
    if (state.indicators.macd.fastEMA !== null) {
        updateEMAs();
    }
    
    // Calculate MACD components if we have enough data
    if (state.indicators.macd.fastEMA !== null && 
        state.indicators.macd.slowEMA !== null) {
        
        const macdLine = state.indicators.macd.fastEMA - state.indicators.macd.slowEMA;
        
        // Handle signal line
        if (state.indicators.macd.signalEMA === null) {
            initSignalLine(macdLine);
        } else {
            updateSignalLine(macdLine);
        }
        
        // Only update final values when we have complete data
        if (state.indicators.macd.signalEMA !== null) {
            state.indicators.macd.macdLine = macdLine;
            state.indicators.macd.signalLine = state.indicators.macd.signalEMA;
            state.indicators.macd.histogram = macdLine - state.indicators.macd.signalLine;
        }
    }
}

function initEMAs() {
    // Fast EMA (12-period)
    let sum = 0;
    const fastPeriod = config.macdConfig.fastPeriod;
    for (let i = 0; i < fastPeriod; i++) {
        sum += state.priceHistory[state.priceHistory.length - fastPeriod + i];
    }
    state.indicators.macd.fastEMA = sum / fastPeriod;
    
    // Slow EMA (26-period)
    sum = 0;
    const slowPeriod = config.macdConfig.slowPeriod;
    for (let i = 0; i < slowPeriod; i++) {
        sum += state.priceHistory[state.priceHistory.length - slowPeriod + i];
    }
    state.indicators.macd.slowEMA = sum / slowPeriod;
}

function updateEMAs() {
    const fastMultiplier = 2 / (config.macdConfig.fastPeriod + 1);
    const slowMultiplier = 2 / (config.macdConfig.slowPeriod + 1);
    
    state.indicators.macd.fastEMA = 
        (state.currentPrice - state.indicators.macd.fastEMA) * fastMultiplier + state.indicators.macd.fastEMA;
    
    state.indicators.macd.slowEMA = 
        (state.currentPrice - state.indicators.macd.slowEMA) * slowMultiplier + state.indicators.macd.slowEMA;
}

function initSignalLine(currentMACD) {
    state.indicators.macd.macdValues.push(currentMACD);
    
    if (state.indicators.macd.macdValues.length >= config.macdConfig.signalPeriod) {
        let sum = 0;
        for (let i = 0; i < config.macdConfig.signalPeriod; i++) {
            sum += state.indicators.macd.macdValues[i];
        }
        state.indicators.macd.signalEMA = sum / config.macdConfig.signalPeriod;
    }
}

function updateSignalLine(currentMACD) {
    const signalMultiplier = 2 / (config.macdConfig.signalPeriod + 1);
    state.indicators.macd.signalEMA = 
        (currentMACD - state.indicators.macd.signalEMA) * signalMultiplier + state.indicators.macd.signalEMA;
}

// 9. SIGNAL GENERATION
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

// 10. TELEGRAM ALERTS
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

// 11. SIGNAL HISTORY
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

// 12. EVENT LISTENERS
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
        updateStatus(state.isRunning ? 'Bot running - Monitoring signals' : 'Bot paused');
    });
    
    elements.pairSelect.addEventListener('change', () => {
        if (state.isConnected) {
            unsubscribeFromPair(state.currentPair);
            state.currentPair = elements.pairSelect.value;
            subscribeToPair(state.currentPair);
            updateStatus(`Switched to ${state.currentPair}`);
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
