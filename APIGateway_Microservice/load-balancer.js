/**
 * ====================================================================
 * Smart Campus Access Control - Round-Robin Load Balancer Module
 * ====================================================================
 * Round-robin load balancing across Access Log replicas.
 *
 * Two modes:
 *  1. Kubernetes (dnsHost set): the gateway resolves a *headless* Service, which
 *     returns one IP per ready pod, and refreshes that list every few seconds.
 *     Scaling the Deployment (kubectl scale / HPA) adds or removes targets
 *     automatically - no config change or gateway restart needed.
 *  2. Static (local development): a fixed list of instance URLs.
 */
const dns = require('dns').promises;

class RoundRobinLoadBalancer {
    /**
     * @param {string} serviceName
     * @param {object} options
     * @param {Array<{url:string,name?:string}>} [options.staticInstances]
     * @param {string} [options.dnsHost]  headless service DNS name
     * @param {number} [options.port]     port of the pods when using dnsHost
     * @param {number} [options.refreshMs]
     */
    constructor(serviceName, { staticInstances = [], dnsHost = '', port = 5005, refreshMs = 5000 } = {}) {
        this.serviceName = serviceName;
        this.dnsHost = dnsHost;
        this.port = port;
        this.currentIndex = 0;
        this.requestCounts = new Map(); // url -> count (kept across refreshes)
        this.instanceNames = new Map(); // url -> pod name reported by the instance
        this.instances = staticInstances.map(inst => this.toInstance(inst.url, inst.name));

        if (dnsHost) {
            this.refresh();
            this.timer = setInterval(() => this.refresh(), refreshMs);
            this.timer.unref();
        }
    }

    toInstance(url, name) {
        return { url, name: name || this.instanceNames.get(url) || url, port: Number(new URL(url).port) || this.port };
    }

    async refresh() {
        try {
            const ips = (await dns.resolve4(this.dnsHost)).sort();
            if (ips.length === 0) return;
            const next = ips.map(ip => this.toInstance(`http://${ip}:${this.port}`));
            const changed = next.map(i => i.url).join(',') !== this.instances.map(i => i.url).join(',');
            this.instances = next;
            if (changed) {
                console.log(`[Load Balancer: ${this.serviceName}] Pool updated: ${next.map(i => i.url).join(', ')}`);
            }
        } catch (err) {
            // Keep the last known pool; DNS hiccups must not take the route down.
            console.warn(`[Load Balancer: ${this.serviceName}] DNS refresh failed for ${this.dnsHost}: ${err.code || err.message}`);
        }
    }

    /** Remember the pod name an instance reports (X-Served-By-Instance header). */
    recordInstanceName(url, name) {
        if (!name || this.instanceNames.get(url) === name) return;
        this.instanceNames.set(url, name);
        const inst = this.instances.find(i => i.url === url);
        if (inst) inst.name = name;
    }

    /** Selects the next upstream target using the Round-Robin algorithm. */
    getNextTarget() {
        if (this.instances.length === 0) {
            throw new Error(`[Load Balancer] No upstream instances available for ${this.serviceName}`);
        }
        this.currentIndex = this.currentIndex % this.instances.length;
        const target = this.instances[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.instances.length;

        const count = (this.requestCounts.get(target.url) || 0) + 1;
        this.requestCounts.set(target.url, count);
        console.log(`[Load Balancer: ${this.serviceName}] Routing request #${count} -> ${target.name} (${target.url})`);
        return target;
    }

    /** Live stats showing load distribution across the current instances. */
    getStats() {
        const rows = this.instances.map(inst => ({
            name: inst.name,
            url: inst.url,
            port: inst.port,
            requestCount: this.requestCounts.get(inst.url) || 0
        }));
        const totalRequests = rows.reduce((sum, r) => sum + r.requestCount, 0);
        return {
            service: this.serviceName,
            mode: this.dnsHost ? `kubernetes-dns (${this.dnsHost})` : 'static',
            totalRequests,
            instances: rows.map(r => ({
                ...r,
                loadPercentage: totalRequests > 0 ? `${((r.requestCount / totalRequests) * 100).toFixed(1)}%` : '0%'
            }))
        };
    }
}

module.exports = RoundRobinLoadBalancer;
