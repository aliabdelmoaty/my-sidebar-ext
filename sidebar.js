/**
 * Sidebar Sites Configuration
 * ===========================
 * Sites are stored in browser.storage.local for persistence
 * Favicons are cached in IndexedDB for performance
 */

// Default sites (used on first install)
// All sites use automatic favicon fetching
const DEFAULT_SITES = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    color: '#10a37f'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    color: '#FF0000'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    color: '#25D366'
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com',
    color: '#24292e'
  },
  {
    id: 'translate',
    name: 'Google Translate',
    url: 'https://translate.google.com',
    color: '#4285F4'
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    color: '#D4A574'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    color: '#1a73e8'
  }
];

// ===================
// FAVICON CACHE SYSTEM
// ===================

const DB_NAME = 'SidebarFaviconCache';
const DB_VERSION = 1;
const STORE_NAME = 'favicons';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

let db = null;

/**
 * Initialize IndexedDB for favicon caching
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'domain' });
      }
    };
  });
}

/**
 * Get cached favicon from IndexedDB
 */
function getCachedFavicon(domain) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(domain);
    
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const result = request.result;
      if (result && (Date.now() - result.timestamp < CACHE_DURATION)) {
        resolve(result.dataUrl);
      } else {
        resolve(null); // Expired or not found
      }
    };
  });
}

/**
 * Save favicon to IndexedDB cache
 */
function cacheFavicon(domain, dataUrl) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.put({
      domain: domain,
      dataUrl: dataUrl,
      timestamp: Date.now()
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve(); // Don't fail if cache fails
  });
}

/**
 * Fetch favicon and convert to base64 data URL
 */
async function fetchAndCacheFavicon(domain) {
  // Multiple sources for high quality favicons (in order of preference)
  const sources = [
    // DuckDuckGo - usually highest quality
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    // Google with large size
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    // Favicon.io - another good source
    `https://favicon.io/favicon/${domain}`,
    // Direct favicon from site
    `https://${domain}/favicon.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/apple-touch-icon-precomposed.png`
  ];
  
  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const blob = await response.blob();
      
      // Skip if too small (probably a placeholder)
      if (blob.size < 100) continue;
      
      // Convert to base64 data URL
      const dataUrl = await blobToDataUrl(blob);
      
      // Cache it
      await cacheFavicon(domain, dataUrl);
      
      return dataUrl;
    } catch (e) {
      continue; // Try next source
    }
  }
  
  return null; // All sources failed
}

/**
 * Convert blob to data URL
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get favicon URL (from cache or fetch)
 */
async function getFavicon(siteUrl) {
  try {
    const url = new URL(siteUrl);
    const domain = url.hostname;
    
    // Try cache first
    const cached = await getCachedFavicon(domain);
    if (cached) {
      return cached;
    }
    
    // Fetch and cache
    const dataUrl = await fetchAndCacheFavicon(domain);
    return dataUrl;
  } catch (e) {
    return null;
  }
}

// ===================
// MAIN APP LOGIC
// ===================

// Current sites list
let sites = [];
let activeButton = null;
let selectedColor = '#4a9eff';
let contextMenu = null;
let editingSiteId = null; // Track if we're editing a site
let currentSiteUrl = null; // Track currently loaded site URL

// Drag and drop state
let draggedItem = null;
let draggedIndex = -1;
let dropIndicator = null;

// Auto-hibernate state
const HIBERNATE_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity
let hibernateTimer = null;
let isHibernated = false;
let lastActivityTime = Date.now();
let hibernatedUrl = null; // Store URL when hibernated

// DOM Elements
const iconBar = document.getElementById('iconBar');
const webFrame = document.getElementById('webFrame');
const welcome = document.getElementById('welcome');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const btnCancel = document.getElementById('btnCancel');
const btnSave = document.getElementById('btnSave');
const siteName = document.getElementById('siteName');
const siteUrl = document.getElementById('siteUrl');
const colorPicker = document.getElementById('colorPicker');
const importFile = document.getElementById('importFile');
const webPanel = document.querySelector('.web-panel');
const iframeWrapper = document.getElementById('iframeWrapper');

/**
 * Load sites from storage
 */
