require('dotenv').config();
const express = require('express');
const axios = require('axios');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.post('/process', async (req, res) => {
    try {
        const { youtubeUrl, action } = req.body;
        
        if (!ytdl.validateURL(youtubeUrl)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const videoId = ytdl.getURLVideoID(youtubeUrl);
        const tempFileName = `temp_${videoId}.mp4`;
        const outputFileName = `${action}_${videoId}.mp4`;
        const outputPath = path.join(__dirname, 'public', 'downloads', outputFileName);

        // Download the video
        const videoStream = ytdl(youtubeUrl, { quality: 'highestaudio' });
        
        // Process based on action
        switch(action) {
            case 'lofi':
                await processLofi(videoStream, outputPath);
                break;
            case 'slow':
                await processSlow(videoStream, outputPath);
                break;
            case 'reverse':
                await processReverse(videoStream, outputPath);
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        res.json({ 
            downloadUrl: `/downloads/${outputFileName}`,
            videoInfo: await getVideoInfo(youtubeUrl)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Processing failed' });
    }
});

// Processing functions
async function processLofi(inputStream, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputStream)
            .audioFilters([
                'bass=g=5:f=110:w=0.5',
                'treble=g=-5',
                'aresample=44100',
                'asetrate=44100*0.8',
                'vibrato=f=6:d=0.5'
            ])
            .videoFilters('fps=10,scale=640:-1')
            .outputOptions('-preset ultrafast')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

async function processSlow(inputStream, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputStream)
            .audioFilters('atempo=0.7')
            .videoFilters('setpts=1.5*PTS')
            .outputOptions('-preset ultrafast')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

async function processReverse(inputStream, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputStream)
            .audioFilters('areverse')
            .videoFilters('reverse')
            .outputOptions('-preset ultrafast')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

async function getVideoInfo(url) {
    const info = await ytdl.getInfo(url);
    return {
        title: info.videoDetails.title,
        thumbnail: info.videoDetails.thumbnails[0].url,
        duration: info.videoDetails.lengthSeconds
    };
}

// Cleanup old files
setInterval(() => {
    const dir = path.join(__dirname, 'public', 'downloads');
    fs.readdir(dir, (err, files) => {
        if (err) return;
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            const now = new Date().getTime();
            const endTime = new Date(stat.mtime).getTime() + 3600000; // 1 hour
            
            if (now > endTime) {
                fs.unlinkSync(filePath);
            }
        });
    });
}, 3600000); // Run every hour

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});