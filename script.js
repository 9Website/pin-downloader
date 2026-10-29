async function startDownload() {
    const urlInput = document.getElementById('boardUrl').value.trim();
    const statusDiv = document.getElementById('status');
    const downloadBtn = document.getElementById('downloadBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    if (!urlInput) {
        alert('Please enter a valid Pinterest board URL.');
        return;
    }

    downloadBtn.disabled = true;
    statusDiv.textContent = 'Connecting to Pinterest...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '10%';

    try {
        // Clean up the URL format
        let cleanUrl = urlInput.replace(/\/$/, "");
        
        // Use api.allorigins.win with raw JSON parsing capabilities
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl + '/')}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok.');
        
        const data = await response.json();
        if (!data.contents) throw new Error('Could not retrieve board content.');

        statusDiv.textContent = 'Extracting media links...';
        progressBar.style.width = '30%';

        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        let mediaUrls = new Set();

        // Look for Pinterest image containers and JSON script payloads embedded in the page
        doc.querySelectorAll('img').forEach(img => {
            let src = img.src;
            if (src) {
                // Upgrade to high resolution original images
                if (src.includes('236x') || src.includes('474x') || src.includes('736x')) {
                    src = src.replace(/236x|474x|736x/, 'originals');
                }
                if (src.startsWith('http')) {
                    mediaUrls.add(src);
                }
            }
        });

        // Also search script tags containing initial data json
        doc.querySelectorAll('script').forEach(script => {
            if (script.textContent && script.textContent.includes('"images":')) {
                const matches = script.textContent.match(/https?:\/\/[^"\s]+\.(jpg|jpeg|png|mp4)/g);
                if (matches) {
                    matches.forEach(m => mediaUrls.add(m));
                }
            }
        });

        const urlsArray = Array.from(mediaUrls);

        if (urlsArray.length === 0) {
            throw new Error('No pins found. Ensure the board is public and format is pinterest.com/username/board.');
        }

        statusDiv.textContent = `Found ${urlsArray.length} items. Downloading files...`;
        progressBar.style.width = '40%';

        const zip = new JSZip();
        const folder = zip.folder("pinterest-board");
        
        let completed = 0;
        
        for (let i = 0; i < urlsArray.length; i++) {
            const fileUrl = urlsArray[i];
            try {
                // Fetch binary file content via allorigins raw mode
                const fileResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(fileUrl)}`);
                if (fileResponse.ok) {
                    const blob = await fileResponse.blob();
                    const ext = blob.type.includes('video') ? 'mp4' : 'jpg';
                    folder.file(`pin_${i + 1}.${ext}`, blob);
                }
            } catch (err) {
                console.warn(`Skipped item ${i + 1} due to network restriction.`);
            }
            
            completed++;
            let progress = 40 + Math.floor((completed / urlsArray.length) * 50);
            progressBar.style.width = `${progress}%`;
            statusDiv.textContent = `Downloaded ${completed} of ${urlsArray.length} items...`;
        }

        statusDiv.textContent = 'Generating ZIP file...';
        progressBar.style.width = '95%';

        const content = await zip.generateAsync({ type: 'blob' });
        
        const downloadUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'pinterest-board.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        statusDiv.textContent = 'Done! Your ZIP file has downloaded.';
        progressBar.style.width = '100%';
    } catch (error) {
        console.error(error);
        statusDiv.textContent = `Error: ${error.message}. Try a smaller or different public board.`;
    } finally {
        downloadBtn.disabled = false;
    }
}