async function loadSites() {
  try {
    const result = await browser.storage.local.get('sites');
    if (result.sites && result.sites.length > 0) {
      sites = result.sites;
    } else {
      sites = [...DEFAULT_SITES];
      await saveSites();
    }
  } catch (e) {
    console.log('Storage not available, using defaults');
    sites = [...DEFAULT_SITES];
  }
}

/**
 * Save sites to storage
 */
async function saveSites() {
  try {
    await browser.storage.local.set({ sites });
  } catch (e) {
    console.log('Could not save to storage');
  }
}

/**
 * Generate unique ID
 */
function generateId() {
  return 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Create icon button for a site
 */
function createIconButton(site, index) {
  const button = document.createElement('button');
  button.className = 'icon-btn';
  button.setAttribute('data-tooltip', site.name);
  button.setAttribute('data-url', site.url);
  button.setAttribute('data-id', site.id);
  button.setAttribute('data-index', index);
  button.setAttribute('draggable', 'true');
  
  // Load favicon asynchronously
  loadFaviconForButton(button, site);
  
  // Click handler - load site (only if not dragging)
  button.addEventListener('click', (e) => {
    // Prevent click during drag
    if (draggedItem) return;
    loadSite(site, button);
  });
  
  // Right-click handler - show context menu
  button.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, site);
  });
  
  // Drag and drop handlers
  button.addEventListener('dragstart', handleDragStart);
  button.addEventListener('dragend', handleDragEnd);
  button.addEventListener('dragover', handleDragOver);
  button.addEventListener('dragenter', handleDragEnter);
  button.addEventListener('dragleave', handleDragLeave);
  button.addEventListener('drop', handleDrop);
  
  return button;
}

/**
 * Load favicon for a button (async)
 */
async function loadFaviconForButton(button, site) {
  // Show letter icon as placeholder first
  const letterIcon = createLetterIcon(site.name, site.color);
  button.appendChild(letterIcon);
  
  // Try to get favicon
  const faviconUrl = await getFavicon(site.url);
  
  if (faviconUrl) {
    const img = document.createElement('img');
    img.src = faviconUrl;
    img.alt = site.name;
    
    img.onload = () => {
      // Remove letter icon and add image
      letterIcon.remove();
      button.appendChild(img);
    };
    
    img.onerror = () => {
      // Keep letter icon if image fails
      console.log('Failed to load favicon for', site.name);
    };
  }
}

/**
 * Create letter icon for sites without favicon
 */
function createLetterIcon(name, color) {
  const div = document.createElement('div');
  div.className = 'letter-icon';
  div.style.background = color || '#4a9eff';
  div.textContent = name.charAt(0).toUpperCase();
  return div;
}

/**
 * Create add button
 */
function createAddButton() {
  const button = document.createElement('button');
  button.className = 'add-btn';
  button.innerHTML = '+';
  button.setAttribute('data-tooltip', 'إضافة موقع');
  button.addEventListener('click', openModal);
  return button;
}

/**
 * Load site in iframe
 */
function loadSite(site, button) {
  // Update active state
  if (activeButton) {
    activeButton.classList.remove('active');
  }
  button.classList.add('active');
  activeButton = button;
  
  // Hide welcome
  welcome.classList.add('hidden');
  
  // Store current URL for refresh/open in tab
  currentSiteUrl = site.url;
  
  // Save last visited site
  saveLastSite(site.id);
  
  // Load the site
  webFrame.src = site.url;
}

/**
 * Save last visited site ID to storage
 */
async function saveLastSite(siteId) {
  try {
    await browser.storage.local.set({ lastSiteId: siteId });
  } catch (e) {
    console.log('Could not save last site');
  }
}

/**
 * Load last visited site on startup
 */
async function loadLastSite() {
  try {
    const result = await browser.storage.local.get('lastSiteId');
    if (result.lastSiteId) {
      const site = sites.find(s => s.id === result.lastSiteId);
      if (site) {
        // Find the button for this site
        const button = document.querySelector(`[data-id="${site.id}"]`);
        if (button) {
          loadSite(site, button);
        }
      }
    }
  } catch (e) {
    console.log('Could not load last site');
  }
}

/**
 * Refresh current iframe
 */
function refreshIframe() {
  if (currentSiteUrl) {
    webFrame.src = currentSiteUrl;
  }
}

/**
 * Open current site in new tab
 */
function openInNewTab() {
  if (currentSiteUrl) {
    browser.tabs.create({ url: currentSiteUrl });
  }
}

