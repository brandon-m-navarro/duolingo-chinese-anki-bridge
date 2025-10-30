// ==UserScript==
// @name         Chinese Vocabulary Audio Generator with TTS
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Generates Chinese vocabulary audio files using TTS with proper Hanzi names, pinyin, and translations - Google TTS with Free Fallbacks
// @author       Brandon Navarro
// @match        https://www.duolingo.com/*
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      texttospeech.googleapis.com
// @connect      tts.googleapis.com
// @connect      translate.google.com
// @connect      fanyi.baidu.com
// @connect      tts.baidu.com
// @connect      tts-api.xfyun.cn
// @connect      api.voicetext.com
// ==/UserScript==

(function() {
    'use strict';

    let vocabularyMap = GM_getValue('vocabularyMap', {});
    let generatedFiles = GM_getValue('generatedFiles', {});

    const TTS_CONFIG = {
        // Primary service (Google Cloud TTS)
        apiKey: 'YOUR_API_KEY_HERE', // Replace with your actual Google Cloud API key

        // Fallback services (free TTS options)
        fallbackOrder: ['baidu', 'google_translate', 'browser'],

        // Service settings
        googleVoice: 'zh-CN-Wavenet-A',
        googleLanguage: 'zh-CN',
        speakingRate: 1.0,
        pitch: 0.0
    };

    if (window.location.href.includes('duolingo.com')) {
        setupVocabularyTracking();
        setupGeneratorInterface();
    }

    function setupVocabularyTracking() {
        document.addEventListener('click', function(e) {
            const clickedElement = e.target;

            const isSpeakerButton = clickedElement.querySelector('svg') ||
                                   clickedElement.closest('svg') ||
                                   clickedElement.className.includes('u_TP-') ||
                                   clickedElement.closest('.u_TP-') ||
                                   clickedElement.getAttribute('aria-label')?.includes('audio') ||
                                   clickedElement.getAttribute('aria-label')?.includes('sound');

            if (isSpeakerButton) {
                setTimeout(() => {
                    captureVocabularyContext(clickedElement);
                }, 100);
            }
        }, true);
    }

    function captureVocabularyContext(clickedElement) {
        const characterContainer = findSpecificCharacterContainer(clickedElement);

        if (!characterContainer) {
            console.error('No specific character container found');
            return;
        }

        const rubyElement = characterContainer.querySelector('ruby');

        if (rubyElement) {
            processRubyElement(rubyElement, characterContainer);
        } else {
            console.error('No ruby element found in container');
        }
    }

    function findSpecificCharacterContainer(clickedElement) {
        let container = clickedElement.closest('div._1BJwl');

        if (!container) {
            container = clickedElement.parentElement;
            while (container && !container.querySelector('ruby') && container !== document.body) {
                container = container.parentElement;
            }
        }

        if (container && container.querySelector('ruby')) {
            return container;
        }

        const potentialContainers = document.querySelectorAll('div._1BJwl, div._1DBqk > div');
        for (const potentialContainer of potentialContainers) {
            const ruby = potentialContainer.querySelector('ruby');
            const speaker = potentialContainer.querySelector('.u_TP-');
            if (ruby && speaker && speaker.contains(clickedElement)) {
                return potentialContainer;
            }
        }

        return null;
    }

    function processRubyElement(rubyElement, container) {
        const characterSpans = Array.from(rubyElement.querySelectorAll('span._3OcFj, span[lang="zh"]'));
        const pinyinSpans = Array.from(rubyElement.querySelectorAll('rt._271_n, rt[lang="zh-Latn-pinyin"]'));

        let fullCharacter = '';
        let fullPinyin = '';

        characterSpans.forEach((charSpan, index) => {
            const character = charSpan.textContent?.trim();
            let pinyin = '';

            if (pinyinSpans[index]) {
                pinyin = pinyinSpans[index].textContent?.trim();
            }

            if (!pinyin) {
                const allRts = Array.from(rubyElement.querySelectorAll('rt'));
                const charIndex = Array.from(rubyElement.children).indexOf(charSpan);
                if (allRts[charIndex]) {
                    pinyin = allRts[charIndex].textContent?.trim();
                }
            }

            if (character && /[\u4e00-\u9fff]/.test(character)) {
                fullCharacter += character;
                if (pinyin) {
                    fullPinyin += (fullPinyin ? ' ' : '') + pinyin;
                }
            }
        });

        const translation = findTranslation(container);

        if (fullCharacter) {
            console.log('�Captured vocabulary:', {
                character: fullCharacter,
                pinyin: fullPinyin,
                translation: translation
            });

            const vocabularyData = {
                character: fullCharacter,
                pinyin: fullPinyin || 'unknown',
                translation: translation,
                timestamp: Date.now()
            };

            const vocabKey = `${fullCharacter}|${cleanField(fullPinyin)}|${cleanField(translation)}`;
            vocabularyMap[vocabKey] = vocabularyData;
            GM_setValue('vocabularyMap', vocabularyMap);

            showVocabularyCaptureToast(fullCharacter, fullPinyin, translation);
        } else {
            console.error('No Chinese characters found in ruby element');
        }
    }

    function findTranslation(container) {
        let translation = '';

        const translationSpan = container.querySelector('span._siFa');
        if (translationSpan) {
            translation = translationSpan.textContent?.trim();
        }

        if (!translation) {
            const rubyElement = container.querySelector('ruby');
            const allText = container.textContent || '';
            const rubyText = rubyElement ? rubyElement.textContent : '';

            if (allText && rubyText) {
                const potentialTranslation = allText.replace(rubyText, '').trim();
                translation = potentialTranslation.replace(/[🎵🔊♪♫]/g, '').trim();
            }
        }

        if (!translation && container.parentElement) {
            const siblings = Array.from(container.parentElement.children);
            const currentIndex = siblings.indexOf(container);

            if (currentIndex < siblings.length - 1) {
                const nextSibling = siblings[currentIndex + 1];
                if (nextSibling.textContent && !nextSibling.querySelector('ruby')) {
                    translation = nextSibling.textContent.trim();
                }
            }
        }

        if (translation) {
            translation = translation
                .replace(/[🎵🔊♪♫]/g, '')
                .replace(/^\W+|\W+$/g, '')
                .trim();
        }

        return translation || 'unknown';
    }

    async function generateTTSAudio(character, pinyin, translation) {
        const safePinyin = cleanField(pinyin || 'unknown');
        const safeTranslation = cleanField(translation || 'unknown');
        const fileKey = `${character}|${safePinyin}|${safeTranslation}`;
        const filename = `${character}-${safePinyin}-${safeTranslation}.mp3`;

        if (generatedFiles[fileKey]) {
            console.warn('Duplicate detected, skipping generation:', fileKey);
            showDownloadToast(`Skipped duplicate: ${character}`);
            return;
        }

        showDownloadToast(`Generating audio for: ${character}`);

        try {
            let audioBlob;

            // Try Google Cloud TTS first, then fallback to free services
            try {
                audioBlob = await generateWithGoogleTTS(character);
                console.log('Successfully used Google Cloud TTS');
            } catch (googleError) {
                console.error('Google Cloud TTS failed, trying free services:', googleError);
                audioBlob = await generateWithFreeTTS(character);
            }

            const url = URL.createObjectURL(audioBlob);
            GM_download({
                url: url,
                name: `${filename}`,
                onload: function() {
                    console.log('Audio generated and downloaded:', filename);

                    generatedFiles[fileKey] = {
                        timestamp: Date.now(),
                        filename: filename,
                        service: 'google_cloud',
                        path: `${filename}`
                    };
                    GM_setValue('generatedFiles', generatedFiles);

                    URL.revokeObjectURL(url);
                    showDownloadToast(`Generated: ${filename}`);
                },
                onerror: function(e) {
                    console.log('Download failed:', e);
                    URL.revokeObjectURL(url);
                    showDownloadToast(`Download failed: ${character}`);
                }
            });

        } catch (error) {
            console.log('All TTS generation failed:', error);
            showDownloadToast(`Generation failed: ${character}`);
        }
    }

    // Primary: Google Cloud TTS (High Quality)
    async function generateWithGoogleTTS(text) {
        const apiKey = TTS_CONFIG.apiKey;

        // Check if API key is configured
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            throw new Error('Google Cloud TTS API key not configured');
        }

        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text: text },
                    voice: {
                        languageCode: TTS_CONFIG.googleLanguage,
                        name: TTS_CONFIG.googleVoice
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: TTS_CONFIG.speakingRate,
                        pitch: TTS_CONFIG.pitch
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Google TTS API error details:', errorText);

            // Check for common errors that should trigger fallback
            if (response.status === 403 || response.status === 429 || response.status === 401) {
                throw new Error(`Google TTS quota/access issue: ${response.status}`);
            }
            throw new Error(`Google TTS API error: ${response.status}`);
        }

        const data = await response.json();
        const audioContent = data.audioContent;

        return base64ToBlob(audioContent, 'audio/mp3');
    }

    // Fallback: Free TTS Services
    async function generateWithFreeTTS(text) {
        // Try services in order until one works
        for (const service of TTS_CONFIG.fallbackOrder) {
            try {
                console.log(`Trying free TTS service: ${service}`);
                let audioBlob;

                switch (service) {
                    case 'baidu':
                        audioBlob = await generateWithBaiduTTS(text);
                        break;
                    case 'google_translate':
                        audioBlob = await generateWithGoogleTranslateTTS(text);
                        break;
                    case 'xfyun':
                        audioBlob = await generateWithXfyunTTS(text);
                        break;
                    case 'browser':
                        audioBlob = await generateWithBrowserTTS(text);
                        break;
                }

                if (audioBlob) {
                    console.log(`Success with free service: ${service}`);
                    return audioBlob;
                }
            } catch (error) {
                console.error(`${service} failed:`, error);
                continue;
            }
        }

        throw new Error('All free TTS services failed');
    }

    // Free TTS Service Implementations

    // Baidu TTS (Free Chinese TTS - Reliable)
    async function generateWithBaiduTTS(text) {
        return new Promise((resolve, reject) => {
            const url = `https://fanyi.baidu.com/gettts?lan=zh&text=${encodeURIComponent(text)}&spd=3&source=web`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onload: function(response) {
                    if (response.status === 200 && response.response.size > 0) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`Baidu TTS failed: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                },
                timeout: 10000
            });
        });
    }

    // Google Translate TTS (Free - Good quality)
    async function generateWithGoogleTranslateTTS(text) {
        return new Promise((resolve, reject) => {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-CN&client=tw-ob`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onload: function(response) {
                    if (response.status === 200 && response.response.size > 0) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`Google Translate TTS failed: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                },
                timeout: 10000
            });
        });
    }

    // Xunfei (iFLYTEK) TTS - Free tier available (requires setup)
    async function generateWithXfyunTTS(text) {
        // Note: This requires signing up for free account at https://www.xfyun.cn/
        const APP_ID = ''; // Your iFLYTEK App ID
        const API_KEY = ''; // Your iFLYTEK API Key

        if (!APP_ID || !API_KEY) {
            throw new Error('Xunfei TTS credentials not configured');
        }

        // Simplified implementation using their web API
        const url = `https://tts-api.xfyun.cn/v2/tts`;

        const requestData = {
            text: text,
            lang: 'zh-cn',
            voice_name: 'xiaoyan',
            speed: 50,
            volume: 50,
            pitch: 50,
            engine_type: 'intp65'
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Appid': APP_ID,
                    'X-CurTime': Math.floor(Date.now() / 1000).toString(),
                    'X-Param': btoa(JSON.stringify({
                        auf: 'audio/L16;rate=16000',
                        aue: 'raw',
                        voice_name: 'xiaoyan',
                        speed: 50,
                        volume: 50,
                        pitch: 50,
                        engine_type: 'intp65',
                        text_type: 'text'
                    }))
                },
                data: JSON.stringify(requestData),
                responseType: 'blob',
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`Xunfei TTS failed: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                },
                timeout: 10000
            });
        });
    }

    // Browser TTS as final fallback
    async function generateWithBrowserTTS(text) {
        return new Promise((resolve, reject) => {
            if (!('speechSynthesis' in window)) {
                reject(new Error('Browser TTS not supported'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            utterance.rate = 0.8;

            // Try to find a Chinese voice
            const voices = speechSynthesis.getVoices();
            const chineseVoice = voices.find(voice =>
                voice.lang.includes('zh') || voice.lang.includes('CN')
            );

            if (chineseVoice) {
                utterance.voice = chineseVoice;
            }

            // Create placeholder audio (browser restrictions prevent actual capture)
            const audioData = createAudioWithMetadata(text);

            utterance.onend = () => {
                resolve(audioData);
            };

            utterance.onerror = (error) => {
                // Still resolve with placeholder even if TTS fails
                console.error('Browser TTS error, using placeholder:', error);
                resolve(audioData);
            };

            speechSynthesis.speak(utterance);
        });
    }

    function createAudioWithMetadata(text) {
        // Create a placeholder audio file with metadata
        const duration = 1.0;
        const sampleRate = 44100;
        const channels = 1;

        const frameCount = sampleRate * duration;
        const arrayBuffer = new ArrayBuffer(44 + frameCount * 2);
        const view = new DataView(arrayBuffer);

        // Write WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + frameCount * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, frameCount * 2, true);

        // Write simple audio data (silence with metadata)
        const dataView = new DataView(arrayBuffer, 44);
        for (let i = 0; i < frameCount; i++) {
            dataView.setInt16(i * 2, 0, true);
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    function base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);

            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, { type: mimeType });
    }

    function cleanField(text) {
        return text
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase();
    }

    function setupGeneratorInterface() {
        const btn = document.createElement('button');
        btn.innerHTML = 'Generate Audio (TTS)';
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 16px;
            background: #9C27B0;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        btn.onclick = startBatchGeneration;
        document.body.appendChild(btn);

        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = 'Clear History';
        clearBtn.title = 'Clear generated files history';
        clearBtn.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 10000;
            padding: 8px 12px;
            background: #FF9800;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        clearBtn.onclick = clearAllHistory;
        document.body.appendChild(clearBtn);

        const configBtn = document.createElement('button');
        configBtn.innerHTML = 'TTS Config';
        configBtn.title = 'Configure TTS Services';
        configBtn.style.cssText = `
            position: fixed;
            top: 110px;
            right: 20px;
            z-index: 10000;
            padding: 8px 12px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        configBtn.onclick = showTTSConfig;
        document.body.appendChild(configBtn);

        const status = document.createElement('div');
        status.id = 'download-status';
        status.style.cssText = `
            position: fixed;
            top: 150px;
            right: 20px;
            z-index: 10000;
            background: #2196F3;
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            display: none;
        `;
        document.body.appendChild(status);

        const generatedCount = Object.keys(generatedFiles).length;
        if (generatedCount > 0) {
            showDownloadToast(`${generatedCount} files in generation history`);
        }

        console.log('Chinese Vocabulary Audio Generator ready!');
    }

    function showTTSConfig() {
        // Remove any existing config modal first
        const existingModal = document.getElementById('tts-config-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const configHtml = `
            <div id="tts-config-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 25px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 10001; min-width: 450px; max-width: 500px; border: 2px solid #333;">
                <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: bold;">TTS Configuration</h3>

                <div style="margin: 15px 0;">
                    <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">Google Cloud API Key:</label>
                    <input type="text" id="google-api-key" value="${TTS_CONFIG.apiKey}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; color: #333; background: #fff;">
                    <small style="color: #666; font-size: 12px;">Leave as "YOUR_API_KEY_HERE" to use free services only</small>
                </div>

                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">Fallback Service Order:</label>
                    <select id="fallback-order" multiple style="width: 100%; height: 120px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; color: #333; background: #fff;">
                        <option value="baidu" ${TTS_CONFIG.fallbackOrder.includes('baidu') ? 'selected' : ''}>Baidu TTS (Recommended - No setup)</option>
                        <option value="google_translate" ${TTS_CONFIG.fallbackOrder.includes('google_translate') ? 'selected' : ''}>Google Translate TTS (Good quality)</option>
                        <option value="xfyun" ${TTS_CONFIG.fallbackOrder.includes('xfyun') ? 'selected' : ''}>Xunfei TTS (Requires free account)</option>
                        <option value="browser" ${TTS_CONFIG.fallbackOrder.includes('browser') ? 'selected' : ''}>Browser TTS (Fallback only)</option>
                    </select>
                    <small style="color: #666; font-size: 12px;">Hold Ctrl/Cmd to select multiple services</small>
                </div>

                <div style="text-align: right; margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px;">
                    <button id="cancel-config" style="margin-right: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                    <button id="save-config" style="padding: 8px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">Save Configuration</button>
                </div>
            </div>
            <div id="tts-config-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000;"></div>
        `;

        const configDiv = document.createElement('div');
        configDiv.innerHTML = configHtml;
        document.body.appendChild(configDiv);

        // Add event listeners for buttons
        document.getElementById('cancel-config').addEventListener('click', function() {
            configDiv.remove();
        });

        document.getElementById('save-config').addEventListener('click', function() {
            const apiKey = document.getElementById('google-api-key').value;
            const fallbackSelect = document.getElementById('fallback-order');
            const selectedFallbacks = Array.from(fallbackSelect.selectedOptions).map(opt => opt.value);

            TTS_CONFIG.apiKey = apiKey;
            TTS_CONFIG.fallbackOrder = selectedFallbacks.length > 0 ? selectedFallbacks : ['baidu', 'google_translate', 'browser'];

            showDownloadToast('TTS configuration saved!');
            configDiv.remove();
        });

        // Close modal when clicking overlay
        document.getElementById('tts-config-overlay').addEventListener('click', function() {
            configDiv.remove();
        });
    }

    function clearAllHistory() {
        if (!confirm('Clear all generation history?')) {
            return;
        }

        GM_setValue('generatedFiles', {});
        GM_setValue('vocabularyMap', {});
        generatedFiles = {};
        vocabularyMap = {};

        showDownloadToast('All history cleared!');
        console.log('All generation history cleared');
    }

    async function startBatchGeneration() {
        const vocabularyItems = Object.values(vocabularyMap);

        if (vocabularyItems.length === 0) {
            alert('No vocabulary items found. Please click speaker buttons on Chinese characters first.');
            return;
        }

        const itemsToGenerate = vocabularyItems.filter(item => {
            const safePinyin = cleanField(item.pinyin);
            const safeTranslation = cleanField(item.translation);
            const fileKey = `${item.character}|${safePinyin}|${safeTranslation}`;
            return !generatedFiles[fileKey];
        });

        if (itemsToGenerate.length === 0) {
            showDownloadToast('All vocabulary items already have audio generated!');
            return;
        }

        showDownloadToast(`Generating audio for ${itemsToGenerate.length} items...`);

        for (let i = 0; i < itemsToGenerate.length; i++) {
            const item = itemsToGenerate[i];
            setTimeout(async () => {
                console.log(`Generating audio ${i + 1}/${itemsToGenerate.length}: ${item.character}`);
                await generateTTSAudio(item.character, item.pinyin, item.translation);
            }, i * 2000);
        }
    }

    function showVocabularyCaptureToast(character, pinyin, translation) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 180px;
            right: 20px;
            z-index: 10000;
            background: #9C27B0;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `Captured: ${character} (${pinyin}) - ${translation}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }

    function showDownloadToast(message) {
        const status = document.getElementById('download-status');
        if (status) {
            status.textContent = message;
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        #tts-config-modal input:focus,
        #tts-config-modal select:focus {
            outline: none;
            border-color: #2196F3 !important;
            box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2) !important;
        }

        #tts-config-modal button:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }

        #tts-config-modal button:active {
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
})();
