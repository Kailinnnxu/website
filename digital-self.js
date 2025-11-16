// Digital Self Scene Loop
class SceneLoop {
    constructor() {
        this.currentSceneIndex = 0;
        this.scenes = [];
        this.schedule = null;
        this.intervalId = null;
        this.intervalSec = 10;
        this.currentBlock = null;
        
        // Settings
        this.glowEnabled = true;
        this.audioEnabled = false;
        this.videoAudioEnabled = false;
        this.ambientVolume = 1.0; // 100% default
        this.videoVolume = 0.04; // 4% default
        
        // DOM elements
        this.sceneWrapper = document.getElementById('scene-wrapper');
        this.currentMediaElement = null; // Will hold either img or video element
        this.overlay = document.querySelector('.scene-overlay');
        this.glowOverlay = document.getElementById('glow-overlay');
        this.audioContext = null;
        this.audioSource = null;
        this.ambientGainNode = null;
        
        // Settings elements
        this.settingsPanel = document.querySelector('.settings-panel');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.settingsMenu = document.getElementById('settings-menu');
        this.glowToggle = document.getElementById('glow-toggle');
        this.audioToggle = document.getElementById('audio-toggle');
        this.videoAudioToggle = document.getElementById('video-audio-toggle');
        this.ambientVolumeSlider = document.getElementById('ambient-volume');
        this.ambientVolumeValue = document.getElementById('ambient-volume-value');
        this.videoVolumeSlider = document.getElementById('video-volume');
        this.videoVolumeValue = document.getElementById('video-volume-value');
        
        this.init();
    }
    
    async init() {
        // Load schedule
        await this.loadSchedule();
        
        // Determine current scenes based on schedule
        this.updateCurrentScenes();
        
        // Ensure scene wrapper exists
        if (!this.sceneWrapper) {
            console.error('Scene wrapper element not found');
            return;
        }
        
        // Setup settings first (needed for video audio setting)
        this.setupSettings();
        
        // Enable video audio on first user interaction (for browser autoplay policy)
        this.setupVideoAudioEnabler();
        
        // Load first scene
        if (this.scenes.length > 0) {
            this.loadScene(this.scenes[0]);
        } else {
            this.loadScene('assets/scenes/default.png');
        }
        
        // Start loop
        this.startLoop();
    }
    
    async loadSchedule() {
        try {
            const response = await fetch('schedule.json');
            this.schedule = await response.json();
            this.intervalSec = this.schedule.intervalSec || 10;
        } catch (error) {
            console.warn('Could not load schedule.json, using default settings');
            // Default schedule
            this.schedule = {
                intervalSec: 10,
                blocks: [],
                defaultScene: 'assets/scenes/default.png'
            };
        }
    }
    
    updateCurrentScenes() {
        const now = new Date();
        const currentTime = this.formatTime(now);
        
        // Find matching block
        let activeBlock = null;
        for (const block of this.schedule.blocks || []) {
            if (this.isTimeInRange(currentTime, block.start, block.end)) {
                activeBlock = block;
                break;
            }
        }
        
        this.currentBlock = activeBlock;
        
        if (activeBlock && activeBlock.scenes && activeBlock.scenes.length > 0) {
            this.scenes = activeBlock.scenes.map(scene => 
                scene.startsWith('assets/') ? scene : `assets/scenes/${scene}`
            );
        } else {
            // Use default scene
            const defaultScene = this.schedule.defaultScene || 'assets/scenes/default.png';
            this.scenes = [defaultScene];
        }
        
        // Reset index if current scene is not in new list
        if (this.currentSceneIndex >= this.scenes.length) {
            this.currentSceneIndex = 0;
        }
    }
    
    formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    isTimeInRange(current, start, end) {
        const [currentH, currentM] = current.split(':').map(Number);
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        
        const currentMinutes = currentH * 60 + currentM;
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        if (startMinutes <= endMinutes) {
            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
        } else {
            // Handles overnight ranges (e.g., 22:00 to 06:00)
            return currentMinutes >= startMinutes || currentMinutes < endMinutes;
        }
    }
    
