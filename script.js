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
    statusDiv.textContent = 'Fetching board data...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '10%';

    try {
        // Using corsproxy.io which returns raw HTML directly, avoiding JSON parsing errors
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlInput)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const htmlText = await response.text();

        statusDiv.textContent = 'Parsing pins...';
        progressBar.style.width = '30%';

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        let mediaUrls = new Set();

        // Scrape all image tags and upgrade thumbnails to original high-res versions
        doc.querySelectorAll('img').forEach(img => {
            let src = img.src;
            if (src) {
                if (src.includes('236x')) {
                    src = src.replace('236x', 'originals');
                } else if (src.includes('474x')) {
                    src = src.replace('474x', 'originals');
                } else if (src.includes('736x')) {
                    src = src.replace('736x', 'originals');
                }
                if (src.startsWith('http')) {
                    mediaUrls.add(src);
                }
            }
        });

        const urlsArray = Array.from(mediaUrls);

        if (urlsArray.length === 0) {
            throw new Error('No pins found. Make sure the board is public and the URL is correct.');
        }

        statusDiv.textContent = `Found ${urlsArray.length} items. Downloading files...`;
        progressBar.style.width = '40%';

        const zip = new JSZip();
        const folder = zip.folder("pinterest-board");
        
        let completed = 0;
        
        for (let i = 0; i < urlsArray.length; i++) {
            const fileUrl = urlsArray[i];
            try {
                // Route image downloads through the proxy too to bypass CORS
                const fileResponse = await fetch(`https://corsproxy.io/?${encodeURIComponent(fileUrl)}`);
                if (fileResponse.ok) {
                    const blob = await fileResponse.blob();
                    const filename = `pin_${i + 1}.${blob.type.includes('video') ? 'mp4' : 'jpg'}`;
                    folder.file(filename, blob);
                }
            } catch (err) {
                console.warn(`Skipped a file due to error:`, err);
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
        statusDiv.textContent = `Error: ${error.message}`;
    } finally {
        downloadBtn.disabled = false;
    }
}
