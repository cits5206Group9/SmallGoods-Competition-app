/**
 * Storage Module
 * Handles local storage, IndexedDB, and offline data management
 */

class StorageManager {
    constructor() {
        this.dbName = 'SmallGoodsCompetition';
        this.dbVersion = 1;
        this.db = null;
        this.stores = {
            competitions: 'competitions',
            athletes: 'athletes',
            attempts: 'attempts',
            events: 'events',
            queue: 'queue',
            settings: 'settings'
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.initIndexedDB();
            console.log('Storage initialized successfully');
        } catch (error) {
            console.error('Failed to initialize storage:', error);
        }
    }
    
    /**
     * Initialize IndexedDB
     */
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not supported, falling back to localStorage');
                resolve();
                return;
            }
            
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('IndexedDB failed to open');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB opened successfully');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                Object.values(this.stores).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        
                        // Create indexes based on store type
                        switch (storeName) {
                            case 'athletes':
                                store.createIndex('name', 'name', { unique: false });
                                store.createIndex('competitionId', 'competitionId', { unique: false });
                                break;
                            case 'attempts':
                                store.createIndex('athleteId', 'athleteId', { unique: false });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                break;
                            case 'events':
                                store.createIndex('competitionId', 'competitionId', { unique: false });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                break;
                        }
                    }
                });
            };
        });
    }
    
    /**
     * Generic IndexedDB operations
     */
    async getFromStore(storeName, key = null) {
        if (!this.db) {
            console.warn('IndexedDB not available, using localStorage fallback');
            return this.getFromLocalStorage(`${storeName}_${key || 'all'}`);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = key ? store.get(key) : store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async saveToStore(storeName, data) {
        if (!this.db) {
            console.warn('IndexedDB not available, using localStorage fallback');
            const key = `${storeName}_${data.id || Date.now()}`;
            return this.saveToLocalStorage(key, data);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteFromStore(storeName, key) {
        if (!this.db) {
            console.warn('IndexedDB not available, using localStorage fallback');
            return this.deleteFromLocalStorage(`${storeName}_${key}`);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async clearStore(storeName) {
        if (!this.db) {
            console.warn('IndexedDB not available, clearing localStorage entries');
            return this.clearLocalStorageByPrefix(storeName);
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * LocalStorage fallback methods
     */
    getFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get from localStorage:', error);
            return null;
        }
    }
    
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }
    
    deleteFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Failed to delete from localStorage:', error);
            return false;
        }
    }
    
    clearLocalStorageByPrefix(prefix) {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
            keys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
            return false;
        }
    }
    
    /**
     * High-level data operations
     */
    
    // Athletes
    async saveAthlete(athlete) {
        athlete.updatedAt = new Date().toISOString();
        return await this.saveToStore(this.stores.athletes, athlete);
    }
    
    async getAthletes(competitionId = null) {
        const athletes = await this.getFromStore(this.stores.athletes);
        if (!athletes) return [];
        
        return competitionId 
            ? athletes.filter(a => a.competitionId === competitionId)
            : athletes;
    }
    
    async getAthlete(id) {
        return await this.getFromStore(this.stores.athletes, id);
    }
    
    async deleteAthlete(id) {
        return await this.deleteFromStore(this.stores.athletes, id);
    }
    
    // Attempts
    async saveAttempt(attempt) {
        attempt.timestamp = attempt.timestamp || new Date().toISOString();
        attempt.synced = false; // Mark as unsynced for offline support
        return await this.saveToStore(this.stores.attempts, attempt);
    }
    
    async getAttempts(athleteId = null) {
        const attempts = await this.getFromStore(this.stores.attempts);
        if (!attempts) return [];
        
        return athleteId 
            ? attempts.filter(a => a.athleteId === athleteId)
            : attempts;
    }
    
    async getUnsyncedAttempts() {
        const attempts = await this.getFromStore(this.stores.attempts);
        if (!attempts) return [];
        
        return attempts.filter(a => !a.synced);
    }
    
    async markAttemptSynced(id) {
        const attempt = await this.getFromStore(this.stores.attempts, id);
        if (attempt) {
            attempt.synced = true;
            await this.saveToStore(this.stores.attempts, attempt);
        }
    }
    
    // Events
    async saveEvent(event) {
        event.timestamp = event.timestamp || new Date().toISOString();
        return await this.saveToStore(this.stores.events, event);
    }
    
    async getEvents(competitionId = null, limit = 100) {
        const events = await this.getFromStore(this.stores.events);
        if (!events) return [];
        
        let filtered = competitionId 
            ? events.filter(e => e.competitionId === competitionId)
            : events;
            
        // Sort by timestamp (newest first) and limit
        return filtered
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
    
    // Queue
    async saveQueue(queueData) {
        queueData.updatedAt = new Date().toISOString();
        queueData.id = queueData.competitionId || 'default';
        return await this.saveToStore(this.stores.queue, queueData);
    }
    
    async getQueue(competitionId = 'default') {
        return await this.getFromStore(this.stores.queue, competitionId);
    }
    
    // Settings
    async saveSetting(key, value) {
        const setting = {
            id: key,
            key,
            value,
            updatedAt: new Date().toISOString()
        };
        return await this.saveToStore(this.stores.settings, setting);
    }
    
    async getSetting(key, defaultValue = null) {
        const setting = await this.getFromStore(this.stores.settings, key);
        return setting ? setting.value : defaultValue;
    }
    
    /**
     * Bulk operations for sync
     */
    async exportData(competitionId = null) {
        const data = {
            athletes: await this.getAthletes(competitionId),
            attempts: await this.getAttempts(),
            events: await this.getEvents(competitionId),
            queue: await this.getQueue(competitionId),
            exportedAt: new Date().toISOString(),
            competitionId
        };
        
        return data;
    }
    
    async importData(data, overwrite = false) {
        try {
            if (overwrite) {
                // Clear existing data
                await this.clearStore(this.stores.athletes);
                await this.clearStore(this.stores.attempts);
                await this.clearStore(this.stores.events);
            }
            
            // Import athletes
            if (data.athletes) {
                for (const athlete of data.athletes) {
                    await this.saveAthlete(athlete);
                }
            }
            
            // Import attempts
            if (data.attempts) {
                for (const attempt of data.attempts) {
                    await this.saveAttempt(attempt);
                }
            }
            
            // Import events
            if (data.events) {
                for (const event of data.events) {
                    await this.saveEvent(event);
                }
            }
            
            // Import queue
            if (data.queue) {
                await this.saveQueue(data.queue);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
    
    /**
     * Storage space management
     */
    async getStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    used: estimate.usage,
                    available: estimate.quota,
                    percentage: Math.round((estimate.usage / estimate.quota) * 100)
                };
            } catch (error) {
                console.warn('Could not estimate storage usage:', error);
            }
        }
        
        return null;
    }
    
    async cleanupOldData(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            // Clean old events
            const events = await this.getFromStore(this.stores.events);
            if (events) {
                const oldEvents = events.filter(e => 
                    new Date(e.timestamp) < cutoffDate
                );
                
                for (const event of oldEvents) {
                    await this.deleteFromStore(this.stores.events, event.id);
                }
                
                console.log(`Cleaned up ${oldEvents.length} old events`);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to cleanup old data:', error);
            return false;
        }
    }
    
    /**
     * Search functionality
     */
    async searchAthletes(query) {
        const athletes = await this.getAthletes();
        if (!athletes || !query) return athletes || [];
        
        const lowerQuery = query.toLowerCase();
        return athletes.filter(athlete => 
            athlete.name.toLowerCase().includes(lowerQuery) ||
            (athlete.team && athlete.team.toLowerCase().includes(lowerQuery)) ||
            (athlete.category && athlete.category.toLowerCase().includes(lowerQuery))
        );
    }
    
    async searchAttempts(query, athleteId = null) {
        const attempts = await this.getAttempts(athleteId);
        if (!attempts || !query) return attempts || [];
        
        const lowerQuery = query.toLowerCase();
        return attempts.filter(attempt => 
            (attempt.lift && attempt.lift.toLowerCase().includes(lowerQuery)) ||
            (attempt.weight && attempt.weight.toString().includes(query)) ||
            (attempt.result && attempt.result.toLowerCase().includes(lowerQuery))
        );
    }
}

// Create global instance
window.storageManager = new StorageManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}