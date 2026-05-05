// --- SECURITY HELPERS ---
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- ADMIN STATE ---
const ADMIN_SECRET = "bubu2026"; // Default secret key
const adminState = {
    users: [],
    ads: [],
    reports: [],
    auditLogs: [],
    currentFeatTab: 'pending',
    currentUserSubTab: 'all',
    currentListingTab: 'all',
    pendingBanUser: null,
    currentAuditTab: 'all',
    auditTimeFilter: 'all',
    selectedLogs: new Set()
};

const SPEC_FIELDS_CONFIG = {
    phones: [
        { name: 'Brand', type: 'text' },
        { name: 'Model', type: 'text' },
        { name: 'Storage', type: 'select', options: ['64GB', '128GB', '256GB', '512GB', '1TB'] },
        { name: 'RAM', type: 'select', options: ['4GB', '8GB', '12GB', '16GB', '32GB'] },
        { name: 'Color', type: 'text' },
        { name: 'Storage Capacity', type: 'text' } // Fallback for script.js naming
    ],
    electronics: [
        { name: 'Type', type: 'select', options: ['Laptop', 'Desktop', 'Tablet', 'TV', 'Camera', 'Audio'] },
        { name: 'Brand', type: 'text' },
        { name: 'Model', type: 'text' },
        { name: 'Processor', type: 'text' },
        { name: 'RAM', type: 'text' },
        { name: 'Storage', type: 'text' },
        { name: 'Condition', type: 'select', options: ['New', 'Used', 'Refurbished'] }
    ],
    vehicles: [
        { name: 'Make/Brand', type: 'text' },
        { name: 'Model', type: 'text' },
        { name: 'Year', type: 'number' },
        { name: 'Year of Manufacture', type: 'number' }, // Fallback
        { name: 'Transmission', type: 'select', options: ['Automatic', 'Manual'] },
        { name: 'Fuel', type: 'select', options: ['Petrol', 'Diesel', 'Hybrid', 'Electric'] }
    ],
    fashion: [
        { name: 'Brand', type: 'text' },
        { name: 'Type', type: 'text' },
        { name: 'Size', type: 'text' },
        { name: 'Gender', type: 'select', options: ['Men', 'Women', 'Unisex'] },
        { name: 'Color', type: 'text' }
    ]
};



function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.onload = () => {
    initAdmin();
};

// --- CORE LOGIC ---
// --- HELPERS ---
function swapPreviewImage(newSrc) {
    const main = document.getElementById('mainPreviewImg');
    if (main) main.src = newSrc;
}

function findUserPhoto(u) {
    if (!u) return null;
    let photo = u.picture || u.avatar_url || u.photo_url || u.photo || u.avatar || u.profile_picture || u.image || u.seller_photo || u.seller_image || null;
    if (Array.isArray(photo)) return photo[0];
    if (typeof photo === 'string' && photo.trim().startsWith('[')) {
        try { const arr = JSON.parse(photo); if (Array.isArray(arr)) return arr[0]; } catch(e) {}
    }
    return photo;
}

async function initAdmin() {
    console.log("Admin Initializing...");
    await refreshData();
    setupNavigation();
}

async function refreshData() {
    try {
        // 1. Fetch Users (Profiles table)
        const { data: users, error: uErr } = await sb.from('profiles').select('*');
        if (uErr) throw uErr;
        adminState.users = users || [];

        // 2. Fetch Ads
        const { data: ads, error: aErr } = await sb.from('ads').select('*').order('created_at', { ascending: false });
        if (aErr) throw aErr;
        adminState.ads = ads || [];

        // 3. Fetch Reports
        const { data: reports, error: rErr } = await sb.from('reports').select('*').order('created_at', { ascending: false });
        if (rErr) throw rErr;
        adminState.reports = reports || [];

        // 4. Fetch Audit Logs (Safely)
        try {
            const { data: logs, error: logErr } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
            if (!logErr) adminState.auditLogs = logs || [];
        } catch(e) {
            console.warn("Audit logs table might not exist yet.");
        }

        // Safely update UI sections
        const tasks = [
            { name: 'Stats', fn: updateStats },
            { name: 'Users', fn: renderUsers },
            { name: 'Listings', fn: renderListings },
            { name: 'Reports', fn: renderReports },
            { name: 'Verifications', fn: renderVerifications },
            { name: 'Featuring', fn: renderFeaturing },
            { name: 'AuditLogs', fn: renderAuditLogs },
            { name: 'Growth', fn: updateGrowthStats },
            { name: 'Broadcast', fn: loadBroadcastStatus }
        ];

        tasks.forEach(t => {
            try { t.fn(); } catch(e) { console.error(`Error in ${t.name}:`, e); }
        });

    } catch (err) {
        console.error("Refresh Error:", err.message);
    }
}

function updateStats() {
    // Row 1
    document.getElementById('stat-ads').textContent = adminState.ads.length;
    document.getElementById('stat-users').textContent = adminState.users.length;
    document.getElementById('stat-reports').textContent = adminState.reports.length;
    document.getElementById('stat-featured').textContent = adminState.ads.filter(a => a.featured).length;

    // Row 2
    document.getElementById('stat-verifications').textContent = adminState.users.filter(u => u.verification_status === 'pending').length;
    document.getElementById('stat-boosts').textContent = adminState.ads.filter(a => a.boost_status === 'pending').length;
    document.getElementById('stat-banned').textContent = adminState.users.filter(u => u.is_banned).length;
}

function updateGrowthStats() {
    const now = new Date();
    
    // Timeframes
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);
    
    const startOfMonth = new Date();
    startOfMonth.setMonth(now.getMonth() - 1);
    
    const startOfYear = new Date();
    startOfYear.setFullYear(now.getFullYear() - 1);

    // Filter Logic
    const filterByDate = (list, date) => list.filter(i => new Date(i.created_at) >= date).length;

    // Week
    document.getElementById('growth-users-week').textContent = filterByDate(adminState.users, startOfWeek);
    document.getElementById('growth-ads-week').textContent = filterByDate(adminState.ads, startOfWeek);

    // Month
    document.getElementById('growth-users-month').textContent = filterByDate(adminState.users, startOfMonth);
    document.getElementById('growth-ads-month').textContent = filterByDate(adminState.ads, startOfMonth);

    // Year
    document.getElementById('growth-users-year').textContent = filterByDate(adminState.users, startOfYear);
    document.getElementById('growth-ads-year').textContent = filterByDate(adminState.ads, startOfYear);

    // Also update badges on top cards (using week)
    const newAds = filterByDate(adminState.ads, startOfWeek);
    const newUsers = filterByDate(adminState.users, startOfWeek);
    
    const badgeAds = document.getElementById('badge-ads');
    const badgeUsers = document.getElementById('badge-users');
    if (badgeAds) badgeAds.textContent = `+${newAds} this week`;
    if (badgeUsers) badgeUsers.textContent = `+${newUsers} this week`;
}

