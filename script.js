document.addEventListener('DOMContentLoaded', function() {
   
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const voiceInputButton = document.getElementById('voice-input');
    const voiceFeedback = document.getElementById('voice-feedback');
    const typoSuggestion = document.getElementById('typo-suggestion');
    const resultsContainer = document.getElementById('results-container');
    const injuryTitle = document.getElementById('injury-title');
    const remedyContent = document.getElementById('remedy-content');
    const noResults = document.getElementById('no-results');
    const suggestionList = document.getElementById('suggestion-list');

    let firstAidData = [];
    let dataLoaded = false;
    
    fetchFirstAidData();
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    voiceInputButton.addEventListener('click', startVoiceInput);
    suggestedTerm.addEventListener('click', function() {
        searchInput.value = suggestedTerm.textContent;
        performSearch();
    });
    
    function populateSuggestionList() {
        suggestionList.innerHTML = '';
        const randomSuggestions = getRandomItems(firstAidData, 5);
        
        randomSuggestions.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.injury;
            li.addEventListener('click', function() {
                searchInput.value = item.injury;
                performSearch();
            });
            suggestionList.appendChild(li);
        });
    }
  
    function fetchFirstAidData() {
        // Use hardcoded data as a fallback
        if (typeof firstAidData === 'undefined' || firstAidData.length === 0) {
            console.log("Using hardcoded data from data.json");
            // Parse the data directly from the JSON string
            try {
                firstAidData = JSON.parse(document.querySelector('script[data-json="first-aid-data"]').textContent);
                dataLoaded = true;
                populateSuggestionList();
                console.log("Data loaded successfully:", firstAidData.length + " items");
            } catch (e) {
                console.error("Failed to load hardcoded data:", e);
                showDataLoadError();
            }
        } else {
            // Try fetch first
            fetch('data.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    firstAidData = data;
                    dataLoaded = true;
                    populateSuggestionList();
                    console.log("Data fetched successfully:", firstAidData.length + " items");
                })
                .catch(error => {
                    console.error('Error loading first aid data:', error);
                    
                    // Try to load the data from the HTML as a fallback
                    try {
                        if (document.querySelector('script[data-json="first-aid-data"]')) {
                            firstAidData = JSON.parse(document.querySelector('script[data-json="first-aid-data"]').textContent);
                            dataLoaded = true;
                            populateSuggestionList();
                            console.log("Fallback data loaded successfully");
                        } else {
                            showDataLoadError();
                        }
                    } catch (e) {
                        console.error("Failed to load fallback data:", e);
                        showDataLoadError();
                    }
                });
        }
    }
    
    function showDataLoadError() {
        noResults.innerHTML = `
            <h2>Data Loading Error</h2>
            <p>Unable to load first aid data. Please check your connection and reload the page.</p>
        `;
        noResults.classList.remove('hidden');
    }
    
    // Normalize text by removing common words and standardizing format
    function normalizeText(text) {
        return text.toLowerCase()
            .replace(/\s+/g, ' ') // Normalize spaces
            .replace(/\b(my|the|a|an|and|or|in|on|for|of|from|with|due|to|by)\b/g, '') // Remove common words
            .trim();
    }

    // Extract meaningful words from a query
    function extractKeyTerms(text) {
        const normalized = normalizeText(text);
        
        // Split into words and filter out very short words
        return normalized.split(' ')
            .filter(word => word.length > 2)
            .map(word => {
                // Handle common forms
                if (word.endsWith('ing')) return word.slice(0, -3);
                if (word.endsWith('ed')) return word.slice(0, -2);
                if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
                return word;
            });
    }
    
    // Calculate semantic similarity between query and an injury
    function calculateSimilarity(query, injury) {
        const queryTerms = extractKeyTerms(query);
        if (queryTerms.length === 0) return 0;
        
        // Create a combined text from injury name and all its keywords
        const injuryText = normalizeText(injury.injury + ' ' + injury.keywords.join(' '));
        
        // Count how many query terms appear in the injury text
        let matchCount = 0;
        for (const term of queryTerms) {
            if (injuryText.includes(term)) {
                matchCount++;
            } else {
                // Check for partial matches for longer terms
                if (term.length > 4) {
                    for (const part of injuryText.split(' ')) {
                        // Check if term is a substring of injury term or vice versa
                        if (term.includes(part) || part.includes(term)) {
                            matchCount += 0.5; // Partial match
                            break;
                        }
                    }
                }
            }
        }
        
        // Calculate similarity score (0 to 1)
        return matchCount / queryTerms.length;
    }
    
    // Find potential matches based on semantic similarity
    function findPotentialMatches(query) {
        if (!query || query.trim() === '') return [];
        
        // Calculate similarity scores for all injuries
        const scoredMatches = firstAidData.map(injury => ({
            injury: injury,
            score: calculateSimilarity(query, injury)
        }));
        
        // Sort by similarity score (highest first)
        scoredMatches.sort((a, b) => b.score - a.score);
        
        // Return injuries with reasonable similarity
        return scoredMatches
            .filter(match => match.score > 0.25) // At least 25% similarity
            .map(match => match.injury);
    }
    
    function performSearch() {
        const query = searchInput.value.trim();
        
        // Check if data is loaded
        if (!dataLoaded || firstAidData.length === 0) {
            noResults.innerHTML = `
                <h2>Data Not Loaded</h2>
                <p>First aid information is still loading or failed to load. Please try again in a moment.</p>
            `;
            noResults.classList.remove('hidden');
            return;
        }
        
        if (query === '') {
            showNoResults();
            return;
        }

        hideAllResults();
        
        // Debug log
        console.log("Searching for:", query, "in", firstAidData.length, "items");
        
        // Check for exact matches first
        const exactMatch = firstAidData.find(item => 
            item.injury.toLowerCase() === query.toLowerCase()
        );
        
        if (exactMatch) {
            console.log("Found exact match:", exactMatch.injury);
            displayResult(exactMatch);
            return;
        }
        
        // Check for direct keyword matches
        const keywordMatches = firstAidData.filter(item => 
            item.keywords.some(keyword => 
                query.toLowerCase().includes(keyword.toLowerCase())
            )
        );
        
        if (keywordMatches.length > 0) {
            console.log("Found keyword match:", keywordMatches[0].injury);
            displayResult(keywordMatches[0]);
            return;
        }
        
        // Find potential semantic matches
        const potentialMatches = findPotentialMatches(query);
        
        if (potentialMatches.length > 0) {
            // Use the best match (first in array after sorting by score)
            console.log("Found semantic match:", potentialMatches[0].injury);
            displayResult(potentialMatches[0]);
            return;
        }
        
        // Last resort: Levenshtein distance for typos
        const closestMatch = findClosestMatch(query);
        if (closestMatch) {
            console.log("Found closest match:", closestMatch.injury);
            suggestedTerm.textContent = closestMatch.injury;
            typoSuggestion.classList.remove('hidden');
            noResults.classList.remove('hidden');
        } else {
            console.log("No matches found");
            showNoResults();
        }
    }

    function displayResult(result) {
        injuryTitle.textContent = result.injury;
        remedyContent.innerHTML = result.remedy;
        resultsContainer.classList.remove('hidden');
    }
    
    function showNoResults() {
        noResults.classList.remove('hidden');
    }
   
    function hideAllResults() {
        resultsContainer.classList.add('hidden');
        noResults.classList.add('hidden');
        typoSuggestion.classList.add('hidden');
    }
    
    function findClosestMatch(query) {
        let closestMatch = null;
        let minDistance = Infinity;
        
        firstAidData.forEach(item => {
            const distance = levenshteinDistance(query.toLowerCase(), item.injury.toLowerCase());
            
            if (distance < minDistance && distance <= Math.max(2, Math.floor(query.length / 3))) {
                minDistance = distance;
                closestMatch = item;
            }
            
            item.keywords.forEach(keyword => {
                const keywordDistance = levenshteinDistance(query.toLowerCase(), keyword.toLowerCase());
                if (keywordDistance < minDistance && keywordDistance <= Math.max(2, Math.floor(query.length / 3))) {
                    minDistance = keywordDistance;
                    closestMatch = item;
                }
            });
        });
        
        return closestMatch;
    }
    
    function levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        
        // Initialize matrix
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        // Fill matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      
                    matrix[i][j - 1] + 1,      
                    matrix[i - 1][j - 1] + cost 
                );
            }
        }
        
        return matrix[b.length][a.length];
    }
    
    function startVoiceInput() {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Voice recognition is not supported in your browser. Try Chrome or Edge.');
            return;
        }
        
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = function() {
            voiceFeedback.classList.remove('hidden');
            voiceInputButton.classList.add('listening');
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            searchInput.value = transcript;
            voiceFeedback.classList.add('hidden');
            voiceInputButton.classList.remove('listening');
            performSearch();
        };
        
        recognition.onerror = function(event) {
            voiceFeedback.classList.add('hidden');
            voiceInputButton.classList.remove('listening');
            console.error('Speech recognition error:', event.error);
        };
        
        recognition.onend = function() {
            voiceFeedback.classList.add('hidden');
            voiceInputButton.classList.remove('listening');
        };
        
        recognition.start();
    }
    
    function getRandomItems(array, count) {
        if (!array || array.length === 0) return [];
        count = Math.min(count, array.length);
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
});