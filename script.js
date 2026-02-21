// Toggle pause status for a period
function togglePausePeriod(dateStr) {
    const periods = getPeriodHistory();
    const updatedPeriods = periods.map(period => ({
        ...period,
        // Toggle pause status for the clicked period
        paused: period.date === dateStr ? !period.paused : period.paused
    }));
    savePeriodHistory(updatedPeriods);
}

// Get period history from localStorage
function getPeriodHistory() {
    const history = localStorage.getItem('periodHistory');
    const parsedHistory = history ? JSON.parse(history) : [];
    console.log('getPeriodHistory returned:', parsedHistory);
    return parsedHistory;
}

// Save period history to localStorage
function savePeriodHistory(periods) {
    // Sort periods by date (newest first)
    const sortedPeriods = [...periods].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
    localStorage.setItem('periodHistory', JSON.stringify(sortedPeriods));
    
    // Update the UI to reflect changes
    loadAndDisplayPeriods();
}

// Log a new period start date
function logPeriod() {
    console.log('logPeriod called');
    const periodDateInput = document.getElementById('periodDate');
    const dateStr = periodDateInput.value;
    console.log('Input date:', dateStr);
    
    if (!dateStr) {
        alert('Please select a date');
        return;
    }
    
    // Check if this date is already logged
    const periods = getPeriodHistory();
    if (periods.some(p => p.date === dateStr)) {
        alert('This date has already been logged');
        return;
    }
    
    // Add new period (not paused by default)
    periods.push({ 
        date: dateStr,
        paused: false
    });
    savePeriodHistory(periods);
    
    // Clear the input
    periodDateInput.value = '';
    
    // Update the UI
    loadAndDisplayPeriods();
    
    // Show success message
    const formattedDate = formatDate(new Date(dateStr));
    alert(`Period logged for ${formattedDate.full}`);
}

// Load periods and update the UI
function loadAndDisplayPeriods() {
    const periods = getPeriodHistory();
    updatePeriodHistoryUI(periods);
    updateStatistics(periods);
}

