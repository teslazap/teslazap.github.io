/* PROBE - Network Diagnostics Application */

const app = {
    data: {
        ipv4: null,
        ipv6: null,
        geo: {},
        security: {},
    },
    currentPage: 'scanner',

    async init() {
        console.log('PROBE initialized');
        this.navigate('scanner');
        this.render(); // Render UI immediately with "Detecting..." placeholders
        this.fetchAllData(); // Then fetch data
    },

    navigate(page) {
        this.currentPage = page;
        
        // Update active button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick').includes(`'${page}'`)) {
                btn.classList.add('active');
            }
        });
        
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    render() {
        const content = document.getElementById('app-content');
        
        switch (this.currentPage) {
            case 'scanner':
                content.innerHTML = this.renderScanner();
                break;
            case 'whois':
                content.innerHTML = this.renderWhois();
                break;
            case 'about':
                content.innerHTML = this.renderAbout();
                break;
        }
    },

    renderScanner() {
        const ipv6Status = this.data.ipv6 ? `IPv6: ${this.data.ipv6}` : 'IPv6: Not available';
        
        return `
            <section class="hero-section">
                <p class="hero-label">Your IP Address</p>
                <p class="hero-ip">${this.data.ipv4 || 'Detecting...'}</p>
                <p class="hero-sub">${ipv6Status}</p>
                <div class="hero-action">
                    <button class="btn btn-primary" onclick="app.fetchAllData()">
                        <span>🔄</span> Scan Again
                    </button>
                    <button class="btn btn-secondary" onclick="app.copyToClipboard()">
                        <span>📋</span> Copy IP
                    </button>
                </div>
            </section>

            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2">Geolocation</h2>
                <p class="text-slate-400 mb-8">Estimated location based on your IP network block.</p>
                <div class="grid-responsive">
                    ${this.createCard('🌍', 'Country', this.data.geo.country || 'Detecting...')}
                    ${this.createCard('🏙️', 'City', this.data.geo.city || 'Detecting...')}
                    ${this.createCard('⏰', 'Timezone', this.data.geo.timezone || 'Detecting...')}
                    ${this.createCard('📍', 'Coordinates', (this.data.geo.latitude && this.data.geo.longitude) ? `${this.data.geo.latitude.toFixed(4)}, ${this.data.geo.longitude.toFixed(4)}` : 'Detecting...')}
                </div>
            </section>

            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2">Network & Provider</h2>
                <p class="text-slate-400 mb-8">Information about your ISP and network.</p>
                <div class="grid-responsive">
                    ${this.createCard('🏢', 'Provider/ISP', this.data.geo.isp || 'Detecting...')}
                    ${this.createCard('🔢', 'ASN', this.data.geo.asn || 'Detecting...')}
                    ${this.createCard('🌐', 'Hostname', this.data.geo.hostname || 'Detecting...')}
                    ${this.createCard('📊', 'Connection Type', this.data.geo.connection_type || 'Detecting...')}
                </div>
            </section>

            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2">Security Indicators</h2>
                <p class="text-slate-400 mb-8">Heuristic detection - not a guarantee of security.</p>
                <div class="grid-responsive">
                    ${this.createSecurityCard('🔐', 'Proxy', this.data.security.proxy)}
                    ${this.createSecurityCard('🛡️', 'VPN', this.data.security.vpn)}
                    ${this.createSecurityCard('🧅', 'Tor', this.data.security.tor)}
                    ${this.createSecurityCard('☁️', 'Datacenter', this.data.security.hosting)}
                </div>
            </section>

            <section class="max-w-7xl mx-auto px-6 py-12 pb-12">
                <div class="card bg-gradient-to-r from-orange-600/10 to-red-600/10 border-orange-500/30">
                    <p class="text-sm text-slate-300">
                        <strong>🔒 Privacy:</strong> No data sent to private servers. 
                        This page queries public services: 
                        <a href="https://www.ipify.org/" target="_blank">ipify</a>,
                        <a href="https://ipwho.is/" target="_blank">ipwho.is</a>, and
                        <a href="https://rdap.org/" target="_blank">RDAP</a>.
                        Nothing is saved - static pages, no backend.
                    </p>
                </div>
            </section>
        `;
    },

    renderWhois() {
        return `
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-4xl font-bold mb-4" style="background: linear-gradient(135deg, #ff6b35 0%, #d73502 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">RDAP Lookup</h2>
                <p class="text-slate-400 mb-8">Search RDAP database (modern successor to WHOIS)</p>

                <div class="card mb-8">
                    <input type="text" 
                        id="whois-input" 
                        placeholder="Enter IP address or domain..." 
                        class="w-full bg-slate-900/50 border border-orange-500/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20"
                        onkeypress="if(event.key==='Enter') app.lookupWhois()">
                    <button class="btn btn-primary mt-4 w-full" onclick="app.lookupWhois()">
                        <span>🔍</span> Search RDAP
                    </button>
                </div>

                <div id="whois-result" class="hidden">
                    <div class="card">
                        <h3>Search Result</h3>
                        <pre id="whois-content" class="text-xs text-slate-300 bg-slate-900/50 p-4 rounded-lg overflow-auto max-h-96 mt-4"></pre>
                    </div>
                </div>
            </section>
        `;
    },

    renderAbout() {
        return `
            <section class="max-w-4xl mx-auto px-6 py-12">
                <h2 class="text-4xl font-bold mb-8" style="background: linear-gradient(135deg, #ff6b35 0%, #d73502 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">About PROBE</h2>

                <div class="space-y-6">
                    <div class="card">
                        <h3>✨ What is PROBE?</h3>
                        <p class="text-slate-300 mt-2">
                            PROBE is a modern network diagnostics tool that shows how you appear on the internet.
                            Works entirely in your browser - no private servers, no tracking, completely free.
                        </p>
                    </div>

                    <div class="card">
                        <h3>🔒 Why is it secure?</h3>
                        <ul class="text-slate-300 space-y-2 mt-2">
                            <li>✓ Static pages on GitHub Pages</li>
                            <li>✓ No private backend</li>
                            <li>✓ No data stored</li>
                            <li>✓ Open source, transparent</li>
                            <li>✓ Only public, reliable APIs</li>
                        </ul>
                    </div>

                    <div class="card">
                        <h3>🌐 Services Used</h3>
                        <ul class="text-slate-300 space-y-2 mt-2">
                            <li><a href="https://www.ipify.org/" target="_blank">ipify</a> - Public IP detection</li>
                            <li><a href="https://ipwho.is/" target="_blank">ipwho.is</a> - Geolocation &amp; network data</li>
                            <li><a href="https://rdap.org/" target="_blank">RDAP</a> - Domain/IP lookup</li>
                        </ul>
                    </div>

                    <div class="card">
                        <h3>📚 Glossary</h3>
                        <dl class="space-y-3 text-slate-300 text-sm mt-2">
                            <dt class="font-semibold text-orange-400">IPv4 / IPv6</dt>
                            <dd class="ml-4 text-slate-400">Internet protocol versions. IPv6 is the future.</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">ASN</dt>
                            <dd class="ml-4 text-slate-400">Autonomous System Number - identifies ISP.</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">Hostname</dt>
                            <dd class="ml-4 text-slate-400">Domain name for your IP (reverse DNS).</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">RDAP</dt>
                            <dd class="ml-4 text-slate-400">Modern replacement for WHOIS protocol.</dd>
                        </dl>
                    </div>
                </div>
            </section>
        `;
    },

    createCard(icon, label, value) {
        const isLoading = value === 'Detecting...';
        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl flex-shrink-0">${icon}</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-slate-400 text-sm">${label}</p>
                        <p class="text-lg font-semibold ${isLoading ? 'text-slate-500 italic shimmer' : 'text-orange-300'} break-words">${value}</p>
                    </div>
                </div>
            </div>
        `;
    },

    createSecurityCard(icon, label, value) {
        let statusClass = 'unknown';
        let statusText = 'Detecting...';
        
        if (value !== undefined && value !== null) {
            statusClass = value ? 'true' : 'false';
            statusText = value ? 'DETECTED ⚠️' : 'NOT DETECTED ✓';
        }

        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl flex-shrink-0">${icon}</span>
                    <div class="flex-1">
                        <p class="text-slate-400 text-sm">${label}</p>
                        <div class="badge ${statusClass} mt-2">
                            <span class="led"></span>
                            <span class="text-xs">${statusText}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async fetchAllData() {
        this.showLoading(true);
        try {
            // Get IPv4
            const ipv4Response = await fetch('https://api.ipify.org?format=json');
            if (!ipv4Response.ok) throw new Error('Failed to fetch IPv4');
            this.data.ipv4 = (await ipv4Response.json()).ip;
            console.log('IPv4:', this.data.ipv4);

            // Get IPv6 (non-blocking)
            fetch('https://api6.ipify.org?format=json')
                .then(r => r.json())
                .then(data => { 
                    this.data.ipv6 = data.ip;
                    console.log('IPv6:', data.ip);
                    this.render();
                })
                .catch(e => { 
                    console.log('IPv6 unavailable:', e);
                    this.data.ipv6 = null;
                });

            // Get geolocation data
            const geoResponse = await fetch(`https://ipwho.is/${this.data.ipv4}`);
            if (!geoResponse.ok) throw new Error('Failed to fetch geo data');
            const geoData = await geoResponse.json();
            console.log('Geo response:', geoData);
            
            this.data.geo = {
                country: geoData.country || 'N/A',
                city: geoData.city || 'N/A',
                timezone: geoData.timezone_name || geoData.timezone || 'N/A',
                latitude: geoData.latitude,
                longitude: geoData.longitude,
                isp: geoData.connection?.isp || 'N/A',
                asn: geoData.connection?.asn || 'N/A',
                hostname: geoData.connection?.hostname || 'N/A',
                connection_type: geoData.connection?.connection_type || 'N/A',
            };

            // Get security indicators
            this.data.security = {
                proxy: geoData.is_proxy || false,
                vpn: geoData.is_vpn || false,
                tor: geoData.is_tor || false,
                hosting: geoData.is_datacenter || false,
            };

            this.render();
        } catch (error) {
            console.error('Fetch error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async lookupWhois() {
        const input = document.getElementById('whois-input')?.value?.trim();
        if (!input) {
            alert('Please enter an IP or domain');
            return;
        }

        this.showLoading(true);
        try {
            // Detect if it's a domain or IP
            const isDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input);
            const endpoint = isDomain ? `domain/${input}` : `ip/${input}`;
            
            const response = await fetch(`https://rdap.org/${endpoint}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Invalid IP or domain`);
            }
            
            // Check content type - RDAP sometimes returns XML
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else if (contentType?.includes('application/xml') || contentType?.includes('text/plain')) {
                // If XML, parse and format for readability
                data = await response.text();
                data = { raw: data };
            } else {
                data = await response.json();
            }
            
            document.getElementById('whois-result').classList.remove('hidden');
            document.getElementById('whois-content').innerHTML = this.formatRdapData(data);
        } catch (error) {
            console.error('RDAP error:', error);
            alert('RDAP search error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    formatRdapData(data) {
        if (data.raw) {
            return `<div class="space-y-4">${this.escapeHtml(data.raw).split('\n').map(line => 
                `<p class="text-sm text-slate-300 font-mono">${line}</p>`
            ).join('')}</div>`;
        }
        
        // Format JSON data into human-readable cards
        let html = '<div class="space-y-4">';
        
        // Handle domain data
        if (data.handle || data.ldhName) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">📋 Domain/Registry Handle</h4>
                <p class="text-slate-300"><strong>Handle:</strong> ${this.escapeHtml(data.handle || data.ldhName)}</p></div>`;
        }
        
        // Handle IP network data
        if (data.startAddress || data.endAddress) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">🌐 IP Network Range</h4>
                <p class="text-slate-300"><strong>Start:</strong> ${this.escapeHtml(data.startAddress || 'N/A')}</p>
                <p class="text-slate-300"><strong>End:</strong> ${this.escapeHtml(data.endAddress || 'N/A')}</p>
                ${data.cidrPrefix ? `<p class="text-slate-300"><strong>CIDR:</strong> /${data.cidrPrefix}</p>` : ''}</div>`;
        }
        
        // Entities (registrar, registrant, etc.)
        if (data.entities && Array.isArray(data.entities)) {
            data.entities.forEach((entity, idx) => {
                if (entity.vcardArray && entity.vcardArray[1]) {
                    const vcard = entity.vcardArray[1];
                    let name = 'Unknown', org = '', email = '';
                    
                    vcard.forEach(prop => {
                        if (prop[0] === 'fn') name = prop[3];
                        if (prop[0] === 'org') org = prop[3];
                        if (prop[0] === 'email') email = prop[3];
                    });
                    
                    if (name && name !== 'Unknown') {
                        html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">👤 ${entity.roles?.join(', ') || 'Entity ' + (idx+1)}</h4>
                            <p class="text-slate-300"><strong>Name:</strong> ${this.escapeHtml(name)}</p>
                            ${org ? `<p class="text-slate-300"><strong>Organization:</strong> ${this.escapeHtml(org)}</p>` : ''}
                            ${email ? `<p class="text-slate-300"><strong>Email:</strong> ${this.escapeHtml(email)}</p>` : ''}
                        </div>`;
                    }
                }
            });
        }
        
        // Registrar/Events
        if (data.registrar) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">🏢 Registrar</h4>
                <p class="text-slate-300">${this.escapeHtml(JSON.stringify(data.registrar, null, 2))}</p></div>`;
        }
        
        // Events (creation, update, expiration)
        if (data.events && Array.isArray(data.events)) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">📅 Important Dates</h4>`;
            data.events.forEach(event => {
                if (event.eventAction && event.eventDate) {
                    const action = event.eventAction.toUpperCase();
                    const date = new Date(event.eventDate).toLocaleDateString();
                    html += `<p class="text-slate-300"><strong>${action}:</strong> ${date}</p>`;
                }
            });
            html += `</div>`;
        }
        
        // Status
        if (data.status && Array.isArray(data.status)) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">⚙️ Status</h4>
                <p class="text-slate-300">${this.escapeHtml(data.status.join(', '))}</p></div>`;
        }
        
        // Notices
        if (data.notices && Array.isArray(data.notices)) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">ℹ️ Notices</h4>`;
            data.notices.forEach(notice => {
                if (notice.title) {
                    html += `<p class="text-slate-300 text-sm"><strong>${this.escapeHtml(notice.title)}</strong></p>`;
                }
            });
            html += `</div>`;
        }
        
        // Raw JSON if nothing matched
        if (!html.includes('card')) {
            html += `<div class="card"><h4 class="font-semibold text-orange-400 mb-2">📊 Raw Data</h4>
                <pre class="text-xs text-slate-300 bg-slate-900/50 p-4 rounded-lg overflow-auto max-h-96">${this.escapeHtml(JSON.stringify(data, null, 2))}</pre></div>`;
        }
        
        html += '</div>';
        return html;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
        navigator.clipboard.writeText(this.data.ipv4 || '').then(() => {
            alert('IP copied: ' + this.data.ipv4);
        });
    },

    showLoading(show) {
        document.getElementById('loading-overlay').classList[show ? 'remove' : 'add']('hidden');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => app.init());
