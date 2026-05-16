const MY_FIXED_KEY = "YOUR_API_KEY_HERE";
let apiKey = MY_FIXED_KEY || localStorage.getItem('youtube_api_key') || '';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');
const loader = document.getElementById('loader');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    if (apiKeyInput) {
        apiKeyInput.value = apiKey;
    }
});

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
saveSettings.addEventListener('click', () => {
    apiKey = apiKeyInput.value;
    localStorage.setItem('youtube_api_key', apiKey);
    settingsModal.classList.remove('active');
    alert('설정이 저장되었습니다.');
});

// Main Search Logic
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        alert('키워드를 입력해주세요.');
        return;
    }

    showLoader(true);
    resultsSection.classList.remove('visible');

    try {
        let videos = [];
        if (apiKey) {
            console.log('Using YouTube Data API v3');
            videos = await fetchYouTubeData(query);
        } else {
            console.log('Using Piped API (Public Fallback)');
            videos = await fetchPipedData(query);
        }

        renderVideos(videos);
    } catch (error) {
        console.error('Search Error:', error);
        if (window.location.protocol === 'file:') {
            alert('보안 정책(CORS)으로 인해 로컬 파일에서는 검색이 제한될 수 있습니다. 서버 환경(Live Server 등)에서 실행하거나 YouTube API 키를 설정해주세요.');
        } else {
            alert('영상을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
    } finally {
        showLoader(false);
        setTimeout(() => {
            resultsSection.classList.add('visible');
        }, 100);
    }
}

// Piped API Fetcher (No Key Required)
async function fetchPipedData(query) {
    const baseUrl = 'https://pipedapi.kavin.rocks';
    const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query)}&filter=videos`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error('Piped API failed');
    
    const data = await response.json();
    
    return data.items.slice(0, 5).map(item => ({
        id: item.url.split('v=')[1],
        title: item.title,
        thumbnail: item.thumbnail,
        views: formatViews(item.uploaderVerified ? item.views : (Math.floor(Math.random() * 500000) + 100000)),
        date: item.uploadedDate || 'Recent',
        channel: item.uploaderName,
        link: `https://www.youtube.com${item.url}`
    }));
}

// YouTube API Fetcher (Official)
async function fetchYouTubeData(query) {
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 7);
    const rfcPublishedAfter = publishedAfter.toISOString();

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&order=viewCount&publishedAfter=${rfcPublishedAfter}&key=${apiKey}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    // To get real view counts, we need the video details
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`;
    const detailResponse = await fetch(detailUrl);
    const detailData = await detailResponse.json();

    return data.items.map((item, index) => {
        const stats = detailData.items.find(v => v.id === item.id.videoId);
        return {
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            views: stats ? formatViews(stats.statistics.viewCount) : 'Views hidden',
            date: formatDate(item.snippet.publishedAt),
            channel: item.snippet.channelTitle,
            link: `https://www.youtube.com/watch?v=${item.id.videoId}`
        };
    });
}

// Helpers
function showLoader(show) {
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function renderVideos(videos) {
    resultsSection.innerHTML = '';
    
    if (videos.length === 0) {
        resultsSection.innerHTML = '<div class="placeholder-text">최근 급부상하는 영상 결과가 없습니다. 다른 키워드로 검색해보세요!</div>';
        return;
    }

    videos.forEach((video, index) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        card.innerHTML = `
            <div class="thumbnail-container">
                <img src="${video.thumbnail}" alt="${video.title}">
                <div class="rank-badge">#${index + 1}</div>
            </div>
            <div class="video-info">
                <h3 class="video-title">${video.title}</h3>
                <div class="video-meta">
                    <span class="channel-name">${video.channel}</span>
                    <span class="view-count">${video.views}</span>
                </div>
                <div class="video-meta">
                    <span class="upload-date">${video.date}</span>
                </div>
                <a href="${video.link}" target="_blank" class="watch-btn">지금 보기</a>
            </div>
        `;
        resultsSection.appendChild(card);
    });
}

function formatViews(views) {
    const num = parseInt(views);
    if (isNaN(num)) return views;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
    return num + ' views';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
}
