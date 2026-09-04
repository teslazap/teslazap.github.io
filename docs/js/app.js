/* ============================================
   PROBE - Modern SPA Application
   Network Diagnostics Tool
   ============================================ */

const app = {
    data: {
        ipv4: null,
        ipv6: null,
        geo: {},
        security: {},
        whoisData: null,
    },
    currentPage: 'scanner',

    async init() {
        console.log('🚀 PROBE initialized');
        this.navigate('scanner');
        this.fetchAllData();
    },

    navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        event?.target?.classList.add('active');
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

        this.attachEventListeners();
    },

    renderScanner() {
        const ipv6Status = this.data.ipv6 ? `IPv6: ${this.data.ipv6}` : 'IPv6: Not available';
        
        return `
            <!-- Hero Section -->
            <section class="hero-section">
                <p class="hero-label">Your IP Address</p>
                <p class="hero-ip" id="hero-ip-display">${this.data.ipv4 || 'detecting…'}</p>
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

            <!-- Geolocation Section -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2 text-white">Estimated Geolocation</h2>
                <p class="text-slate-400 mb-8">Data derived from the IP network block. Accuracy varies from country to city level.</p>
                
                <div class="grid-responsive">
                    ${this.createGeoCard('🌍', 'Country', this.data.geo.country || 'detecting…')}
                    ${this.createGeoCard('🏙️', 'City', this.data.geo.city || 'detecting…')}
                    ${this.createGeoCard('⏰', 'Timezone', this.data.geo.timezone || 'detecting…')}
                    ${this.createGeoCard('📍', 'Coordinates', (this.data.geo.latitude && this.data.geo.longitude) ? `${this.data.geo.latitude.toFixed(4)}, ${this.data.geo.longitude.toFixed(4)}` : 'detecting…')}
                </div>
            </section>

            <!-- Network Section -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2 text-white">Network & Provider</h2>
                <p class="text-slate-400 mb-8">Information about your IP network block and associated hostname.</p>
                
                <div class="grid-responsive">
                    ${this.createNetCard('🏢', 'Provider', this.data.geo.isp || 'detecting…')}
                    ${this.createNetCard('🔢', 'ASN', this.data.geo.asn || 'detecting…')}
                    ${this.createNetCard('🌐', 'Hostname', this.data.geo.hostname || 'detecting…')}
                    ${this.createNetCard('📊', 'Connection Type', this.data.geo.connection_type || 'detecting…')}
                </div>
            </section>

            <!-- Security Section -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2 text-white">Anonymization Detection</h2>
                <p class="text-slate-400 mb-8">Heuristic indicators, not a scientific proof of security.</p>
                
                <div class="grid-responsive">
                    ${this.createSecurityCard('🔐', 'Proxy', this.data.security.proxy)}
                    ${this.createSecurityCard('🛡️', 'VPN', this.data.security.vpn)}
                    ${this.createSecurityCard('🧅', 'Tor', this.data.security.tor)}
                    ${this.createSecurityCard('☁️', 'Datacenter', this.data.security.hosting)}
                </div>
            </section>

            <!-- Privacy Info -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <div class="card bg-gradient-to-r from-orange-600/10 to-red-600/10 border-orange-500/30">
                    <p class="text-sm text-slate-300">
                        <strong>🔒 Privacy:</strong> No data is sent to a private server. 
                        This page queries directly from your browser the public services 
                        <a href="https://www.ipify.org/" target="_blank" class="text-orange-400 hover:text-orange-300">ipify</a>,
                        <a href="https://ipwho.is/" target="_blank" class="text-orange-400 hover:text-orange-300">ipwho.is</a> and
                        <a href="https://rdap.org/" target="_blank" class="text-orange-400 hover:text-orange-300">RDAP</a>.
                        Nothing is saved: static pages, no backend.
                    </p>
                </div>
            </section>
        `;
    },

    renderWhois() {
        return `
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-4xl font-bold mb-4 text-gradient">RDAP Lookup</h2>
                <p class="text-slate-400 mb-8">Perform an RDAP search (the modern successor to WHOIS)</p>

                <div class="card mb-8">
                    <input type="text" 
                        id="whois-input" 
                        placeholder="Enter an IP address or domain..." 
                        class="w-full bg-slate-900/50 border border-orange-500/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20"
                        onkeypress="if(event.key==='Enter') app.lookupWhois()">
                    <button class="btn btn-primary mt-4 w-full" onclick="app.lookupWhois()">
                        <span>🔍</span> Search RDAP
                    </button>
                </div>

                <div id="whois-result" class="hidden">
                    <div class="card">
                        <h3 class="card-title">Search Result</h3>
                        <pre id="whois-content" class="text-xs text-slate-300 bg-slate-900/50 p-4 rounded-lg overflow-auto max-h-96"></pre>
                    </div>
                </div>
            </section>
        `;
    },

    renderAbout() {
        return `
            <section class="max-w-4xl mx-auto px-6 py-12">
                <h2 class="text-4xl font-bold mb-8 text-gradient">About PROBE</h2>

                <div class="space-y-6">
                    <div class="card">
                        <h3 class="card-title">✨ What is PROBE?</h3>
                        <p class="text-slate-300">
                            PROBE is a modern and fast network diagnostics tool that helps you 
                            discover how you appear on the internet. It works completely in your browser, 
                            without a private server and without tracking.
                        </p>
                    </div>

                    <div class="card">
                        <h3 class="card-title">🔒 Why is it secure?</h3>
                        <ul class="text-slate-300 space-y-2">
                            <li>✓ Static pages, hostable on GitHub Pages</li>
                            <li>✓ No private backend</li>
                            <li>✓ No data is saved by this site</li>
                            <li>✓ Source code is available and transparent</li>
                            <li>✓ Only public and reliable APIs</li>
                        </ul>
                    </div>

                    <div class="card">
                        <h3 class="card-title">🌐 Services Used</h3>
                        <ul class="text-slate-300 space-y-2">
                            <li><a href="https://www.ipify.org/" target="_blank" class="text-orange-400 hover:text-orange-300">ipify.org</a> - Public IP detection</li>
                            <li><a href="https://ipwho.is/" target="_blank" class="text-orange-400 hover:text-orange-300">ipwho.is</a> - Geolocation and network info</li>
                            <li><a href="https://rdap.org/" target="_blank" class="text-orange-400 hover:text-orange-300">rdap.org</a> - RDAP/WHOIS lookup</li>
                        </ul>
                    </div>

                    <div class="card">
                        <h3 class="card-title">📚 Glossary</h3>
                        <dl class="space-y-3 text-slate-300 text-sm">
                            <dt class="font-semibold text-orange-400">IPv4 / IPv6</dt>
                            <dd class="ml-4 text-slate-400">The two versions of the Internet protocol. IPv6 is the future.</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">ASN</dt>
                            <dd class="ml-4 text-slate-400">Autonomous System Number - identifies the network provider.</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">Hostname</dt>
                            <dd class="ml-4 text-slate-400">The domain name associated with your IP (reverse DNS).</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">RDAP</dt>
                            <dd class="ml-4 text-slate-400">Registration Data Access Protocol - the modern successor to WHOIS.</dd>
                        </dl>
                    </div>

                    <div class="card bg-gradient-to-r from-orange-600/10 to-red-600/10 border-orange-500/30">
                        <p class="text-sm text-slate-300">
                            <strong>⚠️ Limitations:</strong> This tool provides public information. 
                            Geolocation accuracy varies from country to city level. 
                            Some indicators (proxy, VPN) are heuristic and not guaranteed.
                        </p>
                    </div>
                </div>
            </section>
        `;
    },

    createGeoCard(icon, label, value) {
        const isLoading = value === 'detecting…';
        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl flex-shrink-0">${icon}</span>
                    <div class="flex-1 w-full min-w-0">
                        <p class="text-slate-400 text-sm">${label}</p>
                        <p class="text-lg font-semibold ${isLoading ? 'text-slate-500 italic shimmer' : 'text-orange-300'} break-words">${value}</p>
                    </div>
                </div>
            </div>
        `;
    },

    createNetCard(icon, label, value) {
        const isLoading = value === 'detecting…';
        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl flex-shrink-0">${icon}</span>
                    <div class="flex-1 w-full min-w-0">
                        <p class="text-slate-400 text-sm">${label}</p>
                        <p class="text-sm font-mono ${isLoading ? 'text-slate-500 italic shimmer' : 'text-orange-300'} break-words">${value}</p>
                    </div>
                </div>
            </div>
        `;
    },

    createSecurityCard(icon, label, value) {
        let statusClass = 'unknown';
        let statusText = 'detecting…';
        
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
            // Fetch IPv4
            const ipv4Response = await fetch('https://api.ipify.org?format=json').then(r => r.json());
            this.data.ipv4 = ipv4Response.ip;

            // Fetch IPv6 (non-blocking)
            fetch('https://api6.ipify.org?format=json')
                .then(r => r.json())
                .then(data => { this.data.ipv6 = data.ip; this.render(); })
                .catch(() => { this.data.ipv6 = null; });

            // Fetch detailed geo data
            const geoResponse = await fetch(`https://ipwho.is/${this.data.ipv4}`).then(r => r.json());
            
            this.data.geo = {
                country: geoResponse.country || 'N/A',
                city: geoResponse.city || 'N/A',
                timezone: geoResponse.timezone || 'N/A',
                latitude: geoResponse.latitude,
                longitude: geoResponse.longitude,
                isp: geoResponse.connection?.isp || 'N/A',
                asn: geoResponse.connection?.asn || 'N/A',
                hostname: geoResponse.connection?.hostname || 'N/A',
                connection_type: geoResponse.connection?.connection_type || 'N/A',
            };

            // Fetch security info
            this.data.security = {
                proxy: geoResponse.is_proxy || false,
                vpn: geoResponse.is_vpn || false,
                tor: geoResponse.is_tor || false,
                hosting: geoResponse.is_datacenter || false,
            };

            this.render();
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Error detecting data. Please check your connection.');
        } finally {
            this.showLoading(false);
        }
    },

    async lookupWhois() {
        const input = document.getElementById('whois-input')?.value?.trim();
        if (!input) {
            alert('Please enter an IP address or domain');
            return;
        }

        this.showLoading(true);
        try {
            const response = await fetch(`https://rdap.org/ip/${input}`);
            const data = await response.json();
            
            document.getElementById('whois-result').classList.remove('hidden');
            document.getElementById('whois-content').textContent = JSON.stringify(data, null, 2);
        } catch (error) {
            alert('Error in RDAP search. Please verify the IP or domain.');
        } finally {
            this.showLoading(false);
        }
    },

    copyToClipboard() {
        navigator.clipboard.writeText(this.data.ipv4 || '').then(() => {
            alert('IP copied to clipboard: ' + this.data.ipv4);
        });
    },

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },

    attachEventListeners() {
        // Attach any dynamic event listeners if needed
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
