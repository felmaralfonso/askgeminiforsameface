// --- script.js (Illustrative Snippets) ---

const video = document.getElementById('webcamVideo');
const canvas = document.getElementById('snapshotCanvas');
const snapshotImage = document.getElementById('snapshotImage');
const startButton = document.getElementById('startButton');
const captureButton = document.getElementById('captureButton');
const analyzeButton = document.getElementById('analyzeButton');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');

let capturedImageDataUrl = null;
let stream = null; // To store the stream object

// Start Camera Logic
startButton.addEventListener('click', async () => {
    statusDiv.textContent = 'Requesting camera access...';
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        video.onloadedmetadata = () => { // Wait for video metadata
            statusDiv.textContent = 'Camera started. Ready to capture.';
            captureButton.disabled = false;
            startButton.disabled = true; // Disable start once running
        };
    } catch (err) {
        console.error("Error accessing camera:", err);
        statusDiv.textContent = `Error: ${err.name} - ${err.message}`;
        alert("Could not access webcam. Please ensure permissions are granted.");
        captureButton.disabled = true;
        analyzeButton.disabled = true;
    }
});

// Capture Snapshot Logic
captureButton.addEventListener('click', () => {
    if (!stream || !video.videoWidth) {
         statusDiv.textContent = 'Camera not ready yet.';
         return;
    }
    statusDiv.textContent = 'Capturing...';
    const context = canvas.getContext('2d');
    // Set canvas dimensions based on the actual video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // Draw the current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data as Base64
    capturedImageDataUrl = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG, quality 0.9

    // Display the snapshot (optional)
    snapshotImage.src = capturedImageDataUrl;
    snapshotImage.style.display = 'block';

    analyzeButton.disabled = false;
    statusDiv.textContent = 'Snapshot captured. Ready to analyze.';
});

// Analyze Face Logic (Calls YOUR backend)
analyzeButton.addEventListener('click', async () => {
    if (!capturedImageDataUrl) {
        alert("Please capture a snapshot first.");
        return;
    }

    statusDiv.textContent = 'Analyzing... Please wait.';
    resultsDiv.textContent = ''; // Clear previous results
    analyzeButton.disabled = true;
    captureButton.disabled = true; // Disable capture during analysis

    try {
        // REMOVE 'data:image/jpeg;base64,' prefix if your backend expects pure base64
        const base64Image = capturedImageDataUrl.split(',')[1];

        // *** Send to YOUR backend proxy endpoint ***
        const response = await fetch('/api/analyze', { // Example endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Image })
        });

        if (!response.ok) {
            // Try to get error details from backend response
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${errorData.error || 'Unknown backend error'}`;
            } catch (e) { /* Ignore if response isn't JSON */ }
            throw new Error(errorMsg);
        }

        const data = await response.json(); // Expecting { analysis: "..." } from backend

        resultsDiv.textContent = data.analysis || "No analysis text received.";
        statusDiv.textContent = 'Analysis complete.';

    } catch (error) {
        console.error('Error during analysis:', error);
        resultsDiv.textContent = `Analysis failed: ${error.message}`;
        statusDiv.textContent = 'Analysis failed.';
    } finally {
        // Re-enable buttons
         captureButton.disabled = false; // Re-enable capture
         analyzeButton.disabled = false; // Allow re-analysis of same image or new capture
    }
});

// Optional: Stop camera when closing tab/window
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});