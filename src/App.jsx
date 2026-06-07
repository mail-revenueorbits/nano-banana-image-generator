import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// -------------------------------------------------------------
// PRESETS AND MODELS LISTS
// -------------------------------------------------------------
const MODELS = [
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2 (Flash)',
    desc: 'Lightning fast Google Gemini 3.1 Flash Image model for quick drafts and flat-lays',
    icon: '⚡',
    apiValue: 'gemini-3.1-flash-image'
  },
  {
    id: 'gemini-3-pro-image',
    name: 'Nano Banana Pro',
    desc: 'High-fidelity creative Google Gemini 3.1 Pro Image model for rich detail and perfection',
    icon: '✨',
    apiValue: 'gemini-3-pro-image'
  }
];

const RATIOS = [
  { id: '1:1', name: 'Square', aspect: '1-1', w: 1024, h: 1024 },
  { id: '2:3', name: 'Classic Portrait', aspect: '2-3', w: 800, h: 1200 },
  { id: '3:2', name: 'Classic Landscape', aspect: '3-2', w: 1200, h: 800 },
  { id: '3:4', name: 'Classic Vertical', aspect: '3-4', w: 768, h: 1024 },
  { id: '4:3', name: 'Classic Horizontal', aspect: '4-3', w: 1024, h: 768 },
  { id: '4:5', name: 'Instagram Portrait', aspect: '4-5', w: 800, h: 1000 },
  { id: '5:4', name: 'Instagram Landscape', aspect: '5-4', w: 1000, h: 800 },
  { id: '9:16', name: 'Tall Portrait', aspect: '9-16', w: 720, h: 1280 },
  { id: '16:9', name: 'Widescreen', aspect: '16-9', w: 1280, h: 720 },
  { id: '21:9', name: 'Cinematic', aspect: '21-9', w: 1440, h: 600 },
  { id: '1:4', name: 'Extreme Vertical', aspect: '1-4', w: 400, h: 1600 },
  { id: '4:1', name: 'Extreme Horizontal', aspect: '4-1', w: 1600, h: 400 },
  { id: '1:8', name: 'Ultrapanoramic Vertical', aspect: '1-8', w: 200, h: 1600 },
  { id: '8:1', name: 'Ultrapanoramic Horizontal', aspect: '8-1', w: 1600, h: 200 }
];

const PRESETS = [
  {
    title: 'Cyberpunk City',
    desc: 'A futuristic cybernetic neon-lit street...',
    prompt: 'A yellow cybernetic nano banana spaceship flying low through a wet neon-lit futuristic tropical cyberpunk city street, ultra detailed, cinematic 3d render'
  },
  {
    title: 'Clay Mascot',
    desc: 'Cute 3D claymation happy animal...',
    prompt: 'Cute 3D claymation style happy yellow baby chick wearing a tiny wool beanie and raincoat, standing in a puddle, Pixar style, vivid warm colours'
  },
  {
    title: 'Product Flat-lay',
    desc: 'Minimalist commercial cosmetic flatlay...',
    prompt: 'Premium minimalist e-commerce product flat-lay photography of luxury gold and amber skincare bottles on polished white marble, dramatic studio lighting'
  },
  {
    title: 'Japanese Anime',
    desc: 'Cozy lo-fi Tokyo ramen shop at night...',
    prompt: 'Retro 90s aesthetic Japanese anime illustration of a cozy ramen stall in Tokyo at midnight, warm glowing paper lanterns, rich lo-fi watercolor texture'
  }
];

const LOADER_MESSAGES = [
  'Peeling core neural pathways...',
  'Ripening creative color shaders...',
  'Squeezing sweet pixel vector juices...',
  'Slicing high-fidelity details...',
  'Mashing structural prompt matrices...',
  'Polishing banana-skin reflections...',
  'Sifting through digital noise...',
  'Almost ready! Plucking from the creative tree...'
];

// -------------------------------------------------------------
// NATIVE INDEXEDDB PERSISTENCE ENGINE
// -------------------------------------------------------------
const DB_NAME = 'NanoBananaDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function saveHistoryItem(item) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function loadHistoryItems() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const data = request.result || [];
        // Sort by id descending (latest first)
        data.sort((a, b) => b.id - a.id);
        resolve(data);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