async function logAudit(action, details, targetId = null) {
    const adminName = localStorage.getItem('admin_name') || 'Admin';
    try {
        await sb.from('audit_logs').insert([{
            admin_name: adminName,
            action: action,
            details: details,
            target_id: targetId
        }]);
        // Also add locally for instant UI update
        adminState.auditLogs.unshift({
            created_at: new Date().toISOString(),
            admin_name: adminName,
            action: action,
            details: details,
            target_id: targetId
        });
        renderAuditLogs();
    } catch (e) {
        console.error("Failed to log audit:", e);
    }
}

function toggleTimeDropdown() {
    document.getElementById('timeDropdown').classList.toggle('hidden');
}

function setTimeFilter(range) {
    adminState.auditTimeFilter = range;
    const label = document.getElementById('timeFilterLabel');
    if (range === 'today') label.textContent = 'Today';
    else if (range === 'yesterday') label.textContent = 'Yesterday';
    else if (range === 'week') label.textContent = 'Last Week';
    else if (range === 'month') label.textContent = 'Last Month';
    else if (range === 'custom') label.textContent = 'Custom Range';
    else label.textContent = 'Time Range';

    document.getElementById('timeDropdown').classList.add('hidden');
    renderAuditLogs();
}

function toggleAllLogs(checked) {
    const checkboxes = document.querySelectorAll('.log-check');
    adminState.selectedLogs.clear();
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) adminState.selectedLogs.add(cb.value);
    });
    updateDeleteLogsBtn();
}

function toggleLogSelection(id, checked) {
    if (checked) adminState.selectedLogs.add(id);
    else adminState.selectedLogs.delete(id);
    updateDeleteLogsBtn();
}

function updateDeleteLogsBtn() {
    const btn = document.getElementById('btnDeleteLogs');
    btn.style.display = adminState.selectedLogs.size > 0 ? 'block' : 'none';
}