    loadScene(scenePath) {
        console.log('Loading scene:', scenePath);
        
        // Determine if it's a video or image
        const isVideo = scenePath.toLowerCase().endsWith('.mp4') || 
                       scenePath.toLowerCase().endsWith('.webm') ||
                       scenePath.toLowerCase().endsWith('.mov');
        
        if (isVideo) {
            this.loadVideo(scenePath);
        } else {
            this.loadImage(scenePath);
        }
    }
    
    loadImage(imagePath) {
        // Preload next image
        const img = new Image();
        img.onload = () => {
            console.log('Image preloaded successfully:', imagePath);
            // Check if this is the first load
            const hasExistingMedia = this.currentMediaElement && 
                                    this.currentMediaElement.src &&
                                    this.currentMediaElement.src !== '' &&
                                    this.currentMediaElement.src !== window.location.href;
            
            if (!hasExistingMedia) {
                // First load - direct set without transition
                this.displayImage(imagePath);
            } else {
                // Use transition for subsequent loads
                this.transitionToScene(imagePath, 'image');
            }
        };
        img.onerror = () => {
            console.error('Failed to preload image:', imagePath);
            console.warn(`Failed to load scene: ${imagePath}`);
            // Try default if available
            if (imagePath !== 'assets/scenes/default.png') {
                this.loadScene('assets/scenes/default.png');
            } else {
                console.error('Failed to load default scene');
            }
        };
        img.src = imagePath;
    }
    
    loadVideo(videoPath) {
        // Preload next video
        const video = document.createElement('video');
        video.preload = 'auto';
        
        video.onloadeddata = () => {
            console.log('Video preloaded successfully:', videoPath);
            // Check if this is the first load
            const hasExistingMedia = this.currentMediaElement && 
                                    this.currentMediaElement.src &&
                                    this.currentMediaElement.src !== '' &&
                                    this.currentMediaElement.src !== window.location.href;
            
            if (!hasExistingMedia) {
                // First load - direct set without transition
                this.displayVideo(videoPath);
            } else {
                // Use transition for subsequent loads
                this.transitionToScene(videoPath, 'video');
            }
        };
        
        video.onerror = () => {
            console.error('Failed to preload video:', videoPath);
            console.warn(`Failed to load scene: ${videoPath}`);
            // Try default if available
            if (videoPath !== 'assets/scenes/default.mp4') {
                this.loadScene('assets/scenes/default.mp4');
            } else {
                console.error('Failed to load default scene');
            }
        };
        
        video.src = videoPath;
    }
    
    displayImage(imagePath) {
        // Remove existing media element
        if (this.currentMediaElement) {
            this.currentMediaElement.remove();
        }
        
        // Create and display image
        const img = document.createElement('img');
        img.id = 'current-scene';
        img.className = 'scene-image';
        img.src = imagePath;
        img.alt = 'Scene';
        img.style.opacity = '1';
        
        this.sceneWrapper.appendChild(img);
        this.currentMediaElement = img;
    }
    
