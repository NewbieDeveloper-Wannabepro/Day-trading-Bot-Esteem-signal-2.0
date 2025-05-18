// Mobile menu toggle functionality
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    mobileMenuButton.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!mobileMenu.contains(event.target) && event.target !== mobileMenuButton) {
        mobileMenu.classList.add('hidden');
      }
    });

    const form = document.getElementById('tradeForm');
    const journalBody = document.getElementById('journalBody');
    const clearBtn = document.getElementById('clearJournal');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const exportCSVBtn = document.getElementById('exportCSV');
    const previewNotesBtn = document.getElementById('previewNotes');
    const notesPreview = document.getElementById('notesPreview');
    
    let trades = JSON.parse(localStorage.getItem('trades')) || [];
    let filteredTrades = [...trades];
    
    // Chart instances
    let winLossChart, instrumentChart;

    // Initialize with current time
    const now = new Date();
    const timeString = now.toISOString().slice(0, 16);
    document.getElementById('time').value = timeString;

    // Calculate P&L for a trade
    function calculatePL(entry, exit, direction, size) {
      if (!size) return null;
      const pipDiff = direction === 'CALL' ? exit - entry : entry - exit;
      return (pipDiff * size * 10).toFixed(2); // Simplified forex P&L calculation
    }

    function saveTrades() {
      localStorage.setItem('trades', JSON.stringify(trades));
      applyFilters(); // Reapply filters after saving
    }

    function updateStats() {
      const totalTrades = filteredTrades.length;
      const wins = filteredTrades.filter(trade => trade.result === 'Win').length;
      const losses = totalTrades - wins;
      const winRate = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(1) : 0;
      
      const totalConfidence = filteredTrades.reduce((sum, trade) => sum + parseInt(trade.confidence || 0), 0);
      const avgConfidence = totalTrades > 0 ? (totalConfidence / totalTrades).toFixed(1) : 0;
      
      // Calculate total P&L
      const totalPL = filteredTrades.reduce((sum, trade) => {
        const pl = parseFloat(trade.pl) || 0;
        return sum + pl;
      }, 0).toFixed(2);
      
      // Find best confidence level
      const confidenceWinRates = [1,2,3,4,5].map(lvl => {
        const levelTrades = filteredTrades.filter(t => t.confidence == lvl);
        return levelTrades.length ? 
          (levelTrades.filter(t => t.result === 'Win').length / levelTrades.length) : 0;
      });
      const bestConfidence = confidenceWinRates.indexOf(Math.max(...confidenceWinRates)) + 1;
      
      // Update DOM
      document.getElementById('totalTrades').textContent = totalTrades;
      document.getElementById('winRate').textContent = `${winRate}%`;
      document.getElementById('avgConfidence').textContent = avgConfidence;
      document.getElementById('totalPL').textContent = `$${totalPL}`;
      document.getElementById('bestConfidence').textContent = bestConfidence > 0 ? `${bestConfidence} ★` : '-';
    }

    function renderCharts() {
      // Win/Loss Pie Chart
      const winLossCtx = document.getElementById('winLossChart').getContext('2d');
      const wins = filteredTrades.filter(trade => trade.result === 'Win').length;
      const losses = filteredTrades.length - wins;
      
      if (winLossChart) winLossChart.destroy();
      
      winLossChart = new Chart(winLossCtx, {
        type: 'pie',
        data: {
          labels: ['Wins', 'Losses'],
          datasets: [{
            data: [wins, losses],
            backgroundColor: ['#4ade80', '#f87171'],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
      
      // Performance by Instrument Chart
      const instrumentCtx = document.getElementById('instrumentChart').getContext('2d');
      const instruments = [...new Set(filteredTrades.map(trade => trade.instrument))];
      
      const instrumentData = instruments.map(instrument => {
        const instrumentTrades = filteredTrades.filter(t => t.instrument === instrument);
        const wins = instrumentTrades.filter(t => t.result === 'Win').length;
        const total = instrumentTrades.length;
        return {
          instrument,
          winRate: total > 0 ? (wins / total * 100) : 0,
          totalTrades: total
        };
      });
      
      if (instrumentChart) instrumentChart.destroy();
      
      instrumentChart = new Chart(instrumentCtx, {
        type: 'bar',
        data: {
          labels: instrumentData.map(d => d.instrument),
          datasets: [{
            label: 'Win Rate %',
            data: instrumentData.map(d => d.winRate),
            backgroundColor: '#60a5fa',
            borderColor: '#3b82f6',
            borderWidth: 1
          }, {
            label: 'Total Trades',
            data: instrumentData.map(d => d.totalTrades),
            backgroundColor: '#a78bfa',
            borderColor: '#8b5cf6',
            borderWidth: 1,
            type: 'line',
            yAxisID: 'y1'
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Win Rate %'
              }
            },
            y1: {
              position: 'right',
              beginAtZero: true,
              title: {
                display: true,
                text: 'Total Trades'
              },
              grid: {
                drawOnChartArea: false
              }
            },
            x: {
              title: {
                display: true,
                text: 'Instrument'
              }
            }
          }
        }
      });
    }

    function renderJournal() {
      journalBody.innerHTML = '';
      filteredTrades.forEach((trade, index) => {
        const originalIndex = trades.findIndex(t => 
          t.time === trade.time && 
          t.instrument === trade.instrument &&
          t.entryPrice === trade.entryPrice
        );
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="p-2 border">${trade.instrument}</td>
          <td class="p-2 border">${formatDateTime(trade.time)}</td>
          <td class="p-2 border">${trade.direction}</td>
          <td class="p-2 border">${trade.entryPrice}</td>
          <td class="p-2 border">${trade.expiryPrice}</td>
          <td class="p-2 border">${trade.positionSize ? '$' + trade.positionSize : '-'}</td>
          <td class="p-2 border ${trade.pl > 0 ? 'text-green-600' : trade.pl < 0 ? 'text-red-600' : ''}">
            ${trade.pl ? '$' + parseFloat(trade.pl).toFixed(2) : '-'}
          </td>
          <td class="p-2 border ${trade.result === 'Win' ? 'text-green-600' : 'text-red-600'}">${trade.result}</td>
          <td class="p-2 border">${trade.reason}</td>
          <td class="p-2 border">${'★'.repeat(trade.confidence)}</td>
          <td class="p-2 border max-w-[200px] truncate">${trade.notes ? marked.parse(trade.notes.replace(/\n/g, ' ')) : ''}</td>
          <td class="p-2 border text-center">
            <button onclick="deleteTrade(${originalIndex})" class="text-red-500 hover:underline">Delete</button>
          </td>
        `;
        journalBody.appendChild(row);
      });
      updateStats();
      renderCharts();
    }

    function formatDateTime(dateTimeStr) {
      if (!dateTimeStr) return '';
      const date = new Date(dateTimeStr);
      return isNaN(date.getTime()) ? dateTimeStr : date.toLocaleString();
    }

    function applyFilters() {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      const resultFilter = document.getElementById('resultFilter').value;
      const confidenceFilter = parseInt(document.getElementById('confidenceFilter').value);
      const instrumentFilter = document.getElementById('instrumentFilter').value;
      
      filteredTrades = trades.filter(trade => {
        // Instrument filter
        if (instrumentFilter !== 'All' && trade.instrument !== instrumentFilter) return false;
        
        // Date filter
        if (startDate || endDate) {
          const tradeDate = new Date(trade.time).setHours(0, 0, 0, 0);
          const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : -Infinity;
          const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
          
          if (tradeDate < start || tradeDate > end) return false;
        }
        
        // Result filter
        if (resultFilter !== 'All' && trade.result !== resultFilter) return false;
        
        // Confidence filter
        if (confidenceFilter > 0 && parseInt(trade.confidence) !== confidenceFilter) return false;
        
        return true;
      });
      
      renderJournal();
    }

    function resetFilters() {
      document.getElementById('startDate').value = '';
      document.getElementById('endDate').value = '';
      document.getElementById('resultFilter').value = 'All';
      document.getElementById('confidenceFilter').value = '0';
      document.getElementById('instrumentFilter').value = 'All';
      filteredTrades = [...trades];
      renderJournal();
    }

    function exportToCSV() {
      if (filteredTrades.length === 0) {
        alert('No trades to export');
        return;
      }
      
      // Prepare CSV header
      const headers = [
        'Instrument', 'Time', 'Direction', 'Entry Price', 'Expiry Price',
        'Position Size', 'P&L', 'Result', 'Reason', 'Confidence', 'Notes'
      ];
      
      // Prepare CSV data
      const csvRows = [];
      csvRows.push(headers.join(','));
      
      filteredTrades.forEach(trade => {
        const row = [
          `"${trade.instrument}"`,
          `"${formatDateTime(trade.time)}"`,
          `"${trade.direction}"`,
          trade.entryPrice,
          trade.expiryPrice,
          trade.positionSize || '',
          trade.pl || '',
          `"${trade.result}"`,
          `"${trade.reason || ''}"`,
          trade.confidence,
          `"${trade.notes || ''}"`
        ];
        csvRows.push(row.join(','));
      });
      
      // Create CSV file
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `trading_journal_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const pl = calculatePL(
        parseFloat(form.entryPrice.value),
        parseFloat(form.expiryPrice.value),
        form.direction.value,
        parseFloat(form.positionSize.value)
      );
      
      const newTrade = {
        instrument: form.instrument.value,
        time: form.time.value,
        direction: form.direction.value,
        entryPrice: form.entryPrice.value,
        expiryPrice: form.expiryPrice.value,
        positionSize: form.positionSize.value,
        pl: pl,
        result: form.result.value,
        reason: form.reason.value,
        confidence: form.confidence.value,
        notes: form.notes.value
      };
      
      trades.push(newTrade);
      saveTrades();
      form.reset();
      // Reset time to now
      const now = new Date();
      const timeString = now.toISOString().slice(0, 16);
      form.time.value = timeString;
    });

    function deleteTrade(index) {
      trades.splice(index, 1);
      saveTrades();
    }

    previewNotesBtn.addEventListener('click', () => {
      const notes = document.getElementById('notes').value;
      if (notes) {
        notesPreview.innerHTML = marked.parse(notes);
        notesPreview.classList.toggle('hidden');
      }
    });

    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all trades?')) {
        trades = [];
        saveTrades();
      }
    });

    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    exportCSVBtn.addEventListener('click', exportToCSV);

    // Initialize
    renderJournal();