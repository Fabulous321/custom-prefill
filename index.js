/**
 * 自定义预填充扩展 for SillyTavern
 * 
 * 这是一个 SillyTavern (酒馆) 扩展，为多种 LLM 模型自动添加预填充 (Prefill) 属性。
 * 
 * @author Fabulous
 * @version 2.0.0
 */

const multiPrefill = {
    EXTENSION_NAME: "自定义预填充",
    EXTENSION_FOLDER_PATH: "scripts/extensions/third-party/custom%20message",
    DEBUG: true,

    // Module references
    extension_settings: null,
    saveSettingsDebounced: null,
    eventSource: null,
    event_types: null,
    oai_settings: null,
    chat_completion_sources: null,
    getChatCompletionModel: null,

    // Preset rules for known providers
    PRESET_RULES: [
        {
            id: "deepseek",
            name: "DeepSeek",
            enabled: true,
            modelPattern: "deepseek",
            prefillProperty: "prefix",
            prefillValue: true,
            priority: 10
        },
        {
            id: "kimi",
            name: "Kimi (月之暗面)",
            enabled: true,
            modelPattern: "kimi|moonshot",
            prefillProperty: "partial",
            prefillValue: true,
            priority: 10
        }
    ],

    // Default settings
    defaultSettings: {
        globalEnabled: true,
        onlyForCustomSource: true,
        rules: null,  // Will be initialized from PRESET_RULES
        logEnabled: false
    },

    debugLog: function (...args) {
        if (this.DEBUG || this.getSettings().logEnabled) {
            console.log(`[${this.EXTENSION_NAME}]`, ...args);
        }
    },

    initializeSettings: function () {
        if (!this.extension_settings) return;

        try {
            if (!this.extension_settings[this.EXTENSION_NAME]) {
                this.extension_settings[this.EXTENSION_NAME] = Object.assign({}, this.defaultSettings);
                // Deep copy preset rules
                this.extension_settings[this.EXTENSION_NAME].rules = JSON.parse(JSON.stringify(this.PRESET_RULES));
            }

            // Ensure rules exist
            if (!this.extension_settings[this.EXTENSION_NAME].rules) {
                this.extension_settings[this.EXTENSION_NAME].rules = JSON.parse(JSON.stringify(this.PRESET_RULES));
            }

            this.debugLog('Settings initialized:', this.extension_settings[this.EXTENSION_NAME]);
        } catch (e) {
            console.error('[multi-prefill] initializeSettings error:', e);
        }
    },

    getSettings: function () {
        if (!this.extension_settings || !this.extension_settings[this.EXTENSION_NAME]) {
            return this.defaultSettings;
        }
        return this.extension_settings[this.EXTENSION_NAME];
    },

    getRules: function () {
        const settings = this.getSettings();
        return settings.rules || this.PRESET_RULES;
    },

    updateSettingsUI: function () {
        const settings = this.getSettings();

        jQuery('#multi_prefill_enabled').prop('checked', settings.globalEnabled);
        jQuery('#multi_prefill_custom_only').prop('checked', settings.onlyForCustomSource);
        jQuery('#multi_prefill_log').prop('checked', settings.logEnabled);

        this.renderRulesList();
    },

    renderRulesList: function () {
        const rules = this.getRules();
        const container = jQuery('#multi_prefill_rules_list');
        container.empty();

        if (!rules || rules.length === 0) {
            container.html('<div class="no-rules">暂无规则，请添加</div>');
            return;
        }

        rules.forEach((rule, index) => {
            const ruleHtml = `
                <div class="prefill-rule ${rule.enabled ? '' : 'disabled'}" data-index="${index}">
                    <div class="rule-header">
                        <label class="checkbox_label">
                            <input type="checkbox" class="rule-enabled" ${rule.enabled ? 'checked' : ''}>
                            <span class="rule-name">${this.escapeHtml(rule.name)}</span>
                        </label>
                        <button class="rule-delete menu_button" title="删除">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail">
                            <span class="label">模型匹配:</span>
                            <code>${this.escapeHtml(rule.modelPattern)}</code>
                        </div>
                        <div class="rule-detail">
                            <span class="label">属性:</span>
                            <code>${this.escapeHtml(rule.prefillProperty)}: ${JSON.stringify(rule.prefillValue)}</code>
                        </div>
                    </div>
                </div>
            `;
            container.append(ruleHtml);
        });
    },

    escapeHtml: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    bindSettingsEvents: function () {
        const self = this;

        // Global enable toggle
        jQuery('#multi_prefill_enabled').on('change', function () {
            const settings = self.getSettings();
            settings.globalEnabled = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Custom source only toggle
        jQuery('#multi_prefill_custom_only').on('change', function () {
            const settings = self.getSettings();
            settings.onlyForCustomSource = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Debug log toggle
        jQuery('#multi_prefill_log').on('change', function () {
            const settings = self.getSettings();
            settings.logEnabled = jQuery(this).prop('checked');
            if (self.saveSettingsDebounced) self.saveSettingsDebounced();
        });

        // Add preset buttons
        jQuery('#add_deepseek_rule').on('click', function () {
            self.addPresetRule('deepseek');
        });

        jQuery('#add_kimi_rule').on('click', function () {
            self.addPresetRule('kimi');
        });

        jQuery('#add_custom_rule').on('click', function () {
            self.showAddRuleDialog();
        });

        // Rule list events (delegation)
        jQuery('#multi_prefill_rules_list').on('change', '.rule-enabled', function () {
            const index = jQuery(this).closest('.prefill-rule').data('index');
            const rules = self.getRules();
            if (rules[index]) {
                rules[index].enabled = jQuery(this).prop('checked');
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
                self.renderRulesList();
            }
        });

        jQuery('#multi_prefill_rules_list').on('click', '.rule-delete', function () {
            const index = jQuery(this).closest('.prefill-rule').data('index');
            self.deleteRule(index);
        });
    },

    addPresetRule: function (presetId) {
        const preset = this.PRESET_RULES.find(r => r.id === presetId);
        if (!preset) return;

        const rules = this.getRules();

        // Check if already exists
        if (rules.find(r => r.id === presetId)) {
            toastr.info(`${preset.name} 规则已存在`);
            return;
        }

        rules.push(JSON.parse(JSON.stringify(preset)));
        if (this.saveSettingsDebounced) this.saveSettingsDebounced();
        this.renderRulesList();
        toastr.success(`已添加 ${preset.name} 规则`);
    },

    showAddRuleDialog: function () {
        const self = this;
        const html = `
            <div class="add-rule-dialog">
                <div class="form-group">
                    <label>规则名称</label>
                    <input type="text" id="new_rule_name" class="text_pole" placeholder="例如: GLM">
                </div>
                <div class="form-group">
                    <label>模型匹配 (正则)</label>
                    <input type="text" id="new_rule_pattern" class="text_pole" placeholder="例如: glm|chatglm">
                </div>
                <div class="form-group">
                    <label>预填充属性名</label>
                    <input type="text" id="new_rule_property" class="text_pole" value="prefix" placeholder="例如: prefix 或 partial">
                </div>
                <div class="form-group">
                    <label>预填充值</label>
                    <select id="new_rule_value" class="text_pole">
                        <option value="true">true (布尔)</option>
                        <option value="false">false (布尔)</option>
                    </select>
                </div>
            </div>
        `;

        callGenericPopup(html, POPUP_TYPE.CONFIRM, '添加自定义规则', {
            okButton: '添加',
            cancelButton: '取消',
            wide: false,
            large: false,
        }).then((result) => {
            if (result === POPUP_RESULT.AFFIRMATIVE) {
                const name = jQuery('#new_rule_name').val().trim();
                const pattern = jQuery('#new_rule_pattern').val().trim();
                const property = jQuery('#new_rule_property').val().trim();
                const valueStr = jQuery('#new_rule_value').val();

                if (!name || !pattern || !property) {
                    toastr.error('请填写所有必填项');
                    return;
                }

                const newRule = {
                    id: 'custom_' + Date.now(),
                    name: name,
                    enabled: true,
                    modelPattern: pattern,
                    prefillProperty: property,
                    prefillValue: valueStr === 'true',
                    priority: 10
                };

                const rules = self.getRules();
                rules.push(newRule);
                if (self.saveSettingsDebounced) self.saveSettingsDebounced();
                self.renderRulesList();
                toastr.success(`已添加 ${name} 规则`);
            }
        });
    },

    deleteRule: function (index) {
        const rules = this.getRules();
        if (index >= 0 && index < rules.length) {
            const ruleName = rules[index].name;
            rules.splice(index, 1);
            if (this.saveSettingsDebounced) this.saveSettingsDebounced();
            this.renderRulesList();
            toastr.info(`已删除 ${ruleName} 规则`);
        }
    },

    /**
     * Find a matching rule for the given model name
     */
    findMatchingRule: function (modelName) {
        if (!modelName) return null;

        const rules = this.getRules().filter(r => r.enabled);

        // Sort by priority (lower number = higher priority)
        rules.sort((a, b) => (a.priority || 10) - (b.priority || 10));

        for (const rule of rules) {
            try {
                const pattern = new RegExp(rule.modelPattern, 'i');
                if (pattern.test(modelName)) {
                    this.debugLog(`Model "${modelName}" matched rule "${rule.name}"`);
                    return rule;
                }
            } catch (e) {
                console.error(`[multi-prefill] Invalid regex in rule "${rule.name}":`, e);
            }
        }

        return null;
    },

    /**
     * Handle the CHAT_COMPLETION_PROMPT_READY event
     */
    onChatCompletionPromptReady: function (data) {
        const settings = this.getSettings();

        // Check if extension is enabled
        if (!settings.globalEnabled) {
            return;
        }

        // Check if we should only apply for Custom source
        if (settings.onlyForCustomSource && this.oai_settings && this.chat_completion_sources) {
            if (this.oai_settings.chat_completion_source !== this.chat_completion_sources.CUSTOM) {
                this.debugLog('Skipped: Not using Custom API source');
                return;
            }
        }

        // Get current model name
        let modelName = '';
        if (this.getChatCompletionModel) {
            modelName = this.getChatCompletionModel() || '';
        } else if (this.oai_settings) {
            modelName = this.oai_settings.custom_model || '';
        }

        if (!modelName) {
            this.debugLog('Skipped: Could not determine model name');
            return;
        }

        // Find matching rule
        const rule = this.findMatchingRule(modelName);
        if (!rule) {
            this.debugLog(`No matching rule found for model: ${modelName}`);
            return;
        }

        const messages = data.chat;

        // Check if we have messages and the last one is an assistant message
        if (!messages || !messages.length) {
            return;
        }

        const lastMessage = messages[messages.length - 1];

        if (lastMessage.role === 'assistant') {
            // Check if it already has the property set
            if (!lastMessage[rule.prefillProperty]) {
                lastMessage[rule.prefillProperty] = rule.prefillValue;

                this.debugLog(`Applied "${rule.name}" rule: ${rule.prefillProperty} = ${rule.prefillValue}`);
                this.debugLog('Message content:', String(lastMessage.content || '').substring(0, 100) + '...');
            }
        }
    },

    init: function () {
        const self = this;
        this.debugLog('Initializing...');

        // Dynamic imports
        import('../../../extensions.js').then(function (mod) {
            self.extension_settings = mod.extension_settings;
            return import('../../../../script.js');
        }).then(function (mod) {
            self.saveSettingsDebounced = mod.saveSettingsDebounced;
            self.eventSource = mod.eventSource;
            self.event_types = mod.event_types;

            // Try to get callGenericPopup for dialogs
            if (typeof callGenericPopup === 'undefined') {
                import('../../../popup.js').then(function (popupMod) {
                    window.callGenericPopup = popupMod.callGenericPopup;
                    window.POPUP_TYPE = popupMod.POPUP_TYPE;
                    window.POPUP_RESULT = popupMod.POPUP_RESULT;
                }).catch(function () {
                    self.debugLog('Could not load popup module');
                });
            }

            return import('../../../openai.js');
        }).then(function (mod) {
            self.oai_settings = mod.oai_settings;
            self.chat_completion_sources = mod.chat_completion_sources;
            self.getChatCompletionModel = mod.getChatCompletionModel;

            self.debugLog('Modules loaded');
            self.postInit();
        }).catch(function (err) {
            console.error('[multi-prefill] Module load error:', err);
        });
    },

    postInit: function () {
        const self = this;
        this.initializeSettings();

        // Load settings panel HTML
        fetch('/' + this.EXTENSION_FOLDER_PATH + '/settings.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
                const container = document.getElementById('extensions_settings2');
                if (container) {
                    container.insertAdjacentHTML('beforeend', html);
                    self.debugLog('Settings panel loaded');
                    self.updateSettingsUI();
                    self.bindSettingsEvents();
                }
            })
            .catch(function (e) {
                console.error('[multi-prefill] Settings panel error:', e);
            });

        // Register for the chat completion prompt ready event
        if (this.eventSource && this.event_types && this.event_types.CHAT_COMPLETION_PROMPT_READY) {
            this.eventSource.on(this.event_types.CHAT_COMPLETION_PROMPT_READY, function (data) {
                self.onChatCompletionPromptReady(data);
            });
            this.debugLog('Registered CHAT_COMPLETION_PROMPT_READY event');
        } else {
            console.error('[multi-prefill] Could not register event');
        }

        this.debugLog('Initialized!');
    }
};

// Initialize when document is ready
jQuery(document).ready(function () {
    setTimeout(function () {
        multiPrefill.init();
    }, 100);
});