    displayVideo(videoPath) {
        // Remove existing media element
        if (this.currentMediaElement) {
            this.currentMediaElement.pause();
            this.currentMediaElement.remove();
        }
        
        // Create and display video
        const video = document.createElement('video');
        video.id = 'current-scene';
        video.className = 'scene-video';
        video.src = videoPath;
        video.loop = true;
        video.autoplay = true;
        video.muted = !this.videoAudioEnabled; // Mute based on setting
        video.volume = this.videoVolume; // Set volume
        video.playsInline = true; // For mobile devices
        video.style.opacity = '1';
        
        this.sceneWrapper.appendChild(video);
        this.currentMediaElement = video;
        
        // Try to play video with audio first (if enabled)
        if (this.videoAudioEnabled) {
            video.muted = false; // Try unmuted first
            const playPromise = video.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Autoplay with audio succeeded!
                    console.log('Video playing with audio');
                }).catch(err => {
                    // Autoplay with audio was prevented (browser policy)
                    console.log('Autoplay with audio blocked, playing muted. Click anywhere to enable audio.');
                    video.muted = true;
                    video.play().then(() => {
                        // Set up unmute on user interaction
                        this.setupVideoAudioUnmute(video);
                        // Also use the global enabler if available
                        if (this.enableVideoAudioOnInteraction) {
                            // Re-enable the listener for this video
                            const enableAudio = () => {
                                if (video === this.currentMediaElement && this.videoAudioEnabled && video.muted) {
                                    video.muted = false;
                                    if (video.paused) {
                                        video.play().catch(e => console.warn('Failed to play after unmute:', e));
                                    }
                                }
                            };
                            document.addEventListener('click', enableAudio, { once: true });
                            document.addEventListener('touchstart', enableAudio, { once: true });
                        }
                    }).catch(e => {
                        console.warn('Muted autoplay also failed:', e);
                    });
                });
            }
        } else {
            // Video audio disabled, play muted
            video.muted = true;
            video.play().catch(err => {
                console.warn('Video autoplay failed:', err);
            });
        }
    }
    
    setupVideoAudioUnmute(video) {
        // Unmute video after user interaction
        const unmuteOnInteraction = () => {
            if (this.videoAudioEnabled && video.muted) {
                video.muted = false;
                // Try to play if paused
                if (video.paused) {
                    video.play().catch(err => {
                        console.warn('Failed to play video after unmute:', err);
                    });
                }
            }
        };
        
        document.addEventListener('click', unmuteOnInteraction, { once: true });
        document.addEventListener('touchstart', unmuteOnInteraction, { once: true });
    }
    
    setupVideoAudioEnabler() {
        // Enable video audio on first user interaction anywhere on page
        const enableVideoAudio = () => {
            // Enable audio for current video if it exists
            if (this.currentMediaElement && 
                this.currentMediaElement.tagName === 'VIDEO' && 
                this.videoAudioEnabled && 
                this.currentMediaElement.muted) {
                this.currentMediaElement.muted = false;
                // Try to play if paused
                if (this.currentMediaElement.paused) {
                    this.currentMediaElement.play().catch(err => {
                        console.warn('Failed to play video with audio:', err);
                    });
                }
            }
        };
        
        // Store the function so we can call it when videos load
        this.enableVideoAudioOnInteraction = enableVideoAudio;
        
        // Listen for first user interaction
        document.addEventListener('click', enableVideoAudio, { once: true });
        document.addEventListener('touchstart', enableVideoAudio, { once: true });
    }
    
    transitionToScene(scenePath, mediaType) {
        if (!this.currentMediaElement) {
            // First load - no transition needed
            if (mediaType === 'video') {
                this.displayVideo(scenePath);
            } else {
                this.displayImage(scenePath);
            }
            return;
        }
        
        // Fade out
        this.currentMediaElement.classList.add('fade-out');
        this.overlay.classList.add('active');
        
        setTimeout(() => {
            // Change media
            if (mediaType === 'video') {
                this.displayVideo(scenePath);
            } else {
                this.displayImage(scenePath);
            }
            
            // Fade in
            setTimeout(() => {
                this.overlay.classList.remove('active');
                if (this.currentMediaElement) {
                    this.currentMediaElement.classList.remove('fade-in');
                }
            }, 100);
        }, 600);
    }
    
    nextScene() {
        // Check if schedule changed (e.g., new time block)
        this.updateCurrentScenes();
        
        if (this.scenes.length === 0) {
            return;
        }
        
        // Calculate next index
        const nextIndex = (this.currentSceneIndex + 1) % this.scenes.length;
        const nextScene = this.scenes[nextIndex];
        
        // Only transition if the scene is different
        if (this.currentMediaElement && this.currentMediaElement.src) {
            const currentScenePath = this.currentMediaElement.src;
            const currentSceneName = currentScenePath.split('/').pop();
            const nextSceneName = nextScene.split('/').pop();
            
            if (currentSceneName === nextSceneName) {
                // Same scene, just update index without transitioning
                this.currentSceneIndex = nextIndex;
                return;
            }
        }
        
        this.currentSceneIndex = nextIndex;
        this.loadScene(nextScene);
    }
    
    startLoop() {
        // Check schedule every minute to update scenes if needed
        setInterval(() => {
            this.updateCurrentScenes();
        }, 60000);
        
        // Scene transition loop
        this.intervalId = setInterval(() => {
            this.nextScene();
        }, this.intervalSec * 1000);
    }
    
    setupSettings() {
        // Toggle settings menu
        this.settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsMenu.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.settingsPanel.contains(e.target)) {
                this.settingsMenu.classList.remove('active');
            }
        });
        
        // Glow toggle
        this.glowToggle.addEventListener('change', (e) => {
            this.glowEnabled = e.target.checked;
            if (this.glowEnabled) {
                this.glowOverlay.classList.add('active');
            } else {
                this.glowOverlay.classList.remove('active');
            }
        });
        
        // Initialize glow
        if (this.glowEnabled) {
            this.glowOverlay.classList.add('active');
        }
        
        // Audio toggle - generate pink/brown noise
        this.audioToggle.addEventListener('change', (e) => {
            this.audioEnabled = e.target.checked;
            if (this.audioEnabled) {
                this.startAmbientAudio();
            } else {
                this.stopAmbientAudio();
            }
        });
        
        // Video audio toggle
        this.videoAudioToggle.addEventListener('change', (e) => {
            this.videoAudioEnabled = e.target.checked;
            // Update current video if it exists
            if (this.currentMediaElement && this.currentMediaElement.tagName === 'VIDEO') {
                this.currentMediaElement.muted = !this.videoAudioEnabled;
                // Set volume
                this.currentMediaElement.volume = this.videoVolume;
                // Try to play with new audio setting
                if (this.videoAudioEnabled && this.currentMediaElement.paused) {
                    this.currentMediaElement.play().catch(err => {
                        console.warn('Failed to play video with audio:', err);
                    });
                }
            }
        });
        
        // Ambient audio volume slider
        this.ambientVolumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100; // Convert 0-100 to 0-1
            this.ambientVolume = volume;
            this.ambientVolumeValue.textContent = e.target.value + '%';
            
            // Update gain node if audio is playing
            if (this.ambientGainNode) {
                this.ambientGainNode.gain.value = volume;
            }
        });
        
        // Video audio volume slider
        this.videoVolumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100; // Convert 0-100 to 0-1
            this.videoVolume = volume;
            this.videoVolumeValue.textContent = e.target.value + '%';
            
            // Update current video volume if it exists
            if (this.currentMediaElement && this.currentMediaElement.tagName === 'VIDEO') {
                this.currentMediaElement.volume = volume;
            }
        });
        
        // Initialize volume display values
        this.ambientVolumeValue.textContent = Math.round(this.ambientVolume * 100) + '%';
        this.videoVolumeValue.textContent = Math.round(this.videoVolume * 100) + '%';
    }

    startAmbientAudio() {
        try {
            // Clean up any existing audio
            this.stopAmbientAudio();
            
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context if suspended (required by some browsers)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const bufferSize = 10 * this.audioContext.sampleRate;  // 10 seconds (or even 20-30 seconds)
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            
            let lastOut = 0.0;
            
            // Generate pink/brown-ish noise
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02; // pink/brown-ish smoothing
                lastOut = data[i];
                data[i] *= 0.1; // base volume (increased from 0.02 for louder max volume)
            }
            
            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.ambientVolume; // Use current volume setting (0-1 range)
            
            // Create and start source
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = buffer;
            this.audioSource.loop = true;
            this.audioSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            this.audioSource.start();
            
            // Store gain node for potential volume adjustments
            this.ambientGainNode = gainNode;
            
        } catch (err) {
            console.warn('Audio generation failed:', err);
            this.audioEnabled = false;
            this.audioToggle.checked = false;
        }
    }

    stopAmbientAudio() {
        try {
            if (this.audioSource) {
                this.audioSource.stop();
                this.audioSource = null;
            }
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
        } catch (err) {
            // Ignore errors during cleanup
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SceneLoop();
});
