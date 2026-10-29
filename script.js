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
        // Use a public CORS proxy to fetch the Pinterest board HTML page
        // Note: For heavy production use, consider deploying a dedicated worker proxy.
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (!data.contents) {
            throw new Error('Failed to fetch the board page. Check the URL.');
        }

        statusDiv.textContent = 'Parsing pins...';
        progressBar.style.width = '30%';

        // Extract image/video source URLs from Pinterest's embedded JSON data or standard img tags
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        
        let mediaUrls = new Set();

        // Pinterest typically stores high-res images in specific srcset or script tags, 
        // but we can scrape <img> tags and meta tags as a robust baseline:
        doc.querySelectorAll('img').forEach(img => {
            let src = img.src;
            // Upgrade thumbnail URLs to original high-res images if possible
            if (src && src.includes('236x')) {
                src = src.replace('236x', 'originals');
            } else if (src && src.includes('474x')) {
                src = src.replace('474x', 'originals');
            }
            if (src && src.startsWith('http')) {
                mediaUrls.add(src);
            }
        });

        const urlsArray = Array.from(mediaUrls);

        if (urlsArray.length === 0) {
            throw new Error('No downloadable pins found on this board. Ensure it is public.');
        }

        statusDiv.textContent = `Found ${urlsArray.length} items. Downloading files...`;
        progressBar.style.width = '40%';

        const zip = new JSZip();
        const folder = zip.folder("pinterest-board");
        
        let completed = 0;
        
        // Download files in parallel batches to build the zip
        for (let i = 0; i < urlsArray.length; i++) {
            const fileUrl = urlsArray[i];
            try {
                const fileResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(fileUrl)}`);
                const blob = await fileResponse.blob();
                const filename = `pin_${i + 1}.${blob.type.includes('video') ? 'mp4' : 'jpg'}`;
                folder.file(filename, blob);
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
        
        // Trigger download
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
