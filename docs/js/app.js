// Scanner - Auto-detect IP on page load
const scanner = {
    async refresh() {
        try {
            // Get IPv4
            const ipv4Res = await fetch('https://api.ipify.org?format=json');
            const { ip: ipv4 } = await ipv4Res.json();
            document.getElementById('ipv4').textContent = ipv4;

            // Get IPv6 (non-blocking)
            fetch('https://api6.ipify.org?format=json')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('ipv6').textContent = `IPv6: ${data.ip}`;
                })
                .catch(() => {
                    document.getElementById('ipv6').textContent = 'IPv6: Not available';
                });

            // Get geo data
            const geoRes = await fetch(`https://ipwho.is/${ipv4}`);
            const geo = await geoRes.json();

            console.log('Full geo data:', geo); // DEBUG

            document.getElementById('country').textContent = geo.country || 'N/A';
            document.getElementById('city').textContent = geo.city || 'N/A';
            
            // Timezone - extract just the ID
            let tz = 'N/A';
            if (geo.timezone?.id) {
                tz = geo.timezone.id;
            } else if (typeof geo.timezone === 'string') {
                tz = geo.timezone;
            }
            document.getElementById('timezone').textContent = tz;
            
            document.getElementById('coords').textContent = geo.latitude && geo.longitude 
                ? `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`
                : 'N/A';
            document.getElementById('isp').textContent = geo.connection?.isp || 'N/A';
            document.getElementById('asn').textContent = geo.connection?.asn || 'N/A';
            
            // Hostname - try reverse DNS lookup for both IPv4 and IPv6
            this.getHostname(ipv4, 'hostname');
            
            // Get IPv6 hostname when available
            fetch('https://api6.ipify.org?format=json')
                .then(r => r.json())
                .then(data => {
                    if (data.ip) {
                        this.getHostname(data.ip, 'hostname-ipv6');
                    }
                })
                .catch(() => {
                    document.getElementById('hostname-ipv6').textContent = 'N/A';
                });

            // Security badges
            const badges = [
                { label: 'Proxy', status: geo.is_proxy },
                { label: 'VPN', status: geo.is_vpn },
                { label: 'Tor', status: geo.is_tor },
                { label: 'Datacenter', status: geo.is_datacenter }
            ];

            const badgesHtml = badges.map(b => {
                const text = b.status ? `⚠️ ${b.label} Detected` : `✓ ${b.label} Not Detected`;
                const className = b.status ? 'warning' : 'safe';
                return `<span class="badge ${className}">${text}</span>`;
            }).join('');

            document.getElementById('security-badges').innerHTML = badgesHtml;

        } catch (error) {
            console.error('Error:', error);
            alert('Error detecting network info: ' + error.message);
        }
    },

    async getHostname(ip, elementId) {
        try {
            // Try api.hackertarget.com for reverse DNS
            const response = await fetch(`https://api.hackertarget.com/reversedns/?q=${ip}`);
            const data = await response.text();
            
            if (data && !data.includes('error') && !data.includes('API LIMIT')) {
                const hostname = data.trim().split('\n')[0];
                if (hostname && hostname.length > 0) {
                    document.getElementById(elementId).textContent = hostname;
                    return;
                }
            }
            
            // Try ipapi.co
            const response2 = await fetch(`https://ipapi.co/${ip}/json/`);
            const data2 = await response2.json();
            
            if (data2.hostname && data2.hostname !== 'Not found') {
                document.getElementById(elementId).textContent = data2.hostname;
                return;
            }
            
            // Try ipwho.is as last resort
            const response3 = await fetch(`https://ipwho.is/${ip}`);
            const data3 = await response3.json();
            
            if (data3.connection?.hostname) {
                document.getElementById(elementId).textContent = data3.connection.hostname;
                return;
            }
            
            document.getElementById(elementId).textContent = 'Not available';
            
        } catch (error) {
            console.log('Hostname lookup failed for', ip, error);
            document.getElementById(elementId).textContent = 'Not available';
        }
    }
};