// ===================
// DRAG AND DROP
// ===================

/**
 * Handle drag start
 */
function handleDragStart(e) {
  // Get the button element (might be triggered from child)
  const button = e.target.closest('.icon-btn');
  if (!button) return;
  
  draggedItem = button;
  draggedIndex = parseInt(button.dataset.index);
  
  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedIndex.toString());
  
  // Set drag image to the button
  e.dataTransfer.setDragImage(button, button.offsetWidth / 2, button.offsetHeight / 2);
  
  // Add dragging class after a small delay (for visual feedback)
  requestAnimationFrame(() => {
    if (draggedItem) {
      draggedItem.classList.add('dragging');
    }
  });
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove('dragging');
  }
  draggedItem = null;
  draggedIndex = -1;
  
  // Remove all drag-over classes from all buttons
  document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.target.closest('.icon-btn');
  if (!target || !draggedItem || target === draggedItem) return;
  
  // Clear previous indicators from other buttons
  document.querySelectorAll('.icon-btn').forEach(btn => {
    if (btn !== target) {
      btn.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  });
  
  // Determine if dropping above or below
  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const isAbove = e.clientY < midY;
  
  // Update visual indicator
  target.classList.remove('drag-over-top', 'drag-over-bottom');
  target.classList.add(isAbove ? 'drag-over-top' : 'drag-over-bottom');
}

/**
 * Handle drag enter
 */
function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
  const target = e.target.closest('.icon-btn');
  if (!target) return;
  
  // Check if we're actually leaving the button (not just moving to a child)
  const relatedTarget = e.relatedTarget;
  if (relatedTarget && target.contains(relatedTarget)) {
    return; // Still inside the button
  }
  
  target.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
}

/**
 * Handle drop
 */
async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const target = e.target.closest('.icon-btn');
  if (!target || !draggedItem || target === draggedItem) return;
  
  const targetIndex = parseInt(target.dataset.index);
  
  // Determine if dropping above or below
  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const isAbove = e.clientY < midY;
  
  // Calculate new index
  let newIndex = isAbove ? targetIndex : targetIndex + 1;
  if (draggedIndex < targetIndex) {
    newIndex--;
  }
  
  // Ensure newIndex is valid
  newIndex = Math.max(0, Math.min(newIndex, sites.length - 1));
  
  // Reorder the sites array
  if (draggedIndex !== newIndex && draggedIndex >= 0 && draggedIndex < sites.length) {
    const [movedSite] = sites.splice(draggedIndex, 1);
    sites.splice(newIndex, 0, movedSite);
    
    // Save and re-render
    await saveSites();
    renderIcons();
    
    // Restore active state if needed
    if (activeButton) {
      const activeId = activeButton.dataset.id;
      const newActiveBtn = document.querySelector(`[data-id="${activeId}"]`);
      if (newActiveBtn) {
        newActiveBtn.classList.add('active');
        activeButton = newActiveBtn;
      }
    }
  }
  
  // Cleanup all buttons
  document.querySelectorAll('.icon-btn').forEach(btn => {
    btn.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
}

// ===================
// AUTO-HIBERNATE
// ===================

/**
 * Reset activity timer (called on user interaction)
 */
function resetActivityTimer() {
  lastActivityTime = Date.now();
  
  // If hibernated, wake up
  if (isHibernated) {
    wakeFromHibernate();
  }
  
  // Clear existing timer
  if (hibernateTimer) {
    clearTimeout(hibernateTimer);
  }
  
  // Set new timer
  hibernateTimer = setTimeout(checkHibernate, HIBERNATE_TIMEOUT);
}

/**
 * Check if should hibernate
 */
function checkHibernate() {
  const inactiveTime = Date.now() - lastActivityTime;
  
  // Only hibernate if iframe has a loaded site and user is inactive
  if (inactiveTime >= HIBERNATE_TIMEOUT && currentSiteUrl && !isHibernated) {
    hibernate();
  }
}

/**
 * Hibernate the iframe to save memory
 */
function hibernate() {
  if (isHibernated || !currentSiteUrl) return;
  
  isHibernated = true;
  hibernatedUrl = currentSiteUrl;
  
  // Unload iframe to free memory
  webFrame.src = 'about:blank';
  
  // Show hibernate overlay
  showHibernateOverlay();
  
  console.log('Sidebar: Hibernated to save memory');
}

/**
 * Wake from hibernate
 */
function wakeFromHibernate() {
  if (!isHibernated) return;
  
  isHibernated = false;
  
  // Hide hibernate overlay
  hideHibernateOverlay();
  
  // Reload the site
  if (hibernatedUrl) {
    webFrame.src = hibernatedUrl;
    hibernatedUrl = null;
  }
  
  console.log('Sidebar: Woke from hibernate');
}

/**
 * Show hibernate overlay
 */
function showHibernateOverlay() {
  let overlay = document.getElementById('hibernateOverlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'hibernateOverlay';
    overlay.className = 'hibernate-overlay';
    overlay.innerHTML = `
      <div class="hibernate-content">
        <div class="hibernate-icon">💤</div>
        <p class="hibernate-title">في وضع السكون</p>
        <p class="hibernate-subtitle">لتوفير الذاكرة</p>
        <button class="hibernate-wake-btn">اضغط للتنشيط</button>
      </div>
    `;
    
    // Wake on click
    overlay.addEventListener('click', () => {
      resetActivityTimer();
    });
    
    iframeWrapper.appendChild(overlay);
  }
  
  overlay.classList.add('show');
}

/**
 * Hide hibernate overlay
 */
function hideHibernateOverlay() {
  const overlay = document.getElementById('hibernateOverlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
}

/**
 * Setup activity listeners
 */
function setupActivityListeners() {
  // Listen for user activity on the sidebar
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
  
  activityEvents.forEach(event => {
    document.addEventListener(event, resetActivityTimer, { passive: true });
  });
  
  // Also listen for visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      resetActivityTimer();
    }
  });
  
  // Start the initial timer
  resetActivityTimer();
}

