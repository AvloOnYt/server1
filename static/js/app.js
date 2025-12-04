// Connect to SocketIO
const socket = io();

// Store clients data
let clients = {};
let commandHistory = [];

// Context menu
let contextMenu = null;
let selectedClientForContext = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
    setupEventListeners();
    setupSocketListeners();
    setupTabNavigation();
    setupContextMenu();
});

// Load initial data from REST API
async function loadInitialData() {
    try {
        // Load clients
        const clientsResponse = await fetch('/api/clients');
        clients = await clientsResponse.json();
        updateClientsList();
        updateStatistics();

        // Load command history
        const historyResponse = await fetch('/api/history');
        commandHistory = await historyResponse.json();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Close context menu on click
    document.addEventListener('click', () => {
        hideContextMenu();
    });
}

// Setup SocketIO listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('get_clients');
    });

    socket.on('client_update', (updatedClients) => {
        clients = updatedClients;
        updateClientsList();
        updateStatistics();
    });

    socket.on('command_response', (response) => {
        commandHistory.push(response);
        updateStatistics();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Setup tab navigation
function setupTabNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = link.dataset.tab;
            switchTab(tabName);
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

// Setup context menu
function setupContextMenu() {
    contextMenu = document.getElementById('context-menu');
}

// Show context menu
function showContextMenu(e, clientId) {
    e.preventDefault();
    selectedClientForContext = clientId;
    
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.add('active');
}

// Hide context menu
function hideContextMenu() {
    if (contextMenu) {
        contextMenu.classList.remove('active');
    }
}

// Context menu actions
function contextAction(action) {
    if (!selectedClientForContext) return;
    
    switch(action) {
        case 'view':
            window.location.href = `/client/${selectedClientForContext}`;
            break;
        case 'info':
            showClientInfo(selectedClientForContext);
            break;
        case 'screenshot':
            takeScreenshot(selectedClientForContext);
            break;
        case 'command':
            showCommandDialog(selectedClientForContext);
            break;
    }
    hideContextMenu();
}

// Show client info
function showClientInfo(clientId) {
    const client = clients[clientId];
    if (!client) return;
    
    alert(`Client: ${client.hostname}\nIP: ${client.ip}\nOS: ${client.os}\nStatus: ${client.online ? 'Online' : 'Offline'}`);
}

// Take screenshot
function takeScreenshot(clientId) {
    socket.emit('toggle_screen_stream', {
        client_id: clientId,
        enabled: true
    });
    alert('Screenshot request sent to client');
}

// Show command dialog
function showCommandDialog(clientId) {
    const command = prompt('Enter command to execute:');
    if (command) {
        socket.emit('send_command', {
            target: clientId,
            command: command
        });
        alert('Command sent to client');
    }
}

// Update clients list
function updateClientsList() {
    const clientsGrid = document.getElementById('clients-grid');
    clientsGrid.innerHTML = '';
    
    Object.entries(clients).forEach(([clientId, client]) => {
        const card = document.createElement('div');
        card.className = 'client-card';
        
        const statusClass = client.online ? 'online' : '';
        const statusText = client.online ? 'ONLINE' : 'OFFLINE';
        
        card.innerHTML = `
            <div class="client-header">
                <h3 class="client-name">${client.hostname}</h3>
                <div class="status-indicator ${statusClass}"></div>
            </div>
            <div class="client-info">
                <p><strong>Status:</strong> <span>${statusText}</span></p>
                <p><strong>IP:</strong> <span>${client.ip}</span></p>
                <p><strong>OS:</strong> <span>${client.os}</span></p>
                <p><strong>Client ID:</strong> <span><code>${clientId.substring(0, 8)}</code></span></p>
                <p><strong>Last Seen:</strong> <span>${new Date(client.last_seen).toLocaleString()}</span></p>
                <p><strong>Queued:</strong> <span>${client.queued_commands ? client.queued_commands.length : 0}</span></p>
            </div>
        `;
        
        // Add right-click context menu
        card.addEventListener('contextmenu', (e) => {
            showContextMenu(e, clientId);
        });
        
        // Add click to navigate to client page
        card.addEventListener('click', () => {
            window.location.href = `/client/${clientId}`;
        });
        
        clientsGrid.appendChild(card);
    });
}

// Update statistics
function updateStatistics() {
    const totalClients = Object.keys(clients).length;
    const onlineClients = Object.values(clients).filter(c => c.online).length;
    
    const successCount = commandHistory.filter(h => h.status === 'success').length;
    const totalCount = commandHistory.length;
    const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
    
    document.getElementById('stat-total-clients').textContent = totalClients;
    document.getElementById('stat-online-clients').textContent = onlineClients;
    document.getElementById('stat-commands-sent').textContent = totalCount;
    document.getElementById('stat-success-rate').textContent = `${successRate}%`;
}