// Update the period history list
function updatePeriodHistoryUI(periods) {
    console.log('updatePeriodHistoryUI called with periods:', periods);
    const historyDiv = document.getElementById('periodHistory');
    
    if (!historyDiv) {
        console.error('Could not find periodHistory element');
        return;
    }
    
    if (periods.length === 0) {
        historyDiv.innerHTML = '<p>No periods logged yet</p>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedPeriods = [...periods].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
    
    // First pass: Calculate all cycle lengths
    const cycleData = [];
    for (let i = 0; i < sortedPeriods.length; i++) {
        const current = sortedPeriods[i];
        let cycleLength = '';
        
        // For all except the first period, calculate the cycle length from the previous period
        if (i > 0) {
            const prev = sortedPeriods[i - 1];
            // Subtract previous date from current date to get positive cycle length
            const daysBetween = Math.round((parseLocalDate(current.date) - parseLocalDate(prev.date)) / (1000 * 60 * 60 * 24));
            
            if (current.paused) {
                cycleLength = `<span class="cycle-length paused">Paused</span>`;
            } else if (prev.paused) {
                // Show the cycle length for the period after a pause
                cycleLength = `<span class="cycle-length">${Math.abs(daysBetween)}-day cycle</span>`;
            } else {
                cycleLength = `<span class="cycle-length">${Math.abs(daysBetween)}-day cycle</span>`;
            }
        }
        
        cycleData.push({
            date: current.date,
            cycleLength: cycleLength,
            paused: current.paused
        });
    }
    
    // Second pass: Build the HTML
    let html = '<div class="periods-list">';
    
    cycleData.forEach((data, index) => {
        const date = new Date(data.date);
        const formattedDate = formatDate(date);
        const cycleLength = index > 0 ? data.cycleLength : ''; // First period doesn't have a cycle length
        
        html += `
            <div class="period-entry ${data.paused ? 'paused-period' : ''}">
                <div class="period-info">
                    <label class="pause-toggle">
                        <input type="checkbox" 
                               onchange="togglePausePeriod('${data.date}')"
                               ${data.paused ? 'checked' : ''}>
                        <span class="pause-label">Pause</span>
                    </label>
                    <div class="date-container">
                        <div class="period-date">
                            <span class="full-date">${formattedDate.full}</span>
                            <span class="short-date">${formattedDate.short}</span>
                        </div>
                        <div class="cycle-length-container">${cycleLength}</div>
                    </div>
                </div>
                <button class="delete-btn" onclick="deletePeriod('${data.date}')" 
                        title="Delete this entry">
                    ×
                </button>
            </div>`;
    });
    
    html += '</div>';
    historyDiv.innerHTML = html;
    
    // Update statistics with the current period data
    updateStatistics(periods);
}

// Delete a specific period entry
function deletePeriod(dateStr) {
    if (confirm('Are you sure you want to delete this period entry?')) {
        const periods = getPeriodHistory();
        const updatedPeriods = periods.filter(period => period.date !== dateStr);
        savePeriodHistory(updatedPeriods);
    }
}

// Update the statistics section
function updateStatistics(periods) {
    const statsDiv = document.getElementById('stats');
    
    // Filter out only paused periods from calculations
    const validPeriods = periods.filter(period => !period.paused);
    
    if (validPeriods.length < 2) {
        statsDiv.innerHTML = `<p>Log at least 2 periods to see statistics (${periods.length} logged)`;
        return;
    }
    
    // Sort all periods chronologically (oldest first)
    const allPeriodsChronological = [...periods]
        .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
    
    // Calculate cycle lengths between consecutive non-paused periods
    const cycleLengths = [];
    let lastValidPeriod = null;
    
    for (const period of allPeriodsChronological) {
        if (period.paused) {
            // Reset the last valid period when we hit a paused period
            lastValidPeriod = null;
        } else {
            if (lastValidPeriod !== null) {
                // Calculate days since last valid period
                const current = parseLocalDate(period.date);
                const prev = parseLocalDate(lastValidPeriod.date);
                const diffDays = Math.round((current - prev) / (1000 * 60 * 60 * 24));
                cycleLengths.push(diffDays);
            }
            lastValidPeriod = period;
        }
    }
    
    if (cycleLengths.length < 1) {
        statsDiv.innerHTML = `<p>Log at least 2 non-paused periods to see statistics`;
        return;
    }
    
    // Get the last 12 cycles (or fewer if not enough data)
    const recentCycles = cycleLengths.slice(-12);
    
    // Calculate statistics based on recent cycles only
    // Total cycles is the number of period entries (not the number of cycles between them)
    const totalCycles = validPeriods.length;
    const shortestCycle = Math.min(...recentCycles);
    const longestCycle = Math.max(...recentCycles);
    // Calculate median cycle length of recent cycles
    const sortedCycles = [...recentCycles].sort((a, b) => a - b);
    const mid = Math.floor(sortedCycles.length / 2);
    const medianCycleLength = sortedCycles.length % 2 === 0
        ? Math.round((sortedCycles[mid - 1] + sortedCycles[mid]) / 2)
        : sortedCycles[mid];
    
    // Predict next period based on median cycle length of recent cycles
    const lastPeriodDate = parseLocalDate(validPeriods[0].date);
    const nextPeriod = new Date(lastPeriodDate);
    nextPeriod.setDate(lastPeriodDate.getDate() + medianCycleLength);
    
    // Calculate fertile window (based on recent shortest and longest cycles)
    const fertileStart = Math.max(1, shortestCycle - 18); // Start of fertile window
    const fertileEnd = Math.max(1, longestCycle - 11);    // End of fertile window
    
    // Calculate typical window using shortest cycle and median cycle
    const typicalWindowStart = Math.max(1, shortestCycle - 18);
    const typicalWindowEnd = Math.max(1, medianCycleLength - 11);
    
    // Calculate current day of cycle
    let daysInCurrentCycle = 'Paused';
    
    // Only calculate days if there are valid periods and the most recent period is not paused
    if (validPeriods.length > 0) {
        const mostRecentPeriod = [...periods].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))[0];
        if (!mostRecentPeriod.paused) {
            const today = new Date(); // Local time is default
            const lastPeriod = parseLocalDate(validPeriods[0].date);
            // Add 1 to make the first day of the cycle day 1 instead of day 0
            daysInCurrentCycle = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24)) + 1;
        }
    }
    
    // Update UI
    let html = `
        <div class="stat-item">
            <span class="stat-label">Total cycles tracked:</span>
            <span class="stat-value">${totalCycles}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Shortest cycle:</span>
            <span class="stat-value">${shortestCycle} days</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Longest cycle:</span>
            <span class="stat-value">${longestCycle} days</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Median cycle:</span>
            <span class="stat-value">${medianCycleLength} days</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Fertile window:</span>
            <span class="stat-value">Days ${fertileStart}-${fertileEnd}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Typical window:</span>
            <span class="stat-value">Days ${typicalWindowStart}-${typicalWindowEnd}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Current day of cycle:</span>
            <span class="stat-value">${daysInCurrentCycle}</span>
        </div>
    `;
    
    statsDiv.innerHTML = html;
    
    // Return the calculated values
    return {
        lastPeriod: lastPeriodDate,
        nextPeriod,
        fertileStart,
        fertileEnd,
        medianCycleLength
    };
}