// ===================
// IMPORT/EXPORT
// ===================

/**
 * Export sites to JSON file
 */
function exportSites() {
  const dataStr = JSON.stringify(sites, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sidebar-sites.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import sites from JSON file
 */
function importSitesFromFile() {
  importFile.click();
}

/**
 * Handle file import
 */
async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedSites = JSON.parse(text);
    
    // Validate imported data
    if (!Array.isArray(importedSites)) {
      throw new Error('Invalid format');
    }
    
    // Validate each site has required fields
    const validSites = importedSites.filter(site => 
      site && typeof site.name === 'string' && typeof site.url === 'string'
    ).map(site => ({
      id: site.id || generateId(),
      name: site.name,
      url: site.url,
      color: site.color || '#4a9eff'
    }));
    
    if (validSites.length === 0) {
      alert('الملف لا يحتوي على مواقع صالحة');
      return;
    }
    
    // Ask user whether to replace or merge
    const replace = confirm(
      `تم العثور على ${validSites.length} موقع.\n\n` +
      `اضغط "موافق" لاستبدال المواقع الحالية\n` +
      `أو "إلغاء" لإضافتها للمواقع الموجودة`
    );
    
    if (replace) {
      sites = validSites;
    } else {
      // Merge: add only sites that don't exist (by URL)
      const existingUrls = new Set(sites.map(s => s.url));
      const newSites = validSites.filter(s => !existingUrls.has(s.url));
      sites = [...sites, ...newSites];
    }
    
    await saveSites();
    renderIcons();
    
    alert('تم استيراد المواقع بنجاح!');
  } catch (e) {
    console.error('Import error:', e);
    alert('فشل في قراءة الملف. تأكد من أنه ملف JSON صالح.');
  }
  
  // Reset file input
  event.target.value = '';
}

/**
 * Render all icons
 */
function renderIcons() {
  // Clear icon bar
  iconBar.innerHTML = '';
  
  // Add site icons
  sites.forEach((site, index) => {
    const button = createIconButton(site, index);
    iconBar.appendChild(button);
  });
  
  // Add separator
  const separator = document.createElement('div');
  separator.className = 'separator';
  iconBar.appendChild(separator);
  
  // Add the + button
  const addBtn = createAddButton();
  iconBar.appendChild(addBtn);
  
  // Add toolbar buttons (refresh & open in tab)
  const refreshBtn = createUtilityButton('↻', 'تحديث', refreshIframe);
  const openTabBtn = createUtilityButton('↗', 'فتح في تاب جديد', openInNewTab);
  iconBar.appendChild(refreshBtn);
  iconBar.appendChild(openTabBtn);
  
  // Add import/export buttons
  const exportBtn = createUtilityButton('📤', 'تصدير المواقع', exportSites);
  const importBtn = createUtilityButton('📥', 'استيراد المواقع', importSitesFromFile);
  iconBar.appendChild(exportBtn);
  iconBar.appendChild(importBtn);
}