// WHOIS - RDAP lookup with human-readable formatting
const whois = {
    async search() {
        const input = document.getElementById('whois-input').value.trim();
        if (!input) {
            alert('Please enter an IP or domain');
            return;
        }

        const resultDiv = document.getElementById('whois-result');
        const errorDiv = document.getElementById('whois-error');
        
        resultDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');

        // Show loading
        resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching RDAP database...</p></div>';
        resultDiv.classList.remove('hidden');

        try {
            // Detect IP vs domain
            const isDomain = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input);
            const endpoint = isDomain ? `domain/${input}` : `ip/${input}`;

            const response = await fetch(`https://rdap.org/${endpoint}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            resultDiv.innerHTML = this.formatData(data);

        } catch (error) {
            console.error('RDAP error:', error);
            errorDiv.textContent = '❌ Error: ' + error.message + '. Check your input.';
            errorDiv.classList.remove('hidden');
            resultDiv.classList.add('hidden');
        }
    },

    formatData(data) {
        let html = '';

        // Domain/IP Handle
        if (data.handle) {
            html += `
                <div class="rdap-section">
                    <h3>Registry Handle</h3>
                    <div class="rdap-field">
                        <span class="rdap-field-value">${this.escape(data.handle)}</span>
                    </div>
                </div>
            `;
        }

        // Object Class
        if (data.objectClassName) {
            html += `
                <div class="rdap-section">
                    <h3>Type</h3>
                    <div class="rdap-field">
                        <span class="rdap-field-value">${this.escape(data.objectClassName)}</span>
                    </div>
                </div>
            `;
        }

        // Network info (for IPs)
        if (data.startAddress || data.endAddress) {
            html += `
                <div class="rdap-section">
                    <h3>IP Network Range</h3>
                    ${data.startAddress ? `<div class="rdap-field">
                        <span class="rdap-field-label">Start Address</span>
                        <span class="rdap-field-value">${this.escape(data.startAddress)}</span>
                    </div>` : ''}
                    ${data.endAddress ? `<div class="rdap-field">
                        <span class="rdap-field-label">End Address</span>
                        <span class="rdap-field-value">${this.escape(data.endAddress)}</span>
                    </div>` : ''}
                    ${data.cidrPrefix ? `<div class="rdap-field">
                        <span class="rdap-field-label">CIDR</span>
                        <span class="rdap-field-value">/${data.cidrPrefix}</span>
                    </div>` : ''}
                </div>
            `;
        }

        // Name (domain name)
        if (data.ldhName) {
            html += `
                <div class="rdap-section">
                    <h3>Domain Name</h3>
                    <div class="rdap-field">
                        <span class="rdap-field-value">${this.escape(data.ldhName)}</span>
                    </div>
                </div>
            `;
        }

        // Status
        if (data.status && data.status.length > 0) {
            html += `
                <div class="rdap-section">
                    <h3>Status</h3>
                    <ul class="rdap-list">
                        ${data.status.map(s => `<li>${this.escape(s)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Events (creation date, update, expiration, etc)
        if (data.events && data.events.length > 0) {
            const eventMap = {};
            data.events.forEach(e => {
                if (e.eventDate) {
                    const action = e.eventAction || 'Unknown';
                    const date = new Date(e.eventDate).toLocaleDateString();
                    eventMap[action] = date;
                }
            });

            if (Object.keys(eventMap).length > 0) {
                html += `
                    <div class="rdap-section">
                        <h3>Important Dates</h3>
                        ${Object.entries(eventMap).map(([action, date]) => `
                            <div class="rdap-field">
                                <span class="rdap-field-label">${this.escape(action)}</span>
                                <span class="rdap-field-value">${date}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        // Contacts/Entities
        if (data.entities && data.entities.length > 0) {
            data.entities.forEach((entity, idx) => {
                const role = entity.roles ? entity.roles.join(', ') : `Contact ${idx + 1}`;
                const vcard = entity.vcardArray ? entity.vcardArray[1] : [];
                
                let name = '', org = '', email = '', phone = '';
                
                if (vcard) {
                    vcard.forEach(prop => {
                        if (prop[0] === 'fn') name = prop[3];
                        if (prop[0] === 'org') org = prop[3];
                        if (prop[0] === 'email') email = prop[3];
                        if (prop[0] === 'tel') phone = prop[3];
                    });
                }

                if (name || email || org) {
                    html += `
                        <div class="rdap-section">
                            <h3>${this.escape(role)}</h3>
                            ${name ? `<div class="rdap-field">
                                <span class="rdap-field-label">Name</span>
                                <span class="rdap-field-value">${this.escape(name)}</span>
                            </div>` : ''}
                            ${org ? `<div class="rdap-field">
                                <span class="rdap-field-label">Organization</span>
                                <span class="rdap-field-value">${this.escape(org)}</span>
                            </div>` : ''}
                            ${email ? `<div class="rdap-field">
                                <span class="rdap-field-label">Email</span>
                                <span class="rdap-field-value">${this.escape(email)}</span>
                            </div>` : ''}
                            ${phone ? `<div class="rdap-field">
                                <span class="rdap-field-label">Phone</span>
                                <span class="rdap-field-value">${this.escape(phone)}</span>
                            </div>` : ''}
                        </div>
                    `;
                }
            });
        }

        // Notices
        if (data.notices && data.notices.length > 0) {
            const noticeTexts = data.notices
                .filter(n => n.title || (n.description && n.description.length > 0))
                .map(n => {
                    const title = n.title || 'Notice';
                    const desc = n.description ? n.description.join(' ') : '';
                    return `${title}${desc ? ': ' + desc : ''}`;
                });

            if (noticeTexts.length > 0) {
                html += `
                    <div class="rdap-section">
                        <h3>Legal Notices</h3>
                        <ul class="rdap-list">
                            ${noticeTexts.map(n => `<li>${this.escape(n)}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }

        // If nothing was found, show raw data
        if (!html) {
            html = `
                <div class="rdap-section">
                    <h3>Raw Data</h3>
                    <pre style="font-size: 0.85em; overflow-x: auto;">${this.escape(JSON.stringify(data, null, 2))}</pre>
                </div>
            `;
        }

        return `<div class="rdap-result">${html}</div>`;
    },

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Auto-scan on page load
document.addEventListener('DOMContentLoaded', () => scanner.refresh());

// Allow Enter key in search
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.id === 'whois-input') {
        whois.search();
    }
});
