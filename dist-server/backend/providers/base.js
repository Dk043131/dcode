"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProvider = void 0;
class AIProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    getId() {
        return this.config.id;
    }
    getName() {
        return this.config.name;
    }
    getType() {
        return this.config.type;
    }
    getConfig() {
        return this.config;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}
exports.AIProvider = AIProvider;