function deleteHistoryItemFromDB(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function loadFullHistoryItem(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

// Helper to generate a downscaled compressed thumbnail for high-res images
function generateThumbnail(base64DataUrl, maxWidth = 160) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Export as a compressed low-quality JPEG for minimum footprint in DOM and DB
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => {
      resolve(base64DataUrl); // Fallback to original if load fails
    };
    img.src = base64DataUrl;
  });
}

function App() {
  // -------------------------------------------------------------
  // STATES
  // -------------------------------------------------------------
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-image');
  const [ratio, setRatio] = useState('1:1');
  const [quality, setQuality] = useState('2k');
  
  // Image Upload (Prompting) States
  const [imagePrompts, setImagePrompts] = useState([]); // Array of { id, url, helper, name }
  const [imageInfluence, setImageInfluence] = useState(50); // percentage
  const [analyzingImage, setAnalyzingImage] = useState(false);

  // Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState(LOADER_MESSAGES[0]);
  const [currentImage, setCurrentImage] = useState(null);

  // History & Credits
  const [history, setHistory] = useState([]);
  const [nanoCredits, setNanoCredits] = useState(1250);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Advanced States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState('');
  const [isSeedLocked, setIsSeedLocked] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [guidanceScale, setGuidanceScale] = useState(7.5);

  // Interactivity States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 900);
  const [isControlCollapsed, setIsControlCollapsed] = useState(window.innerWidth < 900);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [dragActive, setDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dragCounter = useRef(0);

  // -------------------------------------------------------------
  // EFFECTS & INITIALIZATION
  // -------------------------------------------------------------
  // Helper to load selected full-res image on demand
  const handleSelectImage = async (item) => {
    try {
      const fullItem = await loadFullHistoryItem(item.id);
      if (fullItem) {
        setCurrentImage(fullItem);
      } else {
        setCurrentImage(item);
      }
    } catch (err) {
      console.error('Failed to load full image:', err);
      setCurrentImage(item);
    }
  };

  useEffect(() => {
    // Load historical generations and credits
    const loadHistory = async () => {
      try {
        let dbHistory = await loadHistoryItems();
        
        // One-time Migration from localStorage to IndexedDB
        if (dbHistory.length === 0) {
          const savedHistory = localStorage.getItem('nano_banana_history');
          if (savedHistory) {
            try {
              const parsed = JSON.parse(savedHistory);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log('Migrating legacy history to IndexedDB...', parsed.length);
                for (const item of parsed) {
                  if (item && item.id) {
                    await saveHistoryItem(item);
                  }
                }
                dbHistory = await loadHistoryItems();
                // Clear out large data URLs from localStorage to free up quota
                localStorage.removeItem('nano_banana_history');
              }
            } catch (innerErr) {
              console.error('Migration failed:', innerErr);
            }
          }
        }

        // Construct lightened history list for state (removing huge url field)
        const lightHistory = dbHistory.map(item => {
          const light = { ...item };
          delete light.url;
          return light;
        });

        setHistory(lightHistory);
        if (dbHistory.length > 0) {
          // Set full first item in memory for active viewport
          setCurrentImage(dbHistory[0]);
        }

        // Self-healing Background Worker: Create thumbnails for legacy creations to eliminate lag
        setTimeout(async () => {
          try {
            const currentHistoryInDB = await loadHistoryItems();
            const updatedHistory = [...currentHistoryInDB];
            let stateNeedsUpdate = false;

            for (let i = 0; i < updatedHistory.length; i++) {
              const item = updatedHistory[i];
              // If image has no thumbnail, generate one asynchronously without blocking UI thread
              if (!item.thumbnail && item.url) {
                console.log(`[Performance] Optimizing legacy image history item: ${item.id}`);
                const thumb = await generateThumbnail(item.url);
                const updatedItem = { ...item, thumbnail: thumb };
                
                await saveHistoryItem(updatedItem);
                updatedHistory[i] = updatedItem;
                stateNeedsUpdate = true;
              }
            }

            if (stateNeedsUpdate) {
              const lightHistory = updatedHistory.map(item => {
                const light = { ...item };
                delete light.url;
                return light;
              });
              setHistory(lightHistory);
              
              setCurrentImage(currentActive => {
                if (currentActive) {
                  const match = updatedHistory.find(u => u.id === currentActive.id);
                  if (match) return match;
                }
                return currentActive;
              });
            }
          } catch (backgroundErr) {
            console.error('[Performance] Background thumbnail self-healing worker error:', backgroundErr);
          }
        }, 1500);

      } catch (err) {
        console.error('Failed to load history from IndexedDB:', err);
      }
    };

    loadHistory();

    const savedCredits = localStorage.getItem('nano_banana_credits');
    if (savedCredits) {
      setNanoCredits(Number(savedCredits));
    }
  }, []);

  const saveHistoryToStorage = async (updatedHistory, newlyAddedItem = null) => {
    // Strip url from history state items to keep memory footprints tiny
    const lightHistory = updatedHistory.map(item => {
      if (item.url) {
        const light = { ...item };
        delete light.url;
        return light;
      }
      return item;
    });
    setHistory(lightHistory);

    try {
      if (newlyAddedItem) {
        await saveHistoryItem(newlyAddedItem);
      }
    } catch (e) {
      console.error('Failed to save to IndexedDB:', e);
    }
  };

  const deductCredits = () => {
    const updatedCredits = Math.max(0, nanoCredits - 10);
    setNanoCredits(updatedCredits);
    localStorage.setItem('nano_banana_credits', updatedCredits);
  };

  // Auto-expand prompt textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [prompt]);

  // -------------------------------------------------------------
  // IMAGE PROMPT ANALYSIS LOGIC (Canvas Based)
  // -------------------------------------------------------------
  const processImageUpload = (filesInput) => {
    if (!filesInput) return;
    
    // Normalize FileList or File arrays
    const files = filesInput instanceof FileList 
      ? Array.from(filesInput) 
      : Array.isArray(filesInput) 
        ? filesInput 
        : [filesInput];
        
    const validImageFiles = files.filter(f => f && f.type.startsWith('image/'));
    if (validImageFiles.length === 0) return;
    
    // Check if adding these exceeds our reference limit
    if (imagePrompts.length + validImageFiles.length > 3) {
      alert('You can upload up to 3 reference images for optimal style blending! 🍌');
      validImageFiles.splice(3 - imagePrompts.length);
    }
    
    if (validImageFiles.length === 0) return;
    
    setAnalyzingImage(true);
    let processedCount = 0;
    
    validImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;

        // Perform HTML5 Canvas analysis to extract stylistic vibe
        const analysis = await analyzeImageVibe(dataUrl);
        const helperText = `style of image (${analysis.colorName} with ${analysis.brightnessVibe})`;

        const newPromptImage = {
          id: Date.now() + Math.random(),
          url: dataUrl,
          helper: helperText,
          name: file.name
        };

        setImagePrompts(prev => {
          if (prev.length >= 3) return prev;
          return [...prev, newPromptImage];
        });
        
        processedCount++;
        if (processedCount === validImageFiles.length) {
          setAnalyzingImage(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const analyzeImageVibe = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 10;
        canvas.height = 10;
        ctx.drawImage(img, 0, 0, 10, 10);
        const imgData = ctx.getImageData(0, 0, 10, 10).data;

        let rSum = 0, gSum = 0, bSum = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          rSum += imgData[i];
          gSum += imgData[i + 1];
          bSum += imgData[i + 2];
        }
        const count = imgData.length / 4;
        const rAvg = Math.round(rSum / count);
        const gAvg = Math.round(gSum / count);
        const bAvg = Math.round(bSum / count);
        const brightness = (rAvg * 299 + gAvg * 587 + bAvg * 114) / 1000;

        let colorName = 'neutral muted shades';
        if (rAvg > gAvg && rAvg > bAvg) {
          colorName = rAvg > 160 ? 'vivid hot crimson, orange, and golden amber hues' : 'moody dark burgundy tones';
        } else if (gAvg > rAvg && gAvg > bAvg) {
          colorName = gAvg > 160 ? 'bright neon lime and rich green vibes' : 'mysterious dark forest green gradients';
        } else if (bAvg > rAvg && bAvg > gAvg) {
          colorName = bAvg > 160 ? 'vivid sapphire and glowing cyan details' : 'deep luxury midnight blue shadows';
        } else if (Math.abs(rAvg - gAvg) < 25 && Math.abs(gAvg - bAvg) < 25) {
          colorName = brightness > 180 ? 'ultra-clean white and bright ivory exposure' : 'slate gray, carbon charcoal, and monochrome dark shadows';
        } else if (rAvg > 160 && gAvg > 150 && bAvg < 100) {
          colorName = 'cheerful banana yellow, warm sunshine, and rich gold shades';
        }

        const brightnessVibe = brightness > 175 
          ? 'airy high-key soft studio lighting' 
          : brightness < 80 
            ? 'low-key cinematic chiaroscuro dark shadows' 
            : 'balanced commercial studio lighting with smooth gradients';

        resolve({ colorName, brightnessVibe });
      };
    });
  };

  // Drag & drop handlers using counter to avoid flickering
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageUpload(e.dataTransfer.files);
    }
  };

  // -------------------------------------------------------------
  // AI GENERATIVE CORE PIPELINE (Google Vertex AI / GenAI)
  // -------------------------------------------------------------
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setProgress(0);
    setProgressMessage(LOADER_MESSAGES[0]);

    // Deduct SaaS tokens
    deductCredits();

    // Setup final render dimensions based on aspect ratio
    const ratioObj = RATIOS.find(r => r.id === ratio) || RATIOS[0];
    const width = ratioObj.w;
    const height = ratioObj.h;

    // Build unique generation seed
    const seedNum = Number(seed);
    const activeSeed = isSeedLocked && !isNaN(seedNum) && seedNum > 0 
      ? seedNum 
      : Math.floor(Math.random() * 999999999);

    // Build the descriptive prompt blend incorporating Quality boosters & Image-to-Image canvas modifiers
    let enhancedPrompt = prompt.trim();

    // 1. Blend multiple Image Prompts if uploaded
    if (imagePrompts.length > 0) {
      const influenceFactor = imageInfluence / 100;
      if (influenceFactor > 0.1) {
        const aggregatedHelpers = imagePrompts.map((img, idx) => `Image ${idx + 1}: ${img.helper}`).join(', ');
        enhancedPrompt += `, style blending references [${aggregatedHelpers}] with influence weight ${influenceFactor}`;
      }
    }

    // 2. Blend Quality descriptors to refine textures for high-resolution renders
    if (quality === '2k') {
      enhancedPrompt += ', highly detailed, ultra sharp focus, crisp 4k textures, professional commercial studio lighting';
    } else if (quality === '4k') {
      enhancedPrompt += ', breathtaking masterpiece, hyper-detailed 8k textures, supreme professional product photograph, pristine high fidelity, perfect corporate lighting';
    }

    // 3. Blend Negative Prompting & Advanced params
    if (negativePrompt.trim()) {
      enhancedPrompt += ` --no ${negativePrompt.trim()}`;
    }

    const selectedModelObj = MODELS.find(m => m.id === model) || MODELS[0];

    // Elegant animated load timer ticks
    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += Math.random() * 8 + 3;
      if (progressVal >= 92) {
        progressVal = 92;
        clearInterval(interval);
      }
      setProgress(Math.round(progressVal));

      // Cycle status words based on percentage
      const msgIndex = Math.min(
        Math.floor((progressVal / 100) * LOADER_MESSAGES.length),
        LOADER_MESSAGES.length - 1
      );
      setProgressMessage(LOADER_MESSAGES[msgIndex]);
    }, 180);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          model: selectedModelObj.apiValue,
          ratio: ratio,
          quality: quality,
          imagePrompts: imagePrompts.map(img => img.url)
        })
      });

      const data = await response.json();
      clearInterval(interval);

      if (data.success && data.image) {
        setProgress(100);
        setProgressMessage('Plucking glorious render...');

        setTimeout(async () => {
          let thumbnailBase64 = null;
          try {
            thumbnailBase64 = await generateThumbnail(data.image);
          } catch (thumbErr) {
            console.error('Failed to create thumbnail for new generation:', thumbErr);
          }

          const generationObject = {
            id: Date.now(),
            url: data.image, // Base64 data URL from local python server
            thumbnail: thumbnailBase64,
            rawApiUrl: null,
            prompt: prompt.trim(),
            enhancedPrompt,
            model: selectedModelObj.name,
            ratio,
            quality,
            seed: activeSeed,
            isFavorite: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
          };

          setCurrentImage(generationObject);
          saveHistoryToStorage([generationObject, ...history], generationObject);
          setIsGenerating(false);
          
          // Instantly trigger automatic download of the generated image
          handleDownload(generationObject);
        }, 400);
      } else {
        setIsGenerating(false);
        alert(`Generation Failed: ${data.error || 'Unknown server error.'}`);
      }
    } catch (err) {
      console.error('Fetch error during image generation:', err);
      clearInterval(interval);
      setIsGenerating(false);
      alert('Failed to connect to the Nano Banana API server. Please ensure your backend is running!');
    }
  };

  // -------------------------------------------------------------
  // AUXILIARY UTILITIES (Favorites, Downloads, Deletes)
  // -------------------------------------------------------------
  const toggleFavorite = async (id, e) => {
    e.stopPropagation();
    try {
      // Fetch full-res item from IndexedDB
      const fullItem = await loadFullHistoryItem(id);
      if (!fullItem) return;

      const updatedFullItem = { ...fullItem, isFavorite: !fullItem.isFavorite };
      await saveHistoryItem(updatedFullItem);

      // Update lightweight history state
      const updatedHistory = history.map(item => 
        item.id === id ? { ...item, isFavorite: updatedFullItem.isFavorite } : item
      );
      setHistory(updatedHistory);

      if (currentImage && currentImage.id === id) {
        setCurrentImage(updatedFullItem);
      }
    } catch (err) {
      console.error('Failed to update favorite in IndexedDB:', err);
    }
  };

  const deleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    if (confirm('Peel away this creation forever?')) {
      const updated = history.filter(item => item.id !== id);
      setHistory(updated);
      try {
        await deleteHistoryItemFromDB(id);
      } catch (err) {
        console.error('Failed to delete from IndexedDB:', err);
      }
      if (currentImage && currentImage.id === id) {
        if (updated.length > 0) {
          handleSelectImage(updated[0]);
        } else {
          setCurrentImage(null);
        }
      }
    }
  };

  const handleDownload = (imgObj, e) => {
    if (e) e.stopPropagation();
    try {
      const downloadUrl = imgObj.url || imgObj.rawApiUrl;
      if (!downloadUrl) return;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Nano-Banana-${imgObj.seed || 'render'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(imgObj.url || imgObj.rawApiUrl, '_blank');
    }
  };

  const triggerVary = (imgObj) => {
    setPrompt(imgObj.prompt);
    // Lock a different seed to vary
    if (isSeedLocked) {
      setSeed(Math.floor(Math.random() * 999999999).toString());
    }
    alert('Prompt restored! Adjust parameters on the right and click Generate to create a variations sequence.');
  };

  const copyPromptText = (text) => {
    navigator.clipboard.writeText(text);
    alert('Prompt copied to clipboard! 🍌');
  };

  const handlePresetClick = (preset) => {
    setPrompt(preset.prompt);
  };

  // Filter list
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = filterFavorites ? item.isFavorite : true;
    return matchesSearch && matchesFav;
  });

  return (
    <div 
      className={`app-container ${dragActive ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Background Orbs */}
      <div className="bg-glow-orb-1"></div>
      <div className="bg-glow-orb-2"></div>

      {/* Mobile Sidebar Backdrops */}
      {!isSidebarCollapsed && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarCollapsed(true)}></div>
      )}
      {!isControlCollapsed && (
        <div className="sidebar-backdrop" onClick={() => setIsControlCollapsed(true)}></div>
      )}

      {/* Drag Over Overlay */}
      {dragActive && (
        <div className="drag-over-overlay">
          <div className="drag-icon">📥</div>
          <div className="drag-text">Drop Image to Feed Prompt Cords</div>
        </div>
      )}

      {/* LEFT SIDEBAR - GENERATION HISTORY */}
      <aside className={`sidebar-history ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-title">
            <span>🍌</span>
            <span className="gradient-text-gold">Nano Banana</span>
          </div>
          <button 
            className="icon-button" 
            onClick={() => setIsSidebarCollapsed(true)}
            title="Collapse Sidebar"
          >
            ◀
          </button>
        </div>

        {/* Credit Tracker Capsule */}
        <div className="credits-capsule">
          <span>Nano-Credits</span>
          <span className="credits-count">✨ {nanoCredits}</span>
        </div>

        {/* Filters */}
        <div style={{ padding: '0 20px 10px 20px', display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="Search creations..." 
            className="glass-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '0.8rem', flex: 1 }}
          />
          <button 
            className={`icon-button ${filterFavorites ? 'active' : ''}`}
            onClick={() => setFilterFavorites(!filterFavorites)}
            title="Filter Favorites"
            style={{ 
              width: '34px', 
              height: '34px', 
              borderColor: filterFavorites ? 'var(--primary)' : '',
              color: filterFavorites ? 'var(--primary)' : ''
            }}
          >
            ★
          </button>
        </div>

        {/* History List */}
        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '20px' }}>
              {filterFavorites ? 'No starred images yet.' : 'Creations will cluster here.'}
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className={`history-item ${currentImage && currentImage.id === item.id ? 'active' : ''}`}
                onClick={() => handleSelectImage(item)}
              >
                <img src={item.thumbnail || item.url || item.rawApiUrl} alt="Thumbnail" className="history-thumb" />
                <div className="history-info">
                  <div className="history-prompt-text">{item.prompt}</div>
                  <div className="history-meta-text">
                    <span>{item.date}</span>
                    <span>•</span>
                    <span>{item.ratio}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button 
                    className="history-delete-btn" 
                    onClick={(e) => deleteHistoryItem(item.id, e)}
                    title="Delete Creation"
                  >
                    🗑️
                  </button>
                  <button 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: item.isFavorite ? 'var(--primary)' : 'var(--text-muted)' }}
                    onClick={(e) => toggleFavorite(item.id, e)}
                    title="Toggle Favorite"
                  >
                    {item.isFavorite ? '★' : '☆'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* MAIN GENERATOR CANVAS STAGE */}
      <main className="workspace-stage">
        {/* TOPBAR */}
        <header className="stage-topbar">
          <div className="stage-topbar-left">
            {isSidebarCollapsed && (
              <button 
                className="icon-button" 
                onClick={() => setIsSidebarCollapsed(false)}
                title="Open Sidebar"
              >
                ▶
              </button>
            )}
            <h2 className="stage-header-title">Creator Deck</h2>
          </div>

          <div className="stage-topbar-right">
            {currentImage && (
              <>
                <button className="icon-button" onClick={() => copyPromptText(currentImage.prompt)} title="Copy Prompt">
                  📋
                </button>
                <button className="icon-button" onClick={(e) => toggleFavorite(currentImage.id, e)} title="Favorite">
                  {currentImage.isFavorite ? '★' : '☆'}
                </button>
                <button className="icon-button" onClick={(e) => handleDownload(currentImage, e)} title="Download PNG">
                  💾
                </button>
              </>
            )}
            <button 
              className={`icon-button control-toggle-btn ${!isControlCollapsed ? 'active' : ''}`}
              onClick={() => setIsControlCollapsed(!isControlCollapsed)}
              title="Toggle Settings Panel"
              style={{ color: !isControlCollapsed ? 'var(--primary)' : '' }}
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* STAGE MAIN INTERFACE */}
        <div className="generator-canvas-container">
          {isGenerating ? (
            /* ACTIVE LOADING VIEWPORT */
            <div className="loading-viewport">
              <div 
                className="skeleton-shimmer-box"
                style={{
                  width: '320px',
                  aspectRatio: ratio.replace(':', '/'),
                  maxHeight: '45vh'
                }}
              >
                <div className="shimmer-icon">🍌</div>
              </div>

              {/* Progress Panel */}
              <div className="progress-capsule">
                <div className="progress-header">
                  <span className="progress-status-ticker">
                    <span className="loading-spinner-micro" style={{ animation: 'rotateParticle 1s linear infinite' }}>⚙️</span>
                    {progressMessage}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{progress}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          ) : currentImage ? (
            /* COMPLETED RENDER STAGE */
            <div className="image-viewport-wrapper animate-scaleup">
              <div className="generated-image-card">
                <img 
                  src={currentImage.url || currentImage.rawApiUrl} 
                  alt="AI Generated Masterpiece" 
                  className="main-render-img"
                />

                {/* Overlays */}
                <div className="image-action-overlay">
                  <div className="overlay-top-row">
                    <button className="icon-button" onClick={() => setLightboxImage(currentImage)} title="Zoom Fullscreen">
                      🔍
                    </button>
                    <button className="icon-button" onClick={() => triggerVary(currentImage)} title="Restore Prompt & Vary Seed">
                      🔄
                    </button>
                    <button className="icon-button" onClick={(e) => handleDownload(currentImage, e)} title="Download High Resolution">
                      💾
                    </button>
                  </div>

                  <div className="overlay-bottom-row">
                    <div className="overlay-prompt" onClick={() => copyPromptText(currentImage.prompt)} style={{ cursor: 'pointer' }}>
                      {currentImage.prompt}
                    </div>
                    <div className="overlay-metadata">
                      <span className="metadata-pill">{currentImage.model}</span>
                      <span className="metadata-pill">{currentImage.ratio}</span>
                      <span className="metadata-pill">Seed: {currentImage.seed}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* WELCOME AND SUGGESTIONS (Gemini intro) */
            <div className="welcome-display animate-scaleup">
              <span className="welcome-logo-spinning">🍌</span>
              <h1 className="welcome-title gradient-text-neon">What will you ripen today?</h1>
              <p className="welcome-subtitle">
                Describe your dream flatlay, vector avatar, cartoon sticker, or cinematic product render. Click the presets below to taste-test.
              </p>

              <div className="preset-suggestions-grid">
                {PRESETS.map((preset, index) => (
                  <button 
                    key={index} 
                    className="preset-chip" 
                    onClick={() => handlePresetClick(preset)}
                  >
                    <div className="preset-title">{preset.title}</div>
                    <div className="preset-desc">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM COMMAND PROMPT STATION */}
        <section className="command-station-bar">
          <div className="command-card">
            {/* Uploaded Thumbnails Tray */}
            {imagePrompts.length > 0 && (
              <div className="image-prompt-thumbnail-tray" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {imagePrompts.map((img) => (
                    <div key={img.id} className="uploaded-thumbnail-wrapper" style={{ position: 'relative', width: '65px', height: '65px' }}>
                      <img src={img.url} alt="Reference Preview" className="uploaded-thumbnail-img" />
                      <button 
                        className="remove-thumb-btn" 
                        onClick={() => setImagePrompts(prev => prev.filter(item => item.id !== img.id))}
                        title="Remove Image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* Quick Add Button inside Tray if under cap */}
                  {imagePrompts.length < 3 && (
                    <button 
                      className="icon-button" 
                      onClick={() => fileInputRef.current?.click()}
                      title="Add another reference image"
                      style={{ width: '65px', height: '65px', borderRadius: '10px', fontSize: '1.2rem', border: '1.5px dashed var(--border)' }}
                      disabled={analyzingImage}
                    >
                      {analyzingImage ? '⏳' : '+'}
                    </button>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Combined Reference Influence</span>
                    <span style={{ color: 'var(--primary)' }}>{imageInfluence}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="90" 
                    className="slider-premium"
                    value={imageInfluence}
                    onChange={(e) => setImageInfluence(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="command-input-row">
              {/* Image Input Trigger */}
              <button 
                className="icon-button" 
                onClick={() => fileInputRef.current?.click()} 
                title="Add Image Prompt (Drag & Drop available)"
                style={{ width: '42px', height: '42px', borderRadius: '12px' }}
                disabled={analyzingImage}
              >
                {analyzingImage ? '⏳' : '🖼️'}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => processImageUpload(e.target.files)}
                style={{ display: 'none' }}
                accept="image/*"
                multiple
              />

              {/* Text Area */}
              <textarea
                ref={textareaRef}
                className="command-textarea"
                placeholder="Describe your banana-masterpiece... (Press Shift+Enter for newline)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />

              {/* Dice Prompt formulater */}
              <button 
                className="icon-button" 
                onClick={() => {
                  const randomPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
                  setPrompt(randomPreset.prompt);
                }} 
                title="Random Premium Prompt Formula"
                style={{ width: '42px', height: '42px', borderRadius: '12px' }}
              >
                🎲
              </button>

              {/* Generate Trigger */}
              <button 
                className="btn-premium-primary" 
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                style={{ padding: '0 20px', height: '42px', borderRadius: '12px', fontSize: '0.9rem' }}
              >
                <span>Generate</span>
                <span>🍌</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* RIGHT SIDEBAR - DETAILED SETTINGS */}
      <aside className={`sidebar-control-panel ${isControlCollapsed ? 'collapsed' : ''}`}>
        {/* Settings Control Header */}
        <div className="control-panel-header">
          <span className="control-panel-header-title">Settings Panel</span>
          <button 
            className="icon-button control-panel-close-btn" 
            onClick={() => setIsControlCollapsed(true)}
            title="Close Settings"
          >
            ✕
          </button>
        </div>

        {/* Model Selection */}
        <div className="control-section">
          <label className="control-section-title">
            <span>Model Selector</span>
            <span style={{ fontSize: '10px', color: 'var(--primary)' }}>Active Nodes</span>
          </label>
          <div className="model-cards-grid">
            {MODELS.map((item) => (
              <div 
                key={item.id} 
                className={`model-card ${model === item.id ? 'selected' : ''}`}
                onClick={() => setModel(item.id)}
              >
                <div className="model-icon">{item.icon}</div>
                <div className="model-text">
                  <div className="model-name">{item.name}</div>
                  <div className="model-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aspect Ratios */}
        <div className="control-section">
          <label className="control-section-title">Aspect Ratio</label>
          <div className="aspect-ratio-grid">
            {RATIOS.map((item) => (
              <button 
                key={item.id} 
                className={`ratio-box-btn ${ratio === item.id ? 'selected' : ''}`}
                onClick={() => setRatio(item.id)}
                title={item.name}
              >
                <div className={`ratio-shape-icon ratio-shape-${item.aspect}`}></div>
                <span className="ratio-name">{item.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality level */}
        <div className="control-section">
          <label className="control-section-title">
            <span>Target Resolution</span>
            <span style={{ fontSize: '10px', color: 'var(--primary)' }}>Pixel Scale</span>
          </label>
          <div className="quality-sliding-container">
            {['1k', '2k', '4k'].map((lvl) => (
              <button 
                key={lvl} 
                className={`quality-option-btn ${quality === lvl ? 'selected' : ''}`}
                onClick={() => setQuality(lvl)}
              >
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced accordion collapsible */}
        <div className="advanced-settings-drawer">
          <div className="drawer-header-trigger" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span>Advanced Parameters</span>
            <span>{showAdvanced ? '▼' : '▶'}</span>
          </div>

          {showAdvanced && (
            <div className="drawer-content">
              {/* Seed Lock */}
              <div className="drawer-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="drawer-label">Deterministic Seed</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isSeedLocked}
                      onChange={(e) => setIsSeedLocked(e.target.checked)}
                    />
                    Lock Seed
                  </label>
                </div>
                {isSeedLocked && (
                  <div className="seed-input-wrapper">
                    <input 
                      type="number" 
                      className="glass-input seed-input"
                      placeholder="Randomized..."
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Prompt scale */}
              <div className="drawer-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span className="drawer-label">Prompt Strength</span>
                  <span>{guidanceScale}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  step="0.5"
                  className="slider-premium"
                  value={guidanceScale}
                  onChange={(e) => setGuidanceScale(Number(e.target.value))}
                />
              </div>

              {/* Negative prompt */}
              <div className="drawer-row">
                <span className="drawer-label">Negative Directives</span>
                <input 
                  type="text" 
                  className="glass-input" 
                  style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  placeholder="e.g. text, deformed, bad hands, low resolution"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* FULLSCREEN ZOOM LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="lightbox-modal" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="icon-button lightbox-close-btn" onClick={() => setLightboxImage(null)}>
              ✕
            </button>
            <img src={lightboxImage.url || lightboxImage.rawApiUrl} alt="High-Res Zoom" className="lightbox-img" />
            <div className="lightbox-details">
              <p className="lightbox-prompt">{lightboxImage.prompt}</p>
              <div className="lightbox-meta">
                <span>Model: {lightboxImage.model}</span>
                <span>•</span>
                <span>Ratio: {lightboxImage.ratio}</span>
                <span>•</span>
                <span>Seed: {lightboxImage.seed}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
