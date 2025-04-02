// server.js

// --- 1. Load Modules ---
require('dotenv').config(); // Load environment variables from .env file FIRST
const express = require('express');
const path = require('path'); // Node.js module for working with file paths
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// --- 2. Initialize Express App ---
const app = express();
const port = process.env.PORT || 3000; // Use environment port or 3000

// --- 3. Configure Gemini ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("\n!!! ERROR: GEMINI_API_KEY is not defined in your .env file !!!\n");
    console.error("Please create a .env file in the project root and add the line:");
    console.error("GEMINI_API_KEY=YOUR_ACTUAL_API_KEY_HERE\n");
    process.exit(1); // Exit if API key is missing
}

const genAI = new GoogleGenerativeAI(apiKey);

// --- Choose a suitable Vision Model ---
const modelName = "gemini-2.5-pro-exp-03-25"; // Good balance of speed, cost, capability
// const modelName = "gemini-1.5-pro-latest"; // More powerful option
console.log(`Using Gemini Model: ${modelName}`);

const model = genAI.getGenerativeModel({
    model: modelName,
    // Optional safety settings (defaults are usually okay)
    // safetySettings: [ ... ],
});

// --- 4. Middleware Setup ---
app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies (increased limit for images)
app.use(express.static(path.join(__dirname, 'public'))); // Serve static frontend files

// --- 5. API Route for Look-Alike Analysis ---
app.post('/api/analyze', async (req, res) => {
    console.log("\n--- Received request on POST /api/analyze ---");

    const { image } = req.body; // Expecting { "image": "base64string..." }

    if (!image) {
        console.error("Error: No image data received in the request body.");
        return res.status(400).json({ error: 'No image data provided.' });
    }

    try {
        console.log("Image data received (preview):", image.substring(0, 50) + "...");
        console.log("Sending request to Gemini API for look-alike analysis...");

        // --- Define the Prompt for Look-Alike Analysis ---
        // This prompt asks for resemblance to PUBLIC FIGURES and descriptions, NOT percentages.
        const prompt = `Analyze the face in this image. Setting aside major fame, does this person strongly remind you of *anyone* whose image might be publicly available on the internet? Think broadly – from well-known figures to people notable in specific fields, historical images, or even character archetypes represented online (like stock photo models).

If you find a potential resemblance:
1.  Identify or describe the person/people they resemble. If naming someone, focus on those with a public identity. If it's more of a 'type', describe that (e.g., 'resembles models often seen in X type of advertisement'). **Crucially, do not attempt to identify or guess the identity of private individuals.**
2.  Explain *why* – which specific facial features (eyes, nose, mouth shape, face structure, hair, etc.) create this resemblance?

If no particular resemblance stands out, simply state that. Focus on reasonably clear similarities.`;
        // --- End of Prompt ---

        console.log(`Using Prompt: "${prompt}"`);

        // Prepare image data for the SDK
        const imagePart = {
            inlineData: {
                data: image, // Pure Base64 string
                mimeType: 'image/jpeg' // Or 'image/png' depending on your frontend capture
            }
        };

        // --- Call Gemini API ---
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        console.log("--- Received response from Gemini API ---");

        // --- DETAILED LOGGING (Essential for Debugging) ---
        console.log("Gemini Raw Response Object:", JSON.stringify(response, null, 2));
        console.log("Gemini Prompt Feedback:", response.promptFeedback);
        console.log("Gemini Finish Reason:", response.candidates?.[0]?.finishReason);
        console.log("Gemini Safety Ratings:", response.candidates?.[0]?.safetyRatings);

        // Extract the descriptive text
        const analysisText = response.text();
        console.log(`Extracted Text (analysisText): >>>\n${analysisText}\n<<<`);

        // Check if response was potentially blocked by safety filters
        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) {
            console.warn(`*** WARNING: Gemini response potentially blocked. Reason: ${blockReason}. Analysis text might be empty or incomplete. ***`);
            // Current behavior: Send whatever text was extracted (might be empty)
            // Alternative: You could choose to send a specific error message back instead:
            // return res.status(400).json({ error: `Analysis blocked by safety filters: ${blockReason}` });
        }

        // --- Send Response to Frontend ---
        console.log("Sending successful JSON response back to client.");
        // Send the descriptive text received from Gemini
        res.status(200).json({ analysis: analysisText });

    } catch (error) {
        // --- Error Handling ---
        console.error('--- ERROR during Gemini API call or processing ---');
        console.error("Error Message:", error.message);
        if (error.message.includes('SAFETY')) {
             console.error("Error likely related to safety settings or blocked content.");
        }
        // Log the full error object if helpful
        // console.error("Full Error Object:", error);
        res.status(500).json({ error: 'Failed to analyze image due to an internal server error.' });
    }
});

// --- 6. Root Route ---
// Serves the main index.html file from the 'public' directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 7. Start the Server ---
app.listen(port, () => {
    console.log(`\nServer listening successfully at http://localhost:${port}`);
    console.log("Serving frontend files from the 'public' directory.");
    console.log("Ensure .env file exists with a valid GEMINI_API_KEY.");
    console.log("Press Ctrl+C to stop the server.");
});