document.addEventListener('DOMContentLoaded', function() {
    // Form submission handling
    const analysisForm = document.getElementById('analysis-form');
    const submitBtn = document.getElementById('submit-btn');
    const loadingIndicator = document.getElementById('loading');
    
    // Main tab navigation
    const navLinks = document.querySelectorAll('.nav-tabs-link');
    const mainTabContent = document.querySelectorAll('.main-tab-content');
    
    // Chatbot elements
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const chatbotTopicButtons = document.getElementById('chatbot-topic-buttons');
    
    // Sentiment filter, search and pagination
    const sentimentFilter = document.getElementById('sentiment-filter');
    const tweetSearch = document.getElementById('tweet-search');
    const itemsPerPage = document.getElementById('items-per-page');
    const paginationContainer = document.getElementById('pagination-container');

    const downloadReportBtn = document.getElementById('download-report-btn');
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', function(e) {
            // Cek apakah sudah ada analisis yang dilakukan
            if (!analysisResults) {
                e.preventDefault();
                showAlert('Silakan upload dan analisis data terlebih dahulu sebelum mengunduh laporan.', 'warning');
            } else {
                // Tambahkan loading state selama proses download
                this.innerHTML = `
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    Menyiapkan Laporan...
                `;
                
                // Kembalikan tampilan semula setelah beberapa saat
                setTimeout(() => {
                    this.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Unduh Report
                    `;
                }, 3000);
            }
        });
    }
    
    // Global variables
    let allTweets = [];
    let currentPage = 1;
    let tweetsPerPage = 10;
    let filteredTweets = [];
    let searchQuery = '';
    let analysisResults = null;
    
    // Chart instances to allow for updates
    let sentimentByHashtagChart = null;
    let sentimentByLocationChart = null;
    let sentimentByLanguageChart = null;
    let sentimentTrendChart = null;
    let positiveWordsChart = null;
    let neutralWordsChart = null;
    let negativeWordsChart = null;
    
    // Initialize Charts.js with global defaults
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#333333';
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 6;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        Chart.defaults.animation.duration = 1000;
        Chart.defaults.animation.easing = 'easeOutQuart';
    }
    
    // Main tab navigation handling
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Jika tab dinonaktifkan, tampilkan peringatan dan hentikan
            if (this.classList.contains('disabled')) {
                showAlert('Silakan upload dan analisis data terlebih dahulu', 'warning');
                return;
            }
            
            const targetId = this.getAttribute('data-tab');
            
            // Remove active class from all links and content
            navLinks.forEach(l => l.classList.remove('active'));
            mainTabContent.forEach(c => {
                if (c) {
                    c.classList.remove('active');
                    c.classList.add('d-none');
                }
            });
            
            // Add active class to clicked link and show corresponding content
            this.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.classList.remove('d-none');
            }
        });
    });
    
    // Analysis form submission
    if (analysisForm) {
        analysisForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Show loading indicator and disable submit button
            if (loadingIndicator) loadingIndicator.classList.remove('d-none');
            if (submitBtn) submitBtn.disabled = true;
            
            // Get form data
            const formData = new FormData();
            const titleInput = document.getElementById('title');
            const csvFileInput = document.getElementById('csv-file');
            
            if (titleInput) formData.append('title', titleInput.value);
            formData.append('description', ''); // Removed description field
            if (csvFileInput && csvFileInput.files[0]) formData.append('csv-file', csvFileInput.files[0]);
            
            // Send to server
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator and enable submit button
                if (loadingIndicator) loadingIndicator.classList.add('d-none');
                if (submitBtn) submitBtn.disabled = false;
                
                if (data.error) {
                    showAlert('Error: ' + data.error, 'danger');
                    return;
                }
                
                // Store global analysis results
                analysisResults = data;
                allTweets = data.tweets;
                
                // Show results and evaluation sections
                const resultsElement = document.getElementById('results');
                const evaluationElement = document.getElementById('evaluation');
                
                if (resultsElement) {
                    resultsElement.classList.remove('d-none');
                    resultsElement.classList.add('active');
                }
                
                if (evaluationElement) {
                    evaluationElement.classList.remove('d-none');
                }
                
                // Enable previously disabled tabs
                const resultsTab = document.querySelector('[data-tab="results"]');
                const evaluationTab = document.querySelector('[data-tab="evaluation"]');
                const downloadReportBtn = document.getElementById('download-report-btn');
                
                if (resultsTab) resultsTab.classList.remove('disabled');
                if (evaluationTab) evaluationTab.classList.remove('disabled');
                if (downloadReportBtn) downloadReportBtn.classList.remove('disabled');
                
                // Update navigation
                navLinks.forEach(l => {
                    if (l) l.classList.remove('active');
                });
                
                if (resultsTab) resultsTab.classList.add('active');
                
                // Update UI with analysis results
                updateAnalysisResults(data);
                
                // Initialize pagination
                initializePagination();
                
                // Generate topics automatically using the analysis results
                generateTopics(data);
                
                // Create word cloud (now in Analisis Kata tab)
                createImprovedWordCloud(data);
            })
            .catch(error => {
                if (loadingIndicator) loadingIndicator.classList.add('d-none');
                if (submitBtn) submitBtn.disabled = false;
                showAlert('Error: ' + error.message, 'danger');
            });
        });
    }
    
    // Chatbot send message
    if (chatbotSend && chatbotInput) {
        chatbotSend.addEventListener('click', sendChatbotMessage);
        chatbotInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatbotMessage();
            }
        });
    }
    
    // Topic button click
    if (chatbotTopicButtons) {
        chatbotTopicButtons.addEventListener('click', function(e) {
            if (e.target.classList.contains('topic-button') || e.target.closest('.topic-button')) {
                const topicButton = e.target.classList.contains('topic-button') ? e.target : e.target.closest('.topic-button');
                const topic = topicButton.getAttribute('data-topic') || topicButton.textContent.trim();
                if (chatbotInput) {
                    chatbotInput.value = `Berikan evaluasi kebijakan terkait ${topic}`;
                    sendChatbotMessage();
                }
            }
        });
    }
    
    // Sentiment filter change
    if (sentimentFilter) {
        sentimentFilter.addEventListener('change', function() {
            currentPage = 1;
            filterAndDisplayTweets();
        });
    }
    
    // Tweet search functionality
    if (tweetSearch) {
        tweetSearch.addEventListener('input', function() {
            searchQuery = this.value.trim().toLowerCase();
            currentPage = 1;
            filterAndDisplayTweets();
        });
    }
    
    // Items per page change
    if (itemsPerPage) {
        itemsPerPage.addEventListener('change', function() {
            tweetsPerPage = parseInt(this.value);
            currentPage = 1;
            filterAndDisplayTweets();
        });
    }
    
    // Initialize pagination
    function initializePagination() {
        filteredTweets = [...allTweets];
        filterAndDisplayTweets();
    }
    
    // Filter tweets and update display
    function filterAndDisplayTweets() {
        if (!sentimentFilter || !allTweets || allTweets.length === 0) return;
        
        const selectedSentiment = sentimentFilter.value;
        
        // First filter by sentiment
        let tempFilteredTweets = [...allTweets];
        
        if (selectedSentiment !== 'all') {
            tempFilteredTweets = tempFilteredTweets.filter(tweet => tweet.predicted_sentiment === selectedSentiment);
        }
        
        // Then filter by search query if present
        if (searchQuery) {
            tempFilteredTweets = tempFilteredTweets.filter(tweet => {
                // Search in content, username or hashtags
                return (
                    (tweet.content?.toLowerCase().includes(searchQuery) || false) || 
                    (tweet.username?.toLowerCase().includes(searchQuery) || false)
                );
            });
        }
        
        filteredTweets = tempFilteredTweets;
        
        // Update pagination
        updatePagination();
        
        // Display current page
        displayTweets();
    }
    
    // Update pagination controls
    function updatePagination() {
        if (!paginationContainer || !filteredTweets) return;
        
        const totalPages = Math.ceil(filteredTweets.length / tweetsPerPage);
        
        // Adjust current page if needed
        if (currentPage > totalPages) {
            currentPage = totalPages > 0 ? totalPages : 1;
        }
        
        // Clear pagination container
        paginationContainer.innerHTML = '';
        
        // Create pagination element
        const pagination = document.createElement('ul');
        pagination.className = 'pagination';
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = 'page-item' + (currentPage === 1 ? ' disabled' : '');
        const prevLink = document.createElement('a');
        prevLink.className = 'page-link';
        prevLink.href = '#';
        prevLink.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
        prevLink.setAttribute('aria-label', 'Previous');
        prevLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                displayTweets();
                updatePagination();
            }
        });
        prevLi.appendChild(prevLink);
        pagination.appendChild(prevLi);
        
        // Page numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4 && startPage > 1) {
            startPage = Math.max(1, endPage - 4);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = 'page-item' + (i === currentPage ? ' active' : '');
            const pageLink = document.createElement('a');
            pageLink.className = 'page-link';
            pageLink.href = '#';
            pageLink.textContent = i;
            pageLink.addEventListener('click', function(e) {
                e.preventDefault();
                currentPage = i;
                displayTweets();
                updatePagination();
            });
            pageLi.appendChild(pageLink);
            pagination.appendChild(pageLi);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = 'page-item' + (currentPage === totalPages || totalPages === 0 ? ' disabled' : '');
        const nextLink = document.createElement('a');
        nextLink.className = 'page-link';
        nextLink.href = '#';
        nextLink.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        nextLink.setAttribute('aria-label', 'Next');
        nextLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                displayTweets();
                updatePagination();
            }
        });
        nextLi.appendChild(nextLink);
        pagination.appendChild(nextLi);
        
        // Append pagination to container
        paginationContainer.appendChild(pagination);
        
        // Show pagination info
        const paginationInfo = document.createElement('div');
        paginationInfo.className = 'text-muted mt-2 text-center';
        
        if (filteredTweets.length === 0) {
            paginationInfo.textContent = "Tidak ada tweet yang ditemukan";
        } else {
            const start = (currentPage - 1) * tweetsPerPage + 1;
            const end = Math.min(currentPage * tweetsPerPage, filteredTweets.length);
            paginationInfo.textContent = `Menampilkan ${start} sampai ${end} dari ${filteredTweets.length} tweets`;
        }
        
        paginationContainer.appendChild(paginationInfo);
    }
    
    // Display tweets for current page
    function displayTweets() {
        const tweetContainer = document.getElementById('tweet-container');
        if (!tweetContainer || !filteredTweets) return;
        
        tweetContainer.innerHTML = '';
        
        if (!filteredTweets || filteredTweets.length === 0) {
            if (searchQuery) {
                tweetContainer.innerHTML = '<p class="text-center text-muted my-5">Tidak ada tweet yang sesuai dengan pencarian.</p>';
            } else {
                tweetContainer.innerHTML = '<p class="text-center text-muted my-5">Tidak ada tweet yang ditemukan.</p>';
            }
            return;
        }
        
        // Calculate start and end index
        const startIndex = (currentPage - 1) * tweetsPerPage;
        const endIndex = Math.min(startIndex + tweetsPerPage, filteredTweets.length);
        
        // Display tweets for current page with animation
        for (let i = startIndex; i < endIndex; i++) {
            const tweet = filteredTweets[i];
            const tweetCard = document.createElement('div');
            tweetCard.className = 'tweet-card animate-fade-in';
            tweetCard.style.animationDelay = `${(i - startIndex) * 0.05}s`;
            
            const sentimentClass = tweet.predicted_sentiment === 'Positif' ? 'badge-positive' : 
                                  tweet.predicted_sentiment === 'Netral' ? 'badge-neutral' : 'badge-negative';
            
            // Process tweet content to make links clickable
            const linkifiedContent = linkifyText(tweet.content || '');
            
            // Format date to be more readable
            const formattedDate = formatDate(tweet.date || '');
            
            tweetCard.innerHTML = `
                <div class="tweet-header">
                    <span class="tweet-username">
                        <a href="https://twitter.com/${tweet.username || ''}" target="_blank">@${tweet.username || ''}</a>
                    </span>
                    <span class="tweet-date">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${formattedDate}
                    </span>
                </div>
                <div class="tweet-content">
                    ${linkifiedContent}
                </div>
                ${tweet.image_url ? `<div class="tweet-image mt-2 mb-2">
                    <a href="${tweet.image_url}" target="_blank">
                        <img src="${tweet.image_url}" alt="Tweet image" class="img-fluid rounded" style="max-height: 200px;">
                    </a>
                </div>` : ''}
                <div class="tweet-stats">
                    <span title="Likes"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> ${formatNumber(tweet.likes)}</span>
                    <span title="Retweets"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg> ${formatNumber(tweet.retweets)}</span>
                    <span title="Replies"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> ${formatNumber(tweet.replies)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <div>
                        <span class="tweet-badge ${sentimentClass}">${tweet.predicted_sentiment || ''}</span>
                        <span class="confidence-badge">${typeof tweet.confidence === 'number' ? tweet.confidence.toFixed(1) : '0'}%</span>
                    </div>
                    ${tweet.tweet_url ? `
                        <a href="${tweet.tweet_url}" class="btn btn-sm btn-outline-dark" target="_blank">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                            View on X
                        </a>` : ''}
                </div>
            `;
            
            tweetContainer.appendChild(tweetCard);
        }
    }
    
    // Helper function to format numbers (e.g., 1000 -> 1K)
    function formatNumber(num) {
        if (!num) return 0;
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num;
    }
    
    // Helper function to format date
    function formatDate(dateStr) {
        if (!dateStr) return '';
        
        const months = {
            'Jan': 'Januari',
            'Feb': 'Februari',
            'Mar': 'Maret',
            'Apr': 'April',
            'May': 'Mei',
            'Jun': 'Juni',
            'Jul': 'Juli',
            'Aug': 'Agustus',
            'Sep': 'September',
            'Oct': 'Oktober',
            'Nov': 'November',
            'Dec': 'Desember'
        };
        
        // Check if date is in format "DD MMM YYYY"
        const dateParts = dateStr.split(' ');
        if (dateParts.length === 3) {
            const day = dateParts[0];
            const month = months[dateParts[1]] || dateParts[1];
            const year = dateParts[2];
            return `${day} ${month} ${year}`;
        }
        
        return dateStr;
    }
    
    // Make links, hashtags and mentions clickable
    function linkifyText(text) {
        if (!text) return '';
        
        // URL pattern
        const urlPattern = /https?:\/\/[^\s]+/g;
        // Hashtag pattern
        const hashtagPattern = /#(\w+)/g;
        // Mention pattern
        const mentionPattern = /@(\w+)/g;
        
        // Replace URLs with clickable links
        let processedText = text.replace(urlPattern, url => 
            `<a href="${url}" target="_blank">${url.length > 30 ? url.substring(0, 27) + '...' : url}</a>`
        );
        
        // Replace hashtags with clickable links
        processedText = processedText.replace(hashtagPattern, (match, hashtag) => 
            `<a href="https://twitter.com/hashtag/${hashtag}" target="_blank" class="hashtag-link">${match}</a>`
        );
        
        // Replace mentions with clickable links
        processedText = processedText.replace(mentionPattern, (match, username) => 
            `<a href="https://twitter.com/${username}" target="_blank" class="mention-link">${match}</a>`
        );
        
        return processedText;
    }
    
    // Generate topics automatically based on analysis results
    function generateTopics(data) {
        if (!chatbotTopicButtons || !data) return;
        
        chatbotTopicButtons.innerHTML = '';
        
        // Base topics on hashtags, top words, and key program areas
        const topics = new Set();
        
        // Add from hashtags
        if (data.top_hashtags && data.top_hashtags.length > 0) {
            data.top_hashtags.slice(0, 7).forEach(hashtag => {
                const tag = hashtag.tag || hashtag;
                if (typeof tag === 'string') {
                    const topic = tag.replace('#', '');
                    topics.add(topic);
                }
            });
        }
        
        // Add from topics
        if (data.topics && data.topics.length > 0) {
            data.topics.slice(0, 7).forEach(topic => {
                if (topic && topic.topic) {
                    topics.add(topic.topic);
                }
            });
        }
        
        // Get words from each sentiment category
        if (data.sentiment_words) {
            // Add top positive words
            if (data.sentiment_words.positive && data.sentiment_words.positive.length > 0) {
                data.sentiment_words.positive.slice(0, 3).forEach(item => {
                    if (item.word && item.word.length > 3) {
                        topics.add(item.word);
                    }
                });
            }
            
            // Add top negative words
            if (data.sentiment_words.negative && data.sentiment_words.negative.length > 0) {
                data.sentiment_words.negative.slice(0, 3).forEach(item => {
                    if (item.word && item.word.length > 3) {
                        topics.add(item.word);
                    }
                });
            }
        }
        
        const keyPolicyAreas = [
        ];
        
        keyPolicyAreas.forEach(topic => {
            topics.add(topic);
        });
        
        const topicIcons = {
            'default': ''
        };
        
        Array.from(topics).forEach(topic => {
            if (!topic) return;
            
            const button = document.createElement('button');
            button.className = 'topic-button animate-fade-in';
            button.setAttribute('data-topic', topic);
            
            // Select icon based on topic or use default
            const iconHtml = topicIcons[topic] || topicIcons['default'];
            
            button.innerHTML = `${iconHtml} ${topic}`;
            chatbotTopicButtons.appendChild(button);
        });
        
        // Add a message to indicate these are suggested topics
        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center w-100 mt-2 mb-2 animate-fade-in';
        messageDiv.innerHTML = '<small class="text-muted">Topik diatas dibuat otomatis dari data yang dianalisa</small>';
        chatbotTopicButtons.appendChild(messageDiv);
    }
    
    // Function to update analysis results in UI
    function updateAnalysisResults(data) {
        if (!data) return;
        
        // Update title and description
        const titlePlaceholder = document.getElementById('title-placeholder');
        if (titlePlaceholder) titlePlaceholder.textContent = data.title || '';
        
        // Update counts and percentages
        updateElementText('total-tweets', data.total_tweets);
        updateElementText('positive-count', data.positive_count);
        updateElementText('neutral-count', data.neutral_count);
        updateElementText('negative-count', data.negative_count);
        
        updateElementText('positive-percent', (data.positive_percent || 0) + '%');
        updateElementText('neutral-percent', (data.neutral_percent || 0) + '%');
        updateElementText('negative-percent', (data.negative_percent || 0) + '%');
        
        // Update sentiment distribution with animation
        updateProgressBar('positive-segment', data.positive_percent);
        updateProgressBar('neutral-segment', data.neutral_percent);
        updateProgressBar('negative-segment', data.negative_percent);
        
        // Update stats cards
        updateStatsCard('positive-stats', 'positive', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>');
        updateStatsCard('neutral-stats', 'neutral', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>');
        updateStatsCard('negative-stats', 'negative', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>');
        
        // Update other UI elements
        updateHashtags('top-hashtags', data.top_hashtags);
        updateHashtags('all-hashtags', data.top_hashtags);
        updateTopUsers('top-users', data.top_users);
        updateTopics('main-topics', data.topics);
        updateTopics('topik-utama', data.topics);
        updateHashtagSentiment('hashtag-sentiment', data.hashtag_sentiment);
        
        // Update charts
        if (data.hashtag_sentiment) createSentimentByHashtagChart(data.hashtag_sentiment);
        if (data.tweets) {
            createSentimentByLocationChart(data.tweets);
            createSentimentByLanguageChart(data.tweets);
        }
        if (data.sentiment_words) createTopWordsCharts(data.sentiment_words);
        
        // Update sentiment plot
        updateSentimentPlot('sentiment-plot', data.sentiment_plot);
        
        // Initialize chatbot
        initializeChatbot(data);
    }
    
    // Helper function to update element text
    function updateElementText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text || '';
    }
    
    // Helper function to update progress bar
    function updateProgressBar(id, percentage) {
        const element = document.getElementById(id);
        if (!element) return;
        
        // Reset width first
        element.style.width = '0%';
        
        // Then animate to new value
        setTimeout(() => {
            element.style.width = (percentage || 0) + '%';
            element.textContent = (percentage || 0) + '%';
        }, 100);
    }
    
    // Helper function to update stats card
    function updateStatsCard(id, className, iconHtml) {
        const element = document.getElementById(id);
        if (!element) return;
        
        element.className = `stats-card ${className || ''} animate-fade-in`;
        const iconElement = element.querySelector('.icon');
        if (iconElement) iconElement.innerHTML = iconHtml || '';
    }
    
    // Helper function to update hashtags
    function updateHashtags(containerId, hashtags) {
        const container = document.getElementById(containerId);
        if (!container || !hashtags || !Array.isArray(hashtags)) return;
        
        container.innerHTML = '';
        
        hashtags.forEach((hashtag, index) => {
            const tag = document.createElement('div');
            tag.className = 'tag animate-fade-in';
            tag.style.animationDelay = `${index * 0.1}s`;
            
            const hashtagText = hashtag.tag || hashtag;
            const hashtagCount = hashtag.count !== undefined ? ` (${hashtag.count})` : '';
            
            tag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16"></path><path d="M4 15h16"></path><path d="M10 3L8 21"></path><path d="M16 3l-2 18"></path></svg> ${hashtagText}${hashtagCount}`;
            container.appendChild(tag);
        });
    }
    
    // Helper function to update top users
    function updateTopUsers(containerId, users) {
        const container = document.getElementById(containerId);
        if (!container || !users || !Array.isArray(users)) return;
        
        container.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'animate-fade-in';
            
            const sentimentClass = user.dominant_sentiment === 'Positif' ? 'sentiment-positive' : 
                                  user.dominant_sentiment === 'Netral' ? 'sentiment-neutral' : 'sentiment-negative';
            
            row.innerHTML = `
                <td><a href="https://twitter.com/${user.username || ''}" target="_blank">@${user.username || ''}</a></td>
                <td>${user.count || 0}</td>
                <td>${Math.round(user.avg_engagement || 0)}</td>
                <td><span class="${sentimentClass}">${user.dominant_sentiment || ''}</span></td>
            `;
            
            container.appendChild(row);
        });
    }
    
    // Helper function to update topics
    function updateTopics(containerId, topics) {
        const container = document.getElementById(containerId);
        if (!container || !topics || !Array.isArray(topics)) return;
        
        container.innerHTML = '';
        
        topics.forEach((topic, index) => {
            const row = document.createElement('tr');
            row.className = 'animate-fade-in';
            row.style.animationDelay = `${index * 0.1}s`;
            
            row.innerHTML = `
                <td>${topic.topic || ''}</td>
                <td>${topic.frequency || 0}</td>
            `;
            
            container.appendChild(row);
        });
    }
    
    // Helper function to update hashtag sentiment
    function updateHashtagSentiment(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container || !data || !Array.isArray(data)) return;
        
        container.innerHTML = '';
        
        data.forEach((stat, index) => {
            const row = document.createElement('tr');
            row.className = 'animate-fade-in';
            row.style.animationDelay = `${index * 0.1}s`;
            
            row.innerHTML = `
                <td>${stat.tag || ''}</td>
                <td>${stat.positive || 0}%</td>
                <td>${stat.neutral || 0}%</td>
                <td>${stat.negative || 0}%</td>
                <td>${stat.total || 0}</td>
            `;
            
            container.appendChild(row);
        });
    }
    
    // Helper function to update sentiment plot
    function updateSentimentPlot(id, plotData) {
        const element = document.getElementById(id);
        if (!element || !plotData) return;
        
        element.src = 'data:image/png;base64,' + plotData;
        element.classList.remove('d-none');
        element.classList.add('animate-fade-in');
    }
    
    // Initialize chatbot with welcome message
    function initializeChatbot(data) {
        if (!chatbotMessages || !data) return;
        
        // Clear any existing messages
        chatbotMessages.innerHTML = '';
        
        // Create welcome message
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message message-bot animate-fade-in';
        
        // Build the welcome message with data from analysis
        let messageContent = `
            <div class="mb-2"><strong>Selamat datang di Chatbot Evaluasi Kebijakan!</strong></div>
            <p>Saya akan membantu Anda menganalisis data sentimen X tentang ${data.title || 'topik ini'}.</p>
            <div class="mb-2"><strong>Ringkasan Analisis:</strong></div>
            <ul>
                <li>Total tweets: ${data.total_tweets || 0}</li>
                <li>Sentimen Positif: ${data.positive_count || 0} tweets (${data.positive_percent || 0}%)</li>
                <li>Sentimen Netral: ${data.neutral_count || 0} tweets (${data.neutral_percent || 0}%)</li>
                <li>Sentimen Negatif: ${data.negative_count || 0} tweets (${data.negative_percent || 0}%)</li>
            </ul>
            <p>Silakan pilih topik di bawah ini atau ajukan pertanyaan Anda sendiri.</p>
        `;
        
        welcomeMessage.innerHTML = messageContent;
        chatbotMessages.appendChild(welcomeMessage);
        
        // Scroll to bottom
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
    
    // Function to send message to chatbot
    function sendChatbotMessage() {
        if (!chatbotInput || !chatbotMessages) return;
        
        const messageText = chatbotInput.value.trim();
        
        if (!messageText) return;
        
        // Add user message to chat
        const userMessage = document.createElement('div');
        userMessage.className = 'message message-user animate-fade-in';
        userMessage.textContent = messageText;
        chatbotMessages.appendChild(userMessage);
        
        // Clear input
        chatbotInput.value = '';
        
        // Add loading indicator
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'message message-bot animate-fade-in';
        loadingMessage.innerHTML = '<div class="d-flex align-items-center"><div class="spinner-grow spinner-grow-sm me-2" role="status"></div><span>Menganalisis data dan menyusun respons...</span></div>';
        chatbotMessages.appendChild(loadingMessage);
        
        // Scroll to bottom
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        
        // Send to server
        fetch('/chatbot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({message: messageText})
        })
        .then(response => response.json())
        .then(data => {
            // Remove loading message
            if (chatbotMessages.contains(loadingMessage)) {
                chatbotMessages.removeChild(loadingMessage);
            }
            
            // Format the response text with proper line breaks and formatting
            const formattedResponse = formatChatbotResponse(data.response || '');
            
            // Add bot response with animation
            const botMessage = document.createElement('div');
            botMessage.className = 'message message-bot animate-fade-in';
            botMessage.innerHTML = formattedResponse;
            chatbotMessages.appendChild(botMessage);
            
            // Scroll to bottom
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        })
        .catch(error => {
            // Remove loading message
            if (chatbotMessages.contains(loadingMessage)) {
                chatbotMessages.removeChild(loadingMessage);
            }
            
            // Add error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message message-bot animate-fade-in';
            errorMessage.textContent = 'Maaf, terjadi kesalahan dalam berkomunikasi dengan chatbot. Silakan coba lagi.';
            chatbotMessages.appendChild(errorMessage);
            
            // Scroll to bottom
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        });
    }
    
    // Format chatbot response with proper HTML formatting
    function formatChatbotResponse(text) {
        if (!text) return '';
        
        // Convert line breaks to <br>
        let formatted = text.replace(/\n/g, '<br>');
        
        // Format numbered lists (1. Item)
        formatted = formatted.replace(/(\d+\.\s+[^\n<]+)(<br>|$)/g, '<li>$1</li>');
        
        // Format bullet points (- Item or • Item)
        formatted = formatted.replace(/([-•]\s+[^\n<]+)(<br>|$)/g, '<li>$1</li>');
        
        // Wrap lists in <ul> tags
        formatted = formatted.replace(/<li>([^<]+)<\/li>(<li>)/g, '<li>$1</li>$2');
        formatted = formatted.replace(/<li>([^<]+)<\/li>(?!<li>)/g, '<ul><li>$1</li></ul>');
        formatted = formatted.replace(/<\/ul><ul>/g, '');
        
        // Bold text between asterisks (*text*)
        formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
        
        // Italic text between underscores (_text_)
        formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // Create paragraphs for text blocks
        formatted = '<p>' + formatted.replace(/<br><br>/g, '</p><p>') + '</p>';
        
        // Clean up empty paragraphs
        formatted = formatted.replace(/<p><\/p>/g, '');
        
        return formatted;
    }
    
    // Function to show alert
    function showAlert(message, type) {
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) return;
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type || 'info'} alert-dismissible fade show animate-fade-in`;
        alert.role = 'alert';
        alert.innerHTML = `
            ${message || ''}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.classList) {
                alert.classList.remove('show');
                setTimeout(() => {
                    if (alert.parentNode === alertContainer) {
                        alertContainer.removeChild(alert);
                    }
                }, 300);
            }
        }, 5000);
    }
    
    // Create improved word cloud
    function createImprovedWordCloud(data) {
        const wordCloudContainer = document.getElementById('word-cloud-container');
        if (!wordCloudContainer || !data || !data.tweets || data.tweets.length === 0) return;
        
        // Add loading indicator
        wordCloudContainer.innerHTML = '<div class="chart-loader"><div class="spinner"></div></div>';
        
        try {
            // Check if d3 is available
            if (typeof d3 === 'undefined' || !d3.layout || !d3.layout.cloud) {
                wordCloudContainer.innerHTML = '<p class="text-center text-muted my-5">Library D3 tidak tersedia untuk membuat word cloud.</p>';
                return;
            }
            
            // Create word frequency counts
            const wordFrequencies = {};
            
            // Stopwords to filter out (expanded list)
            const stopwords = [
                'yang', 'dan', 'di', 'dengan', 'untuk', 'pada', 'adalah', 'ini', 'itu', 'atau', 'juga',
                'dari', 'akan', 'ke', 'karena', 'oleh', 'saat', 'dalam', 'secara', 'telah', 'sebagai',
                'bahwa', 'dapat', 'para', 'harus', 'namun', 'seperti', 'hingga', 'tak', 'tidak', 'tapi',
                'kita', 'kami', 'saya', 'mereka', 'dia', 'http', 'https', 'co', 't', 'a', 'amp', 'rt',
                'nya', 'yg', 'dgn', 'utk', 'dr', 'pd', 'jd', 'sdh', 'tdk', 'bisa', 'ada', 'kalo', 'bgt',
                'aja', 'gitu', 'gak', 'mau', 'biar', 'kan', 'klo', 'deh', 'sih', 'nya', 'nih', 'loh'
            ];
            
            // Process each tweet to extract words
            data.tweets.forEach(tweet => {
                if (!tweet.content) return;
                
                // Extract words from content
                let content = tweet.content.toLowerCase();
                
                // Remove URLs
                content = content.replace(/https?:\/\/[^\s]+/g, '');
                
                // Remove special characters and emoji
                content = content.replace(/[^\w\s]/g, ' ');
                
                // Split into words
                const words = content.split(/\s+/);
                
                // Filter words
                const filteredWords = words.filter(word => 
                    word.length > 3 &&  // Filter words with length > 3
                    !stopwords.includes(word) &&  // Filter out stopwords
                    !/^\d+$/.test(word)  // Filter out numbers
                );
                
                // Count word frequencies
                filteredWords.forEach(word => {
                    wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
                });
            });
            
            // Convert to array for word cloud
            const wordsArray = Object.entries(wordFrequencies)
                .map(([text, value]) => ({ text, value }))
                .filter(item => item.value > 1)  // Filter words that appear more than once
                .sort((a, b) => b.value - a.value)
                .slice(0, 100);  // Limit to top 100 words
            
            if (wordsArray.length === 0) {
                wordCloudContainer.innerHTML = '<p class="text-center text-muted my-5">Tidak cukup data untuk menampilkan word cloud.</p>';
                return;
            }
            
            // Normalize word sizes between minSize and maxSize
            const minCount = Math.min(...wordsArray.map(w => w.value));
            const maxCount = Math.max(...wordsArray.map(w => w.value));
            const minSize = 12;
            const maxSize = 60;
            
            // Adjust word sizes
            wordsArray.forEach(word => {
                // Normalize size
                const size = minSize + ((word.value - minCount) / (maxCount - minCount || 1)) * (maxSize - minSize);
                word.size = size;
                
                // Assign a color based on sentiment association
                // Use a black/gray scale for the monochrome theme
                const intensity = Math.round((word.value - minCount) / (maxCount - minCount || 1) * 200);
                word.color = `rgb(${intensity}, ${intensity}, ${intensity})`;
            });
            
            try {
                // Use an alternative approach if d3.layout.cloud setup fails
                wordCloudContainer.innerHTML = '<h4 class="text-center my-3">Top Words</h4><div class="d-flex flex-wrap justify-content-center align-items-center"></div>';
                const wordContainer = wordCloudContainer.querySelector('div');
                
                wordsArray.slice(0, 50).forEach((word, index) => {
                    const wordSpan = document.createElement('span');
                    wordSpan.textContent = word.text;
                    wordSpan.style.fontSize = `${word.size / 10}rem`;
                    wordSpan.style.fontWeight = Math.min(900, 300 + Math.floor(word.size * 10));
                    wordSpan.style.color = word.color;
                    wordSpan.style.padding = '5px';
                    wordSpan.style.margin = '3px';
                    wordSpan.style.display = 'inline-block';
                    wordSpan.style.transition = 'all 0.3s ease';
                    wordSpan.style.opacity = 0;
                    wordSpan.style.transform = 'translateY(20px)';
                    
                    wordSpan.addEventListener('mouseover', function() {
                        this.style.transform = 'scale(1.2)';
                        this.style.color = '#000000';
                    });
                    
                    wordSpan.addEventListener('mouseout', function() {
                        this.style.transform = 'scale(1)';
                        this.style.color = word.color;
                    });
                    
                    wordContainer.appendChild(wordSpan);
                    
                    // Animate entrance with delay based on index
                    setTimeout(() => {
                        wordSpan.style.opacity = 1;
                        wordSpan.style.transform = 'translateY(0)';
                    }, 50 * index);
                });
            } catch (innerError) {
                console.error("Inner error creating word cloud:", innerError);
                wordCloudContainer.innerHTML = '<p class="text-center text-muted my-5">Gagal membuat visualisasi word cloud.</p>';
            }
        } catch (error) {
            console.error("Error creating word cloud:", error);
            wordCloudContainer.innerHTML = '<p class="text-center text-muted my-5">Gagal membuat visualisasi word cloud.</p>';
        }
    }


    // Fungsi untuk mengecek apakah data analisis sudah dimuat dengan benar
    function checkAnalysisDataLoaded() {
        // Cek apakah data tweets tersedia
        if (!allTweets || allTweets.length === 0) {
            showAlert('Data analisis tidak termuat dengan benar. Coba lakukan analisis baru.', 'warning');
            return false;
        }
        
        // Cek keberadaan elemen-elemen kunci di hasil analisis
        const titleElement = document.getElementById('title-placeholder');
        const totalTweetsElement = document.getElementById('total-tweets');
        
        if ((!titleElement || !titleElement.textContent) || 
            (!totalTweetsElement || totalTweetsElement.textContent === '0')) {
            showAlert('Data analisis tidak lengkap. Beberapa informasi mungkin tidak ditampilkan dengan benar.', 'warning');
            return false;
        }
        
        return true;
    }

    // Tambahkan fungsi untuk memulihkan analisis dari data yang disimpan di database
    function recoverAnalysisFromHistory(historyId) {
        showAlert('Mencoba memulihkan data analisis dari riwayat...', 'info');
        
        // Kirim permintaan AJAX untuk memuat data dari riwayat
        fetch(`/history/show/${historyId}`)
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    return response.json();
                }
            })
            .then(data => {
                if (data && data.success) {
                    showAlert('Data analisis berhasil dipulihkan!', 'success');
                    window.location.href = '/index?view=results';
                } else if (data && data.error) {
                    showAlert(`Gagal memulihkan data: ${data.error}`, 'danger');
                }
            })
            .catch(error => {
                showAlert(`Terjadi kesalahan saat memulihkan data: ${error.message}`, 'danger');
            });
    }

    // Tambahkan ini pada handler klik tombol "Lihat" di halaman riwayat
    document.addEventListener('DOMContentLoaded', function() {
        const viewHistoryButtons = document.querySelectorAll('.view-history-btn');
        
        viewHistoryButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                const historyId = this.getAttribute('data-history-id');
                if (!historyId) return;
                
                // Tambahkan loading state
                this.innerHTML = `
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    Memuat...
                `;
                this.disabled = true;
            });
        });
        
        // Cek data analisis saat halaman muat (hanya untuk halaman hasil)
        if (window.location.href.includes('view=results')) {
            setTimeout(() => {
                checkAnalysisDataLoaded();
            }, 1000);
        }
    });
    
    // Function to create sentiment by hashtag chart
    function createSentimentByHashtagChart(hashtagSentimentData) {
        if (typeof Chart === 'undefined') return;
        
        const chartContainer = document.getElementById('sentiment-by-hashtag-chart');
        if (!chartContainer || !hashtagSentimentData || hashtagSentimentData.length === 0) return;
        
        // Add loading indicator
        chartContainer.innerHTML = '<div class="chart-loader"><div class="spinner"></div></div>';
        
        try {
            // Take top 5 hashtags by total count
            const top5Hashtags = hashtagSentimentData
                .sort((a, b) => (b.total || 0) - (a.total || 0))
                .slice(0, 5);
            
            const labels = top5Hashtags.map(item => item.tag || '');
            const positiveData = top5Hashtags.map(item => item.positive || 0);
            const neutralData = top5Hashtags.map(item => item.neutral || 0);
            const negativeData = top5Hashtags.map(item => item.negative || 0);
            
            // Create chart
            const ctx = document.createElement('canvas');
            chartContainer.innerHTML = '';
            chartContainer.appendChild(ctx);
            
            // Destroy previous chart instance if exists
            if (sentimentByHashtagChart) {
                sentimentByHashtagChart.destroy();
            }
            
            // Create new chart
            sentimentByHashtagChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Positif',
                            data: positiveData,
                            backgroundColor: '#ffffff',
                            borderColor: '#dddddd',
                            borderWidth: 1
                        },
                        {
                            label: 'Netral',
                            data: neutralData,
                            backgroundColor: '#9e9e9e',
                            borderColor: '#757575',
                            borderWidth: 1
                        },
                        {
                            label: 'Negatif',
                            data: negativeData,
                            backgroundColor: '#000000',
                            borderColor: '#000000',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Hashtag',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Persentase (%)',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Sentimen Berdasarkan Hashtag (Top 5)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                bottom: 15
                            }
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.raw + '%';
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } catch (error) {
            console.error("Error creating sentiment by hashtag chart:", error);
            chartContainer.innerHTML = '<p class="text-center text-muted my-5">Gagal membuat visualisasi chart.</p>';
        }
    }
    
    // Create sentiment by location chart
    function createSentimentByLocationChart(tweetsData) {
        if (typeof Chart === 'undefined') return;
        
        const chartContainer = document.getElementById('sentiment-by-location-chart');
        if (!chartContainer || !tweetsData || tweetsData.length === 0) return;
        
        try {
            // Add loading indicator
            chartContainer.innerHTML = '<div class="chart-loader"><div class="spinner"></div></div>';
            
            // Group tweets by location and sentiment
            const locationData = {};
            
            tweetsData.forEach(tweet => {
                if (tweet.location) {
                    if (!locationData[tweet.location]) {
                        locationData[tweet.location] = {
                            Positif: 0,
                            Netral: 0,
                            Negatif: 0,
                            total: 0
                        };
                    }
                    
                    if (tweet.predicted_sentiment) {
                        locationData[tweet.location][tweet.predicted_sentiment]++;
                    }
                    locationData[tweet.location].total++;
                }
            });
            
            // Convert to array and sort by total
            const locationArray = Object.entries(locationData)
                .map(([location, data]) => ({
                    location,
                    ...data,
                    positivePercent: (data.Positif / (data.total || 1) * 100).toFixed(1),
                    neutralPercent: (data.Netral / (data.total || 1) * 100).toFixed(1),
                    negativePercent: (data.Negatif / (data.total || 1) * 100).toFixed(1)
                }))
                .filter(item => (item.total || 0) >= 2) // Filter locations with at least 2 tweets
                .sort((a, b) => (b.total || 0) - (a.total || 0))
                .slice(0, 5); // Take top 5
            
            if (locationArray.length === 0) {
                chartContainer.innerHTML = '<p class="text-center text-muted my-5">Data lokasi tidak cukup untuk menampilkan grafik.</p>';
                return;
            }
            
            const labels = locationArray.map(item => item.location || '');
            const positiveData = locationArray.map(item => parseFloat(item.positivePercent || 0));
            const neutralData = locationArray.map(item => parseFloat(item.neutralPercent || 0));
            const negativeData = locationArray.map(item => parseFloat(item.negativePercent || 0));
            
            // Create chart
            const ctx = document.createElement('canvas');
            chartContainer.innerHTML = '';
            chartContainer.appendChild(ctx);
            
            // Destroy previous chart instance if exists
            if (sentimentByLocationChart) {
                sentimentByLocationChart.destroy();
            }
            
            // Create new chart
            sentimentByLocationChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Positif',
                            data: positiveData,
                            backgroundColor: '#ffffff',
                            borderColor: '#dddddd',
                            borderWidth: 1
                        },
                        {
                            label: 'Netral',
                            data: neutralData,
                            backgroundColor: '#9e9e9e',
                            borderColor: '#757575',
                            borderWidth: 1
                        },
                        {
                            label: 'Negatif',
                            data: negativeData,
                            backgroundColor: '#000000',
                            borderColor: '#000000',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Lokasi',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Persentase (%)',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Sentimen Berdasarkan Lokasi (Top 5)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                bottom: 15
                            }
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.raw + '%';
                                },
                                afterLabel: function(context) {
                                    const index = context.dataIndex;
                                    const locationItem = locationArray[index];
                                    return 'Total tweets: ' + (locationItem?.total || 0);
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1200,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } catch (error) {
            console.error("Error creating sentiment by location chart:", error);
            chartContainer.innerHTML = '<p class="text-center text-muted my-5">Gagal membuat visualisasi chart.</p>';
        }
    }
    
    // Create sentiment by language chart
    function createSentimentByLanguageChart(tweetsData) {
        if (typeof Chart === 'undefined') return;
        
        const chartContainer = document.getElementById('sentiment-by-language-chart');
        if (!chartContainer || !tweetsData || tweetsData.length === 0) return;
        
        try {
            // Add loading indicator
            chartContainer.innerHTML = '<div class="chart-loader"><div class="spinner"></div></div>';
            
            // Group tweets by language and sentiment
            const languageData = {};
            const languageNames = {
                'in': 'Indonesia',
                'en': 'English',
                'id': 'Indonesia',
                'qme': 'Quechua',
                'und': 'Undefined',
                'ar': 'Arabic',
                'fr': 'French',
                'es': 'Spanish',
                'de': 'German'
            };
            
            tweetsData.forEach(tweet => {
                if (tweet.lang) {
                    if (!languageData[tweet.lang]) {
                        languageData[tweet.lang] = {
                            Positif: 0,
                            Netral: 0,
                            Negatif: 0,
                            total: 0
                        };
                    }
                    
                    if (tweet.predicted_sentiment) {
                        languageData[tweet.lang][tweet.predicted_sentiment]++;
                    }
                    languageData[tweet.lang].total++;
                }
            });
            
            // Convert to array and sort by total
            const languageArray = Object.entries(languageData)
                .map(([lang, data]) => ({
                    lang,
                    langName: languageNames[lang] || lang,
                    ...data,
                    positivePercent: (data.Positif / (data.total || 1) * 100).toFixed(1),
                    neutralPercent: (data.Netral / (data.total || 1) * 100).toFixed(1),
                    negativePercent: (data.Negatif / (data.total || 1) * 100).toFixed(1)
                }))
                .sort((a, b) => (b.total || 0) - (a.total || 0))
                .slice(0, 5); // Take top 5
            
            const labels = languageArray.map(item => item.langName || '');
            const positiveData = languageArray.map(item => parseFloat(item.positivePercent || 0));
            const neutralData = languageArray.map(item => parseFloat(item.neutralPercent || 0));
            const negativeData = languageArray.map(item => parseFloat(item.negativePercent || 0));
            
            // Create chart
            const ctx = document.createElement('canvas');
            chartContainer.innerHTML = '';
            chartContainer.appendChild(ctx);
            
            // Destroy previous chart instance if exists
            if (sentimentByLanguageChart) {
                sentimentByLanguageChart.destroy();
            }
            
            // Create new chart
            sentimentByLanguageChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Positif',
                            data: positiveData,
                            backgroundColor: '#ffffff',
                            borderColor: '#dddddd',
                            borderWidth: 1
                        },
                        {
                            label: 'Netral',
                            data: neutralData,
                            backgroundColor: '#9e9e9e',
                            borderColor: '#757575',
                            borderWidth: 1
                        },
                        {
                            label: 'Negatif',
                            data: negativeData,
                            backgroundColor: '#000000',
                            borderColor: '#000000',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Bahasa',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            stacked: true,
                            title: {
                                display: true,
                                text: 'Persentase (%)',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Sentimen Berdasarkan Bahasa (Top 5)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                bottom: 15
                            }
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.raw + '%';
                                },
                                afterLabel: function(context) {
                                    const index = context.dataIndex;
                                    const languageItem = languageArray[index];
                                    return 'Total tweets: ' + (languageItem?.total || 0);
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1400,
                        easing: 'easeOutQuart'
                    }
                }
            });
        } catch (error) {
            console.error("Error creating sentiment by language chart:", error);
            chartContainer.innerHTML = '<p class="text-center text-muted my-5">Gagal membuat visualisasi chart.</p>';
        }
    }
    
    // Create top words charts for each sentiment
    function createTopWordsCharts(sentimentWords) {
        if (!sentimentWords) return;
        
        createWordFrequencyChart('positive-words-chart', sentimentWords.positive, 'Kata Umum dalam Sentimen Positif', '#ffffff');
        createWordFrequencyChart('neutral-words-chart', sentimentWords.neutral, 'Kata Umum dalam Sentimen Netral', '#9e9e9e');
        createWordFrequencyChart('negative-words-chart', sentimentWords.negative, 'Kata Umum dalam Sentimen Negatif', '#000000');
    }
    
    // Create word frequency chart with enhanced animations
    function createWordFrequencyChart(containerId, wordFrequencies, title, color) {
        if (typeof Chart === 'undefined') return;
        
        const chartContainer = document.getElementById(containerId);
        if (!chartContainer || !wordFrequencies || !Array.isArray(wordFrequencies) || wordFrequencies.length === 0) {
            if (chartContainer) {
                chartContainer.innerHTML = '<p class="text-center text-muted my-5">Tidak cukup data untuk menampilkan grafik ini.</p>';
            }
            return;
        }
        
        try {
            // Add loading indicator
            chartContainer.innerHTML = '<div class="chart-loader"><div class="spinner"></div></div>';
            
            // Prepare data for chart
            const wordsArray = wordFrequencies
                .filter(item => item && item.word && item.count)
                .map(item => ({ word: item.word, count: item.count }))
                .sort((a, b) => (b.count || 0) - (a.count || 0))
                .slice(0, 10);
            
            if (wordsArray.length === 0) {
                chartContainer.innerHTML = '<p class="text-center text-muted my-5">Tidak cukup data untuk menampilkan grafik ini.</p>';
                return;
            }
            
            const labels = wordsArray.map(item => item.word || '');
            const data = wordsArray.map(item => item.count || 0);
            
            // Create chart
            const ctx = document.createElement('canvas');
            chartContainer.innerHTML = '';
            chartContainer.appendChild(ctx);
            
            // Determine text color based on background color
            let textColor = '#000000';
            if (color === '#000000') {
                textColor = '#ffffff';
            }
            
            // Get chart options
            const chartOptions = getWordChartOptions(title || '', textColor);
            
            // Get chart instance based on container ID
            let chartInstance;
            if (containerId === 'positive-words-chart') {
                // Destroy previous chart instance if exists
                if (positiveWordsChart) {
                    positiveWordsChart.destroy();
                }
                
                // Create new chart
                chartInstance = positiveWordsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Frekuensi',
                                data: data,
                                backgroundColor: color || '#333333',
                                borderColor: '#333333',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: chartOptions
                });
            } else if (containerId === 'neutral-words-chart') {
                // Destroy previous chart instance if exists
                if (neutralWordsChart) {
                    neutralWordsChart.destroy();
                }
                
                // Create new chart
                chartInstance = neutralWordsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Frekuensi',
                                data: data,
                                backgroundColor: color || '#333333',
                                borderColor: '#333333',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: chartOptions
                });
            } else if (containerId === 'negative-words-chart') {
                // Destroy previous chart instance if exists
                if (negativeWordsChart) {
                    negativeWordsChart.destroy();
                }
                
                // Create new chart
                chartInstance = negativeWordsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Frekuensi',
                                data: data,
                                backgroundColor: color || '#333333',
                                borderColor: '#333333',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: chartOptions
                });
            }
            
            return chartInstance;
        } catch (error) {
            console.error(`Error creating chart for ${containerId}:`, error);
            if (chartContainer) {
                chartContainer.innerHTML = '<p class="text-center text-muted my-5">Gagal membuat visualisasi chart.</p>';
            }
            return null;
        }
    }
    
    // Helper function for word frequency chart options
    function getWordChartOptions(title, textColor) {
        return {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frekuensi',
                        font: {
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: false
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: title || '',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        bottom: 15
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Frekuensi: ' + (context.raw || 0);
                        }
                    }
                }
            },
            animation: {
                delay: function(context) {
                    return (context.dataIndex || 0) * 100;
                },
                duration: 1000,
                easing: 'easeOutQuart'
            }
        };
    }
    
    // Add support for example questions in chatbot.html
    const exampleQuestions = document.querySelectorAll('.example-question');
    if (exampleQuestions.length > 0) {
        exampleQuestions.forEach(question => {
            question.addEventListener('click', function() {
                if (chatbotInput) {
                    chatbotInput.value = this.textContent.trim();
                    if (chatbotSend) {
                        chatbotSend.click();
                    }
                }
            });
        });
    }
});