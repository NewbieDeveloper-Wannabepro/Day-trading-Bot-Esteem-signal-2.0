// ======================
        // 1. CONFIGURATION
        // ======================
        const config = {
            finnhubApiKey: 'd0jb53pr01ql09hrbsp0d0jb53pr01ql09hrbspg',
            telegramBotToken: '7767613691:AAHogbBbDRVilKSUGx_YkVIYELKZNw74f_k',
            telegramChatId: '6469981362',
            alertCooldown: 30000, // 30 seconds
            rsiPeriod: 14,
            emaPeriod: 9,
            priceHistoryLength: 30
        };

        // ======================
        // 2. STATE MANAGEMENT
        // ======================
        let state = {
            socket: null,
            priceHistory: [],
            lastAlertTime: 0,
            currentPair: 'OANDA:EUR_USD',
            signalHistory: JSON.parse(localStorage.getItem('signalHistory')) || []
        };

        // ======================
        // 3. DOM ELEMENTS
        // ======================
        const elements = {
            currentPrice: document.getElementById('currentPrice'),
            signal: document.getElementById('signal'),
            rsiValue: document.getElementById('rsiValue'),
            ema9Value: document.getElementById('ema9Value'),
            connectionDot: document.getElementById('connectionDot'),
            connectionStatus: document.getElementById('connectionStatus'),
            pairName: document.getElementById('pairName'),
            currencyPair: document.getElementById('currencyPair'),
            signalLog: document.getElementById('signalLog'),
            lastUpdate: document.getElementById('lastUpdate'),
            buyBtn: document.getElementById('buyBtn'),
            sellBtn: document.getElementById('sellBtn'),
            testAlertBtn: document.getElementById('testAlertBtn'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn')
        };

        // ======================
        // 4. INITIALIZATION
        // ======================
        document.addEventListener('DOMContentLoaded', () => {
            // Load signal history
            renderSignalHistory();
            
            // Initialize WebSocket connection
            initWebSocket();
            
            // Set up event listeners
            setupEventListeners();
            
            // Request notification permissions
            Notification.requestPermission();
        });

        // ======================
        // 5. WEBSOCKET CONNECTION
        // ======================
        function initWebSocket() {
            if (state.socket) {
                state.socket.close();
            }

            state.socket = new WebSocket(`wss://ws.finnhub.io?token=${config.finnhubApiKey}`);
            state.priceHistory = [];

            state.socket.addEventListener('open', () => {
                updateConnectionStatus(true);
                subscribeToPair(state.currentPair);
            });

            state.socket.addEventListener('message', (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'trade') {
                    const latestPrice = data.data[0].p;
                    updatePrice(latestPrice);
                    elements.lastUpdate.textContent = new Date().toLocaleTimeString();
                }
            });

            state.socket.addEventListener('close', () => {
                updateConnectionStatus(false);
                setTimeout(initWebSocket, 5000); // Reconnect after 5 seconds
            });

            state.socket.addEventListener('error', (error) => {
                console.error('WebSocket error:', error);
                updateConnectionStatus(false);
            });
        }

        function subscribeToPair(pair) {
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                // Unsubscribe from current pair first
                if (state.currentPair) {
                    state.socket.send(JSON.stringify({
                        'type': 'unsubscribe',
                        'symbol': state.currentPair
                    }));
                }
                
                // Subscribe to new pair
                state.socket.send(JSON.stringify({
                    'type': 'subscribe',
                    'symbol': pair
                }));
                
                state.currentPair = pair;
                elements.pairName.textContent = pair.split(':')[1].replace('_', '/');
                state.priceHistory = [];
                resetIndicatorDisplays();
            }
        }

        function updateConnectionStatus(connected) {
            elements.connectionDot.classList.toggle('connected', connected);
            elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        }

        // ======================
        // 6. PRICE PROCESSING
        // ======================
        function updatePrice(price) {
            // Update UI
            elements.currentPrice.textContent = price.toFixed(5);
            
            // Store price history
            state.priceHistory.push(price);
            if (state.priceHistory.length > config.priceHistoryLength) {
                state.priceHistory.shift();
            }
            
            // Calculate indicators if we have enough data
            if (state.priceHistory.length > config.rsiPeriod) {
                const rsi = calculateRSI(state.priceHistory, config.rsiPeriod);
                const ema9 = calculateEMA(state.priceHistory, config.emaPeriod);
                
                // Update UI
                elements.rsiValue.textContent = rsi.toFixed(2);
                elements.ema9Value.textContent = ema9.toFixed(5);
                
                // Generate signals
                generateSignal(price, rsi, ema9);
            }
        }

        function resetIndicatorDisplays() {
            elements.currentPrice.textContent = '--.--';
            elements.rsiValue.textContent = '--.--';
            elements.ema9Value.textContent = '--.--';
            elements.signal.textContent = 'Waiting for data...';
            elements.signal.style.color = '';
        }

        // ======================
        // 7. TECHNICAL INDICATORS
        // ======================
        function calculateRSI(prices, period = 14) {
            if (prices.length < period + 1) return 50;
            
            let gains = 0;
            let losses = 0;
            
            for (let i = 1; i <= period; i++) {
                const diff = prices[i] - prices[i - 1];
                if (diff >= 0) gains += diff;
                else losses -= diff;
            }
            
            const avgGain = gains / period;
            const avgLoss = losses / period || 0.0001;
            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        }

        function calculateEMA(prices, period = 9) {
            const k = 2 / (period + 1);
            let ema = prices[0];
            
            for (let i = 1; i < prices.length; i++) {
                ema = prices[i] * k + ema * (1 - k);
            }
            
            return ema;
        }

        // ======================
        // 8. SIGNAL GENERATION
        // ======================
        function generateSignal(price, rsi, ema9) {
            const now = Date.now();
            const pairName = state.currentPair.split(':')[1].replace('_', '/');

            // BUY Signal (Oversold + Price > EMA9)
            if (rsi < 30 && price > ema9 && now - state.lastAlertTime > config.alertCooldown) {
                const message = `🚀 BUY ${pairName} (asset)\nPrice: ${price.toFixed(5)}\nRSI: ${rsi.toFixed(2)}\nEMA9: ${ema9.toFixed(5)}`;
                
                elements.signal.textContent = "BUY (CALL) Signal Detected!";
                elements.signal.style.color = "var(--buy-color)";
                
                sendTelegramAlert(message);
                addSignalToHistory('buy', pairName, price, rsi, ema9);
                state.lastAlertTime = now;
            }
            // SELL Signal (Overbought + Price < EMA9)
            else if (rsi > 70 && price < ema9 && now - state.lastAlertTime > config.alertCooldown) {
                const message = `🔻 SELL ${pairName} (asset)\nPrice: ${price.toFixed(5)}\nRSI: ${rsi.toFixed(2)}\nEMA9: ${ema9.toFixed(5)}`;
                
                elements.signal.textContent = "SELL (PUT) Signal Detected!";
                elements.signal.style.color = "var(--sell-color)";
                
                sendTelegramAlert(message);
                addSignalToHistory('sell', pairName, price, rsi, ema9);
                state.lastAlertTime = now;
            }
        }

        // ======================
        // 9. TELEGRAM ALERTS
        // ======================
        async function sendTelegramAlert(message) {
            const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage?chat_id=${config.telegramChatId}&text=${encodeURIComponent(message)}`;
            
            try {
                await fetch(url);
                console.log("Alert sent:", message);
            } catch (error) {
                console.error("Failed to send alert:", error);
            }
        }

        // ======================
        // 10. SIGNAL HISTORY
        // ======================
        function addSignalToHistory(type, pair, price, rsi, ema) {
            const signal = {
                type,
                pair,
                price,
                rsi,
                ema,
                timestamp: new Date().toISOString()
            };
            
            state.signalHistory.unshift(signal);
            if (state.signalHistory.length > 50) {
                state.signalHistory.pop();
            }
            
            localStorage.setItem('signalHistory', JSON.stringify(state.signalHistory));
            renderSignalHistory();
        }

        function renderSignalHistory() {
            elements.signalLog.innerHTML = '';
            
            if (state.signalHistory.length === 0) {
                elements.signalLog.innerHTML = '<div class="signal-item">No signals yet</div>';
                return;
            }
            
            state.signalHistory.forEach(signal => {
                const signalElement = document.createElement('div');
                signalElement.className = `signal-item signal-${signal.type}`;
                
                const time = new Date(signal.timestamp).toLocaleTimeString();
                const direction = signal.type === 'buy' ? 'BUY' : 'SELL';
                const color = signal.type === 'buy' ? 'var(--buy-color)' : 'var(--sell-color)';
                
                signalElement.innerHTML = `
                    <div>
                        <strong style="color: ${color}">${direction}</strong> ${signal.pair}
                        <div class="signal-time">${time}</div>
                    </div>
                    <div>
                        ${signal.price.toFixed(5)}<br>
                        <small>RSI: ${signal.rsi.toFixed(2)}</small>
                    </div>
                `;
                
                elements.signalLog.appendChild(signalElement);
            });
        }

        function clearSignalHistory() {
            state.signalHistory = [];
            localStorage.removeItem('signalHistory');
            renderSignalHistory();
        }

        // ======================
        // 11. EVENT LISTENERS
        // ======================
        function setupEventListeners() {
            // Currency pair selection
            elements.currencyPair.addEventListener('change', (e) => {
                subscribeToPair(e.target.value);
            });

            // Test alert button
            elements.testAlertBtn.addEventListener('click', () => {
                const pairName = state.currentPair.split(':')[1].replace('_', '/');
                sendTelegramAlert(`🔔 wake call trade ${pairName} - System is ready for signals-admin!`);
            });

            // Clear history button
            elements.clearHistoryBtn.addEventListener('click', clearSignalHistory);

            // Manual trade buttons (for demo purposes)
            elements.buyBtn.addEventListener('click', () => {
                const price = parseFloat(elements.currentPrice.textContent);
                if (!isNaN(price)) {
                    const rsi = parseFloat(elements.rsiValue.textContent);
                    const ema9 = parseFloat(elements.ema9Value.textContent);
                    const pairName = state.currentPair.split(':')[1].replace('_', '/');
                    
                    addSignalToHistory('buy', pairName, price, rsi || 50, ema9 || price);
                }
            });

            elements.sellBtn.addEventListener('click', () => {
                const price = parseFloat(elements.currentPrice.textContent);
                if (!isNaN(price)) {
                    const rsi = parseFloat(elements.rsiValue.textContent);
                    const ema9 = parseFloat(elements.ema9Value.textContent);
                    const pairName = state.currentPair.split(':')[1].replace('_', '/');
                    
                    addSignalToHistory('sell', pairName, price, rsi || 50, ema9 || price);
                }
            });
        }