async function deleteSelectedLogs() {
    if (adminState.selectedLogs.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${adminState.selectedLogs.size} logs?`)) return;

    // Convert IDs to numbers if they are numeric to match database types (int8/bigint)
    const ids = Array.from(adminState.selectedLogs).map(id => {
        return isNaN(id) ? id : Number(id);
    });

    try {
        console.log("Attempting to delete log IDs:", ids);
        const { error } = await sb.from('audit_logs').delete().in('id', ids);
        
        if (error) {
            console.error("Supabase Delete Error:", error);
            alert("Database Error: " + error.message + "\n(Check if RLS is blocking DELETE operations on audit_logs)");
            return;
        }

        showToast(`${ids.length} logs deleted.`);
        adminState.selectedLogs.clear();
        updateDeleteLogsBtn();
        refreshData();
    } catch (e) {
        console.error("Delete Exception:", e);
        alert("System Error: " + e.message);
    }
}

function switchListingTab(tab, btn) {
    adminState.currentListingTab = tab;
    // Update active UI
    const container = btn.parentElement;
    container.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    renderCategoryFilters();
    renderListings();
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilterContainer');
    if (!container) return;

    if (adminState.currentListingTab === 'all' || adminState.currentListingTab === 'other') {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const config = SPEC_FIELDS_CONFIG[adminState.currentListingTab];
    if (!config) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
        <span style="font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-right: 8px;">Filters:</span>
        ${config.map(field => {
            if (field.type === 'select') {
                return `
                    <select class="admin-dynamic-filter" data-field="${field.name}" onchange="filterAds()" style="padding: 10px 16px; border: 1px solid var(--admin-border); border-radius: 8px; font-size: 13px; font-weight: 600; color: #475569; background: white; cursor: pointer; min-width: 140px;">
                        <option value="">${field.name}</option>
                        ${field.options.map(o => `<option value="${o}">${o}</option>`).join('')}
                    </select>
                `;
            } else {
                return `
                    <input type="text" class="admin-dynamic-filter" data-field="${field.name}" placeholder="${field.name}..." oninput="filterAds()" style="padding: 10px 16px; border: 1px solid var(--admin-border); border-radius: 8px; font-size: 13px; font-weight: 600; color: #475569; background: white; width: 140px;">
                `;
            }
        }).join('')}
        <button onclick="clearDynamicFilters()" style="font-size: 13px; font-weight: 800; color: #6366f1; border: none; background: none; cursor: pointer; text-decoration: underline; margin-left: 8px;">Reset Filters</button>
    `;
}

function clearDynamicFilters() {
    document.querySelectorAll('.admin-dynamic-filter').forEach(el => el.value = '');
    filterAds();
}

function renderListings(filteredList = null) {
    const table = document.getElementById('listingTable');
    if (!table) return;

    let ads = filteredList || adminState.ads;

    // Apply category tab filtering if not already filtered (e.g. by search or user)
    if (!filteredList && adminState.currentListingTab !== 'all') {
        ads = ads.filter(ad => ad.category === adminState.currentListingTab);
    }

    if (ads.length === 0) {
        table.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:#94a3b8">No listings found in this category.</td></tr>';
        return;
    }

    table.innerHTML = ads.map(ad => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px">
                    <img src="${Array.isArray(ad.photos) ? ad.photos[0] : ad.photos}" 
                         style="width:40px; height:40px; border-radius:8px; object-fit:cover; cursor:pointer;"
                         onclick="openImageViewer(this.src)">
                    <div>
                        <div style="font-weight:700">${ad.title.slice(0,30)}</div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span style="font-size:11px; color:#64748b">ID: ${ad.id}</span>
                            <span style="font-size:11px; color:#6366f1; font-weight:700;">👁 ${ad.views || 0} views</span>
                        </div>
                    </div>
                </div>
            </td>
            <td>
                <div style="position:relative; cursor:pointer;" onclick="viewUserProfile('${ad.user_id}')">
                    <span style="border-bottom: 1px dashed #6366f1; color: #6366f1; font-weight: 700;">${ad.seller_name || 'Seller'}</span>
                </div>
            </td>
            <td style="font-weight:700; color:#1e293b">${Number(ad.price).toLocaleString()}</td>
            <td>${ad.category}</td>
            <td style="display:flex; gap:8px">
                <button class="btn-action" style="background:#f1f5f9; color:#475569; border:none" onclick="viewAdDetail('${ad.id}')">View</button>
                <button class="btn-action" style="background:#fef3c7; color:#92400e; border:none" onclick="openAdminEdit('${ad.id}')">Edit</button>
                <button class="btn-action btn-feature" onclick="toggleFeature('${ad.id}', ${ad.featured})">
                    ${ad.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button class="btn-action btn-delete" onclick="deleteAd('${ad.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderAuditLogs() {
    const table = document.getElementById('auditTable');
    if (!table) return;
    
    let filtered = [...adminState.auditLogs];

    // 1. Time Filter
    const now = new Date();
    if (adminState.auditTimeFilter === 'today') {
        const startOfToday = new Date(now.setHours(0,0,0,0));
        filtered = filtered.filter(log => new Date(log.created_at) >= startOfToday);
    } else if (adminState.auditTimeFilter === 'yesterday') {
        const startOfYesterday = new Date(now.setDate(now.getDate() - 1));
        startOfYesterday.setHours(0,0,0,0);
        const endOfYesterday = new Date(startOfYesterday);
        endOfYesterday.setHours(23,59,59,999);
        filtered = filtered.filter(log => {
            const d = new Date(log.created_at);
            return d >= startOfYesterday && d <= endOfYesterday;
        });
    } else if (adminState.auditTimeFilter === 'week') {
        const lastWeek = new Date(now.setDate(now.getDate() - 7));
        filtered = filtered.filter(log => new Date(log.created_at) >= lastWeek);
    } else if (adminState.auditTimeFilter === 'month') {
        const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
        filtered = filtered.filter(log => new Date(log.created_at) >= lastMonth);
    } else if (adminState.auditTimeFilter === 'custom') {
        const from = document.getElementById('dateFrom').value;
        const to = document.getElementById('dateTo').value;
        if (from) filtered = filtered.filter(log => new Date(log.created_at) >= new Date(from));
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23,59,59,999);
            filtered = filtered.filter(log => new Date(log.created_at) <= toDate);
        }
    }

    if (filtered.length === 0) {
        table.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:#94a3b8">No audit logs found for this filter.</td></tr>';
        return;
    }

    table.innerHTML = filtered.map(log => {
        const d = new Date(log.created_at);
        const timeStr = isNaN(d.getTime()) ? 'Unknown Time' : d.toLocaleString();
        const isChecked = adminState.selectedLogs.has(String(log.id));
        
        // Find target user name if possible
        const targetUser = log.target_id ? adminState.users.find(u => String(u.id) === String(log.target_id)) : null;
        const targetDisplay = log.target_id ? (targetUser ? targetUser.name : `ID: ${log.target_id.slice(0,8)}`) : '—';
        const targetClick = log.target_id ? `onclick="viewUserProfile('${log.target_id}')" style="cursor:pointer; color:#6366f1; text-decoration:underline; font-weight:700"` : '';

        return `
        <tr>
            <td style="text-align:center">
                <input type="checkbox" class="log-check" value="${log.id}" ${isChecked ? 'checked' : ''} onchange="toggleLogSelection('${log.id}', this.checked)">
            </td>
            <td style="font-size:11px; color:#64748b;">${timeStr}</td>
            <td ${targetClick}>${targetDisplay}</td>
            <td><span style="background:#f1f5f9; color:#475569; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:700; text-transform:uppercase">${log.action}</span></td>
            <td style="font-size:12px; color:#475569;">${log.details || ''}</td>
        </tr>`;
    }).join('');
}

async function loadBroadcastStatus() {
    const statusEl = document.getElementById('broadcastStatus');
    const toggle = document.getElementById('maintenanceToggle');
    try {
        const { data, error } = await sb.from('system_config').select('*');
        if (error) throw error;

        const maintenance = data.find(i => i.key === 'maintenance_mode')?.value === 'true';
        const msg = data.find(i => i.key === 'broadcast_message')?.value || 'Default (System Update in progress)';

        if (toggle) toggle.checked = maintenance;

        statusEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div>Current Msg: <span style="color: #6366f1">${msg}</span></div>
                <div>Mode: <span style="${maintenance ? 'color: #ef4444' : 'color: #10b981'}">${maintenance ? 'MAINTENANCE ACTIVE' : 'Operational'}</span></div>
            </div>
        `;
    } catch (err) {
        statusEl.textContent = "Error loading status.";
    }
}

async function toggleMaintenance(isOn) {
    try {
        await sb.from('system_config').upsert({ key: 'maintenance_mode', value: String(isOn) }, { onConflict: 'key' });
        logAudit('System Config', `Turned maintenance mode ${isOn ? 'ON' : 'OFF'}`);
        showToast(isOn ? "Maintenance Mode ENABLED" : "Maintenance Mode Disabled");
        loadBroadcastStatus();
    } catch (err) {
        alert("Toggle Error: " + err.message);
    }
}

async function setSystemMessage() {
    const msg = document.getElementById('broadcastMsg').value.trim();
    if (!msg) {
        alert("Please enter a message first.");
        return;
    }

    try {
        await sb.from('system_config').upsert({ key: 'broadcast_message', value: msg }, { onConflict: 'key' });
        logAudit('Broadcast', `Updated system message to: "${msg}"`);
        alert("System message updated!");
        loadBroadcastStatus();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function clearSystemMessage() {
    try {
        await sb.from('system_config').upsert({ key: 'broadcast_message', value: '' }, { onConflict: 'key' });
        logAudit('Broadcast', `Cleared system message`);
        document.getElementById('broadcastMsg').value = '';
        alert("Message cleared.");
        loadBroadcastStatus();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

function renderUsers(specificUsers = null) {
    const list = specificUsers || adminState.users;
    const table = document.getElementById('userTable');
    table.innerHTML = list.map(u => `
        <tr>
            <td style="padding-left:16px;">
                <div style="display:flex; align-items:center; gap:12px">
                    <div style="width:48px; height:48px; border-radius:12px; overflow:hidden; background:#f1f5f9; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        ${(() => {
                            const pPhoto = findUserPhoto(u);
                            if (pPhoto) return `<img src="${pPhoto}" style="width:100%; height:100%; object-fit:cover;">`;
                            return `<span style="font-weight:800; color:#94a3b8; font-size:16px;">${u.name ? u.name[0] : '?'}</span>`;
                        })()}
                    </div>
                    <div>
                        <div onclick="viewUserProfile('${u.id}')" 
                             style="font-weight:800; cursor:pointer; color:#1e293b; text-decoration:none; font-size:14px; ${u.is_banned ? 'text-decoration: line-through; color: #94a3b8' : ''}"
                             onmouseover="this.style.color='#4338ca'; this.style.textDecoration='underline'"
                             onmouseout="this.style.color='#1e293b'; this.style.textDecoration='none'"
                             title="View Internal Profiling">
                            ${u.name || 'Anonymous'}
                        </div>
                        <div style="font-size:10px; color:#94a3b8; font-weight:600">ID: ${String(u.id).slice(0, 8)}</div>
                        <div style="font-size:10px; color:#64748b;">${u.email}</div>
                    </div>
                </div>
            </td>
            <td style="width:350px;">
                ${u.is_banned ? `
                    <!-- BANNED: Show Reason -->
                    <div style="position:relative;">
                        <div id="reason-text-${u.id}" style="font-size:12px; color:#b91c1c; font-weight:700; background:#fef2f2; padding:8px 30px 8px 12px; border-radius:8px; border:1px solid #fecaca; line-height:1.4; word-break: break-word; overflow:hidden; max-height:45px; transition:max-height 0.3s ease;">
                            ${u.ban_reason || 'No reason provided'}
                        </div>
                        <button onclick="toggleReasonExpand('${u.id}', this)" style="position:absolute; top:8px; right:8px; background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; color:#ef4444; transition: transform 0.2s;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                    </div>
                ` : `
                    <!-- ACTIVE: Show Admin Note -->
                    <div style="position:relative; group">
                        <div id="note-text-${u.id}" style="font-size:12px; color:#475569; font-weight:600; background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0; line-height:1.4; word-break: break-word; font-style:italic;">
                            ${u.admin_notes || '<span style="opacity:0.5; font-weight:400;">No notes...</span>'}
                        </div>
                        <button onclick="editAdminNote('${u.id}')" style="margin-top:4px; font-size:10px; color:#6366f1; border:none; background:none; font-weight:700; cursor:pointer; padding:0; text-decoration:underline;">
                            Edit Note
                        </button>
                    </div>
                `}
            </td>
            <td>${u.phone || '—'}</td>
            <td style="text-align:center; font-weight:700; color:#6366f1">
                ${(adminState.ads || []).filter(a => String(a.user_id) === String(u.id)).length}
            </td>
            <td>
                <span class="admin-badge ${u.is_banned ? 'badge-delete' : 'badge-active'}">
                    ${u.is_banned ? 'Banned' : 'Active'}
                </span>
            </td>
            <td style="padding: 12px 16px;">
                <div style="display:flex; gap:8px; justify-content:flex-end">
                    <button class="btn-action" style="background:#e0e7ff; color:#4338ca" onclick="viewUserAds('${u.id}')">Ads</button>
                    <button class="btn-action" style="background:${u.is_banned ? '#dcfce7' : '#fee2e2'}; color:${u.is_banned ? '#166534' : '#b91c1c'}" 
                            onclick="toggleBan('${u.id}', ${u.is_banned})">
                        ${u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteUser('${u.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function switchUserSubTab(tab, el) {
    adminState.currentUserSubTab = tab;
    // Update Header Text
    const header = document.getElementById('userListNoteHeader');
    if (header) {
        if (tab === 'active') header.textContent = 'Note';
        else if (tab === 'banned') header.textContent = 'Ban Reason';
        else header.textContent = 'Notes / Reason';
    }
    // UI Update
    document.querySelectorAll('#section-users .sub-tab').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    filterUsers();
}

function filterUsers() {
    const query = document.getElementById('userSearch').value.toLowerCase();
    const subTab = adminState.currentUserSubTab;

    const filtered = adminState.users.filter(u => {
        // 1. Text Filter
        const matchesQuery = String(u.id).toLowerCase().includes(query) || 
                            (u.name && u.name.toLowerCase().includes(query)) || 
                            (u.email && u.email.toLowerCase().includes(query));
        
        // 2. Tab Filter
        let matchesTab = true;
        if (subTab === 'active') matchesTab = !u.is_banned;
        else if (subTab === 'banned') matchesTab = u.is_banned;

        return matchesQuery && matchesTab;
    });

    renderUsers(filtered);
}

function viewUserProfile(userId) {
    const user = adminState.users.find(u => String(u.id) === String(userId));
    if (!user) return;
    
    const status = user.is_banned ? "🔴 BANNED" : "🟢 ACTIVE";
    const reason = user.ban_reason ? `\n\nBAN REASON:\n"${user.ban_reason}"` : "";
    
    alert(`[ USER INTERNAL PROFILE ]\n\nID: ${user.id}\nName: ${user.name || 'Unknown'}\nEmail: ${user.email}\nPhone: ${user.phone || 'N/A'}\nStatus: ${status}${reason}\n\nRegistered: ${new Date(user.created_at).toLocaleString()}`);
}

function viewUserAds(userId) {
    const userAds = adminState.ads.filter(ad => String(ad.user_id) === String(userId));
    if (userAds.length === 0) {
        showToast("This user has no ads.");
        return;
    }
    
    // Switch to listings tab and filter them
    switchTab('listings');
    renderListings(userAds);
    
    // Show filter info
    const filterInfo = document.getElementById('listingFilterInfo');
    if (filterInfo) filterInfo.style.display = 'flex';
    
    showToast(`Showing ${userAds.length} ads for user.`);
}

function clearListingFilter() {
    const filterInfo = document.getElementById('listingFilterInfo');
    if (filterInfo) filterInfo.style.display = 'none';
    renderListings();
    showToast("Showing all listings.");
}

function filterAds() {
    const query = document.getElementById('adSearch').value.toLowerCase();
    const currentTab = adminState.currentListingTab;
    
    // Collect dynamic filters
    const dynamicFilters = {};
    document.querySelectorAll('.admin-dynamic-filter').forEach(el => {
        if (el.value) {
            dynamicFilters[el.getAttribute('data-field')] = el.value.toLowerCase();
        }
    });

    const filtered = adminState.ads.filter(ad => {
        // 1. Category Tab Filter
        const matchesTab = currentTab === 'all' || ad.category === currentTab;
        if (!matchesTab) return false;

        // 2. Text Search Filter
        const matchesQuery = String(ad.id).toLowerCase().includes(query) || 
                            (ad.title && ad.title.toLowerCase().includes(query)) || 
                            (ad.seller_name && ad.seller_name.toLowerCase().includes(query));
        if (!matchesQuery) return false;

        // 3. Dynamic Spec Filters
        for (const [field, val] of Object.entries(dynamicFilters)) {
            const specs = ad.specs || {};
            const adVal = String(specs[field] || '').toLowerCase();
            if (!adVal.includes(val)) return false;
        }

        return true;
    });
    
    renderListings(filtered);
}


function renderReports() {
    const table = document.getElementById('reportTable');
    if (adminState.reports.length === 0) {
        table.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:#94a3b8">No active reports. All good!</td></tr>';
        return;
    }
    
    table.innerHTML = adminState.reports.map(r => `
        <tr>
            <td style="font-weight:600; color:#1e293b">${r.listing_title}</td>
            <td>${r.reported_by}</td>
            <td><span style="background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:700">${r.reason}</span></td>
            <td style="font-size:13px; color:#64748b; max-width:250px">${r.details || '—'}</td>
            <td style="display:flex; gap:8px">
                <button class="btn-action" style="background:#e0e7ff; color:#4338ca; border:none" onclick="viewUserAds('${r.listing_id}')">Check Ad</button>
                <button class="btn-action btn-feature" onclick="dismissReport('${r.id}')">Dismiss</button>
            </td>
        </tr>
    `).join('');
}

function renderDynamicSpecs(category, currentSpecs = {}) {
    const container = document.getElementById('dynamicSpecsContainer');
    if (!container) return;
    
    const fields = SPEC_FIELDS_CONFIG[category] || [];
    if (fields.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8; font-size:12px">No specific fields for this category.</p>';
        return;
    }

    container.innerHTML = fields.map(f => {
        // Try exact match then case-insensitive match
        let val = currentSpecs[f.name];
        if (val === undefined) {
            const key = Object.keys(currentSpecs).find(k => k.toLowerCase() === f.name.toLowerCase());
            if (key) val = currentSpecs[key];
        }
        val = val || '';
        
        let inputHtml = '';
        
        if (f.type === 'select') {
            inputHtml = `
                <select class="spec-input" data-name="${f.name}" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; outline:none">
                    <option value="">Select ${f.name}...</option>
                    ${f.options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>`;
        } else {
            inputHtml = `<input type="${f.type}" class="spec-input" data-name="${f.name}" value="${val}" placeholder="${f.name}..." style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; outline:none">`;
        }

        return `
            <div>
                <label style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase">${f.name}</label>
                <div style="margin-top:4px">${inputHtml}</div>
            </div>`;
    }).join('');
}

let currentEditingAd = null;
function openAdminEdit(id) {
    const ad = adminState.ads.find(a => String(a.id) === String(id));
    if (!ad) return;
    currentEditingAd = ad;
    
    document.getElementById('editAdTitle').value = ad.title || '';
    document.getElementById('editAdPrice').value = ad.price || 0;
    document.getElementById('editAdDesc').value = ad.description || '';
    document.getElementById('editAdCategory').value = ad.category || 'other';
    document.getElementById('editAdCondition').value = ad.condition || 'used';
    
    renderDynamicSpecs(ad.category, ad.specs || {});
    
    document.getElementById('editModal').style.display = 'flex';
}

async function saveAdminEdit() {
    if (!currentEditingAd) return;
    
    // Collect dynamic specs
    const specs = {};
    document.querySelectorAll('.spec-input').forEach(input => {
        const name = input.getAttribute('data-name');
        specs[name] = input.value;
    });

    const updates = {
        title: document.getElementById('editAdTitle').value,
        price: Number(document.getElementById('editAdPrice').value),
        description: document.getElementById('editAdDesc').value,
        category: document.getElementById('editAdCategory').value,
        condition: document.getElementById('editAdCondition').value,
        specs: specs
    };

    const { error } = await sb.from('ads').update(updates).eq('id', currentEditingAd.id);
    
    if (error) {
        alert("Error updating ad: " + error.message);
    } else {
        logAudit('Edit Listing', `Updated listing: ${currentEditingAd.title} (ID: ${currentEditingAd.id})`);
        alert("Ad updated successfully!");
        closeAdminModal();
        refreshData();
    }
}

// Re-render specs if category changes during edit
document.addEventListener('change', e => {
    if (e.target && e.target.id === 'editAdCategory') {
        const newCat = e.target.value;
        const currentSpecs = {};
        document.querySelectorAll('.spec-input').forEach(input => {
            const name = input.getAttribute('data-name');
            currentSpecs[name] = input.value;
        });
        renderDynamicSpecs(newCat, currentSpecs);
    }
});

function closeAdminModal() {
    document.getElementById('editModal').style.display = 'none';
}

function showToast(msg) {
    alert(msg); // Simplified for admin
}

async function deleteAd(id) {
    if (!confirm("Are you sure you want to PERMANENTLY delete this listing?")) return;
    
    // Find seller ID before deleting
    const ad = adminState.ads.find(a => String(a.id) === String(id));
    const sellerId = ad ? ad.user_id : null;

    const { error } = await sb.from('ads').delete().eq('id', id);
    if (error) alert("Error deleting ad: " + error.message);
    else {
        logAudit('Delete Listing', `Deleted listing (ID: ${id})`, sellerId);
        alert("Ad deleted successfully.");
        refreshData();
    }
}

async function deleteUser(id) {
    if (!confirm("Are you sure? This will delete the user's profile and all their ads. (Note: Auth account must be deleted in Supabase Dashboard)")) return;
    
    // Delete profile
    const { error: pErr } = await sb.from('profiles').delete().eq('id', id);
    // Delete user ads
    const { error: aErr } = await sb.from('ads').delete().eq('user_id', id);

    if (pErr) alert("Error deleting profile: " + pErr.message);
    else {
        logAudit('Delete User', `Deleted user (ID: ${id}) and their ads`, id);
        alert("User data removed from cloud.");
        refreshData();
    }
}

function toggleReasonExpand(id, btn) {
    const el = document.getElementById(`reason-text-${id}`);
    if (!el) return;
    
    if (el.style.maxHeight === '45px' || !el.style.maxHeight) {
        el.style.maxHeight = '1000px';
        btn.style.transform = 'rotate(180deg)';
    } else {
        el.style.maxHeight = '45px';
        btn.style.transform = 'rotate(0deg)';
    }
}

async function editAdminNote(userId) {
    const user = adminState.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    const newNote = prompt("Enter an internal note for this user:", user.admin_notes || "");
    if (newNote === null) return; // Cancelled

    const { error } = await sb.from('profiles').update({ 
        admin_notes: newNote.trim() 
    }).eq('id', userId);

    if (error) {
        alert("Error saving note: " + error.message);
    } else {
        showToast("Admin note updated.");
        refreshData();
    }
}

function handleBanReasonSelect(val) {
    const custom = document.getElementById('banCustomReason');
    if (val === 'Other') {
        custom.value = '';
        custom.focus();
    } else if (val) {
        custom.value = val;
    }
}

async function toggleBan(userId, currentStatus) {
    if (currentStatus) {
        // Unbanning: Simple confirm
        if (!confirm("Are you sure you want to unban this user?")) return;
        executeBanUpdate(userId, false, null);
    } else {
        // Banning: Show Modal
        adminState.pendingBanUser = userId;
        document.getElementById('banQuickReason').value = '';
        document.getElementById('banCustomReason').value = '';
        document.getElementById('banModal').style.display = 'flex';
    }
}

function closeBanModal() {
    document.getElementById('banModal').style.display = 'none';
    adminState.pendingBanUser = null;
}

async function confirmToggleBan() {
    const userId = adminState.pendingBanUser;
    if (!userId) return;
    
    const reason = document.getElementById('banCustomReason').value.trim();
    if (!reason) {
        alert("Please provide a reason for the restriction.");
        return;
    }

    executeBanUpdate(userId, true, reason);
    closeBanModal();
}

async function executeBanUpdate(userId, banStatus, reason) {
    const { error } = await sb.from('profiles').update({ 
        is_banned: banStatus,
        ban_reason: reason
    }).eq('id', userId);

    if (error) {
        alert("Error updating ban status: " + error.message);
    } else {
        const detailMsg = banStatus ? `Banned for: ${reason}` : 'User unbanned';
        logAudit(banStatus ? 'Ban User' : 'Unban User', detailMsg, userId);
        showToast(banStatus ? "User restricted with reason logged." : "User unbanned successfully.");
        refreshData();
    }
}

function openImageViewer(url) {
    const modal = document.getElementById('imageViewerModal');
    const img = document.getElementById('viewerImg');
    if (!modal || !img) return;
    img.src = url;
    modal.style.display = 'flex';
}

function closeImageViewer() {
    document.getElementById('imageViewerModal').style.display = 'none';
}

let currentVerifTab = 'pending';

function switchVerifTab(tab, btn) {
    currentVerifTab = tab;
    document.querySelectorAll('.verif-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderVerifications();
}

// Update click handlers in renderVerifications
function renderVerifications() {
    const table = document.getElementById('verificationTable');
    
    // Filter users based on selected tab
    const filtered = adminState.users.filter(u => u.verification_status === currentVerifTab);
    
    if (filtered.length === 0) {
        table.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:#94a3b8">No ${currentVerifTab} verification requests.</td></tr>`;
        return;
    }
    
    table.innerHTML = filtered.map(u => {
        const isCanceled = u.verification_status === 'canceled';
        const isVerified = u.verification_status === 'verified';
        
        let statusBadge = '';
        if (isCanceled) statusBadge = '<span class="admin-badge" style="background:#f1f5f9; color:#64748b">Canceled</span>';
        else if (isVerified) statusBadge = '<span class="admin-badge" style="background:#dcfce7; color:#166534">Verified</span>';
        else statusBadge = '<span class="admin-badge" style="background:#fef9c3; color:#854d0e">Pending</span>';

        let actionButtons = '';
        if (isCanceled) {
            actionButtons = `<button class="btn-action" style="background:#e2e8f0; color:#475569" onclick="clearVerificationStatus('${u.id}')">Dismiss</button>`;
        } else if (isVerified) {
            actionButtons = `<button class="btn-action" style="background:#fee2e2; color:#b91c1c" onclick="handleVerification('${u.id}', false)">Revoke</button>`;
        } else {
            actionButtons = `
                <button class="btn-action" style="background:#dcfce7; color:#166534" onclick="handleVerification('${u.id}', true)">Approve</button>
                <button class="btn-action" style="background:#fee2e2; color:#b91c1c" onclick="handleVerification('${u.id}', false)">Reject</button>
            `;
        }

        return `
        <tr style="${isCanceled ? 'opacity: 0.6; background: #f8fafc' : ''}">
            <td>
                <strong>${u.verif_full_name || u.name}</strong><br>
                <small style="color:#64748b">${u.email}</small><br>
                <small style="color:#6366f1; font-weight:600">${u.verif_phone || u.phone || 'No phone'}</small>
                ${u.verif_notes ? `<div style="margin-top: 6px; font-size: 11px; padding: 6px; background: #f8fafc; border-left: 2px solid #cbd5e1; color: #475569; max-width: 200px; word-wrap: break-word;">${u.verif_notes}</div>` : ''}
            </td>
            <td>
                <img src="${u.id_photo_url}" style="width:80px; height:50px; object-fit:cover; border-radius:4px; cursor:pointer" onclick="openImageViewer('${u.id_photo_url}')">
            </td>
            <td>
                <img src="${u.selfie_photo_url}" style="width:50px; height:50px; object-fit:cover; border-radius:50%; cursor:pointer" onclick="openImageViewer('${u.selfie_photo_url}')">
            </td>
            <td>${statusBadge}</td>
            <td style="display:flex; gap:8px">
                ${actionButtons}
            </td>
        </tr>`;
    }).join('');
}

async function clearVerificationStatus(userId) {
    const { error } = await sb.from('profiles').update({ verification_status: 'unverified' }).eq('id', userId);
    if (error) alert("Error: " + error.message);
    else {
        logAudit('Verification', `Cleared verification status for user (ID: ${userId})`);
        refreshData();
    }
}

async function handleVerification(userId, approved) {
    const updates = {
        verification_status: approved ? 'verified' : 'rejected',
        is_verified: approved
    };
    const { error } = await sb.from('profiles').update(updates).eq('id', userId);
    if (error) alert("Error: " + error.message);
    else {
        logAudit('Verification', `${approved ? 'Approved' : 'Rejected'} verification for user (ID: ${userId})`);
        alert(approved ? "User verified!" : "Verification rejected.");
        refreshData();
    }
}

async function toggleFeature(id, current) {
    // Ensure ID is a number if it looks like one
    const adId = isNaN(id) ? id : Number(id);
    const newStatus = !current;

    try {
        const { error } = await sb.from('ads').update({ 
            featured: newStatus,
            // If we are unfeaturing, we should also reset the boost status to avoid confusion
            boost_status: newStatus ? 'approved' : null 
        }).eq('id', adId);

        if (error) {
            console.error("Feature Update Error:", error);
            alert("Error updating feature status: " + error.message);
            return;
        }

        logAudit('Feature Listing', `${newStatus ? 'Featured' : 'Unfeatured'} listing (ID: ${id})`, null);
        showToast(`Listing ${newStatus ? 'Featured' : 'Unfeatured'} successfully.`);
        
        // Refresh data to update the UI
        await refreshData();
    } catch (e) {
        console.error("Feature Update Exception:", e);
        alert("System Error: " + e.message);
    }
}

async function dismissReport(id) {
    if (!confirm("Are you sure you want to dismiss this report?")) return;
    const { error } = await sb.from('reports').delete().eq('id', id);
    if (error) alert("Error dismissing report: " + error.message);
    else {
        logAudit('Dismiss Report', `Dismissed report (ID: ${id})`);
        refreshData();
    }
}

/* ============================================================
   FEATURING (BOOST) LOGIC
============================================================ */
function switchFeatTab(tab, btn) {
    adminState.currentFeatTab = tab;
    // Update active state for buttons in this specific section
    btn.parentElement.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFeaturing();
}

function handleManualFeatSearch(query) {
    const resultsDiv = document.getElementById('manualFeatResults');
    if (!query || query.length < 2) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
        return;
    }

    const matches = adminState.ads.filter(ad => 
        ad.title.toLowerCase().includes(query.toLowerCase()) || 
        String(ad.id).toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (matches.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:12px; color:#94a3b8; font-size:13px">No listings found.</div>';
    } else {
        resultsDiv.innerHTML = matches.map(ad => `
            <div class="search-result-item" onclick="toggleFeature('${ad.id}', ${ad.featured}); document.getElementById('manualFeatSearch').value=''; this.parentElement.classList.add('hidden');">
                <img src="${Array.isArray(ad.photos) ? ad.photos[0] : ad.photos}" style="width:32px; height:32px; border-radius:6px; object-fit:cover">
                <div style="flex:1">
                    <div style="font-weight:700; font-size:13px; color:#1e293b">${ad.title.slice(0, 40)}</div>
                    <div style="font-size:11px; color:#64748b">${ad.category} • ETB ${Number(ad.price).toLocaleString()}</div>
                </div>
                <div style="font-size:10px; font-weight:800; color:${ad.featured ? '#10b981' : '#6366f1'}">
                    ${ad.featured ? 'ALREADY PINNED' : 'CLICK TO PIN'}
                </div>
            </div>
        `).join('');
    }
    resultsDiv.classList.remove('hidden');
}

function renderFeaturing() {
    const table = document.getElementById('featuringTable');
    if (!table) return;

    // Filter ads based on boost status
    const filtered = adminState.ads.filter(ad => {
        if (adminState.currentFeatTab === 'pending') return ad.boost_status === 'pending';
        if (adminState.currentFeatTab === 'approved') return ad.featured === true;
        return false;
    });

    if (filtered.length === 0) {
        table.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:#94a3b8">No ${adminState.currentFeatTab} boost requests.</td></tr>`;
        return;
    }

    table.innerHTML = filtered.map(ad => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px">
                    <img src="${Array.isArray(ad.photos) ? ad.photos[0] : ad.photos}" style="width:40px; height:40px; border-radius:8px; object-fit:cover">
                    <div>
                        <div style="font-weight:700">${ad.title.slice(0, 30)}</div>
                        <div style="font-size:11px; color:#64748b">ID: ${ad.id}</div>
                    </div>
                </div>
            </td>
            <td>
                <a href="#" onclick="viewUserProfile('${ad.user_id}'); return false;" style="color:var(--admin-accent); font-weight:700; text-decoration:none; border-bottom: 1px dashed var(--admin-accent);">
                    ${ad.seller_name || 'Seller'}
                </a>
            </td>
            <td style="font-weight:700; color:#6366f1">${Number(ad.price).toLocaleString()}</td>
            <td>
                <span class="admin-badge ${ad.featured ? 'badge-active' : 'badge-pending'}">
                    ${ad.featured ? 'Featured' : 'Pending'}
                </span>
            </td>
            <td style="display:flex; gap:8px">
                <button class="btn-action" style="background:#f1f5f9; color:#475569" onclick="viewAdDetail('${ad.id}')">View Product</button>
                ${adminState.currentFeatTab === 'pending' ? `
                    <button class="btn-action" style="background:#dcfce7; color:#166534" onclick="handleBoost('${ad.id}', true)">Approve</button>
                    <button class="btn-action" style="background:#fee2e2; color:#b91c1c" onclick="handleBoost('${ad.id}', false)">Reject</button>
                ` : `
                    <button class="btn-action" style="background:#fee2e2; color:#b91c1c" onclick="toggleFeature('${ad.id}', true)">Unfeature</button>
                `}
            </td>
        </tr>
    `).join('');
}

function viewAdminUserProfile(userId) {
    // Navigate to Users tab
    const usersTab = document.querySelector('.admin-nav-item[data-target="users"]');
    if (usersTab) usersTab.click();
    
    // Simple filter or detail view (for now, let's just highlight the user)
    setTimeout(() => {
        const rows = document.querySelectorAll('#userTable tr');
        rows.forEach(row => {
            if (row.innerHTML.includes(userId)) {
                row.style.background = '#f0f9ff';
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }, 500);
}

async function handleBoost(adId, approved) {
    const updates = {
        featured: approved,
        boost_status: approved ? 'approved' : 'rejected'
    };
    const { error } = await sb.from('ads').update(updates).eq('id', adId);
    if (error) alert("Error: " + error.message);
    else {
        logAudit('Boost Request', `${approved ? 'Approved' : 'Rejected'} boost for listing (ID: ${adId})`);
        alert(approved ? "Ad featured successfully!" : "Boost request rejected.");
        refreshData();
        closeViewModal();
    }
}

function viewAdDetail(id) {
    const ad = adminState.ads.find(a => String(a.id) === String(id));
    if (!ad) return;

    const container = document.getElementById('adPreviewContent');
    const photos = Array.isArray(ad.photos) ? ad.photos : [ad.photos];
    
    let specs = ad.specs || {};
    try { if(typeof specs === 'string') specs = JSON.parse(specs); } catch(e){}
    
    // Find seller context for additional info
    const seller = adminState.users.find(u => String(u.id) === String(ad.user_id));
    const sellerPosts = (adminState.ads || []).filter(a => String(a.user_id) === String(ad.user_id)).length;
    const isVerified = seller?.verification_status === 'verified' || seller?.is_verified;

    container.innerHTML = `
        <!-- TOP SECTION: IMAGES & PRODUCT INFO -->
        <div style="display:grid; grid-template-columns: 320px 80px 1fr; gap: 16px; margin-bottom: 24px;">
            <!-- 1. Main Photo Display -->
            <div id="mainPreviewContainer" style="width:320px; height:320px; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0; cursor:pointer; background:#f8fafc;" onclick="openImageViewer(document.getElementById('mainPreviewImg').src)">
                <img id="mainPreviewImg" src="${photos[0]}" style="width:100%; height:100%; object-fit:cover;">
            </div>

            <!-- 2. Vertical Photo Strip (Swap Logic) -->
            <div style="display:flex; flex-direction:column; gap:8px; height:320px; overflow-y:auto; padding-right:4px;">
                ${photos.map((p, idx) => `
                    <img src="${p}" 
                         style="width:72px; height:72px; border-radius:10px; object-fit:cover; cursor:pointer; border:1px solid #e2e8f0; transition: transform 0.2s;"
                         onmouseover="this.style.transform='scale(1.05)'"
                         onmouseout="this.style.transform='scale(1)'"
                         onclick="swapPreviewImage('${p}')">
                `).join('')}
            </div>

            <!-- 3. Header & Seller Info (Stacked Tabular Design) -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- Table 1: Product Summary -->
                <div style="background:#f8fafc; padding:20px; border-radius:20px; border:1px solid #f1f5f9;">
                    <div style="font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">Listing Information</div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Model</span>
                            <span style="font-size:14px; font-weight:800; color:#0f172a; text-align:right;">${ad.title}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Price (ETB)</span>
                            <span style="font-size:16px; font-weight:900; color:var(--admin-accent);">${Number(ad.price).toLocaleString()}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Category</span>
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">${ad.category}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Market Visibility</span>
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">${ad.views || 0} Views</span>
                        </div>
                    </div>
                </div>

                <!-- Table 2: Seller Summary -->
                <div style="background:#f8fafc; padding:20px; border-radius:20px; border:1px solid #f1f5f9;">
                    <div style="font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">Seller Verification</div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Seller Profile</span>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:28px; height:28px; border-radius:50%; overflow:hidden; background:#e2e8f0; border:1px solid #cbd5e1; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; color:#64748b;">
                                    ${findUserPhoto(seller) ? `<img src="${findUserPhoto(seller)}" style="width:100%; height:100%; object-fit:cover;">` : (ad.seller_name ? ad.seller_name[0] : 'S')}
                                </div>
                                <span onclick="viewUserProfile('${ad.user_id}')" style="font-size:13px; font-weight:800; color:#4338ca; text-decoration:underline; cursor:pointer;">${ad.seller_name || 'Anonymous'}</span>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Internal ID</span>
                            <span style="font-size:11px; font-weight:700; color:#94a3b8;">${String(ad.user_id).slice(0,16)}...</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Verification</span>
                            <span style="font-size:12px; font-weight:800; color:${isVerified ? '#166534' : '#ef4444'}">${isVerified ? '✓ Verified Seller' : 'Unverified Account'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:8px;">
                            <span style="font-size:12px; color:#64748b; font-weight:600;">Activity</span>
                            <span style="font-size:13px; font-weight:800; color:#1e293b;">${sellerPosts} Total Ads Posted</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- SPECS & DESCRIPTION (SIDE BY SIDE) -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top:24px;">
            <!-- Description (Now on Left) -->
            <div style="background:#f8fafc; padding:24px; border-radius:24px; border:1px solid #f1f5f9;">
                <h4 style="font-size:12px; color:#64748b; text-transform:uppercase; margin-bottom:16px; letter-spacing:1px; font-weight:800;">Full Description</h4>
                <div style="font-size:15px; color:#475569; line-height:1.7; white-space:pre-wrap;">
                    ${ad.description || 'No description provided.'}
                </div>
            </div>

            <!-- Specs (Now on Right, 2 columns internal) -->
            <div style="background:#f8fafc; padding:24px; border-radius:24px; border:1px solid #f1f5f9;">
                <h4 style="font-size:12px; color:#64748b; text-transform:uppercase; margin-bottom:20px; letter-spacing:1px; font-weight:800;">Technical Specifications</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px 40px;">
                    ${Object.entries(specs).length > 0 ? Object.entries(specs).map(([k,v]) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eef2f6; padding-bottom:6px;">
                            <span style="font-size:13px; color:#64748b; font-weight:500;">${k}</span>
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">${v}</span>
                        </div>
                    `).join('') : '<div style="color:#94a3b8; font-size:13px; grid-column:span 2;">No detailed specifications provided.</div>'}
                </div>
            </div>
        </div>

        <!-- ACTION FOOTER -->
        <div style="margin-top:32px; padding-top:24px; border-top:1px solid #f1f5f9; display:flex; justify-content:flex-end;">
            <button class="btn-action" style="background:#fee2e2; color:#b91c1c; border:none; padding:14px 28px; border-radius:12px; font-weight:800; cursor:pointer; font-size:14px; display:flex; align-items:center; gap:8px; transition:all 0.2s;" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'" onclick="if(confirm('Are you sure you want to PERMANENTLY delete this listing?')) { deleteAd('${ad.id}'); closeViewModal(); }">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                Delete Listing
            </button>
        </div>
    `;
    document.getElementById('viewAdModal').style.display = 'flex';
}

function closeViewModal() {
    document.getElementById('viewAdModal').style.display = 'none';
}

function switchTab(target) {
    const items = document.querySelectorAll('.admin-nav-item');
    items.forEach(item => {
        if (item.getAttribute('data-target') === target) item.classList.add('active');
        else item.classList.remove('active');
    });

    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById('section-' + target);
    if (section) section.classList.add('active');
    window.scrollTo(0,0);
}

function setupNavigation() {
    const items = document.querySelectorAll('.admin-nav-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (!target) return;
            switchTab(target);
        });
    });
}

// --- USER PROFILING LOGIC ---
function viewUserProfile(userId) {
    const user = adminState.users.find(u => String(u.id) === String(userId));
    if (!user) {
        alert("User not found.");
        return;
    }
    renderProfilingCard(user);
    switchTab('profiling');
}

function renderProfilingCard(user) {
    const resultDiv = document.getElementById('profilingResult');
    // Ensure IDs are compared as strings and handle missing user_id
    const userAds = (adminState.ads || []).filter(a => String(a.user_id || '') === String(user.id || ''));
    const soldAds = userAds.filter(a => a.sold);
    const totalViews = userAds.reduce((acc, a) => acc + (a.views || 0), 0);
    const photoUrl = findUserPhoto(user);
    
    const joinedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown';
    const isVerified = user.is_verified || user.verification_status === 'verified';

    resultDiv.innerHTML = `
        <div class="admin-card" style="padding: 32px;">
            <div style="display: grid; grid-template-columns: 100px 1fr auto; gap: 24px; align-items: start;">
                <!-- Avatar -->
                <div style="width: 100px; height: 100px; border-radius: 24px; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0;">
                    ${photoUrl ? `<img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${user.name || 'User'}&background=random'">` : `<span style="font-size: 40px; font-weight: 800; color: #94a3b8">${user.name ? user.name[0] : '?'}</span>`}
                </div>
                
                <!-- Basic Info -->
                <div>
                    <h2 style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${user.name || 'Anonymous User'}</h2>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="font-size: 13px; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-weight: 700;">ID: ${user.id}</span>
                        <span class="admin-badge ${isVerified ? 'badge-active' : 'badge-delete'}" style="background: ${isVerified ? '#dcfce7' : '#f1f5f9'}; color: ${isVerified ? '#166534' : '#64748b'};">
                            ${isVerified ? '✓ VERIFIED SELLER' : 'UNVERIFIED'}
                        </span>
                        <span class="admin-badge ${user.is_banned ? 'badge-delete' : 'badge-active'}">${user.is_banned ? 'BANNED' : 'ACTIVE ACCOUNT'}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 600px;">
                        <div style="background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Email Address</div>
                            <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${user.email}</div>
                        </div>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Phone Number</div>
                            <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${user.phone || 'Not provided'}</div>
                        </div>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Telegram Username</div>
                            <div style="font-size: 14px; font-weight: 600; color: #0088cc;">${user.telegram ? '@' + user.telegram.replace('@','') : 'Not linked'}</div>
                        </div>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Joined Date</div>
                            <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${joinedDate}</div>
                        </div>
                    </div>
                </div>

                <!-- Stats Summary -->
                <div style="text-align: right; display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn-action" style="background: #6366f1; color: white;" onclick="window.open('../Marketplace/index.html#seller/${user.id}', '_blank')">View Public Profile</button>
                    <button class="btn-action" style="background: ${user.is_banned ? '#dcfce7' : '#fee2e2'}; color: ${user.is_banned ? '#166534' : '#b91c1c'}" onclick="toggleBan('${user.id}', ${user.is_banned})">${user.is_banned ? 'Unban User' : 'Ban User'}</button>
                </div>
            </div>

            <div style="margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 24px;">
                <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 16px;">User Activity Insights</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                    <div onclick="viewUserAds('${user.id}')" style="cursor: pointer; background: linear-gradient(135deg, #6366f1, #a855f7); padding: 24px; border-radius: 20px; color: white; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
                        <div style="font-size: 12px; font-weight: 700; opacity: 0.8; text-transform: uppercase;">Total Ads Posted</div>
                        <div style="font-size: 32px; font-weight: 900; display: flex; align-items: center; justify-content: space-between;">
                            ${userAds.length}
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                        <div style="font-size: 11px; margin-top: 8px; font-weight: 600; opacity: 0.9;">Click to view all listings</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 24px; border-radius: 20px; color: white;">
                        <div style="font-size: 12px; font-weight: 700; opacity: 0.8; text-transform: uppercase;">Total Marketplace Views</div>
                        <div style="font-size: 32px; font-weight: 900;">${totalViews}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 32px;">
                <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 12px;">User Biography</h3>
                <div style="background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; font-style: italic; line-height: 1.6; color: #475569;">
                    "${user.bio || 'No biography provided by this user.'}"
                </div>
            </div>
        </div>
    `;
}
