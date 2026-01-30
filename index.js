/**
 * DeepSeek Prefill Extension for SillyTavern
 * 
 * This extension automatically adds `prefix: true` to the last assistant message
 * when using Custom API sources pointing to DeepSeek-compatible endpoints.
 * 
 * @author Fabulous
 * @version 1.0.0
 */

const deepseekPrefill = {
    EXTENSION_NAME: "deepseek-prefill",
    EXTENSION_FOLDER_PATH: "scripts/extensions/third-party/custom%20message",
    DEBUG: true,

    // Module references
    extension_settings: null,
    saveSettingsDebounced: null,
    eventSource: null,
    event_types: null,
    oai_settings: null,
    chat_completion_sources: null,

    // Default settings
    defaultSettings: {
        enabled: true,
        onlyForCustomSource: true,
        modelPattern: "deepseek",
        logEnabled: false
    },

    debugLog: function (...args) {
        if (this.DEBUG) console.log(`[${this.EXTENSION_NAME}]`, ...args);
    },

    loadSettings: function () {
        if (!this.extension_settings) return;

        try {
            if (!this.extension_settings[this.EXTENSION_NAME]) {
                this.extension_settings[this.EXTENSION_NAME] = Object.assign({}, this.defaultSettings);
            }

            const settings = this.extension_settings[this.EXTENSION_NAME];

            jQuery('#deepseek_prefill_enabled').prop('checked', settings.enabled);
            jQuery('#deepseek_prefill_custom_only').prop('checked', settings.onlyForCustomSource);
            jQuery('#deepseek_prefill_model_pattern').val(settings.modelPattern);
            jQuery('#deepseek_prefill_log').prop('checked', settings.logEnabled);

            this.debugLog('Settings loaded:', settings);
        } catch (e) {
            console.error('[deepseek-prefill] loadSettings error:', e);
        }
    },

    getSettings: function () {
        if (!this.extension_settings || !this.extension_settings[this.EXTENSION_NAME]) {
            return this.defaultSettings;
        }
        return this.extension_settings[this.EXTENSION_NAME];
    },

    bindSettingsEvents: function () {
        const self = this;

        jQuery('#deepseek_prefill_enabled').on('change', function () {
            if (self.extension_settings && self.extension_settings[self.EXTENSION_NAME]) {
                self.extension_settings[self.EXTENSION_NAME].enabled = jQuery(this).prop('checked');
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
            }
        });

        jQuery('#deepseek_prefill_custom_only').on('change', function () {
            if (self.extension_settings && self.extension_settings[self.EXTENSION_NAME]) {
                self.extension_settings[self.EXTENSION_NAME].onlyForCustomSource = jQuery(this).prop('checked');
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
            }
        });

        jQuery('#deepseek_prefill_model_pattern').on('input', function () {
            if (self.extension_settings && self.extension_settings[self.EXTENSION_NAME]) {
                self.extension_settings[self.EXTENSION_NAME].modelPattern = jQuery(this).val();
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
            }
        });

        jQuery('#deepseek_prefill_log').on('change', function () {
            if (self.extension_settings && self.extension_settings[self.EXTENSION_NAME]) {
                self.extension_settings[self.EXTENSION_NAME].logEnabled = jQuery(this).prop('checked');
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
            }
        });
    },

    /**
     * Handle the CHAT_COMPLETION_PROMPT_READY event
     */
    onChatCompletionPromptReady: function (data) {
        const settings = this.getSettings();

        // Check if extension is enabled
        if (!settings.enabled) {
            return;
        }

        // Check if we should only apply for Custom source
        if (settings.onlyForCustomSource && this.oai_settings && this.chat_completion_sources) {
            if (this.oai_settings.chat_completion_source !== this.chat_completion_sources.CUSTOM) {
                if (settings.logEnabled) {
                    this.debugLog('Skipped: Not using Custom API source, current:', this.oai_settings.chat_completion_source);
                }
                return;
            }
        }

        // Check model pattern if specified
        if (settings.modelPattern && this.oai_settings) {
            const currentModel = this.oai_settings.custom_model || '';
            try {
                const pattern = new RegExp(settings.modelPattern, 'i');
                if (!pattern.test(currentModel)) {
                    if (settings.logEnabled) {
                        this.debugLog(`Skipped: Model "${currentModel}" doesn't match pattern "${settings.modelPattern}"`);
                    }
                    return;
                }
            } catch (e) {
                console.error('[deepseek-prefill] Invalid regex pattern:', e);
                return;
            }
        }

        const messages = data.chat;

        // Check if we have messages and the last one is an assistant message
        if (!messages || !messages.length) {
            return;
        }

        const lastMessage = messages[messages.length - 1];

        if (lastMessage.role === 'assistant') {
            // Check if it already has prefix set
            if (!lastMessage.prefix) {
                lastMessage.prefix = true;

                if (settings.logEnabled) {
                    this.debugLog('Added prefix: true to last assistant message');
                    this.debugLog('Message content:', String(lastMessage.content || '').substring(0, 100) + '...');
                }
            }
        }
    },

    init: function () {
        const self = this;
        this.debugLog('Initializing...');

        // Dynamic imports - this is the correct way for third-party extensions
        import('../../../extensions.js').then(function (mod) {
            self.extension_settings = mod.extension_settings;
            return import('../../../../script.js');
        }).then(function (mod) {
            self.saveSettingsDebounced = mod.saveSettingsDebounced;
            self.eventSource = mod.eventSource;
            self.event_types = mod.event_types;

            return import('../../../openai.js');
        }).then(function (mod) {
            self.oai_settings = mod.oai_settings;
            self.chat_completion_sources = mod.chat_completion_sources;

            self.debugLog('Modules loaded');
            self.postInit();
        }).catch(function (err) {
            console.error('[deepseek-prefill] Module load error:', err);
        });
    },

    postInit: function () {
        const self = this;
        this.loadSettings();

        // Load settings panel HTML
        fetch('/' + this.EXTENSION_FOLDER_PATH + '/settings.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
                const container = document.getElementById('extensions_settings2');
                if (container) {
                    container.insertAdjacentHTML('beforeend', html);
                    self.debugLog('Settings panel loaded');
                    self.loadSettings(); // Re-load to update UI
                    self.bindSettingsEvents();
                }
            })
            .catch(function (e) {
                console.error('[deepseek-prefill] Settings panel error:', e);
            });

        // Register for the chat completion prompt ready event
        if (this.eventSource && this.event_types && this.event_types.CHAT_COMPLETION_PROMPT_READY) {
            this.eventSource.on(this.event_types.CHAT_COMPLETION_PROMPT_READY, function (data) {
                self.onChatCompletionPromptReady(data);
            });
            this.debugLog('Registered CHAT_COMPLETION_PROMPT_READY event');
        } else {
            console.error('[deepseek-prefill] Could not register event - eventSource or event_types not available');
        }

        this.debugLog('Initialized!');
    }
};

// Initialize when document is ready
jQuery(document).ready(function () {
    setTimeout(function () {
        deepseekPrefill.init();
    }, 100);
});