/**
 * Create utility button (for import/export)
 */
function createUtilityButton(icon, tooltip, onClick) {
  const button = document.createElement('button');
  button.className = 'utility-btn';
  button.innerHTML = icon;
  button.setAttribute('data-tooltip', tooltip);
  button.addEventListener('click', onClick);
  return button;
}

/**
 * Open add site modal
 */
function openModal() {
  editingSiteId = null;
  modalTitle.textContent = 'إضافة موقع جديد';
  siteName.value = '';
  siteUrl.value = '';
  selectedColor = '#4a9eff';
  updateColorSelection();
  modalOverlay.classList.add('show');
  siteName.focus();
}

/**
 * Open edit site modal
 */
function openEditModal(site) {
  editingSiteId = site.id;
  modalTitle.textContent = 'تعديل الموقع';
  siteName.value = site.name;
  siteUrl.value = site.url;
  selectedColor = site.color || '#4a9eff';
  updateColorSelection();
  modalOverlay.classList.add('show');
  siteName.focus();
}

/**
 * Close modal
 */
function closeModal() {
  modalOverlay.classList.remove('show');
  editingSiteId = null;
}

/**
 * Update color selection UI
 */
function updateColorSelection() {
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === selectedColor);
  });
}

/**
 * Save new or edited site
 */
async function saveSite() {
  const name = siteName.value.trim();
  let url = siteUrl.value.trim();
  
  if (!name || !url) {
    alert('من فضلك أدخل اسم الموقع والرابط');
    return;
  }
  
  // Add https if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  if (editingSiteId) {
    // Edit existing site
    const siteIndex = sites.findIndex(s => s.id === editingSiteId);
    if (siteIndex !== -1) {
      sites[siteIndex] = {
        ...sites[siteIndex],
        name: name,
        url: url,
        color: selectedColor
      };
    }
  } else {
    // Add new site
    const newSite = {
      id: generateId(),
      name: name,
      url: url,
      color: selectedColor
    };
    sites.push(newSite);
  }
  
  await saveSites();
  renderIcons();
  closeModal();
}

/**
 * Show context menu
 */
function showContextMenu(e, site) {
  // Remove existing context menu
  hideContextMenu();
  
  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.innerHTML = `
    <div class="context-menu-item" data-action="edit">
      <span>✏️</span>
      <span>تعديل</span>
    </div>
    <div class="context-menu-item danger" data-action="delete">
      <span>🗑️</span>
      <span>حذف</span>
    </div>
  `;
  
  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  
  // Handle edit
  contextMenu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    hideContextMenu();
    openEditModal(site);
  });
  
  // Handle delete
  contextMenu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    sites = sites.filter(s => s.id !== site.id);
    await saveSites();
    renderIcons();
    hideContextMenu();
    
    // Reset iframe if deleted site was active
    if (activeButton && activeButton.dataset.id === site.id) {
      webFrame.src = 'about:blank';
      welcome.classList.remove('hidden');
      activeButton = null;
      currentSiteUrl = null;
    }
  });
  
  document.body.appendChild(contextMenu);
  
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 0);
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

/**
 * Initialize
 */
async function init() {
  // Initialize favicon cache database
  try {
    await initDB();
  } catch (e) {
    console.log('IndexedDB not available, favicons will not be cached');
  }
  
  await loadSites();
  renderIcons();
  
  // Load last visited site automatically
  await loadLastSite();
  
  // Modal event listeners
  modalClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  btnSave.addEventListener('click', saveSite);
  
  // Close modal on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  
  // Color picker
  colorPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-btn')) {
      selectedColor = e.target.dataset.color;
      updateColorSelection();
    }
  });
  
  // Enter key to save
  siteUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSite();
  });
  
  // Initial color selection
  updateColorSelection();
  
  // Import file handler
  importFile.addEventListener('change', handleFileImport);
  
  // Setup auto-hibernate
  setupActivityListeners();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