// Export period data to CSV
function exportToCSV() {
    const periods = getPeriodHistory();
    if (periods.length === 0) {
        alert('No period data to export');
        return;
    }

    // Create CSV header
    let csvContent = 'Date,Paused\n';
    
    // Add data rows
    periods.forEach(period => {
        const date = new Date(period.date);
        const formattedDate = date.toISOString().split('T')[0];
        const paused = period.paused ? 'Yes' : 'No';
        csvContent += `${formattedDate},${paused}\n`;
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', `period-tracker-export-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Initialize the app when the DOM is loaded
function initApp() {
    console.log('Initializing app...');
    
    // Set default date to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const dateInput = document.getElementById('periodDate');
    if (dateInput) {
        dateInput.max = todayStr; // Prevent selecting future dates
        dateInput.value = todayStr;
    } else {
        console.error('Could not find periodDate input');
    }
    
    // Set up import file input
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', handleFileImport);
    } else {
        console.error('Could not find importFile input');
    }
    

    
    // Load and display period history
    loadAndDisplayPeriods();
    
    console.log('App initialized');
}

// Run the app when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Handle file import
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            const lines = csv.split('\n');
            
            // Skip empty lines and trim each line
            const nonEmptyLines = lines.filter(line => line.trim() !== '');
            if (nonEmptyLines.length === 0) {
                throw new Error('File is empty');
            }

            const headers = nonEmptyLines[0].split(',').map(h => h.trim().toLowerCase());
            
            // Check if CSV has the right format
            if (!headers.includes('date') || !headers.includes('paused')) {
                throw new Error('Invalid CSV format. Expected columns: Date, Paused');
            }

            const dateIndex = headers.indexOf('date');
            const pausedIndex = headers.indexOf('paused');
            const importedPeriods = [];
            const errors = [];
            
            // Start from index 1 to skip header
            for (let i = 1; i < nonEmptyLines.length; i++) {
                const line = nonEmptyLines[i].trim();
                if (!line) continue; // Skip empty lines
                
                const values = line.split(',');
                const date = values[dateIndex]?.trim();
                const paused = values[pausedIndex]?.trim().toLowerCase() === 'yes';
                
                if (date) {
                    // Parse and reformat the date to ensure consistency
                    let formattedDate = date;
                    try {
                        // Handle multiple date formats
                        let dateObj;
                        
                        // Try ISO format (YYYY-MM-DD)
                        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) {
                            const [year, month, day] = date.split('-').map(Number);
                            dateObj = new Date(year, month - 1, day);
                        } 
                        // Try DD/MM/YYYY or MM/DD/YYYY
                        else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(date)) {
                            const parts = date.split(/[\/\-]/);
                            // Try both MM/DD/YYYY and DD/MM/YYYY
                            const date1 = new Date(parts[2], parts[0] - 1, parts[1]);
                            const date2 = new Date(parts[2], parts[1] - 1, parts[0]);
                            // Use the one that makes sense (not invalid)
                            dateObj = !isNaN(date1.getTime()) ? date1 : date2;
                        } 
                        // Try other formats using Date.parse
                        else {
                            dateObj = new Date(date);
                        }
                        
                        if (isNaN(dateObj.getTime())) {
                            throw new Error('Invalid date format');
                        }
                        
                        // Format as YYYY-MM-DD
                        const year = dateObj.getFullYear();
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        formattedDate = `${year}-${month}-${day}`;
                        
                        importedPeriods.push({
                            date: formattedDate,
                            paused: paused
                        });
                    } catch (e) {
                        errors.push(`Line ${i+1}: Could not parse date "${date}"`);
                        console.warn(`Could not parse date: ${date}`, e);
                    }
                }
            }

            if (importedPeriods.length === 0 && errors.length === 0) {
                throw new Error('No valid period data found in the file');
            }

            let message = '';
            if (importedPeriods.length > 0) {
                message += `Found ${importedPeriods.length} valid period entries.\n\n`;
            }
            if (errors.length > 0) {
                message += `Found ${errors.length} errors during import:\n`;
                message += errors.slice(0, 5).join('\n');
                if (errors.length > 5) {
                    message += `\n...and ${errors.length - 5} more errors`;
                }
                message += '\n\nOnly the valid entries will be imported.';
            }

            if (confirm(`${message}\n\nDo you want to continue with the import?`)) {
                const existingPeriods = getPeriodHistory();
                // Merge with existing periods, keeping the newer version of duplicates
                const mergedPeriods = [...existingPeriods];
                
                importedPeriods.forEach(imported => {
                    const existingIndex = mergedPeriods.findIndex(p => p.date === imported.date);
                    if (existingIndex >= 0) {
                        mergedPeriods[existingIndex] = imported; // replace if exists
                    } else {
                        mergedPeriods.push(imported); // add if new
                    }
                });

                savePeriodHistory(mergedPeriods);
                loadAndDisplayPeriods(); // Refresh the display
                
                if (errors.length > 0) {
                    alert(`Import completed with ${errors.length} warnings. Check the console for details.`);
                } else {
                    alert('Import completed successfully!');
                }
            }
        } catch (error) {
            alert(`Error importing file: ${error.message}`);
            console.error('Import error:', error);
        }
        
        // Reset file input
        event.target.value = '';
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
        console.error('FileReader error');
    };
    
    reader.readAsText(file);
}

// ... (rest of the code remains the same)
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// Helper function to format dates in local timezone
function formatDate(date) {
    // Return both full and short date formats, both with full year
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const shortOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    return {
        full: date.toLocaleDateString('en-US', options),
        short: date.toLocaleDateString('en-US', shortOptions)
    };
}
