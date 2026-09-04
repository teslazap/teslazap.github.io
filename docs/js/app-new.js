/* ============================================
   SONDA - Modern SPA Application
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
        console.log('🚀 SONDA initialized');
        this.navigate('scanner');
        this.fetchAllData();
    },

    navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        event?.target?.classList.add('active');
        this.render();
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

        // Reinitialize interactivity after render
        this.attachEventListeners();
    },

    renderScanner() {
        const ipv6Status = this.data.ipv6 ? `IPv6: ${this.data.ipv6}` : 'IPv6: non disponibile';
        
        return `
            <!-- Hero Section -->
            <section class="hero-section">
                <p class="hero-label">Il tuo indirizzo IP</p>
                <p class="hero-ip" id="hero-ip-display">${this.data.ipv4 || 'rilevamento…'}</p>
                <p class="hero-sub">${ipv6Status}</p>
                <div class="hero-action">
                    <button class="btn btn-primary" onclick="app.fetchAllData()">
                        <span>🔄</span> Scansiona di nuovo
                    </button>
                    <button class="btn btn-secondary" onclick="app.copyToClipboard()">
                        <span>📋</span> Copia IP
                    </button>
                </div>
            </section>

            <!-- Geolocation Cards -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2 text-white">Geolocalizzazione stimata</h2>
                <p class="text-slate-400 mb-8">Dati derivati dal blocco di rete. La precisione varia da paese a città.</p>
                
                <div class="grid-responsive">
                    ${this.createGeoCard('🌍', 'Paese', this.data.geo.country || 'in rilevamento')}
                    ${this.createGeoCard('🏙️', 'Città', this.data.geo.city || 'in rilevamento')}
                    ${this.createGeoCard('⏰', 'Fuso orario', this.data.geo.timezone || 'in rilevamento')}
                    ${this.createGeoCard('📍', 'Coordinate', (this.data.geo.latitude && this.data.geo.longitude) ? `${this.data.geo.latitude.toFixed(4)}, ${this.data.geo.longitude.toFixed(4)}` : 'in rilevamento')}
                </div>
            </section>

            <!-- Network Cards -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2 text-white">Rete e provider</h2>
                <p class="text-slate-400 mb-8">Informazioni sul blocco IP e l'hostname associato.</p>
                
                <div class="grid-responsive">
                    ${this.createNetCard('🏢', 'Provider', this.data.geo.isp || 'in rilevamento')}
                    ${this.createNetCard('🔢', 'ASN', this.data.geo.asn || 'in rilevamento')}
                    ${this.createNetCard('🌐', 'Hostname', this.data.geo.hostname || 'in rilevamento')}
                    ${this.createNetCard('📊', 'Tipo di connessione', this.data.geo.connection_type || 'in rilevamento')}
                </div>
            </section>

            <!-- Security Section -->
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-3xl font-bold mb-2 text-white">Anonimizzazione rilevata</h2>
                <p class="text-slate-400 mb-8">Indicatori euristici, non una prova scientifica di sicurezza.</p>
                
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
                        <strong>🔒 Privacy:</strong> Nessun dato viene inviato a un server proprio. 
                        Questa pagina interroga direttamente dal tuo browser i servizi pubblici 
                        <a href="https://www.ipify.org/" target="_blank" class="text-orange-400 hover:text-orange-300">ipify</a>,
                        <a href="https://ipwho.is/" target="_blank" class="text-orange-400 hover:text-orange-300">ipwho.is</a> e
                        <a href="https://rdap.org/" target="_blank" class="text-orange-400 hover:text-orange-300">RDAP</a>.
                        Nulla viene salvato: pagine statiche, nessun backend.
                    </p>
                </div>
            </section>
        `;
    },

    renderWhois() {
        return `
            <section class="max-w-7xl mx-auto px-6 py-12">
                <h2 class="text-4xl font-bold mb-4 text-gradient">RDAP Lookup</h2>
                <p class="text-slate-400 mb-8">Esegui una ricerca RDAP (il moderno successore di WHOIS)</p>

                <div class="card mb-8">
                    <input type="text" 
                        id="whois-input" 
                        placeholder="Inserisci un IP o dominio..." 
                        class="w-full bg-slate-900/50 border border-orange-500/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20"
                        onkeypress="if(event.key==='Enter') app.lookupWhois()">
                    <button class="btn btn-primary mt-4 w-full" onclick="app.lookupWhois()">
                        <span>🔍</span> Cerca RDAP
                    </button>
                </div>

                <div id="whois-result" class="hidden">
                    <div class="card">
                        <h3 class="card-title">Risultato ricerca</h3>
                        <pre id="whois-content" class="text-xs text-slate-300 bg-slate-900/50 p-4 rounded-lg overflow-auto max-h-96"></pre>
                    </div>
                </div>
            </section>
        `;
    },

    renderAbout() {
        return `
            <section class="max-w-4xl mx-auto px-6 py-12">
                <h2 class="text-4xl font-bold mb-8 text-gradient">About SONDA</h2>

                <div class="space-y-6">
                    <div class="card">
                        <h3 class="card-title">✨ Cos'è SONDA?</h3>
                        <p class="text-slate-300">
                            SONDA è uno strumento di diagnostica di rete moderno e veloce che ti aiuta a 
                            scoprire come appari in internet. Funziona completamente nel tuo browser, senza 
                            server proprietario e senza tracciamento.
                        </p>
                    </div>

                    <div class="card">
                        <h3 class="card-title">🔒 Perché è sicuro?</h3>
                        <ul class="text-slate-300 space-y-2">
                            <li>✓ Pagine statiche, ospitabile su GitHub Pages</li>
                            <li>✓ Nessun backend proprietario</li>
                            <li>✓ I dati non vengono salvati da questo sito</li>
                            <li>✓ Codice sorgente disponibile e trasparente</li>
                            <li>✓ Solo API pubbliche e affidabili</li>
                        </ul>
                    </div>

                    <div class="card">
                        <h3 class="card-title">🌐 Servizi utilizzati</h3>
                        <ul class="text-slate-300 space-y-2">
                            <li><a href="https://www.ipify.org/" target="_blank" class="text-orange-400 hover:text-orange-300">ipify.org</a> - Rilevamento IP pubblico</li>
                            <li><a href="https://ipwho.is/" target="_blank" class="text-orange-400 hover:text-orange-300">ipwho.is</a> - Geolocalizzazione e info di rete</li>
                            <li><a href="https://rdap.org/" target="_blank" class="text-orange-400 hover:text-orange-300">rdap.org</a> - Lookup RDAP/WHOIS</li>
                        </ul>
                    </div>

                    <div class="card">
                        <h3 class="card-title">📚 Cosa significa?</h3>
                        <dl class="space-y-3 text-slate-300 text-sm">
                            <dt class="font-semibold text-orange-400">IPv4 / IPv6</dt>
                            <dd class="ml-4 text-slate-400">I due versioni del protocollo Internet. IPv6 è il futuro.</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">ASN</dt>
                            <dd class="ml-4 text-slate-400">Autonomous System Number - identifica il provider di rete.</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">Hostname</dt>
                            <dd class="ml-4 text-slate-400">Il nome di dominio associato al tuo IP (reverse DNS).</dd>
                            
                            <dt class="font-semibold text-orange-400 mt-3">RDAP</dt>
                            <dd class="ml-4 text-slate-400">Registration Data Access Protocol - il successore moderno di WHOIS.</dd>
                        </dl>
                    </div>

                    <div class="card bg-gradient-to-r from-orange-600/10 to-red-600/10 border-orange-500/30">
                        <p class="text-sm text-slate-300">
                            <strong>⚠️ Limitazioni:</strong> Questo strumento fornisce informazioni pubbliche. 
                            La precisione della geolocalizzazione varia da paese a città. 
                            Alcuni indicatori (proxy, VPN) sono euristici e non garantiti.
                        </p>
                    </div>
                </div>
            </section>
        `;
    },

    createGeoCard(icon, label, value) {
        const isLoading = value === 'in rilevamento';
        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl">${icon}</span>
                    <div class="flex-1">
                        <p class="text-slate-400 text-sm">${label}</p>
                        <p class="text-lg font-semibold ${isLoading ? 'text-slate-500 italic shimmer' : 'text-orange-300'}">${value}</p>
                    </div>
                </div>
            </div>
        `;
    },

    createNetCard(icon, label, value) {
        const isLoading = value === 'in rilevamento';
        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl">${icon}</span>
                    <div class="flex-1">
                        <p class="text-slate-400 text-sm">${label}</p>
                        <p class="text-sm font-mono ${isLoading ? 'text-slate-500 italic shimmer' : 'text-orange-300'} break-all">${value}</p>
                    </div>
                </div>
            </div>
        `;
    },

    createSecurityCard(icon, label, value) {
        let statusClass = 'unknown';
        let statusText = 'in rilevamento';
        
        if (value !== undefined && value !== null) {
            statusClass = value ? 'true' : 'false';
            statusText = value ? 'RILEVATO ⚠️' : 'NON RILEVATO ✓';
        }

        return `
            <div class="card">
                <div class="flex items-start gap-3">
                    <span class="text-2xl">${icon}</span>
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

            // Fetch IPv6
            fetch('https://api6.ipify.org?format=json')
                .then(r => r.json())
                .then(data => { this.data.ipv6 = data.ip; })
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
            alert('Errore nel rilevamento dei dati. Controlla la connessione.');
        } finally {
            this.showLoading(false);
        }
    },

    async lookupWhois() {
        const input = document.getElementById('whois-input')?.value?.trim();
        if (!input) {
            alert('Inserisci un IP o dominio');
            return;
        }

        this.showLoading(true);
        try {
            const response = await fetch(`https://rdap.org/ip/${input}`);
            const data = await response.json();
            
            document.getElementById('whois-result').classList.remove('hidden');
            document.getElementById('whois-content').textContent = JSON.stringify(data, null, 2);
        } catch (error) {
            alert('Errore nella ricerca RDAP. Verifica l\'IP o dominio.');
        } finally {
            this.showLoading(false);
        }
    },

    copyToClipboard() {
        navigator.clipboard.writeText(this.data.ipv4 || '').then(() => {
            alert('IP copiato negli appunti: ' + this.data.ipv4);
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
